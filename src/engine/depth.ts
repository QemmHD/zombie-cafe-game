// Depth canon (spec 01 §5). One convention; all magic depth constants die here.
// HUD lives in a separate scrollFactor(0) container at depth 10000 (view-side).

import type { Placement } from './grid/CafeGrid';

export const BAND = {
  FLOOR: 0, // baked floor RT — single object
  FLOOR_OVERLAY: 500, // edit-mode grid lines, footprint validity diamonds
  WALL: 1000, // wall sections: 1000 + index; wallDecor: host + 0.5
  ENTITY: 2000, // furniture + characters, sorted below
  FX_WORLD: 9000, // world-space fx not parented to an entity
} as const;

/** Furniture sorts by its front-corner tile sum (anti-diagonal). */
export function furnitureSortKey(p: Placement): number {
  return p.anchor.tx + p.footprint.w - 1 + (p.anchor.ty + p.footprint.h - 1);
}

/** Characters sort by continuous tile-space position sum. */
export function characterSortKey(fx: number, fy: number): number {
  return fx + fy;
}

/**
 * Entity band depth (canon §1, rev 3). The tile sum is quantized round-to-nearest
 * BEFORE scaling: furniture keys are integer sums (depth ≡ 0 mod 16) while
 * characters carry the +8 bias (≡ 8 mod 16), so a character↔furniture depth tie
 * is arithmetically impossible — mid-step included. Exactly one depth flip per
 * furniture pass, at fractional sum 0.5. Keys must come from the LOGICAL
 * trajectory, never the corner-rounded render offset. Character↔character ties
 * (same quantized sum) break by stable entity-id order in the view.
 */
export function entityDepth(key: number, isCharacter: boolean): number {
  return BAND.ENTITY + 16 * Math.floor(key + 0.5) + (isCharacter ? 8 : 0);
}
