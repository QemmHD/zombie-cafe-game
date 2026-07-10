import Phaser from 'phaser';
import { PALETTE } from '../config';
import { Economy } from '../core/Economy';
import { EventBus } from '../core/EventBus';
import { randomCommonZombie } from '../data/content';
import type { Zombie } from '../data/types';

// A human customer: walks in, sits, eats, tips coins, and — if the kitchen's
// toxin is strong enough — collapses and rises again as a new zombie recruit.
export class Customer {
  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Container;
  private eatMs = 2600;
  private tip: number;
  private infectionChance: number;
  private onConverted: (z: Zombie) => void;

  constructor(
    scene: Phaser.Scene,
    door: { x: number; y: number },
    table: { x: number; y: number },
    tip: number,
    infectionChance: number,
    onConverted: (z: Zombie) => void,
  ) {
    this.scene = scene;
    this.tip = tip;
    this.infectionChance = infectionChance;
    this.onConverted = onConverted;

    this.body = this.makeChar(door.x, door.y, PALETTE.customer);
    scene.tweens.add({
      targets: this.body,
      x: table.x,
      y: table.y,
      duration: 900,
      ease: 'Sine.easeInOut',
      onComplete: () => this.eat(table, door),
    });
  }

  private makeChar(x: number, y: number, color: number): Phaser.GameObjects.Container {
    const s = this.scene;
    const c = s.add.container(x, y);
    const shadow = s.add.ellipse(0, 16, 26, 8, 0x000000, 0.3);
    const torso = s.add.ellipse(0, 0, 24, 34, color);
    const eyeL = s.add.circle(-5, -4, 2.5, 0x141821);
    const eyeR = s.add.circle(5, -4, 2.5, 0x141821);
    c.add([shadow, torso, eyeL, eyeR]);
    c.setDepth(y);
    return c;
  }

  private eat(table: { x: number; y: number }, door: { x: number; y: number }): void {
    const plate = this.scene.add.circle(table.x, table.y - 2, 6, PALETTE.toxic).setDepth(9999);
    this.scene.time.delayedCall(this.eatMs, () => {
      plate.destroy();
      Economy.addCoins(this.tip);
      EventBus.publish('customer-served', this.tip);
      if (Math.random() < this.infectionChance) {
        this.infect(door);
      } else {
        this.leave(door);
      }
    });
  }

  private infect(door: { x: number; y: number }): void {
    // Flash toxic green, "die", then a zombie recruit rises.
    const torso = this.body.list[1] as Phaser.GameObjects.Ellipse;
    this.scene.tweens.add({ targets: torso, scaleY: 0.4, duration: 500, yoyo: false, onComplete: () => {
      torso.setFillStyle(PALETTE.toxicDark);
      const z = randomCommonZombie();
      Economy.addBrains(1);
      EventBus.publish('customer-infected', z.displayName);
      EventBus.publish('notify', `${z.displayName} joined your staff! (+1 🧠)`);
      this.onConverted(z);
      this.leave(door);
    }});
  }

  private leave(door: { x: number; y: number }): void {
    this.scene.tweens.add({
      targets: this.body,
      x: door.x,
      y: door.y,
      duration: 800,
      ease: 'Sine.easeIn',
      onComplete: () => this.body.destroy(),
    });
  }
}
