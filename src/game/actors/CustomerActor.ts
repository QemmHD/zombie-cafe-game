import Phaser from 'phaser';
import { PALETTE } from '../../config';
import { Economy } from '../../core/Economy';
import { EventBus } from '../../core/EventBus';
import { randomCommonZombie } from '../../data/content';
import type { Dish, Zombie } from '../../data/types';
import { CUSTOMER_SPEED, characterSortKey, entityDepth, perServingXP, type Seat } from '../../engine/contracts';
import type { RoomView } from '../../view/RoomView';
import { CharacterActor } from './CharacterActor';
import { pickCustomerRig } from './PuppetBody';

type Phase = 'entering' | 'waiting' | 'eating' | 'converting' | 'leaving' | 'done';

/** Seconds a seated customer waits for food before storming out (UNKNOWN in
 * sources; tuned so one stocked counter comfortably feeds the room). */
const PATIENCE_SEC = 50;

/**
 * A human customer, authentic flow (researched): walks in the back door to a
 * free seat, WAITS to be served from a stocked serving counter, eats, pays
 * per serving, leaves a dirty plate. Leaves angry (rating hit) if nobody
 * serves them. Infection is the PLAYER's verb — tap them, spend Toxin.
 */
export class CustomerActor extends CharacterActor {
  phase: Phase = 'entering';
  readonly seat: Seat;
  /** A serve job has claimed this customer (prevents double-delivery). */
  claimed = false;
  servedDish: Dish | null = null;

  private onConverted: (z: Zombie) => void;
  private onDone: (c: CustomerActor) => void;
  private onAte: (c: CustomerActor) => void;
  private plate: Phaser.GameObjects.Arc | null = null;
  private mood: Phaser.GameObjects.Container | null = null;
  private eatTimer = 0;
  private patience = PATIENCE_SEC;
  private waitedSec = 0; // slow service kills the tip (researched: ~30s cutoff)
  // Walk-in from the sidewalk (render-only intro; the walker waits at the door)
  private introT = 0.7;
  private static readonly INTRO = 0.7;

  constructor(
    view: RoomView,
    seat: Seat,
    seed: number,
    onConverted: (z: Zombie) => void,
    onAte: (c: CustomerActor) => void,
    onDone: (c: CustomerActor) => void,
  ) {
    super(view, pickCustomerRig(seed), view.grid.door(), CUSTOMER_SPEED, seed, `cust_${seed}`);
    this.seat = seat;
    this.onConverted = onConverted;
    this.onAte = onAte;
    this.onDone = onDone;
    this.sprite.setData('customerRef', this);
    this.sprite.enableTap();

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
      this.sprite.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + 15);
      this.sprite.setFlipX(door.ty !== 0); // through a left-back door they head SE
      this.sprite.tickPose(dtSec, true, t * 9);
      // Behind the wall while outside (glimpsed through the door hole); the
      // moment the feet cross the wall plane, pop into the entity band.
      this.sprite.setDepth(t < 0.55 ? 810 : entityDepth(characterSortKey(door.tx, door.ty), true));
      this.sprite.setAlpha(Math.min(1, t * 3 + 0.3));
      this.shadow.setPosition(this.sprite.x, this.sprite.y - 1);
      this.shadow.setAlpha(0.18 * this.sprite.alpha);
      this.shadow.setDepth(this.sprite.depth - 1);
      this.followMood();
      return;
    }
    switch (this.phase) {
      case 'entering': {
        for (const e of this.tick(dtSec)) {
          if (e.type === 'arrived') this.startWaiting();
          if (e.type === 'blocked') {
            this.showMood('sad');
            this.phase = 'leaving';
            this.leave();
          }
        }
        break;
      }
      case 'waiting': {
        this.tick(dtSec); // keep idle pose/facing alive
        this.patience -= dtSec;
        this.waitedSec += dtSec;
        if (this.patience <= 0) this.stormOut();
        break;
      }
      case 'eating': {
        this.tick(dtSec);
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

  private startWaiting(): void {
    this.phase = 'waiting';
    this.patience = PATIENCE_SEC;
    // Actually SIT: pelvis to the chair, legs forward, facing the table.
    this.sprite.setMotion('sit');
    this.faceOverride = this.seat.facing === 'NE' || this.seat.facing === 'SE' ? 'right' : 'left';
    this.showMood('hungry');
  }

  /** A waiter delivers a plate from the serving counter. */
  serve(dish: Dish): void {
    if (this.phase !== 'waiting') return;
    this.phase = 'eating';
    this.servedDish = dish;
    this.eatTimer = 7 + Math.random() * 2; // ~8s, canon FSM shape
    this.sprite.setMotion('eat');
    this.showMood('happy');
    const p = this.view.worldOf(this.seat.tile.tx, this.seat.tile.ty);
    this.plate = this.view.scene.add
      .circle(p.x + 14, p.y - 26, 7, PALETTE.toxic)
      .setStrokeStyle(2, 0x0d0f14)
      .setDepth(this.sprite.depth + 1);
  }

  /** Still infectable? (Seated and human.) */
  canInfect(): boolean {
    return this.phase === 'waiting' || this.phase === 'eating';
  }

  /** The player's Toxin verb: turn this customer into staff. */
  infectByPlayer(): void {
    if (!this.canInfect()) return;
    this.phase = 'converting';
    this.sprite.setMotion('auto');
    this.plate?.destroy();
    this.plate = null;
    this.mood?.destroy();
    this.mood = null;
    this.infect();
  }

  private finishEating(): void {
    // One-shot: leave 'eating' SYNCHRONOUSLY so this can never re-fire.
    this.phase = 'converting'; // transient guard state while we settle the bill
    this.sprite.setMotion('auto');
    this.plate?.destroy();
    this.plate = null;
    this.mood?.destroy();
    this.mood = null;
    // Researched: customers pay per serving, plus a tip when service was
    // quick (~20% of the plate, none past ~30s of waiting).
    const base = this.servedDish ? this.servedDish.perServing : 0;
    const tip = base > 0 && this.waitedSec <= 30 ? Math.max(1, Math.round(base * 0.2)) : 0;
    const pay = base + tip;
    if (pay > 0) {
      Economy.addCoins(pay);
      this.coinFloat(pay, tip);
    }
    // Researched XP split: this serving's share of the dish's remaining 2/3.
    const xpShare = this.servedDish ? perServingXP(this.servedDish.xp, this.servedDish.servings) : 0;
    EventBus.publish('customer-served', pay, xpShare);
    this.onAte(this); // scene drops a dirty plate on the table
    this.phase = 'leaving';
    this.leave();
  }

  private stormOut(): void {
    this.showMood('sad');
    EventBus.publish('customer-angry', undefined);
    EventBus.publish('notify', 'A customer left hungry — your rating suffers!');
    this.phase = 'leaving';
    this.leave();
  }

  private headY(): number {
    return this.sprite.y - this.sprite.displayHeight;
  }

  /** The thought bubble rides above the head through every phase. */
  private followMood(): void {
    if (this.mood) {
      this.mood.setPosition(this.sprite.x + 16, this.headY() - 10);
      this.mood.setDepth(this.sprite.depth + 2);
    }
  }

  /**
   * Ground truth (spec 92 §7): customers telegraph mood with thought bubbles —
   * happy-yellow, frowning-blue, and a pale "feed me" bubble while waiting.
   */
  private showMood(kind: 'happy' | 'sad' | 'hungry'): void {
    this.mood?.destroy();
    const scene = this.view.scene;
    const fill = kind === 'happy' ? 0xf7d154 : kind === 'sad' ? 0x7fa8d9 : 0xece7d6;
    const g = scene.add.graphics();
    g.fillStyle(fill, 1);
    g.lineStyle(2, 0x0d0f14, 1);
    g.fillCircle(0, 0, 13);
    g.strokeCircle(0, 0, 13);
    // thought-tail dot toward the head
    g.fillCircle(-10, 12, 3.5);
    g.strokeCircle(-10, 12, 3.5);
    if (kind === 'hungry') {
      // fork + knife glyph: "somebody feed me"
      g.lineStyle(2, 0x0d0f14, 1);
      g.lineBetween(-4, -6, -4, 7);
      g.lineBetween(-6.5, -6, -6.5, -1);
      g.lineBetween(-1.5, -6, -1.5, -1);
      g.lineBetween(4, -6, 4, 7);
      g.beginPath();
      g.arc(4, -3, 3, Math.PI, Math.PI * 1.9);
      g.strokePath();
    } else {
      // face: two eyes + smile or frown
      g.fillStyle(0x0d0f14, 1);
      g.fillCircle(-4.5, -3.5, 1.8);
      g.fillCircle(4.5, -3.5, 1.8);
      g.beginPath();
      if (kind === 'happy') g.arc(0, 1.5, 6, 0.15 * Math.PI, 0.85 * Math.PI);
      else g.arc(0, 10, 6, 1.15 * Math.PI, 1.85 * Math.PI);
      g.strokePath();
    }
    const c = scene.add.container(this.sprite.x + 16, this.headY() - 10, [g]);
    c.setScale(0);
    scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.mood = c;
  }

  /** Coin pop when the bill is paid — money you SEE is money you feel. */
  private coinFloat(amount: number, tip = 0): void {
    const scene = this.view.scene;
    const label = tip > 0 ? `+${amount - tip} +${tip} TIP` : `+${amount}`;
    const t = scene.add
      .text(this.sprite.x, this.headY() - 4, label, {
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
    this.sprite.setMotion('auto');
    this.faceOverride = null;
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
    // Slip out through the door instead of blinking out of existence.
    this.view.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 240,
      onUpdate: () => this.shadow.setAlpha(0.18 * this.sprite.alpha),
      onComplete: () => this.destroy(),
    });
  }
}
