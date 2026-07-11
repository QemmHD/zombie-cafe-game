import Phaser from 'phaser';
import { PALETTE } from '../../config';
import { Economy } from '../../core/Economy';
import { EventBus } from '../../core/EventBus';
import { randomCommonZombie } from '../../data/content';
import type { Zombie } from '../../data/types';
import { CUSTOMER_SPEED, characterSortKey, entityDepth, type Seat } from '../../engine/contracts';
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
  private mood: Phaser.GameObjects.Container | null = null;
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
      this.showMood('sad');
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
      // From the sidewalk BEHIND the wall, through the doorway, into the room.
      const behind = door.ty === 0 ? { fx: door.tx, fy: -1.1 } : { fx: -1.1, fy: door.ty };
      const from = this.view.worldOf(behind.fx, behind.fy);
      const to = this.view.worldOf(door.tx, door.ty);
      this.sprite.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + 18);
      this.sprite.setFlipX(door.ty !== 0); // through a left-back door they head SE
      this.sprite.tickPose(dtSec, true, t * 9);
      // Behind the wall while outside (glimpsed through the door hole); the
      // moment the feet cross the wall plane, pop into the entity band.
      this.sprite.setDepth(t < 0.55 ? 810 : entityDepth(characterSortKey(door.tx, door.ty), true));
      this.sprite.setAlpha(Math.min(1, t * 3 + 0.3));
      this.followMood();
      return;
    }
    switch (this.phase) {
      case 'entering': {
        for (const e of this.tick(dtSec)) {
          if (e.type === 'arrived') this.startEating();
          if (e.type === 'blocked') {
            this.showMood('sad');
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
    this.followMood();
  }

  /** The thought bubble rides above the head through every phase. */
  private followMood(): void {
    if (this.mood) {
      this.mood.setPosition(this.sprite.x + 16, this.headY() - 10);
      this.mood.setDepth(this.sprite.depth + 2);
    }
  }

  private headY(): number {
    return this.sprite.y - this.sprite.displayHeight;
  }

  /**
   * Ground truth (spec 92 §7): customers telegraph mood with happy-yellow /
   * frowning-blue thought bubbles — the original's core readability device.
   */
  private showMood(kind: 'happy' | 'sad'): void {
    this.mood?.destroy();
    const scene = this.view.scene;
    const fill = kind === 'happy' ? 0xf7d154 : 0x7fa8d9;
    const g = scene.add.graphics();
    g.fillStyle(fill, 1);
    g.lineStyle(2, 0x0d0f14, 1);
    g.fillCircle(0, 0, 13);
    g.strokeCircle(0, 0, 13);
    // thought-tail dot toward the head
    g.fillCircle(-10, 12, 3.5);
    g.strokeCircle(-10, 12, 3.5);
    // face: two eyes + smile or frown
    g.fillStyle(0x0d0f14, 1);
    g.fillCircle(-4.5, -3.5, 1.8);
    g.fillCircle(4.5, -3.5, 1.8);
    g.beginPath();
    if (kind === 'happy') g.arc(0, 1.5, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    else g.arc(0, 10, 6, 1.15 * Math.PI, 1.85 * Math.PI);
    g.strokePath();
    const c = scene.add.container(this.sprite.x + 16, this.headY() - 10, [g]);
    c.setScale(0);
    scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.mood = c;
  }

  /** Coin pop when the bill is paid — money you SEE is money you feel. */
  private coinFloat(amount: number): void {
    const scene = this.view.scene;
    const t = scene.add
      .text(this.sprite.x, this.headY() - 4, `+${amount}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f2c14e',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#0d0f14', 4)
      .setDepth(this.sprite.depth + 3);
    scene.tweens.add({
      targets: t,
      y: t.y - 36,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private startEating(): void {
    this.phase = 'eating';
    this.eatTimer = 7 + Math.random() * 2; // ~8s, canon FSM shape
    this.sprite.setMotion('eat');
    this.showMood('happy');
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
    this.sprite.setMotion('auto');
    this.plate?.destroy();
    this.plate = null;
    this.mood?.destroy();
    this.mood = null;
    Economy.addCoins(this.tip);
    this.coinFloat(this.tip);
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
        this.setCharRig('zombie_waiter');
        this.sprite.setTintAll(0x9fe8a0);
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
    this.mood?.destroy();
    this.onDone(this);
    this.destroy();
  }
}
