import type { IsoWorld, Tile } from '../iso/IsoWorld';

/**
 * Grid pathfinding (A*) over walkable tiles. The diner floor is mostly open,
 * so callers can also just request a straight 2-point path; when obstacles are
 * supplied (furniture footprints) A* routes around them.
 */
export class PathfindingSystem {
  grid: IsoWorld;
  blocked: Set<string> = new Set();

  constructor(grid: IsoWorld) { this.grid = grid; }

  key(c: number, r: number) { return c + ',' + r; }
  setBlocked(tiles: { col: number; row: number }[]) {
    this.blocked = new Set(tiles.map((t) => this.key(t.col, t.row)));
  }
  isBlocked(c: number, r: number) { return this.blocked.has(this.key(c, r)); }

  /** Returns a list of tile waypoints from start to goal (inclusive of goal). */
  find(start: Tile, goal: Tile): Tile[] {
    const s = { col: Math.round(start.col), row: Math.round(start.row) };
    const g = { col: Math.round(goal.col), row: Math.round(goal.row) };
    if (s.col === g.col && s.row === g.row) return [goal];

    const open: string[] = [this.key(s.col, s.row)];
    const came: Record<string, string> = {};
    const gScore: Record<string, number> = { [this.key(s.col, s.row)]: 0 };
    const fScore: Record<string, number> = { [this.key(s.col, s.row)]: this.h(s, g) };
    const seen = new Set<string>();
    let guard = 0;

    while (open.length && guard++ < 4000) {
      open.sort((a, b) => (fScore[a] ?? 1e9) - (fScore[b] ?? 1e9));
      const cur = open.shift()!;
      const [cc, cr] = cur.split(',').map(Number);
      if (cc === g.col && cr === g.row) return this.rebuild(came, cur, goal);
      seen.add(cur);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cc + dc, nr = cr + dr;
        if (!this.grid.inBounds(nc, nr)) continue;
        if (this.isBlocked(nc, nr) && !(nc === g.col && nr === g.row)) continue;
        const nk = this.key(nc, nr);
        if (seen.has(nk)) continue;
        const tentative = (gScore[cur] ?? 1e9) + 1;
        if (tentative < (gScore[nk] ?? 1e9)) {
          came[nk] = cur;
          gScore[nk] = tentative;
          fScore[nk] = tentative + this.h({ col: nc, row: nr }, g);
          if (!open.includes(nk)) open.push(nk);
        }
      }
    }
    return [goal]; // fall back to straight line if no route
  }

  private h(a: { col: number; row: number }, b: { col: number; row: number }) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }
  private rebuild(came: Record<string, string>, cur: string, goal: Tile): Tile[] {
    const path: Tile[] = [];
    let node: string | undefined = cur;
    while (node) {
      const [c, r] = node.split(',').map(Number);
      path.unshift({ col: c, row: r });
      node = came[node];
    }
    path.push(goal);
    return path;
  }
}
