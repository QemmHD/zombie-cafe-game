import Phaser from 'phaser';
import { PALETTE } from '../../config';
import { Economy } from '../../core/Economy';
import { EventBus } from '../../core/EventBus';
import { randomCommonZombie } from '../../data/content';
import type { Zombie } from '../../data/types';
import { CUSTOMER_SPEED, type Seat } from '../../engine/contracts';
import type { RoomView } from '../../view/RoomView';
import { CharacterActor } from './CharacterActor';

type Phase = 'entering' | 'eating' | 'leaving' | 'done';

/**
 * A human customer: walks the grid from the door to a real seat (A* — routes
 * around furniture, exactly what the painted-backdrop version could not do),
 * eats, pays, maybe gets infected, and shambles home.
 */
export class CustomerActor extends CharacterActor {
  phase: Phase = 'entering';
  readonly seat: Seat;

  private tip: number;
  private infectionChance: number;
  private onConverted: (z: Zombie) => void;
  private onDone: (c: CustomerActor) => void;
  private plate: Phaser.GameObjects.Arc | null = null;
  private eatTimer = 0;

  constructor(
    view: RoomView,
    seat: Seat,
    tip: number,
    infectionChance: number,
    seed: number,
    onConverted: (z: Zombie) => void,
    onDone: (c: CustomerActor) => void,
  ) {
    super(view, 'customer', view.grid.door(), CUSTOMER_SPEED, seed, `cust_${seed}`);
    this.seat = seat;
    this.tip = tip;
    this.infectionChance = infectionChance;
    this.onConverted = onConverted;
    this.onDone = onDone;

    const res = this.walker.requestMove(seat.tile, { allowNonWalkableGoal: true });
    if (res.status !== 'ok') {
      // Seat unreachable (player walled it off — authentic!). Turn around.
      this.phase = 'leaving';
      this.leave();
    }
  }

  update(dtSec: number): void {
    switch (this.phase) {
      case 'entering': {
        for (const e of this.tick(dtSec)) {
          if (e.type === 'arrived') this.startEating();
          if (e.type === 'blocked') {
            this.phase = 'leaving';
            this.leave();
          }
        }
        break;
      }
      case 'eating': {
        this.eatTimer -= dtSec;
        if (this.eatTimer <= 0) this.finishEating();
        break;
      }
      case 'leaving': {
        for (const e of this.tick(dtSec)) {
          if (e.type === 'arrived' || e.type === 'blocked') this.finish();
        }
        break;
      }
    }
  }

  private startEating(): void {
    this.phase = 'eating';
    this.eatTimer = 2.4 + Math.random() * 1.2;
    const p = this.view.worldOf(this.seat.tile.tx, this.seat.tile.ty);
    this.plate = this.view.scene.add
      .circle(p.x + 14, p.y - 26, 7, PALETTE.toxic)
      .setStrokeStyle(2, 0x0d0f14)
      .setDepth(this.sprite.depth + 1);
  }

  private finishEating(): void {
    this.plate?.destroy();
    this.plate = null;
    Economy.addCoins(this.tip);
    EventBus.publish('customer-served', this.tip);
    if (Math.random() < this.infectionChance) this.infect();
    else {
      this.phase = 'leaving';
      this.leave();
    }
  }

  private infect(): void {
    const scene = this.view.scene;
    scene.tweens.add({
      targets: this.sprite,
      scaleY: this.sprite.scaleY * 0.5,
      duration: 420,
      yoyo: true,
      onYoyo: () => {
        this.sprite.setTexture('zombie_waiter');
        this.sprite.setScale(118 / this.sprite.height);
        this.sprite.setTint(0x9fe8a0);
        const z = randomCommonZombie();
        Economy.addBrains(1);
        EventBus.publish('customer-infected', z.displayName);
        EventBus.publish('notify', `${z.displayName} joined your staff! (+1 🧠)`);
        this.onConverted(z);
      },
      onComplete: () => {
        this.phase = 'leaving';
        this.leave();
      },
    });
  }

  private leave(): void {
    const res = this.walker.requestMove(this.view.grid.door());
    if (res.status !== 'ok') this.finish(); // trapped: vanish gracefully rather than haunt
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.plate?.destroy();
    this.onDone(this);
    this.destroy();
  }
}
