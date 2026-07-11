// Isometric coordinate core (spec 01 §2). One authoritative transform set:
// every system — rendering, picking, placement, pathfinding, depth — imports this.
//
// Spaces:
//   tile  (fx, fy)  continuous; INTEGER coordinates are diamond CENTERS.
//   world (wx, wy)  logical px; origin = center of tile (0,0); +x right, +y down.
// Axis orientation: +tx runs SE (screen lower-right), +ty runs SW (lower-left).
// Tile (0,0) is the back corner where the two walls meet.

import { HALF_W, HALF_H, TILE_W, TILE_H, WALL_H, WALL_SECTION_H } from '../IsoConfig';
import type { AABB, Tile, Vec2 } from '../types';

/** tile -> world. Works for continuous (fx, fy). */
export function tileToWorld(fx: number, fy: number): Vec2 {
  return { x: (fx - fy) * HALF_W, y: (fx + fy) * HALF_H };
}

/** world -> continuous tile coords (exact algebraic inverse of tileToWorld). */
export function worldToTileF(wx: number, wy: number): Vec2 {
  return { x: wx / TILE_W + wy / TILE_H, y: wy / TILE_H - wx / TILE_W };
}

/**
 * world -> integer tile (diamond picking). round(), NOT floor(): integers are
 * centers, so the diamond is exactly the rounding cell.
 */
export function worldToTile(wx: number, wy: number): Tile {
  const f = worldToTileF(wx, wy);
  return { tx: Math.round(f.x), ty: Math.round(f.y) };
}

/** World-space AABB of a WxH room including the back walls (spec 01 §2.4). */
export function roomBounds(w: number, h: number): AABB {
  return {
    minX: -HALF_W * h, // left corner of tile (0, h-1)
    maxX: HALF_W * w, // right corner of tile (w-1, 0)
    minY: -HALF_H - WALL_H, // top of walls above tile (0,0)
    maxY: HALF_H * (w + h), // bottom corner of tile (w-1, h-1)
  };
}

/**
 * Wall canon (spec 01 §2.5): one 64x224 section per tile edge along the two
 * back edges. Right wall behind row ty=0 (sections k=0..W-1); left wall behind
 * column tx=0 (sections m=0..H-1, horizontal mirror of the right asset).
 * Returned point is the section sprite's canvas top-left in world space.
 */
export function rightWallSectionTopLeft(k: number): Vec2 {
  return { x: HALF_W * k, y: HALF_H * k - WALL_SECTION_H };
}

export function leftWallSectionTopLeft(m: number): Vec2 {
  return { x: -HALF_W * (m + 1), y: HALF_H * m - WALL_SECTION_H };
}
