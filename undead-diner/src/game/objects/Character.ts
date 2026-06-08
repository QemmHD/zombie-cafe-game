import { IsoObject } from './IsoObject';
import type { Tile } from '../iso/IsoWorld';

/** A moving character that follows a tile-waypoint path. */
export class Character extends IsoObject {
  path: Tile[] = [];
  facing = 1;            // -1 left, 1 right (screen)
  speedTiles = 2;
  bob = Math.random() * 6;

  /** Advance along the path. Returns true when the path is finished. */
  step(dt: number): boolean {
    this.bob += dt * 9;
    if (!this.path.length) return true;
    const t = this.path[0];
    const dc = t.col - this.col, dr = t.row - this.row;
    const d = Math.hypot(dc, dr);
    const s = this.speedTiles * dt;
    if (d <= s || d === 0) {
      this.col = t.col; this.row = t.row;
      this.path.shift();
      return this.path.length === 0;
    }
    this.col += (dc / d) * s;
    this.row += (dr / d) * s;
    this.facing = (dc - dr) < 0 ? -1 : 1;
    return false;
  }
  moving(): boolean { return this.path.length > 0; }
}
