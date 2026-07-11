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
 * Entity band depth. The +8 character bias resolves the classic equal-sum tie
 * (character standing beside a 2x2 stove on the same anti-diagonal): the
 * character draws on top. Exact for all real cases with footprints <= 2x2.
 */
export function entityDepth(key: number, isCharacter: boolean): number {
  return BAND.ENTITY + key * 16 + (isCharacter ? 8 : 0);
}
