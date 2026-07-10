import Phaser from 'phaser';
import { PALETTE, GAME_WIDTH, GAME_HEIGHT, DEMO_TIME_SCALE } from '../config';
import { Hud } from '../ui/Hud';
import { Stove } from '../game/Stove';
import { Customer } from '../game/Customer';
import { Save } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { dishesForLevel, getZombie } from '../data/content';
import type { Zombie, ZombieInstance } from '../data/types';

const SEAT_Y = 380;
const COUNTER_Y = 130;

export class CafeScene extends Phaser.Scene {
  private stoves: Stove[] = [];
  private tables: { x: number; y: number }[] = [];
  private door = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 24 };
  private spawnTimer = 1200;
  private saveTimer = 5000;
  private servedSinceLevel = 0;

  constructor() {
    super('Cafe');
  }

  create(): void {
    this.buildEnvironment();
    new Hud(this);
    this.buildStoves();
    this.assignStarters();
    this.reportOfflineEarnings();

    EventBus.publish('notify', 'Tap a glowing pot to collect. Serve customers to infect them!');

    // Persist on tab hide / close so idle accrual is accurate.
    this.game.events.on(Phaser.Core.Events.BLUR, () => Save.save());
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') Save.save();
    });
  }

  // ── Environment ────────────────────────────────────────────────────────────
  private buildEnvironment(): void {
    const g = this.add.graphics();
    // floor
    g.fillStyle(PALETTE.bgFloor, 1).fillRect(0, 52, GAME_WIDTH, GAME_HEIGHT - 52);
    // checker tiles
    const tile = 48;
    for (let y = 52; y < GAME_HEIGHT; y += tile) {
      for (let x = 0; x < GAME_WIDTH; x += tile) {
        const alt = ((x / tile) + Math.floor((y - 52) / tile)) % 2 === 0;
        g.fillStyle(alt ? PALETTE.floorTile : PALETTE.floorTileAlt, 1).fillRect(x, y, tile, tile);
      }
    }
    // back counter
    g.fillStyle(PALETTE.wall, 1).fillRect(0, 52, GAME_WIDTH, 108);
    g.fillStyle(PALETTE.panelEdge, 1).fillRect(0, 158, GAME_WIDTH, 4);

    // door marker
    this.add.rectangle(this.door.x, GAME_HEIGHT - 8, 90, 14, PALETTE.blood, 0.85);
    this.add.text(this.door.x, GAME_HEIGHT - 26, 'ENTRANCE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8891a4',
    }).setOrigin(0.5);

    // tables (seating)
    const cols = [180, 400, 620, 820];
    this.tables = cols.map((x) => ({ x, y: SEAT_Y }));
    for (const t of this.tables) {
      this.add.ellipse(t.x, t.y + 20, 70, 20, 0x000000, 0.25);
      this.add.circle(t.x, t.y, 26, PALETTE.panel).setStrokeStyle(2, PALETTE.panelEdge);
      this.add.circle(t.x, t.y, 16, PALETTE.floorTileAlt);
    }
  }

  private buildStoves(): void {
    const unlocked = dishesForLevel(Save.data.cafeLevel);
    const positions = [200, 480, 760];
    positions.forEach((x, i) => {
      const dish = unlocked[i % unlocked.length];
      const stove = new Stove(this, x, COUNTER_Y, dish);
      stove.onRequestStaff = () => this.takeIdleZombie();
      this.stoves.push(stove);
    });
  }

  // Wire the saved kitchen roster onto stoves; leftovers stay idle.
  private assignStarters(): void {
    const kitchen = Save.data.zombies.filter((z) => z.assignment === 'kitchen');
    this.stoves.forEach((stove, i) => {
      if (kitchen[i]) stove.assign(kitchen[i]);
    });
  }

  private takeIdleZombie(): ZombieInstance | null {
    const idle = Save.data.zombies.find((z) => z.assignment === 'idle');
    if (!idle) return null;
    idle.assignment = 'kitchen';
    return idle;
  }

  private reportOfflineEarnings(): void {
    const r = Save.lastOffline;
    if (!r) return;
    const mins = Math.floor(r.seconds / 60);
    const label = mins >= 1 ? `${mins} min` : `${r.seconds}s`;
    this.time.delayedCall(400, () =>
      EventBus.publish('notify', `Welcome back! Your zombies cooked ${r.coins} coins in ${label}. 🧟`),
    );
  }

  // ── Customers ───────────────────────────────────────────────────────────────
  private kitchenInfectionChance(): number {
    let chance = 0;
    for (const inst of Save.data.zombies) {
      if (inst.assignment !== 'kitchen') continue;
      const z = getZombie(inst.zombieId);
      if (z) chance += z.infectionChance;
    }
    return Phaser.Math.Clamp(chance, 0, 0.75);
  }

  private spawnCustomer(): void {
    const table = this.tables[Phaser.Math.Between(0, this.tables.length - 1)];
    const tip = 12 + Save.data.cafeLevel * 6;
    new Customer(
      this,
      { x: this.door.x, y: this.door.y },
      table,
      tip,
      this.kitchenInfectionChance(),
      (z: Zombie) => this.onCustomerConverted(z),
    );
  }

  private onCustomerConverted(z: Zombie): void {
    Save.data.zombies.push({ zombieId: z.zombieId, level: 1, xp: 0, assignment: 'idle' });
    EventBus.publish('zombie-added', z);
    this.maybeLevelUp();
  }

  private maybeLevelUp(): void {
    this.servedSinceLevel++;
    if (this.servedSinceLevel >= 6 && Save.data.cafeLevel < 20) {
      this.servedSinceLevel = 0;
      Save.data.cafeLevel++;
      EventBus.publish('cafe-level-up', Save.data.cafeLevel);
      EventBus.publish('notify', `Cafe reached level ${Save.data.cafeLevel}! New dishes unlocked.`);
      // Re-pick stove dishes for the new level.
      const unlocked = dishesForLevel(Save.data.cafeLevel);
      this.stoves.forEach((s, i) => (s.dish = unlocked[Math.min(i, unlocked.length - 1)] ?? s.dish));
    }
  }

  // ── Loop ─────────────────────────────────────────────────────────────────────
  update(_time: number, deltaMs: number): void {
    const dtGame = (deltaMs / 1000) * DEMO_TIME_SCALE;
    for (const stove of this.stoves) stove.update(dtGame);

    this.spawnTimer -= deltaMs;
    if (this.spawnTimer <= 0) {
      this.spawnCustomer();
      this.spawnTimer = Phaser.Math.Between(2600, 4800);
    }

    this.saveTimer -= deltaMs;
    if (this.saveTimer <= 0) {
      Save.save();
      this.saveTimer = 5000;
    }
  }
}
