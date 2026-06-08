# Drop-in art

Put PNG sprites in this folder and the game uses them automatically. Any file
that's missing simply falls back to the built-in (code-drawn) art, so you can
replace pieces one at a time.

**Only add art you have the rights to use** (your own, commissioned, or a pack
whose license permits it — e.g. CC0 / public domain). Don't add ripped assets
from another game.

## Files the game looks for

Each sprite faces the camera, drawn standing on its "feet" (bottom-center is the
ground point). Transparent background (PNG). Roughly 2:1 isometric friendly.

| File | What it replaces | Suggested size (px) |
|------|------------------|---------------------|
| `zombie.png`      | zombie staff       | ~120 × 150 |
| `customer.png`    | human customer     | ~120 × 150 |
| `table.png`       | dining table       | ~140 × 110 |
| `stove.png`       | stove appliance    | ~140 × 150 |
| `grill.png`       | grill appliance    | ~140 × 150 |
| `oven.png`        | oven appliance     | ~140 × 150 |
| `decor_plant.png` | spooky plant       | ~100 × 120 |
| `decor_lamp.png`  | gore lamp          | ~100 × 140 |
| `decor_rug.png`   | bloody rug         | ~140 × 70  |
| `decor_juke.png`  | creepy jukebox     | ~120 × 160 |

The exact pixel size doesn't matter — each sprite is scaled to a fixed on-screen
height (see `SPECS` in `js/assets.js`); only the **aspect ratio** matters. Tweak
the heights there if a sprite sits too high/low or too big/small.

## How it works
`js/assets.js` preloads these files at startup. When a sprite is present, the
renderer draws it feet-anchored at the tile; otherwise it draws the procedural
version. Floors and walls are still procedural for now.
