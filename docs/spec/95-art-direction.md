# 95 — Art direction bible (measured from the decrypted original bundle)

Primary sources: the preserved decrypted ZombieCafe.app (Internet Archive,
v1.13) — App Store screenshots (`s1-s3`, `starting_cafe`), decoded floor-tile
atlas, wall panels, character part sheets, plus the outdoor tile strip
(`tiles_row`: grass / asphalt / sidewalk+curb / yellow-stripe / white floor /
rat decal). Capcom assets are measurement + style REFERENCE ONLY — everything
we ship is our own generated art. This doc supersedes prior guesses.

## The look, in one line
Bright daylight flat-cel cartoon: near-white tile floor, lemon-tinted walls,
vivid lawn, gray street with a yellow curb stripe, simple bold furniture in
white/teal/navy, bobblehead paper-doll characters with thin dark outlines —
grime exists only as removable JOKE DECALS (rat, stains, boards), never as
baked texture.

## Measured geometry (drives src/engine/IsoConfig.ts)
- Floor diamond: 164x105 px in the original atlas → **1.56:1 projection**,
  steeper than classic 2:1. We ship 84x54 per cell (within 0.4%).
- One cell's art shows a **2x2 sub-tile pattern** (four sub-diamonds with thin
  grout + soft bevel). Furniture occupies whole cells (table = 1 cell).
- Wall height ≈ **1.97 tile widths** (starting-cafe frame: wall 150 px vs tile
  76 px) → WALL_H 160 @1x. Wall art is a **WHITE panel tinted at runtime**
  (the original's own technique; starter tint lemon `#f5ec74`).
- Character height ≈ **1.12 tile widths** (85 px vs 76) → CHAR_H 94 @1x.
  Bobblehead: the head is ~45% of total height; stubby legs.
- Framing: the starter room fills the screen nearly edge-to-edge; bigger
  cafes overflow and drag-scroll. Fit = min(fit-width, fit-height), floor 0.9.

## Measured palette
| surface | hex |
|---|---|
| floor tile base / hi / shade | #d6d6d4 / #e4e4e2 / #b8b8b6 |
| grout | #a8a8a6 |
| wall tint (starter lemon) | #f5ec74 (art stays white #f4f4f2) |
| grass base / dark clumps / blades | #557722 / #415128 / #698c25 |
| sidewalk / shade / curb | #cccccb / #bbbbbb / #656567 |
| asphalt / speckle | #888888 / #999999 |
| street stripe (curb line) | #c2b064 |
| door frame / leaf | #46505b / #7991a1 |
| HUD cream / border / text | #faf3e0 / #8a6f4d / #3a2c1c |
| coins / toxin green | #f2b13c / #5cb544 |

## Style rules (all generated sprites)
1. Flat cel: base color + ONE soft shade per surface. No gradients, no
   painterly texture, no baked grime or noise.
2. Thin, clean, dark outlines everywhere.
3. Bright, saturated, cheerful — the comedy is the zombies, not the lighting.
4. Furniture: simple geometric silhouettes (white stove + silver pot of green
   stew, white square tables/chairs, teal-top navy-front counters, teal sink).
5. Characters: 6-part cutout puppets (huge head, small torso, arms, stub
   legs), two facings via mirror; procedural walk/sit/eat poses.
6. Shadows: soft, tight, low-alpha (0.13-0.18) — grounding, never blobs.
   (Deliberate deviation: the original drew none; our sprites need them.)

## Regeneration pipeline
- Room surfaces: `Tools/build_room_art.py` (procedural, exact geometry+palette).
- Furniture: Higgsfield nano-banana with the STYLE block in
  `Tools/prep_flat_furniture.py` provenance → white-trim → `public/art/`.
- Characters: parts sheets → `Tools/build_puppets.py` (slice, rig, preview)
  → `public/art/puppets/` + `src/data/puppets/*.json`.
