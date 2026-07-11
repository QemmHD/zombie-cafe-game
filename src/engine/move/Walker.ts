// Movement controller (spec 01 §6): one committed tile step at a time, dynamic
// re-plan on grid change, and the original's authentic freeze-when-blocked.
// Pure: tick(dtSec) is caller-clocked (tests pass synthetic dt — this IS the
// project's test-time acceleration mechanism; no DEMO_TIME_SCALE exists).

import { MAX_LIVE_CATCHUP } from '../IsoConfig';
import type { CafeGrid } from '../grid/CafeGrid';
import { findPath } from '../path/Pathfinder';
import type { PathResult } from '../path/Pathfinder';
import { mulberry32 } from '../rng';
import { EngineError, tileEq, type Dir, type Tile, type Vec2 } from '../types';

export type WalkerState = 'idle' | 'moving' | 'blocked';

export type WalkerEvent =
  | { type: 'step'; tile: Tile; dir: Dir }
  | { type: 'arrived'; tile: Tile }
  | { type: 'blocked'; at: Tile }
  | { type: 'resumed' };

const ARRIVE_EPS = 0.01; // tiles
const SPEED_NOISE = 0.1; // ±10% per segment
const CORNER_RADIUS = 0.35; // tiles — visual rounding at interior waypoints

export class Walker {
  readonly id: string;
  /** Continuous TILE-space position. */
  pos: Vec2;
  facing: Dir = 'SW';
  state: WalkerState = 'idle';
  tilesPerSec: number;
  /** Step-synced bob phase for the view's shamble dressing (radians). */
  bobPhase = 0;

  private grid: CafeGrid;
  private rand: () => number;
  private path: Tile[] = []; // remaining tiles, path[0] = next tile to step onto
  private target: Tile | null = null;
  private allowNonWalkableGoal = false;
  private plannedVersion = -1;
  private segmentSpeed = 1;
  private unsubscribe: (() => void) | null = null;
  private dirty = false; // grid changed since last plan check
  private pendingBlock = false; // route died mid-step; freeze at the next center

  constructor(grid: CafeGrid, id: string, start: Tile, tilesPerSec: number, seed: number) {
    this.grid = grid;
    this.id = id;
    this.pos = { x: start.tx, y: start.ty };
    this.tilesPerSec = tilesPerSec;
    this.rand = mulberry32(seed);
    const onMutation = () => {
      this.dirty = true;
    };
    // Any mutation invalidates plans; version compare in tick() dedupes.
    const subs = [
      grid.events.on('placed', onMutation),
      grid.events.on('removed', onMutation),
      grid.events.on('moved', onMutation),
      grid.events.on('expanded', onMutation),
      grid.events.on('door', onMutation),
    ];
    this.unsubscribe = () => subs.forEach((u) => u());
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  currentTile(): Tile {
    return { tx: Math.round(this.pos.x), ty: Math.round(this.pos.y) };
  }

  requestMove(target: Tile, opts?: { allowNonWalkableGoal?: boolean }): PathResult {
    this.target = { ...target };
    this.allowNonWalkableGoal = opts?.allowNonWalkableGoal === true;
    this.pendingBlock = false;
    const res = this.plan();
    if (res.status !== 'ok') {
      this.path = [];
      if (res.status === 'blocked') {
        this.state = 'blocked';
      }
    }
    return res;
  }

  stop(): void {
    // Finish the current step (if mid-step, snap forward to the next center), go idle.
    this.target = null;
    this.path = this.path.slice(0, 1);
    if (this.path.length === 0) this.state = 'idle';
  }

  /** Pure tick; caller supplies dt in seconds (must be <= MAX_LIVE_CATCHUP). */
  tick(dtSec: number): WalkerEvent[] {
    if (dtSec > MAX_LIVE_CATCHUP) {
      throw new EngineError(
        'live-catchup-exceeded',
        `Walker.tick dt=${dtSec}s > MAX_LIVE_CATCHUP=${MAX_LIVE_CATCHUP}s — route through offline settlement`,
      );
    }
    const events: WalkerEvent[] = [];

    // Blocked walkers retry on every grid change (spec §4.5).
    if (this.state === 'blocked' && this.dirty && this.target) {
      this.dirty = false;
      const res = this.plan();
      if (res.status === 'ok' && this.path.length > 0) {
        this.state = 'moving';
        events.push({ type: 'resumed' });
      }
    }
    if (this.state !== 'moving' || this.path.length === 0) return events;

    let remaining = dtSec * this.tilesPerSec * this.segmentSpeed;
    while (remaining > 0 && this.path.length > 0) {
      // Re-validate before each tile-step commit if the grid changed (§4.5).
      if (this.dirty && !this.pendingBlock) {
        this.dirty = false;
        if (this.plannedVersion !== this.grid.version) {
          const inFlight = this.path[0];
          const res = this.plan();
          if (res.status !== 'ok') {
            if (this.atCenterOf(inFlight) || tileEq(this.currentTile(), inFlight)) {
              // Already at (or rounding to) a center: freeze right here.
              this.pos = { x: this.currentTile().tx, y: this.currentTile().ty };
              this.path = [];
              this.state = 'blocked';
              events.push({ type: 'blocked', at: this.currentTile() });
              return events;
            }
            // Mid-step: finish drifting to the next center, THEN freeze —
            // canPlace guarantees no cell under a walker gets occupied.
            this.path = [inFlight];
            this.pendingBlock = true;
          } else if (this.path.length === 0) {
            break;
          }
        }
      }
      const next = this.path[0];
      remaining = this.advanceToward(next, remaining);
      if (this.atCenterOf(next)) {
        this.pos = { x: next.tx, y: next.ty }; // exact snap
        this.path.shift();
        this.segmentSpeed = 1 + (this.rand() * 2 - 1) * SPEED_NOISE;
        events.push({ type: 'step', tile: { ...next }, dir: this.facing });
        if (this.pendingBlock) {
          this.pendingBlock = false;
          this.path = [];
          this.state = 'blocked';
          events.push({ type: 'blocked', at: { ...next } });
          return events;
        }
        if (this.path.length === 0) {
          this.state = 'idle';
          this.target = null;
          events.push({ type: 'arrived', tile: { ...next } });
        }
      }
    }
    return events;
  }

  /**
   * Corner-rounded visual position (tile space): blends a quadratic curve within
   * CORNER_RADIUS of interior waypoints. The logical path stays pure 4-dir.
   */
  renderPos(): Vec2 {
    if (this.state !== 'moving' || this.path.length < 2) return { ...this.pos };
    const corner = this.path[0];
    const dx = this.pos.x - corner.tx;
    const dy = this.pos.y - corner.ty;
    const dist = Math.abs(dx) + Math.abs(dy); // manhattan — motion is axis-aligned
    if (dist >= CORNER_RADIUS) return { ...this.pos };
    // Quadratic bezier: incoming point at radius, corner center, outgoing point at radius.
    const after = this.path[1];
    const t = 0.5 * (1 - dist / CORNER_RADIUS); // 0 at radius edge -> 0.5 at corner
    const inX = corner.tx + (dx === 0 ? 0 : Math.sign(dx) * CORNER_RADIUS);
    const inY = corner.ty + (dy === 0 ? 0 : Math.sign(dy) * CORNER_RADIUS);
    const outX = corner.tx + Math.sign(after.tx - corner.tx) * CORNER_RADIUS;
    const outY = corner.ty + Math.sign(after.ty - corner.ty) * CORNER_RADIUS;
    const u = t;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    return {
      x: a * inX + b * corner.tx + c * outX,
      y: a * inY + b * corner.ty + c * outY,
    };
  }

  private atCenterOf(t: Tile): boolean {
    return Math.abs(this.pos.x - t.tx) < ARRIVE_EPS && Math.abs(this.pos.y - t.ty) < ARRIVE_EPS;
  }

  private advanceToward(next: Tile, budget: number): number {
    const dx = next.tx - this.pos.x;
    const dy = next.ty - this.pos.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    // Facing follows the dominant motion component; at a center it keeps its
    // previous value (never degrades to a default mid-path).
    if (Math.abs(dx) > ARRIVE_EPS) this.facing = dx > 0 ? 'SE' : 'NW';
    else if (Math.abs(dy) > ARRIVE_EPS) this.facing = dy > 0 ? 'SW' : 'NE';
    if (dist <= ARRIVE_EPS) return budget;
    const step = Math.min(budget, dist);
    this.pos.x += (dx === 0 ? 0 : Math.sign(dx)) * Math.min(step, Math.abs(dx));
    this.pos.y += (dy === 0 ? 0 : Math.sign(dy)) * Math.min(step, Math.abs(dy));
    // Bob phase advances with distance walked (step-synced shamble, spec §6.3).
    this.bobPhase += 2 * Math.PI * 1.6 * (step / Math.max(this.tilesPerSec, 0.001)) * (this.tilesPerSec / 1.1);
    return budget - step;
  }

  private plan(): PathResult {
    if (!this.target) return { status: 'invalid' };
    const from = this.currentTile();
    if (tileEq(from, this.target) && this.atCenterOf(this.target)) {
      this.path = [];
      this.state = 'idle';
      const t = this.target;
      this.target = null;
      return { status: 'ok', path: [t] };
    }
    const res = findPath(this.grid, {
      from,
      to: this.target,
      allowNonWalkableGoal: this.allowNonWalkableGoal,
    });
    this.plannedVersion = this.grid.version;
    if (res.status === 'ok') {
      this.path = res.path.slice(1); // drop current tile
      this.segmentSpeed = 1 + (this.rand() * 2 - 1) * SPEED_NOISE;
      this.state = this.path.length > 0 ? 'moving' : 'idle';
    }
    return res;
  }
}
