import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from '../config';
import { Economy } from '../core/Economy';
import { EventBus } from '../core/EventBus';
import { Save } from '../core/SaveManager';
import { itemCatalog } from '../data/catalog';
import { dishesForLevel } from '../data/content';
import starterLayoutJson from '../data/starterLayout.json';
import type { Dish, Zombie, ZombieInstance } from '../data/types';
import {
  CafeGrid,
  DEFAULT_SPEED_STAT,
  TAP_VS_PAN_PX,
  zombieTilesPerSec,
  type FootprintItem,
  type LayoutSchema,
  type PlacementId,
  type Seat,
  type Tile,
} from '../engine/contracts';
import { CharacterActor } from '../game/actors/CharacterActor';
import { CustomerActor } from '../game/actors/CustomerActor';
import { PuppetBody } from '../game/actors/PuppetBody';
import { CounterSim } from '../game/CounterSim';
import { StoveSim } from '../game/StoveSim';
import { CookbookPanel } from '../ui/CookbookPanel';
import { RoomView } from '../view/RoomView';

const MAX_TICK_SEC = 0.25; // clamp render-loop dt; long gaps are offline settlement's job

// Zombie energy (researched: work tires zombies; "cooking wears them out so
// much faster"; tired zombies misbehave). Exact rates are UNKNOWN — tuned.
const DRAIN_COOK = 0.3; // energy/sec while a stove cooks under them
const DRAIN_JOB = 0.12; // energy/sec while carrying/serving/clearing
const REGEN_IDLE = 0.8; // energy/sec while standing around
const TIRED_AT = 15; // below this a zombie daydreams and refuses new jobs

interface ActiveJob {
  visual: Phaser.GameObjects.Ellipse | null; // the carried pot/plate
}

interface DirtyPlate {
  id: string;
  tableId: PlacementId;
  chairId: string;
  claimed: boolean;
  sprite: Phaser.GameObjects.Ellipse;
}

export class CafeScene extends Phaser.Scene {
  private grid!: CafeGrid;
  private view!: RoomView;
  private stoves: StoveSim[] = [];
  private counters = new Map<PlacementId, CounterSim>();
  private sinks: PlacementId[] = [];
  private waiters: CharacterActor[] = [];
  private customers = new Set<CustomerActor>();
  private seatsTaken = new Set<string>(); // seatId = chair placementId
  private spawnTimer = 3000;
  private saveTimer = 5000;
  private jobScanTimer = 900;
  private servedSinceLevel = 0;
  private seedCounter = 1;
  private stovesById = new Map<PlacementId, StoveSim>();
  private cookbook!: CookbookPanel;
  // Waiter AI: one job per actor (carry a pot / serve a plate / clear a dish).
  private jobs = new Map<CharacterActor, ActiveJob>();
  private dirtyPlates: DirtyPlate[] = [];
  private plateCounter = 1;
  // Edit mode: hold a furniture piece to lift it, tap a tile to set it down.
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private moveSession: { id: PlacementId; item: FootprintItem; rot: 0 | 1; ghost: Phaser.GameObjects.Image } | null = null;
  // Street life: render-only pedestrians passing on the sidewalk.
  private peds: { body: PuppetBody; shadow: Phaser.GameObjects.Ellipse; fx: number; fy: number; dir: 1 | -1; speed: number; phase: number }[] = [];
  private pedTimer = 2500;
  private panStart: { x: number; y: number; sx: number; sy: number } | null = null;
  // Tap-to-control (original: zombies are re-taskable): the selected waiter.
  private selected: CharacterActor | null = null;
  private selectMarker: Phaser.GameObjects.Triangle | null = null;
  private refillChip: Phaser.GameObjects.Container | null = null;
  private waiterActors = new Map<ZombieInstance, CharacterActor>();

  constructor() {
    super('Cafe');
  }

  create(): void {
    this.buildBackdrop();

    const { grid, repairs } = CafeGrid.deserialize(starterLayoutJson as LayoutSchema, itemCatalog);
    if (repairs.length > 0) console.warn('[layout] repairs applied:', repairs);
    this.grid = grid;
    this.view = new RoomView(this, grid);
    this.view.fitCamera(36);

    this.scene.launch('Hud');
    this.cookbook = new CookbookPanel(this);
    this.buildStations();
    this.setupEditMode();
    this.grid.events.on('moved', ({ placement }) => {
      this.stovesById.get(placement.id)?.reposition();
      this.counters.get(placement.id)?.reposition();
    });
    this.staffStartersFromSave();
    this.reportOfflineEarnings();

    EventBus.publish('notify', 'Tap a stove to open the cookbook. Tap a customer to infect them (1 Toxin)!');

    // Progress comes from SERVING (canon §6), and service quality moves the
    // star rating, which drives how fast customers show up (researched).
    const unsubs = [
      EventBus.subscribe('customer-served', () => {
        this.maybeLevelUp();
        Save.data.rating = Math.min(5, Save.data.rating + 0.06);
        EventBus.publish('rating-changed', Save.data.rating);
      }),
      EventBus.subscribe('customer-angry', () => {
        Save.data.rating = Math.max(1, Save.data.rating - 0.3);
        EventBus.publish('rating-changed', Save.data.rating);
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));

    this.game.events.on(Phaser.Core.Events.BLUR, () => Save.save());
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') Save.save();
    });
  }

  // ── setup ──────────────────────────────────────────────────────────────────

  private buildBackdrop(): void {
    // The city outside: screen-fixed, behind the diorama — Deadbeat Diner sits
    // on a night street corner, not in a void.
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'city_bg');
    bg.setScrollFactor(0).setDepth(-100).setAlpha(0.92);
    // Push the backdrop back so the diner reads as the subject, not a sticker.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 2, GAME_HEIGHT * 2, 0x0a0c12, 0.52)
      .setScrollFactor(0)
      .setDepth(-99);
    bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height) / this.cameras.main.zoom || 1);
    // Re-fit after camera zoom is known (fitCamera runs later in create()).
    this.time.delayedCall(0, () => {
      const z = this.cameras.main.zoom;
      bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height) / z);
    });
  }

  private buildStations(): void {
    for (const p of this.grid.placements().values()) {
      if (p.kind === 'stove') {
        const stove = new StoveSim(this.view, p.id);
        this.stoves.push(stove);
        this.stovesById.set(p.id, stove);
      } else if (p.kind === 'counter') {
        this.counters.set(p.id, new CounterSim(this.view, p.id));
      } else if (p.kind === 'sink') {
        this.sinks.push(p.id);
      }
    }
  }

  /** Kitchen zombies man the stoves on boot; idle staff wander in to serve. */
  private staffStartersFromSave(): void {
    const kitchen = Save.data.zombies.filter((z) => z.assignment === 'kitchen');
    kitchen.slice(0, this.stoves.length).forEach((z, i) => this.sendWaiterTo(this.stoves[i], z, null));
    for (const z of Save.data.zombies) {
      if (z.assignment === 'idle') this.ensureActorFor(z);
    }
  }

  /** Every owned zombie is a body in the room — the serve/clear AI needs hands. */
  private ensureActorFor(inst: ZombieInstance): CharacterActor {
    const existing = this.waiterActors.get(inst);
    if (existing) return existing;
    const speed = zombieTilesPerSec(DEFAULT_SPEED_STAT);
    const w = new CharacterActor(this.view, 'zombie_waiter', this.grid.door(), speed, this.seedCounter++, `waiter_${this.seedCounter}`);
    this.registerWaiter(w, inst);
    // Shamble somewhere out of the doorway and await orders.
    const spot = this.findLoiterTile();
    if (spot) w.walker.requestMove(spot);
    return w;
  }

  private findLoiterTile(): Tile | null {
    const cx = Math.floor(this.grid.w / 2);
    const cy = Math.floor(this.grid.h / 2);
    for (let r = 0; r < Math.max(this.grid.w, this.grid.h); r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const t = { tx: cx + dx, ty: cy + dy };
          if (this.grid.walkable(t)) return t;
        }
      }
    }
    return null;
  }

  private sendWaiterTo(stove: StoveSim, zombie: ZombieInstance, dish: Dish | null): boolean {
    // The one stat->speed module; StaffStats (M6) will own stat derivation.
    const speed = zombieTilesPerSec(DEFAULT_SPEED_STAT);
    const w = new CharacterActor(this.view, 'zombie_waiter', this.grid.door(), speed, this.seedCounter++, `waiter_${this.seedCounter}`);
    if (!this.taskWaiterToStove(w, zombie, stove, dish)) {
      w.destroy();
      EventBus.publish('notify', 'That stove is walled off — your zombie refuses.');
      return false;
    }
    this.registerWaiter(w, zombie);
    return true;
  }

  /** Walk a (new or re-tasked) waiter to a stove and bind arrival to cooking. */
  private taskWaiterToStove(w: CharacterActor, zombie: ZombieInstance, stove: StoveSim, dish: Dish | null): boolean {
    const cells = this.grid.interactionCells(stove.placementId);
    if (cells.length === 0) return false;
    // Any reachable interaction cell will do — layouts can seal some of them.
    const reached = cells.some((cell) => w.walker.requestMove(cell).status === 'ok');
    if (!reached) return false;
    zombie.assignment = 'kitchen';
    stove.expectStaff(dish); // stove stays honest: no double-dispatch window
    w.sprite.setData('stoveId', stove.placementId);
    const onTick = (events: ReturnType<CharacterActor['tick']>) => {
      for (const e of events) {
        if (e.type === 'arrived') stove.staffArrived(zombie);
        if (e.type === 'blocked') {
          // Route died (furniture moved mid-walk): free everyone honestly.
          // The zombie stays where they froze — tap them to re-task.
          this.releaseWaiter(w);
          EventBus.publish('notify', 'Your zombie got walled in — tap them to re-task.');
        }
      }
    };
    w.sprite.setData('onTick', onTick);
    return true;
  }

  private registerWaiter(w: CharacterActor, zombie: ZombieInstance): void {
    this.waiters.push(w);
    this.waiterActors.set(zombie, w);
    w.sprite.setData('waiterRef', w);
    w.sprite.setData('zombieInst', zombie);
    w.sprite.enableTap();
  }

  /** Free a waiter from whatever they were doing (stove reverts honestly). */
  private releaseWaiter(w: CharacterActor): void {
    const stoveId = w.sprite.getData('stoveId') as PlacementId | undefined;
    const zombie = w.sprite.getData('zombieInst') as ZombieInstance | undefined;
    if (stoveId) {
      this.stovesById.get(stoveId)?.releaseCook();
      w.sprite.setData('stoveId', undefined);
    }
    if (zombie) zombie.assignment = 'idle';
    w.sprite.setData('onTick', undefined);
    this.endJob(w);
  }

  private reportOfflineEarnings(): void {
    const r = Save.lastOffline;
    if (!r) return;
    const mins = Math.floor(r.seconds / 60);
    const label = mins >= 1 ? `${mins} min` : `${r.seconds}s`;
    this.time.delayedCall(600, () =>
      EventBus.publish('notify', `Welcome back! Your zombies cooked ${r.coins} coins in ${label}. 🧟`),
    );
  }

  // ── the service chain (researched: stove -> counter -> table -> sink) ───────

  /** Central tap router for stoves — state decides the verb. */
  private onStoveTapped(stove: StoveSim, preferredCook: CharacterActor | null): void {
    switch (stove.state) {
      case 'burnt':
        stove.discardBurnt();
        EventBus.publish('notify', 'Burnt! The dish is wasted — toss it and try again.');
        break;
      case 'ready':
        this.startCarryJob(stove, preferredCook);
        break;
      case 'cooking': {
        if (!stove.zombie) {
          // A paused pot: send the selected zombie (or any idle one) to resume.
          const w = preferredCook ?? this.findIdleWorker();
          if (w) {
            const inst = w.sprite.getData('zombieInst') as ZombieInstance;
            this.releaseWaiter(w);
            if (this.taskWaiterToStove(w, inst, stove, null)) this.deselectWaiter();
            break;
          }
          EventBus.publish('notify', 'The pot is paused — no cook! Free up a zombie.');
          break;
        }
        const m = Math.ceil(stove.remainingSec() / 60);
        EventBus.publish('notify', `${stove.dish?.displayName ?? 'The dish'} needs ${m >= 1 ? `${m} min` : 'a moment'} more.`);
        break;
      }
      case 'staffed':
      case 'awaiting-cook':
        this.openCookbook(stove, null);
        break;
      case 'unstaffed': {
        // Need someone to cook before the menu makes sense.
        const hasCook = preferredCook ?? this.findCookCandidate();
        if (!hasCook) {
          EventBus.publish('notify', 'No idle zombies — infect a customer first!');
          return;
        }
        this.openCookbook(stove, preferredCook);
        break;
      }
    }
  }

  private findCookCandidate(): ZombieInstance | null {
    for (const z of Save.data.zombies) {
      if (z.assignment !== 'idle') continue;
      const actor = this.waiterActors.get(z);
      if (actor && this.jobs.has(actor)) continue; // mid-delivery — not free
      return z;
    }
    return null;
  }

  private openCookbook(stove: StoveSim, preferredCook: CharacterActor | null): void {
    const dishes = dishesForLevel(Save.data.cafeLevel);
    this.cookbook.open(
      dishes,
      Economy.coins,
      (dish) => this.onDishPicked(stove, dish, preferredCook),
      () => {},
    );
  }

  /** Pay up front, then route the order to whoever will cook it (authentic). */
  private onDishPicked(stove: StoveSim, dish: Dish, preferredCook: CharacterActor | null): void {
    if (!Economy.spendCoins(dish.price)) {
      EventBus.publish('notify', 'Not enough coins for that dish.');
      return;
    }
    const refund = () => Economy.addCoins(dish.price);
    if (stove.state === 'staffed' && stove.zombie) {
      stove.beginCook(dish);
    } else if (stove.state === 'awaiting-cook') {
      stove.queueDish(dish);
    } else if (stove.state === 'unstaffed') {
      let w: CharacterActor | null = preferredCook;
      let inst: ZombieInstance | null = w ? (w.sprite.getData('zombieInst') as ZombieInstance) : this.findCookCandidate();
      if (!inst) {
        refund();
        EventBus.publish('notify', 'No idle zombies to cook it.');
        return;
      }
      if (w) this.releaseWaiter(w);
      else w = this.waiterActors.get(inst) ?? null;
      const ok = w ? this.taskWaiterToStove(w, inst, stove, dish) : this.sendWaiterTo(stove, inst, dish);
      if (!ok) {
        refund();
        EventBus.publish('notify', 'That stove is unreachable — clear a path!');
        return;
      }
    } else {
      refund(); // stove state changed while the menu was open
      return;
    }
    this.deselectWaiter();
  }

  /** Finished food gets CARRIED to a serving counter (the original's core verb). */
  private startCarryJob(stove: StoveSim, preferred: CharacterActor | null): void {
    const batchDish = stove.dish;
    if (!batchDish) return;
    const counter = this.pickCounterFor(batchDish, stove.placementId);
    if (!counter) {
      EventBus.publish('notify', 'No serving counter with space — move or add one!');
      return;
    }
    const w =
      preferred ??
      (stove.zombie ? this.waiterActors.get(stove.zombie) : undefined) ??
      this.findIdleWorker();
    if (!w || this.jobs.has(w)) {
      EventBus.publish('notify', 'No zombie free to carry the food.');
      return;
    }
    const inst = w.sprite.getData('zombieInst') as ZombieInstance;
    this.releaseWaiter(w);
    const job: ActiveJob = { visual: null };
    this.jobs.set(w, job);
    this.walkThen(
      w,
      this.grid.interactionCells(stove.placementId),
      () => {
        const batch = stove.takeBatch();
        if (!batch) return this.endJob(w); // burnt or taken while walking over
        job.visual = this.add.ellipse(0, 0, 22, 13, PALETTE.toxic, 1).setStrokeStyle(2, 0x0d0f14);
        this.walkThen(
          w,
          this.grid.interactionCells(counter.placementId),
          () => {
            counter.stock(batch);
            this.endJob(w);
            // The cook heads back to their stove for the next order.
            if (stove.state === 'unstaffed') this.taskWaiterToStove(w, inst, stove, null);
          },
          () => {
            this.endJob(w);
            EventBus.publish('notify', 'The pot was dropped — food wasted!');
          },
        );
      },
      () => this.endJob(w),
    );
    this.deselectWaiter();
  }

  private startServeJob(w: CharacterActor, counter: CounterSim, customer: CustomerActor): void {
    counter.reserve();
    customer.claimed = true;
    const job: ActiveJob = { visual: null };
    this.jobs.set(w, job);
    this.walkThen(
      w,
      this.grid.interactionCells(counter.placementId),
      () => {
        const dish = counter.take();
        if (!dish) {
          customer.claimed = false;
          return this.endJob(w);
        }
        job.visual = this.add.ellipse(0, 0, 18, 11, 0xece7d6, 1).setStrokeStyle(2, 0x0d0f14);
        this.walkThen(
          w,
          this.grid.interactionCells(customer.seat.tableId),
          () => {
            if (customer.phase === 'waiting') customer.serve(dish);
            this.endJob(w);
          },
          () => {
            customer.claimed = false;
            this.endJob(w);
          },
        );
      },
      () => {
        counter.cancelReserve();
        customer.claimed = false;
        this.endJob(w);
      },
    );
  }

  private startClearJob(w: CharacterActor, plate: DirtyPlate): void {
    plate.claimed = true;
    const job: ActiveJob = { visual: null };
    this.jobs.set(w, job);
    const finishPlate = () => {
      this.dirtyPlates = this.dirtyPlates.filter((p) => p !== plate);
      this.seatsTaken.delete(plate.chairId); // the table is finally free again
    };
    this.walkThen(
      w,
      this.grid.interactionCells(plate.tableId),
      () => {
        plate.sprite.destroy();
        job.visual = this.add.ellipse(0, 0, 18, 11, 0xb9b2a4, 1).setStrokeStyle(2, 0x0d0f14);
        const sink = this.sinks.find((s) => this.grid.interactionCells(s).length > 0);
        if (!sink) {
          finishPlate(); // no sink: don't softlock the seat, just eat the cost
          return this.endJob(w);
        }
        this.walkThen(
          w,
          this.grid.interactionCells(sink),
          () => {
            finishPlate();
            this.endJob(w);
          },
          () => {
            finishPlate();
            this.endJob(w);
          },
        );
      },
      () => {
        plate.claimed = false;
        this.endJob(w);
      },
    );
  }

  /** Walk to any of `cells`; fire arrive/fail exactly once. Already there = arrived. */
  private walkThen(w: CharacterActor, cells: Tile[], onArrive: () => void, onFail: () => void): void {
    const ok = cells.some((c) => w.walker.requestMove(c).status === 'ok');
    if (!ok) return onFail();
    if (w.walker.state === 'idle') {
      // requestMove to the tile we already stand on: no events will fire.
      w.sprite.setData('onTick', undefined);
      onArrive();
      return;
    }
    w.sprite.setData('onTick', (events: ReturnType<CharacterActor['tick']>) => {
      for (const e of events) {
        if (e.type === 'arrived') {
          w.sprite.setData('onTick', undefined);
          onArrive();
          return;
        }
        if (e.type === 'blocked') {
          w.sprite.setData('onTick', undefined);
          onFail();
          return;
        }
      }
    });
  }

  private endJob(w: CharacterActor): void {
    const job = this.jobs.get(w);
    job?.visual?.destroy();
    this.jobs.delete(w);
  }

  private pickCounterFor(dish: Dish, nearId: PlacementId): CounterSim | null {
    const near = this.grid.placements().get(nearId);
    let best: CounterSim | null = null;
    let bestDist = Infinity;
    for (const c of this.counters.values()) {
      if (!c.canStock(dish) || this.grid.interactionCells(c.placementId).length === 0) continue;
      const p = this.grid.placements().get(c.placementId);
      const d = near && p ? Math.abs(near.anchor.tx - p.anchor.tx) + Math.abs(near.anchor.ty - p.anchor.ty) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private findIdleWorker(): CharacterActor | null {
    for (const [inst, actor] of this.waiterActors) {
      if (inst.assignment !== 'idle') continue;
      if (this.jobs.has(actor)) continue;
      if (inst.energy < TIRED_AT) continue; // daydreaming — must rest first
      if (actor.walker.state !== 'idle') continue;
      return actor;
    }
    return null;
  }

  /** The waiter AI heartbeat: match hungry customers and dirty tables to staff. */
  private scanJobs(): void {
    for (const c of this.customers) {
      if (c.phase !== 'waiting' || c.claimed) continue;
      const counter = [...this.counters.values()].find(
        (k) => k.available() > 0 && this.grid.interactionCells(k.placementId).length > 0,
      );
      if (!counter) break; // nothing stocked — customers keep waiting
      const w = this.findIdleWorker();
      if (!w) break;
      this.startServeJob(w, counter, c);
    }
    for (const plate of this.dirtyPlates) {
      if (plate.claimed) continue;
      const w = this.findIdleWorker();
      if (!w) break;
      this.startClearJob(w, plate);
    }
  }

  private spawnDirtyPlate(seat: Seat): void {
    const table = this.view.furnitureSprite(seat.tableId);
    if (!table) return;
    const sprite = this.add
      .ellipse(table.x + 6, table.y - table.displayHeight * 0.52, 20, 12, 0xdad5c8, 1)
      .setStrokeStyle(2, 0x3a3630)
      .setDepth(table.depth + 1);
    this.dirtyPlates.push({
      id: `plate_${this.plateCounter++}`,
      tableId: seat.tableId,
      chairId: seat.chairId,
      claimed: false,
      sprite,
    });
  }

  // ── customers ──────────────────────────────────────────────────────────────

  private freeSeat(): Seat | null {
    // Researched: a customer always walks to the NEAREST open table.
    const door = this.grid.door();
    const seats = this.grid
      .seats()
      .filter((s) => !this.seatsTaken.has(s.chairId))
      .sort(
        (a, b) =>
          Math.abs(a.tile.tx - door.tx) + Math.abs(a.tile.ty - door.ty) -
          (Math.abs(b.tile.tx - door.tx) + Math.abs(b.tile.ty - door.ty)),
      );
    return seats[0] ?? null;
  }

  private spawnCustomer(): void {
    const seat = this.freeSeat();
    if (!seat) return; // full house — tables gate throughput (researched)
    this.seatsTaken.add(seat.chairId);
    const c = new CustomerActor(
      this.view,
      seat,
      this.seedCounter++,
      (z) => this.onCustomerConverted(z),
      (ate) => this.spawnDirtyPlate(ate.seat),
      (done) => {
        this.customers.delete(done);
        // The seat stays blocked while a dirty plate sits on the table.
        const dirty = this.dirtyPlates.some((p) => p.chairId === done.seat.chairId);
        if (!dirty) this.seatsTaken.delete(done.seat.chairId);
      },
    );
    this.customers.add(c);
  }

  private onCustomerConverted(z: Zombie): void {
    const inst: ZombieInstance = { zombieId: z.zombieId, level: 1, xp: 0, assignment: 'idle', energy: 100 };
    Save.data.zombies.push(inst);
    EventBus.publish('zombie-added', z);
    // The fresh recruit shuffles back in through the door, ready for orders.
    this.time.delayedCall(2500, () => this.ensureActorFor(inst));
  }

  private tryInfect(c: CustomerActor): void {
    if (!c.canInfect()) return;
    if (!Economy.spendToxin(1)) {
      EventBus.publish('notify', 'You need Toxin to infect customers — earn it from play!');
      return;
    }
    c.infectByPlayer();
  }

  private maybeLevelUp(): void {
    this.servedSinceLevel++;
    if (this.servedSinceLevel >= 6 && Save.data.cafeLevel < 20) {
      this.servedSinceLevel = 0;
      Save.data.cafeLevel++;
      EventBus.publish('cafe-level-up', Save.data.cafeLevel);
      EventBus.publish('notify', `Cafe reached level ${Save.data.cafeLevel}! New recipes in the cookbook.`);
    }
  }

  // ── edit mode (hold to lift, tap to place — the original's rearrange-anytime) ──

  private setupEditMode(): void {
    // Phaser's topmost-only resolution mis-sorts containers vs images, so we
    // receive EVERYTHING under the pointer and resolve priority ourselves:
    // customer > zombie > furniture > floor (the original's verb order).
    this.input.topOnly = false;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.moveSession) {
        if (!over.some((o) => o.getData('placementId') === this.moveSession?.id)) this.tryDrop(ptr);
        return;
      }
      const id = this.topPlacement(over);
      if (id) {
        this.holdTimer?.remove();
        this.holdTimer = this.time.delayedCall(350, () => this.enterMoveMode(id));
      }
      const cam = this.cameras.main;
      this.panStart = { x: ptr.x, y: ptr.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.moveSession) {
        this.updateGhost(ptr);
        return;
      }
      // Drag-to-pan, like the original's scrollable cafe view.
      if (ptr.isDown && this.panStart) {
        const dx = ptr.x - this.panStart.x;
        const dy = ptr.y - this.panStart.y;
        if (Math.hypot(dx, dy) > TAP_VS_PAN_PX) {
          this.holdTimer?.remove(); // a drag is not a furniture-lift hold
          this.holdTimer = null;
          const cam = this.cameras.main;
          cam.scrollX = this.panStart.sx - dx / cam.zoom;
          cam.scrollY = this.panStart.sy - dy / cam.zoom;
        }
      }
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      this.holdTimer?.remove();
      this.holdTimer = null;
      this.panStart = null;
      const wasTap = ptr.getDistance() <= TAP_VS_PAN_PX;
      if (!wasTap || this.moveSession || this.cookbook.isOpen || this.cookbook.justClosed) return;
      over = over.filter((o) => o.active); // a UI tap may have destroyed its target
      if (over.some((o) => o.getData('uiBlock'))) return; // fixed UI ate the tap
      // 1) customers: the Toxin infection verb (researched)
      const cust = over.map((o) => o.getData('customerRef') as CustomerActor | undefined).find(Boolean);
      if (cust) {
        this.tryInfect(cust);
        return;
      }
      // 2) zombies: select for re-tasking
      const waiter = over.map((o) => o.getData('waiterRef') as CharacterActor | undefined).find(Boolean);
      if (waiter) {
        if (this.selected === waiter) this.deselectWaiter();
        else this.selectWaiter(waiter);
        return;
      }
      // 3) furniture: stoves route by state
      const id = this.topPlacement(over);
      if (id) {
        const stove = this.stovesById.get(id);
        if (stove) this.onStoveTapped(stove, this.selected);
        else if (this.selected) this.deselectWaiter();
        return;
      }
      // 4) open floor: command the selected zombie
      if (this.selected) this.commandToTile(ptr);
    });
  }

  /** Highest-depth furniture under the pointer (visual stacking = tap winner). */
  private topPlacement(over: Phaser.GameObjects.GameObject[]): PlacementId | undefined {
    let best: PlacementId | undefined;
    let bestDepth = -Infinity;
    for (const o of over) {
      const id = o.getData('placementId') as PlacementId | undefined;
      if (!id) continue;
      const depth = (o as Phaser.GameObjects.Image).depth ?? 0;
      if (depth > bestDepth) {
        bestDepth = depth;
        best = id;
      }
    }
    return best;
  }

  // ── tap-to-control (tap a zombie, then tap a tile or stove) ─────────────────

  private selectWaiter(w: CharacterActor): void {
    this.deselectWaiter();
    this.selected = w;
    w.sprite.setTintAll(0xc4ffcb);
    // A tactile little squash-pop: you PICKED something up off the floor.
    this.tweens.add({ targets: w.sprite, scaleY: w.sprite.scaleY * 0.88, duration: 70, yoyo: true });
    this.selectMarker = this.add
      .triangle(0, 0, 0, 0, 16, 0, 8, 11, 0x7ee081)
      .setStrokeStyle(2, 0x0d0f14)
      .setDepth(9600);
    const inst = w.sprite.getData('zombieInst') as ZombieInstance;
    const energy = Math.round(inst.energy);
    EventBus.publish('notify', `Energy ${energy}% — tap a tile to send them, or a stove to cook.`);
    // Tired staff can be splashed with Toxin (the original's instant refill).
    if (inst.energy < 60) this.showRefillChip(inst);
  }

  private showRefillChip(inst: ZombieInstance): void {
    const bg = this.add.rectangle(0, 0, 92, 24, 0x11151d, 0.95).setStrokeStyle(2, PALETTE.toxic);
    const txt = this.add
      .text(0, 0, '⚡ 1 toxin', { fontFamily: 'monospace', fontSize: '12px', color: '#7ee081' })
      .setOrigin(0.5);
    const chip = this.add.container(0, 0, [bg, txt]).setDepth(9700);
    bg.setData('uiBlock', true);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerup', () => {
      if (Economy.spendToxin(1)) {
        inst.energy = 100;
        EventBus.publish('notify', 'Toxin surge — energy restored!');
      } else {
        EventBus.publish('notify', 'No Toxin left.');
      }
      chip.destroy();
      this.refillChip = null;
    });
    this.refillChip = chip;
  }

  private deselectWaiter(): void {
    this.selected?.sprite.clearTintAll();
    this.selected = null;
    this.selectMarker?.destroy();
    this.selectMarker = null;
    this.refillChip?.destroy();
    this.refillChip = null;
  }

  private commandToTile(ptr: Phaser.Input.Pointer): void {
    const w = this.selected;
    if (!w) return;
    const t = this.view.pointerTile(ptr);
    if (!this.grid.walkable(t)) {
      EventBus.publish('notify', 'They can’t stand there.');
      return; // keep the selection — let the player retry
    }
    this.releaseWaiter(w);
    if (w.walker.requestMove(t).status === 'ok') {
      w.sprite.setData('onTick', (events: ReturnType<CharacterActor['tick']>) => {
        for (const e of events) {
          if (e.type === 'blocked') EventBus.publish('notify', 'Your zombie got walled in — tap them to re-task.');
        }
      });
    } else {
      EventBus.publish('notify', 'No path — they refuse to walk through walls.');
    }
    this.deselectWaiter();
  }

  private enterMoveMode(id: PlacementId): void {
    const p = this.grid.placements().get(id);
    if (!p) return;
    const item = itemCatalog(p.itemId);
    if (!item) return;
    const src = this.view.furnitureSprite(id);
    if (!src) return;
    src.setAlpha(0.35);
    const ghost = this.add.image(src.x, src.y, src.texture.key).setOrigin(0.5, 1).setAlpha(0.8).setDepth(9500);
    this.moveSession = { id, item, rot: p.rot, ghost };
    this.updateGhost(this.input.activePointer);
    EventBus.publish('notify', 'Moving — tap a tile to set it down.');
  }

  private updateGhost(ptr: Phaser.Input.Pointer): void {
    const ses = this.moveSession;
    if (!ses) return;
    const t = this.view.pointerTile(ptr);
    const fw = ses.rot === 1 ? ses.item.h : ses.item.w;
    const fh = ses.rot === 1 ? ses.item.w : ses.item.h;
    this.view.layoutSprite(ses.ghost, ses.item.kind, fw, fh, t);
    const ok = this.grid.canPlace(ses.item, t, ses.rot, ses.id).ok;
    ses.ghost.setTint(ok ? 0x8dff9a : 0xff7a6a);
    ses.ghost.setData('anchor', t);
    ses.ghost.setData('ok', ok);
  }

  private tryDrop(ptr: Phaser.Input.Pointer): void {
    const ses = this.moveSession;
    if (!ses) return;
    this.updateGhost(ptr);
    const anchor = ses.ghost.getData('anchor');
    if (ses.ghost.getData('ok') && this.grid.moveItem(ses.id, anchor, ses.rot)) {
      this.exitMoveMode();
    } else {
      this.tweens.add({ targets: ses.ghost, x: ses.ghost.x + 5, duration: 45, yoyo: true, repeat: 3 });
    }
  }

  private exitMoveMode(): void {
    const ses = this.moveSession;
    if (!ses) return;
    this.view.furnitureSprite(ses.id)?.setAlpha(1);
    ses.ghost.destroy();
    this.moveSession = null;
  }

  // ── street life (render-only pedestrians on the sidewalk) ───────────────────

  private spawnPedestrian(): void {
    if (this.peds.length >= 3) return;
    const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
    // Ground truth: the street is BEHIND the cafe; pedestrians pass back there,
    // glimpsed beyond the wall tops and at the corners.
    const fy = -0.7 - Math.random() * 0.35;
    const fx = dir === 1 ? -4.5 : this.grid.w + 4;
    const body = new PuppetBody(this, 'customer', 104);
    const tints = [0xd9c9a8, 0xc9b8d0, 0xa8c9d9, 0xd9b8a8, 0xb8d9b0];
    body.setTintAll(tints[Math.floor(Math.random() * tints.length)]);
    body.setFlipX(dir === 1); // art faces left; +fx walks screen-right
    const shadow = this.add.ellipse(0, 0, 30, 9, 0x000000, 0.22);
    this.peds.push({ body, shadow, fx, fy, dir, speed: 0.9 + Math.random() * 0.7, phase: Math.random() * 6 });
  }

  private updatePedestrians(dt: number): void {
    this.pedTimer -= dt * 1000;
    if (this.pedTimer <= 0) {
      this.spawnPedestrian();
      this.pedTimer = Phaser.Math.Between(3500, 9000);
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      p.fx += p.dir * p.speed * dt;
      p.phase += dt * 7 * p.speed;
      const w = this.view.worldOf(p.fx, p.fy);
      p.body.setPosition(w.x, w.y + 18);
      p.body.tickPose(dt, true, p.phase);
      // Behind the back walls: render beneath the wall band, above the street.
      p.body.setDepth(800);
      const k = Math.max(0.55, 1 - p.body.lift / 26);
      p.shadow.setPosition(w.x, w.y + 17).setScale(k).setAlpha(0.22 * k).setDepth(799);
      if ((p.dir === 1 && p.fx > this.grid.w + 4.5) || (p.dir === -1 && p.fx < -5)) {
        p.body.destroy();
        p.shadow.destroy();
        this.peds.splice(i, 1);
      }
    }
  }

  /**
   * Render-only body separation: two puppets on the same spot ghost through
   * each other like paper. Nudge overlapping sprites apart AFTER their logic
   * positions are synced — walkers and pathing never see this.
   */
  private separateBodies(): void {
    const actors: CharacterActor[] = [...this.waiters];
    for (const c of this.customers) {
      if (c.phase === 'entering' || c.phase === 'leaving') actors.push(c);
    }
    for (let i = 0; i < actors.length; i++) {
      for (let j = i + 1; j < actors.length; j++) {
        const a = actors[i].sprite;
        const b = actors[j].sprite;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) < 26 && Math.abs(dy) < 14) {
          const push = ((26 - Math.abs(dx)) / 2) * 0.5;
          const dir = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          actors[i].nudgeRender(-dir * push);
          actors[j].nudgeRender(dir * push);
        }
      }
    }
  }

  // ── energy (researched: work tires zombies; tired zombies daydream) ─────────

  private tickEnergy(dt: number): void {
    for (const stove of this.stoves) {
      if (stove.state === 'cooking' && stove.zombie) {
        stove.zombie.energy = Math.max(0, stove.zombie.energy - DRAIN_COOK * dt);
      }
    }
    for (const [w] of this.jobs) {
      const inst = w.sprite.getData('zombieInst') as ZombieInstance | undefined;
      if (inst) inst.energy = Math.max(0, inst.energy - DRAIN_JOB * dt);
    }
    for (const [inst, w] of this.waiterActors) {
      if (inst.assignment === 'idle' && !this.jobs.has(w) && w.walker.state === 'idle') {
        inst.energy = Math.min(100, inst.energy + REGEN_IDLE * dt);
      }
      w.setTiredBadge(inst.energy < TIRED_AT);
    }
  }

  // ── loop ───────────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, MAX_TICK_SEC);

    // The selection arrow bobs above the chosen zombie wherever they shamble.
    if (this.selected && this.selectMarker) {
      const s = this.selected.sprite;
      this.selectMarker.setPosition(s.x - 8, s.y - s.displayHeight - 30 + Math.sin(_time / 170) * 3.5);
      this.refillChip?.setPosition(s.x, s.y - s.displayHeight - 56);
    }

    for (const stove of this.stoves) stove.update(dt);
    this.updatePedestrians(dt);
    for (const c of this.customers) c.update(dt);
    for (const w of this.waiters) {
      const events = w.tick(dt);
      const cb = w.sprite.getData('onTick') as ((e: typeof events) => void) | undefined;
      if (events.length > 0 && cb) cb(events);
      // Carried pots/plates ride in the tray hand.
      const job = this.jobs.get(w);
      if (job?.visual) {
        job.visual.setPosition(w.sprite.x + 16, w.sprite.y - w.sprite.displayHeight * 0.55);
        job.visual.setDepth(w.sprite.depth + 1);
      }
    }
    this.tickEnergy(dt);
    this.separateBodies();

    this.jobScanTimer -= deltaMs;
    if (this.jobScanTimer <= 0) {
      this.scanJobs();
      this.jobScanTimer = 700;
    }

    this.spawnTimer -= deltaMs;
    if (this.spawnTimer <= 0) {
      this.spawnCustomer();
      // Star rating drives traffic (researched): 1★ ≈ every 26s, 5★ ≈ every 9s.
      const base = 26000 - ((Save.data.rating - 1) / 4) * 17000;
      this.spawnTimer = base * Phaser.Math.FloatBetween(0.8, 1.25);
    }

    this.saveTimer -= deltaMs;
    if (this.saveTimer <= 0) {
      Save.save();
      this.saveTimer = 5000;
    }
  }
}
