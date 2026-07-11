# build-order

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# Build Order — from v0.1 to the Definitive Modern Zombie Cafe

**Doc:** `docs/spec/build-order.md` · **Status:** approved plan (rev 2, post-review) · **Owner pillar coverage:** all four (fidelity, hybrid pacing, free/earned-Toxin, iso-foundation-first)
**Sources of truth:** `original_game_research.json` (scratchpad), the five audit lenses, `CLAUDE.md` charter. Where this doc and the research disagree, the research wins; where the research and the original's dated friction disagree, the locked pillars win. **Where this doc and any system spec disagree on a shared constant or contract, the Canon Registry (§2.1) wins — the system spec is in error and must be patched.**

**Rev 2 charter:** hostile review found that the six system specs, written in parallel, describe up to three different games (three time models, four rating scales, three XP curves, two dish catalogs, three expansion ladders, a save-version pileup). This revision makes the Build Order the plan's *constitution*: it names a single authority for every shared constant and contract, renumbers the save ledger it alone owns, and re-scopes milestones so no two specs can both claim a number again. **A one-week reconciliation pass (M-R, below) patches the six system specs to this document before any milestone after M0 starts.**

---

## 1. Design goals

1. **Dependency truth first.** The isometric engine (Pillar #4) is the substrate for placement, pathing, serving, decoration, expansion, raids, and depth-correct art. It is built in Milestones 1–2, before any economy or fidelity system, because every one of those systems would otherwise be built twice.
2. **One game, one number.** Every constant that two systems share lives in exactly one canon authority (§2.1). System specs cite keys, never restate values. CI enforces the machine-checkable subset. This is the structural fix for the review's core finding — "six excellent solo specs, not one plan."
3. **Always playable, always visibly better.** Every milestone ends with a deploy to https://qemmhd.github.io/zombie-cafe-game/. No milestone may leave the cook→earn loop broken on `main`. Risky rewrites happen behind a query-string feature flag (`?v2=1`) on a parallel scene and cut over only when the milestone's acceptance criteria pass.
4. **Days, not weeks.** Target size 2–7 working days per milestone. Anything bigger is split (M8 and M10 ship in two halves each).
5. **Fidelity order = recognition order.** After the engine, systems land in the order a returning fan would miss them: build/decorate → real cook economy → infection → energy/rating → art/audio → raids → collection meta. Onboarding is **staged with the systems it teaches** (M5/M6/M9), not deferred to launch.
6. **One migration chain, never a wipe.** Every save-schema change bumps `SAVE_VERSION` per the ledger in §4.1 — the *only* place version integers are assigned. A v0.1 save must still load at launch.

### 1.1 Fidelity notes vs the original (locked deviations — the complete log)

- **Toxin is earned-only** (quests, streaks, raids, milestones, catering) — no IAP ladder, no reviewer-bribe real-money analog, no cross-promo offers. Faucets are tuned generous (~15–25 vials/week engaged, ledger §4.6) because there is no revenue to protect. `docs/ROADMAP.md` Update 8's IAP store is stale and superseded (deleted in M0).
- **Hybrid pacing:** early dish band compressed (15s–3min at cafe L1–5) vs the original's 2min floor; the long band keeps — and per Pillar 2 slightly *extends* — authentic overnight bets: **8h–72h cooks at L21–22** (the original's 1–3-day Escargut/Fetidccine tier survives intact; burn windows make them safe to ship).
- **Content renamed, numbers preserved (IP decision, §2.9):** the original's dish/cafe/rival/rare names (Mystery Meat, Sloppy 'Joe', Gello Mold, Escargut, Gourmet Goblin, Drac's Snack Shack, Red Dragon, Blueberry Fangcake…) are **not shipped verbatim**. Their published six-attribute stat lines are preserved 1:1 as generator anchors under new same-register horror-pun names, with a committed internal crosswalk table. A fan will recognize every *number and beat*; the words are ours. (See Review note R4 — this rejects the fidelity critique's demand to ship the original menu by name.)
- **Social layer replaced, not deleted:** the original's three recipe sources were leveling, raids, and **ordering/sharing from friends** (plus GameCenter friend-milestone Toxin: 1 vial at 1 friend, +1 at 3, +1 at 10). No backend means no friends — the third path is replaced by the single-player **Union Catering Board** (M10a): once per day, permanently unlock one recipe you lack from a rotating 3-slot list at 3× its Price, with milestone vials at 1/3/10 lifetime orders mirroring the friend milestones. Logged as a deviation; the loop shape (a third, paced acquisition path + a small Toxin faucet) is preserved.
- **Seasonal content via local clock, not update drops:** the original tied rares to holiday event cafes (e.g. a rare from the Christmas Cafe) and ran themed content updates (Tiki, etc.). We ship the same *retention shape* with zero backend: date-windowed cosmetic sets + one quest line per season + a rotating sixth **Event Cafe** on the raid map (M10b). All content is permanent in data; only availability windows rotate. Logged as a deviation (windows vs updates).
- **Rival Retaliation ships opt-in, default OFF** (owner decision, recorded here and only here): the original was strictly PvE — you raided, nobody raided you. The remake adds an optional retaliation system (Raids spec §9) for players who want stakes; the default-off toggle keeps the pure-PvE original for purists. M9 scope and the Definition of Done reflect this. The previous "No defense mode" line in M9 is superseded.
- **Star-rating away-decay is IN** (−1.0 per 12h offline, floor at S-component ≥ 5): the research names decay-and-blink a signature retention hook. The Service Loop spec's "no passive decay" line is overruled and deleted at M-R. Burns remain **wallet-only** (no rating hit) — no source documents a rating penalty for burning.
- **No gacha** (JP-version feature; out of scope). **No true push notifications** (no backend) — burn windows are tuned to tolerate that; in-tab return hooks (§3-M5) substitute.
- **Modernization stack** (each individually logged): pity-floor anti-soft-lock, un-burn mercy (1 vial, 60s), tiered instant-finish pricing, daydream auto-resume (long, and OFF for Focus ≤3 zombies), patience pause while a plate is inbound, free raid Scout, feral 15%-energy warning. The *bundle* is playtested together at M7 (§3-M7) so the remake never plays itself.
- Everything else — pay-then-cook, 6-attribute dishes, burn bands 5×/4×/3×, tap-to-dispatch, freeze-when-blocked, seat gating, occupation-tier infection, energy/feral/CENSORED, two meters (Level + Rating), seven-tab store, per-tile floors/per-section walls, square expansion to 17×16, Meat Locker, variations-from-raids-only, Magic Fridge, serum barrel, Toxin-upgradeable themed stoves — is reproduced to the research's numbers.

---

## 2. Architecture target & cross-cutting canon

```
src/
  engine/        # PURE TS, zero Phaser imports (ESLint-enforced). Unit-tested in Node.
    IsoConfig.ts     # THE iso constants export (§2.1 row 1) — Tools/artconfig.json is generated from it
    IsoMath.ts       # tile<->world<->screen, 2:1 diamond, inverse picking
    CafeGrid.ts      # cell state, footprints, occupancy, walkability, expansion, moveItem (id-preserving)
    Pathfinder.ts    # A*, 4-connected ONLY (§2.1 row 12), re-plan API
    DepthSort.ts     # deterministic comparator + layer bands (engine spec owns the formula)
    contracts.ts     # published ICafeGrid/IPathfinder/etc. signatures — the ONLY interface source
  sim/           # PURE TS deterministic simulation (M4+). RaidSim lives at src/sim/raid/ (lint boundary applies)
    CafeSim.ts       # stoves/customers/servers/economy state; tick(dt); toJSON/fromJSON
    OfflineEngine.ts # THE offline/hidden settlement sequencer (§2.3)
    Clock.ts, Rng.ts # injected two-clock authority (§2.2) + seeded RNG
    speeds.ts        # zombieSpeed(stats) + CUSTOMER/ANGRY/FLEE constants (§2.1 row 11)
    tuning.ts        # every tuning scalar (§2.1 row 10) — generated table in docs/spec/canon.md mirrors it
    DishMath.ts      # the ONE payment/tip/rating-mult formula (§2.6)
  core/          # Phaser-free services: EventBus (typed, §2.5), Economy, SaveManager (DI)
    events.d.ts      # THE event-name/payload map — specs may ADD events, never rename/redefine
    save/schema.ts   # SAVE_VERSION (from ledger §4.1), lock name, storage keys
  scenes/, game/, ui/  # thin Phaser render/input adapters over engine+sim
    ui/strings.ts    # ALL user-facing strings (i18n decision §2.10)
  data/          # catalogs + runtime validators: dishes.v2.json, zombies.v2.json, expansion.json,
                 # unlocks.json, toxinLedger.json, quests.json, starterLayout.json, seasonal.json
docs/spec/       # one implementation-ready spec per system + canon.md + save-ledger.md
tests/           # vitest (engine/sim/core/data) + Playwright smoke (chromium + webkit)
```

**Layer rule (M0, ESLint `no-restricted-imports`):** `engine/` and `sim/` (including `sim/raid/`) import nothing from Phaser or `scenes|game|ui`; `core/` imports no Phaser; scenes may import anything. Coverage floor 90% lines on `engine/` + `sim/`; adapters are covered by the Playwright smoke.

### 2.1 Canon Registry — single authority for every shared constant

This table is normative. A system spec that restates a value from another authority's domain is *defective* and gets patched at M-R. `docs/spec/canon.md` is generated from the code-side authorities and diffed in CI.

| # | Domain | Single authority | Canonical values (summary) | Consumers (cite by key only) |
|---|---|---|---|---|
| 1 | Iso metrics | `iso-engine.md §2` → `src/engine/IsoConfig.ts` | TILE **128×64**; WALL_H **192**; wall section **64×224 @1x** (128×448 @2x); starter room **7×8**; max **17×16** (~272 tiles); zoom clamp **0.4–2.0** (default ≥0.75); depth bands FLOOR/WALL/ENTITY `key×16+sub`, FX **9000**; world size derived (presentation's 2112px example re-derived). `Tools/artconfig.json` is *generated* from IsoConfig; CI equality check from **M1**, not the art milestone. | presentation, build order, all art tooling |
| 2 | Door | `iso-engine.md §3.2` (amended at M-R) | Door on a **back edge** (`tx=0` or `ty=0`), default `(⌊W/2⌋, 0)` on the back-left wall — matches the original (research/presentation). Engine's front-edge rule, starter door tile, `setDoor` validation, spawn walk-in offset (into the room, toward camera) all flip in one commit with the AC. Door frame + mat art per presentation, authored for the back wall. | presentation, starterLayout, spawn logic |
| 3 | Rating | `progression.md` → `RatingMath` | **R = clamp(S + D + B, 0, 100)**: Service S (0–40, start 15), Decor D (0–45, from `furniture.json` star bonuses — Fine Painting +10 etc.), Bonus stars B (0–15, from review quests, persist through decay). Display = R/20 stars. Deltas: happy serve **+0.25**, angry leave **−1.5**, feral **−6**, burn **±0** (wallet-only). Away-decay **−1.0/12h** applied *after* bonus-star expiry (§2.3 step 8). Green/red blink on every change and in the welcome-back report. The 0–1000, 0–50, and 1–5-star scales are deleted everywhere; infection's occupation `minStars` column and the spawn table (§4.4) are regenerated onto 0–100. | service loop, infection, raids, HUD |
| 4 | XP / levels | `progression.md` → `src/data/unlocks.json` | Cafe level cap **22**; the explicit 21-row curve (30 … 47,000); dish `totalXP = round(0.62·cookTimeMinutes^0.69)` (validated vs original: 2m→1XP, 1d→95XP); XP granted **100% on delivery, pro-rata per serving** (the 30%-on-collect share is deleted — the serving loop has no collect-tap; one interaction model, stated in both specs). Service loop's `6·L^2.4`/cap-20 and this doc's old `ceil(30·1.35^(n−2))`/cap-30 are deleted. | service loop, dish generator, this doc M5 |
| 5 | Dish catalog | `dish-economy.md` → `Tools/retune-dishes.ts` → `dishes.v2.json` | **One generator.** Inputs: (a) service loop's closed-form curves as the math engine; (b) progression's book structure as counts — General **97**, 9 themed books × **21**, Rare **34** (=320, CI-asserted); (c) the 59 original published stat lines as exact anchors ($8/2m/12/$12/1XP tutorial dish; $1500/1d/850/$2550/95XP; $5500/2d/1100/$7700/200XP; $3200/3d/1900/$5700/220XP; …) under renamed dishes per §2.9, crosswalk committed at `docs/spec/dish-crosswalk.md`; (d) pacing bands §4.3 incl. the 24–72h top band. XP column from row 4's formula. CI: bands, counts, anchors, monotonic declining profit/hr — one test. | this doc M5, progression, presentation icons |
| 6 | Expansion | `src/data/expansion.json` (authored per research; progression spec *hosts* the doc section) | Research ladder verbatim, 11 tiers, always-square steps between near-square endpoints: **7×8 → 8×8 ($3,500) → 9×9 ($25,000 or 10🧪) → 10×10 ($75,000 or 30🧪) → 11×11 (40🧪 or cash-equiv) → … → 17×16 (130🧪 or cash-equiv)**; dual Cash-or-Toxin pricing on Toxin tiers per Pillar 3. Progression §8's legacy-Unity prices ($5k…$2.5M) are deleted — `legacy-unity/` is not a fidelity source; the research file is. Max room is **17×16** (engine ACs, presentation geometry, reachability tests all key to it; 16×17 deleted). Engine AC-7 re-pointed at the ladder's real first step (7×8→8×8). Square-room deviation (7×8 start) logged: endpoints are the researched values. | iso engine (exposes `expand(w,h)` only), this doc M3/M10a |
| 7 | Unlock ladder | `progression.md §2.3` → `unlocks.json` | All level gates: cookbook bands, working slots, Meat Locker (**L2**), raids (**L5**), quests (L6), expansion tier gates, store tabs. Every other spec cites `unlocks.json`. | all |
| 8 | Staff stats / energy / zombie levels | `infection.md` → `StaffStats.ts` | Stat derivations (incl. **Tips**, the single source); Energy = baseHP (70–320); working slots **`min(14, ceil(0.7·L))`** → 1 at L1, cap 14 (research: 1 → ~12 → 14); zombie level cap **15**, +5% energy/level, +1 Speed at 5/10/15. Raids derives `raidHP/ATK = f(StaffStats, level)` via one formula and re-runs its TTK tables; its `baseHP×1.6` schema addition and cap-10/+4% model are deleted. Service loop's §4.3 interim tips mapping is explicitly a **pre-M6 shim, deleted at M6**. | service loop, raids, this doc M6 |
| 9 | Toxin economy | `progression.md §5.4` → `src/data/toxinLedger.json` | THE ledger: every faucet and sink with price/cap (see §4.6). Raids spec owns its *drop mechanics* (boss 8–35% × 1–2 vials by tier, hard cap **8 per rolling 7 days**, over-cap → +$100) but its EV must land in the ledger's raid allocation (~6/wk); progression's competing 20%/2-per-day numbers deleted. Instant-finish price: **tiered 1/2/3/5/8 by remaining time** (service loop's table; flat-1 and `ceil(hours×0.75)` deleted). The 15–25/wk Monte-Carlo CI test runs once, against this file. | raids, service loop, this doc |
| 10 | Tuning scalars | `src/sim/tuning.ts` | STARTING_CASH **300** · STARTING_TOXIN **5** · starting rating **S=15 → R=15** · spawn intervals (§4.4) · patience windows · streaks (§4.6) · MAX_LIVE_CATCHUP **5s** · hidden threshold **60s** · offline clamp **7 days** · offline serve throughput **25%** · burn bands · touch target **44px**. Progression's §10 first-two-hours walkthrough is **regenerated from these constants** after M-R, with its assumed-constants header table so drift is visible. | all |
| 11 | Locomotion speeds | `src/sim/speeds.ts` (staff spec's formula) | `zombieTilesPerSec = 0.45 + 0.09·Speed` (0.72–1.53 — the only formula that makes the researched Speed 1–12 stat load-bearing); `CUSTOMER_SPEED = 2.0`, `ANGRY_SPEED = 2.6`, `FLEE_SPEED = 2.6` (humans stride, zombies shuffle). Engine's 1.1 clamp, service's ×0.6, raids' ×0.56, and this doc's old 0.6–1.1 are deleted; service §8.5 round-trip math and raid TTK tables recomputed from this module. | engine, service loop, raids |
| 12 | Movement model | `iso-engine.md` | **4-connected only**, everywhere — eliminates corner-cutting rules entirely. This doc's old M2 "diagonal with corner-cut prevention" AC is deleted; raid melee adjacency = **4-neighbor** (stated as attack *range*, not pathing; the "matching corner-cut rules" clause deleted). | raids, this doc M2 |
| 13 | Events | `src/core/events.d.ts` (appendix `docs/spec/events.md`, owned by this doc) | One canonical name+payload per event. Resolved now: **`serving-delivered`** (the delivery model won in row 4; `plate-delivered` and `dish-collected` deleted); one `customer-infected` payload; one `rating-changed` payload `{r, delta, source}`. System specs may only ADD events. CI: every spec-referenced event name exists in the map. | all |
| 14 | Module contracts | `src/engine/contracts.ts` | Real signatures, real paths (`src/engine/`, not `src/iso/`): `walkable(t: Tile)`, `placements()`, `door()`, `findPath(): PathResult`. Service/staff/raid specs consume verbatim. `RaidSim` at `src/sim/raid/` so the no-Phaser lint rule covers it. | all sims |
| 15 | Save versions | `docs/spec/save-ledger.md` (§4.1, owned by this doc) | The ONLY assignment of version integers. All system specs strip absolute numbers → "fields land at save vN per ledger". CI: ledger ↔ every spec's front-matter `savedVersion` agreement. | all |
| 16 | Starter state | `src/data/starterLayout.json` (engine spec hosts, service-loop invariants reviewed) | **2 stoves, 2 tables, 3 chairs, 1 counter, 1 sink**, door per row 2 — the service loop's starter wins because the serve/bus loop is a hard functional dependency (the old counter-less/sink-less engine starter could never earn a coin). CI test from M1: starter satisfies ≥1 counter, ≥1 sink, ≥1 seat, all stations reachable from door. The M3 save-migration fixture uses it. | engine, service loop, progression walkthrough |
| 17 | Character art strategy | `presentation.md §6` | **Paper-doll rig** (6 parts, 2 authored facings + flipX, frames only for the three one-shot gags) — the scaling argument is correct for a 105-occupation roster. Engine spec §11's per-character frame-sheet requirement amended to "rig parts per presentation; engine emits Dir". Escalation hatch kept: hand-picked walk frames for chef + 2 hero zombies. Launch cast list **regenerated from `zombies.v2.json`** (infection's roster — the original occupation names were replaced there; presentation's Couch Potato/Politician/Supermodel list is stale). CI: every chars-atlas manifest id exists in zombies.json. | this doc M8a |
| 18 | Zombiepedia | `progression.md §6` | 4-state model: Undiscovered / Sighted (on spawn) / Infected / Mastered (4 combine marks). Infection's 3-state panel spec renders this model. | infection UI, this doc M10b |
| 19 | Download budgets | `budgets.json` + one CI script | Playable shell (JS + ui/fx/room atlases + fonts) ≤ **2.5MB** · total streamed-behind-splash ≤ **8MB** · @2x atlases + bgm lazy ≤ **+6MB**. Both presentation and this doc cite this file; the old contradictory pair (8MB vs 1.5/2.5MB) deleted. | presentation, this doc M8 |

### 2.2 Time model — two clocks, stated once (supersedes old M4 text)

- **REAL clock (wall time, absolute timestamps, all states):** cook timers, burn deadlines, revive timers, login streaks, passive-income machines, Magic Fridge daily reset, seasonal windows, offline settlement bounds. *Never* accelerated — foreground, hidden, or offline. This is what makes offline settlement one code path and preserves the six-stat economy and burn math.
- **ACTIVITY clock (×`ACTIVITY_TIME_SCALE = 12` when foregrounded; handled by OfflineEngine when not):** staff energy drain/regen, daydream timers, serving throughput, customer spawn intervals, customer patience. This reproduces the researched 10–15× foreground quirk exactly where the original applied it — energy and serving — and nowhere else.
- The old global `FOREGROUND_TIME_SCALE = 10` is **deleted** (it would have accelerated cook timers 10×, which the original never did, shredding burn windows). The old AC "earning rates differ by exactly FOREGROUND_TIME_SCALE" is rewritten to apply only to the activity-clock subsystems. `DEMO_TIME_SCALE = 120` is deleted and replaced by the test harness (§2.4).
- A one-table subscription map (which system reads which clock) lives in `docs/spec/simulation-core.md` and is the merge gate for any new timed system.

### 2.3 OfflineEngine — one settlement, one order (new; lands M4)

All hidden/offline resolution runs through `src/sim/OfflineEngine.ts` against **one clamped elapsed window** (settle only when hidden ≥60s; clamp 7 days; negative deltas → 0). Execution order is normative:

1. Snapshot & despawn live customers (no rating deltas — browser artifacts never punish the player).
2. Cook completions and burns at absolute timestamps (REAL clock).
3. Staff energy drain/regen + incident rolls on offline rates (staff spec's offline model — tuned so a rested roster survives a full workday away; the idle pillar is protected by an explicit "8h absence with sane staffing loses ≤1 rating point and zero zombies" golden assertion).
4. Serving/counter settlement at 25% throughput, **bounded by the staff-availability windows computed in step 3** (a server that exhausted 2h in stops selling 2h in).
5. Passive machines (rate × elapsed, capped).
6. Revive timers / raid-state resolution (a raid live when the tab hid was auto-paused, see §2.8 — resolve its offer here).
7. Streak / quest / catering / Magic Fridge daily rollovers (REAL clock).
8. Rating: bonus-star expiry **then** away-decay (−1.0/12h).
9. Compose the welcome-back report: per-stove outcomes, coins earned, burns, incidents, **star blink green/red summarizing the net away rating change** (the researched signature), time away.

**Live-tick handoff:** the 100ms fixed-step accumulator has `MAX_LIVE_CATCHUP = 5s`; accumulated dt beyond it routes through OfflineEngine (steps above), then live ticking resumes. Unit test: inject a 60s frame gap → zero angry-leave rating deltas. A combined golden-fixture test covers the full 9-step sequence.

### 2.4 Test-time acceleration (replaces DEMO_TIME_SCALE)

Compile-time define `__DD_TEST_HOOKS__` (true in dev/CI builds, false in the Pages deploy). When true, `window.__dd = { clock: { advance(ms), setScale(n) }, rng: { seed(n) }, sim: { step(n) } }` is installed; Playwright and QA drive 12h cooks through it. Production guard: a CI step greps the deployed bundle for the hook symbols and fails if present. This is the harness contract every spec's "fast-forward" AC references.

### 2.5 Typed EventBus & 2.6 One payment formula

Events per Canon row 13. Payment (in `DishMath.ts`): `payment = perServing × (1 + 0.06·Tips) × (1 + R/200)` — staff spec's Tips derivation (single stat source), progression's rating multiplier. This restores the researched **rating→tip-quality loop** inside the serving spec's own formula (higher rating literally pays better per plate, alongside gating better-tipping occupations). The three previous formulas replace/stack ambiguity is resolved: they compose exactly as written here, nowhere else. Golden test: 3 zombies × 3 ratings.

### 2.7 Save discipline, durability & multi-tab (moved up from M11 to M0/M3)

- **Versioning:** `SAVE_VERSION` in `src/core/save/schema.ts`, assigned from ledger §4.1. `migrate(raw)` = chain of pure `vN→vN+1` functions; committed fixture + round-trip test per version; full v1→latest chain in CI forever. Per-field fallback on malformed nested data.
- **Failure UX (specced now, shipped per milestone tags):** localStorage disabled/throws (Safari private mode) → in-memory session + persistent banner [M0]; `QuotaExceededError`/write failure → toast + auto-download of save JSON [M0]; corrupt-but-unparseable → offer "download broken save" *before* any wipe [M0]; corrupt-but-parseable layout (out-of-bounds placements after a bad migration) → offending placements quarantined to Storage + toast, never dropped [M3]; `navigator.storage.persist()` requested at boot, and after 5 days of absence on a Safari UA the welcome-back card prompts an export (ITP 7-day eviction mitigation) [M3]. Fault-injection tests (throwing storage stub) for all of these.
- **Export/import ships at M3** (minimal settings gear: export, import, mute) — not M11. A collection game's players have saves worth losing from the first decorated room.
- **Multi-tab:** `navigator.locks` primary-writer election, fallback lease timestamp in localStorage (renew 5s, takeover 15s stale) — the 250ms BroadcastChannel race is deleted. One lock/channel name constant in `save/schema.ts`. The writer-election message carries `SAVE_VERSION`: an old tab that sees a newer version goes **read-only** (cross-deploy safety). Offline settlement runs once per wall-clock window (`lastSettledAt` guard), never per tab.

### 2.8 Pause & input semantics (new)

- **Pause:** full-screen modals pause the ACTIVITY clock (customers/energy), never REAL-clock cook/burn timers. Hidden <60s → freeze and resume (no settlement, no despawn). Hidden ≥60s → OfflineEngine. A live raid on hide auto-pauses and offers resume/retreat on return.
- **Input-mode arbitration** (`docs/spec/input-modes.md`, authored M2, extended M3/M9): one explicit mode stack — `DEFAULT → ZOMBIE_SELECTED | EDIT | PANEL | RAID`. Pan gesture >8px cancels tap-intent. Esc / tap-empty-tile pops one mode. Normative resolutions: tap a customer while `ZOMBIE_SELECTED` = dispatch (move-adjacent), **never** the infect card (infecting requires `DEFAULT`); tap a stove while `ZOMBIE_SELECTED` = assign-to-stove; `EDIT` suppresses all sim taps; `PANEL` is modal. Every later spec adding a pointer consumer must claim its slot in this doc's stack.

### 2.9 Licensing & IP (new; M0)

`docs/spec/licensing.md` + repo `LICENSE` at M0: code **MIT**; art/audio assets **CC BY-NC 4.0**. Content rule: mechanics and numbers are not protectable — names, character rosters, and trade dress are; therefore **no verbatim Capcom content name ships** (dishes, cafes, rivals, rares, characters — the infection spec already replaced the occupation roster; the dish generator, raid cafes, and presentation cast finish the job; CI denylist of known original names runs against all `data/*.json`). `public/art/CREDITS.md` logs generator, date, and ToS-permitting-redistribution clause for every generated asset — enforced by the manifest build script. README gains an homage disclaimer ("unaffiliated fan-inspired remake; original © Capcom/Beeline") and the real license section.

### 2.10 Telemetry, i18n, browser matrix, deploy hygiene (new; decisions recorded)

- **Telemetry: zero analytics.** No trackers, no self-hosted counters — stated on the page as a feature. Post-launch tuning data comes from the feedback path: a settings-panel "Copy my anonymized stats" button (local aggregates — level, playtime, dish counts, toxin earned/spent — to clipboard as JSON) that players can paste into a GitHub issue. Both risk-table "tuned post-launch" lines now cite this source.
- **i18n: English-only at 1.0**, but every user-facing string lives in `src/ui/strings.ts` from M8b (no inline strings pass lint from then on) so localization is a data drop later.
- **Browser matrix:** support = last-2 Chrome/Edge/Firefox + Safari/iOS **16.4+**. Playwright **WebKit boot smoke from M1** alongside chromium. Device-fps ACs are replaced by (a) a **4× CPU-throttled chromium perf smoke** in CI as the proxy, asserting *relative* budgets (scene update < K× an in-process calibration loop, plus a generous 3× absolute ceiling — no flaky raw-ms assertions on shared runners), and (b) a **manual per-milestone device checklist** (one real iPhone + one mid Android) recorded in each milestone PR.
- **Deploy hygiene:** all atlases/manifests get content-hashed filenames (JS already does via Vite); the M11 service worker uses network-first for `index.html` + `skipWaiting` with a reload prompt; stale-tab safety via the versioned write lock (§2.7). Manifest fetch failure at boot → retry ×3 → friendly error screen with reload button; atlas 404 mid-session → placeholder frame + non-blocking toast (unillustrated content is never invisible — same placeholder-icon fallback covers content shipped ahead of its art).

### 2.11 docs/spec/ convention

One file per system; front-matter `status: draft|approved|shipped`, `milestone: M#`, `savedVersion: <from ledger>`; sections: Goal, Fidelity anchors, Data model, Algorithms, File plan, Acceptance criteria, Out of scope. A spec is `shipped` only when its milestone's Playwright criteria pass on the live URL. **New sibling specs chartered by this revision:** `canon.md` (generated), `save-ledger.md`, `simulation-core.md` (two clocks + OfflineEngine + pause), `input-modes.md`, `settings.md`, `licensing.md`, `events.md`, `browser-support.md`.

---

## 3. Milestones

Format: **Size** (working days) · **Save** (schema version after, per ledger §4.1) · Scope · Player-visible outcome · Acceptance criteria · Ships live.

### M-R — Reconciliation pass *(new, runs alongside M0)*
**Size:** included in M0's 4 days (doc work parallelizes) · **Save:** — 

Patch all six system specs to the Canon Registry: strip restated constants and absolute save versions; flip the engine door rule (row 2); fix presentation wall geometry to 64×224/WALL_H 192 (row 1) and regenerate its roomBounds/camera examples and cast list (row 17); delete the Service Loop's rival XP curve, dish name list, 0–1000 rating, no-decay line, tips mapping (as permanent), and stub-grid workstream; delete Progression's legacy expansion prices, collect-tap XP split, and duplicate raid-Toxin numbers; delete Infection's 3-state Zombiepedia and its stub-actor workstream (sims unit-test against 10-line in-test fakes, not shipped adapters); delete Raids' energy schema addition, level cap 10, Chebyshev clause, and duplicate Toxin table; re-run raid TTK and service §8.5 tables from canon rows 8/11. **No milestone after M0 starts until M-R is merged.**

### M0 — Rails & Rename *(infrastructure)*
**Size:** 4 · **Save:** v2 · **Specs:** `engineering-infra.md`, `save-format.md`, `save-ledger.md`, `licensing.md`

**Scope (engineering):**
1. **PR CI gate** (`ci.yml`): `tsc --noEmit` → ESLint → `vitest run` → build → **Playwright boot smoke (chromium + webkit)**: boots to CafeScene, a cook completes via the §2.4 test hooks, coins increase, save round-trips through reload. `deploy.yml` gains the same steps before Pages upload. Canon CI checks live now: artconfig↔IsoConfig equality (activates M1), save-ledger↔front-matter agreement, events-map coverage, starter-layout invariants (activates M1), original-names denylist, budgets script (row 19), test-hook production guard.
2. **Bundle discipline:** `manualChunks: { phaser: ['phaser'] }`; budget fail >120KB gzip game chunk / >500KB initial JS; `content.ts` catalogs go `import()`-lazy.
3. **ESLint + Prettier** with layer boundaries (§2, including `sim/raid/`); `noUncheckedIndexedAccess: true` + fix ~6 errors.
4. **Typed EventBus** per canon row 13; Phaser import removed; dead events wired or deleted.
5. **SaveManager discipline:** kill import-time singleton → constructor-injected `storage`/`clock`; migration chain + fixtures; **v1→v2 Brains→Toxin: `toxin = min(brains, 99)` for existing saves, 5 fresh** (one rule, stated once); HUD vial icon; drop `brainReward`; delete `Economy.addBrains(1)` at `Customer.ts:79` (interim infect cost 50 coins until M6). **Save-durability UX** per §2.7 items tagged [M0], with fault-injection tests.
6. **Licensing** per §2.9: LICENSE, licensing.md, CREDITS.md scaffold, README disclaimer, denylist test.
7. **Quick-win fixes:** Stove bubble tween leak; bubble depth below HUD; `Hud.setScrollFactor(0)`; `pagehide` save; toast cap 4; `BRAND.version` from package.json; delete ROADMAP Update 8; `infectionsSinceLevel` rename.
8. **docs/spec/ scaffold** incl. the new chartered specs; M-R patches land here.
9. **Juice starters:** press squash, coin fly + count-up, READY pot glow, one self-hosted display font (woff2), drawn coin/vial icons.

**Player-visible outcome:** same game, but it *feels* handled — and it's legally and structurally sound underneath.

**Acceptance criteria:** runtime-crash PR blocked by smoke; vitest covers Economy/EventBus/migrations (v1 fixture → `toxin === min(brains,99)`) in Node; bundle budget green, phaser chunk hash stable; live URL shows squash/coin-fly/vial; denylist green against current data; storage-throw stub → banner, quota stub → download prompt.

**Ships live:** Toxin rename, juice pass, font/icons. Untouched: scene flow, art, gameplay logic.

### M1 — The Room Is Real *(isometric foundation, part 1)*
**Size:** 6 · **Save:** v2 · **Spec:** `iso-engine.md`

**Scope:**
1. **`IsoConfig.ts` + `IsoMath.ts`** — constants per **canon row 1 (TILE 128×64)** — this doc no longer states tile numbers; golden tests (16 hand cases) + property test `worldToTile(tileToWorld(t)) === t` over 20×20 at zooms 0.5/1/2.
2. **`CafeGrid.ts`** — per-cell state; footprint-aware `canPlace/place/remove` from `furniture.json size` (602 items, 85 multi-tile); **`moveItem(id, …)` — id-preserving** (placementIds are load-bearing for stoves/seats/counters/tasks; move never mints a new id; remove+place reserved for Storage); monotonic id counter **persisted** in the save; `expand(w,h)` per `expansion.json` dims (canon row 6) re-deriving walls/floors/walkability without scene restart, **atomically**: grid mutates → SeatIndex/interactionCells re-derive synchronously → door preserved if still on a back edge else moved to default → single `layout-changed` event → tasks/paths re-arbitrate next tick (the defined ordering consumers rely on). Port the legacy `GridManager.cs` API shape only, never its non-iso projection. Property tests: place/remove round-trip; no occupant overlap; expansion preserves placements; **AC-hash computed over canonical placements-only form** (id counter excluded, explicitly persisted).
3. **`DepthSort.ts`** — engine spec's formula (canon row 1); this doc's old `key×10` deleted.
4. **Procedural diorama room** (`RoomRenderer.ts`): per-tile floors + two back-wall planes per-section + **door on the back-left wall (canon row 2)**; `cafe_bg.jpg` demoted to menu art. Placeholder floor/wall sets matching the JPG palette. Floors+walls baked to a RenderTexture.
5. **Entities on the grid** from `starterLayout.json` (canon row 16 — includes the counter and sink); all depth via DepthSort; pixel constants deleted.
6. **Camera:** drag-pan + wheel/pinch zoom **0.4–2.0** (canon row 1), bounds room+3 tiles, double-tap recenter.
7. Customers/waiters keep tween movement between grid points (locomotion is M2).

**Player-visible outcome:** a crisp procedurally built diorama room with correct depth and a real back-wall door — the milestone a fan first says "oh, it's Zombie Cafe."

**Acceptance criteria:** engine zero Phaser imports, ≥90% coverage, tests <1s; tap-tile accuracy at 3 zooms (`?debug=grid`); depth correctness vs a 2×2 footprint from every adjacent tile; smoke (chromium **and webkit**) pans 200px, HUD fixed; perf via the §2.10 relative-budget method (calibration-loop ratio + throttled profile), manual device checklist in the PR; artconfig↔IsoConfig CI equality green; starter-layout invariant test green.

**Ships live:** the isometric room, camera, depth-correct scene.

### M2 — Shamble & Seat *(isometric foundation, part 2)*
**Size:** 4 · **Save:** v2 · **Specs:** `iso-engine.md` (§path/locomotion), `input-modes.md` (authored)

**Scope:**
1. **`Pathfinder.ts`** — A*, **4-connected only (canon row 12)**; `{ path } | { blocked }` per `contracts.ts`; `replan()` on grid change. Tests: property (never crosses unwalkable), golden mazes, blocked detection, 17×16 worst case <2ms (relative-budget framed).
2. **Locomotion (`Walker.ts`)**: speeds from **`speeds.ts` (canon row 11)** — zombies by Speed stat (flat interim Speed until M6 stats), customers 2.0; facing flip, shamble bob/sway/squash, contact shadows. The pinned bobbing waiter becomes a real walker (interim auto-dispatch; player dispatch in M5).
3. **Authentic failure:** no path → freeze + "blocked" emote (research: servers "stand motionless"), re-plan on grid change.
4. **Seat gating:** table+chair adjacency = seats; door→seat pathing; spawner pauses when full; 10s door wait then sad-leave.
5. **Thought bubbles v0** (visual; feeds rating M7). **Input-mode stack v1** per §2.8 (DEFAULT, pan-vs-tap threshold, selection groundwork).

**Player-visible outcome:** characters actually walk — shambling around furniture to real seats; block a path and the waiter freezes with an emote.

**Acceptance criteria:** pathfinder green; no straight-line tween walks remain (grep); one-seat-one-customer (unit + smoke); wall-off → freeze within a tile, resume <500ms after unblock; zombie vs customer traversal times differ per speeds.ts (smoke). **Pillar #4 done.**

### M3 — Build & Decorate
**Size:** 5 · **Save:** v3 · **Specs:** `build-mode.md`, `input-modes.md` (EDIT mode), `settings.md` (v0)

**Scope:**
1. **Placement/edit mode** (EDIT on the input stack): hammer → store drawer; ghost preview green/red + check/cross glyphs (accessibility, not color-only); tap-confirm/cancel; **move = `CafeGrid.moveItem` (id-preserving)**; remove → unlimited **Storage** (non-destructive; no sell path — the pity floor (M5) handles the soft-lock instead, keeping the original's no-sell fidelity).
2. **Furniture lifecycle × live sim — the interaction matrix** (enforced via a `canRemove(id)` hook the sim supplies): stove non-IDLE → blocked, toast "finish or scrape first"; counter holding servings → blocked; chair with seated customer → blocked until they leave; sink mid-bus-trip / any in-flight task whose target is removed → task released, server re-arbitrates. Unit-tested per row.
3. **Seven-tab store drawer** (≥44px targets): Furniture, Utility, Decor, Walls/Floors, Storage live; Featured/Special stubbed **with designed empty states** ("The Union hasn't approved these yet…" — every stub/zero-data screen in the game gets authored copy; the full empty-state list lands in the UI kit at M8b: empty Storage, empty fridge, Zombiepedia 0/105, pre-L5 world map, Chef-only roster).
4. **Per-tile floor + per-section wall painting** (20 floor / 50 wall variants; $10–$1,000/tile, $30–$1,200/section; cosmetic-only *for now* — decor star bonuses wire into Rating's D component at M7).
5. **Expansion, Cash tiers** from `expansion.json` (canon row 6): 8×8 $3,500 · 9×9 $25,000 · 10×10 $75,000; atomic expand per M1.
6. **Save v3:** `layout {roomSize, floorTiles, wallSections, placements[{id,itemId,x,y}], idCounter, storage[]}`; v2 seeds starter layout; fixture. **Layout-corruption quarantine** per §2.7 [M3]. **Settings v0 gear: export/import save, mute** (§2.7).

**Player-visible outcome:** the decoration game exists — buy a second stove, rearrange, paint a checkerboard floor; your layout persists and matters.

**Acceptance criteria:** 602/602 store cards; multi-tile validation matrix; red ghost can't confirm; placement triggers re-plan; reload restores layout, v2 fixture migrates; refuse-when-broke toast; storage round-trip free; **move preserves placementId (unit: mid-state stove nudged one tile keeps its cook state — wired fully at M5, id-stability testable now)**; lifecycle matrix rows enforced; export→wipe→import restores; OOB-placement fixture quarantines to Storage.

### M4 — One True Clock *(simulation extraction)*
**Size:** 5 · **Save:** v4 · **Spec:** `simulation-core.md`

**Scope:**
1. **`CafeSim.ts`** — plain-data state; fixed-timestep `tick` (100ms accumulator, `MAX_LIVE_CATCHUP` per §2.3); injected `Clock` (two-clock per §2.2) + seeded `Rng`; `toJSON/fromJSON`. Stove/Customer display objects become views; embedded logic deleted.
2. **Two-clock model per §2.2** — REAL for cooks/burns, ACTIVITY ×12 for spawns/patience/energy(when it lands)/serving. **`DEMO_TIME_SCALE` deleted; `__DD_TEST_HOOKS__` harness (§2.4) installed** (CI smoke and all fast-forward ACs now run through it).
3. **`OfflineEngine.ts` per §2.3** — the single settlement sequencer (steps that lack systems yet are no-op slots filled by M5/M6/M7/M9 — the *order* is fixed now). `applyOfflineEarnings`/`computeIdleRate` deleted (the parallel-estimate exploit dies). Interim: offline settles each stove's actual dish at real timestamps; READY parks (burn rule arrives M5).
4. **Pause semantics per §2.8** (modals pause ACTIVITY only; hidden <60s freeze; ≥60s settle).
5. **Persist sim state** (`stoves[{dishId, phase, startedAtWall}]`, rng seed, `lastSettledAt`).
6. **Welcome-back report card** (>5min away): per-stove outcomes, coins, time away — report *frame* includes the star-blink slot (lights up at M7).
7. **Determinism harness:** seeded replay, 10k ticks ⇒ identical hash, in CI. **Multi-tab web-locks writer election** per §2.7 replaces the BroadcastChannel ping.

**Player-visible outcome:** close the tab mid-cook, come back — the pot kept cooking, at honest wall-clock speed; a report card narrates what happened.

**Acceptance criteria:** replay determinism green, sim ≥90%; Playwright (via test hooks): 60s cook, reload at 30s → ≈30s progress; 2h jump → completed + report; clock rollback grants nothing; **cook timers advance at 1× while spawn/patience advance at 12× (unit on the clock adapter)** — the old "everything ×10" AC is gone; 60s injected frame gap → zero rating deltas; two tabs → one writer (locks test), stale-version tab goes read-only.

### M5 — The 2011 Dish Economy
**Size:** 7 · **Save:** v5 · **Specs:** `dish-economy.md`, tutorial steps in `quests.json`

**Scope:**
1. **Dish schema v2 + THE generator (canon row 5):** six attributes; `Tools/retune-dishes.ts` emits all 320 dishes — 97 General / 9×21 themed / 34 Rare — with the 59 original stat lines as exact anchors under renamed dishes (crosswalk committed), service-loop closed forms for the rest, **progression's XP formula**, bands per §4.3 **including 24–72h at L21–22**. Runtime catalog validator fails loudly (the Unity-killer class). CI: bands/counts/anchors/monotonic-profit-per-hr in one test.
2. **Cookbook UI:** tap idle stove → level-gated picker (gates from `unlocks.json`), six-stat card, 15-slot favorites, affordability state; **pay Price at cook start**; pause/resume.
3. **Burn windows:** 5×/4×/3× bands; blackened pot, price forfeit, tap to clear; **wallet-only — no rating hit (canon row 3)**; applies through OfflineEngine step 2 — the burn rule IS the offline cap. **Un-burn mercy (1 vial, within 60s) adopted as canon** (on-pillar friction removal; recorded in dish-economy.md, the service loop's no-refund stance amended).
4. **Servings & payout on delivery:** tap-to-dispatch (ZOMBIE_SELECTED mode per §2.8) → server ferries plates; each delivery pays via **DishMath (§2.6)**; coin fly. Dirty plates; sink bussing. Stove-tap mint and dish-independent tip deleted.
5. **XP & levels per canon row 4:** 100% on delivery pro-rata; cap 22; `unlocks.json` gates. Infection-count leveling deleted.
6. **Toxin sinks live:** instant-finish **tiered 1/2/3/5/8** (canon row 9), un-burn 1.
7. **Pity floor (anti-soft-lock):** when `cash < cheapest unlocked Price` AND no stove COOKING/READY AND no counter batch AND no undelivered servings → the Union Rep grants a free cook of the cheapest dish (toast-gagged, once per condition). Invariant unit test: **no reachable state has zero income paths.**
8. **Return hooks:** when hidden, `document.title` cycles ("Ready in 12m — Deadbeat Diner" / "READY — burns in 3h!"), favicon badge swap on READY; **opt-in, settings-gated local Notification** at dish-ready and burn-T-minus-30min while a tab exists. True push explicitly out of scope (no backend) — burn tuning tolerates it.
9. **Core tutorial ships NOW (staged onboarding):** 5 steps — tap stove → pay → burn ring explained → dispatch → first delivery. Skippable. Rewards from `quests.json` (single source; total tutorial chain across M5/M6/M9 stages grants **8 vials** — the 3-vial figure is superseded).

**Player-visible outcome:** the original's fingerprint loop beat for beat: pay → wait → READY with a burn countdown → dispatch → plates land, coins pop per serving. Choosing the dish whose burn window fits your next login *is* the strategy — and the tab title now helps you keep the appointment.

**Acceptance criteria:** coins have exactly one faucet (delivery + pity grant, both via Economy — code search proves no other `addCoins`); economy sim: the tutorial-dish anchor ($8/2m/12/$12) ≈$120/hr active and the 1-day anchor ≈$44/hr (research meta), asserted against generator output; burn forfeits online and offline identically, report card shows it; Playwright full loop via test hooks incl. level-up unlock; v4 fixture migrates (in-flight cooks mapped to nearest v2 dish); pity fires in a scripted broke-state; hidden tab title cycles (unit on the title driver); 0-toxin instant-finish refused with clear copy; new-player-earns-coins-in-60s smoke (runs every milestone from here).

### M6 — Infect the Clientele *(the identity mechanic)*
**Size:** 4 · **Save:** v6 · **Spec:** `infection.md`

**Scope:**
1. **Occupation-typed customers** from `zombies.v2.json` (infection's 105-archetype roster — canon row 17's consumers regenerate from it); tier structure Free/Cash/Toxin per infection's tables; spawn gating by cafe level now, + rating at M7 (minStars column pre-regenerated onto R 0–100).
2. **Tap-to-infect** (DEFAULT mode only, per §2.8): panel → confirm → pay → collapse-and-rise beat → roster. Passive roll deleted. Every infection is a purchase and sacrifices a paying diner.
3. **Working slots per canon row 8:** `min(14, ceil(0.7·L))` — **1 at L1** (research), cap 14; **Meat Locker at L2** (`unlocks.json`): 5 hooks, +5 per 5 vials, max 100; free swaps.
4. **Chef avatar** (Tips 3/Speed 5/Atk 4/Energy 90, never tires); dispatchable.
5. **Roster panel**; occupation-tinted placeholders until M8. **StaffStats.ts lands; the service loop's interim tips shim is deleted this milestone** (canon row 8). **Tutorial infect step ships.**

**Player-visible outcome:** the game's soul returns — eye a Toxin-tier VIP at table 3, weigh 5 precious vials, tap Infect, watch them rise.

**Acceptance criteria:** infection always costs, never grants; occupation→stat mapping data test; roster persistence fixture; slots enforce (attempt beyond `ceil(0.7·L)` refused; 1 slot at a fresh L1 save); Meat Locker swap persists; Playwright free-tier infect end-to-end + 0-toxin premium refusal; all 105 zombies reachable in data; interim tips shim gone (grep).

### M7 — Energy, Rating & the Feral Failure
**Size:** 4 · **Save:** v7 · **Spec:** `rating-energy.md`

**Scope:**
1. **Energy on the ACTIVITY clock (§2.2):** drains cooking/serving; 0 → **feral**: CENSORED-bar customer attack, all customers flee unpaid, rating −6; 15%-warning grace; rest to regen; Toxin instant-refill. Offline energy via OfflineEngine step 3 with the idle-pillar golden assertion. Daydream: auto-resume after a *long* pause, **disabled for Focus ≤3** — tapping drowsy staff stays a real activity.
2. **Star rating per canon row 3** — R=S+D+B on 0–100; happy/sad bubbles feed S; **decor star bonuses wire into D** (the M3 paint job now pays off); Bonus stars B from review quests; feral −6; away-decay −1.0/12h via OfflineEngine step 8; green/red blink on change **and in the welcome-back report** (the M4 slot lights up). **Rating governs spawn frequency and occupation quality (§4.4)** — and per-plate pay via DishMath's rating multiplier — closing the loop: decorate → rating → better, better-tipping customers → better infects.
3. **Earned-only Toxin faucets go live** per the ledger (§4.6): streaks (day 3 +1, day 7 +2, day 10 +4, repeating — modernized from the original's 10-day cliff, same 10-day total), milestones, quest system v0 (rotating 4-task "review" set, L6): Bonus Star + 1 vial per set.
4. **Modernization-stack bundle playtest (gate):** daydream auto-resume + server task-looping + patience-pause + Scout + feral grace evaluated *together* against the "constant re-tasking" texture of the original; tuning adjusted before ship (the cheapest lever is daydream duration).

**Player-visible outcome:** staff become a managed liability — push a zombie too hard and it eats a customer on camera; your stars blink red and the good clientele stops coming until you win them back.

**Acceptance criteria:** feral chain deterministic in sim (energy 0 → attack → flee unpaid → R −6); Level and Rating independent; spawn table gates per §4.4 at R 15/45/85; away-decay applies after bonus expiry (ordered unit test) and the report blinks; Toxin ledger sim: scripted engaged week ⇒ 15–25 vials, no faucet outside `toxinLedger.json` (code search); Playwright review-set → Bonus Star, drained zombie → feral visible; 8h-absence idle-pillar golden green. **The management game is complete.**

### M8 — Alive & Loud *(art, animation, audio, UI — two halves)*
**Size:** 5 + 5 · **Save:** v7 · **Specs:** `art-pipeline.md`, `audio.md`, `ui-kit.md`, `settings.md` (full)

**M8a — Pipeline & characters:** style spec from `cafe_bg.jpg`; generation templates at IsoConfig-derived canvas sizes (CI equality already enforcing); atlas packing + manifest PreloadScene, WebP/pngquant, per-scene lazy loading, **hashed asset filenames (§2.10)**; **paper-doll character system per canon row 17** (rig parts, 2 facings + flipX, one-shot gag frames) driven by Walker/sim states; first batch: chef + 8 occupations **from zombies.v2.json** (human+zombie forms), 3 furniture tiers, 12 dish icons; **placeholder-icon fallback for all unillustrated-but-reachable content** (canon row 19 budget applies).

**M8b — Audio, UI kit, environment, settings:** AudioManager (gesture unlock, bgm + ducking, pooled SFX per events map, per-channel volume in save); themed UI kit on the display font (store, cookbook, infect panel, roster, report card); ambient particles; grime→luxury tier sets; **all authored empty states (M3 list)**; **`strings.ts` extraction complete (§2.10)**; **full settings panel** (`settings.md` is the single owner): audio channels + mute, reduced motion (disables shake/vignette/parallax), colorblind assists (bubble shapes, check/cross glyphs, signed rating deltas, energy-bar icon at ≤15%), particle/quality tier, purist toggles (aggro ring off, **retaliation — arrives M9 default OFF**), notification opt-in, language (en), copy-anonymized-stats, export/import/reset-save; keyboard navigation for panels (Tab/Enter/Esc). Remaining occupation batches continue post-M8 as manifest content drops.

**Player-visible outcome:** the game looks, moves, and sounds like Zombie Cafe — shambling paper-doll walk cycles, cook-stir, the censored feral gag with crunch audio, a living grimy diner, and a real settings screen.

**Acceptance criteria:** no loose PNG loads; budgets green per `budgets.json` (shell ≤2.5MB / streamed ≤8MB / lazy +6MB); every character state animates; throttled-CI perf proxy + device checklist green; audio unlocks on gesture, mute persists, every economy event has an SFX binding (table-driven); chars-manifest↔zombies.json CI check; reduced-motion verifiably disables shake; no inline UI strings pass lint; style-consistency owner sign-off.

### M9 — Raid the Rivals
**Size:** 6 · **Save:** v8 · **Spec:** `raids.md`

**Scope:** world map, 5 rival AI cafes (level-scaled, **all renamed per §2.9**), unlock at **L5** (`unlocks.json`); real-time tap-to-command auto-battle (RAID input mode) on the shared engine A*/Walker with speeds.ts; **melee = 4-neighbor adjacency (canon row 12)**; enemy staff fight, customers eatable (energy +20% of victim, cash, CENSORED); boss aggro; truce/retreat; **zombie combat stats derived from StaffStats + level (cap 15, canon row 8)**, TTK tables re-verified; loot: steal-the-counter-dish → fridge → serve-once-or-permanently-unlock, cash, zombie XP, **Toxin per the raids drop mechanics inside the ledger's allocation (canon row 9)**, and — because raiding is the researched *only* source of variations — **basic variation drops in the M9 loot table** (full variation layer M10a); **all 34 Rare dishes ship in data now**: 10 obtainable across the 5 launch cafes, 4 assigned to the seasonal Event Cafe (M10b), the remaining 20 on a committed **deferred-content allowlist that the reachability test reads and that must shrink to zero by 1.0**; losing pays partial; death → 8h revive (REAL clock, OfflineEngine step 6) or 1 vial; consolation flow. **Rival Retaliation ships per the §1.1 decision: opt-in, default OFF** (settings toggle from M8b; save fields land here at v8). **Tutorial raid step ships.**

**Player-visible outcome:** the second game mode — build a raid squad, storm a rival's cafe, eat the patrons, steal an above-your-level dish before you can cook it.

**Acceptance criteria:** win/lose/retreat all resolve (seeded sim); stolen above-level recipe held-but-uncookable; Toxin EV within ±2% over 1k sims *and* inside the ledger cap (8/rolling-7d); revive timer offline-safe; retaliation OFF by default and fully inert when off (sim assertion); raid auto-pauses on tab hide, resumes/retreats on return; variation drop appears in loot table test; reachability test passes with the allowlist; Playwright full raid → fridge → unlock → cookbook.

### M10 — The Long Tail *(two halves)*
**Size:** 5 + 4 · **Save:** v9 · **Specs:** `dish-economy.md` (§variations), `build-mode.md` (§special), `collection.md`, `seasonal.md`

**M10a — Recipes, rooms & the Special tab:**
- **Variations, full layer:** 10 versions per recipe (Spicy +10% XP, Very Spicy +20%, Fancy/Very Fancy price+earnings up, Bulk 2× price/earnings/XP, Fresh longer burn, Frozen 2× time −25% price, Quick −10%, Very Quick −20% time) from raid drops (live since M9) or 5 vials each / 45 all; math table unit-tested exactly.
- **Cookbook completion:** the 9 themed books fully populated (generator already emitted them; themed-book *access* pairs with their stoves below).
- **Toxin-upgradeable themed stoves (researched beat restored):** each themed cookbook's stove is a Cash purchase whose **Toxin upgrades (tier I = 8 vials, tier II = 15 vials) unlock the book's middle and upper thirds** — a lost sink and fidelity beat, now in the ledger.
- **Expansion completion:** Toxin tiers 11×11 (40🧪) → 17×16 per `expansion.json`, dual-priced.
- **Special tab goes live:** passive machines (Vending $16,000 → $25/hr cap $250; Arcade $50,000 → $75/hr cap $1,000; ATM 60🧪 → $200/hr cap $5,000 — OfflineEngine step 5); **Magic Fridge (30🧪): one free dish per day** — pick any unlocked recipe ≤4h band, appears READY on the fridge, burn-exempt, resets on the REAL-clock day (research: "Magic Fridge gives one free dish/day"); **Industrial Barrel of Zombie Serum (50🧪): permanent +10% max energy roster-wide** (researched Special-tab endurance modifier); **outdoor decor**: a 2-tile exterior apron outside the front room edge accepting decor-class items (researched Special-tab category), feeding Rating's D like interior decor.
- **Union Catering Board (friends-loop substitute, §1.1):** daily 3-slot rotating list; order = permanent unlock at 3× Price; milestone vials at 1/3/10 lifetime orders.

**M10b — Collection meta & seasons:**
- **Zombiepedia per canon row 18** (4-state; silhouettes; completion %); zombie leveling (+5% energy/level, cap 15) and combining (merge identical, mark, cap 4); pets (9) and tombstones (13); boosters (3) in the cook formula; favorites strip on HUD.
- **Seasonal layer per §1.1 (`seasonal.json`, local clock):** 4 date-windowed cosmetic sets (walls/floors/decor) + 1 short quest line each + the rotating **Event Cafe** (6th map slot) hosting its 4 rares; everything permanent in data, windows only gate availability; a debug date override rides the §2.4 hooks for testing.

**Player-visible outcome:** the completionist game — every catalog entry reachable through a real system, a Special tab full of exotic machines, and a reason to come back at Halloween.

**Acceptance criteria:** CI reachability walks all 1,052 entries + the shrinking allowlist and fails on orphans; variation math exact; passive machines + Magic Fridge cap/reset correctly offline (golden fixture through OfflineEngine); Barrel applies to future recruits; catering board respects the daily REAL-clock window and its milestones pay once; themed-stove upgrade gates the book thirds; seasonal windows flip under the debug date; merge caps at 4; v8 fixture migrates.

### M11 — Open for (Un)Death *(launch hardening)*
**Size:** 4 · **Save:** v10 · **Spec:** `launch.md`

**Scope:** onboarding **polish** pass (the tutorial has shipped in stages since M5 — M11 adds skip/replay, copy polish, the Union Rep personality pass); mobile pass — responsive scale strategy (landscape-first + rotate prompt OR RESIZE + anchored HUD, decided on the device checklist), safe-area insets, 44px audit, DPR-aware rendering; PWA manifest + offline shell **with the §2.10 update flow** (network-first index, skipWaiting prompt); performance audit vs `budgets.json`; final accessibility audit (focus order, contrast ≥4.5:1 — most items shipped M8b); a v1 (v0.1-era) save loads through the full chain.

**Player-visible outcome:** a stranger on a phone goes from URL to first infection unaided. **This is 1.0.**

**Acceptance criteria:** first-time-user Playwright script completes the staged tutorial without dev flags; Lighthouse PWA installable, mobile performance ≥85; budgets green; export→wipe→import identical; v1 fixture loads; deferred-content allowlist is empty; DoD checklist (§7) fully green.

---

## 4. Canon tables (this section IS several authorities; everything else here cites one)

**Milestone budget:** M0:4 (incl. M-R) · M1:6 · M2:4 · M3:5 · M4:5 · M5:7 · M6:4 · M7:4 · M8:5+5 · M9:6 · M10:5+4 · M11:4 ⇒ **~68 working days / 14+ deploys.**

### 4.1 Save-version ledger (SOLE authority — canon row 15)

| Version | Milestone | Adds | Fixture |
|---|---|---|---|
| v1 | (v0.1 legacy) | brains, cafeLevel, stove timers | `saves/v1.json` |
| v2 | M0 | `toxin = min(brains, 99)` (fresh 5); schema header | `saves/v2.json` |
| v3 | M3 | layout, placements+idCounter, storage | `saves/v3.json` |
| v4 | M4 | sim state, rng seed, lastSettledAt | `saves/v4.json` |
| v5 | M5 | dishes.v2 refs, playerXP/level, favorites, streak state | `saves/v5.json` |
| v6 | M6 | roster, slots, Meat Locker | `saves/v6.json` |
| v7 | M7 | rating S/D/B, energy, quests, toxin ledger state | `saves/v7.json` |
| v8 | M9 | fridge, knockouts/revives, raid progress, retaliation flag | `saves/v8.json` |
| v9 | M10 | variations, collection, pets/tombstones/boosters, machines, catering, seasonal-seen | `saves/v9.json` |
| v10 | M11 | settings finalization, tutorial state | `saves/v10.json` |

### 4.2 Iso constants — **see canon row 1** (`IsoConfig.ts`). This doc intentionally restates nothing. (The previous "tile 64×32 / room 7×7 / zoom 0.5–2.0 / key×10" table was this doc's own drift and is deleted.)

### 4.3 Pacing bands (hybrid pillar; generator input, canon row 5)

| Cafe level | Cook band | Profit/hr (gross, declining) | XP/hr |
|---|---|---|---|
| 1–5 | 15s – 3min | $100–130 | best |
| 6–10 | 3min – 30min | $70–100 | high |
| 11–15 | 30min – 4h | $50–70 | mid |
| 16–20 | 4h – 24h | $40–55 | low |
| 21–22 | **8h – 72h** | $35–50 | lowest |

Anchors: tutorial dish ≈$120/hr active; 1-day dish ≈$44/hr overnight (research meta). Burn bands: ≤5min→5×, 6–30min→4×, >30min→3×.

### 4.4 Rating → spawns (on R 0–100; single table, canon row 3 consumer)

| R | Stars | Spawn interval (ACTIVITY clock) | Occupations |
|---|---|---|---|
| <20 | 1★ | 20s | Free tier only |
| 20–39 | 2★ | 15s | + Cash ≤$500 |
| 40–59 | 3★ | 12s | + all Cash |
| 60–79 | 4★ | 9s | + Toxin ≤10🧪 |
| 80+ | 5★ | 7s | all |

Bonus Stars (B, max 15 = 3 display stars) add to effective R for gating. Higher R also raises per-plate pay via DishMath (§2.6).

### 4.5 Engineering budgets

Game chunk ≤120KB gzip · initial JS ≤500KB gzip · download budgets per `budgets.json` (canon row 19) · engine+sim coverage ≥90% · A* 17×16 <2ms (relative-framed) · perf per §2.10 method · smoke suite <90s (chromium) + webkit boot.

### 4.6 Toxin ledger summary (authority = `toxinLedger.json`, canon row 9; this is a mirror)

**Start:** 5 (+8 total across the staged tutorial). **Faucets/week engaged ≈** streaks 7 (3-day +1 / 7-day +2 / 10-day +4, repeating) + quests ~5 + raids ~6 (cap 8/rolling-7d) + milestones/catering variable ⇒ **15–25**. **Sinks:** instant-finish 1/2/3/5/8 tiered · un-burn 1 · energy refill 1 · revive 1 · variation 5 (45 all) · Locker hooks +5 per 5 · premium infects 1–50 · expansion tiers 11+ (40…130, dual-priced) · themed-stove upgrades 8/15 · **Magic Fridge 30** · **Serum Barrel 50** · ATM 60 · premium heads 10.

---

## 5. What is KEPT from v0.1 (do not rebuild)

Data layer (`types.ts`, `content.ts`, catalogs — extended, never discarded); SaveManager/Economy/EventBus *roles* (internals rebuilt M0/M4); Boot→Preload→Cafe flow; Vite/GH Pages pipeline; Stove state-machine *logic* (re-hosted on grid+sim); Customer lifecycle skeleton; the three sprite cutouts (until M8) and `cafe_bg.jpg` (as menu art); `content.test.ts`; splash/preload polish; save-on-blur instinct.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Spec drift recurs after M-R | Canon Registry + CI checks (artconfig equality, ledger agreement, events coverage, denylist, budgets); any PR restating a canon value fails review by checklist |
| M1 room rewrite breaks playability | Parallel `CafeSceneV2` behind `?v2=1`; cutover only on green ACs; fork deleted same week |
| Legacy GridManager projection trap | API port only; 2:1 golden tests before renderer code; legacy-unity is never a fidelity source (see canon row 6) |
| M5 data regen drifts from schema (the Unity killer) | Runtime validator + one CI data test (bands/counts/anchors); regen is a reviewed PR diffing anchor dishes |
| Sim extraction changes the economy | Determinism replay + before/after anchor-rate assertions |
| OfflineEngine order-dependence bugs | The §2.3 order is normative; combined golden fixture; per-step unit tests |
| Art volume stalls M8 | Paper-doll rig (canon row 17) + manifest content drops; placeholder-icon fallback keeps content visible |
| Save migrations accumulate bugs | Ledger §4.1, fixture per version, full-chain CI forever, fault-injection suite |
| iOS Safari eviction deletes real saves | §2.7: persist(), export prompts, export/import from M3 |
| Balance is untunable with zero analytics | §2.10: copy-anonymized-stats feedback path; economy sims in CI are the primary tuning instrument |
| Scope creep | Spec front-matter freezes scope day 1; new ideas file into the next spec |

## 7. Definition of Done — "definitive modern Zombie Cafe experience"

**Fidelity (a 2011 fan's checklist):**
- [ ] Diorama room: tile floor + two decorated back walls, back-wall door, grime→luxury glow-up
- [ ] Pay-then-cook from a six-stat cookbook; pausable; Toxin instant-finish; 15s–**3-day** ladder; 15-favorite pins
- [ ] Burn windows (5×/4×/3×) forfeiting the invested price — online and offline; wallet-only
- [ ] Tap-to-dispatch servers who ferry, collect per-serving coins, bus to sinks, freeze when blocked
- [ ] Seats cap throughput; happy/sad bubbles
- [ ] Tap-to-infect with Free/Cash/Toxin tiers; occupation → stats; every infection a sacrifice
- [ ] Energy → feral → CENSORED → flee → rating craters (−6 on the one true 0–100 meter)
- [ ] Two meters: XP Level (cap 22, unlocks) and star Rating (S+D+B, away-decay, green/red blink incl. the welcome-back summary), Bonus Stars from review quests
- [ ] Seven-tab store incl. a real Special tab (passive machines, **Magic Fridge**, **Serum Barrel**, **outdoor decor**), unlimited Storage, per-tile floors, per-section walls, decor star bonuses
- [ ] Square expansion ladder 7×8→17×16, Cash early / dual Cash-or-Toxin late
- [ ] PvE raids: tap-to-command, boss tactics, truce flag, steal-serve-or-unlock, variations only from raids, rare Toxin from chefs, 8h/1-vial revive; **Rival Retaliation opt-in, default OFF**
- [ ] Variations (10/recipe), 34 gold RAREs (all in data, allowlist empty at 1.0), 11 cookbooks with **Toxin-upgradeable themed stoves**, Zombiepedia (4-state), combining (cap 4), Meat Locker, pets, tombstones, boosters, never-tiring chef
- [ ] **Union Catering Board** (the friends-loop's single-player heir) with its 1/3/10 milestone vials
- [ ] **Seasonal Event Cafe + date-windowed cosmetics** on the local clock
- [ ] Horror-comedy tone: puns (ours, per §2.9), shamble, spooky-playful music, comedic SFX, censored gore

**Modern (the remake's own bar):**
- [ ] Every one of 1,052 catalog entries reachable (CI-enforced)
- [ ] Two-clock deterministic sim, one OfflineEngine, one economy everywhere; cook progress never lost
- [ ] Every constant in one canon authority; zero cross-spec restatements (M-R complete, CI holding)
- [ ] Every tap answers <100ms with layered feedback; input-mode stack means no ambiguous tap ever
- [ ] Perf method green (throttled CI proxy + device checklist); budgets green; PWA installable with a safe update flow
- [ ] Toxin earned-only, generous (15–25/wk), never a dark pattern; no IAP, no ads, **zero analytics** (stated proudly)
- [ ] Saves migrate from v0.1 forever; export/import since M3; storage-failure UX humane; multi-tab/cross-deploy safe
- [ ] No 0-cash soft-lock (pity floor, invariant-tested); burn deadlines have return hooks
- [ ] Browser matrix honored (incl. WebKit CI + Safari eviction mitigations); accessibility: no color-only signal, reduced motion, keyboard panels
- [ ] LICENSE + licensing.md + CREDITS.md; no verbatim original names (CI denylist)
- [ ] Staged onboarding: a stranger on a phone reaches first infection unaided in under 5 minutes — true at *every* deploy from M5, not just 1.0
- [ ] PR-gated CI in front of every deploy; engine/sim ≥90%; `docs/spec/` reflects every shipped system

When every box is checked, the game on the live URL *is* the definitive modern Zombie Cafe experience.

---

## 8. Review notes — critiques resolved against, and why

Valid critiques were applied above (all fourteen blockers and every major/minor not listed here). Where reviewers *conflicted* or a critique was judged wrong, the resolution and reason:

- **R1 — Rating scale (engine engineer said adopt 0–1000; superfan + completeness said 0–100).** 0–100 S+D+B wins (canon row 3): it is the only model that consumes `furniture.json` star bonuses at research magnitudes, models bonus-star persistence, and carries the away-decay hook. The service loop's fully-enumerated deltas were the 0–1000 model's only advantage; they are regenerated onto 0–100 at M-R (a mechanical rescale), so nothing is lost.
- **R2 — XP authority (engine engineer said service loop's generator/cap 20; two reviewers said progression/cap 22).** Progression wins (canon row 4): its `0.62·cookMin^0.69` formula validates against the original's published stat lines (2m→1XP, 1d→95XP), which is a fidelity argument the service formula cannot make. The "committed verified table" advantage transfers — the generator simply consumes the winning formula and re-emits the table.
- **R3 — Door edge (engine engineer said back wall for fidelity; completeness critic said front edge because the engine spec's spawn math assumes it).** Back wall wins: the research and the original place the door in the back wall, and Pillar 1 outranks implementation convenience. The engine's spawn math is amended (walk-in offset points into the room), which is a bounded, testable change — canon row 2 specifies the single commit.
- **R4 — Original 2011 dish names as shipped content (superfan demanded them; completeness critic demanded renaming for IP).** Renaming wins (§2.9): this is a public deploy under the owner's name; names and trade dress are the protectable part of the original, while mechanics and numbers are not. Fidelity is preserved where it is legal — every one of the 59 published stat lines ships 1:1 as a generator anchor, so the *pacing fingerprint* a fan remembers (the $8/2-minute starter, the $1,500/1-day overnight bet, the 2-day/3-day endgame dishes) is intact under our own same-register puns, with a committed crosswalk. The superfan's related demand to restore the 24–72h top band **was** accepted (§4.3).
- **R5 — Serving throughput's clock (engine engineer wanted serving removed from the ×12 activity list; superfan + completeness kept it).** Kept on the activity clock: the research explicitly says foreground acceleration applied to "energy drain/regen and serving." The engineer's desync concern (coin payout vs energy) is resolved structurally — payouts are *events of* the serving sim, so they ride the same clock; only cook/burn wall-timers are exempt (§2.2).
- **R6 — 12-hour cook cap (service loop) vs 1–3-day cooks.** The cap was wrong and is removed; the research calls the timer ladder "the pacing/retention engine, not a detail," and Pillar 2 explicitly sanctions long set-and-forget cooks. Burn windows (3× a 72h cook = 9 days) make them safe without push notifications.
- **R7 — Retaliation (raids spec ships it citing an owner request; this doc said "no defense mode (fidelity)"; research says do not add a defensive layer).** Recorded once, here (§1.1): retaliation ships **opt-in, default OFF**. This honors the owner request without breaking the purist default — a player who never opens settings experiences the original's pure-PvE contract. The DoD line was added as demanded. If the owner instead vetoes it entirely, the delete is one line in §1.1, Raids §9, and the v8 ledger row — the plan is structured so either ruling is cheap.
- **R8 — Rare-dish count (raids: 10 at launch; progression CI: exactly 34 reachable).** Both fix options were combined rather than choosing one: all 34 ship in *data* at M9 (10 launch-cafe, 4 Event-Cafe, 20 on the allowlist), the reachability test reads the allowlist, and the allowlist must be empty by 1.0 — the CI gate is honest at every intermediate milestone *and* the 34-count assertion survives.
- **R9 — Streak schedule (three variants existed).** Day 3 +1 / day 7 +2 / day 10 +4, repeating: it lands the researched 10-day total (4 vials by day 10) while adding friendlier interim beats, and it now exists in exactly one place (`toxinLedger.json`). Progression's day-7 +3 variant is deleted as the drift it was.
- **R10 — Customer walk speed (engine 1.1 vs service 2.0).** 2.0 wins: the superfan's read is correct — the contrast between striding humans and shuffling zombies is part of the original's feel, and the staff formula tops out at 1.53, so 1.1 customers would out-shamble the zombies. Engine's constant is deleted at M-R (canon row 11).
- **R11 — "Pre-engine scaffolding is wasted work" (completeness).** Accepted, with one nuance kept: the `ICafeGrid`/`IPathfinder` *interfaces* survive in `contracts.ts` (they are the decoupling that lets sims unit-test in Node); only the two shipped stub *implementations* are deleted in favor of in-test fakes.
- **R12 — Soft-lock fix choice (pity grant vs 50% furniture sell path).** Pity grant wins: the original had no sell path, and adding one changes decoration economics globally to solve a corner case; the pity grant is surgical, gagged in-fiction (the Union Rep), and invariant-tested. If playtests show the pity grant fires often, the sell path is the pre-agreed escalation.


## Acceptance criteria

- [ ] Every constant that appears in two or more system specs (tile metrics, wall geometry, rating scale, XP curve, dish stats, expansion ladder, starter layout, speeds, spawn intervals, Toxin prices, zoom clamps, touch targets) is defined in exactly one Canon Registry authority (§2.1) and cited by key everywhere else; the machine-checkable subset (artconfig↔IsoConfig equality, tuning.ts key coverage, save-ledger↔spec front-matter agreement, events-map coverage, starter-layout invariants) is enforced by CI from M0/M1.
- [ ] docs/spec/save-ledger.md (§4.1) is the only document that assigns save-version integers; no system spec contains an absolute SAVE_VERSION, and the v1→v10 migration chain (brains→toxin = min(brains,99)) round-trips every committed fixture in CI.
- [ ] The two-clock time model is implemented exactly as §2.2: cook/burn/revive/streak/passive-machine timers run on wall-clock absolute timestamps in every state (foreground, hidden, offline); energy/daydream/serving-throughput/spawn/patience run on ACTIVITY_TIME_SCALE=12 foreground only; no global FOREGROUND_TIME_SCALE exists; DEMO_TIME_SCALE is deleted and replaced by the __DD_TEST_HOOKS__ harness that is provably absent from production bundles.
- [ ] One OfflineEngine settles all subsystems in the §2.3 order against a single clamped elapsed window (hidden ≥60s, cap 7 days, MAX_LIVE_CATCHUP=5s live-tick handoff), with the combined golden-fixture test green; an injected 60s frame gap produces zero angry-leave rating deltas.
- [ ] Rating is a single 0–100 R=S+D+B model (progression authority): per-delivery deltas, feral −6, burn = wallet-only, offline decay −1.0/12h applied after bonus-star expiry, spawn gates at R 20/40/60/80, and the welcome-back report shows the green/red star blink; the 0–1000, 0–50, and 1–5-star scales appear nowhere.
- [ ] dishes.v2.json is produced by one generator with progression's XP formula (round(0.62·cookMin^0.69), cap 22, 100% XP on delivery), the 97/9×21/34 book structure, the §4.3 pacing bands including the 24–72h top band, and the 59 original stat lines preserved 1:1 under renamed same-register dishes with a committed crosswalk table; CI validates bands, book counts, anchor stats, and monotonic profit/hr in one test.
- [ ] The repo ships LICENSE, docs/spec/licensing.md, and public/art/CREDITS.md at M0; no verbatim Capcom dish/cafe/character name remains in shipped data (CI denylist), and README carries the homage disclaimer.
- [ ] Onboarding is staged: the 5-step core tutorial ships with M5, the infect step with M6, the raid step with M9, polish/skip/replay at M11; all tutorial rewards defined once in quests.json (8 vials total across all stages); a stranger can earn coins in 60s at every deploy from M5 onward.
- [ ] The 0-cash soft-lock is impossible: the pity-floor grant fires under the exact §3-M5 condition and the 'no reachable state has zero income paths' invariant test is green.
- [ ] Save durability behaviors (storage-disabled banner + memory session, quota → auto-download, corrupt → offer broken-save download before wipe, export/import from M3, navigator.storage.persist()) all have fault-injection tests; the browser matrix (last-2 Chrome/Edge/Firefox + Safari/iOS 16.4+) is exercised by a WebKit boot smoke from M1, with the CPU-throttled CI perf proxy plus the per-milestone manual device checklist replacing raw device-fps ACs.
- [ ] All missing researched items are dispositioned: Magic Fridge (30 vials, free dish/day), Industrial Barrel of Zombie Serum (50 vials), Toxin-upgradeable themed stoves, outdoor decor, Union Catering Board (friends-loop substitute with 1/3/10 milestone vials), the seasonal Event Cafe layer, tab-title/favicon burn countdown, and rating-linked tips — each appears in exactly one owning milestone and, where a sink/faucet, in the single Toxin ledger.
- [ ] The Rival Retaliation decision is recorded once (ships opt-in, default OFF), reflected in M9 scope and the Definition of Done, and Raids §9 save fields land at the ledger's v8.
- [ ] Review Notes (§8) documents every critique that was rejected or resolved against a competing critique, with reasons; no critique is silently ignored.
