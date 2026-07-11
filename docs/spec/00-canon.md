# 00 — CANON (Deadbeat Diner single-authority registry)

**Status:** BINDING. This document is the arbiter for every shared constant, formula, table, and
contract in the plan. Where any of `01`–`07` disagrees with this file, **this file wins** and the
system spec must be amended (amendment list in §18). Specs may elaborate mechanics they own; they
may never restate a number that lives here except by key reference.

**Decision bias, in order:** (1) fidelity to `original_game_research.json` (the only fidelity
source — legacy Unity code is NOT one); (2) owner pillars — faithful + modern usability, HYBRID
pacing (snappy L1–5, real 1–3-day idle bets at high level), FREE game / Toxin earned-only,
isometric engine first (pure TS `src/engine/`, Phaser-free); (3) engineering simplicity.

**Structural rule (the disease this file cures):** one source per number. Machine-checked from
M0/M1: `Tools/artconfig.json` deep-equals `IsoConfig` exports; `src/sim/tuning.ts` key coverage;
save-ledger ↔ spec front-matter agreement; events-map coverage; starter-layout invariants;
CI grep-gates against deleted scales (0–1000 / 0–50 rating, 64×32 tiles, `FOREGROUND_TIME_SCALE`).

---

## 1. IsoConfig — the engine's canonical geometry

Single source: `src/engine/IsoConfig.ts`. `Tools/artconfig.json` is generated from it and
CI-checked for equality. The Build Order M1 tuning table and Presentation's art templates
reference these keys; **any restated literal is a review-blocking defect.**

| Key | Value | Notes |
|---|---|---|
| `TILE_W × TILE_H` | **128 × 64 px** (2:1 diamond) | Build Order M1's 64×32 is superseded. Floor master PNG = 256×128 @2×. |
| `HALF_W / HALF_H` | 64 / 32 | |
| `WALL_H` | **192 px** (3 tile-heights) | Presentation's 160 is superseded. |
| Wall section canvas | **64 × 224 @1×** (128×448 @2×) | One section per tile edge; one edge projects to exactly 64 horizontal px. Presentation's 128-wide canvas was geometrically wrong (spans two edges). 192 visible wall + 32 base skirt. |
| Room orientation | Diorama: floor grid + **two back walls (NW and NE)** visible; front edges open toward camera | Research: "you see BACK WALLS, not just a top-down floor." Wall decor hangs on the two back walls only. |
| `tileToWorld` | `x=(fx−fy)·64, y=(fx+fy)·32` | Integer coords are diamond **centers**. |
| `roomBounds` | `minX=−64·h, maxX=+64·w, minY=−32−192=−224, maxY=32·(w+h)−32` | maxY corrected per review (the `−HALF_H+HALF_H` slip); 17×16 room = 2112 × 1248 world px. |
| Depth bands | `FLOOR=0, FLOOR_OVERLAY=500, WALL=1000` (wallDecor = 1001 + index·0.01 above the baked wall RT), `ENTITY=2000`, `FX_WORLD=9000`; UI on scrollFactor(0), not depth | Build Order's `key·10` / `FX=8000` superseded. |
| Entity depth | `2000 + floor((fx+fy)·16) + (isCharacter ? 8 : 0)` | Character key **quantized by floor()** so a walker can never tie a furniture depth mid-step (review: tie-flicker fix). One depth flip per 2×2-footprint pass, AC-swept. |
| Zoom clamps | `ZOOM_MIN 0.4 · ZOOM_MAX 2.0 · DEFAULT_FIT_ZOOM_FLOOR 0.75` | 0.5–1.5 and 0.5–2.0 variants deleted. |
| Input thresholds | `TAP_VS_PAN_PX 8 · CAMERA_MARGIN_PX 96` | |
| Touch target minimum | **48 × 48 CSS px** | 44px references superseded (Presentation §0.2 wins; stricter). |
| Pathfinding | **4-connected only**, A* over `(tile, arrivalDir)` states with turn penalty; start state = virtual no-direction (first step free); start cell always treated walkable (seated actors can path out) | Build Order M2's diagonals deleted; raid melee = **4-neighbor adjacency** (range rule, not pathing). |
| `MAX_LIVE_CATCHUP` | **5 s** | Lives in IsoConfig; callers must route larger accumulated dt through the OfflineEngine (§4). |

**Door (decision — research is silent on door placement):** exactly one door tile on a **front
edge** (`tx=W−1` or `ty=H−1`), default `(⌊W/2⌋, H−1)`. The door cell can never be occupied.
Spawn/despawn at the door with an off-grid walk-in from `door + outwardNormal × 1.2` (render-only).
Rationale: the engine's spawn math, starter layout and AC suite derive from it; an open-front
diorama never hides arrivals; it keeps both back walls free for the researched wall-decor surface.
Presentation's "NE back-wall door" paragraph is deleted; the door asset is a front-edge door mat +
frame. Flip-to-back change surface is documented in 01 §3.2 if period screenshots ever surface.

**Starter room (one committed `starterLayout.json`, engine-owned, CI-validated against
service-loop invariants):** room **7×8**, door **(3,7)**.

| Item | Tile(s) | Facing |
|---|---|---|
| Stove ×2 | (0,1), (0,3) | SE (against left wall) |
| Counter ×1 | (0,5) | SE |
| Sink ×1 | (6,1) | SW (against right wall) |
| Table ×2 | (2,2), (4,2) | — |
| Chair ×3 | (2,3), (4,3), (5,2) | ⇒ **3 seats** |
| Floors/walls | `floor_01` / `wall_01` (grimy starter tier) | |

CI invariant (AC-22): ≥1 stove, ≥1 counter, ≥1 sink, ≥1 seat, door present, every station
reachable from the door, all aisles ≥1 tile. The old 3-stove/no-counter/no-sink starter (could
never earn a coin under the serve rules) is deleted. Progression's first-two-hours walkthrough is
regenerated from this layout + `tuning.ts`.

**Placement rules:** `canPlace` tests every covered cell against walkers' current **and committed
in-flight destination** tiles (mid-step race fix). PlacementSession **move** uses id-preserving
`CafeGrid.moveItem()` — a mid-cook stove nudged one tile keeps its cook state; remove+re-place is
reserved for Storage. The monotonic placement-id counter **is persisted** and excluded from the
serialize-hash AC. Removal is **storage-only, never sold** — no `sellValue` path exists at the
engine or store layer (research: unlimited Storage tab, non-destructive editing).

---

## 2. Expansion ladder — one table, one file

`src/data/expansion.json`. Geometry column owned by the engine spec, cost/gate columns by
Progression; engine ACs parameterize on this file (first step and max dims). Tiers 1–5 are the
researched 2011 prices verbatim with cash-or-Toxin duals added per Pillar 3 (Toxin earned-only,
so every Toxin tier keeps a cash alternate); tiers 6–10 extend the documented cap growth on the
same curve (invented — logged). Strictly sequential (prerequisite-locked). Legacy-Unity 9-tier
rectangle ladder and Build Order's price quotes are deleted. **Max room 17×16** (not 16×17 — the
engine and presentation geometry, roomBounds worked examples, and ACs are computed from it).
Square-room deviation logged: interior tiers are true squares per research; the researched
endpoints 7×8 and 17×16 are near-square and kept verbatim.

| Tier | Size | Tiles | Cost | Level gate |
|---|---|---|---|---|
| — | 7×8 (starter) | 56 | — | — |
| 1 | 8×8 | 64 | $3,500 | 2 |
| 2 | 9×9 | 81 | $25,000 or 10 Toxin | 4 |
| 3 | 10×10 | 100 | $75,000 or 30 Toxin | 6 |
| 4 | 11×11 | 121 | $200,000 or 40 Toxin | 8 |
| 5 | 12×12 | 144 | $450,000 or 50 Toxin | 10 |
| 6 | 13×13 | 169 | $900,000 or 60 Toxin | 12 |
| 7 | 14×14 | 196 | $1,500,000 or 75 Toxin | 15 |
| 8 | 15×15 | 225 | $2,200,000 or 90 Toxin | 18 |
| 9 | 16×16 | 256 | $3,200,000 or 110 Toxin | 20 |
| 10 | 17×16 | 272 | $4,500,000 or 130 Toxin | 21 |

Each purchase grants the 1-Toxin milestone and fires one `cafe-expanded` event.
**Atomic expansion ordering:** grid re-derivation → door re-validation (stays if still legal on
the new perimeter, else relocates to default with a toast) → exactly one event after the grid is
consistent → subscribers rebuild in priority order (SeatIndex → TaskQueue claim release →
in-flight walker re-plan) → save write. No listener may mutate the grid re-entrantly.

---

## 3. Time model — two clocks, defined once

Owned by `docs/spec/simulation-core.md`; every other spec cites this section.

| Clock | Governs | Rule |
|---|---|---|
| **REAL (wall-clock)** | Cook timers, burn deadlines, customer patience, bonus-star 72h expiry, streak day-keys, S gain-rate cap window, revive timers, Magic Fridge/catering daily windows, seasonal windows | Absolute UTC timestamps (`readyAtUtc`, `burnAtUtc`). Never scaled, foreground or background. This is what makes offline settlement one code path. |
| **ACTIVITY** | Zombie energy drain/regen, daydream rolls, serving throughput | **Authored foreground-native (1×)**. Backgrounded/closed, activity time advances at `ACTIVITY_OFFLINE_FACTOR = 1/12` of real time (inside the researched 10–15× "foreground runs faster" band). Unit-tested invariant: foreground rate per real second = exactly 12× background rate, per activity. |

Deleted: Build Order M4's global `FOREGROUND_TIME_SCALE=10` (it accelerated cook timers, which
the original never did), the service loop's v1 "no acceleration anywhere," and `DEMO_TIME_SCALE`.
Test acceleration is an **injected `Clock`** (`RealClock` prod / `SteppableClock` tests); the
Playwright harness build exposes `window.__sim.advance(ms)`, guarded out of production bundles by
a CI grep.

**Offline settlement — one `OfflineEngine`:**
`elapsed = clamp(now − lastSaveUtc, 0, OFFLINE_CLAMP_DAYS=7)` (14-day variant deleted), one value
for all settlers, run in fixed order:

1. **Service settler** — stoves reach READY/BURNT on absolute stamps; offline serving (§9).
2. **Staff settler** — energy at background rates; incidents.
3. **Raid timers** — revive countdowns (real clock), retaliation resolution if opted in.
4. **Bonus-star expiry** (before decay, so the report shows both).
5. **S decay** — untouched first 24h, then −1.0 per additional 12h, floor 5.
6. **Rating recompute + welcome-back report assembly** (one report: dishes sold, coins, burns,
   incidents, and the **red/green star blink** — the researched away-feedback signature).

**Hidden-tab / throttle semantics:** hidden < 60 s → freeze and resume (no settlement, no
despawn). Hidden ≥ 60 s (`HIDDEN_SETTLE_THRESHOLD_S`) → save, despawn live customers with zero
rating deltas, settle on return. `pagehide` also saves (iOS). Accumulated live dt >
`MAX_LIVE_CATCHUP` (5 s) never replays live — excess routes through the OfflineEngine
(rating-neutral). Unit test: 60 s injected frame gap ⇒ zero angry-leave deltas. Full-screen
modals pause the ACTIVITY clock and customer sim, never REAL-clock cook/burn timers. A live raid
auto-pauses on hide and offers resume/retreat on return. Multi-tab: `navigator.locks`
primary-writer election (localStorage lease fallback: renew 5 s, takeover 15 s stale); election
message carries `SAVE_VERSION` — an old tab seeing a newer version goes read-only; settlement
runs once per wall-clock window (`lastSettledAt` guard), never per tab.

---

## 4. Hybrid pacing — cook-time bands and burn windows

Bands per cafe level (every dish's cook time T must sit in its level's band; CI-validated over
all 320). L1–5 snappy attended loop (Pillar 2), L6–15 session-scale, L16–22 set-and-forget with
the **1–3-day overnight bet restored** (the 12h cap is deleted; the timer ladder is the
"pacing/retention engine").

| L | Band | L | Band | L | Band | L | Band |
|---|---|---|---|---|---|---|---|
| 1 | 15–60s | 7 | 4–10m | 13 | 30–50m | 19 | 3–8h |
| 2 | 30s–2m | 8 | 5–15m | 14 | 40–60m | 20 | **4–24h** |
| 3 | 1–3m | 9 | 8–20m | 15 | 45–60m | 21 | **8–48h** |
| 4 | 1.5–3m | 10 | 10–30m | 16 | 1–2h | 22 | **12–72h** |
| 5 | 2–3m | 11 | 15–40m | 17 | 1.5–4h | | |
| 6 | 3–8m | 12 | 20–45m | 18 | 2–6h | | |

**Burn windows (research-exact bands, on retuned times):** dish burns at
**5× cook time (T ≤ 5 min) · 4× (5 min < T ≤ 30 min) · 3× (T > 30 min)**, with a **90 s floor**
(logged usability modernization: kills the mis-tap trap on 15 s dishes). Burn forfeits the dish
and its full paid price; **burn is wallet-only — zero rating change** (no source supports a
rating hit). Burn windows — not an arbitrary hour cap — are the offline earnings ceiling, exactly
as in 2011. A 72 h cap dish has a 216 h (9-day) burn window, so multi-day absences are safe bets;
absolute timestamps make multi-visit stewardship across several settlements correct. Pause/resume
is supported mid-cook (paused stoves never advance or burn). Un-burn mercy: 1 Toxin within 60 s
of a burn (adopted — on-pillar friction removal).

---

## 5. Star Rating — one scale (0–100 = S + D + B)

`R = clamp(S + D + B, 0, 100)`, displayed as **R/20 stars** (0–5, quarter-star fill), star meter
top-left, blinks green/red on change. The 0–1000 scale, the 0–50 occupation scale, and the 1–5
spawn table are deleted; a CI grep-gate rejects any `/1000` or `/50` rating arithmetic.

**S — Service score (0–40), starts 15.** Event deltas (tuning keys; the service loop consumes,
never redefines):

| Event | ΔS |
|---|---|
| Serving delivered, customer happy (<50% patience elapsed) | +0.25 |
| Serving delivered late (sad bubble showing) | +0.05 |
| Customer leaves unserved (patience expired / no seat) | −1.5 |
| Feral zombie attacks a customer (all customers flee unpaid) | −6.0 (live) |
| Feral incident during offline settlement | −2.0 |
| Dish burns | 0 (wallet-only) |
| Gain cap | +6.0 per rolling wall-clock hour |

**Decay:** offline only — S untouched for the first 24 h away, then **−1.0 per additional 12 h,
floor 5**, applied by the OfflineEngine settler; welcome-back report shows the red (or green)
blink. "No passive decay" is retracted; decay is a researched signature.

**D — Decor stars (0–45):** `D = min(45, Σ happinessBonus)` over **placed** furniture/decor/
utilities/wall-hangings (research magnitudes: Fine Painting +10, Fish Tank +5, Fountain +3,
Television +2; upgraded themed stoves +1). Copies beyond the 3rd of an item contribute 50%.
Floors and walls contribute **zero** (fidelity: surfaces are pure cosmetics). Storage contributes
nothing. Outdoor decor counts like any decor.

**B — Bonus stars (0–15):** each completed review-task star = **+5 R for 72 h**, max 3
concurrent; they persist when S drops (the researched decay shield). Unlock at cafe L6; 4 daily
tasks per star; 2-Toxin bribe per task.

**What R drives (one table):**

| R | Spawn interval | Rarity pool unlocked | Tip multiplier |
|---|---|---|---|
| 0–19 | `SPAWN_INTERVAL = 22 − 0.14·R` s | common (30) | `ratingMult = 1 + R/200` |
| 20–39 | " | + uncommon (30) | " |
| 40–59 | " | + rare (20) | " |
| 60–79 | " | + epic (15) | " |
| 80–100 | " (floor 8 s) | + legendary (10) | " (max 1.5×) |

Within unlocked bands, rarity weights 100 / 40 / 15 / 5 / 1.5. Per-zombie spawn eligibility =
`R ≥ max(band threshold, zombie.minStars₁₀₀)` AND `cafeLevel ≥ appearsAtCafeLevel` (the infection
tables' `minStars` column is authored on 0–100; old 0–50 values ×2). Rating→tips closes both
researched loops: `ratingMult` on every payment, and richer pools carry higher Tips stats.
This spawn table replaces 18→6 s, 20→7 s, and 22→8 s variants — `SPAWN_INTERVAL` is one key.

---

## 6. Cafe Level — one XP curve (cap 22)

Owned by Progression, stored in `src/data/unlocks.json`. The `6·L^2.4` cap-20 curve and the
`ceil(30·1.35^(n−2))` cap-30→100 curve are deleted. **Cap 22** (the original's cap was 20,
raised to 21–23 by patches; our content data tops out at L22 — the 97-dish General ladder is the
original's L1–100 ladder compressed, same order, denser. This resolves "L1–30": levels above 22
do not exist).

**Dish XP (the only XP formula in the repo):**
`totalXP = max(1, round(0.62 · cookTimeMinutes^0.69))` — validated against original stat lines
(2 m→1 XP, 15 m→4, 8 h→44, 1 d→95 ≈ Sloppy 'Joe' 95, 3 d→194 ≈ Escargut/Fetidccine ~200–220).
XP/hour declines with cook time: short dishes are the leveling engine, long dishes the
convenience engine — the original meta. The profit-based `0.35·profit^0.85` formula is deleted
(it double-counts the economy and inverts the meta).

**Grant timing:** 100% of `totalXP ÷ servings`, accrued fractionally, credited **per serving
delivered** on the canonical delivery event. There is **no collect-tap** anywhere (servers carry
dishes off the stove); the 30%-on-collect split is deleted. Burned servings grant 0 XP.

**xpToNext table (authored table IS the formula; committed in `unlocks.json`):**

| L | XP | L | XP | L | XP | L | XP |
|---|---|---|---|---|---|---|---|
| 1 | 30 | 7 | 820 | 13 | 6,000 | 19 | 29,000 |
| 2 | 70 | 8 | 1,200 | 14 | 8,000 | 20 | 37,000 |
| 3 | 130 | 9 | 1,700 | 15 | 10,500 | 21 | 47,000 |
| 4 | 220 | 10 | 2,400 | 16 | 13,500 | 22 | (cap) |
| 5 | 350 | 11 | 3,300 | 17 | 17,500 | | |
| 6 | 550 | 12 | 4,500 | 18 | 22,500 | | |

Cumulative to L22: **206,270 XP**. Pacing: L4–5 in session one, L10 end of week 1, L16–18 at day
30, L22 a 3–4-month completionist goal. Level-up: modal + `level × 50` coins; pauses the
ACTIVITY/customer sim, never cook clocks.

**Unlock ladder (single unlock authority — key gates):** L1 General Cookbook (6 dishes) +
Zombiepedia + chef · L2 **Meat Locker** (5 hooks) + Expansion tier 1 + favorites · L3 Decor tab ·
L4 themed book 1 + walls/floors painting · **L5 Raiding + Wandering Vendor** · L6 review tasks /
bonus stars + themed book 2 · L8 themed book 3 + **Pets** · L10 themed book 4 + **combining** ·
L12/16/18/20 themed books 5–9 · L21 expansion tier 10 · L22 final General dishes (72 h cap dish).
Raid-spec's L4 unlock and infection's L1 Meat Locker are corrected to cite this ladder.
**Working slots** follow the infection formula (§10), shown derived here only.

---

## 7. Dish economy — one generator, original menu restored

`Tools/retune-dishes.ts` → `src/data/dishes.v2.json` is the **only** dish authority (six-stat
model: Level, Price, Cook Time, Servings, Total Earnings, Total XP; profit = earnings − price).
Build Order M5's rival re-anchoring to verbatim 2011 stat values is deleted — Pillar 2's hybrid
bands win over the original's 2-minute floor; the original's published stat lines survive as the
**crosswalk validation anchors** (`docs/spec/dish-crosswalk.md`) for curve *shape* (XP formula
anchors, declining-$/hr meta), not as shipped L1 values.

**Catalog structure (generator inputs, CI-asserted):** 320 dishes = **General 97 + 9 themed
books × 21 + Rare 34** (11 cookbooks — logged deviation from the researched 21 books; 97+9×21+34
is the clean fit). 10 versions per recipe (Normal + 9 variations) land at M10a: Spicy +10% XP ·
Very Spicy +20% XP · Bulk 2× price/earnings/XP · Frozen 2× time, −25% price · Quick −10% time ·
Very Quick −20% time · Fancy +15% earnings · Fresh +10% earnings · Jumbo +50% servings & price.
Variation unlock: 5 Toxin each / 45 for all nine of one recipe; obtained **only from raids**
(research: raiding is the sole variation source). Up to **15** pinned favorites.

**Names (fidelity + licensing §16.4):** the 97-dish General spine ships the **original 2011
menu by name** — Mystery Meat is the tutorial dish; the ladder runs through Handburger & Flies,
Green Eggs & Sam, Rot Dogs, Dishwater Soup, Hobo Delight, Leftunders, Gello Mold, Sloppy 'Joe',
Tumor Melt, Escargut, Fetidccine, and caps at **Yucky-soba**. The repo's pun catalog (Finger
Fries, Brainstem Bisque, …) fills the 9 themed books and Rare slots. Every dish row carries
`displayName` + same-register `altName`; a `NAME_SET` build flag flips the whole menu in one
line (§16.4).

**Closed forms (`T` = cook seconds, `L` = level; all 320 rows are committed generator output):**

```
servings      = clamp(round(12 · (T/60)^0.65), 4, 1900)
PER_SERVING   = [—,1,1,2,2,2, 3,3,3,4,4, 5,5,6,6,7, 8,9,10,11,12, 13,14][L]   // $/serving by level
totalEarnings = PER_SERVING · servings
margin        = min(0.5, 0.42 · (T/60)^−0.15)
price         = max(1, round(totalEarnings · (1 − margin)))
totalXP       = max(1, round(0.62 · (T/60)^0.69))        // §6 — Progression's formula
```

CI invariants over all 320: profit/hr strictly decreases as T increases **within each level**
(monotonic post-pass runs over the whole level, and the committed table equals post-passed
output — no dual-pipeline ACs); newest tier's shortest dish beats every idle dish per hour;
`totalEarnings % servings === 0`; every T in its band; book counts exact; every reachable dish
has an icon or the specced placeholder.

**Anchor rows (hand-verified generator output):**

| dishId | Name | Lv | Cook | Price | Srv | $/srv | Earn | Profit | XP | Burn |
|---|---|---|---|---|---|---|---|---|---|---|
| dish_mystery_meat | Mystery Meat *(tutorial)* | 1 | 15s | 3 | 5 | 1 | 5 | 2 | 1 | 90s |
| dish_handburger_flies | Handburger & Flies | 1 | 30s | 4 | 8 | 1 | 8 | 4 | 1 | 150s |
| dish_rot_dogs | Rot Dogs | 1 | 60s | 7 | 12 | 1 | 12 | 5 | 1 | 300s |
| dish_green_eggs_sam | Green Eggs & Sam | 2 | 90s | 10 | 16 | 1 | 16 | 6 | 1 | 450s |
| dish_dishwater_soup | Dishwater Soup | 3 | 3m | 32 | 25 | 2 | 50 | 18 | 1 | 15m |
| dish_hobo_delight | Hobo Delight | 6 | 8m | 96 | 46 | 3 | 138 | 42 | 3 | 32m |
| dish_leftunders | Leftunders | 10 | 30m | 326 | 109 | 4 | 436 | 110 | 6 | 90m |
| dish_gello_mold | Gello Mold | 13 | 45m | 650 | 142 | 6 | 852 | 202 | 9 | 135m |
| dish_sloppy_joe | Sloppy 'Joe' | 20 | 24h | 13,978 | 1,356 | 12 | 16,272 | 2,294 | 94 | 72h |
| dish_escargut | Escargut | 21 | 48h | 21,563 | 1,900 | 13 | 24,700 | 3,137 | 151 | 144h |
| dish_yucky_soba | Yucky-soba *(cap)* | 22 | 72h | 23,408 | 1,900 | 14 | 26,600 | 3,192 | 200 | 216h |

Sloppy 'Joe' is again a **14k-cash overnight bet**; its 24 h → 94 XP matches the original's 95.
Throughput sanity: endgame live throughput must stay within ~1–2k plates/hr of the researched
~760/hr anchor — the spawn-interval floor (8 s) and seat counts are the ceiling; the v1 ~7,800/hr
economy is rejected. Some themed cookbooks require their **themed stove** ($-priced) whose
**"Reinforced" upgrade (6 Toxin)** gates that book's final 6 dishes, adds +1 D and −5% cook time
on that stove (researched Toxin-upgraded special stoves, restored).

---

## 8. Serving topology — original restored (NO counter-batching)

**The finished batch SITS ON THE STOVE and is served from there.** The stove stays occupied — no
new cook on it — until the batch is exhausted or burns. Counters, tables, and sinks are
**dispatch stations only**; the invented counter-batch move, the "burn clock stops on counters"
safe zone, the per-counter parallel-batch economy, and the "rescue run" are all deleted. Stoves,
not counters, are the production cap (fidelity + the throughput math depends on it).

**Tap-to-dispatch (research-exact, incl. the table target):** tap a zombie or the chef, then tap
a **counter, sink, table, or READY stove** → the server enters the matching mode (serving homed
to that station / bussing / floor-move). Servers auto-carry plates from READY stoves to seated
customers, collect coins at the table, bus dirty plates to sinks, and **freeze motionless when
their path is blocked** (`BLOCKED_RECLAIM_S 3` before task release). Seat capacity = table+chair
adjacency; each customer consumes exactly one serving. Customer FSM: door → queue (max 2,
`QUEUE_PATIENCE_S 20`) → seat → order (2 s) → wait (`FOOD_PATIENCE_S 45`) → eat (8 s) → pay →
leave. Payment (one composition, in `DishMath`):

```
payment = perServing · (1 + 0.06 · Tips) · ratingMult(R)      // ratingMult = 1 + R/200
tip     = payment − perServing                                 // reported on 'plate-delivered'
```

Coins enter the economy ONLY via the lint-enforced allowlist: `ServeSystem.deliver`,
`OfflineSettle`, raid loot, Special-machine passive income, quest/catering rewards, pity grant.
API names: `addCash / spendCash / addToxin / spendToxin` (the `addCoins`/`addBrains` names die).

**Offline serving (1× — the 25% nerf is deleted; research: the closed-app sim served at full
closed-rate and pillar 2 says offline earnings matter):** per stove, over
`[max(readyAtUtc, saveAt), min(burnAtUtc, now)]`:

```
throughputPerMin = min(seatCount, serversInServingMode, 60 / spawnIntervalSec(R at save))
sold             = min(servingsLeft, floor(throughputPerMin · windowMinutes))
cash            += sold · perServing        // no tips / no ratingMult offline (attended-play flavor)
xp              += sold · xpPerServing
```

No customers or patience simulated offline; no S deltas offline (except the staff incident −2).
To earn while away you must dispatch servers before leaving and return within the burn window —
the original's contract. The offline-determinism AC is split (stove timers settle == live-tick;
serving throughput has its own golden + `offlineEarnings ≤ maxLiveEarnings` inequality).

**Furniture lifecycle × live sim (interaction matrix, enforced via a `canRemove(id)` hook):**
stove non-IDLE → storage blocked ("finish or scrape first" toast); chair with seated customer →
blocked until they leave; sink/counter targeted by an in-flight task → allowed, task released and
server re-arbitrates; door → never removable. Grandfathered seated customers finish eating if
their table is edited around them.

---

## 9. Zombie canon — stats, tiers, energy, slots, leveling

**Roster:** 105 collectible occupations (compressed from the researched 225; logged) in 5 rarity
tabs 30/30/20/15/10. Identity = the infected customer's occupation; stats carry over. Derivation
lives in `src/sim/staff/StaffStats.ts` only (the service loop's interim tips/speed mapping is a
pre-M6 shim, deleted the milestone StaffStats lands):

```
Energy (base) = baseHP                                   // 70–320
Power  (1–12) = clamp(round(baseAttack · 12 / 45), 1, 12)
Tips   (1–12) = clamp(round((infectionChance − 0.18) · 55), 1, 12)
Speed  (1–12) = catalog value; +1 at zombie levels 5/10/15
Focus  (1–12) = clamp(1 + rarity·2 + floor(Tips/6) + floor(Power/6), 1, 12)
Roles: Server if Tips ≥ 7 and Tips ≥ Power+2 · Fighter if Power ≥ 5 and Tips ≤ 4 · else Neutral
```

**Infect action:** tap a **seated or queued** customer (design choice, logged — research says
only "tap them, then tap Infect") → infect card → pay the tier cost → instant conversion. No
food-spiking. Cost tiers (research-shaped): **Free** (30 commoners, cafe L1–5) · **Cash**
$200–$2,000 (30, L4+) · **Toxin-low** 1–4 vials (20, L8+) · **Toxin-mid** 6–15 vials
(15 supernaturals, L12+) · **Toxin-high** 20–50 vials (10 legends, L15+). Gates: cafe level +
rating (§5 bands and per-zombie `minStars` on 0–100). Every infection removes a paying diner —
the original's economic tension.

**Chef:** constant `chef_avatar` — Tips 3 / Speed 5 / Power 4 / Energy 90 / Focus 12; energy
never depletes in cafe work (raids only); gains no levels.

**Working slots:** `slots(L) = min(14, ceil(0.7·L))` — 1 at L1 (research), 14 hard max at L20.
The "2 at L1" and "12th at L22" ladders are deleted. **Meat Locker** (bench) from cafe L2:
5 hooks default, +5 hooks per 5 Toxin, 19 expansions, 100-hook max.

**Energy (ACTIVITY clock, §3; rates per real foreground minute; background = ÷12):**

| Activity | Fg rate | 90-energy commoner lasts | Bg rate (closed) |
|---|---|---|---|
| COOKING (staffing a stove) | −0.8 | ~112 fg min | −0.067 (12 h ≈ −48) |
| SERVING | −2.0 | ~45 fg min | −0.167 (only while the settler has them serving) |
| BUSSING | −1.2 | ~75 fg min | −0.10 |
| DAYDREAM / IDLE | 0 | — | 0 |
| RESTING | +36 | full refill 2.5 fg min | +3.0 (90 refill in 30 min closed) |
| EXHAUSTED (collapsed) | +18 | — | +1.5 |

**Offline cooks don't require continuous staffing — staffing gates start/resume only** (the
idle-pillar rescue; acceptance test: a fresh 90-energy commoner staffing a 12 h cook offline
completes it). Serum Barrel multiplies the three drain rows by 0.8. Live feral (energy 0):
zombie attacks a customer, ALL customers flee unpaid, −6 S; offline incident −2 S, zombie rests.
Warning fires at 15% energy. **Daydream:** exponential interval, mean `75 + 15·Focus` fg
seconds (Focus 1 ≈ 90 s — the researched "every 1–2 min"); **Focus ≤ 4 never auto-resumes**
(manual tap, original re-tasking texture — covers every Free commoner); Focus ≥ 5 auto-resumes
after 25 s; no daydream rolls during offline settlement.

**Zombie leveling:** cap **15** (raids' cap-10 / +4%/level / `baseHP×1.6` schema deleted;
`raidHP = maxEnergy(level)`). `maxEnergy = round(baseEnergy · (1 + 0.05·(level−1)))` (+5%/level,
research-exact; L15 top legend = 544). XP: +1/plate delivered, +5/completed cook, +2/raid enemy
defeated (research-exact), +10/raid boss; `xpToNext(L) = round(25·L^1.5 / 5)·5`. Level-up refills
energy. **Combining** (cafe L10, M10a): merge identical zombies, max **4 marks**, each mark
+10% max Energy, +6% Tips, +6% Power (applied in one place over StaffStats base).

**Zombiepedia (Progression owns; Infection renders):** 4 states — Undiscovered → Sighted (on
spawn) → Infected → Mastered (4 marks). Empty state at 0/105 is authored.

---

## 10. Speed canon — one module

`src/engine/move/speed.ts` (engine hosts the module; the staff spec owns the zombie formula's
calibration). All four rival formulas are deleted; Service §8.5 round-trip math and Raids TTK
tables are **regenerated** from these exports:

```
zombieTilesPerSec(Speed) = clamp(0.45 + 0.09·Speed, 0.5, 1.55)   // 0.54 @1 … 1.53 @12; default stat 7 ≈ 1.08
CUSTOMER_SPEED        = 2.0      // humans stride; zombies shuffle — the contrast is the point
CUSTOMER_ANGRY_SPEED  = 2.6
RAIDER_FLEE_SPEED     = 2.2
```

(The service-loop tuning rows `CUSTOMER_TILES_PER_S 1.6 / ANGRY 2.1` are superseded.) Per-segment
speed noise ±10% from seeded `mulberry32` per walker id. Shamble dressing (bob/sway/corner
rounding) is view-only; reduced-motion suppresses bob/sway.

---

## 11. Toxin economy — earned only (FREE game)

Two currencies only: **Cash** (soft) and **Toxin vials** (hard). "Brains" never existed in the
original and is fully purged (migration §14). **No IAP anywhere** (Pillar 3) — the researched
$4.99–$99.99 packs are deliberately not reproduced; faucets are retuned generous
(**15–25 vials/week engaged, vs the original's ~1–2**; logged deviation). `STARTING_CASH 300 ·
STARTING_TOXIN 5` (research). Ledger file: `src/data/toxinLedger.json` — the single source for
every faucet cap and sink price; the Monte-Carlo weekly-budget CI test lives here only.

**Faucets:**

| Faucet | Amount / cap |
|---|---|
| Tutorial (staged, §16.5) | 8 vials total, week 1 (16 steps; "3 hoardable vials" variant deleted) |
| Daily review board — first bonus star of the day | 1/day |
| Cook streak "Frequent Fryer" | day 3 +1; day 7 +3; every further 7 consecutive days +3; one 24 h grace token per 30 days; >24 h dishes count on start day (original rule). Researched 10-day/4-vial cadence densified — logged. |
| Raids (drop mechanics in raid spec; boss-tier odds 8–35% × 1–2) | **EV 4–6/wk, hard cap 8 per rolling 7 days; over-cap converts to +$100** |
| Milestones (one-time): 25/50/100/200 recipes 2/3/4/6 · Zombiepedia tabs complete 3/4/5/6/8 · full 105 = 15 + unique statue (+10 D) · each expansion tier 1 (×10) · first combine 1 / first 4-mark 3 · first pet 1 / all 9 pets 5 · each themed book 21/21 = 2 (×9) · rating 60/80/100 = 1/2/3 · Regulars 1/3/10 = 1/1/1 | ≈2–5/wk amortized, first 2 months |
| Seasonal event quest lines | 2 each (~0.5/wk amortized) |

**Sinks:**

| Sink | Price |
|---|---|
| Instant-finish a cook | `max(1, ceil(remainingHours × 0.75))` (flat-1 and 1/2/3/5/8 tier variants deleted) |
| Un-burn (≤60 s after burn) | 1 |
| Instant energy refill | 1 |
| Skip 8 h revive | 1 |
| Premium infects | 1–50 by zombie (research-anchored tier shape) |
| Variation unlock | 5 each / 45 all-nine per recipe (research-exact) |
| Meat Locker +5 hooks | 5 (max 19 expansions → 100 hooks) |
| Expansion Toxin alternates | 10–130 (§2) |
| Themed-stove "Reinforced" upgrade | 6 each (×9 = 54) |
| Daily-task bribe | 2 (research-exact reviewer bribe) |
| Boosters | Turbo 5 · Super 10 · Hyper 20 (2×/3×/5× cook speed, 300 s) |
| Premium pets | Wolf 8 · Phoenix 12 · Dragon 20 |
| **Magic Fridge** | 30 — once per local day, tap → a full READY batch of any unlocked non-rare dish materializes (price waived, normal burn window); resets midnight, doesn't bank |
| **Industrial Barrel of Zombie Serum** | 50 — all zombie energy **drain** rates ×0.8, permanent, applies to future recruits |
| Toxin-only rare "House Special" dish | 25 |
| Premium furniture variants (+star recolors) | 1–75 per item (furniture data) |

Sink menu totals 500+ desirable vials vs ~80–100 earned/month — scarce-feeling despite generous
faucets. Passive-income Special machines (researched): Vending $16,000 or 8v → $25/hr cap $250 ·
Red Arcade $50,000 → $75/hr cap $1,000 · Slot Machine → $150/hr · Bank ATM 60v → $200/hr cap
$5,000 — hourly rate on the REAL clock, capped payout collected by tap, correct through offline
settlement.

---

## 12. Raids — PvE, 5 rivals, retaliation opt-in OFF

World map unlocks at cafe **L5** (`unlocks.json`; the L4 line is corrected). **5 permanent rival
AI cafes** (Build Order M9's "4" corrected) **+ 1 rotating seasonal event-cafe slot** (restores
the researched event-cafe hook; e.g., 4 of the rares live there). Rival cafes are `CafeGrid`
rooms — same format, renderer, pathfinding. Real-time tap-to-command auto-battle on the shared
A*/Walker (RAID input mode); combat is **unscaled real time** (no ACTIVITY clock inside raids);
melee = 4-neighbor adjacency. Enemy staff fight back (staff atkCooldown 1.8 s, boss 2.2 s);
customers flee and can be **eaten** (CENSORED bar + crunch SFX + bones): +cash and +20% of
victim energy. Boss aggro management (clear staff, boss last); white truce flag top-left retreats
any time, keeping loot so far. Kill cash: **$20 per staff/boss kill, $15–25 per customer eaten**
(research's "$20/customer" re-split so staff fights aren't pure cost; total per raid matches the
researched magnitude — logged). Losing still pays partial (eaten-first cash).

**Loot:** steal-the-counter-dish → **fridge** → serve once **or** permanently unlock (once per
recipe); above-level recipes are held-but-uncookable (research). Toxin drops from chefs/bosses
per the ledger cap (§11). **Variations drop from raids starting at M9** (research: raids are the
only variation source). **All 34 Rare dishes ship in data at M9:** 10 obtainable across the 5
launch cafes, 4 via the seasonal event cafe, 20 on a committed deferred-content allowlist that
the CI reachability test reads and that must shrink to zero by 1.0.

**Injury:** zombie at 0 raid HP → knocked out, **8 h real-clock revive or 1 Toxin** (offline-safe
via the OfflineEngine). `raidHP = maxEnergy(level)`; ATK derives from Power via the raid spec's
one formula; TTK tables regenerate from StaffStats fixtures (shared file, drift fails CI).

**Defense (the single recorded decision):** the original was strictly PvE — never raidable.
**Rival Retaliation ships opt-in, DEFAULT OFF** (settings toggle, first-trigger consent dialog,
capped cash-only stakes, never touches rating). A player who never opens settings gets the pure
PvE original. Recorded once, in Build Order §1.1; M9 scope and DoD reflect it. Raids never touch
rating (test-asserted).

---

## 13. Save schema — one version registry

The Build Order's ledger (§4.1 there, mirrored here) is the ONLY place version integers are
assigned. System specs say "fields land at the ledger-assigned version" — no absolute integers in
any system spec. One migration chain of pure `vN→vN+1` functions; committed fixture + round-trip
test per version; full v1→latest chain in CI forever; per-field fallback on malformed nested
data; **never a wipe**.

| Version | Milestone | Adds | Fixture |
|---|---|---|---|
| v1 | (legacy) | current pre-canon save | `saves/v1.json` |
| v2 | M0 | **Brains→Toxin: `toxin = min(brains, 99)`** (fresh saves start 5); schema header | `saves/v2.json` |
| v3 | M3 | layout {roomSize, floorTiles, wallSections, placements + idCounter, storage[]}; v2 seeds the starter layout | `saves/v3.json` |
| v4 | M4 | sim state, rng seed, lastSettledAt | `saves/v4.json` |
| v5 | M5 | dishes.v2 refs, playerXP/level, favorites, streak state | `saves/v5.json` |
| v6 | M6 | zombie roster/instances, slots, Meat Locker | `saves/v6.json` |
| v7 | M7 | rating S/D/B, energy, quests, toxin-ledger state | `saves/v7.json` |
| v8 | M9 | fridge, knockouts/revives, raid progress, retaliation flag | `saves/v8.json` |
| v9 | M10 | variations, collection, pets/tombstones/boosters, machines, catering, seasonal-seen | `saves/v9.json` |
| v10 | M11 | settings finalization, tutorial state | `saves/v10.json` |

`SAVE_VERSION` lives in `src/core/save/schema.ts` with the single lock/channel name constant.
The brains→toxin mapping is stated once (here): `min(brains, 99)` — the player-friendly rule;
the "capped at 5" variant is deleted.

---

## 14. Events registry — additive-only, publisher owns the payload

`src/core/events.d.ts` (+ human appendix `docs/spec/events.md`), owned by the Build Order.
System specs may **ADD** events, never rename or redefine one. **Rule: the publishing spec
authors the payload; the registry records it verbatim.** Resolved names:

- **`plate-delivered { serverId, customerId, dishId, cash, tip, xp }`** — THE canonical delivery
  event (the service loop publishes it; `serving-delivered` and `dish-collected` are deleted
  registry-wide; Build Order row 13's contrary pick is corrected — there is no collect-tap).
- `rating-changed { total, delta, breakdown: {s, d, b} }` (Progression publishes).
- One `customer-infected` payload (Infection publishes); `rating-delta` deleted in favor of the
  rating module's own API.
- `cafe-expanded { tier, width, height, doorMoved }`, `cafe-level-up { level, unlockedDishIds,
  unlockedFeatures }`, `zombie-level-up`, `zombiepedia-updated { zombieId, newState }`, raid
  events per the raid spec's list.

CI: every event name referenced in any spec exists in the map.

---

## 15. Presentation & pipeline constants (deltas resolved)

- **Character art = paper-doll rig** (6 parts, 2 authored facings + flipX; frames only for the
  three one-shot gags). The iso spec's per-character frame-sheet row is amended; escalation
  hatch: hand-picked walk frames for chef + 2 hero zombies. **Launch cast regenerates from
  `zombies.v2.json`** (infection's 105 roster — the presentation's Couch Potato/Politician/
  Supermodel list was stale). CI: every chars-atlas manifest id exists in zombies.json.
- **Download budgets — one file** (`Tools/budgets.json`, one CI script): playable shell (JS +
  ui/fx/room atlases + fonts) **≤ 2.5 MB**; total streamed-behind-splash **≤ 8 MB**; @2× atlases
  + bgm lazy **≤ +6 MB**. Both prior gates superseded.
- **Perf ACs:** relative CI budgets (scene-update cost < K× an in-process calibration loop, under
  4× CPU throttle) + generous absolute ceilings (3× target) + a manual per-milestone device
  checklist (one iPhone, one mid Android) recorded in the milestone PR. Raw "<4 ms on CI" and
  "60 fps on Snapdragon 730" ACs are replaced by this method.
- Wall art, floor masters, ghost tint/glyphs, depth — all authored against IsoConfig (§1);
  `register_sprite.py` rejects any deviation.

---

## 16. The gaps spec (completeness critic's demands — all resolved)

### 16.1 Save durability & storage-failure UX (M0/M3, not M11)
localStorage disabled/throws (Safari private mode) → in-memory session + persistent banner [M0].
`QuotaExceededError` → toast + auto-download of save JSON [M0]. Corrupt-unparseable → offer
"download broken save" **before** any wipe [M0]. Corrupt-but-parseable layout (OOB placements) →
quarantined to Storage + toast, never dropped [M3]. `navigator.storage.persist()` at boot;
**iOS Safari ITP 7-day eviction mitigation:** on a Safari UA after ≥5 days absent, the
welcome-back card prompts an export [M3]. **Export/import buttons ship at M3** in the v0
settings gear. Fault-injection tests (throwing storage stub) for all paths.

### 16.2 Browser support matrix (engineering-infra)
Support = **last-2 Chrome/Edge/Firefox + Safari/iOS 16.4+**. Playwright runs **chromium AND
WebKit** boot/loop smokes from M1. iOS specifics owned there: WebAudio gesture unlock, `pagehide`
saves, safe-area insets, DPR-aware canvas.

### 16.3 Settings spec (`settings.md`; v0 at M3, full at M8b)
v0 [M3]: export/import save, mute. Full [M8b]: per-channel audio volumes + mute; reduced motion
(disables shake/vignette/parallax; bob/sway); colorblind assists (bubble shapes, ✓/✕ glyphs on
placement ghosts, signed rating deltas, energy-bar icon ≤15%) — glyph+number redundancy is
always-on; quality tier Auto/Low/High (particle budget 200→60, DPR clamp); purist toggles (aggro
ring off; **Retaliation — default OFF**); notification opt-in; language (en); copy-anonymized-
stats; reset-save; keyboard navigation (Tab/Enter/Esc) for all panels.

### 16.4 Licensing & IP (`licensing.md` + repo `LICENSE`, M0)
Code **MIT**; art/audio assets **CC BY-NC 4.0**; README homage disclaimer ("unaffiliated
fan-inspired remake; Zombie Cafe © Capcom/Beeline Interactive; no assets from the original are
used"). **Position on names (the canon ruling):** game mechanics and stat numbers are not
protectable; short names/titles are not copyrightable, and the game has been delisted for years
in a free, noncommercial fan remake — so the **original dish names ship by default** (Pillar 1;
Mystery Meat, Hobo Delight, Dishwater Soup, Sloppy 'Joe', Escargut, … at their classic slots,
§7). **Rename fallback is engineered, not hoped for:** every original-name entry lives in
`src/data/dishNames.json` with a committed same-register `altName`; a `NAME_SET` build flag flips
the entire menu in one line, and CI asserts every original name resolves through that file.
Build Order §2.9's blanket "no verbatim name ships" is superseded by this ruling; its denylist
test inverts to "every original name is flag-flippable." Distinctive **trade dress stays out**:
rival cafe names, the occupation roster (infection's 105 custom archetypes stand), and all art/
audio are original to this project. `public/art/CREDITS.md` logs generator + date + ToS clause
for every generated asset (manifest-build-enforced); OFL fonts listed. Final per-name owner
sign-off recorded in licensing.md.

### 16.5 Onboarding — staged early (not M11)
Tutorial ships **in stages with its systems**: M5 core loop (tap stove → pay → burn ring → tap
zombie → tap counter → first delivery — "a new player earns coins within 60 s" smoke runs every
milestone from M5); M6 infect step; M9 raid step; M11 is only polish + skip/replay + Union Rep
personality pass. One reward source: `quests.json` — 16 steps, **8 Toxin total** (the "3
hoardable vials" variant deleted). Narrated by the Zombie Union Rep. First daily review board
appears at L6 with the bonus-star goal loop.

### 16.6 0-cash soft-lock prevention (pity, not a sell path)
Storage stays non-destructive and **nothing is ever sold** (researched signature). Instead:
when `cash < cheapest unlocked dish price` AND no stove is COOKING/READY, the Union Rep comps
one free cook of the cheapest unlocked dish ("Union bylaws say I can't let the fryer go cold."),
at most once per trigger condition. Property test: **no reachable state has zero income paths.**

### 16.7 Return hooks without push (M5)
While hidden, `document.title` cycles the soonest deadline ("Ready in 12m — Deadbeat Diner" /
"READY — burns in 3h"); favicon badge swap on READY; **opt-in** (settings-gated) local
Notifications at dish-ready and burn-T−30 min while a tab exists. True push (no tab) is
explicitly out of scope — burn windows (3×–5×) are tuned to tolerate that.

### 16.8 Telemetry, i18n, deploy hygiene
**Zero analytics** — no network calls; advertised in the README as a feature; balance tuning via
the deterministic sim harness + an optional "Copy my anonymized stats" clipboard button.
**English-only for 1.0**; all strings in `src/data/strings/en.json` (no inline literals).
Deploy: content-hashed atlas/manifest filenames; service worker (M11) network-first for
`index.html` + skipWaiting with reload prompt; stale-tab cross-deploy safety via the versioned
write lock (§3); manifest fetch failure → retry ×3 → friendly error screen; atlas 404 →
placeholder frame + toast (unillustrated-but-reachable content is never invisible).

### 16.9 Empty states & input arbitration
Every zero-data screen has authored copy (empty Storage, empty fridge, Zombiepedia 0/105, pre-L5
world map, Chef-only roster, stubbed store tabs). Input: one explicit mode stack
`DEFAULT → ZOMBIE_SELECTED | EDIT | PANEL | RAID` (`input-modes.md`, authored M2): pan > 8 px
cancels tap-intent; Esc/tap-empty pops one mode; tap a customer while `ZOMBIE_SELECTED` =
dispatch, **never** the infect card (infect requires DEFAULT); tap a stove while selected =
assign; EDIT suppresses sim taps; PANEL is modal. Any spec adding a pointer consumer must claim
a slot there.

### 16.10 Seasonal events & social substitutes
Local-clock seasonal event cafes/quest lines (`events.json`, M10b) — no backend; 4 rares live
there; seasonal wall/floor skins + 1 quest line each (2 Toxin). The deleted friends layer gets
single-player substitutes (logged deviation): **Wandering Vendor** (rotating recipe orders — the
"order from friends" path) and **Regulars** (named repeat customers with milestone vials 1/3/10 —
the friend-milestone faucet).

---

## 17. Deviation log (canon-level; each entry owner-visible)

| Deviation from research | Ruling & rationale |
|---|---|
| No IAP; Toxin faucets ~10× the original's rate | Pillar 3 (free game). Scarcity preserved by a 500+-vial sink menu. |
| L1–5 cook times 15 s–3 min (original floor: 2 min) | Pillar 2 hybrid pacing; original stat lines preserved as curve anchors, not L1 values. |
| Level cap 22 vs original 20→23 (ladder compressed from L100) | Same 97-dish ladder, denser; content data tops at L22. |
| 11 cookbooks vs researched 21 | 97 + 9×21 + 34 = 320 exactly; each themed book gets an identity. |
| Roster 105 vs researched 225; custom occupation names | Content scope + licensing; rarity structure and Free/Cash/Toxin tiers preserved. |
| 5 rival cafes vs ~4; kill-cash split staff/customers | Content scoping; per-raid totals match researched magnitude. |
| Rival Retaliation exists at all (opt-in, default OFF) | Owner request; purist default preserves pure PvE. |
| Burn floor 90 s; un-burn 1-vial mercy; pity comp; seated-or-queued infect; daydream auto-resume for Focus ≥ 5 | Usability modernizations, each logged; bundle-playtested at M7 so the game doesn't play itself. |
| Streak cadence 3/7-day vs 10-day/4-vial; friend faucet → Regulars | Pillar 3 generosity; no backend. |
| Interior expansion tiers square; endpoints 7×8 / 17×16 near-square | Research endpoints kept verbatim. |
| Door on the front edge | Research is silent; engine math + diorama readability decide. |

---

## 18. Amendment ledger (what each spec must patch to match canon)

| Spec | Amendments |
|---|---|
| 01 iso-engine | Speed module path is `src/engine/move/speed.ts` with §10's exports (its text already matches). Keep: 128×64, WALL_H 192, front door, starter layout, 4-connected (tile,dir) A*, storage-only removal. |
| 02 service-loop | Replace tuning rows `CUSTOMER_TILES_PER_S 1.6 / ANGRY_TILES_PER_S 2.1` with imports from the speed module (§10); regenerate §8.5 round-trip math. Keep: serve-from-stove, 1× offline, dish generator + original-name spine, plate-delivered. |
| 03 infection-staff | Speeds file path corrected to `src/engine/move/speed.ts`; combining "out of scope v1" reads "lands M10a per Progression". Keep: StaffStats, energy table, slots, cap 15. |
| 04 progression | None material — rating, XP, unlock ladder, expansion costs, Toxin ledger, Zombiepedia as written are canon. |
| 05 raids | Keep as written (5 cafes, ledger-capped Toxin, retaliation §9 per the recorded decision); melee stays 4-neighbor. |
| 06 presentation | Keep rev-2 corrections (WALL_H 192, 64×224 sections, 48 px targets, budgets.json, cast from zombies.v2.json). |
| 07 build-order | Row 10: delete "offline serve throughput 25%" (canon 1×, §8) and "touch target 44px" (canon 48 px, §1); row 13: canonical delivery event is **plate-delivered** (§14); §2.9: name policy superseded by §16.4 (original dish names ship, flag-flippable); M11 "44px audit" → 48 px audit. Everything else (ledger §13, milestones, M-R pass) is canon. |

*End of canon. Change control: edits to this file require an entry in §17 or §18 and a version
bump in the doc header; CI treats a restated canon constant anywhere else in `docs/spec/` or
`src/` as a build failure.*
