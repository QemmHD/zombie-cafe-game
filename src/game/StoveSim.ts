import Phaser from 'phaser';
import { PALETTE } from '../config';
import { Economy } from '../core/Economy';
import { EventBus } from '../core/EventBus';
import { getZombie } from '../data/content';
import type { Dish, ZombieInstance } from '../data/types';
import { BAND, type PlacementId } from '../engine/contracts';
import type { RoomView } from '../view/RoomView';

type StoveState = 'unstaffed' | 'awaiting-cook' | 'cooking' | 'ready';

/**
 * Cooking state machine bound to a real grid placement. The stove sprite lives
 * in RoomView; this sim hangs progress/steam/ready fx off it and runs the
 * cook timer. (Interim loop: pay-then-cook + servings land in M5; the walker
 * staffing + tap-to-collect is the M1 scope.)
 */
export class StoveSim {
  readonly placementId: PlacementId;
  state: StoveState = 'unstaffed';
  dish: Dish;
  zombie: ZombieInstance | null = null;

  private view: RoomView;
  private elapsedGame = 0;
  private cookGame = 0;

  private label: Phaser.GameObjects.Text;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private bubble: Phaser.GameObjects.Container;
  private steam: Phaser.GameObjects.Ellipse;
  private bobTween: Phaser.Tweens.Tween | null = null;

  onRequestStaff: (() => boolean) | null = null; // scene dispatches a waiter; true if one is coming
  private top = { x: 0, y: 0 };

  constructor(view: RoomView, placementId: PlacementId, dish: Dish) {
    this.view = view;
    this.placementId = placementId;
    this.dish = dish;
    const scene = view.scene;
    const sprite = view.furnitureSprite(placementId);
    if (!sprite) throw new Error(`stove placement ${placementId} has no sprite`);
    const { x, y } = sprite;
    const h = sprite.displayHeight;
    this.top = { x, y: y - h };
    // Status UI lives in the world-FX band: no prop or character may occlude it.
    const depth = BAND.FX_WORLD;

    this.label = scene.add
      .text(x, y + 4, 'tap to staff', { fontFamily: 'monospace', fontSize: '15px', color: '#e8ecf2' })
      .setOrigin(0.5, 0)
      .setStroke('#0d0f14', 4)
      .setDepth(depth);
    this.barBg = scene.add.rectangle(x, y - 4, 78, 9, 0x0d0f14, 0.78).setDepth(depth);
    this.barFill = scene.add.rectangle(x - 38, y - 4, 0, 5, PALETTE.toxic).setOrigin(0, 0.5).setDepth(depth + 1);
    this.steam = scene.add.ellipse(x, this.top.y + 6, 22, 13, PALETTE.toxic, 0).setDepth(depth);

    this.bubble = scene.add.container(x, this.top.y - 12).setDepth(depth + 2);
    const bBg = scene.add.circle(0, 0, 15, PALETTE.coin).setStrokeStyle(2, 0x0d0f14);
    const bTxt = scene.add
      .text(0, 0, '$', { fontFamily: 'monospace', fontSize: '16px', color: '#141821', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.bubble.add([bBg, bTxt]).setVisible(false);

  }

  /** The stove moved (id-preserving nudge): re-anchor all status fx to it. */
  reposition(): void {
    const sprite = this.view.furnitureSprite(this.placementId);
    if (!sprite) return;
    const { x, y } = sprite;
    this.top = { x, y: y - sprite.displayHeight };
    this.label.setPosition(x, y + 4);
    this.barBg.setPosition(x, y - 4);
    this.barFill.setPosition(x - 38, y - 4);
    this.steam.setPosition(x, this.top.y + 6);
    this.bobTween?.pause();
    this.view.scene.tweens.killTweensOf(this.bubble);
    this.bobTween = null;
    this.bubble.setPosition(x, this.top.y - 12);
    if (this.state === 'ready') this.bubble.setVisible(true);
  }

  /** A waiter has been dispatched; block double-taps while they shamble over. */
  expectStaff(): void {
    this.state = 'awaiting-cook';
    this.label.setText('staff incoming…').setColor('#8891a4');
  }

  /** Dispatch failed or died en route: the stove is honest about it again. */
  revertToUnstaffed(): void {
    this.state = 'unstaffed';
    this.label.setText('tap to staff').setColor('#e8ecf2');
  }

  /** Called by the scene when the dispatched waiter reaches the stove. */
  staffArrived(zombie: ZombieInstance): void {
    this.zombie = zombie;
    zombie.assignment = 'kitchen';
    this.startCook();
  }

  /**
   * The cook was re-tasked away (original's tap-to-control). A dish in
   * progress is abandoned (interim burn rule until M5); READY food stays
   * collectable — the stove just won't restart without a cook.
   */
  releaseCook(): void {
    this.zombie = null;
    if (this.state === 'cooking' || this.state === 'awaiting-cook') {
      this.barFill.width = 0;
      this.steam.setAlpha(0);
      this.revertToUnstaffed();
    }
  }

  private startCook(): void {
    const z = this.zombie ? getZombie(this.zombie.zombieId) : null;
    this.cookGame = this.dish.cookTimeSeconds * (z ? z.cookSpeedMult : 1);
    this.elapsedGame = 0;
    this.state = 'cooking';
    this.bubble.setVisible(false);
    this.steam.setAlpha(0.5);
    this.label.setText(this.dish.displayName).setColor('#e8ecf2');
  }

  /** Tap routed by the scene's input arbiter (short press; long press = move). */
  tap(): void {
    if (this.state === 'ready') this.collect();
    else if (this.state === 'unstaffed') {
      if (!this.onRequestStaff?.()) {
        EventBus.publish('notify', 'No idle zombies — infect a customer first!');
      }
      // On success the dispatcher calls expectStaff() — state is its call.
    }
  }

  private collect(): void {
    Economy.addCoins(this.dish.coinReward);
    EventBus.publish('dish-collected', this.dish.coinReward);
    this.bobTween?.pause();
    this.view.scene.tweens.killTweensOf(this.bubble);
    this.bobTween = null;
    this.view.scene.tweens.add({
      targets: this.bubble,
      y: this.top.y - 44,
      alpha: 0,
      duration: 420,
      onComplete: () => this.bubble.setAlpha(1).setY(this.top.y - 12),
    });
    // Only restart if the cook is still standing here (they can be re-tasked).
    if (this.zombie) this.startCook();
    else {
      this.barFill.width = 0;
      this.steam.setAlpha(0);
      this.revertToUnstaffed();
    }
  }

  update(dtSec: number): void {
    if (this.state !== 'cooking') return;
    this.elapsedGame += dtSec; // real seconds — canon: no scale constant exists
    const p = Phaser.Math.Clamp(this.elapsedGame / this.cookGame, 0, 1);
    this.barFill.width = 76 * p;
    this.steam.y = this.top.y + 6 + Math.sin(this.elapsedGame / 40) * 3;
    if (p >= 1) {
      this.state = 'ready';
      this.barFill.width = 76;
      this.steam.setAlpha(0);
      this.label.setText('READY').setColor('#f2c14e');
      this.bubble.setVisible(true);
      // One reusable bob tween — never stack a new infinite tween per READY.
      if (!this.bobTween) {
        this.bobTween = this.view.scene.tweens.add({
          targets: this.bubble,
          y: this.top.y - 20,
          duration: 520,
          yoyo: true,
          repeat: -1,
        });
      } else {
        this.bobTween.restart();
      }
    }
  }
}
