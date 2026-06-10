# Art Style Bible — *Rotten Spoon* (original undead-café tycoon)

The rulebook. Every screen and sprite is implemented against this. Goal: a
grimy, chunky, hand-drawn **2.5D** comedic-horror mobile tycoon — **original art**
that captures the *feel* of the reference without copying any asset/name/logo.

## A. World style
- **Cutaway isometric room**: two back walls meeting at a corner, **open front
  edge**, 2:1 iso floor of gray tiles.
- **Exterior framing** (non-negotiable): the room sits on a block — **road with
  yellow centre-lines**, **sidewalk slabs**, **grass** with noise texture around
  the building. The café must NOT float in black.
- **Grime**: wall **cracks, claw gashes, boarded planks, green slime drips, brown
  stains**; floor **smears, blood/grease decals, the odd rat**. Deterministic by
  position so it's stable for screenshots.
- **Tone**: comedic horror. Gross but funny.

## B. Sprite style (the anti-"paper doll" rules)
- Hand-drawn 2.5D: **thick (≈4–6% of sprite) dark, slightly uneven outlines**.
- Every form shows **top (light) / side+front (dark)** planes; round forms use a
  shaded-sphere look (clip + offset dark + upper-left highlight).
- **Contact shadow** under every character and object.
- Slightly imperfect edges + a subtle grain/texture overlay. No flat vector fills.

## C. Character rules
- **Big heads, small bodies**, visible **ears, nose, jaw, hair silhouette**,
  **hands**, **shoes**.
- **4 directions**: down-left, down-right, up-left, up-right (procedural: flip on
  X + front/back head + part offsets). Characters face **walk dir / interaction
  target / stove while cooking / table while serving / enemy while attacking**.
- **Zombies**: green/gray skin w/ shaded jaw, **droopy yellow dead eyes**, hunched,
  messy hair, uneven arms, drool; **chef toque + apron** for cooks; raider poses.
- **Humans**: varied hair/clothes/skin; expressive; seated/eating/scared/angry/
  recruitable poses.

## D. UI style
- **Top HUD**: **maroon/burgundy scalloped bar** (rounded drip bumps), cream bold
  outlined text. Holds: café name, star rating (dim→purple-filled), level chip,
  XP bar, **$cash**, **toxin**, round **logo coin** at right.
- **Left rail**: large **illustrated sticker icons** (store, cookbook, raid map,
  staff, tasks, …) with **count badges / red "!" alerts**.
- **Bottom panels**: **chalkboard slab in a wood frame**, white + **green** chalk
  text. Used for tutorial dialogue, selected unit/object status, cooking, build/
  placement, raid actions, loot.
- **Buttons**: primary = **green** (beveled, press-animated); close/cancel = **red
  X**; back = red arrow; destructive = red.
- **Popups**: dark framed board + **pinned torn-paper card(s)** w/ red pushpins;
  big bold title; green OK/SHARE; red X. Used for level-up, loot, recipe unlock,
  reviews, tutorial.
- **Textures**: chalk scratches, worn/torn paper, pushpins, wood-frame bevels,
  faint stains. Avoid clean rectangles.

## E. Screen family (all share the language above)
home café · tutorial (chef guide) · cooking flow · cookbook · build store ·
placement · expansion · infection · roster/cold-storage · fridge/loot ·
review board · level-up popup · raid map · raid battle · options.

## F. Palette (originals — not copied)
- bg/outside grass `#3f5a2e`, road `#6f7268`, road-line `#e8c34a`, sidewalk `#9aa0992`
- floor tiles `#8b9088 / #7c827a`, grout `#5f655d`
- walls warm `#c9b24a` (left) / `#a8902f` (right); enemy walls maroon `#5a2228`
- zombie skin `#7fcf57` / shade `#5aa83f`; dead-eye yellow `#e9d24a`
- HUD maroon `#6e1f24` w/ darker rim `#4a1418`; chalkboard `#1c1f1a` in wood `#5d3f28`
- accents: green `#7cff5a`/`#4a9c39`, blood/red `#d8413a`, gold `#ffcf4d`, toxin purple-green
- outline `#15160f`

## G. Implementation approach (keep the existing engine, fake the 3D)
Procedural canvas sprites with shared helpers (`volBall`, `volRR`, `limb`,
`shade`, contact-shadow, grime decals) layered bottom-up; depth-sort by base Y;
DOM for HUD/panels styled to the language above. Sprite-sheet generation is
optional later; not required to hit the look.
