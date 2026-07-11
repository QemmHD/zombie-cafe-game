// ── Brand ────────────────────────────────────────────────────────────────────
// Centralised so the rebrand (task: rename the app) is a one-file change.
// The single source of truth for the app's brand. Renaming the game = editing here.
// Shortlisted alternatives: Ghoulash · Grave Grub · Rot & Serve · Necro Nosh · Rigor Bistro
export const BRAND = {
  name: 'Deadbeat Diner',
  version: '0.1.0',
  tagline: "The staff's undead, and the service is to die for.",
};

// ── Canvas ───────────────────────────────────────────────────────────────────
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 600;


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
