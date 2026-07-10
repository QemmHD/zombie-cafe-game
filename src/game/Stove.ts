import Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Dish, ZombieInstance } from '../data/types';
import { getZombie } from '../data/content';
import { Economy } from '../core/Economy';
import { EventBus } from '../core/EventBus';

type StoveState = 'unstaffed' | 'cooking' | 'ready';

// A cooking station. When staffed by a kitchen zombie it auto-cooks its dish on
// a timer, then parks in READY until the player taps to collect (active loop).
// Offline accrual is handled separately by SaveManager.
export class Stove {
  state: StoveState = 'unstaffed';
  dish: Dish;
  zombie: ZombieInstance | null = null;

  private scene: Phaser.Scene;
  private y: number;
  private elapsedGame = 0;
  private cookGame = 0;

  private base: Phaser.GameObjects.Rectangle;
  private pot: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private barFill: Phaser.GameObjects.Rectangle;
  private bubble: Phaser.GameObjects.Container;

  onRequestStaff: (() => ZombieInstance | null) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, dish: Dish) {
    this.scene = scene;
    this.y = y;
    this.dish = dish;

    this.base = scene.add.rectangle(x, y, 74, 54, PALETTE.stove).setStrokeStyle(2, PALETTE.panelEdge);
    this.pot = scene.add.circle(x, y - 4, 16, PALETTE.panel).setStrokeStyle(2, PALETTE.toxicDark);
    this.label = scene.add
      .text(x, y + 34, 'tap to staff', { fontFamily: 'monospace', fontSize: '11px', color: '#8891a4' })
      .setOrigin(0.5);

    scene.add.rectangle(x, y + 20, 60, 6, PALETTE.panel).setStrokeStyle(1, PALETTE.panelEdge);
    this.barFill = scene.add.rectangle(x - 30, y + 20, 0, 4, PALETTE.toxic).setOrigin(0, 0.5);

    // "Ready" coin bubble (hidden until a dish is done).
    this.bubble = scene.add.container(x, y - 44);
    const bBg = scene.add.circle(0, 0, 15, PALETTE.coin);
    const bTxt = scene.add.text(0, 0, '$', { fontFamily: 'monospace', fontSize: '16px', color: '#141821' }).setOrigin(0.5);
    this.bubble.add([bBg, bTxt]).setVisible(false);

    this.base.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onTap());
    this.pot.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onTap());
  }

  assign(zombie: ZombieInstance, dish?: Dish): void {
    this.zombie = zombie;
    if (dish) this.dish = dish;
    zombie.assignment = 'kitchen';
    this.startCook();
  }

  private startCook(): void {
    const z = this.zombie ? getZombie(this.zombie.zombieId) : null;
    const speedMult = z ? z.cookSpeedMult : 1;
    this.cookGame = this.dish.cookTimeSeconds * speedMult;
    this.elapsedGame = 0;
    this.state = 'cooking';
    this.pot.setFillStyle(PALETTE.toxicDark);
    this.bubble.setVisible(false);
    this.label.setText(this.dish.displayName);
  }

  private onTap(): void {
    if (this.state === 'ready') {
      this.collect();
    } else if (this.state === 'unstaffed' && this.onRequestStaff) {
      const z = this.onRequestStaff();
      if (z) this.assign(z);
      else EventBus.publish('notify', 'No idle zombies — infect a customer first!');
    }
  }

  private collect(): void {
    Economy.addCoins(this.dish.coinReward);
    this.scene.tweens.add({ targets: this.bubble, y: this.y - 70, alpha: 0, duration: 400, onComplete: () => {
      this.bubble.setAlpha(1).setY(this.y - 44);
    }});
    EventBus.publish('dish-collected', this.dish.coinReward);
    this.startCook(); // immediately queue the next dish
  }

  // dtGame is already scaled to in-game seconds.
  update(dtGame: number): void {
    if (this.state !== 'cooking') return;
    this.elapsedGame += dtGame;
    const p = Phaser.Math.Clamp(this.elapsedGame / this.cookGame, 0, 1);
    this.barFill.width = 60 * p;
    if (p >= 1) {
      this.state = 'ready';
      this.barFill.width = 60;
      this.pot.setFillStyle(PALETTE.ready);
      this.bubble.setVisible(true);
      this.scene.tweens.add({ targets: this.bubble, y: this.y - 52, duration: 500, yoyo: true, repeat: -1 });
    }
  }
}
