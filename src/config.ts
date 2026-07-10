// ── Brand ────────────────────────────────────────────────────────────────────
// Centralised so the rebrand (task: rename the app) is a one-file change.
export const BRAND = {
  name: 'Zombie Cafe',          // working title — final brand chosen during rename pass
  version: '0.1.0',
  tagline: 'Cook. Serve. Infect. Expand.',
};

// ── Canvas ───────────────────────────────────────────────────────────────────
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 600;

// Vertical-slice tuning. The ported dish data carries the original game's real
// (idle-scale) cook times — up to 8 hours. For a demoable slice we compress time
// so the loop is visible in seconds; DEMO_TIME_SCALE is the single knob.
export const DEMO_TIME_SCALE = 120; // 1 real second = 120 in-game seconds

// ── Palette (spooky diner: charcoal + toxic green + blood red) ───────────────
export const PALETTE = {
  bgTop: 0x141821,
  bgFloor: 0x1d2230,
  floorTile: 0x232a3a,
  floorTileAlt: 0x1f2534,
  wall: 0x2a3142,
  toxic: 0x7ee081,
  toxicDark: 0x3f8f52,
  blood: 0xc0392b,
  brains: 0xe08fb0,
  coin: 0xf2c14e,
  panel: 0x11151d,
  panelEdge: 0x2c3547,
  text: 0xe8ecf2,
  textDim: 0x8891a4,
  customer: 0xd9c9a8,
  stove: 0x394253,
  ready: 0xf2c14e,
} as const;
