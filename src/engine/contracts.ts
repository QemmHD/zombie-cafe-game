// Canonical re-exports (spec 01 §9.3): consumer code imports engine contracts
// from here; paraphrased local copies of these shapes are review-blocking.

export type { Vec2, Tile, AABB, Dir } from './types';
export { DIR_DELTA, DIRS, EngineError, clamp, tileEq } from './types';

export * from './IsoConfig';

export {
  tileToWorld,
  worldToTileF,
  worldToTile,
  roomBounds,
  rightWallSectionTopLeft,
  leftWallSectionTopLeft,
} from './iso/IsoMath';

export type {
  Cell,
  FootprintItem,
  ItemCatalog,
  GridEvents,
  LayoutSchema,
  Placement,
  PlacementId,
  PlaceCheck,
  RemovalCheck,
  RepairRecord,
  Rot,
  Seat,
  WallDecorId,
  WallDecorPlacement,
  WallSide,
} from './grid/CafeGrid';
export { CafeGrid, FLOOR_DEFAULT, WALL_DEFAULT, starterLayout } from './grid/CafeGrid';

export type { PathQuery, PathResult, WalkSource } from './path/Pathfinder';
export { findPath } from './path/Pathfinder';

export { BAND, characterSortKey, entityDepth, furnitureSortKey } from './depth';

export type { WalkerEvent, WalkerState } from './move/Walker';
export { Walker } from './move/Walker';

export {
  CUSTOMER_ANGRY_SPEED,
  CUSTOMER_SPEED,
  DEFAULT_SPEED_STAT,
  RAIDER_FLEE_SPEED,
  zombieTilesPerSec,
} from './move/speed';

export type { PuppetPose, PuppetStyle } from './anim/puppetPoses';
export { REST_POSE, eatPose, idlePose, walkPose } from './anim/puppetPoses';

export { mulberry32 } from './rng';
export { Emitter } from './events';
