// Core value types shared across the engine (spec 01 §2.2, §2.6).
// This module is dependency-free and Phaser-free, like everything in src/engine/.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Tile {
  tx: number;
  ty: number;
}

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** +tx = SE (screen lower-right), +ty = SW (screen lower-left). */
export type Dir = 'SE' | 'SW' | 'NW' | 'NE';

export const DIR_DELTA: Record<Dir, Tile> = {
  SE: { tx: +1, ty: 0 },
  SW: { tx: 0, ty: +1 },
  NW: { tx: -1, ty: 0 },
  NE: { tx: 0, ty: -1 },
};

/** Fixed neighbor expansion order — part of the determinism contract (spec 01 §4.2). */
export const DIRS: readonly Dir[] = ['SE', 'SW', 'NW', 'NE'];

export const tileEq = (a: Tile, b: Tile): boolean => a.tx === b.tx && a.ty === b.ty;
export const tileKey = (t: Tile): number => t.ty * 4096 + t.tx; // grids max 17x16; safe

export class EngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
