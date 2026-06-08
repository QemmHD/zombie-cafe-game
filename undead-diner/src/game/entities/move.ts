import type { Tile } from '../iso/IsoGrid';

export interface Movable {
  col: number;
  row: number;
  path: Tile[];
  facing: number; // -1 left, 1 right (screen-x)
  speedTiles: number;
}

/** Advance a movable along its waypoint path. Returns true when path is done. */
export function stepAlong(m: Movable, dt: number): boolean {
  if (!m.path || m.path.length === 0) return true;
  const target = m.path[0];
  const dc = target.col - m.col;
  const dr = target.row - m.row;
  const dist = Math.hypot(dc, dr);
  const step = m.speedTiles * dt;
  if (dist <= step || dist === 0) {
    m.col = target.col; m.row = target.row;
    m.path.shift();
    return m.path.length === 0;
  }
  m.col += (dc / dist) * step;
  m.row += (dr / dist) * step;
  m.facing = (dc - dr) < 0 ? -1 : 1;
  return false;
}
