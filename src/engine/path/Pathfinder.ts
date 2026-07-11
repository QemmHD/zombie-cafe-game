// Pathfinding (spec 01 §4): 4-connected A* — the game-wide movement canon.
// Diagonal travel emerges as a staircase; no corner-cutting rules exist at all.
//
// Determinism contract (§4.2): step cost 1.0; +0.08 turn penalty when the step
// direction differs from the previous step's (=> minimum-turn paths, the long
// straight shamble runs the original shows); Manhattan heuristic (admissible —
// penalties only add cost); ties break on lower h then insertion order via a
// stable binary heap with monotonic sequence numbers; fixed neighbor order
// SE, SW, NW, NE. Same grid + same query => byte-identical path, every run.

import { DIRS, DIR_DELTA, tileEq, type Dir, type Tile } from '../types';

export interface WalkSource {
  readonly w: number;
  readonly h: number;
  walkable(t: Tile): boolean;
}

export interface PathQuery {
  from: Tile;
  to: Tile;
  /** Treat the goal cell as walkable regardless of occupancy (sit on chair, bus to counter). */
  allowNonWalkableGoal?: boolean;
}

export type PathResult =
  | { status: 'ok'; path: Tile[] } // path[0] = from, last = to, 4-adjacent steps
  | { status: 'blocked' } // no route exists
  | { status: 'invalid' }; // from/to out of bounds

const TURN_PENALTY = 0.08;

interface Node {
  tx: number;
  ty: number;
  dir: Dir | null; // direction of the step that reached this node
  g: number;
  f: number;
  h: number;
  seq: number; // insertion order for stable ties
  parent: Node | null;
}

/** Binary min-heap ordered by (f, h, seq) — the determinism tie-break chain. */
class Heap {
  private a: Node[] = [];

  get size(): number {
    return this.a.length;
  }

  private less(i: number, j: number): boolean {
    const x = this.a[i];
    const y = this.a[j];
    if (x.f !== y.f) return x.f < y.f;
    if (x.h !== y.h) return x.h < y.h;
    return x.seq < y.seq;
  }

  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): Node {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function findPath(g: WalkSource, q: PathQuery): PathResult {
  const inBounds = (t: Tile) => t.tx >= 0 && t.ty >= 0 && t.tx < g.w && t.ty < g.h;
  if (!inBounds(q.from) || !inBounds(q.to)) return { status: 'invalid' };

  const goal = q.to;
  const goalOk = q.allowNonWalkableGoal === true;
  // The walker may legitimately start on a non-walkable cell only in the
  // allowNonWalkableGoal world (e.g. standing up from a chair); starting cell
  // walkability is therefore not validated — steps out of it are.
  if (!goalOk && !g.walkable(goal)) return { status: 'blocked' };

  if (tileEq(q.from, goal)) return { status: 'ok', path: [{ ...q.from }] };

  const h0 = Math.abs(goal.tx - q.from.tx) + Math.abs(goal.ty - q.from.ty);
  // State space is (tile, incoming dir): with a turn penalty, the cheapest way
  // through a tile depends on arrival direction, so tiles alone under-key A*.
  const stateKey = (tx: number, ty: number, dir: Dir | null): number =>
    (ty * 4096 + tx) * 5 + (dir === null ? 4 : DIRS.indexOf(dir));

  const best = new Map<number, number>(); // stateKey -> best g seen
  const open = new Heap();
  let seq = 0;
  const start: Node = { tx: q.from.tx, ty: q.from.ty, dir: null, g: 0, h: h0, f: h0, seq: seq++, parent: null };
  open.push(start);
  best.set(stateKey(start.tx, start.ty, null), 0);

  while (open.size > 0) {
    const cur = open.pop();
    if (cur.tx === goal.tx && cur.ty === goal.ty) {
      const path: Tile[] = [];
      for (let n: Node | null = cur; n; n = n.parent) path.push({ tx: n.tx, ty: n.ty });
      path.reverse();
      return { status: 'ok', path };
    }
    const curKey = stateKey(cur.tx, cur.ty, cur.dir);
    if ((best.get(curKey) ?? Infinity) < cur.g) continue; // stale heap entry

    for (const dir of DIRS) {
      const d = DIR_DELTA[dir];
      const nx = cur.tx + d.tx;
      const ny = cur.ty + d.ty;
      const nt = { tx: nx, ty: ny };
      if (!inBounds(nt)) continue;
      const isGoal = nx === goal.tx && ny === goal.ty;
      if (!g.walkable(nt) && !(isGoal && goalOk)) continue;

      const turn = cur.dir !== null && cur.dir !== dir ? TURN_PENALTY : 0;
      const ng = cur.g + 1 + turn;
      const key = stateKey(nx, ny, dir);
      if ((best.get(key) ?? Infinity) <= ng) continue;
      best.set(key, ng);
      const nh = Math.abs(goal.tx - nx) + Math.abs(goal.ty - ny);
      open.push({ tx: nx, ty: ny, dir, g: ng, h: nh, f: ng + nh, seq: seq++, parent: cur });
    }
  }
  return { status: 'blocked' };
}
