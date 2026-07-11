import Phaser from 'phaser';
import {
  Walker,
  characterSortKey,
  entityDepth,
  type CafeGrid,
  type Tile,
  type WalkerEvent,
} from '../../engine/contracts';
import type { RoomView } from '../../view/RoomView';

const CHAR_H = 118; // on-screen height of a person sprite at zoom 1

/**
 * Shared base for anything that walks the grid: owns a Walker (engine) and a
 * sprite (view), keeps depth from the LOGICAL trajectory, applies the shamble
 * bob from the walker's step-synced phase.
 */
export class CharacterActor {
  readonly walker: Walker;
  readonly sprite: Phaser.GameObjects.Image;
  protected view: RoomView;
  protected baseScale: number;
  private shadow: Phaser.GameObjects.Ellipse;

  constructor(view: RoomView, texture: string, start: Tile, tilesPerSec: number, seed: number, id: string) {
    this.view = view;
    this.walker = new Walker(view.grid as CafeGrid, id, start, tilesPerSec, seed);
    this.sprite = view.scene.add.image(0, 0, texture).setOrigin(0.5, 0.96);
    this.baseScale = CHAR_H / this.sprite.height;
    this.sprite.setScale(this.baseScale);
    this.shadow = view.scene.add.ellipse(0, 0, 44, 14, 0x000000, 0.3);
    this.syncSprite();
  }

  /** Swap texture keeping the canonical character height (no magic rescales). */
  protected setCharTexture(key: string): void {
    this.sprite.setTexture(key);
    this.baseScale = CHAR_H / this.sprite.height;
    this.sprite.setScale(this.baseScale);
  }

  /** Advance the walker and mirror it to the sprite. Returns walker events. */
  tick(dtSec: number): WalkerEvent[] {
    const events = this.walker.tick(dtSec);
    this.syncSprite();
    return events;
  }

  protected syncSprite(): void {
    const r = this.walker.renderPos(); // corner-rounded, render-only
    const p = this.view.worldOf(r.x, r.y);
    const moving = this.walker.state === 'moving';
    const phase = this.walker.bobPhase;
    // Step dressing (render-only, per canon §1.2): bounce + lean + step-squash.
    // This is what separates "walking" from "sliding cutout".
    const bob = moving ? Math.abs(Math.sin(phase)) * 3.5 : 0;
    const lean = moving ? Math.sin(phase / 2) * 0.05 : 0;
    const squash = moving ? Math.abs(Math.sin(phase)) * 0.05 : 0;
    this.sprite.setPosition(p.x, p.y + 18 - bob);
    this.sprite.setRotation(lean);
    this.sprite.setScale(this.baseScale * (1 + squash * 0.6), this.baseScale * (1 - squash));
    this.shadow.setPosition(p.x, p.y + 16);
    this.shadow.setScale(1 + (moving ? Math.abs(Math.sin(phase)) * 0.08 : 0));
    // Depth from the LOGICAL trajectory (canon §1.2), never the render offset.
    const d = entityDepth(characterSortKey(this.walker.pos.x, this.walker.pos.y), true);
    this.sprite.setDepth(d);
    this.shadow.setDepth(d - 1);
    // Facing: 2 authored facings + flip. SE/NE face right, SW/NW face left.
    this.sprite.setFlipX(this.walker.facing === 'SW' || this.walker.facing === 'NW');
  }

  destroy(): void {
    // No tween callback may outlive the actor (setTexture on a destroyed
    // Image dereferences a nulled scene and kills the game loop).
    this.view.scene.tweens.killTweensOf(this.sprite);
    this.walker.dispose();
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
