# Presentation ground truth (primary-source research, 2026-07-11)

Source: the preserved decrypted iOS bundle (Internet Archive item "zombie-cafe",
final v1.13) — sprite atlases, `.anim` skeletal files, `Strings_EN.bin`,
`ItemData.bin` decoded. Extracted reference images + full bundle listing were
studied in-session. Secondary: launch-week TouchArcade thread, Fandom wiki,
period reviews. Also: github.com/dark-chocolate-enjoyer/zombie-cafe-revival-android
(reverse-engineered Android revival; NO license — reference only, never copy code,
and its embedded game files are Capcom's — never import).

**These facts supersede guesses in canon/specs where they conflict. Apply via a
canon amendment (change-control §18), not silent edits.**

## Corrections to apply

1. **Tile projection: ~1.56:1, NOT 2:1.** Original diamond art = 164x105 px, one
   art tile spans 2x2 grid cells → cell ≈ 82x52.5 px (edge angle ≈ 32.6°). Our
   128x64 (2:1) reads flatter than the original. DECISION NEEDED: retune
   IsoConfig to 164x105-per-2x2 (engine is parameterized; tests recompute) —
   schedule with the art regen, one atomic change.
2. **Street is BEHIND the cafe** (runs past the two back walls, visible at the
   top corners): sidewalk + curb + asphalt with a yellow lane stripe. **Grass
   apron in FRONT** (tombstones etc. are outdoor decor placed on grass). Current
   build has the street in front — flip it; front strip becomes lawn.
3. **The door is a WALL ITEM on a back wall** (`wall_031_doorClose`/`032_doorOpen`,
   with open/close sound) — customers walk in through the back-wall door from the
   street side. Canon's front-edge door was a guess; flip using the documented
   change surface (spec 01 §3.2). Customers on the street behind → through door.
4. **Starter look:** off-white square tiles with gray grout; walls are a single
   white panel RUNTIME-TINTED (starter = yellow) with a metallic top cap; grime
   is separate placeable/removable decal content (stains, rat tile, slime,
   boarded windows) — cleaning it up IS the early decoration loop. Floor
   "tiles" are 2x2-cell patterns; floors/walls painted per-tile with touch-drag.
5. **Characters are skeletal cutout puppets** (11 parts + tray part, head ~95px
   of ~120px total — bobblehead), thick outlines, **two drawn facings only**
   (SW front / NW back, mirrored for SE/NE). walk=39f, serve=16f, eat=58f,
   transform=89f, rise=8f. No drop-shadow ellipses under characters.
   Furniture also rotates only 2 ways.
6. **Framing:** room fills ~80-90% of frame; drag-to-scroll, no pinch-zoom in
   v1 (scroll vs item-drag shared a gesture — period annoyance we deliberately
   fix via TAP_VS_PAN_PX arbitration). Max room 17x16.
7. **Edit:** no mode — touch-hold lifts any item anytime; context menu offers
   rotate (2-way), sell, store (storage unlimited). "This location is invalid."
   feedback; drag-painting for tiles/walls. Blocked-door tutorial confirms
   pathing rules ("clear path between the serving area, the door, and each of
   the chairs").
8. **One chair per table, one customer per table; waiters serve by table
   adjacency.** Seat derivation should cap at one seat per table.
9. **Extras:** chunky bitmap display font; jazzy soundtrack + stingers;
   happy-yellow / frowning-blue thought bubbles; star rating upper-left,
   blinks green/red.

## Priority order for the correction pass
(1) street-behind + grass-front + back-wall door (scene/layout flip);
(2) starter floor/wall recolor (white tile + yellow tinted walls + grime decals);
(3) one-seat-per-table rule; (4) tile-ratio retune with art regen;
(5) skeletal 2-facing puppet rigs (replaces single-sprite characters);
(6) thought bubbles + font + audio.
