import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { EventBus } from '../core/EventBus';
import { Save } from '../core/SaveManager';
import { itemCatalog } from '../data/catalog';
import { dishesForLevel, getZombie } from '../data/content';
import starterLayoutJson from '../data/starterLayout.json';
import type { Zombie, ZombieInstance } from '../data/types';
import {
  CafeGrid,
  DEFAULT_SPEED_STAT,
  zombieTilesPerSec,
  type LayoutSchema,
  type Seat,
} from '../engine/contracts';
import { CharacterActor } from '../game/actors/CharacterActor';
import { CustomerActor } from '../game/actors/CustomerActor';
import { StoveSim } from '../game/StoveSim';
import { RoomView } from '../view/RoomView';

const MAX_TICK_SEC = 0.25; // clamp render-loop dt; long gaps are offline settlement's job

export class CafeScene extends Phaser.Scene {
  private grid!: CafeGrid;
  private view!: RoomView;
  private stoves: StoveSim[] = [];
  private waiters: CharacterActor[] = [];
  private customers = new Set<CustomerActor>();
  private seatsTaken = new Set<string>(); // seatId = chair placementId
  private spawnTimer = 3000;
  private saveTimer = 5000;
  private servedSinceLevel = 0;
  private seedCounter = 1;

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
    this.buildStoves();
    this.staffStartersFromSave();
    this.reportOfflineEarnings();

    EventBus.publish('notify', 'Tap a stove to staff it. Feed customers to infect them!');

    // Progress comes from SERVING (canon §6: XP per serving), not infection RNG.
    const unsubServe = EventBus.subscribe('customer-served', () => this.maybeLevelUp());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubServe);

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
    bg.setScrollFactor(0).setDepth(-100);
    bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height) / this.cameras.main.zoom || 1);
    // Re-fit after camera zoom is known (fitCamera runs later in create()).
    this.time.delayedCall(0, () => {
      const z = this.cameras.main.zoom;
      bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height) / z);
    });
  }

  private buildStoves(): void {
    const unlocked = dishesForLevel(Save.data.cafeLevel);
    let i = 0;
    for (const p of this.grid.placements().values()) {
      if (p.kind !== 'stove') continue;
      const stove = new StoveSim(this.view, p.id, unlocked[i % unlocked.length]);
      stove.onRequestStaff = () => this.dispatchWaiter(stove);
      this.stoves.push(stove);
      i++;
    }
  }

  /** Kitchen zombies from the save walk in and man the stoves on boot. */
  private staffStartersFromSave(): void {
    const kitchen = Save.data.zombies.filter((z) => z.assignment === 'kitchen');
    kitchen.slice(0, this.stoves.length).forEach((z, i) => this.sendWaiterTo(this.stoves[i], z));
  }

  private dispatchWaiter(stove: StoveSim): boolean {
    const idle = Save.data.zombies.find((z) => z.assignment === 'idle');
    if (!idle) return false;
    return this.sendWaiterTo(stove, idle);
  }

  private sendWaiterTo(stove: StoveSim, zombie: ZombieInstance): boolean {
    const cells = this.grid.interactionCells(stove.placementId);
    if (cells.length === 0) return false;
    // The one stat->speed module; StaffStats (M6) will own stat derivation.
    const speed = zombieTilesPerSec(DEFAULT_SPEED_STAT);
    const w = new CharacterActor(this.view, 'zombie_waiter', this.grid.door(), speed, this.seedCounter++, `waiter_${this.seedCounter}`);
    // Any reachable interaction cell will do — layouts can seal some of them.
    const reached = cells.some((cell) => w.walker.requestMove(cell).status === 'ok');
    if (!reached) {
      w.destroy();
      EventBus.publish('notify', 'That stove is walled off — your zombie refuses.');
      return false;
    }
    zombie.assignment = 'kitchen';
    stove.expectStaff(); // stove stays honest: no double-dispatch window
    w.sprite.setData('stoveId', stove.placementId);
    this.waiters.push(w);
    const onTick = (events: ReturnType<CharacterActor['tick']>) => {
      for (const e of events) {
        if (e.type === 'arrived') stove.staffArrived(zombie);
        if (e.type === 'blocked') {
          // Route died (furniture moved mid-walk): free everyone honestly.
          zombie.assignment = 'idle';
          stove.revertToUnstaffed();
          this.waiters = this.waiters.filter((x) => x !== w);
          w.destroy();
          EventBus.publish('notify', 'Your zombie got walled in and gave up.');
        }
      }
    };
    w.sprite.setData('onTick', onTick);
    return true;
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

  // ── customers ──────────────────────────────────────────────────────────────

  private kitchenInfectionChance(): number {
    let chance = 0;
    for (const inst of Save.data.zombies) {
      if (inst.assignment !== 'kitchen') continue;
      const z = getZombie(inst.zombieId);
      if (z) chance += z.infectionChance;
    }
    return Phaser.Math.Clamp(chance, 0, 0.75);
  }

  private freeSeat(): Seat | null {
    const seats = this.grid.seats().filter((s) => !this.seatsTaken.has(s.chairId));
    return seats.length > 0 ? seats[Phaser.Math.Between(0, seats.length - 1)] : null;
  }

  private spawnCustomer(): void {
    const seat = this.freeSeat();
    if (!seat) return; // full house — seats gate throughput, like the original
    this.seatsTaken.add(seat.chairId);
    const tip = 12 + Save.data.cafeLevel * 6;
    const c = new CustomerActor(
      this.view,
      seat,
      tip,
      this.kitchenInfectionChance(),
      this.seedCounter++,
      (z) => this.onCustomerConverted(z),
      (done) => {
        this.seatsTaken.delete(done.seat.chairId);
        this.customers.delete(done);
      },
    );
    this.customers.add(c);
  }

  private onCustomerConverted(z: Zombie): void {
    Save.data.zombies.push({ zombieId: z.zombieId, level: 1, xp: 0, assignment: 'idle' });
    EventBus.publish('zombie-added', z);
  }

  private maybeLevelUp(): void {
    this.servedSinceLevel++;
    if (this.servedSinceLevel >= 6 && Save.data.cafeLevel < 20) {
      this.servedSinceLevel = 0;
      Save.data.cafeLevel++;
      EventBus.publish('cafe-level-up', Save.data.cafeLevel);
      EventBus.publish('notify', `Cafe reached level ${Save.data.cafeLevel}! New dishes unlocked.`);
      const unlocked = dishesForLevel(Save.data.cafeLevel);
      this.stoves.forEach((s, i) => (s.dish = unlocked[Math.min(i, unlocked.length - 1)] ?? s.dish));
    }
  }

  // ── loop ───────────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, MAX_TICK_SEC);

    for (const stove of this.stoves) stove.update(dt);
    for (const c of this.customers) c.update(dt);
    for (const w of this.waiters) {
      const events = w.tick(dt);
      const cb = w.sprite.getData('onTick') as ((e: typeof events) => void) | undefined;
      if (events.length > 0 && cb) cb(events);
    }

    this.spawnTimer -= deltaMs;
    if (this.spawnTimer <= 0) {
      this.spawnCustomer();
      this.spawnTimer = Phaser.Math.Between(12000, 20000); // canon-shaped pacing
    }

    this.saveTimer -= deltaMs;
    if (this.saveTimer <= 0) {
      Save.save();
      this.saveTimer = 5000;
    }
  }
}
