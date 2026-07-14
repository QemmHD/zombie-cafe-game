import Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Dish } from '../data/types';
import { BAND, type PlacementId } from '../engine/contracts';
import type { RoomView } from '../view/RoomView';

/**
 * A serving counter holds ONE stocked batch (the original lets you stack a
 * dish per counter — "force a certain dish to be served" by choosing where to
 * put each pot). Waiters draw servings from here to feed seated customers;
 * when the batch runs dry the counter is free for the next pot.
 */
export class CounterSim {
  readonly placementId: PlacementId;
  dish: Dish | null = null;
  servingsLeft = 0;
  private reserved = 0; // claimed by in-flight serve jobs

  private view: RoomView;
  private pot: Phaser.GameObjects.Ellipse;
  private countLabel: Phaser.GameObjects.Text;

  constructor(view: RoomView, placementId: PlacementId) {
    this.view = view;
    this.placementId = placementId;
    const sprite = view.furnitureSprite(placementId);
    if (!sprite) throw new Error(`counter placement ${placementId} has no sprite`);
    const depth = BAND.FX_WORLD;
    this.pot = view.scene.add
      .ellipse(0, 0, 26, 16, PALETTE.toxic, 1)
      .setStrokeStyle(2, 0x0d0f14)
      .setDepth(depth)
      .setVisible(false);
    this.countLabel = view.scene.add
      .text(0, 0, '', { fontFamily: "'Trebuchet MS', Verdana, sans-serif", fontStyle: 'bold', fontSize: '13px', color: '#e8ecf2' })
      .setOrigin(0.5, 1)
      .setStroke('#0d0f14', 4)
      .setDepth(depth + 1)
      .setVisible(false);
    this.reposition();
  }

  reposition(): void {
    const sprite = this.view.furnitureSprite(this.placementId);
    if (!sprite) return;
    const topY = sprite.y - sprite.displayHeight;
    this.pot.setPosition(sprite.x, topY + 10);
    this.countLabel.setPosition(sprite.x, topY - 2);
  }

  /** Can this counter accept a new batch of `dish`? (Empty, or same dish.) */
  canStock(dish: Dish): boolean {
    return this.servingsLeft === 0 || this.dish?.dishId === dish.dishId;
  }

  stock(dish: Dish): void {
    if (this.dish?.dishId === dish.dishId) this.servingsLeft += dish.servings;
    else {
      this.dish = dish;
      this.servingsLeft = dish.servings;
    }
    this.refresh();
  }

  /** Unreserved servings still on the counter. */
  available(): number {
    return Math.max(0, this.servingsLeft - this.reserved);
  }

  /** A serve job claims one serving (released by take() or cancelReserve()). */
  reserve(): boolean {
    if (this.available() <= 0) return false;
    this.reserved++;
    return true;
  }

  cancelReserve(): void {
    this.reserved = Math.max(0, this.reserved - 1);
  }

  /** The waiter picks up a reserved plate. Returns the dish being served. */
  take(): Dish | null {
    if (!this.dish || this.servingsLeft <= 0) return null;
    this.reserved = Math.max(0, this.reserved - 1);
    this.servingsLeft--;
    const d = this.dish;
    if (this.servingsLeft <= 0) this.dish = null;
    this.refresh();
    return d;
  }

  private refresh(): void {
    const show = this.servingsLeft > 0;
    this.pot.setVisible(show);
    this.countLabel.setVisible(show);
    if (show) this.countLabel.setText(`${this.dish?.displayName ?? ''} x${this.servingsLeft}`);
  }
}
