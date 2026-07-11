# 00 — CANON (Deadbeat Diner single-authority registry) — **Rev 3**

**Status:** BINDING. This document is the arbiter for every shared constant, formula, table, and
contract in the plan. Where any of `01`–`07` disagrees with this file, **this file wins** and the
system spec must be amended (amendment list in §18). Specs may elaborate mechanics they own; they
may never restate a number that lives here except by key reference.

**Rev 3** closes the two rev-2 verification contradictions — the entity-depth tie **window**
created by per-1/16 floor quantization, and the §3-vs-§8 offline-clamp scope split — with the
§19b changelog mapping each to its fix. **Rev 2** fixed every item from the first verification
pass (§19a). Per change control, every numeric change across revs is covered by a §17, §18, or
§19 entry.

**Decision bias, in order:** (1) fidelity to `original_game_research.json` (the only fidelity
source — legacy Unity code is NOT one); (2) owner pillars — faithful + modern usability, HYBRID
pacing (snappy L1–5, real 1–3-day idle bets at high level), FREE game / Toxin earned-only,
isometric engine first (pure TS `src/engine/`, Phaser-free); (3) engineering simplicity.

**Structural rule (the disease this file cures):** one source per number. Machine-checked from
M0/M1: `Tools/artconfig.json` deep-equals `IsoConfig` exports; `src/sim/tuning.ts` key coverage;
save-ledger ↔ spec front-matter agreement; events-map coverage; starter-layout invariants;
CI grep-gates against deleted scales (0–1000 / 0–50 rating, 64×32 tiles, `FOREGROUND_TIME_SCALE`).

**Rounding, once for the whole repo:** `round()` = half away from zero (JS `Math.round` for
positive values); `round2(x)` = `round(100·x)/100`. Every table in this file is computed with
these rules — a verifier recomputing any row must land on the committed digit.

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
| Entity depth | **`2000 + 16·floor(fx+fy+0.5) + (isCharacter ? 8 : 0)`** — fx/fy sampled from the **logical trajectory** (§1.2), never the corner-rounded render offset. Furniture keys on its footprint's **maximum-(fx+fy) tile** (front corner — an integer sum), so furniture depths ≡ 0 (mod 16) and character depths ≡ 8 (mod 16): **a character↔furniture tie is arithmetically impossible**, mid-step included. | **Rev-3 fix:** rev-2's `floor((fx+fy)·16) + 8` tied furniture depth 16s over the whole window fx+fy ∈ [s−0.5, s−7/16) — a ~1/16-tile-sum (several-frame) tie on every furniture pass. Quantizing the **sum** first (round-to-nearest via `floor(x+0.5)`) removes the window entirely and keeps the flip where rev 2 intended it: exactly **one** depth flip per furniture pass, at fx+fy = s−0.5, aligned with `logicalTile`'s 0.5 switch (§1.2). Character↔character ties (same quantized sum) break by stable entity-id order. AC-swept, and the sweep asserts zero character↔furniture depth equalities over a full footprint pass at 1/64-tile sampling. |
| Zoom clamps | `ZOOM_MIN 0.4 · ZOOM_MAX 2.0 · DEFAULT_FIT_ZOOM_FLOOR 0.75` | 0.5–1.5 and 0.5–2.0 variants deleted. |
| Input thresholds | `TAP_VS_PAN_PX 8 · CAMERA_MARGIN_PX 96` | |
| Touch target minimum | **48 × 48 CSS px** | 44px references superseded (Presentation §0.2 wins; stricter). |
| Pathfinding | **4-connected only**, A* over `(tile, arrivalDir)` states with turn penalty; start state = virtual no-direction (first step free); start cell always treated walkable (seated actors can path out) | Build Order M2's diagonals deleted; raid melee = **4-neighbor adjacency** (range rule, not pathing). |
| `MAX_LIVE_CATCHUP` | **5 s** | Lives in IsoConfig; callers must route larger accumulated dt through the OfflineEngine (§3). |

**Door (decision — research is silent on door placement):** exactly one door tile on a **front
edge** (`tx=W−1` or `ty=H−1`), default `(⌊W/2⌋, H−1)`. The door cell can never be occupied.
Spawn/despawn at the door with an off-grid walk-in from `door + outwardNormal × 1.2` (render-only).
Rationale: the engine's spawn math, starter layout and AC suite derive from it; an open-front
diorama never hides arrivals; it keeps both back walls free for the researched wall-decor surface.
Presentation's "NE back-wall door" paragraph is deleted; the door asset is a front-edge door mat +
frame. Flip-to-back change surface is documented in 01 §3.2 if period screenshots ever surface.

### 1.1 Published module contracts (the cross-spec boundary)

`src/engine/contracts.ts` is published at **M2** (Build Order M2 DoD) and is the **only** interface
any sim may import from the engine. **Engine names win** (engine-first pillar); the service spec's
`src/iso/` path and `isWalkable(x,y)` / `footprintTiles()` / `doorTile()` / `findPath → Tile[]|null`
signatures are deleted (§18 row 02):

```ts
// src/engine/contracts.ts — published M2; consumed verbatim by 02/03/05
export interface Tile { x: number; y: number }
export interface Placement {
  id: PlacementId; defId: string; origin: Tile; rot: 0 | 1 | 2 | 3; footprint: Tile[];
}
export interface ICafeGrid {
  readonly width: number; readonly height: number;
  walkable(t: Tile): boolean;
  placements(): ReadonlyArray<Placement>;
  itemAt(t: Tile): PlacementId | null;
  door(): Tile;
}
export interface PathResult { tiles: Tile[]; cost: number }
export interface IPathfinder { findPath(from: Tile, to: Tile): PathResult | null }
```

**No shipped stubs (findings' fix adopted verbatim):** the service spec's StubGrid adapter
workstream and the infection spec's tween-placeholder/straight-line-fallback actors are **deleted**.
The build order already sequences the engine (M1–M2) before both consumers (M5–M7); sims unit-test
against a ≤10-line **in-test** fake of `ICafeGrid` — never a shipped adapter file.

**Lint boundary, one rule:** the no-Phaser ESLint boundary covers `src/engine/**` and `src/sim/**`.
**RaidSim relocates from `src/raid/` to `src/sim/raid/`** so the rule actually applies (§12, §18).

### 1.2 Engine determinism & AC hygiene (resolves the three open engine findings)

- **Logical trajectory.** A walker's logical trajectory is piecewise-linear, tile-center to
  tile-center. Corner rounding (0.35-tile blend), bob and sway are **render-only offsets** and are
  never read back by depth, collision, `canPlace`, or tile sampling. `logicalTile` = the current
  segment's origin tile while segment progress < 0.5, its destination tile at ≥ 0.5. The §1
  entity-depth key `16·floor(fx+fy+0.5)` flips at the same 0.5 boundary — depth changes and
  `logicalTile` changes are the same event, by construction.
- **AC-20 restated (falsifiable):** with corner rounding enabled, sampling `logicalTile` every
  frame over the golden 12-tile path yields exactly the path's tile sequence — each tile entered
  exactly once, none skipped, no off-path tile ever returned. (The old "sampled positions on tile
  centers" wording was unfalsifiable under continuous interpolation; a naive position sampler
  fails a correct implementation.)
- **Mid-step re-plan (deterministic, encoded in AC-14):** a mid-step walker always **completes the
  committed step, then re-plans from that tile**; idle / pre-commit walkers re-plan from
  `currentTile()`. If the committed destination tile itself became unwalkable (possible only via
  expansion re-derivation or door relocation — `canPlace` forbids placing onto committed tiles),
  the walker reverses to the segment's origin tile and re-plans from there.
- **AC renumbering:** spec 01's AC list is renumbered to unique consecutive ids — the second
  duplicate "AC-11" becomes **AC-23**; §12 risk #5's stale "round-trip AC-11/12" citation is
  re-pointed at the renumbered save round-trip AC; docs-lint asserts AC-id uniqueness in spec 01.

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
regenerated from this layout + `tuning.ts` (§18 row 04).

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

**Gate vs wallet — confirmed intended (regenerated walkthrough).** Level gates are permissions,
not entitlements: research prices are kept verbatim, so the wallet lags the gate exactly as it did
in 2011. Arithmetic from §5/§7/§8: early live net income ≈ 181 servings/hr × (≈$1.27 payment −
$0.60 dish cost) ≈ **$120/hr**; session one ends near L4–5 holding ≈ **$450–550** (including the
$300 start). Tier 1 ($3,500, gate L2) is therefore a **day-2–3** purchase after the first
overnight batches; tier 2 ($25,000 or 10 Toxin, gate L4) lands **end of week 1** and is the first
real cash-vs-Toxin decision (an engaged week-1 player holds 15–25 vials, §11). Progression's
regenerated first-two-hours walkthrough must include this wallet-vs-gate table for tiers 1–3
(§18 row 04). No CI invariant — this is pacing, not correctness.

Each purchase grants the 1-Toxin milestone and fires one `cafe-expanded` event.
**Atomic expansion ordering:** grid re-derivation → door re-validation (stays if still legal on
the new perimeter, else relocates to default with a toast) → exactly one event after the grid is
consistent → subscribers rebuild in priority order (SeatIndex → TaskQueue claim release →
in-flight walker re-plan per §1.2) → save write. No listener may mutate the grid re-entrantly.

---

## 3. Time model — two clocks, defined once

Owned by `docs/spec/simulation-core.md`; every other spec cites this section.

| Clock | Governs | Rule |
|---|---|---|
| **REAL (wall-clock)** | Cook timers, burn deadlines, customer patience, bonus-star 72h expiry, streak day-keys, S gain-rate cap window, revive timers, Magic Fridge/catering daily windows, seasonal windows | Absolute UTC timestamps (`readyAtUtc`, `burnAtUtc`). Never scaled, foreground or background — **and never clamped** (see clamp scope below). This is what makes offline settlement one code path. |
| **ACTIVITY** | Zombie energy drain/regen, daydream rolls, serving throughput | **Authored foreground-native (1×)**. Backgrounded/closed, activity time advances at `ACTIVITY_OFFLINE_FACTOR = 1/12` of real time (inside the researched 10–15× "foreground runs faster" band). Unit-tested invariant: foreground rate per real second = exactly 12× background rate, per activity. |

Deleted: Build Order M4's global `FOREGROUND_TIME_SCALE=10` (it accelerated cook timers, which
the original never did), the service loop's v1 "no acceleration anywhere," and `DEMO_TIME_SCALE`.
Test acceleration is an **injected `Clock`** (`RealClock` prod / `SteppableClock` tests); the
Playwright harness build exposes `window.__sim.advance(ms)`, guarded out of production bundles by
a CI grep.

**Offline settlement — one `OfflineEngine`:**
`elapsedActivity = clamp(now − lastSaveUtc, 0, OFFLINE_CLAMP_DAYS = 7 days)` (14-day variant
deleted) — one clamped value shared by every activity settler.

**Clamp scope (binding — the rev-3 ruling, one sentence):** the 7-day clamp bounds
**ACTIVITY-clock settlement only** — energy drain/regen and collapse timestamps, S decay, and the
offline serving-**budget** accrual window `[lastSaveUtc, budgetWindowEnd]` where
`budgetWindowEnd = lastSaveUtc + elapsedActivity` — while **every REAL-clock timestamp settles on
unclamped absolute UTC**: stove READY/BURNT transitions and the per-stove serving-window endpoints
`readyAtUtc`/`burnAtUtc` (§8), revive countdowns, bonus-star expiry, and streak day-keys. So §4's
216 h burn windows really are safe 9-day bets: a stove whose burn falls after `budgetWindowEnd`
still burns (or survives) at its true `burnAtUtc`; the clamp bounds offline **income**, never burn
physics. Settlers run in fixed order:

1. **Service settler** — stoves reach READY/BURNT on unclamped absolute stamps; offline serving
   draws budget only inside the clamped budget window (§8).
2. **Staff settler** — energy at background rates over `elapsedActivity`; collapse timestamps
   computed; feral incidents **per the §9 ruling: dispatched (serving/bussing) zombies only —
   cooking collapses are incident-free and never block cook completion.**
3. **Raid timers** — revive countdowns (REAL clock, unclamped), retaliation resolution if opted in.
4. **Bonus-star expiry** (REAL clock, unclamped; before decay, so the report shows both).
5. **S decay** — on `elapsedActivity`: untouched first 24h, then −1.0 per additional 12h, floor 5.
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
(logged usability modernization: kills the mis-tap trap on 15 s dishes). The 30-minute boundary is
**inclusive in the 4× band** (research: "6–30 min dishes at 4×") — a 30 m dish burns at 120 m,
never 90 m. Burn forfeits the dish and its full paid price; **burn is wallet-only — zero rating
change** (no source supports a rating hit). Burn windows — not an arbitrary hour cap — are the
offline earnings ceiling, exactly as in 2011. A 72 h cap dish has a 216 h (9-day) burn window, so
multi-day absences are safe bets; absolute timestamps make multi-visit stewardship across several
settlements correct. **Burn deadlines are REAL-clock and are never clamped by the 7-day
offline-activity clamp (§3 clamp scope) — only offline serving-budget accrual is clamped.**
Pause/resume is supported mid-cook (paused stoves never advance or burn).
Un-burn mercy: 1 Toxin within 60 s of a burn (adopted — on-pillar friction removal).

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
| Feral incident during offline settlement (§9 ruling: dispatched zombies only) | −2.0 |
| Dish burns | 0 (wallet-only) |
| Gain cap | +6.0 per rolling wall-clock hour |

**Decay:** offline only — S untouched for the first 24 h away, then **−1.0 per additional 12 h,
floor 5**, applied by the OfflineEngine settler on the clamped `elapsedActivity` (§3); welcome-back
report shows the red (or green) blink. "No passive decay" is retracted; decay is a researched
signature.

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
At starting R = 15 the interval is 19.9 s ⇒ **ceiling ≈ 181 customers (= servings) per hour**;
at R = 100 the 8 s floor gives **450/hr** — these two numbers anchor §2, §6 and §8.

---

## 6. Cafe Level — one XP curve (cap 22)

Owned by Progression, stored in `src/data/unlocks.json`. The `6·L^2.4` cap-20 curve, the
`ceil(30·1.35^(n−2))` cap-30→100 curve, **and rev-1 canon's `0.62·(T/60)^0.69` per-dish curve**
are all deleted (§17, §19). **Cap 22** (the original's cap was 20, raised to 21–23 by patches;
our content data tops out at L22 — the 97-dish General ladder is the original's L1–100 ladder
compressed, same order, denser. This resolves "L1–30": levels above 22 do not exist).

**Dish XP (the only cafe-XP formula in the repo — per-serving model):**

```
xpPerServingCenti = round(105 · (T/60)^−0.10)          // integer centi-XP per serving, a committed dish stat
totalXP           = round(servings · xpPerServingCenti / 100)
```

All XP arithmetic is integer centi-XP — no float drift, no rounding knife-edges; every anchor row
in §7 is recomputable by hand. **Grant timing:** `xpPerServingCenti` is credited **per serving
delivered** on the canonical `plate-delivered` event (and per offline-sold serving, §8), accrued
in a centi-XP accumulator. There is **no collect-tap** anywhere (servers carry dishes off the
stove); the 30%-on-collect split is deleted. Burned servings grant 0 XP. The profit-based
`0.35·profit^0.85` formula stays deleted (it double-counts the economy and inverts the meta).

**Fidelity position (cited honestly):** research's original per-dish XP lines — Mystery Meat
2 m → 1 XP, Dishwater Soup 15 m → 5, Leftunders 8 h → 65, Gello Mold 12 h → 60, Sloppy 'Joe'
1 d → 95, Tumor Melt 2 d → 150, Escargut 2 d → 200, Fetidccine 3 d → 220 — are **shape anchors
only**: in both the original and our model, XP-per-hour-of-cook-time declines as T grows (short
dishes are the leveling engine, long dishes the convenience engine — the original meta). Absolute
XP is re-based to the per-serving model because hybrid pacing retuned every cook time; deviation
logged in §17.

**xpToNext table (authored table IS the formula; committed in `unlocks.json`):**

| L | XP | L | XP | L | XP | L | XP |
|---|---|---|---|---|---|---|---|
| 1 | 25 | 7 | 270 | 13 | 1,450 | 19 | 4,800 |
| 2 | 40 | 8 | 380 | 14 | 1,800 | 20 | 5,700 |
| 3 | 60 | 9 | 520 | 15 | 2,200 | 21 | 6,700 |
| 4 | 90 | 10 | 700 | 16 | 2,700 | 22 | (cap) |
| 5 | 130 | 11 | 900 | 17 | 3,300 | | |
| 6 | 190 | 12 | 1,150 | 18 | 4,000 | | |

Cumulative: to L5 = **215** · to L10 = **1,705** · to L16 = **9,905** · to L18 = **15,905** ·
to L22 = **37,105**.

**Pacing (arithmetic, not vibes — all four inputs now agree):** at starting R = 15 the spawn
ceiling is 181 servings/hr (§5); L1 dishes carry 1.05–1.21 XP/serving (§7 anchors), so live XP
income is ≈ 120–210 XP/hr. Therefore: **L4–5 in session one** (cum 215 ≈ 60–90 min; L2 falls
≈ 10 minutes in) · **L10 end of week 1** (cum 1,705 ≈ 8–12 live hours) · **L16–18 around day 30**
(weeks 2–4 add 400–700 XP/day as evening/overnight batches come online: e.g. a 4 h dish ≈ 258
totalXP) · **L22 in weeks 7–10** for an engaged player (endgame ≈ 800–1,200 XP/day: one fully
sold Sloppy 'Joe' batch = 692 XP + live play). The **3–4-month completionist goal** is the full
set — 105/105 Zombiepedia, all variations, 4-mark masters — not the level cap. Level-up: modal +
`level × 50` coins; pauses the ACTIVITY/customer sim, never cook clocks.

**Unlock ladder (single unlock authority — key gates):** L1 General Cookbook (6 dishes, table §7)
+ Zombiepedia + chef · L2 **Meat Locker** (5 hooks) + Expansion tier 1 + favorites · L3 Decor tab ·
L4 themed book 1 + walls/floors painting · **L5 Raiding + Wandering Vendor** · L6 review tasks /
bonus stars + themed book 2 · L8 themed book 3 + **Pets** · L10 themed book 4 + **combining** ·
**L12 / L14 / L16 / L18 / L20 themed books 5–9** (nine books, nine gates — the rev-1 off-by-one is
fixed) · L21 expansion tier 10 · L22 final General dishes (72 h cap dish).
Raid-spec's L4 unlock and infection's L1 Meat Locker are corrected to cite this ladder.
**Working slots** follow the infection formula (§9), shown derived here only.

---

## 7. Dish economy — one generator, original menu restored

`Tools/retune-dishes.ts` → `src/data/dishes.v2.json` is the **only** dish authority (six-stat
model: Level, Price, Cook Time, Servings, Total Earnings, Total XP; profit = earnings − price).
Build Order M5's rival re-anchoring to verbatim 2011 stat values is deleted — Pillar 2's hybrid
bands win over the original's 2-minute floor; the original's published stat lines survive as the
**crosswalk validation anchors** (`docs/spec/dish-crosswalk.md`) for curve *shape*, not as shipped
L1 values.

**Catalog structure (generator inputs, CI-asserted):** 320 dishes = **General 97 + 9 themed
books × 21 + Rare 34** (11 cookbooks — logged deviation from the researched 21 books; 97+9×21+34
is the clean fit). Up to **15** pinned favorites.

**Variations (research-exact nine; land at M10a).** 10 versions per recipe (Normal + 9):

| Variation | Effect (base stats re-derived, §7 rounding) |
|---|---|
| Spicy | totalXP ×1.10 |
| Very Spicy | totalXP ×1.20 |
| Quick | cook time ×0.90 |
| Very Quick | cook time ×0.80 |
| Fancy | price ×1.15 · perServing ×1.25 (min +1) |
| Very Fancy | price ×1.30 · perServing ×1.50 (min +2) |
| Bulk | price ×2 · perServing ×2 · totalXP ×2, same cook time |
| Frozen | cook time ×2 · price ×0.75 |
| Fresh | burn window ×1.5 |

Spicy/Very Spicy/Bulk/Frozen/Quick/Very Quick are research-exact; Fancy/Very Fancy/Fresh
magnitudes are quantified where research is qualitative ("higher price, higher earnings", "can sit
longer before burning") — logged §17. Rev-1's invented "Jumbo" is deleted; Very Fancy is restored;
Fresh's burn-window meaning is restored. perServing multipliers (not raw earnings multipliers)
keep `totalEarnings % servings === 0` true for every variation row.

**Variation acquisition (the composition ruling — resolves the rev-1 ambiguity):** raids are the
**only source** of the nine **variation manuals** (one per variation type, global; drop table in
§12). Owning a manual lets you unlock that variation on any owned recipe for **5 Toxin per recipe**
(**45 Toxin = all nine on one recipe**, requires all nine manuals). Both 2011 facts survive
verbatim: "raiding is the only way to get dish variations" AND "unlock a variation for 5 Toxin,
45 for all nine." Faucet side is §12; sink side is §11; there is no third path.

**Names (fidelity + licensing §16.4):** the 97-dish General spine ships the **original 2011 menu
by name** — Mystery Meat is the tutorial dish; the ladder runs through Handburger & Flies,
Rot Dogs, Green Eggs & Sam, Hobo Delight, Dishwater Soup, Leftunders, Gello Mold, Sloppy 'Joe',
Tumor Melt, Escargut, Fetidccine, and caps at **Yucky-soba** — with the **original relative
time-order preserved** (Hobo Delight 5 m before Dishwater Soup 15 m in 2011 → 3 m before 8 m here;
rev-1's swap is corrected, §17). The repo's pun catalog (Finger Fries, Brainstem Bisque, …) fills
the 9 themed books, Rare slots, and General filler rows (filler names below marked \*, project-
original). Every dish row carries `displayName` + same-register `altName`; a `NAME_SET` build flag
flips the whole menu in one line (§16.4).

**Closed forms (`T` = cook seconds, `L` = level; rounding per the header rule):**

```
servings          = clamp(round(12 · (T/60)^0.65), 4, 1900)
PER_SERVING       = [—,1,1,2,2,2, 3,3,3,4,4, 5,5,6,6,7, 8,9,10,11,12, 13,14][L]  // $/serving by level
totalEarnings     = PER_SERVING · servings
margin            = min(0.5, 0.42 · (T/60)^−0.15)      // cap binds only below T ≈ 19 s
priceRaw          = max(1, round(totalEarnings · (1 − margin)))
xpPerServingCenti = round(105 · (T/60)^−0.10)          // §6
totalXP           = round(servings · xpPerServingCenti / 100)

// deterministic post-pass — ONE pipeline; committed table === post-passed output:
//   per level, ascending T (ties by dishId):
//     while profitPerHr(d[i]) > profitPerHr(d[i−1]):  price[i] += 1     // profit floor 1
```

**Profit/hr invariant (stated honestly — rev-1's "strictly decreases" was unsatisfiable on
integers):** in the continuous model, `profit/hr ∝ T^(0.65−0.15−1) = T^−0.5` within a level —
strictly decreasing wherever the margin cap is disengaged (T ≥ ~19 s); the generator asserts this
numerically over all 320 **pre-rounding** values. Committed **integer** rows must be
**non-increasing** in profit/hr within a level (ties legal — integer granularity at sub-minute T
makes strict decrease degenerate), enforced by the post-pass above. CI regenerates the table and
deep-equals it against the committed file — no dual pipeline.

CI invariants over all 320: continuous profit/hr strictly decreasing within level (pre-rounding);
integer profit/hr non-increasing within level; committed table === post-passed generator output;
newest tier's shortest dish beats every idle dish per hour; `totalEarnings % servings === 0`
(incl. all variation rows); every T in its level band; book counts exact; every reachable dish has
an icon or the specced placeholder.

**Committed L1 General book (all 6 rows — the post-pass chain is closed and hand-checkable) and
anchor rows (post-passed generator output; † = adjusted by the post-pass, all other rows are
asserted raw == post-passed by the generator's CI run):**

| dishId | Name | Lv | Cook | Price | Srv | $/srv | Earn | Profit | $/hr | XP | Burn |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dish_mystery_meat | Mystery Meat *(tutorial)* | 1 | 15s | 3 | 5 | 1 | 5 | 2 | 480 | 6 | 90s |
| dish_gutter_gruel | Gutter Gruel\* | 1 | 20s | 4† | 6 | 1 | 6 | 2 | 360 | 7 | 100s |
| dish_handburger_flies | Handburger & Flies | 1 | 30s | 5† | 8 | 1 | 8 | 3 | 360 | 9 | 150s |
| dish_toenail_tots | Toenail Tots\* | 1 | 40s | 5 | 9 | 1 | 9 | 4 | 360 | 10 | 200s |
| dish_curdled_custard | Curdled Custard\* | 1 | 50s | 6 | 11 | 1 | 11 | 5 | 360 | 12 | 250s |
| dish_rot_dogs | Rot Dogs | 1 | 60s | 7 | 12 | 1 | 12 | 5 | 300 | 13 | 300s |
| dish_green_eggs_sam | Green Eggs & Sam | 2 | 90s | 10 | 16 | 1 | 16 | 6 | 240 | 16 | 450s |
| dish_hobo_delight | Hobo Delight | 3 | 3m | 32 | 25 | 2 | 50 | 18 | 360 | 24 | 15m |
| dish_dishwater_soup | Dishwater Soup | 6 | 8m | 96 | 46 | 3 | 138 | 42 | 315 | 39 | 32m |
| dish_leftunders | Leftunders | 10 | 30m | 326 | 109 | 4 | 436 | 110 | 220 | 82 | **120m** |
| dish_gello_mold | Gello Mold | 13 | 45m | 650 | 142 | 6 | 852 | 202 | 269 | 102 | 135m |
| dish_sloppy_joe | Sloppy 'Joe' | 20 | 24h | **13,976** | 1,356 | 12 | 16,272 | **2,296** | 96 | 692 | 72h |
| dish_escargut | Escargut | 21 | 48h | **21,559** | 1,900 | 13 | 24,700 | **3,141** | 65 | 893 | 144h |
| dish_yucky_soba | Yucky-soba *(cap)* | 22 | 72h | **23,417** | 1,900 | 14 | 26,600 | **3,183** | 44 | 855 | 216h |

($/hr column display-rounded. † raw closed forms gave 3/3 at 20 s and 4/4 at 30 s — both 480+/hr,
violating non-increasing vs their predecessor; the post-pass bumped each price by 1–2. Leftunders'
burn is **120 m** — 30 m sits in the inclusive 4× band, §4; rev-1's 90 m row is corrected.)

Sloppy 'Joe' is again a **14k-cash overnight bet** (original: L6, $1,500 → $2,550, 850 servings,
95 XP at 1 day — re-slotted to L20/24 h per §17). Endgame live throughput ceiling is 450 plates/hr
(8 s spawn floor, §5) — same order of magnitude as the researched ~760/hr anchor; the v1 ~7,800/hr
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
closed-rate and pillar 2 says offline earnings matter).** The throughput budget is **global —
one shared pool, not per stove** (rev 2; a per-stove budget would let multi-stove offline play
exceed the live ceiling and break the inequality AC below):

```
elapsedActivity  = clamp(now − saveAt, 0, 7 days)              // §3 clamp scope
budgetWindowEnd  = saveAt + elapsedActivity                    // budget accrues ONLY in [saveAt, budgetWindowEnd]
budgetPerMin     = min(seatCount, dispatchedServers, 60 / spawnIntervalSec(R at save))
// stoves settle in readyAtUtc order, each drawing from the shared budget over
//   [max(readyAtUtc, saveAt), min(burnAtUtc, budgetWindowEnd)]
// — readyAtUtc/burnAtUtc are UNCLAMPED absolute REAL-clock stamps (§3 clamp scope); only the
// budget end is clamped. The Staff settler splits the window at server-collapse timestamps (§9)
// and recomputes dispatchedServers per segment.
sold     = min(servingsLeft, floor(budget available within the stove's window))
cash    += sold · perServing                // no tips / no ratingMult offline (attended-play flavor)
xpCenti += sold · xpPerServingCenti         // §6
```

**Stove state on return is judged against unclamped `now`:** a batch un-sold past
`budgetWindowEnd` sits on the stove until its true `burnAtUtc` — return inside the burn window
(§4: up to 216 h) and the remainder is live-servable; miss it and it burns (wallet-only). The
clamp therefore bounds offline **income** — never READY/BURNT physics — which is exactly what
makes the inequality AC below provable. No customers or patience simulated offline; no S deltas
offline except the §9 dispatched-collapse incident (−2). To earn while away you must dispatch
servers before leaving and return within the burn window — the original's contract. The
offline-determinism AC is split (stove timers settle == live-tick; serving throughput has its own
golden + the `offlineEarnings ≤ maxLiveEarnings over the clamped window` inequality, which the
global budget + clamped budget window make provable).

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
| COOKING (staffing a stove) | −0.8 | ~112 fg min | −0.067 (0 at ≈ 22.4 h closed) |
| SERVING | −2.0 | ~45 fg min | −0.167 (0 at ≈ 9.0 h; only while the settler has them dispatched) |
| BUSSING | −1.2 | ~75 fg min | −0.10 |
| DAYDREAM / IDLE | 0 | — | 0 |
| RESTING | +36 | full refill 2.5 fg min | +3.0 (90 refill in 30 min closed) |
| EXHAUSTED (collapsed) | +18 | — | +1.5 |

**Offline cooks don't require continuous staffing — staffing gates start/resume only** (the
idle-pillar rescue). **Offline collapse & the feral incident, re-derived (rev 2 — the two rules
now compose exactly):**

- **COOKING collapse ⇒ no incident, cook completes.** Offline, a cooking zombie drains at the
  background rate until 0, then silently collapses to EXHAUSTED (+1.5/min regen) at the computed
  collapse timestamp. A closed cafe has no customers to menace, so there is **no feral incident
  and no S delta**; the cook continues unstaffed and **always completes** — the completion
  guarantee is unconditional and is never voided by a collapse. Worked example (committed
  acceptance test): a fresh 90-energy commoner starts a 72 h cook and the tab closes — collapse at
  ≈ 22.4 h, back to full energy by ≈ 23.4 h, cook READY at exactly 72 h, zero incidents; the
  welcome-back report shows the nap, not a penalty. (The 12 h-cook variant completes with the
  zombie still at ≈ 42 energy — also incident-free.)
- **DISPATCHED collapse ⇒ the −2 S incident.** The offline feral incident triggers **only** when
  a dispatched (serving- or bussing-mode) zombie hits 0 during the offline serving window
  (bg −0.167/min ⇒ a 90-energy server lasts ≈ 9 h). Effect: −2.0 S once (max one incident per
  zombie per settlement; S floor 5 unchanged), the server leaves the shared throughput budget at
  its collapse timestamp (§8 splits the window there), then rests. It never cancels, delays, or
  burns any cook.
- No other offline state can produce an incident. Live feral (energy 0 while customers present)
  is unchanged: zombie attacks a customer, ALL customers flee unpaid, −6 S.

Serum Barrel multiplies the three drain rows by 0.8. Warning fires at 15% energy. **Daydream:**
exponential interval, mean `75 + 15·Focus` fg seconds (Focus 1 ≈ 90 s — the researched "every
1–2 min"); **Focus ≤ 4 never auto-resumes** (manual tap, original re-tasking texture — covers
every Free commoner); Focus ≥ 5 auto-resumes after 25 s; no daydream rolls during offline
settlement.

**Zombie leveling:** cap **15** (raids' cap-10 / +4%/level / `baseHP×1.6` schema deleted;
`raidHP = maxEnergy(level)`). `maxEnergy = round(baseEnergy · (1 + 0.05·(level−1)))` (+5%/level,
research-exact; L15 top legend = 544). XP: +1/plate delivered, +5/completed cook, +2/raid enemy
defeated (research-exact), +10/raid boss; `xpToNext(L) = round(25·L^1.5 / 5)·5` (zombie XP —
distinct from cafe XP, §6). Level-up refills energy. **Combining** (cafe L10, M10a): merge
identical zombies, max **4 marks**, each mark +10% max Energy, +6% Tips, +6% Power (applied in
one place over StaffStats base).

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
rounding) is view-only per §1.2; reduced-motion suppresses bob/sway.

---

## 11. Toxin economy — earned only (FREE game)

Two currencies only: **Cash** (soft) and **Toxin vials** (hard). "Brains" never existed in the
original and is fully purged (migration §13). **No IAP anywhere** (Pillar 3) — the researched
$4.99–$99.99 packs are deliberately not reproduced; faucets are retuned generous
(**15–25 vials/week engaged, vs the original's ~1–2**; logged deviation).
`STARTING_TOXIN 5` (research: "players start with ~5 Toxin"). `STARTING_CASH 300`
(**decision — research documents no starting-cash figure**; sized to ≈100 starter cooks so
tier-1 expansion stays a day-2–3 goal, §2; logged §17). Ledger file: `src/data/toxinLedger.json` —
the single source for every faucet cap and sink price; the Monte-Carlo weekly-budget CI test lives
here only.

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
| Variation unlock (**requires that variation's raid-drop manual, §7/§12**) | 5 per variation per recipe / 45 all-nine on one recipe (research-exact) |
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
rooms — same format, renderer, pathfinding. **RaidSim lives at `src/sim/raid/`** (moved from
`src/raid/`) so the single no-Phaser ESLint boundary over `src/engine/**` + `src/sim/**` covers it
(§1.1). Real-time tap-to-command auto-battle on the shared A*/Walker (RAID input mode); combat is
**unscaled real time** (no ACTIVITY clock inside raids); melee = 4-neighbor adjacency. Enemy staff
fight back (staff atkCooldown 1.8 s, boss 2.2 s); customers flee and can be **eaten** (CENSORED
bar + crunch SFX + bones): +cash and +20% of victim energy. Boss aggro management (clear staff,
boss last); white truce flag top-left retreats any time, keeping loot so far. Kill cash: **$20 per
staff/boss kill, $15–25 per customer eaten** (research's "$20/customer" re-split so staff fights
aren't pure cost; total per raid matches the researched magnitude — logged). Losing still pays
partial (eaten-first cash).

**Loot:** steal-the-counter-dish → **fridge** → serve once **or** permanently unlock (once per
recipe); above-level recipes are held-but-uncookable (research). Toxin drops from chefs/bosses
per the ledger cap (§11). **All 34 Rare dishes ship in data at M9:** 10 obtainable across the 5
launch cafes, 4 via the seasonal event cafe, 20 on a committed deferred-content allowlist that
the CI reachability test reads and that must shrink to zero by 1.0.

**Variation manuals (drop side of the §7 ruling; from M9):** nine manuals, raid-only.
Staff-tier victory drops (12% per victory): **Spicy / Quick / Fancy / Frozen / Fresh** from cafes
1–5 respectively. Boss-tier drops (20% per boss kill): **Very Spicy / Very Quick / Very Fancy /
Bulk** from cafes 2–5 bosses. All nine drop from the 5 permanent cafes — no core mechanic is
seasonal-gated; the event cafe re-rolls its drop, and a duplicate manual converts to +$250.
CI reachability asserts all nine manuals obtainable at M9.

**Injury:** zombie at 0 raid HP → knocked out, **8 h real-clock revive or 1 Toxin** (offline-safe
via the OfflineEngine; revive stamps are REAL-clock and unclamped, §3). `raidHP =
maxEnergy(level)`; ATK derives from Power via the raid spec's one formula; TTK tables regenerate
from StaffStats fixtures (shared file, drift fails CI).

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
| v8 | M9 | fridge, knockouts/revives, raid progress, variation manuals, retaliation flag | `saves/v8.json` |
| v9 | M10 | variation unlocks, collection, pets/tombstones/boosters, machines, catering, seasonal-seen | `saves/v9.json` |
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
Mystery Meat, Hobo Delight, Dishwater Soup, Sloppy 'Joe', Escargut, … at their §7 slots).
**Rename fallback is engineered, not hoped for:** every original-name entry lives in
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
| **Cafe XP re-based to the per-serving model (§6)** | Hybrid pacing retuned every cook time, so original absolute XP (MM 2m→1, Dishwater 15m→5, Leftunders 8h→65, Gello 12h→60, Sloppy 1d→95, Tumor 2d→150, Escargut 2d→200, Fetidccine 3d→220) can't transplant; both curves keep the researched meta (XP-per-cook-hour declines with T). Rev-1's `0.62·(T/60)^0.69` curve — and its misattributed "8h→44" citation — are deleted. |
| **STARTING_CASH 300 is ours** (research documents only the ~5 starting Toxin) | Sized to ≈100 starter cooks; keeps tier-1 expansion a day-2–3 goal (§2). |
| **Iconic dishes re-slotted to retuned levels/times** (Sloppy 'Joe' L6/1d → L20/24h; Hobo Delight L1/5m → L3/3m; Dishwater Soup L2/15m → L6/8m; …) | Pillar 2 bands; **original relative time-order preserved** (rev 2 restores Hobo-before-Dishwater). |
| **Fancy / Very Fancy / Fresh magnitudes quantified** (price ×1.15/×1.30, perServing ×1.25/×1.50, burn ×1.5) | Research is qualitative for these three; the other six variations are research-exact. Rev-1's invented "Jumbo" deleted; Fresh's burn-window meaning restored. |
| **Variation acquisition composed as manuals-from-raids + 5-Toxin per-recipe unlock (§7/§12)** | Research states both "raids are the only variation source" and "5 each / 45 all-nine"; the manual layer is our composition of the two verbatim facts. |
| **Integer profit/hr invariant is non-increasing, not strict (§7)** | The continuous curve strictly decreases (∝T^−0.5); at sub-minute T, 1-coin granularity makes strict decrease degenerate. Deterministic post-pass, single pipeline, † rows visible. |
| L1 filler dish names (Gutter Gruel, Toenail Tots, Curdled Custard) | Project-original pun-catalog names; only researched names carry the §16.4 ruling. |
| Level cap 22 vs original 20→23 (ladder compressed from L100) | Same 97-dish ladder, denser; content data tops at L22. |
| 11 cookbooks vs researched 21 | 97 + 9×21 + 34 = 320 exactly; each themed book gets an identity. |
| Roster 105 vs researched 225; custom occupation names | Content scope + licensing; rarity structure and Free/Cash/Toxin tiers preserved. |
| 5 rival cafes vs ~4; kill-cash split staff/customers | Content scoping; per-raid totals match researched magnitude. |
| Rival Retaliation exists at all (opt-in, default OFF) | Owner request; purist default preserves pure PvE. |
| Burn floor 90 s; un-burn 1-vial mercy; pity comp; seated-or-queued infect; daydream auto-resume for Focus ≥ 5 | Usability modernizations, each logged; bundle-playtested at M7 so the game doesn't play itself. |
| **Offline cooking collapse is incident-free (§9)** | Derived, not researched: research documents live feral only; a closed cafe has no victims, and the staffing-gates-start/resume ruling (idle pillar) requires completion to survive a collapse. |
| **7-day offline clamp bounds activity settlement only; REAL-clock stamps never clamped (§3)** | Derived, not researched: the original had no clamp; ours exists purely to bound offline income (the ≤-live-ceiling AC). Clamping burn physics would retract the 9-day-safe overnight-bet contract (Pillar 2), so REAL-clock stove/revive/expiry stamps stay absolute. |
| Streak cadence 3/7-day vs 10-day/4-vial; friend faucet → Regulars | Pillar 3 generosity; no backend. |
| Interior expansion tiers square; endpoints 7×8 / 17×16 near-square | Research endpoints kept verbatim. |
| Door on the front edge | Research is silent; engine math + diorama readability decide. |

---

## 18. Amendment ledger (what each spec must patch to match canon)

| Spec | Amendments |
|---|---|
| 01 iso-engine | Speed module path `src/engine/move/speed.ts` (§10). **Publish `src/engine/contracts.ts` at M2 with §1.1's signatures** — `walkable(t)` / `placements()` / `door()` / `findPath → PathResult\|null` are THE names. **Renumber ACs uniquely** (second duplicate AC-11 → AC-23; §12 risk #5's stale "AC-11/12" citation re-pointed to the renumbered save round-trip AC). **Restate AC-20** on the logical trajectory (§1.2). **Mid-step re-plan:** complete the committed step, re-plan from that tile; idle walkers from `currentTile()`; encode in AC-14 (§1.2). **Entity depth is `2000 + 16·floor(fx+fy+0.5) + (isCharacter ? 8 : 0)` with the furniture front-corner (max fx+fy) anchor — rev-2's `floor((fx+fy)·16)` key is superseded (rev-3 tie-window fix, §1); the depth AC sweep asserts zero character↔furniture equalities at 1/64-tile sampling.** Keep: 128×64, WALL_H 192, front door, starter layout, 4-connected (tile,dir) A*, storage-only removal. |
| 02 service-loop | **Import `ICafeGrid`/`IPathfinder` from `src/engine/contracts`** — the `src/iso/` path and `isWalkable(x,y)` / `footprintTiles()` / `doorTile()` / `Tile[]\|null` signatures are deleted. **Delete the StubGrid adapter workstream** (unit tests use a ≤10-line in-test fake, §1.1). Replace tuning rows `CUSTOMER_TILES_PER_S 1.6 / ANGRY_TILES_PER_S 2.1` with speed-module imports (§10); regenerate §8.5 round-trip math. **Offline serving budget is global AND accrues only inside the §3 clamp window** — the per-stove window ends at `min(burnAtUtc, budgetWindowEnd)`, while `readyAtUtc`/`burnAtUtc` themselves stay unclamped absolute stamps (rev 3, §3/§8). Keep: serve-from-stove, 1× offline, plate-delivered. |
| 03 infection-staff | Speeds path `src/engine/move/speed.ts`. **Delete the tween-placeholder / straight-line-fallback workstream** — M6 builds on the real Walker (M2 precedes it; in-test fakes only, §1.1). Adopt the §9 offline collapse/feral ruling verbatim (collapse timestamps compute on the clamped activity clock, §3). Combining "out of scope v1" reads "lands M10a per Progression". Keep: StaffStats, energy table, slots, cap 15. |
| 04 progression | **Adopt the rev-2 xpToNext table and per-serving XP model (§6)** — the rev-1 tables are superseded. **Themed books 5–9 gate at L12/L14/L16/L18/L20** (§6). **Regenerate the first-two-hours walkthrough** from the §7 anchors + starter layout, including the wallet-vs-gate table for expansion tiers 1–3 (§2). S decay runs on the clamped `elapsedActivity` (§3). Rating, expansion costs, Toxin ledger, Zombiepedia otherwise canon as written. |
| 05 raids | **RaidSim moves `src/raid/` → `src/sim/raid/`**; the no-Phaser ESLint boundary is one rule over `src/engine/**` + `src/sim/**` (§1.1, §12). **Add the nine variation-manual drops** per §12's table (staff-tier 12%, boss-tier 20%, duplicate → +$250). Revive countdowns are REAL-clock, unclamped (§3 clamp scope). Keep: 5 cafes, ledger-capped Toxin, retaliation opt-in OFF per the recorded decision, 4-neighbor melee. |
| 06 presentation | Keep rev-2 corrections (WALL_H 192, 64×224 sections, 48 px targets, budgets.json, cast from zombies.v2.json). Depth authored against the rev-3 §1 formula. |
| 07 build-order | Row 10: delete "offline serve throughput 25%" (canon 1×, §8) and "touch target 44px" (canon 48 px, §1); row 13: canonical delivery event is **plate-delivered** (§14); §2.9: name policy superseded by §16.4. **M2 DoD adds publishing `src/engine/contracts.ts`; the layer diagram and lint-rule text move raid sim under `src/sim/raid/`.** M11 "44px audit" → 48 px audit. Everything else (ledger §13, milestones, M-R pass) is canon. |

---

## 19. Changelog (verification traceability)

### 19a — Rev-2 fixes (first verification pass)

| Verification item | Fix |
|---|---|
| Contracts file never published; RaidSim outside lint boundary | §1.1 publishes `src/engine/contracts.ts` (engine names win); RaidSim → `src/sim/raid/` (§12); §18 rows 01/02/05/07 |
| Variation acquisition ambiguous (raids-only vs 5-Toxin price) | Drop-then-unlock manuals ruling: §7 (composition), §11 (sink), §12 (drop table), §17 (log) |
| Offline feral not re-derived under staffing-gates-start/resume | §9 ruling + worked examples (72 h cook: collapse ≈22.4 h, no incident, completes; dispatched collapse = the only −2 S trigger); §3 settler updated; §17 log |
| Spec-01 AC-11 duplicate / stale refs, unfalsifiable AC-20, re-plan origin "or" | §1.2 (renumber, logical-trajectory AC-20, complete-committed-step re-plan encoded in AC-14); §18 row 01 |
| Duplicated StubGrid + tween-placeholder scaffolding | Both workstreams deleted; ≤10-line in-test fakes only (§1.1); §18 rows 02/03 |
| Tier-1/2 affordability at gates unconfirmed | §2 "gate vs wallet" paragraph with regenerated arithmetic — confirmed intended; walkthrough requirement in §18 row 04 |
| Leftunders burn 90 m vs 4× band | 120 m; inclusive 30 m boundary stated in §4; row corrected |
| Sloppy 'Joe' / Escargut / Yucky-soba rows ≠ closed forms | Recomputed exactly: 13,976/2,296 · 21,559/3,141 · 23,417/3,183 (§7) |
| L1 profit/hr tie vs "strictly decreases" mandate | Invariant restated (continuous strict ∝T^−0.5, integer non-increasing); deterministic post-pass; full 6-row L1 book committed with visible † adjustments (§7) |
| 9 themed books over 8 gates | Books 5–9 at L12/L14/L16/L18/L20 (§6) |
| XP economy vs pacing claims off ~10× | XP re-based to per-serving centi model + new xpToNext; pacing derived arithmetically from the spawn table and anchor XP (§6); §17 log; §18 row 04 |
| Citation breaches (STARTING_CASH "(research)", Fresh, Jumbo/Very Fancy, "8h→44") | §11 decision tag; research-exact variation table (§7); honest XP citations (§6); §17 rows |
| (Self-caught) per-stove offline budget could exceed the live ceiling | Global shared budget, readyAtUtc allocation (§8) |

### 19b — Rev-3 fixes (second verification pass)

| Verification item | Fix |
|---|---|
| §1 entity depth `2000 + floor((fx+fy)·16) + 8` still produced EXACT furniture ties over the window fx+fy ∈ [s−0.5, s−7/16) — a ~1/16-tile-sum, multi-frame tie on every furniture pass, falsifying the "never ties mid-step" guarantee and the tie-free AC sweep | **Quantize the sum before scaling:** `2000 + 16·floor(fx+fy+0.5) + (isCharacter ? 8 : 0)`; furniture anchors on its footprint's max-(fx+fy) tile (integer sum). Character depths ≡ 8 (mod 16), furniture ≡ 0 (mod 16) ⇒ a tie is arithmetically impossible; the single flip stays at fx+fy = s−0.5, aligned with `logicalTile`'s 0.5 switch; depths stay integers (sort-key safe); AC sweep now asserts zero equalities at 1/64-tile sampling (§1, §1.2, §18 row 01). Character↔character ties break by stable entity-id. |
| §3 said the 7-day clamped `elapsed` is "one value for all settlers" while §8's per-stove serving window used unclamped `now` and §4 promised 216 h burn windows are safe 9-day bets — for absences > 7 days the sections prescribed different settled windows | **Clamp-scope ruling (§3, one binding sentence):** the clamp bounds ACTIVITY-clock settlement only (energy/collapse timestamps, S decay, serving-budget accrual via `budgetWindowEnd = lastSaveUtc + elapsedActivity`); every REAL-clock stamp — stove READY/BURNT, the §8 window endpoints `readyAtUtc`/`burnAtUtc`, revives, bonus-star expiry, streak day-keys — settles on unclamped absolute UTC. §8's window becomes `[max(readyAtUtc, saveAt), min(burnAtUtc, budgetWindowEnd)]` with stove state judged against unclamped `now`; §4 keeps (and now proves) the 9-day-safe claim; the income-bounding inequality AC is stated over the clamped window. §17 log row; §18 rows 02/03/04/05. |

---

*End of canon. Change control: edits to this file require an entry in §17, §18, or §19 and a
version bump in the doc header; CI treats a restated canon constant anywhere else in `docs/spec/`
or `src/` as a build failure.*

---

## M1 implementation addendum (owner note, engine-names-win)

§1.1's TypeScript block predates the shipped engine. Per this file's own rule ("**Engine
names win** (engine-first pillar)"), the published contract is `src/engine/contracts.ts`
**as implemented and tested** (49 unit tests):

- `Tile { tx, ty }` (not `{x, y}`); `Placement { id, itemId, kind, anchor, rot, footprint }`.
- `rot: 0 | 1` — sufficient for rectangular footprints; 4-way *visual facing* is placement
  metadata owned by the Presentation layer, not footprint geometry.
- `findPath(grid, query)` returns the discriminated union
  `{status:'ok', path} | {status:'blocked'} | {status:'invalid'}` (spec 01 §4.3 shapes).
- `CafeGrid` exposes `w/h`, `placementAt`, `placements(): ReadonlyMap`, `door()`.

Everything else in §1 (geometry, depth formula, roomBounds correction, thresholds,
4-connected pathing, MAX_LIVE_CATCHUP) is adopted verbatim — the engine was amended to
match this file where they disagreed (roomBounds maxY, entity-depth quantization).
