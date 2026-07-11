import Phaser from 'phaser';
import { PALETTE } from '../../config';
import { Economy } from '../../core/Economy';
import { EventBus } from '../../core/EventBus';
import { randomCommonZombie } from '../../data/content';
import type { Zombie } from '../../data/types';
import { CUSTOMER_SPEED, type Seat } from '../../engine/contracts';
import type { RoomView } from '../../view/RoomView';
import { CharacterActor } from './CharacterActor';

type Phase = 'entering' | 'eating' | 'converting' | 'leaving' | 'done';

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
  // Walk-in from the sidewalk (render-only intro; the walker waits at the door)
  private introT = 0.7;
  private static readonly INTRO = 0.7;

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
    // Sidewalk walk-in: the sprite strolls from the street to the door before
    // the grid walk begins — nobody materializes out of thin air.
    if (this.introT > 0) {
      this.introT = Math.max(0, this.introT - dtSec);
      const t = 1 - this.introT / CustomerActor.INTRO;
      const door = this.view.grid.door();
      const from = this.view.worldOf(door.tx, door.ty + 1.35); // on the sidewalk
      const to = this.view.worldOf(door.tx, door.ty);
      this.sprite.setPosition(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t + 18 - Math.abs(Math.sin(t * 9)) * 3,
      );
      this.sprite.setAlpha(Math.min(1, t * 3 + 0.3));
      return;
    }
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
    this.eatTimer = 7 + Math.random() * 2; // ~8s, canon FSM shape
    const p = this.view.worldOf(this.seat.tile.tx, this.seat.tile.ty);
    this.plate = this.view.scene.add
      .circle(p.x + 14, p.y - 26, 7, PALETTE.toxic)
      .setStrokeStyle(2, 0x0d0f14)
      .setDepth(this.sprite.depth + 1);
  }

  private finishEating(): void {
    // One-shot: leave 'eating' SYNCHRONOUSLY so this can never re-fire while
    // the infect tween runs (review blocker: duplicate payouts + zombies).
    this.phase = 'converting';
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
        this.setCharTexture('zombie_waiter');
        this.sprite.setTint(0x9fe8a0);
        const z = randomCommonZombie();
        EventBus.publish('customer-infected', z.displayName);
        EventBus.publish('notify', `${z.displayName} joined your staff!`);
        this.onConverted(z);
      },
      onComplete: () => {
        this.phase = 'leaving';
        this.leave();
      },
    });
  }

  private leave(): void {
    this.phase = 'leaving';
    const res = this.walker.requestMove(this.view.grid.door());
    // Trapped, or already standing on the door tile (requestMove returns ok
    // and goes idle WITHOUT an 'arrived' event) — finish now, don't deadlock.
    if (res.status !== 'ok' || this.walker.state === 'idle') this.finish();
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.plate?.destroy();
    this.onDone(this);
    this.destroy();
  }
}
