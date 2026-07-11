// src/engine/IsoConfig.ts — the single place these numbers exist in the repo.
// (Spec 01 §2.1 — THE canon. Tools/artconfig.json is generated from / CI-checked
// against these exports. Any restated literal elsewhere is a review-blocking defect.)

export const TILE_W = 128; // full diamond width
export const TILE_H = 64; // full diamond height (2:1)
export const HALF_W = 64;
export const HALF_H = 32;

export const WALL_H = 192; // back-wall height above the floor line (3 "tile heights")
export const WALL_SECTION_W = 64; // one tile edge projects to exactly 64px horizontally
export const WALL_SECTION_H = 224; // 32 base rise + 192 wall height

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.0;
export const DEFAULT_FIT_ZOOM_FLOOR = 0.75;
export const TAP_VS_PAN_PX = 8;
export const CAMERA_MARGIN_PX = 96;

// Callers must never feed Walker.tick more than this many seconds of live dt;
// larger gaps route through offline settlement first (spec 01 §6.4).
export const MAX_LIVE_CATCHUP = 5;
