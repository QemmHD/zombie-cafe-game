import { CFG } from '../config';

export interface Pt { x: number; y: number; }
export interface Tile { col: number; row: number; }

/** Isometric world: tile<->screen conversion, depth sorting by iso Y, and a
 *  blocked-tile set used by pathfinding. */
export class IsoWorld {
  originX: number;
  originY: number;
  cols = CFG.gridCols;
  rows = CFG.gridRows;
  usableCols = CFG.startUsableCols;
  usableRows = CFG.startUsableRows;
  blocked = new Set<string>();

  constructor(originX: number, originY: number) {
    this.originX = originX;
    this.originY = originY;
  }

  toScreen(col: number, row: number): Pt {
    return {
      x: this.originX + (col - row) * (CFG.tileW / 2),
      y: this.originY + (col + row) * (CFG.tileH / 2)
    };
  }
  toTile(x: number, y: number): Tile {
    const a = (x - this.originX) / (CFG.tileW / 2);
    const b = (y - this.originY) / (CFG.tileH / 2);
    return { col: (a + b) / 2, row: (b - a) / 2 };
  }
  depth(col: number, row: number): number { return (col + row) * 1000; }
  inBounds(c: number, r: number) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  inUsable(c: number, r: number) { return c >= 0 && r >= 0 && c < this.usableCols && r < this.usableRows; }

  key(c: number, r: number) { return c + ',' + r; }
  setBlocked(tiles: Tile[]) { this.blocked = new Set(tiles.map((t) => this.key(t.col, t.row))); }
  isBlocked(c: number, r: number) { return this.blocked.has(this.key(c, r)); }

  /** First walkable neighbour of a tile (used to stand next to furniture). */
  approach(col: number, row: number): Tile {
    for (const [dc, dr] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1]] as [number, number][]) {
      const c = col + dc, r = row + dr;
      if (this.inUsable(c, r) && !this.isBlocked(c, r)) return { col: c, row: r };
    }
    return { col, row };
  }
}
