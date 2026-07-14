import Phaser from 'phaser';
import { PALETTE } from '../config';
import { getZombie } from '../data/content';
import type { Dish, ZombieInstance } from '../data/types';
import { BAND, type PlacementId } from '../engine/contracts';
import type { RoomView } from '../view/RoomView';

/**
 * Authentic stove lifecycle (researched, multi-source):
 *   staffed -> (cookbook pick, price paid) -> cooking -> READY -> carried to a
 *   serving counter by a zombie. Finished food left on the stove burns after
 *   one more cook-time ("don't leave it longer than the cooking time x2" —
 *   TapGamers guide); a burnt batch is destroyed and must be tossed.
 * Income does NOT come from the stove — customers pay per serving when served.
 */
export type StoveState = 'unstaffed' | 'awaiting-cook' | 'staffed' | 'cooking' | 'ready' | 'burnt';

export class StoveSim {
  readonly placementId: PlacementId;
  state: StoveState = 'unstaffed';
  dish: Dish | null = null; // the batch on the stove (cooking / ready / burnt)
  queuedDish: Dish | null = null; // picked from the cookbook while the cook walks over
  zombie: ZombieInstance | null = null;

  private view: RoomView;
  private elapsedGame = 0;
  private cookGame = 0;
  private burnLeft = 0;

  private label: Phaser.GameObjects.Text;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private bubble: Phaser.GameObjects.Container;
  private steam: Phaser.GameObjects.Ellipse;
  private bobTween: Phaser.Tweens.Tween | null = null;
  private top = { x: 0, y: 0 };

  constructor(view: RoomView, placementId: PlacementId) {
    this.view = view;
    this.placementId = placementId;
    const scene = view.scene;
    const sprite = view.furnitureSprite(placementId);
    if (!sprite) throw new Error(`stove placement ${placementId} has no sprite`);
    const { x, y } = sprite;
    this.top = { x, y: y - sprite.displayHeight };
    // Status UI lives in the world-FX band: no prop or character may occlude it.
    const depth = BAND.FX_WORLD;

    this.label = scene.add
      .text(x, y + 4, 'tap to staff', { fontFamily: 'monospace', fontSize: '15px', color: '#e8ecf2' })
      .setOrigin(0.5, 0)
      .setStroke('#0d0f14', 4)
      .setDepth(depth);
    this.barBg = scene.add.rectangle(x, y - 4, 78, 9, 0x0d0f14, 0.78).setDepth(depth).setVisible(false);
    this.barFill = scene.add.rectangle(x - 38, y - 4, 0, 5, PALETTE.toxic).setOrigin(0, 0.5).setDepth(depth + 1);
    this.steam = scene.add.ellipse(x, this.top.y + 6, 22, 13, PALETTE.toxic, 0).setDepth(depth);

    this.bubble = scene.add.container(x, this.top.y - 12).setDepth(depth + 2);
    const bBg = scene.add.circle(0, 0, 15, PALETTE.coin).setStrokeStyle(2, 0x0d0f14);
    const bTxt = scene.add
      .text(0, 0, '!', { fontFamily: 'monospace', fontSize: '16px', color: '#141821', fontStyle: 'bold' })
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
    if (this.state === 'ready' || this.state === 'burnt') this.bubble.setVisible(true);
  }

  /** A cook has been dispatched (optionally with a dish already picked). */
  expectStaff(dish: Dish | null): void {
    if (this.state === 'cooking') {
      // A paused pot: someone is walking back to resume it, don't reset state.
      this.setLabel('cook returning…', '#8891a4');
      return;
    }
    this.state = 'awaiting-cook';
    this.queuedDish = dish;
    this.setLabel('staff incoming…', '#8891a4');
  }

  /** Order placed while the cook is still walking over: cook it on arrival. */
  queueDish(dish: Dish): void {
    if (this.state === 'awaiting-cook') this.queuedDish = dish;
  }

  /** Dispatch failed or died en route: the stove is honest about it again. */
  revertToUnstaffed(): void {
    this.state = 'unstaffed';
    this.queuedDish = null;
    this.setLabel('tap to staff', '#e8ecf2');
  }

  /** Called by the scene when the dispatched cook reaches the stove. */
  staffArrived(zombie: ZombieInstance): void {
    if (this.state === 'cooking') {
      this.resumeCook(zombie);
      return;
    }
    this.zombie = zombie;
    zombie.assignment = 'kitchen';
    if (this.state === 'ready' || this.state === 'burnt') return; // stand by
    if (this.queuedDish) {
      const dish = this.queuedDish;
      this.queuedDish = null;
      this.beginCook(dish);
    } else {
      this.state = 'staffed';
      this.setLabel('tap: choose a dish', '#e8ecf2');
    }
  }

  /**
   * The cook was re-tasked away. A cooking pot PAUSES (confirmed: "the dish
   * requires a chef or zombie... it can be paused and resumed at any time");
   * a READY batch stays out and keeps burning down.
   */
  releaseCook(): void {
    this.zombie = null;
    if (this.state === 'awaiting-cook' || this.state === 'staffed') this.revertToUnstaffed();
    else if (this.state === 'cooking') {
      this.steam.setAlpha(0.15);
      this.setLabel(`${this.dish?.displayName ?? ''} — paused (no cook)`, '#f2c14e');
    }
  }

  /** A cook returned to a paused pot: resume where it left off. */
  resumeCook(zombie: ZombieInstance): void {
    this.zombie = zombie;
    zombie.assignment = 'kitchen';
    if (this.state === 'cooking' && this.dish) {
      this.steam.setAlpha(0.5);
      this.setLabel(this.dish.displayName, '#e8ecf2');
    }
  }

  /** Start cooking a paid-for dish. Requires the cook to be at the stove. */
  beginCook(dish: Dish): void {
    this.dish = dish;
    const z = this.zombie ? getZombie(this.zombie.zombieId) : null;
    this.cookGame = dish.cookTimeSeconds * (z ? z.cookSpeedMult : 1);
    this.elapsedGame = 0;
    this.state = 'cooking';
    this.bubble.setVisible(false);
    this.barBg.setVisible(true);
    this.barFill.setFillStyle(PALETTE.toxic);
    this.steam.setAlpha(0.5);
    this.setLabel(dish.displayName, '#e8ecf2');
  }

  /** Carry pickup: hand the finished batch to a zombie, clear the stove. */
  takeBatch(): Dish | null {
    if (this.state !== 'ready' || !this.dish) return null;
    const batch = this.dish;
    this.clearBatch();
    return batch;
  }

  /** Toss a burnt batch (tap verb). The pot is saved, the food is not. */
  discardBurnt(): void {
    if (this.state !== 'burnt') return;
    this.clearBatch();
  }

  private clearBatch(): void {
    this.dish = null;
    this.burnLeft = 0;
    this.bubble.setVisible(false);
    this.bobTween?.pause();
    this.view.scene.tweens.killTweensOf(this.bubble);
    this.bobTween = null;
    this.barBg.setVisible(false);
    this.barFill.width = 0;
    this.steam.setAlpha(0);
    if (this.zombie) {
      this.state = 'staffed';
      this.setLabel('tap: choose a dish', '#e8ecf2');
    } else {
      this.revertToUnstaffed();
    }
  }

  /** Seconds of cooking left (for the "still cooking" tap feedback). */
  remainingSec(): number {
    return Math.max(0, Math.ceil(this.cookGame - this.elapsedGame));
  }

  /** Toxin accelerant: the pot leaps straight to READY (original mechanic). */
  finishInstantly(): void {
    if (this.state !== 'cooking') return;
    this.elapsedGame = this.cookGame;
    this.update(0.001);
  }

  update(dtSec: number): void {
    if (this.state === 'cooking') {
      if (!this.zombie) return; // unmanned pot is PAUSED (authentic rule)
      this.elapsedGame += dtSec; // real seconds — canon: no scale constant exists
      const p = Phaser.Math.Clamp(this.elapsedGame / this.cookGame, 0, 1);
      this.barFill.width = 76 * p;
      this.steam.y = this.top.y + 6 + Math.sin(this.elapsedGame / 40) * 3;
      if (p >= 1) this.becomeReady();
    } else if (this.state === 'ready' && this.dish) {
      this.burnLeft -= dtSec;
      const window = this.dish.cookTimeSeconds * burnMultiplier(this.dish.cookTimeSeconds);
      this.barFill.width = 76 * Phaser.Math.Clamp(this.burnLeft / window, 0, 1);
      if (this.burnLeft <= 0) this.becomeBurnt();
    }
  }

  private becomeReady(): void {
    if (!this.dish) return;
    this.state = 'ready';
    this.burnLeft = this.dish.cookTimeSeconds * burnMultiplier(this.dish.cookTimeSeconds);
    this.barFill.setFillStyle(PALETTE.coin);
    this.barFill.width = 76;
    this.steam.setAlpha(0.25);
    this.setLabel(`${this.dish.displayName} — READY`, '#f2c14e');
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

  private becomeBurnt(): void {
    this.state = 'burnt';
    this.barBg.setVisible(false);
    this.barFill.width = 0;
    this.steam.setFillStyle(0x3a3a42).setAlpha(0.7); // sad gray smoke
    this.setLabel('BURNT — tap to toss', '#ff7a6a');
  }

  private setLabel(text: string, color: string): void {
    this.label.setText(text).setColor(color);
  }
}

/**
 * Post-finish burn window (researched, v1.13 tiered rule): quick dishes get
 * 5x their cook time before burning, mid dishes 4x, long dishes 3x.
 */
function burnMultiplier(cookSec: number): number {
  if (cookSec <= 5 * 60) return 5;
  if (cookSec <= 30 * 60) return 4;
  return 3;
}
