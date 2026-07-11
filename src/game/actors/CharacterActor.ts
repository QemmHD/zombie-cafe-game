import {
  Walker,
  characterSortKey,
  entityDepth,
  type CafeGrid,
  type Tile,
  type WalkerEvent,
} from '../../engine/contracts';
import type { RoomView } from '../../view/RoomView';
import { PuppetBody } from './PuppetBody';

const CHAR_H = 118; // on-screen height of a person at zoom 1

/**
 * Shared base for anything that walks the grid: owns a Walker (engine) and a
 * cutout-puppet body (view). Limb cadence comes from the walker's step-synced
 * phase, so feet and stride never skate. No drop shadow — ground truth
 * (spec 92 §5): the original draws none under characters.
 */
export class CharacterActor {
  readonly walker: Walker;
  readonly sprite: PuppetBody;
  protected view: RoomView;

  constructor(view: RoomView, rigKey: string, start: Tile, tilesPerSec: number, seed: number, id: string) {
    this.view = view;
    this.walker = new Walker(view.grid as CafeGrid, id, start, tilesPerSec, seed);
    this.sprite = new PuppetBody(view.scene, rigKey, CHAR_H);
    this.syncSprite(0);
  }

  /** Swap rig (customer -> zombie on infection) keeping canonical height. */
  protected setCharRig(rigKey: string): void {
    this.sprite.setRig(rigKey, CHAR_H);
  }

  /** Advance the walker and mirror it to the puppet. Returns walker events. */
  tick(dtSec: number): WalkerEvent[] {
    const events = this.walker.tick(dtSec);
    this.syncSprite(dtSec);
    return events;
  }

  protected syncSprite(dtSec: number): void {
    const r = this.walker.renderPos(); // corner-rounded, render-only
    const p = this.view.worldOf(r.x, r.y);
    const moving = this.walker.state === 'moving';
    this.sprite.setPosition(p.x, p.y + 18);
    this.sprite.tickPose(dtSec, moving, this.walker.bobPhase);
    // Depth from the LOGICAL trajectory (canon §1.2), never the render offset.
    this.sprite.setDepth(entityDepth(characterSortKey(this.walker.pos.x, this.walker.pos.y), true));
    // Facing: 2 authored facings + flip. Art faces LEFT (SW/NW); mirror for SE/NE.
    this.sprite.setFlipX(this.walker.facing === 'SE' || this.walker.facing === 'NE');
  }

  destroy(): void {
    // No tween callback may outlive the actor (a tween touching a destroyed
    // body dereferences a nulled scene and kills the game loop).
    this.view.scene.tweens.killTweensOf(this.sprite);
    this.walker.dispose();
    this.sprite.destroy();
  }
}
