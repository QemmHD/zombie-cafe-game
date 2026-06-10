# Screenshot capture log

Captures live in `current/` (regenerate with `npm run shoot`). These are OUR
original-rendered scenes — used to diff against `docs/reference-analysis.md` via
`docs/visual-comparison-checklist.md`. Now **landscape** (844×390 @ dpr2).

> The harness renders the `<canvas>` WORLD only. The DOM shell (maroon HUD, left
> rail, blackboard panels) is verified by code + viewable live in a browser via
> `#debug` / `#demo=<state>` (node-canvas can't rasterize the DOM).

## Stage 3 — Global Visual Shell — PASS (world) / CSS-only (shell)
States captured: starter / busy / dirty / cooking / foodReady / eating / infection / selected.

**Now passing (world canvas — screenshot-proven)**
- ✅ Café no longer floats in dark space — sits in a city block.
- ✅ Exterior **road** (asphalt + dashed yellow line ring) visible.
- ✅ **Sidewalk** ring (concrete + slab seams + cracks) visible.
- ✅ **Grass** with blade/noise texture frames the block.
- ✅ **Floor grime**: worn tiles, slime/grease stains, cracks, debris (deterministic).
- ✅ **Wall grime**: cracks, boarded patch, slime drips, brown stains, chipped plaster.
- ✅ **Cutaway depth**: wall top thickness + corner AO + floor front-edge drop.
- ✅ Appliance grime: greasy stove drip, dirty green sink water, counter side face.
- ✅ Landscape composition fills a wide screen, café framed by the block.

**CSS-only this pass (verify in browser — not in node-canvas captures)**
- ✅ Top HUD redesigned: **maroon scalloped** bar, level coin, stars, XP bar w/
  text, cream currency chips w/ green "+" buttons, round logo badge.
- ✅ Left **rail**: chunky tilted sticker buttons w/ alert-badge support.
- ✅ Bottom **blackboard** language: sheets/toolbar/buildbar = dark slate in wood
  frame; **red X** close, **green** action buttons.

**Still partial / next stages (not Stage 3)**
- 🟡 Object polish is light — full 2.5D appliance redraw is Stage 4.
- ⬜ Tutorial chef + chalkboard dialogue + arrows = Stage 5.
- ⬜ Store tray / placement ghost / cookbook / raid map+battle / panels themed = Stages 6–9.

## Stage 3.5 + Stage 4 — presentation fill + sprite/object volume
- 3.5: world canvas fills the screen; HUD/rail/toolbar overlay it; grass base
  (no dark corners); café large + readable.
- 4 (characters): body-type **build** scale per customer type (worker big, elder
  small, oddball biggest), **ears**, **hands**, thicker head outline, better
  shoes, per-zombie **skin-tint** variation. Directional facing + occlusion
  already in from 2.2/3.
- 4 (appliances): new **fridge** prop (front/side/top + handle + grime), sink
  with dirty green water, counter side face, greasy stove. All grounded.

**Still partial (Stage 4 polish to continue):** true hand-drawn outline wobble is
light (thicker, not wobbly); cooking/cleaning have gesture poses but not full
pose animation; customer outfit variety is mostly shirt+hat+build (not unique
garments yet).

## Orientation
App + IPA now **landscape** (manifest `orientation:landscape`; build workflow
forces `UISupportedInterfaceOrientations` to LandscapeLeft/Right on iPhone+iPad).
