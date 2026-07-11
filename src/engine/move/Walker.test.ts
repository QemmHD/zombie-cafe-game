import { describe, it, expect } from 'vitest';
import { CafeGrid, type FootprintItem, type ItemCatalog } from '../grid/CafeGrid';
import { Walker, type WalkerEvent } from './Walker';
import { MAX_LIVE_CATCHUP } from '../IsoConfig';

const ITEMS: Record<string, FootprintItem> = {
  crate: { itemId: 'crate', kind: 'decor', w: 1, h: 1 },
  wall3: { itemId: 'wall3', kind: 'decor', w: 3, h: 1 },
};
const catalog: ItemCatalog = (id) => ITEMS[id] ?? null;

/**
 * Drive a walker with fixed small ticks until it goes idle or maxSeconds
 * elapses. Blocked walkers keep ticking — that is how they retry (§4.5).
 */
function run(w: Walker, maxSeconds: number): WalkerEvent[] {
  const events: WalkerEvent[] = [];
  const dt = 0.05;
  for (let t = 0; t < maxSeconds; t += dt) {
    events.push(...w.tick(dt));
    if (w.state === 'idle') break;
  }
  return events;
}

describe('Walker', () => {
  it('walks a path tile by tile and arrives exactly on center', () => {
    const g = CafeGrid.starter(catalog);
    const w = new Walker(g, 'z1', { tx: 0, ty: 0 }, 1.0, 7);
    expect(w.requestMove({ tx: 3, ty: 0 }).status).toBe('ok');
    const events = run(w, 30);
    expect(w.state).toBe('idle');
    expect(w.pos).toEqual({ x: 3, y: 0 });
    const steps = events.filter((e) => e.type === 'step');
    expect(steps).toHaveLength(3);
    expect(events.at(-1)).toEqual({ type: 'arrived', tile: { tx: 3, ty: 0 } });
    expect(w.facing).toBe('SE');
  });

  it('freezes at a tile center when its route is blocked mid-walk, then resumes', () => {
    const g = CafeGrid.starter(catalog);
    // Corridor along ty=0..1: wall off row ty=2 EXCEPT (6,2), then close that gap mid-walk.
    const w = new Walker(g, 'z1', { tx: 0, ty: 0 }, 1.2, 7);
    g.place(ITEMS.wall3, { tx: 0, ty: 2 }, 0);
    g.place(ITEMS.wall3, { tx: 3, ty: 2 }, 0); // covers (3..5,2); gap at (6,2)
    expect(w.requestMove({ tx: 0, ty: 5 }).status).toBe('ok');
    run(w, 2); // partway
    const gapId = g.place(ITEMS.crate, { tx: 6, ty: 2 }, 0); // close the gap -> fully walled
    const events = run(w, 10);
    expect(w.state).toBe('blocked');
    expect(events.some((e) => e.type === 'blocked')).toBe(true);
    // Walker froze on an exact tile center, never inside furniture
    expect(w.pos.x).toBe(Math.round(w.pos.x));
    expect(w.pos.y).toBe(Math.round(w.pos.y));
    expect(g.walkable(w.currentTile())).toBe(true);
    // Reopen the gap -> automatic retry -> resumed -> arrives
    g.remove(gapId);
    const after = run(w, 30);
    expect(after.some((e) => e.type === 'resumed')).toBe(true);
    expect(w.state).toBe('idle');
    expect(w.currentTile()).toEqual({ tx: 0, ty: 5 });
  });

  it('reaches a non-walkable goal (chair) with allowNonWalkableGoal', () => {
    const g = CafeGrid.starter(catalog);
    const chair: FootprintItem = { itemId: 'chair_x', kind: 'chair', w: 1, h: 1 };
    g.place(chair, { tx: 4, ty: 4 }, 0);
    const w = new Walker(g, 'c1', { tx: 3, ty: 7 }, 2.0, 3);
    expect(w.requestMove({ tx: 4, ty: 4 }).status).toBe('blocked');
    expect(w.requestMove({ tx: 4, ty: 4 }, { allowNonWalkableGoal: true }).status).toBe('ok');
    run(w, 30);
    expect(w.currentTile()).toEqual({ tx: 4, ty: 4 });
  });

  it('is deterministic per seed: same seed same trajectory, different seed differs', () => {
    const walkOnce = (seed: number): string => {
      const g = CafeGrid.starter(catalog);
      const w = new Walker(g, 'z', { tx: 0, ty: 0 }, 1.0, seed);
      w.requestMove({ tx: 6, ty: 6 });
      const trace: string[] = [];
      for (let i = 0; i < 400 && w.state === 'moving'; i++) {
        w.tick(0.05);
        trace.push(`${w.pos.x.toFixed(4)},${w.pos.y.toFixed(4)}`);
      }
      return trace.join(';');
    };
    expect(walkOnce(7)).toBe(walkOnce(7));
    expect(walkOnce(7)).not.toBe(walkOnce(8));
  });

  it('rejects live dt beyond MAX_LIVE_CATCHUP (offline settlement contract)', () => {
    const g = CafeGrid.starter(catalog);
    const w = new Walker(g, 'z1', { tx: 0, ty: 0 }, 1.0, 7);
    w.requestMove({ tx: 3, ty: 0 });
    expect(() => w.tick(MAX_LIVE_CATCHUP + 1)).toThrow(/offline settlement/);
    expect(() => w.tick(MAX_LIVE_CATCHUP)).not.toThrow();
  });

  it('renderPos rounds corners near interior waypoints but stays near the logical path', () => {
    const g = CafeGrid.starter(catalog);
    const w = new Walker(g, 'z1', { tx: 0, ty: 0 }, 1.0, 7);
    w.requestMove({ tx: 2, ty: 2 });
    let maxDev = 0;
    for (let i = 0; i < 400 && w.state === 'moving'; i++) {
      w.tick(0.02);
      const r = w.renderPos();
      const dev = Math.abs(r.x - w.pos.x) + Math.abs(r.y - w.pos.y);
      maxDev = Math.max(maxDev, dev);
    }
    expect(maxDev).toBeGreaterThan(0); // rounding actually engaged at the corner
    expect(maxDev).toBeLessThan(0.5); // never wanders off the path
  });
});
