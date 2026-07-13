import { describe, it, expect } from 'vitest';
import {
  tileToWorld,
  worldToTile,
  worldToTileF,
  roomBounds,
  rightWallSectionTopLeft,
  leftWallSectionTopLeft,
} from './IsoMath';
import { HALF_H, HALF_W, WALL_H, WALL_SECTION_H } from '../IsoConfig';
import { mulberry32 } from '../rng';

describe('IsoMath transforms', () => {
  it('round-trips every integer tile of the 17x16 endgame room exactly', () => {
    for (let ty = 0; ty < 16; ty++) {
      for (let tx = 0; tx < 17; tx++) {
        const w = tileToWorld(tx, ty);
        expect(worldToTile(w.x, w.y)).toEqual({ tx, ty });
      }
    }
  });

  it('round-trips continuous positions with error < 0.5px (AC round-trip)', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const fx = rand() * 17 - 0.5;
      const fy = rand() * 16 - 0.5;
      const w = tileToWorld(fx, fy);
      const back = worldToTileF(w.x, w.y);
      const w2 = tileToWorld(back.x, back.y);
      expect(Math.abs(w2.x - w.x)).toBeLessThan(0.5);
      expect(Math.abs(w2.y - w.y)).toBeLessThan(0.5);
    }
  });

  it('picks the correct diamond from points inside it (round, not floor)', () => {
    // Points just inside tile (3,2)'s diamond: center ±(<half extents in tile space)
    const c = tileToWorld(3, 2);
    expect(worldToTile(c.x, c.y)).toEqual({ tx: 3, ty: 2 });
    expect(worldToTile(c.x + HALF_W - 1, c.y)).toEqual({ tx: 3, ty: 2 }); // near right corner
    expect(worldToTile(c.x, c.y - HALF_H + 1)).toEqual({ tx: 3, ty: 2 }); // near top corner
    // Point past the right corner belongs to the SE neighbor's half-plane
    expect(worldToTile(c.x + HALF_W + 1, c.y + 1)).not.toEqual({ tx: 3, ty: 2 });
  });

  it('tile (0,0) center is world origin; axes run SE/+x-down-right, SW/-x-down-left', () => {
    expect(tileToWorld(0, 0)).toEqual({ x: 0, y: 0 });
    const se = tileToWorld(1, 0);
    expect(se.x).toBeGreaterThan(0);
    expect(se.y).toBeGreaterThan(0);
    const sw = tileToWorld(0, 1);
    expect(sw.x).toBeLessThan(0);
    expect(sw.y).toBeGreaterThan(0);
  });
});

describe('roomBounds', () => {
  it('17x16 endgame room spans the projected extents (derived from IsoConfig)', () => {
    const b = roomBounds(17, 16);
    expect(b.maxX - b.minX).toBe(HALF_W * (17 + 16));
    expect(b.maxY).toBe(HALF_H * (17 + 16) - HALF_H); // bottom corner of tile (16,15)
    expect(b.minY).toBe(-HALF_H - WALL_H); // wall top
    // maxY must equal the actual projected bottom corner of the front tile.
    const front = tileToWorld(16, 15);
    expect(b.maxY).toBe(front.y + HALF_H);
  });
});

describe('wall canon', () => {
  it('right wall section k sits at (HALF_W*k, HALF_H*k - WALL_SECTION_H)', () => {
    for (const k of [0, 3, 16]) {
      expect(rightWallSectionTopLeft(k)).toEqual({ x: HALF_W * k, y: HALF_H * k - WALL_SECTION_H });
    }
  });
  it('left wall section m sits at (-64(m+1), 32m - 224)', () => {
    for (const m of [0, 2, 15]) {
      expect(leftWallSectionTopLeft(m)).toEqual({ x: -HALF_W * (m + 1), y: HALF_H * m - WALL_SECTION_H });
    }
  });
});
