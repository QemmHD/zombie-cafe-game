import Phaser from 'phaser';
import { PALETTE } from '../config';
import { Economy } from '../core/Economy';
import { EventBus } from '../core/EventBus';
import { randomCommonZombie } from '../data/content';
import type { Zombie } from '../data/types';

const CHAR_H = 132; // on-screen height of a person sprite

type Pt = { x: number; y: number };

// A human customer sprite: walks in, sits, eats, tips coins, and — if the
// kitchen's toxin is strong enough — collapses and rises as a zombie recruit
// (the sprite morphs from 'customer' to 'zombie_waiter').
export class Customer {
  private scene: Phaser.Scene;
  private img: Phaser.GameObjects.Image;
  private eatMs = 2600;
  private tip: number;
  private infectionChance: number;
  private onConverted: (z: Zombie) => void;

  constructor(
    scene: Phaser.Scene,
    door: Pt,
    table: Pt,
    tip: number,
    infectionChance: number,
    onConverted: (z: Zombie) => void,
  ) {
    this.scene = scene;
    this.tip = tip;
    this.infectionChance = infectionChance;
    this.onConverted = onConverted;

    this.img = scene.add.image(door.x, door.y, 'customer').setOrigin(0.5, 1);
    this.img.setScale(CHAR_H / this.img.height).setDepth(door.y);
    this.walkTo(table, () => this.eat(table, door));
  }

  private walkTo(dest: Pt, done: () => void): void {
    this.img.setFlipX(dest.x < this.img.x);
    this.scene.tweens.add({
      targets: this.img,
      x: dest.x,
      y: dest.y,
      duration: Phaser.Math.Distance.Between(this.img.x, this.img.y, dest.x, dest.y) * 3.2,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.img.setDepth(this.img.y),
      onComplete: done,
    });
  }

  private eat(table: Pt, door: Pt): void {
    const plate = this.scene.add
      .circle(table.x + 16, table.y - CHAR_H * 0.45, 7, PALETTE.toxic)
      .setStrokeStyle(2, 0x0d0f14)
      .setDepth(table.y + 1);
    this.scene.time.delayedCall(this.eatMs, () => {
      plate.destroy();
      Economy.addCoins(this.tip);
      EventBus.publish('customer-served', this.tip);
      if (Math.random() < this.infectionChance) this.infect(door);
      else this.walkTo(door, () => this.img.destroy());
    });
  }

  private infect(door: Pt): void {
    // squash, flash toxic, morph into a zombie recruit, then shamble off to work.
    this.scene.tweens.add({
      targets: this.img,
      scaleY: this.img.scaleY * 0.55,
      duration: 460,
      yoyo: true,
      onYoyo: () => {
        this.img.setTexture('zombie_waiter').setScale(CHAR_H / this.img.height);
        this.img.setTint(0x8fdf8f);
        const z = randomCommonZombie();
        Economy.addBrains(1);
        EventBus.publish('customer-infected', z.displayName);
        EventBus.publish('notify', `${z.displayName} joined your staff! (+1 🧠)`);
        this.onConverted(z);
      },
      onComplete: () => {
        this.scene.tweens.add({ targets: this.img, alpha: 0, duration: 250, delay: 200 });
        this.walkTo(door, () => this.img.destroy());
      },
    });
  }
}
