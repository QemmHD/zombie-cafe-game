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


// ── Palette (spec 95: the original's bright daylight cartoon + macabre accents)
export const PALETTE = {
  bgTop: 0x848688, // daylight asphalt beyond the lot
  bgFloor: 0xd6d6d4,
  floorTile: 0xd6d6d4,
  floorTileAlt: 0xcfcfcd,
  wall: 0xf5ec74,
  toxic: 0x5cb544, // zombie green, punchier in daylight
  toxicDark: 0x3f8f52,
  blood: 0xc0392b,
  brains: 0xe08fb0,
  coin: 0xf2b13c,
  panel: 0xfaf3e0, // warm cream card
  panelEdge: 0x8a6f4d, // toasted brown border
  text: 0x3a2c1c, // dark chocolate text on cream
  textDim: 0x8a7a62,
  customer: 0xd9c9a8,
  stove: 0xe8e8e6,
  ready: 0xf2b13c,
} as const;
