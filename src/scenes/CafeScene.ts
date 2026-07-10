import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEMO_TIME_SCALE } from '../config';
import { Hud } from '../ui/Hud';
import { Stove } from '../game/Stove';
import { Customer } from '../game/Customer';
import { Save } from '../core/SaveManager';
import { EventBus } from '../core/EventBus';
import { dishesForLevel, getZombie } from '../data/content';
import type { Zombie, ZombieInstance } from '../data/types';

type Pt = { x: number; y: number };

const STOVE_XS = [268, 480, 692];
const STOVE_Y = 306;
const TABLES: Pt[] = [
  { x: 205, y: 476 },
  { x: 408, y: 492 },
  { x: 620, y: 478 },
  { x: 812, y: 458 },
];
const DOOR: Pt = { x: 480, y: 596 };

export class CafeScene extends Phaser.Scene {
  private stoves: Stove[] = [];
  private waiters: Phaser.GameObjects.Image[] = [];
  private spawnTimer = 1200;
  private saveTimer = 5000;
  private servedSinceLevel = 0;

  constructor() {
    super('Cafe');
  }

  create(): void {
    this.buildRoom();
    new Hud(this);
    this.buildStoves();
    this.assignStarters();
    this.reportOfflineEarnings();

    EventBus.publish('notify', 'Tap a glowing pot to collect. Serve customers to infect them!');

    this.game.events.on(Phaser.Core.Events.BLUR, () => Save.save());
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') Save.save();
    });
  }

  // ── Room ─────────────────────────────────────────────────────────────────────
  private buildRoom(): void {
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'cafe_bg').setDepth(-1000);
    const scale = Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height);
    bg.setScale(scale);

    for (const t of TABLES) this.drawTable(t.x, t.y);

    this.add.text(DOOR.x, GAME_HEIGHT - 16, '▲ ENTRANCE ▲', {
      fontFamily: 'monospace', fontSize: '11px', color: '#e8ecf2',
    }).setOrigin(0.5).setStroke('#0d0f14', 4).setDepth(5);
  }

  private drawTable(x: number, y: number): void {
    this.add.ellipse(x, y + 4, 88, 24, 0x000000, 0.3).setDepth(y - 3);
    this.add.rectangle(x, y - 12, 14, 40, 0x4a3320).setDepth(y - 2);
    this.add.ellipse(x, y - 34, 74, 32, 0x6b4a2f).setStrokeStyle(3, 0x3a2718).setDepth(y - 1);
    this.add.ellipse(x - 10, y - 40, 22, 10, 0x2a3142).setDepth(y); // plate
  }

  private buildStoves(): void {
    const unlocked = dishesForLevel(Save.data.cafeLevel);
    STOVE_XS.forEach((x, i) => {
      const dish = unlocked[i % unlocked.length];
      const stove = new Stove(this, x, STOVE_Y, dish);
      stove.onRequestStaff = () => this.takeIdleZombie(i);
      this.stoves.push(stove);
    });
  }

  private addWaiter(stoveIndex: number): void {
    const x = STOVE_XS[stoveIndex] - 60;
    const y = STOVE_Y + 12;
    const w = this.add.image(x, y, 'zombie_waiter').setOrigin(0.5, 1);
    w.setScale(112 / w.height).setDepth(y).setFlipX(true);
    this.tweens.add({ targets: w, y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.waiters[stoveIndex] = w;
  }

  private assignStarters(): void {
    const kitchen = Save.data.zombies.filter((z) => z.assignment === 'kitchen');
    this.stoves.forEach((stove, i) => {
      if (kitchen[i]) {
        stove.assign(kitchen[i]);
        this.addWaiter(i);
      }
    });
  }

  private takeIdleZombie(stoveIndex: number): ZombieInstance | null {
    const idle = Save.data.zombies.find((z) => z.assignment === 'idle');
    if (!idle) return null;
    idle.assignment = 'kitchen';
    this.addWaiter(stoveIndex);
    return idle;
  }

  private reportOfflineEarnings(): void {
    const r = Save.lastOffline;
    if (!r) return;
    const mins = Math.floor(r.seconds / 60);
    const label = mins >= 1 ? `${mins} min` : `${r.seconds}s`;
    this.time.delayedCall(500, () =>
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
    const table = TABLES[Phaser.Math.Between(0, TABLES.length - 1)];
    const tip = 12 + Save.data.cafeLevel * 6;
    new Customer(this, DOOR, table, tip, this.kitchenInfectionChance(), (z) => this.onCustomerConverted(z));
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
      this.spawnTimer = Phaser.Math.Between(2600, 4600);
    }

    this.saveTimer -= deltaMs;
    if (this.saveTimer <= 0) {
      Save.save();
      this.saveTimer = 5000;
    }
  }
}
