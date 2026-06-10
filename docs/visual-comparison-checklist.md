# Visual Comparison Checklist

Run this against every screenshot in `artifacts/screenshots/current/` before a
screen is called done. Score each line; a screen passes only when its row in the
target matrix has no ❌ on the relevant items.

## Composition
- [ ] Café fills the screen (not a small diorama floating in black).
- [ ] Exterior road / grass / sidewalk frames the room.
- [ ] Top HUD matches the maroon scalloped density (name, stars, level, XP, $, toxin, badge).
- [ ] Bottom panel reads as a chalkboard slab in a wood frame (when present).
- [ ] Left side icons are large, illustrated, with count/alert badges.

## Art
- [ ] Objects show top / front / side planes (not flat icons).
- [ ] Characters have directional poses (face walk/interaction target).
- [ ] Characters look hand-drawn (thick uneven outlines, shading) — not flat vector.
- [ ] Grime present: cracks, slime, stains, smears, texture/noise.
- [ ] Contact shadows ground every character and object.

## Gameplay readability
- [ ] I can tell what is selected (ring/highlight).
- [ ] I can tell what is ready (✓ / glow / marker).
- [ ] I can tell what needs attention (! marker / red).
- [ ] I can tell where to tap (arrow / highlight in tutorial).
- [ ] I can tell which screen I'm on.

## Reference similarity
- [ ] Feels like an old-school undead-café tycoon.
- [ ] Looks like a complete mobile-game shell, not a prototype.
- [ ] Avoids clean/minimal/vector UI primitives.

## Per-capture record
For each capture, note: file, demo-state, date, which checklist items fail, and
the fix planned. Keep this as a running log under each stage's commit message or
in a short `artifacts/screenshots/LOG.md`.
