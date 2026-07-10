import Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Dish, ZombieInstance } from '../data/types';
import { getZombie } from '../data/content';
import { Economy } from '../core/Economy';
import { EventBus } from '../core/EventBus';

type StoveState = 'unstaffed' | 'cooking' | 'ready';

const STOVE_H = 132; // on-screen height of the stove sprite

// A cooking station rendered with the hand-drawn stove sprite. When staffed by a
// kitchen zombie it auto-cooks its dish on a timer, then parks in READY until the
// player taps to collect. Offline accrual is handled by SaveManager.
export class Stove {
  state: StoveState = 'unstaffed';
  dish: Dish;
  zombie: ZombieInstance | null = null;

  private scene: Phaser.Scene;
  private y: number;
  private elapsedGame = 0;
  private cookGame = 0;

  private sprite: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private bubble: Phaser.GameObjects.Container;
  private steam!: Phaser.GameObjects.Ellipse;

  onRequestStaff: (() => ZombieInstance | null) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, dish: Dish) {
    this.scene = scene;
    this.y = y;
    this.dish = dish;

    this.sprite = scene.add.image(x, y, 'stove').setOrigin(0.5, 1);
    this.sprite.setScale(STOVE_H / this.sprite.height);
    this.sprite.setDepth(y);

    const w = this.sprite.displayWidth;
    this.label = scene.add
      .text(x, y + 4, 'tap to staff', { fontFamily: 'monospace', fontSize: '11px', color: '#e8ecf2' })
      .setOrigin(0.5, 0)
      .setDepth(y + 1)
      .setStroke('#0d0f14', 4);

    this.barBg = scene.add.rectangle(x, y - 2, w * 0.7, 7, 0x0d0f14, 0.7).setDepth(y + 1);
    this.barFill = scene.add
      .rectangle(x - (w * 0.7) / 2 + 1, y - 2, 0, 4, PALETTE.toxic)
      .setOrigin(0, 0.5)
      .setDepth(y + 2);

    // toxic steam puff over the pot while cooking
    this.steam = scene.add.ellipse(x, y - STOVE_H + 14, 26, 16, PALETTE.toxic, 0.0).setDepth(y + 1);

    // ready coin bubble
    this.bubble = scene.add.container(x, y - STOVE_H - 8).setDepth(9000);
    const bBg = scene.add.circle(0, 0, 16, PALETTE.coin).setStrokeStyle(2, 0x0d0f14);
    const bTxt = scene.add.text(0, 0, '$', { fontFamily: 'monospace', fontSize: '17px', color: '#141821', fontStyle: 'bold' }).setOrigin(0.5);
    this.bubble.add([bBg, bTxt]).setVisible(false);

    this.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onTap());
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
    this.bubble.setVisible(false);
    this.steam.setAlpha(0.5);
    this.label.setText(this.dish.displayName).setColor('#e8ecf2');
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
    this.scene.tweens.add({
      targets: this.bubble, y: this.y - STOVE_H - 40, alpha: 0, duration: 420,
      onComplete: () => this.bubble.setAlpha(1).setY(this.y - STOVE_H - 8),
    });
    EventBus.publish('dish-collected', this.dish.coinReward);
    this.startCook();
  }

  // dtGame is already scaled to in-game seconds.
  update(dtGame: number): void {
    if (this.state !== 'cooking') return;
    this.elapsedGame += dtGame;
    const p = Phaser.Math.Clamp(this.elapsedGame / this.cookGame, 0, 1);
    this.barFill.width = this.barBg.width * p;
    this.steam.y = this.y - STOVE_H + 14 + Math.sin(this.elapsedGame * 3) * 3;
    if (p >= 1) {
      this.state = 'ready';
      this.barFill.width = this.barBg.width;
      this.steam.setAlpha(0);
      this.label.setText('READY').setColor('#f2c14e');
      this.bubble.setVisible(true);
      this.scene.tweens.add({ targets: this.bubble, y: this.y - STOVE_H - 16, duration: 520, yoyo: true, repeat: -1 });
    }
  }
}
