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
  TAP_VS_PAN_PX,
  zombieTilesPerSec,
  type FootprintItem,
  type LayoutSchema,
  type PlacementId,
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
  private stovesById = new Map<PlacementId, StoveSim>();
  // Edit mode: hold a furniture piece to lift it, tap a tile to set it down.
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private moveSession: { id: PlacementId; item: FootprintItem; rot: 0 | 1; ghost: Phaser.GameObjects.Image } | null = null;
  // Street life: render-only pedestrians passing on the sidewalk.
  private peds: { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; fx: number; fy: number; dir: 1 | -1; speed: number; phase: number }[] = [];
  private pedTimer = 2500;
  private panStart: { x: number; y: number; sx: number; sy: number } | null = null;

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
    this.setupEditMode();
    this.grid.events.on('moved', ({ placement }) => {
      const stove = this.stovesById.get(placement.id);
      stove?.reposition();
    });
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

  private buildStoves(): void {
    const unlocked = dishesForLevel(Save.data.cafeLevel);
    let i = 0;
    for (const p of this.grid.placements().values()) {
      if (p.kind !== 'stove') continue;
      const stove = new StoveSim(this.view, p.id, unlocked[i % unlocked.length]);
      stove.onRequestStaff = () => this.dispatchWaiter(stove);
      this.stoves.push(stove);
      this.stovesById.set(p.id, stove);
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

  // ── edit mode (hold to lift, tap to place — the original's rearrange-anytime) ──

  private setupEditMode(): void {
    this.input.on('gameobjectdown', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const id = obj.getData('placementId') as PlacementId | undefined;
      if (!id || this.moveSession) return;
      this.holdTimer?.remove();
      this.holdTimer = this.time.delayedCall(350, () => this.enterMoveMode(id));
    });
    this.input.on('gameobjectup', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const id = obj.getData('placementId') as PlacementId | undefined;
      if (!id) return;
      if (this.holdTimer && this.holdTimer.getProgress() < 1) {
        // Short press = interact (stove tap). Long press already lifted it;
        // a drag past the pan threshold is neither.
        this.holdTimer.remove();
        this.holdTimer = null;
        if (!this.moveSession && _ptr.getDistance() <= TAP_VS_PAN_PX) {
          this.stovesById.get(id)?.tap();
        }
      }
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
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.moveSession) {
        if (!over.some((o) => o.getData('placementId') === this.moveSession?.id)) this.tryDrop(ptr);
        return;
      }
      const cam = this.cameras.main;
      this.panStart = { x: ptr.x, y: ptr.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on('pointerup', () => {
      this.panStart = null;
    });
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
    const img = this.add.image(0, 0, 'customer').setOrigin(0.5, 0.96);
    img.setScale(104 / img.height);
    const tints = [0xd9c9a8, 0xc9b8d0, 0xa8c9d9, 0xd9b8a8, 0xb8d9b0];
    img.setTint(tints[Math.floor(Math.random() * tints.length)]);
    img.setFlipX(dir === -1);
    const shadow = this.add.ellipse(0, 0, 38, 12, 0x000000, 0.28);
    this.peds.push({ img, shadow, fx, fy, dir, speed: 0.9 + Math.random() * 0.7, phase: Math.random() * 6 });
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
      const bob = Math.abs(Math.sin(p.phase)) * 3;
      p.img.setPosition(w.x, w.y + 18 - bob);
      p.img.setRotation(Math.sin(p.phase / 2) * 0.04);
      p.shadow.setPosition(w.x, w.y + 16);
      // Behind the back walls: render beneath the wall band, above the street.
      p.img.setDepth(800);
      p.shadow.setDepth(799);
      if ((p.dir === 1 && p.fx > this.grid.w + 4.5) || (p.dir === -1 && p.fx < -5)) {
        p.img.destroy();
        p.shadow.destroy();
        this.peds.splice(i, 1);
      }
    }
  }

  // ── loop ───────────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, MAX_TICK_SEC);

    for (const stove of this.stoves) stove.update(dt);
    this.updatePedestrians(dt);
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
