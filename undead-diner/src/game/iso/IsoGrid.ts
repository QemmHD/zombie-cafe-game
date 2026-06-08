import { CFG } from '../config';

export interface Pt { x: number; y: number; }
export interface Tile { col: number; row: number; }

/** Isometric grid: converts between tile (col,row floats) and screen pixels. */
export class IsoGrid {
  originX: number;
  originY: number;
  cols = CFG.gridCols;
  rows = CFG.gridRows;

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
    const a = (x - this.originX) / (CFG.tileW / 2); // col - row
    const b = (y - this.originY) / (CFG.tileH / 2); // col + row
    return { col: (a + b) / 2, row: (b - a) / 2 };
  }

  /** Depth for back-to-front draw order. */
  depth(col: number, row: number): number {
    return (col + row) * 1000;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }
}
