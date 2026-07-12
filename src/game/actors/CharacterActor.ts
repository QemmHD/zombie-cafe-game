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
 * phase, so feet and stride never skate.
 *
 * Deliberate deviation from ground truth (spec 92 §5 says the original drew
 * no character shadows): our painted furniture casts contact shadows, so
 * shadowless characters read as pasted-on paper. A tight contact shadow that
 * shrinks as the body hops is what plants them on the floor.
 */
export class CharacterActor {
  readonly walker: Walker;
  readonly sprite: PuppetBody;
  protected view: RoomView;
  /** While seated, facing comes from the chair, not the walker. */
  faceOverride: 'left' | 'right' | null = null;
  protected shadow: Phaser.GameObjects.Ellipse;
  private tiredBadge: Phaser.GameObjects.Text | null = null;

  constructor(view: RoomView, rigKey: string, start: Tile, tilesPerSec: number, seed: number, id: string) {
    this.view = view;
    this.walker = new Walker(view.grid as CafeGrid, id, start, tilesPerSec, seed);
    this.sprite = new PuppetBody(view.scene, rigKey, CHAR_H);
    this.shadow = view.scene.add.ellipse(0, 0, 36, 11, 0x000000, 0.26);
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
    const d = entityDepth(characterSortKey(this.walker.pos.x, this.walker.pos.y), true);
    this.sprite.setDepth(d);
    // Facing: 2 authored facings + flip. Art faces LEFT (SW/NW); mirror for SE/NE.
    if (this.faceOverride) this.sprite.setFlipX(this.faceOverride === 'right');
    else this.sprite.setFlipX(this.walker.facing === 'SE' || this.walker.facing === 'NE');
    // Contact shadow: shrinks and fades as the body hops off the ground.
    const lift = this.sprite.lift;
    const k = Math.max(0.55, 1 - lift / 26);
    this.shadow.setPosition(p.x, p.y + 17);
    this.shadow.setScale(k);
    this.shadow.setAlpha(0.26 * k * this.sprite.alpha);
    this.shadow.setDepth(d - 1);
  }

  /** Render-only nudge (body separation) — logic positions never move. */
  nudgeRender(dx: number): void {
    this.sprite.x += dx;
    this.shadow.x += dx;
  }

  /** "z Z" over a daydreaming zombie — the original's tired-staff telegraph. */
  setTiredBadge(on: boolean): void {
    if (on && !this.tiredBadge) {
      this.tiredBadge = this.view.scene.add
        .text(0, 0, 'z Z', { fontFamily: 'monospace', fontSize: '13px', color: '#9fb3d9', fontStyle: 'bold' })
        .setOrigin(0.5, 1)
        .setStroke('#0d0f14', 3);
    } else if (!on && this.tiredBadge) {
      this.tiredBadge.destroy();
      this.tiredBadge = null;
    }
    if (this.tiredBadge) {
      this.tiredBadge
        .setPosition(this.sprite.x + 15, this.sprite.y - this.sprite.displayHeight - 2)
        .setDepth(this.sprite.depth + 2);
    }
  }

  destroy(): void {
    // No tween callback may outlive the actor (a tween touching a destroyed
    // body dereferences a nulled scene and kills the game loop).
    this.view.scene.tweens.killTweensOf(this.sprite);
    this.walker.dispose();
    this.tiredBadge?.destroy();
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
