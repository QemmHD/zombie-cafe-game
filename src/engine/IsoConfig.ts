// src/engine/IsoConfig.ts — the single place these numbers exist in the repo.
// (Spec 01 §2.1 — THE canon. Tools/artconfig.json is generated from / CI-checked
// against these exports. Any restated literal elsewhere is a review-blocking defect.)

// Authentic projection (spec 95): the original's floor diamond measures
// 164x105 px — a 1.56:1 ratio, steeper than classic 2:1. We use 84x54 (1.556:1,
// within 0.4%) for integer half-extents and seam-free tiling.
export const TILE_W = 84; // full diamond width
export const TILE_H = 54; // full diamond height (~1.56:1, the original's angle)
export const HALF_W = 42;
export const HALF_H = 27;

// Measured from the original starting-cafe frame: wall height ≈ 1.97 tile widths.
export const WALL_H = 160; // back-wall height above the floor line
export const WALL_SECTION_W = 42; // one tile edge projects to exactly HALF_W px
export const WALL_SECTION_H = 187; // 27 base rise + 160 wall height

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 2.2;
export const DEFAULT_FIT_ZOOM_FLOOR = 0.9; // the room FILLS the screen, like 2011
export const TAP_VS_PAN_PX = 8;
export const CAMERA_MARGIN_PX = 96;

// Callers must never feed Walker.tick more than this many seconds of live dt;
// larger gaps route through offline settlement first (spec 01 §6.4).
export const MAX_LIVE_CATCHUP = 5;
