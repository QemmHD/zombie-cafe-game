# Screenshot capture log

Captures live in `current/` (regenerate with `npm run shoot`). These are OUR
original-rendered scenes — used to diff against `docs/reference-analysis.md` via
`docs/visual-comparison-checklist.md`.

## Baseline — before Stage 3 (visual shell) — states: starter/busy/dirty/cooking/foodReady/eating/infection/selected
Honest read of the current build vs. the checklist (this is the work Stage 3+ fixes):

**Passing already**
- Characters have volume + directional facing + contact shadows (Stage 2.2).
- Tables/chairs/appliances have top/front/side planes; seated diners occluded by table tops.
- Selection ring, ready (SERVE) marker, queued chair bubbles, carried plate in-hand.

**Failing (Stage 3 targets)**
- ❌ No exterior road / grass / sidewalk framing (café sits on a flat dark plane).
- ❌ Walls/floor too clean — no cracks, slime drips, stains, smears, grime decals.
- ❌ HUD is DOM (not captured here) and is not the maroon scalloped style.
- ❌ Surfaces lack hand-drawn texture/noise — still reads a bit vector-clean.
- ❌ No tutorial chef / chalkboard panels / arrows (separate stage).

NOTE: node-canvas captures the **world canvas only**; HUD/store/cookbook/raid DOM
panels must be screenshotted from a real browser via `#debug` (debug menu) or
`#demo=<state>`.
