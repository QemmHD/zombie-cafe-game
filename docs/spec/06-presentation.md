# presentation

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# Presentation System Spec — Deadbeat Diner
**Art bible · modular asset plan · character animation · UI kit · settings · input arbitration · VFX · audio · juice · mobile ergonomics**

Status: implementation-ready, **revision 2 (post-hostile-review)**. Companion to the isometric-engine spec. This revision's headline change: this spec no longer *restates* any cross-system constant — it *consumes* canon (§0) — and it picks up ownership of the presentation-adjacent gaps the review found unowned (settings, input-mode arbitration, empty states, asset-failure UX, return hooks, seasonal reskins, art licensing log, browser matrix).

---

## 0. Canon & authority (read first)

The review's root disease was six specs restating the same constants. This spec now declares exactly what it **owns** and what it **consumes by reference**. A generated `docs/spec/canon.md` + `src/sim/tuning.ts` + `src/engine/IsoConfig.ts` registry is the structural fix (recommended to the build-order owner as a pre-implementation reconciliation deliverable); until it exists, the authorities below are binding.

### 0.1 This spec OWNS (single authority)
- Art bible, palette, typography (§2)
- All asset canvases, anchors, prompts, atlas packing, and the generation pipeline (§4–§7, §14)
- Character **production strategy** (paper-doll rig + one-shot gag sheets, §6) — the iso-engine spec §11's per-character 4-direction frame-sheet requirement is **superseded**; iso §11's character row must be amended to "rig parts sheets per presentation spec; engine emits `Dir` only" (its escalation hatch — hand-picked walk frames for chef + 2 hero zombies — is retained here as the quality fallback)
- UI kit incl. Settings panel (§7.6), empty states (§7.7), string table / i18n decision (§7.8)
- Input-mode arbitration — the pointer mode stack (§8)
- VFX/juice/audio inventories (§9–§11)
- Return-hook presentation: tab title, favicon badge, notification copy (§12)
- Seasonal reskin mechanism (§13)
- Asset-failure/degradation UX and placeholder fallbacks (§14.5)
- The unified download-budget file (§14.6) — supersedes both this spec's old 8MB gate and the build order's 1.5/2.5MB gate

### 0.2 This spec CONSUMES (by reference — numbers below are cited for convenience; the cited module is authoritative and a CI equality check enforces it)
| Constant / model | Authority | Value at time of writing |
|---|---|---|
| `TILE_W×TILE_H`, `WALL_H`, wall-section geometry, roomBounds | `src/engine/IsoConfig.ts` (iso-engine spec §2.1/§2.5) | 128×64 tile; **WALL_H 192**; wall section **64×224 @1×** (see §3 — this revision fixes this spec's previous 160/128×224 values, which were wrong) |
| Depth bands & comparator | `src/engine/depth.ts` (iso-engine spec) | never restated here; §4.3 names bands symbolically |
| Camera zoom clamps, pan inertia | `IsoConfig` | ZOOM_MIN/MAX per IsoConfig (engine's 0.4–2.0, default 1.0); this spec's old 0.5–1.5 is deleted |
| Walk speeds | `src/sim/speeds.ts` — Staff spec's Speed-stat formula is canon | `zombieTilesPerSec = 0.45 + 0.09×Speed`; `CUSTOMER_SPEED`, `ANGRY_SPEED`, `FLEE_SPEED` constants live there. §6.4 derives *cadence* from these, defines no speeds of its own |
| Star rating | Progression spec: `R = clamp(S+D+B, 0..100)`, displayed as R/20 stars | star meter (§7.1) renders this scale; the 0–1000 and 0–50 scales are dead |
| Dish catalog (names, ids, stats) | the reconciled dish canon (single generator; see Review notes RN-3) | dish icons are **id-keyed and name-agnostic** (§7.3) |
| Zombie roster | `src/data/zombies.json` (Infection spec §4) | launch cast (§6.6) is drawn from it; CI: every chars-atlas id ∈ zombies.json |
| Expansion ladder / room dims | `src/data/expansion.json` (7×8 → 17×16 endpoints) | world-size math in §3 uses 17×16 |
| Unlock ladder, tutorial rewards, Toxin ledger | Progression spec / `quests.json` / Toxin ledger §5.4 | Settings/store UI shows locks from it, defines none |
| Offline/pause semantics, MAX_LIVE_CATCHUP, clocks | simulation-core / OfflineEngine spec | §7.1 welcome-back and §8 modal-pause *render* its outputs |
| Save schema versions | build-order save ledger (`docs/spec/save-ledger.md`) | this spec references "fields land at the milestone's version," never a number |
| Touch-target minimum | one UX-constants entry (this spec proposes **48 px**; recorded once in canon) | 44 px references elsewhere must be updated to cite it |

**CI checks added by this spec (from M1, not the art milestone):** `Tools/artconfig.json` deep-equals `IsoConfig` exports; every manifest frame id resolves to a catalog entry (zombies/dishes/furniture); placeholder frames exist in every atlas; budget file respected; per-asset CREDITS entry exists.

---

## 1. Purpose & scope

Replace the current presentation — one baked 1600×893 backdrop JPG plus three static cutouts moved by tweens — with a modular, grid-native art system that renders: per-tile floors and per-section back walls on the 2:1 diamond grid (7×8 starter → 17×16 endgame); ~40 launch furniture sprites snapped to `furniture.json` footprints (517× 1×1, 54× 2×2, 19× 2×1, 12× 1×2); living characters (shamble, seat/flee, dispatch, infection collapse-and-rise, CENSORED feral gag); the original's recognizable UI modernized for touch; and layered feedback on every interaction.

Out of scope: gameplay rules and engine internals. In scope: every asset, its exact dimensions and anchors, how it is generated/packed/loaded, how it fails (§14.5), and how it must feel.

### 1.1 Fidelity notes vs the original
| Original (researched) | This remake |
|---|---|
| Iso "diorama room": tiled floor + two visible back walls; wall decor hangs on them | Identical camera concept, composed procedurally from tile/wall/decor sprites |
| Hand-drawn horror-comedy; grimy starter diner glowing up to marble/stainless | Locked as the art bible (§2); grime→luxury via floor/wall data variants |
| Gore behind a comic CENSORED bar + crunch SFX + bone pile | Reproduced exactly (§6.5, §9) |
| Chunky tap UI: bottom 7-tab store, star meter blinking green/red, thought bubbles, floating coins/XP | Reproduced with modern touch sizing, no dark patterns (§7) |
| Door visibly set into a **back wall**; customers walk in from it | Reproduced (§4.2); see Review notes RN-6 for the resolved cross-spec contradiction |
| "Moves as slowly as the shuffling undead" | Locomotion cadence slow (§6.4, driven by canonical speeds); input acknowledgment snappy per pacing pillar |
| Landscape phone game | Landscape-authentic, portrait-playable (§15) |
| Currencies Cash + Toxin (vials of zombie serum; never "Brains") | All UI copy/icons use **Cash** ($) and **Toxin** (green vial). `PALETTE.brains` and 🧠 retired |

### 1.2 Deviation & cross-reference log (new — items the review found silently dropped)
Presentation is where several researched items were *drawn but not mechanized*, or vanished entirely. Each is now logged with an owner:

| Researched item | Status & owner |
|---|---|
| **Magic Fridge — 30 vials, one free dish/day** | Sprite ships here (§5.1). The free-dish-per-day rule is a required earned-Toxin sink: **service-loop spec must add it** (daily local-clock grant of one cookless serving batch of any unlocked dish, chosen from the fridge panel). Flagged as a canon TODO; the sprite does not ship enabled-but-inert — if the rule isn't landed by the fridge's store unlock, the store card is level-locked with "coming soon" copy, never a dead purchase |
| **Toxin-upgradeable special stoves** (research: some cookbooks need special stoves "bought with Cash and upgraded with Toxin") | Progression owns the mechanic (upgrade tiers as Toxin sinks unlocking cookbook access). Presentation ships **two visual states per themed stove** — base and toxin-upgraded (toxic-green rim light + vial gauge decal) — as a recolor/overlay bake, not bespoke art (≈0 extra generation cost) |
| **Industrial Barrel of Zombie Serum** (50 vials; boosts zombie endurance) | Sprite added to the Special-tab backlog (§5.1, P6). Mechanic → Infection/Staff spec (persistent energy-drain modifier; a premium earned-Toxin sink). Logged so the sink isn't lost |
| **Outdoor decor** (researched Special tab: "pets, outdoor decor, expansion") | **Deferred, logged deviation.** The remake has no exterior view; the original's outdoor items decorated the entry surround. Plan: a future "porch strip" — 1×N decor row rendered outside the door wall — noted as a post-1.0 candidate. The Special tab's category list still reserves the slot (empty state per §7.7) so the store structure stays fidelity-shaped |
| **Friends/social layer** — 3rd recipe source (order/share from friends) + friend-milestone Toxin (1/3/10 friends = +1 vial each) | Cut is justified (no backend) but was never replaced. **Progression spec must add the single-player substitute** (recommended: a weekly *Traveling Vendor* who parks at the door and offers 1 orderable recipe + a small vial milestone track — same faucet magnitude as the researched friend milestones). Presentation reserves the deliverables: vendor character (1 rig), door-knock beat, vendor offer card UI. Logged as a deviation until specced |
| **Seasonal/event cafes** (Christmas Cafe's Pina Collider; Tiki update drops) | Not silent anymore: cheap local-clock plan in §13; event-rare acquisition decision belongs to progression/raids canon |
| **Original 2011 dish names** (Mystery Meat, Sloppy 'Joe', Gello Mold…) | Ownership: the dish canon + `docs/spec/licensing.md`. Presentation is name-agnostic (§7.3). See RN-3/RN-19 |
| **Away-rating green/red star blink in the welcome-back report** | Now explicitly a presentation deliverable (§7.1 welcome-back row): the report shows the offline rating delta with the signature green/red star blink, rendered from OfflineEngine's settlement output |

---

## 2. Art bible

One page every generated asset is judged against. Derived from the strongest existing asset, `cafe_bg.jpg` (survives as **menu/marketing art only** — never the play surface).

### 2.1 Style pillars
1. **Hand-drawn cartoon, 2.5D isometric.** Confident outlines, painterly-flat fills, one soft shading pass. No photorealism, no pixel art, no cel gradients.
2. **Horror-comedy, never horror.** Cute-gross zombies: droopy eyes, lolling tongues, missing patches — no viscera, no realistic wounds. Violence resolves behind the CENSORED bar.
3. **Grimy-diner palette that can glow up.** Starter assets stained/cracked/flickering; premium variants clean/saturated/polished. Same silhouette language so upgrades read as *the same world, richer*.
4. **Readable at gameplay zoom.** Every sprite reads at 60% scale on a 360 px-wide phone. Silhouette first; ≤3 focal details per 1×1 prop.

### 2.2 Palette (extends `src/config.ts PALETTE`)
| Token | Hex | Use |
|---|---|---|
| ink | `#1a1216` | Outlines (never pure black) |
| charcoal | `#141821` / `#1d2230` | Ambient darks, room void |
| floorBase | `#232a3a` / `#1f2534` | Default floor pair |
| wall | `#2a3142` | Default wall field |
| toxic | `#7ee081` | Toxin, infection FX, zombie skin key |
| toxicDark | `#3f8f52` | Zombie skin shadow, toxin glass |
| blood | `#c0392b` | Accents, sad/anger, star-down |
| coin/ready | `#f2c14e` | Cash, ready glow, star-up |
| meat | `#d98873` | Dish meats, comic gore stand-in |
| bone | `#e8e0cd` | Bone piles, plates, teeth |
| neon | `#ff5f8f` | Signage, premium sparkle secondary |
| text / textDim | `#e8ecf2` / `#8891a4` | UI type |

Rules: zombie skin always in the toxic family; human skin never. Cash feedback always coin-gold; Toxin always toxic-green; these channels never cross. **Accessibility corollary (§7.6, §10): color is never the *only* channel — every green/red state also carries a glyph or signed number.**

### 2.3 Light, line, texture
- **Global key light: upper-left, ~35° elevation.** Shadow side lower-right. Baked contact shadows forbidden — the engine renders the shared elliptical contact shadow (§5.4).
- **Line weight:** 4–6 px on 2× masters, tapering allowed; `ink`, warmed toward fill on interior lines.
- **Texture:** grunge stamps on starter tiers; premium tiers clean. No noise overlays >8% opacity.

### 2.4 Typography & iconography
- **Display:** *Lilita One* (OFL, self-hosted woff2 ~25 KB). **Body:** *Nunito* Regular/Bold (OFL, latin subset). **Logo only:** *Creepster* (OFL).
- **Counters:** bitmap font baked from Lilita One at 32 px (digits + `$ + - ×` + vial glyph) for allocation-free count-ups.
- All `fontFamily:'monospace'` usages and all emoji replaced by these fonts + drawn icons (§7.5). Minimum in-game text size 13 px @1× UI scale.
- **All strings route through the string table (§7.8)** — no inline literals in components.

---

## 3. Canonical metrics (consumed from IsoConfig — corrected)

Defined once in `src/engine/IsoConfig.ts`; `Tools/artconfig.json` is a generated mirror and **CI fails if they differ** (check lands at M1). Values cited here for the art team's convenience:

| Constant | Value | Notes |
|---|---|---|
| `TILE_W × TILE_H` | **128 × 64 px** @1× | 2:1 diamond. 17×16 room = (17+16)·64 = **2112 px** wide, (17+16)·32 = 1056 px floor height |
| Master scale | **2×** (256×128 tile) | All generation at 2×; build emits @1× and keeps @2× for high-DPR |
| `WALL_H` | **192 px** @1× *(corrected from this spec's previous 160 — the engine's §2.5 derivation with corner-point equations and AC-3 wins)* | roomBounds minY = −32 − 192 = −224 per engine math |
| Wall section canvas | **64 × 224 @1×** (128×448 @2×) — one section per tile edge *(corrected from 128×224: one tile edge projects to exactly 64 px horizontally in the 128×64 system; the old 128-wide canvas was geometrically wrong)* | 192 px visible wall + 32 px base skirt tucking behind the floor row |
| Character height | **~152 px** @1× standing (±8 px per body type) | ≈1.2 tile-widths; footprint 1×1; feet anchor |
| Camera zoom | per `IsoConfig` (0.4–2.0, default 1.0) | at min-landscape (640×360) the clamp guarantees ≥9 tile-columns visible |
| DPR | render at `min(devicePixelRatio, 2)` | @2× textures serve DPR ≥1.5 |

**Nothing ships that wasn't authored against IsoConfig.** A floor tile PNG is exactly 256×128 @2×. A wall section is exactly 128×448 @2×. Deviation = rejected by `register_sprite.py`.

---

## 4. Room surface assets (retires `cafe_bg.jpg` as play surface)

### 4.1 Floor tiles — 20 data variants, 8 at launch
- **Canvas:** 256×128 @2×, full diamond bleeding to edges, alpha outside.
- Each variant: **2-tile A/B pair** (checker/wear alternation) + **1 grime overlay** (starter tiers only) → 3 textures/variant.
- Launch set (8): `floor_white_tile`, `floor_checker`, `floor_wood_plank`, `floor_concrete_cracked` (starter default), `floor_carpet_red`, `floor_marble`, `floor_gray_tile`, `floor_diner_deco`. Remaining 12 fast-follow.
- **Prompt template:** `"single isometric floor tile, 2:1 diamond shape filling the canvas, [material], hand-drawn cartoon, dark grimy diner style, muted [palette tokens], soft top-left lighting, bold dark outline, flat game asset, no perspective distortion, transparent background"` → remove_background → `Tools/tile_fit.py` projective-snaps the diamond to the exact 256×128 quad (reject if corner-detection error >4 px).
- Static floor baked to a `RenderTexture` per room-size change; single-tile repaints redraw only that tile.

### 4.2 Wall sections — 50 data variants, 8 at launch (geometry corrected)
- Two back walls: **NW** (upper-left edge) and **NE** (upper-right edge). One section spans **one tile edge**.
- **Canvas: 128×448 @2× (64×224 @1×)**: 192 px @1× visible wall + 32 px base skirt. Authored in the NW parallelogram orientation; NE is the mirrored render (`flipX`) — one asset serves both walls. Corner geometry per iso-engine §2.5 (the equations and AC-3 there are the authority).
- Each variant: **1 base section + 1 end-cap column piece** (16 px @1× wide) for outer corners → 2 textures/variant.
- Launch set (8): `wall_plaster_stained` (starter), `wall_white`, `wall_brick`, `wall_wood_panel`, `wall_tile_green`, `wall_striped`, `wall_stone`, `wall_diner_chrome`.
- **Door (resolved: BACK wall, fidelity).** `wall_door_double` spans **2 wall sections = 128×224 @1× (256×448 @2×)**: saloon double doors + `OPEN` sign, set into a back wall (NW or NE) at the grid's door edge tile. +1 `door_open` overlay frame for the swing on entry/exit. The original's door is visibly part of the back wall and customers walk in from it; the iso-engine spec must be amended in the same commit that lands wall art: §3.2 door validation flips to back edges (`tx==0 or ty==0`), the starter door moves accordingly, the spawn walk-in offset normal points into the room from the wall, and the engine's door AC updates. A **P0 gate** (§17) requires one screenshot-check against original gameplay footage before any wall art is generated — this is the cheapest possible insurance on a resolved-by-argument contradiction. See RN-6.
- Wall-decor anchor convention: wallDecor sprites (107 in data; 6 at launch) authored face-on in the wall's parallelogram skew (SkewY = ±atan(0.5) = ±26.57°), each with manifest `wallAnchor: {section, heightPx}`.

### 4.3 Room composition order (symbolic bands — numerals live in `src/engine/depth.ts` only)
`floorRT (BAND_FLOOR) → walls + wallDecor (BAND_WALL) → tile cursor/ghost (BAND_CURSOR) → dynamic sorted entities: furniture + characters + carried plates (BAND_ENTITY, comparator from the engine) → overhead FX/bubbles (BAND_FX) → screen-space HUD (scrollFactor 0)`. This spec never restates band numerals or the comparator formula; the old magic constants (−1000/5000/6000/9000) are deleted with this system.

---

## 5. Furniture sprites — 40 at launch (of 602 catalog)

### 5.1 Launch manifest (counts by `furnitureType`)
| Type | Launch count | Items |
|---|---|---|
| stove (0) | 4 | basic pot stove (1×1), grill (2×1), stainless range (1×1 premium), cauldron (1×1). **Themed/special stoves (progression's cookbook stoves) each get 2 visual states: base + toxin-upgraded (rim-light overlay bake, §1.2)** |
| table (1) | 4 | basic white square, round diner, long table (2×1), premium gray |
| chair (2) | 4 | basic white, red vinyl, stool, premium gray (all 1×1) |
| counter (5) | 3 | serving counter (2×1), corner counter (1×1), premium steel (2×1) |
| sink (4) | 2 | basic sink (1×1), double sink (2×1) |
| fridge (3) | 2 | basic fridge (1×1), **magic fridge** (1×1, glowing — mechanic cross-ref §1.2) |
| decor (7) | 12 | plant, dead plant, trash can, jukebox, arcade cabinet (1×2), fountain (2×2), vending machine, ATM, skeleton statue, candelabra, rug (2×2 flat), bone pile |
| wallDecor (9) | 6 | window, clock, drink poster, fine painting, neon "EAT" sign, fish tank |
| floor/wall variants | (§4) | — |
| **Total placeable sprites** | **≈40** (incl. door + open-state variants) | |

Backlog additions from the deviation log (P6+): **Industrial Barrel of Zombie Serum** (1×1, Special tab), Traveling Vendor cart prop, seasonal door overlays (§13). Recolor economy: HSL palette-swap at build time for simple variants; only premium/star-bonus variants get bespoke art.

### 5.2 Canvas sizes @2× (trim at pack time; author on fixed canvases)
| Footprint | Canvas @2× | Max art height |
|---|---|---|
| 1×1 | 320×448 | ≤384 px above baseline |
| 2×1 / 1×2 | 448×512 | authored 2-wide; 1×2 = mirrored render where design allows, else bespoke |
| 2×2 | 576×640 | fountains, clusters |

### 5.3 Footprint anchor convention (the load-bearing rule)
- Every master is authored standing on its **footprint diamond** (projected diamond of its w×h tiles), bottom vertex at a fixed guide position.
- `Tools/register_sprite.py` records `pivot: {x,y}` (projected footprint center at ground level within the trimmed PNG) + `footprint: {w,h}` from `furniture.json.size`.
- Runtime: `sprite.setOrigin(pivot)`, position = `IsoMath.tileToWorld(anchor.x+(w-1)/2, anchor.y+(h-1)/2)`. Depth via the engine comparator. **No per-sprite nudge constants**; a wrong-sitting sprite gets its manifest pivot fixed, not the code.
- Facing: authored front-facing (SE); edit-mode mirror (flipX) is the free "rotate"; true 4-orientation art out of scope (matches original).

### 5.4 Shared contact shadow
One 128×64 @1× radial ellipse, `ink` at 30% alpha, auto-attached under every character and non-flat furniture piece, scaled to footprint.

### 5.5 Prompt template (furniture)
`"[item description], isometric game furniture sprite, viewed from the front-left at 2:1 isometric angle, hand-drawn cartoon with bold dark outlines, grimy diner horror-comedy style, muted palette with [accent], lit from upper left, single object, no floor, no shadow, transparent background"` → remove_background → register footprint pivot. Always attach 2 approved prior furniture sprites for style lock.

### 5.6 Placeholder fallback (new — unillustrated-but-reachable content must not be invisible)
Only 40/602 furniture and 64/320 dishes ship illustrated at launch, but the catalogs are fully reachable. Rules:
- **Furniture without art:** a footprint-sized crate sprite (1 per footprint class, 4 textures total) with a stenciled "?" decal and the item's name label in placement/store UI. Functional furniture (stove/table/chair/counter/sink) *must* have real art before its store unlock level — CI cross-checks unlock level ≤ max illustrated level per type.
- **Dishes without icons:** a generic covered-plate icon (cloche) + dish name text everywhere an icon appears.
- **Characters without sheets:** base body-type rig (slim/regular/heavy generic limbs) + a generic head; roster/pedia show the silhouette treatment.
- CI: every atlas contains its placeholder frames; every catalog id resolves to either real art or a placeholder rule.

---

## 6. Characters — sprite strategy, rigs, and sheets

### 6.1 The core decision: hybrid cutout-rig + one-shot frame sheets (unchanged; now the cross-spec authority — see §0.1)
Image models cannot reliably produce 6+ consistent frames across calls, and the roster (~105 occupations × human+zombie forms × states) makes hand-frame production explode. Decision:
1. **Locomotion, idle, carry, cook, flee = procedural cutout rig ("paper-doll").** One layered parts sheet per facing; engine assembles 6 parts on a micro-rig (Phaser containers + tweened rotations) driven by shamble parameters. Per-zombie speed comes from the canonical speed formula for free; ~200 KB/character vs ~1.5 MB of frames.
2. **Signature one-shot gags = short generated frame sheets** (single grid image per gag = internally consistent frames): infection collapse-and-rise, feral CENSORED attack, eating.

### 6.2 Facings
**2 authored facings + flipX = 4 iso directions.** `SE` (front-quarter) → flipX = SW; `NE` (back-quarter) → flipX = NW. Asymmetric costume details authored center-safe or accepted mirrored (original did the same). Path-follower picks facing per segment from tile delta.

### 6.3 Rig anatomy (per facing)
6 parts on one 1024×1024 @2× parts sheet: `head` (incl. neck), `torso` (incl. pelvis), `arm_near`, `arm_far`, `leg_near`, `leg_far`; manifest stores joint pivots; `prop` socket on `arm_near` (plate, spoon, dish). Standing height 152 px @1×; feet baseline = container origin (0.5, 1.0). Parts-sheet prompt as before (grid-separated parts, 3/4 view, reference-portrait conditioning); 1 call per facing per form.

### 6.4 Locomotion parameters (visual cadence only — speeds are consumed, not defined)
**This section defines zero speeds.** Travel speed comes from `src/sim/speeds.ts` (§0.2): zombies `0.45+0.09×Speed` tiles/s (the Speed 1–12 stat is load-bearing, per Staff spec); customers/angry/flee from its exported constants. This spec derives the *look* from whatever speed the sim reports:

| Param | Zombie | Human customer | Fleeing |
|---|---|---|---|
| Step cadence | `stepPeriod = 1/(2×tilesPerSec)` (two steps per tile) | same formula on CUSTOMER_SPEED | same on FLEE_SPEED |
| Body sway | ±5° torso roll, sine | ±2° | ±8° + arms-up pose |
| Bob | 3 px per step | 2 px | 4 px |
| Arm swing | +18°/−10° asymmetric (one arm dangles) | ±20° symmetric | raised, jitter ±4° |
| Head | 2° lag behind torso | fixed | shake |
| Foot drag | shuffle scuff + dust puff every 2nd step | none | rapid taps |

The design intent stands — zombies shamble, humans stride, layout distance matters — but the numbers making that true live in the speed module and its tuning review, not here. Dispatch acknowledgment stays instant (§10) even though travel is slow.

### 6.5 One-shot frame sheets (per character *form*, SE facing only — gags play toward camera)
| Gag | Frames | FPS | Canvas/frame @2× | Notes |
|---|---|---|---|---|
| `infect_collapse_rise` | 8 | 10 | 320×384 | human crumples (3f) → toxin puff covers swap → zombie rises (5f) |
| `feral_attack` | 6 | 10 | 448×384 | frames 3–6 mostly covered by the CENSORED bar — deliberately low consistency demand |
| `eat` (seated) | 4 loop | 6 | 320×384 | chomp cycle |
| `cook_stir` | rig-driven | — | — | arm_near ±25° @0.7 s + steam VFX |

Generation: one call per gag (grid sheet + character reference). Post-process: fixed-grid slice → per-frame auto-trim → feet-baseline re-registration (`Tools/register_frames.py`; reject if silhouette centroid drifts >6 px @2×). Budget 2–4 retries per sheet.

### 6.6 Launch character roster (regenerated from the Infection spec's actual data — the previous list of original-Capcom occupation names is deleted)
The Infection spec deliberately replaced the original roster with 105 custom archetypes and logged that deviation; this spec now casts from **that** data. Launch cast = **Chef (player avatar, zombie-form only)** + **12 occupations selected from `zombies.json` by the Infection spec's tier tables (§4.1–4.5): the 4 lowest-minStars Free-tier commons + 4 representative Cash-tier + 4 representative Toxin-tier entries**, chosen at P0 by querying the data, not by naming them here (so this spec can never drift from the catalog again). CI: every id in the chars-atlas manifest exists in `zombies.json`.
- Per occupation: parts sheets 2 facings × 2 forms = 4 calls; one-shots infect(1) + feral(1) + eat(1) = 3 calls ≈ **7 calls/occupation**; cast ≈ **90 calls total**.
- Scale-out: 3 base body types (slim/regular/heavy) established across the 12; later occupations reuse limbs and regenerate only `head`+`torso` (4 small calls each) — the 105-occupation target costs ~⅓ of naive per-character cost.
- Zombie skin `toxic`/`toxicDark`; runtime 1-of-4 hue-rotate accent (±8°) prevents clone-look.

### 6.7 Character interaction affordances
Selected server: 8 px `toxic` outline glow + ground selection ring. Infectable customer (tapped in **default mode**, §8): occupation nameplate + cost chip. UI-band overlays, never baked into sprites.

---

## 7. UI kit (the original's chrome, modernized)

All UI on a `scrollFactor(0)` layer; 9-slice panels; every interactive element ≥48×48 CSS px (the canonical touch minimum, §0.2).

### 7.1 Components & sizes (@1× UI scale; UI scales 1.0–1.4 by viewport)
| Component | Size / spec |
|---|---|
| **HUD top bar** | left: star meter; center: cafe name/level + XP bar (240×14); right: Cash chip + Toxin chip (116×40 each, icon 28 px + bitmap counter). Chips pulse 1.0→1.12→1.0 (180 ms) on change |
| **Star meter** | 5 stars 28 px + partial fill, rendering **R/20 stars from the canonical 0–100 rating**; blinks green flash on gain, `blood` flash on loss, **always accompanied by a signed floating delta number** (accessibility: never color-only) |
| **Bottom store drawer** | collapsed 64 px handle; expanded 38% viewport (max 320 px). **7 tabs**: Featured · Decor · Utility · Furniture · Walls/Floors · Special · Storage. Tabs 88×56 icon+label; item carousel of 112×132 cards (render, price chip, star-bonus chip); disabled/unaffordable = 40% desat + lock icon + level number — never hidden |
| **Cookbook modal** | 88% viewport, max 720×480. Left: dish list (15-slot Favorites row pinned). Right: 6-stat block (Level, Price, Cook Time, Servings, Total Earnings, XP) + profit/hr line; COOK button ≥200×56 showing price; burn-window note |
| **Thought bubbles** | 56×48 bubble + 8 emotion glyphs (happy, hearts, angry, zzz, dish-order, coin, skull-panic, question). Pop in 140 ms Back.out, bob 2 px |
| **Zombie roster panel** | rows 320×72: portrait 56 px, name, Energy bar (toxic fill **+ bolt icon state at ≤15%** — not color-only), Tips/Speed/Power pips, state tag |
| **Infect confirm sheet** | bottom sheet 320×180: portrait, occupation, stat preview, cost button (Free / $N / N-vials), cancel. Tier color-coded **+ tier glyph** |
| **Toasts** | 3-slot stack, top-center, reflow on expiry; 320×44 |
| **Dialogs/panels 9-slice** | 48 px corner, panel fill, 2 px border, 8 px radius |
| **Buttons** | primary (coin-gold), toxic, danger, ghost. Press 0.94 scale + 60 ms darken. Heights 56/48/40 px |
| **Placement/edit chrome** | ghost 60% alpha, `toxic` valid / `blood` invalid **+ check/cross glyph on the ghost** (colorblind-safe); footprint diamond projected; confirm ✓ / mirror ⇄ / store buttons 56 px orbiting |
| **Welcome-back report** | modal rendering the **OfflineEngine settlement output**: per-stove outcomes with collect buttons, coins earned, staff incidents, **and an away-rating delta row whose stars blink green (gained) / red (decayed) — the researched signature return beat** |
| **Settings panel** | §7.6 |
| **Vendor offer card** (reserved) | ships with progression's social-substitute mechanic (§1.2) |

### 7.2 UI asset bill
1 atlas (`ui.atlas`, 2048², ~64 frames): 9-slice panels (4), buttons (4×3 states), 7 tab icons, 8 thought glyphs, currency icons, star (full/empty/partial), ~16 misc icons (lock, storage box, energy bolt, XP flask, clock, flame, path-blocked, check, cross, mirror, close, info, settings, bell/notification, download/export, upload/import), chip frames, drawer handle, bubble, toast frame, placeholder cloche + crate decal. Icon prompt: `"flat game UI icon, [subject], bold outline, single color accent on dark panel background, cartoon horror-comedy, transparent background"`.

### 7.3 Dish icons — 64 at launch (of 320) — **id-keyed, name-agnostic**
- **Canvas 256×256 @2×**, fixed composition: dish on plate/pot, 30° from above, centered, 12% rim margin. Used in cookbook, stove bubbles, carried-plate prop (48 px), serve FX.
- **The icon set is keyed to dish *ids* in the reconciled canonical `dishes.v2.json`** (one generator, one owner — see RN-3). Launch = dishes reachable by the launch level band per that canon + 4 marquee rares. Whether those ids carry the original 2011 names or licensing-safe homage names at the same pun register is decided in `docs/spec/licensing.md` + the dish canon — **not here**; icon prompts describe the *food*, not the name, so the art survives any rename.
- Prompt: `"cartoon food dish icon for a zombie diner game: [dish visual description from catalog], served on a chipped white plate, slightly gross but comical, hand-drawn, bold outlines, muted palette with one [meat/toxic] accent, 3/4 top-down view, centered, transparent background"`. Packs 8×8 into one 1024² @1× atlas. Unillustrated dishes use the cloche placeholder (§5.6).

### 7.4 (merged into 7.2)

### 7.5 Icon replacements for emoji
🧟 → zombie-head icon; 🧠 → retired (Toxin vial); `▲ ENTRANCE ▲` text → the actual door asset (§4.2).

### 7.6 Settings panel (NEW — this spec owns the settings registry; needed by M8b, seeded from M3)
One modal, gear icon in HUD. Persisted in the save (fields land per the build-order save ledger). Sections:

| Group | Controls | Notes |
|---|---|---|
| **Audio** | Master mute; Music / SFX / Ambience sliders (0–100) | wired to AudioManager channels (§11.3) |
| **Motion & comfort** | Reduced motion (disables screenshake, feral vignette, parallax, camera nudges; large tweens become fades); Screen shake (separate toggle, off implied by reduced motion) | juice table (§10) marks which rows degrade and to what |
| **Visual** | Quality tier: Auto / Low / High (Low: particle budget 60, no postFX outline — pre-baked glow instead, DPR clamp 1); Colorblind assist (shifts red/green state pairs toward blue/orange; glyph+number redundancy is always-on regardless); UI scale override | |
| **Notifications** | Opt-in local notifications: dish ready; burn T-minus-30 min | presentation copy in §12; trigger logic owned by service loop |
| **Gameplay (purist toggles)** | Aggro ring off (raids); Retaliation opt-out (owned by raids spec; *surfaced* here); Audio cues as toasts (burn ticking etc. mirrored as captioned toasts) | each toggle's mechanic is owned by its system spec; this panel is the single UI home |
| **Data** | Export save (downloads JSON); Import save (file picker + validation + confirm); **Copy my stats** (local anonymized aggregates → clipboard, feeds the feedback link — see telemetry note below); Reset save (double confirm + forced auto-export first) | Export/Import/Reset available from **M3**, not M11 — players have real saves from day one |
| **Language** | English (only) | see §7.8 |
| **About** | version/build hash, credits link, licensing disclaimer link, feedback link | |

**Telemetry decision (recorded here as the settings owner; canon should mirror it):** the game ships **zero analytics** — no beacons, no counters, nothing phones home. This is a stated feature on the About panel ("This game collects nothing."). Balance tuning post-launch relies on (a) the deterministic sim's internal test harness and (b) the voluntary **Copy my stats** button, which serializes local lifetime aggregates (levels/day, dishes cooked, burns, toxin earned/spent) for players to paste into feedback. Risk-table lines in other specs claiming post-launch "tuning from data" must be amended to cite this mechanism.

### 7.7 Empty states (NEW — every panel's zero-data render)
| Surface | Empty state |
|---|---|
| Storage tab, nothing stored | crate illustration + "Nothing stashed. Long-press furniture to store it." |
| Fridge, no stolen dishes | frosty shelf + "Raid a rival cafe to stock this fridge." (level-gated copy pre-raid-unlock: "Unlocks with raids at cafe L{n}.") |
| Zombiepedia at 0/105 | full silhouette grid + "??? — every customer you meet is listed here." (states per Progression's 4-state model, which owns the pedia; this spec renders it) |
| Roster with only the Chef | Chef row + dashed ghost-row: "Infect a customer to grow your crew." |
| World map before unlock | grayed map + padlock + unlock level |
| Store Featured/Special stubs (pre-content milestones) | "Fresh horrors arriving soon" shelf art — tabs are never blank white |
| Favorites row, none pinned | 15 dashed slots + "Pin dishes from the cookbook." |

### 7.8 Strings & i18n decision (NEW)
**English-only at launch; all UI strings centralized** in `src/ui/strings.ts` (typed key → string map; components never inline literals). This costs nothing now and makes later localization a data task. String keys are also what the toast/caption accessibility mirror (§7.6) consumes. Decision logged; full i18n (fonts with extended coverage, RTL) explicitly out of scope for 1.0.

---

## 8. Input-mode arbitration (NEW — the pointer mode stack)

Every spec claims taps (dispatch, infect, stove panel, placement, camera). One stack, defined here, consumed by all scenes. Top-most mode consumes world input; camera pan/pinch works in every world mode (a drag exceeding the 12 px threshold cancels the pending tap; pinch always zooms).

**Stack (top wins):**
1. **System modal** (settings, welcome-back, cookbook, infect sheet, any dialog) — captures all input; scrim tap / Esc / close button pops it. Per simulation-core, full-screen modals pause the customer/energy sim, never cook wall-clocks.
2. **Placement/edit mode** (entered by long-press 350 ms on furniture or store-card drag) — world taps manipulate the ghost; ✓/⇄/store buttons act; Esc or ✗ exits; taps on other entities are ignored (no accidental infect while decorating). Entering placement clears any selection.
3. **Selection mode** (a zombie is selected) — the next world tap is a **dispatch command**: tap stove/counter/sink/table → assign task; tap floor tile → move; **tap a customer → dispatch-move to a tile adjacent to that customer (serve intent) — it does NOT open the infect card** (the ambiguity the review flagged, now resolved: while a zombie is selected, the player's mental verb is "go there"). Tap the selected zombie again, tap HUD, or Esc → deselect. Successful dispatch auto-deselects.
4. **Default mode** — tap customer → infect card; tap stove → stove panel; tap zombie → select (enter mode 3); tap furniture → info chip; drag → pan; wheel/pinch → zoom.

**Raids:** RaidScene is a separate scene with its own two-mode stack (command mode / retreat confirm) built on the same primitives; it never coexists with cafe modes. Raid pause-on-hidden per simulation-core.

**Cancellation matrix:** opening any panel → clears selection; entering placement → clears selection; expansion/door relocation event → force-exits placement mode and clears selection (grid revalidation happens before input resumes — ordering owned by the engine's `expanded` event contract). Esc pops exactly one level. Keyboard: Tab/Enter traverse panel controls; Esc as above; R mirrors in placement (extends the engine's existing bindings).

---

## 9. VFX inventory

One `fx.atlas` (1024², 14 textures ≤128 px): soft round particle, coin, coin-shine streak, toxin droplet, toxin puff ring, steam wisp ×3, dust mote, heart, anger spark, star, sparkle, bone ×2, smoke blob, CENSORED bar (240×64 letterbox, white "CENSORED", 9-sliceable).

| Effect | Composition | Trigger (event names per the canonical events map — see RN-13) |
|---|---|---|
| **Coin fly** | 3–7 coins arc (bezier, 420 ms) world→Cash chip; chip pulse + count-up | any Cash gain |
| **Coin burst** | 8-particle radial + `+$N` floating text (36 px rise, 700 ms) | serve moment |
| **Toxin puff** | 12 droplets + ring, 500 ms; screenshake 2 px 120 ms (**skipped under reduced motion**) | infection swap; Toxin spend |
| **Steam** | 2-emitter wisp loop, 3/s | stove cooking |
| **Ready glow** | pulsing additive gold halo + bubble bounce | stove ready |
| **Burn** | steam→gray smoke; blacken tint ramp over final 10% of burn window; fizzle burst on expiry | burn countdown/expiry |
| **CENSORED gag** | bar slides over feral frames 3–6, jitters 4 px per crunch, exits leaving bone-pile decal (fades 20 s) | feral attack |
| **Infection rise** | ground crack + toxin puff + 6 sparkles | infect frames 4–8 |
| **Sparkles** | 4-point twinkles ×3–5 | premium placed; star gained; variation unlock |
| **Dust step puffs** | 1 mote / 2nd shamble step | walking |
| **Hearts / anger** | hearts rise; anger sparks | satisfaction events |
| **Level-up** | banner drop + star burst + 16-particle confetti | cafe level |
| **Star blink** | HUD star flash green/red **+ signed delta number always** | rating change |
| **Path-blocked emote** | "!"+crossed-boots bubble + 3 px headshake | blocked path |

Phaser 3.90 `ParticleEmitter`s from `fx.atlas`; budget ≤200 live particles (≤60 on Low tier); emitters pooled.

---

## 10. Juice inventory — every interaction and its feedback

Rule: **every tap acknowledged ≤100 ms** with motion + sound minimum; state changes get motion + VFX + audio. Timings ms. **RM column = behavior under reduced-motion** (— = unchanged; the audio layer is never removed by RM).

| Interaction | Motion | VFX | Audio | RM |
|---|---|---|---|---|
| Tap button/card | 0.94 squash 60↓/120↑ | — | ui_tap | — |
| Tap idle stove | pot squash; drawer slide 220 Back.out | — | ui_drawer_open | slide→fade |
| Confirm cook (pay) | price chip flies HUD→stove (380) | coin trail; steam starts | cash_register + sizzle | chip fades in place |
| Cook progress | lid rattle 1 px @2 Hz | steam | sizzle (ducked −8 dB) | — |
| Dish ready | pot bounce 6 px; bubble pop 140 | ready glow | dish_ready_ding | — |
| Burn warning (last 10%) | bubble shake ±2 px | smoke ramp | ticking (**mirrored as toast if "audio cues as toasts"**) | shake off |
| Dish burns | pot blackens 200 | fizzle, smoke | burn_fizzle + sad_trombone | — |
| Tap server (select) | 1.06 pop; outline on | ground ring | zombie_groan 1–3 round-robin | — |
| Tap destination (dispatch) | 60 ms anticipation lean, walk | tile flash | ui_tap + shuffle steps | — |
| Blocked path | headshake ±3 px ×2 | "!" emote | error_thunk | shake off, emote stays |
| Plate delivered | plate arc-hop 240 | coin burst +$N; coin fly | plate_serve + coin | — |
| Customer seats | chair scoot 4 px; sit swap | order bubble | chair scuff | — |
| Customer eats | eat loop | occasional hearts | slurp (30%) | — |
| Leaves happy | 1.08 bounce; exits | hearts; coin fly | happy_chime | — |
| Leaves angry | red flush 300 | anger sparks; star-down blink+number | sad_trombone | — |
| Tap customer (infect offer, default mode) | camera nudge 8 px (200) | nameplate+cost pop | infect_gurgle | nudge off |
| Confirm infect | collapse-rise (800) | toxin puff; crack; roster toast | gurgle → rise_from_dead | shake off |
| Feral attack | feral sheet + panic | CENSORED jitter; bone pile; flee | censored_crunch ×3 + scream | jitter/vignette off; bar static |
| Place furniture | ghost→solid settle 1.1→1.0 (180) | dust ring; sparkles if premium | place_furniture thud | — |
| Invalid placement | ghost shake ±4 px | blood flash **+ cross glyph** | error_thunk | shake off, glyph stays |
| Expand room | camera pull-back; tiles flip-reveal diagonal wave (30/tile) | edge dust | rumble + star_up | wave→fade |
| Rating change | star flash + signed number | floating ±star | star_up/down | — |
| Level-up | banner 320 Back.out | burst + confetti | stinger (bgm ducks −10 dB 1.5 s) | — |
| Toxin earn/spend | vial pulse; count-up | droplet fly | glass plink | — |
| Offline return | welcome-back slide-up **incl. away-rating blink row** | per-stove glints | soft chime | slide→fade |
| Camera pan/zoom | 90 ms ease-out inertia; rubber-band 0.3 | — | — | — |

Counters never snap (300 ms eased count-up). All tweens on transform/alpha only.

---

## 11. Audio plan

### 11.1 Inventory
**Music (2):** `bgm_cafe_loop` 70–90 s spooky-playful swing/lounge (theremin/organ + upright bass + brushed kit, seamless loop); `stinger_levelup` 3 s. Raid loop deferred with raids. **SFX (26):** as enumerated in §10. **Ambience (2):** ambient_room (flies + distant kitchen, very low), neon_buzz (spatial-ish by camera distance).

### 11.2 Sourcing & licensing
Priority: (1) CC0 packs (Kenney; freesound CC0 filters); (2) generated audio if CC0 misses the tone; (3) jsfxr for stylized blips. **License log `public/audio/CREDITS.md` is mandatory and CI-checked**: every file lists source, license, date. Nothing CC-BY-NC, nothing unlicensed. (Art gets the identical treatment — §14.4.)

### 11.3 Tech
- Phaser WebAudio; unlock on first pointer gesture (splash "tap to open the diner" doubles as unlock — required for iOS Safari, §15.3).
- One audio sprite (`audiosprite` → sfx.ogg + sfx.m4a + JSON). Budgets: SFX ≤700 KB ogg; bgm ≤1.2 MB ogg 96 kbps; dual ogg+m4a for Safari.
- `AudioManager` (src/audio/): channels {music, sfx, ambience} with volumes + master mute persisted via Settings (§7.6); `duck(db, ms)`; pooled SFX with per-key max-poly (coin ≤4) and ±4% pitch jitter; subscribes to the **canonical events map** (RN-13) — it consumes event names, never defines them. Never autoplays before gesture.

---

## 12. Return hooks & background presentation (NEW)

The burn-window retention engine needs cues, not player memory. Trigger logic (when a stove is READY, T-minus thresholds) is owned by the service-loop spec; this spec owns every *presentation* surface:
- **Tab title cycling while hidden:** alternates game name with the most urgent stove line every 4 s — "Ready in 12m — Deadbeat Diner" / "READY! Burns in 3h 12m". Copy from the string table; a drawn-favicon glyph, no emoji.
- **Favicon badge:** 32 px canvas-drawn favicon swap — default logo / gold dot (READY) / red dot (burn <30 min).
- **Local notifications (opt-in via Settings §7.6):** dish-ready and burn-T-minus-30 while any tab exists; permission requested only when the player enables the toggle (never on boot). Copy: short, horror-comedy register, from the string table.
- **Explicit limitation, documented:** true push with zero open tabs is out of scope (no backend); burn-window *tuning* must tolerate that, which is the service-loop/canon's constraint to carry.

---

## 13. Seasonal reskins (NEW — the cheap local-clock plan)

The original ran themed holiday content (event cafes, Tiki update). Full event cafes are a content decision owned by progression/raids canon; presentation ships the **mechanism** so the option is cheap:
- Manifest supports a `seasonal: {window: [mm-dd, mm-dd], pack: id}` flag on floor/wall/wallDecor/door-overlay frames. `RoomRenderer` checks the local clock at boot and offers (never forces) the seasonal skin via a store banner; skins are permanent once acquired.
- Planned packs (fast-follow, ~6 assets each, template-cost only): Halloween (cobweb wall overlay + jack-o-decor), Winter Holiday (wreath door overlay + snow window), Tiki Summer (bamboo wall + tiki torch — the researched Tiki homage), Valentine (neon hearts).
- If progression opts for event-exclusive rare dishes, the acquisition hook rides these windows; if it opts out, the packs remain pure cosmetics. Either way the decision is now *recorded*, not silent.

---

## 14. Generation & build pipeline

### 14.1 Flow per asset
```
nano_banana_pro (prompt template + 2 reference images)
  → remove_background (sprites only)
  → Tools/optimize_art.py        (trim, @2×/@1× pair)
  → Tools/register_sprite.py     (pivot/baseline/footprint → manifest; enforces canvas dims from artconfig)
  → Tools/tile_fit.py            (floors/walls: projective snap)
  → Tools/register_frames.py     (sheet slice + baseline registration + drift QA)
  → Tools/credits_log.py         (NEW: appends generator, model, date, ToS clause to public/art/CREDITS.md — build fails on missing entry)
  → Tools/build_atlases.mjs      (free-tex-packer-core → 6 atlases + manifest.json, content-hashed filenames)
  → vite build (pngquant; WebP siblings optional)
```

### 14.2 Atlases (@1×; @2× siblings for DPR ≥1.5)
| Atlas | Size | Contents |
|---|---|---|
| `room` | 2048² | 24 floor textures, 18 wall pieces (64×224 @1× sections), door ×2, contact shadow, cursor/ghost |
| `furniture` | 2048² ×2 | 40 sprites + recolor bakes + 4 placeholder crates |
| `chars` | 2048² ×3 | 13 characters: parts sheets + one-shot frames + generic placeholder rig |
| `dishes` | 1024² | 64 icons @128 (8×8) + cloche placeholder |
| `ui` | 2048² | ~64 frames |
| `fx` | 1024² | 14 textures |

`manifest.json` (schema-validated) lists every frame with pivot/footprint/rig-joint metadata; `PreloadScene` is 100% manifest-driven. Load order: ui+fx+room first (playable shell), chars+furniture+dishes streamed behind splash, audio lazy after first frame.

### 14.3 Style lock & QA gates
- Style-reference board (4 approved images) attached to every generation call; unreferenced output rejected.
- Per-asset checklist (enforced by register_sprite exit codes where measurable): exact canvas dims (from artconfig — which CI-equals IsoConfig); outline present (edge-detect); palette ±10 ΔE on keyed elements; pivot recorded; 60%-scale readability (manual).
- Never edit an approved character — regenerate dependents from its reference portrait.

### 14.4 Licensing & credits (NEW — mandatory)
- `public/art/CREDITS.md`: one line per generated asset (tool, model, date, ToS clause permitting redistribution), appended by `credits_log.py`, verified by the manifest build (build fails if a manifest frame lacks a credits entry). Fonts already OFL-logged. Audio per §11.2.
- Repo-level `LICENSE` file and the content-naming position live in `docs/spec/licensing.md` (owned at M0 per the completeness review); this spec's obligation is that **no asset ships untracked** and that dish/character art is generated from *descriptions*, not trademarked names, so a naming decision never forces art regeneration (§7.3).

### 14.5 Asset failure & degradation (NEW)
| Failure | Behavior |
|---|---|
| `manifest.json` fetch fails at boot | retry ×3 with backoff → full-screen error card ("The diner's power is out — check your connection") + Reload button. Never a blank canvas, never a partial boot |
| Shell atlas (ui/fx/room) 404 or decode error | same as manifest failure — the shell is atomic |
| Lazy atlas (chars/furniture/dishes/@2×/bgm) fails post-boot | game continues on placeholders (§5.6) + one toast ("Some art didn't load — retrying"); retry on next scene transition or visibility regain |
| Single missing frame (manifest id without texture) | placeholder rule (§5.6) + dev-console warning; CI makes this unreachable in release builds |
| Audio decode failure | silent-with-toast; game never blocks on audio |
Save-layer failures (quota, disabled storage, corrupt blob) are owned by the save-format spec; the Settings panel's export/import (§7.6) and its error toasts are this spec's rendering of those flows.

### 14.6 Download budgets (unified — supersedes both prior contradictory gates)
One `Tools/budgets.json`, consumed by **one** CI script (the build order's budget check reads this same file):
- **Playable shell** (JS + ui/fx/room atlases + fonts) ≤ **2.5 MB**
- **Total streamed behind splash** (adds chars/furniture/dishes @1× + sfx sprite) ≤ **8 MB**
- **Lazy tier** (@2× atlases + bgm) ≤ **+6 MB**
- Any PNG >250 KB post-quant fails the build.

### 14.7 Deploy hygiene (NEW)
Atlas + manifest filenames are content-hashed (Vite handles JS; `build_atlases.mjs` hashes art), so a returning player can never load new code against stale atlases. Service worker (M11): network-first for index.html, `skipWaiting` + reload prompt. Cross-deploy save safety (old tab writing an old schema after a deploy) is owned by the save-format spec's writer-election/version rule; this spec's obligation is only the hashed-asset invariant.

---

## 15. Mobile-web ergonomics

### 15.1 Orientation: landscape-authentic, portrait-playable
- `Phaser.Scale.RESIZE` (kills the fixed 960×600 FIT letterbox); world camera + clamped pan/zoom; HUD anchored responsively. Landscape is the designed framing; portrait fully supported, never blocked. One-time dismissible rotate hint (drawn icon).
- Minimum viewports 360×640 / 640×360. Zoom clamps from IsoConfig guarantee ≥9 tile-columns landscape, ≥6 portrait (portrait biases camera toward the active stove/table cluster).

### 15.2 Touch & safe areas
- Interactive targets ≥ **48×48 CSS px** (the canonical minimum, §0.2), ≥8 px separation. World picking is tile-based (inverse iso transform) so small sprites get full-diamond hit areas; characters get 56 px circular pads, nearest-wins.
- `viewport-fit=cover` + `env(safe-area-inset-*)` on HUD; `touch-action:none` on canvas instead of `user-scalable=no` (page zoom stays possible in menus).
- Gestures per the arbitration stack (§8): drag=pan (12 px threshold, 90 ms inertia), pinch/wheel=zoom, tap=act, long-press 350 ms=edit. UI scale 1.0–1.4 by `min(viewportW, viewportH)`; text floor 13 px.

### 15.3 Browser support matrix (NEW)
| Tier | Browsers | Coverage |
|---|---|---|
| Supported | last-2 Chrome/Edge/Firefox; Safari & iOS Safari 16.4+ | Playwright **chromium + webkit** boot-smoke from M1 (webkit catches WebAudio gesture-unlock, `pagehide`-vs-`visibilitychange`, safe-area, DPR canvas sizing) |
| Best-effort | Samsung Internet, older evergreen | no CI |
Known Safari hazards owned here: audio unlock (§11.3), `pagehide` as the save trigger fallback, safe-area insets (§15.2). Safari 7-day storage eviction mitigation (`navigator.storage.persist()`, export prompts) is owned by the save-format spec; the Settings export button (§7.6) is this spec's part of it.

### 15.4 Performance targets & method (NEW — replaces the untestable AC)
- **Design target (not a CI assertion):** 60 fps on a 2020 mid-range Android (Snapdragon 730-class) at DPR 2 with the 17×16 room, 20 furniture, 12 walkers — via baked floor RT, atlas batching (≤8 texture binds/frame), pooled particles, dynamic-only depth sorting.
- **CI proxy:** a chromium perf smoke under 4× CPU throttle asserting the scene-update cost stays under K× an in-process calibration loop (relative budget — immune to shared-runner variance) plus a generous absolute ceiling (3× target).
- **Manual gate:** a per-milestone device checklist (1 real iPhone + 1 mid Android: boot, pan/zoom, 12 walkers, drawer, one cook-serve loop at 60 fps-by-eye / devtools FPS meter) recorded in each milestone PR. The Quality-tier Low setting (§7.6) is the escape hatch for weaker devices.

---

## 16. File & integration plan
```
docs/spec/presentation.md            ← this document
Tools/artconfig.json                 ← generated mirror of IsoConfig (CI equality from M1)
Tools/budgets.json                   ← unified download budgets (§14.6)
Tools/register_sprite.py, tile_fit.py, register_frames.py, credits_log.py, build_atlases.mjs
public/art/masters/                  ← @2× approved masters (git-lfs or out of dist)
public/art/atlases/{room,furniture,chars,dishes,ui,fx}.[hash].{png,json} (+@2×)
public/art/manifest.[hash].json      ← frames + pivots + footprints + rig joints + seasonal flags
public/art/CREDITS.md                ← per-asset generation/licensing log (CI-checked)
public/audio/{sfx.ogg,sfx.m4a,sfx.json,bgm_cafe_loop.*,CREDITS.md}
public/fonts/{LilitaOne,Nunito}.woff2 + bitmap font
src/render/  RoomRenderer.ts, CharacterView.ts (rig + state machine), FxLibrary.ts, JuiceKit.ts (FlyingCoin, FloatingText, pressify(), countUp(), reducedMotion gate)
src/input/   InputModes.ts (the §8 mode stack)
src/audio/   AudioManager.ts
src/ui/      StoreDrawer.ts, Cookbook.ts, StarMeter.ts, ThoughtBubble.ts, RosterPanel.ts, InfectSheet.ts, Toasts.ts, SettingsPanel.ts, WelcomeBack.ts, EmptyStates.ts, strings.ts, theme.ts
src/meta/    ReturnHooks.ts (title/favicon/notifications), SeasonalSkins.ts
```
Deletion list on completion: `cafe_bg` as play surface; all monospace fonts; all emoji; all magic depth constants; `PALETTE.brains`; this spec's former WALL_H=160 / 128-wide wall canvases / 0.5–1.5 zoom / 44 px targets / own speed numbers / own cast names / own budget gate (all replaced by canon references above).

## 17. Production checklist (phased; each phase independently shippable)
| Phase | Assets | Count | Gate |
|---|---|---|---|
| **P0 Style lock** (2–3 days) | style board: floor pair, wall section (64×224 geometry), stove, chef parts ×2 facings, dish icon, palette/type card. **Plus: door-position footage check (§4.2) signed off before any wall art; cast list queried from zombies.json and frozen (§6.6)** | ~8 images | Owner sign-off; references + door edge + cast frozen |
| **P1 Room kit** | 8 floor variants (24 tex), 8 wall variants (18 pieces incl. end caps), door (2), shadow, cursor/ghost | ~46 tex | Engine renders 7×8→17×16 from data; JPG retired; artconfig CI green |
| **P2 Core cast** | chef + 4 Free-tier occupations from the frozen cast: parts (20 calls) + gag sheets (15) | 5 chars | Shamble/cook/serve/infect/feral visible; manifest-id CI green |
| **P3 Furniture A** | 20 functional pieces + 4 placeholder crates | 24 sprites | Placement + footprints verified against manifest pivots; placeholder path exercised |
| **P4 UI kit** | ui.atlas (~64 frames), fonts, bitmap font, strings.ts, empty states, Settings v1 (audio/data groups) | 1 atlas | 7-tab drawer, cookbook, star meter (0–100 canon), bubbles live; zero monospace/emoji; export/import shipped |
| **P5 FX + audio + input** | fx.atlas, 26 SFX + bgm + ambience, AudioManager, InputModes stack, return hooks | — | Juice table incl. RM column implemented; mode stack ACs pass; mute persisted |
| **P6 Cast + catalog fill** | 8 remaining occupations (~56 calls), 20 more furniture (incl. Serum Barrel, toxin-stove overlays), 64 dish icons, 6 wallDecor | ~100 assets | Infect tiers cast; cookbook illustrated; Settings complete (motion/visual/notification groups) |
| **P7 Glow-up + seasonal** | premium recolors (scripted), remaining floor/wall variants, first seasonal pack, marketing art from old JPG | scripted+~18 | Grime→luxury arc visible; seasonal mechanism demoed |

## 18. Acceptance criteria & CI gates (presentation-owned)
1. `Tools/artconfig.json` deep-equals `IsoConfig` exports (CI, from M1).
2. Every manifest frame id resolves to a catalog entry (zombies/dishes/furniture) or a declared UI/FX/placeholder id (CI).
3. Wall sections measure 128×448 @2×; floor tiles 256×128 @2×; register_sprite rejects deviations (CI).
4. `budgets.json` respected: shell ≤2.5 MB, total ≤8 MB, lazy ≤+6 MB; no PNG >250 KB (CI — the only budget gate in the repo).
5. Every generated asset has a CREDITS.md entry (CI).
6. Playwright chromium **and webkit** boot smoke: manifest loads, shell atlases decode, first interactive frame renders, audio unlocks on synthetic gesture (CI).
7. Asset-failure drill (Playwright, fetch-intercepted): manifest 404 → error card with Reload; lazy-atlas 404 → placeholders + toast, game playable (CI).
8. Input-mode stack unit tests: selected-zombie tap-on-customer dispatches (never opens infect card); placement mode ignores entity taps; modal captures all; Esc pops one level; 60 s frame-gap injection produces no mode corruption.
9. Star meter renders R/20 from a 0–100 rating input; every green/red state in the UI kit carries a glyph or signed number (snapshot tests).
10. Reduced-motion setting: screenshake/vignette/parallax/camera-nudge calls are provably no-ops (unit test on JuiceKit gate); audio-cues-as-toasts mirrors the burn ticking.
11. Settings persists across reload; export→wipe→import round-trips a save byte-identically (integration test, from M3).
12. Perf CI proxy (4× throttled chromium) within relative budget; manual device checklist attached to each milestone PR.
13. Welcome-back modal renders an away-rating delta row with green/red blink from a fixture OfflineEngine report (snapshot test).
14. Zero network requests to any analytics/telemetry host in the built bundle (CI grep + runtime request assertion in the smoke).

## 19. Risks & mitigations
- **Frame-sheet inconsistency** → confined to 3 short gags/character, single-call grids, baseline-registration QA, CENSORED bar covers the hardest frames.
- **Cutout rigs reading stiff** → tuned shamble params reviewed against original footage; escalation: 4-frame hand-picked walk sheets for chef + 2 hero zombies.
- **Style drift across 200+ assets** → mandatory reference-board conditioning + ΔE check + no off-style approvals.
- **Modernization stack eroding active-play texture** (auto-resume + auto-task-loop + patience-pause + free scout stacking) → the bundle is playtested *as a bundle* at the M7 gate; the presentation-side lever (long, visible daydream drowsiness on low-Focus zombies so tapping staff stays a real activity) is pre-built as a tunable, per the review's recommendation. Owned jointly with staff spec.
- **Door-edge resolution proves wrong at P0 footage check** → cost is contained by design: no wall art generated before the gate; the engine amendment list (§4.2) flips sign trivially.
- **Atlas bloat** → unified CI budget; scripted recolors; @2× lazy.
- **Wall/floor seams** → tile_fit snap + 1 px inner bleed dilation.
- **iOS Safari quirks** → webkit CI smoke from M1 (not M8) + the §15.3 hazard list.

---

## 20. Review notes (disposition of every critique; conflicts adjudicated)

**Applied in full (presentation-side changes made above):**
- **RN-1 Wall geometry (blocker, 2 critics):** both reviewers agreed the engine's derivation wins. Applied: WALL_H 192, sections 64×224 @1× (the 128-wide canvas was geometrically wrong — one tile edge projects to 64 px). §3/§4.2 re-derived; door piece re-sized to 2 sections = 128×224 @1×.
- **RN-2 Tile metrics / IsoConfig canon (blocker):** applied — §3 consumes IsoConfig; artconfig CI equality moved to M1. The build order's 64×32 values must be patched to reference IsoConfig (build-order owner's action; flagged).
- **RN-4 Character art strategy (major):** critic sided with this spec's paper-doll approach — no change here except formally claiming ownership (§0.1) and enumerating the iso §11 amendment.
- **RN-5 Launch cast (major):** applied fully. §6.6 no longer names characters (the old list was both Capcom-verbatim and absent from data); the cast is a frozen P0 query against `zombies.json` tier tables, with a CI manifest-id check.
- **RN-7 Download budgets (major):** applied — one `budgets.json` (2.5/8/+6 MB), one CI script; both specs cite it.
- **RN-8 Perf ACs untestable (minor):** applied — §15.4 replaces device-fps ACs with a relative CI proxy + manual per-milestone device checklist.
- **RN-9 Zoom/touch constant drift (minor):** applied — zoom cites IsoConfig; 48 px declared once as the canonical touch minimum.
- **RN-10 Walk speeds ×5 (major):** applied — §6.4 defines zero speeds; cadence derives from `src/sim/speeds.ts` (Staff formula canon, per the superfan's fix). Service/raid/engine deletions are their owners' actions; flagged.
- **RN-11 Star rating (blocker, 3 critics — conflicting fixes):** two critics (superfan, completeness) recommended Progression's 0–100 S+D+B; one (engine engineer) recommended service's 0–1000. **Adopted 0–100**: it is the only model that consumes `furniture.json` happinessBonus at researched magnitudes (Fine Painting +10) and models bonus-star persistence + away-decay — both fidelity requirements this spec's star meter and welcome-back beat render. The engine engineer's preference is noted and rejected; his underlying demand (one scale, regenerated dependent tables) is satisfied either way. Presentation-side: star meter renders R/20; welcome-back blink row added (§7.1) — also closing the MISSING "away-rating blink" item.
- **RN-12 Depth bands (minor):** applied — §4.3 uses symbolic band names; numerals live only in `depth.ts`.
- **RN-13 EventBus names (major):** applied at this spec's surface — AudioManager/FxLibrary consume the canonical events map (to be published as the build-order's events appendix) and this spec no longer asserts event-name spellings in ACs. Defining the map is the build-order owner's action.
- **RN-14 Accessibility folded into UI kit at M8 latest (minor):** applied — glyph/number redundancy throughout §7/§9/§10, reduced-motion + colorblind assist + audio-cues-as-toasts in Settings, keyboard traversal in §8.
- **RN-15 Modernization-stack bundle playtest (minor):** applied as a risk-register item (§19) with the presentation-side lever (visible drowsiness) pre-built.
- **RN-16 Pre-engine stub scaffolding (minor):** not this spec's workstream, but concurred — this spec's render layer targets the real engine contracts (`src/engine/contracts.ts` per the interface critique) and builds no stub adapters.

**Applied — MISSING items where presentation is the natural owner:** Settings spec (§7.6), input-mode arbitration (§8), empty states (§7.7), asset-failure/degradation UX + placeholder fallback (§14.5, §5.6 — also satisfying the rare-dish critique's "unillustrated-but-reachable" clause), return hooks (§12), seasonal plan (§13), i18n decision (§7.8), telemetry decision + copy-my-stats (§7.6), browser matrix + WebKit CI (§15.3), art licensing log (§14.4), deploy/cache-busting hygiene (§14.7), Magic Fridge / Serum Barrel / Toxin-stove / outdoor-decor / social-substitute deviations logged with owners (§1.2).

**Adjudicated conflicts:**
- **RN-6 Door edge (blocker — the two critics gave OPPOSITE fixes).** Engine-engineer critic: back wall, "matches the original game, whose door is in the back wall," amend the engine. Completeness critic: front edge, "customers entering toward the camera is the original's read." These cannot both be right about the same game. **Resolution: back wall**, on three grounds: (a) the research describes the room as a diorama whose two *back* walls carry the authored wall content and the original's door is drawn as part of that wall art — a front-edge door has no wall to be set into and would float on the invisible front boundary; (b) the fidelity pillar outranks the engine's current spawn-math convenience, and the engine amendment is small and enumerated (§4.2); (c) the engine-engineer's claim is stated as an observation of the original, the completeness critic's as an inference ("the original's read"). Because this was resolved by argument rather than by a checked source, a **P0 footage-verification gate** precedes any wall-art generation (§17) — if footage contradicts us, flipping costs one sign change and zero art.
- **RN-3 / RN-19 Dish names (blocker + major — superfan vs licensing critic give OPPOSITE fixes).** The superfan demands the original 2011 names verbatim (Mystery Meat as the tutorial dish); the licensing critique demands renaming all verbatim Capcom content names. Presentation resolves its own exposure by becoming **name-agnostic** (§7.3: icons keyed to ids, prompts describe food not names), so either outcome costs zero art. The naming decision itself belongs jointly to the dish-canon owner and `docs/spec/licensing.md`; this spec's recommendation, for the record: homage names at the identical pun register (the fidelity pillar demands the *register* be instantly recognizable; individual generic terms like "Mystery Meat" may survive a legal read, but that read happens in licensing.md, not in an art spec). The old §7.3 sentence naming Capcom dishes is deleted.

**Not this spec's scope (concur; no presentation change beyond consuming the outcome):** XP curves/level caps, time models, save-version ledger, expansion ladders, working-slot/zombie-level ladders, raid/Toxin faucet tables, tip composition, brains→toxin mapping, starter layout contents, spawn intervals, movement connectivity (4-connected — this spec's path-follower already assumes cardinal segment deltas, compatible), placementId stability, furniture-lifecycle × live-sim matrix (though §8's cancellation matrix implements the *input* half of the expansion/door-relocation atomicity item), offline-settlement engine ordering (this spec renders its report, §7.1), multi-tab writer election, tab-throttling MAX_LIVE_CATCHUP, test-time clock harness, soft-lock pity mechanic, defense-mode decision, Zombiepedia state-machine ownership (Progression's 4-state model; this spec renders it incl. the empty state), onboarding split (this spec's tutorial-relevant components — toasts, highlight ring, Union Rep card — are all in §7 and available from P4, so the recommended M5 tutorial split is not blocked on art).

**Rejected (with reasons):**
- **"Presentation should restate no numbers at all":** partially rejected as unworkable for an art-production document — artists need dimensions on the page. Compromise implemented: numbers appear as *citations* of the owning module with a CI equality check (§0.2, §3), so restatement can never drift.
- **Engine engineer's 0–1000 rating recommendation:** rejected per RN-11.
- **Completeness critic's front-edge door:** rejected per RN-6, with the footage gate as insurance.

## Acceptance criteria

- [ ] Tools/artconfig.json deep-equals src/engine/IsoConfig.ts exports (CI check active from M1, not the art milestone)
- [ ] Wall sections are authored at 64x224 @1x / 128x448 @2x with WALL_H=192 per the iso-engine derivation; register_sprite.py rejects any canvas-dimension deviation
- [ ] The door is authored as a back-wall piece spanning 2 wall sections, and a P0 footage-verification gate signs off the door edge before any wall art is generated
- [ ] Every chars-atlas manifest id exists in src/data/zombies.json, and every dish/furniture manifest id resolves to a catalog entry or a declared placeholder (CI)
- [ ] Section 6.4 defines zero movement speeds: locomotion cadence is derived at runtime from src/sim/speeds.ts (Staff Speed-stat formula for zombies; CUSTOMER/ANGRY/FLEE constants)
- [ ] The star meter renders R/20 stars from the canonical 0-100 rating, and every green/red UI state carries a glyph or signed number in addition to color (snapshot tests)
- [ ] The welcome-back modal renders an away-rating delta row with the green/red star blink from a fixture OfflineEngine settlement report
- [ ] A single Tools/budgets.json enforces shell <=2.5MB, total <=8MB, lazy <=+6MB via one CI script, superseding both prior contradictory budget gates
- [ ] Playwright boot smoke runs on chromium AND webkit from M1: manifest loads, shell atlases decode, first frame renders, audio unlocks on gesture
- [ ] Asset-failure drills pass: manifest/shell-atlas 404 shows the error card with Reload; lazy-atlas 404 degrades to placeholders plus a toast with the game still playable
- [ ] Input-mode stack tests pass: tap-on-customer while a zombie is selected dispatches a move (never opens the infect card); placement mode ignores entity taps; modals capture all input; Esc pops exactly one level
- [ ] Settings panel ships save export/import/reset from M3, audio channel volumes, reduced-motion (screenshake/vignette/parallax provably no-ops), colorblind assist, quality tier, notification opt-ins, and purist toggles; settings persist across reload and export/import round-trips byte-identically
- [ ] All UI strings live in src/ui/strings.ts with no inline literals (English-only decision logged)
- [ ] Every generated art and audio asset has a CREDITS.md entry (generator, model, date, license/ToS clause) verified at build time; the build fails on a missing entry
- [ ] Atlas and manifest filenames are content-hashed so deployed updates can never pair new code with stale atlases
- [ ] The launch cast is selected by querying zombies.json tier tables at P0 (no hardcoded occupation names, no verbatim Capcom names anywhere in the spec or manifests)
- [ ] Dish icons are id-keyed and name-agnostic: prompts describe the food, so a licensing-driven rename requires zero art regeneration
- [ ] Perf gates are testable: 4x CPU-throttled chromium CI proxy with a relative budget, plus a manual two-device checklist attached to every milestone PR (the raw 60fps-on-Snapdragon-730 assertion is a design target, not a CI AC)
- [ ] Zero analytics: the built bundle makes no telemetry requests (CI grep plus runtime request assertion), and the Settings panel offers the voluntary copy-my-stats button
- [ ] The deviation log records Magic Fridge, Toxin-upgradeable stoves, Serum Barrel, outdoor decor, the social recipe/Toxin-faucet substitute, and seasonal content, each with its owning spec and the reserved presentation deliverable
