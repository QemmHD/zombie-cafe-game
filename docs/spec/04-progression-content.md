# Progression & Content Wiring (Cafe Level + Star Rating, Cookbooks, Quests/Toxin Faucet, Zombiepedia, Combining, Pets, Expansion, Daily Rhythm)

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# Deadbeat Diner — Progression & Content Wiring Spec (rev. 2, post-review)

**System:** Cafe Level + Star Rating (two meters), Cookbooks, Favorites, Variations, Recipe Acquisition (incl. social-substitute), Quests/Goals (primary Toxin faucet), Toxin Ledger, Zombiepedia, Zombie Combining, Pets, Special-tab Items, Expansion Ladder, Seasonal Event Cafes, Daily Rhythm
**Status:** Implementation-ready design — revision 2, reconciled against the cross-spec review
**Depends on:** Iso grid foundation (Pillar #4), Simulation-core (clock/OfflineEngine), Service loop (dish generator + serve mechanics), Infection/Staff (StaffStats, slots, energy), Raid system (drop mechanics), Build order (save ledger + events registry), `docs/spec/licensing.md`, `docs/spec/canon.md`
**Fidelity source:** `scratchpad/original_game_research.json` (all six dimensions)

---

## 0. Canon, ownership & reconciliation map

The review's root finding was that six specs restated the same constants and contradicted each other. This section is the fix: it states exactly what this spec **owns** (is the single authority for), what it **consumes** (cites by reference, never restates), and what it **deletes** from other specs. Every number this spec owns lives in a data file or in `src/sim/tuning.ts` (the shared tuning canon, indexed by `docs/spec/canon.md`, with a CI diff check); prose tables below are documentation of those keys, not second copies.

### 0.1 This spec OWNS (single authority)

| Domain | Artifact | Supersedes / deletes |
|---|---|---|
| Cafe level curve, cap (22), `totalXP` formula, XP grant timing | `src/data/unlocks.json`, §2 | Service loop's cap-20 / `6·L^2.4` / `0.35·profit^0.85`; Build order M5's `ceil(30·1.35^(n−2))` "cap 30→100". Both are **deleted**; those specs consume `unlocks.json`. |
| Star Rating canon: 0–100 = S+D+B, all deltas, decay, spawn/rarity gating, `ratingMult` | §3, tuning keys `RATING_*`, `SPAWN_INTERVAL` | Service loop's 0–1000 scale (incl. −40 feral, start 400, "no decay"); Infection's 0–50 `minStars` scale; Build order M7's 1–5 spawn table. All **deleted**; consumers regenerate onto 0–100 (see §3.4). |
| Feature/content unlock ladder (what unlocks at which level) | §2.3, `unlocks.json` | Raids-at-L4 (raid spec) → **L5**; Meat-Locker-at-L1 (infection spec) → **L2**. |
| Toxin ledger — every faucet, every sink, every price, the weekly budget test | §6.4, `src/data/toxinLedger.json` | Raid spec's own drop-budget table (mechanics stay there; **numbers** move here, set to the raid spec's values — see §6.4); service loop's instant-finish tier table; build order M5's flat-1-vial price. The Monte-Carlo budget CI test lives here only. |
| Expansion ladder data | §9, `src/data/expansion.json` | Progression rev-1's legacy-Unity 9-tier rectangles (deleted — `CafeExpansion.cs` is not a fidelity source); build order M3/M10 price quotes. Iso engine keeps `expand(w,h)` mechanics and parameterizes its ACs on this file. |
| Zombiepedia state machine (4 states) | §7 | Infection §11.3's 3-state model (its panel renders this spec's states). |
| Quest/streak/milestone definitions & rewards | `src/data/quests.json` | Build order M11's "3 hoardable vials" tutorial grant; build order's streak variant (day3=1/day7=2/day10=4). |
| Combining marks (cap 4, per-mark bonuses) | §7.1 | — |
| Pets' cafe passives | §8, `petBuffs.json` | (Raid abilities stay in the raid spec.) |
| Seasonal event calendar | §11, `src/data/events.json` | — (new; resolves the "silent on seasonal" gap) |

### 0.2 This spec CONSUMES (never restates)

| Value | Owner | Note |
|---|---|---|
| Tile metrics, WALL_H, room geometry, zoom clamps, depth bands | Iso engine `IsoConfig` | No iso constant appears in this spec. |
| Time model: cook/burn timers = wall-clock; `ACTIVITY_TIME_SCALE` (~12×) for the staff/serving activity sim | Simulation-core | §12.1 records how progression events interact with the two clocks. |
| Working-slot formula `slots(L) = min(14, ceil(0.7·L))`; zombie level cap 15; StaffStats derivation (Tips/Speed/Power/Energy/Focus) | Infection/Staff spec | §2.3 cites the formula; rev-1's "12th slot at L22" ladder is deleted. `slots(22) = 14` — matching the researched "1 at start → ~12 → 14 hard max". |
| Zombie walk speed `0.45 + 0.09·Speed` t/s; customer speed constants | Infection/Staff spec (speed module) | — |
| Dish generation (all six stats except the XP column), starter layout, pity implementation, burn mechanics, welcome-back report UI | Service loop | §4 fixes the generator's *inputs* (book counts, bands, anchors, XP formula); the generator itself is the service loop's. Starter layout = service loop's (2 stoves, 2 tables, 3 chairs, 1 counter, 1 sink — the one that can actually run the serve loop). |
| Raid drop *mechanics* (odds, boss rolls, fridge flow, revive timers) | Raid spec | Caps/prices in the ledger (§6.4). |
| Save version numbers | Build order ledger (`docs/spec/save-format.md`) | §14's schema says "fields land at save vN per ledger" — **no absolute version integers appear in this spec.** brains→toxin migration = `min(brains, 99)` (the player-friendly mapping), stated once in the ledger. |
| EventBus event names & payloads | Shared `events.d.ts` registry (build-order appendix) | §14's table lists registry keys this spec consumes/publishes; system specs may ADD events to the registry, never rename or redefine. |
| Payment formula composition | Service loop `DishMath` | `payment = perServing · (1 + tipRate(zombie.Tips)) · ratingMult(R)` — Tips from StaffStats (service loop's interim §4.3 mapping is a pre-staff shim deleted when StaffStats lands); this spec owns only `ratingMult(R) = 1 + R/200` (max 1.5× at R=100). Golden test: 3 zombies × 3 ratings, lives with DishMath. |
| Settings, browser matrix, deploy hygiene, perf-AC methodology, storage-failure UX | Settings spec / engineering-infra / save-format spec | §12 cross-references where progression systems touch them. |

### 0.3 Decisions recorded here (previously silent)

- **Defense mode:** not this spec's call; flagged that the Build Order M9 "no defense" line and the Raid spec's retaliation system still conflict — the owner must record the decision in exactly one place (recommended: build order DoD). This spec has no retaliation dependency either way.
- **Telemetry:** the game ships **zero analytics** — no network calls, no counters; this is advertised in the README as a feature. Balance tuning uses the deterministic sim harness plus an optional **"Copy my anonymized stats"** button (settings → feedback) that copies a JSON blob (level, days played, rating, Toxin earned/spent, recipes cooked) to the clipboard for voluntary sharing.
- **i18n:** English-only for 1.0; every player-facing string (Union Rep lines, quest copy, milestone names) lives in `src/data/strings/en.json` — no inline literals — so localization is a data drop later.
- **Licensing:** `docs/spec/licensing.md` (M0) owns the naming position. This spec's contract with it: original 2011 **stat lines** ship verbatim (numbers are not protectable); dish **names** pass through a filter — generic-register puns (Mystery Meat, Sloppy 'Joe', Dishwater Soup, Hobo Delight, Rot Dogs) ship as-is; distinctive coined names (Escargut, Fetidccine, Yucky-soba, Gello Mold, Tumor Melt, Green Eggs & Sam, Handburger & Flies) get same-register replacements authored in the names file (`src/data/dishNames.json`, two columns: `anchorRef` → original stat line, `displayName` → shipped name). Final per-name calls are recorded in licensing.md with owner sign-off. Cafe/character names follow the same filter.

---

## 1. Design goals

1. **Two meters, never merged.** Cafe **Level** (XP from cooking/serving → content unlocks) and **Star Rating** (service quality + decor → customer volume/quality) run as parallel tracks. The current build levels up from infection count (`CafeScene.ts:133-149`) — deleted.
2. **Every one of the 1,052 catalog entries reachable** — or on a committed, shrinking deferred-content allowlist (§4.6). CI-verified.
3. **Toxin is earned-only and generous.** Faucet budget 15–25 vials/week for an engaged free player vs. the original's ~1–2, while keeping **every** original sink — including the ones rev-1 missed (Magic Fridge, stove upgrades, the Serum Barrel).
4. **Hybrid pacing expressed in data.** Snappy 15s–3min loops at L1–5; the original's 24–72h overnight-bet dishes restored at L21–22 (rev-1's 48h cap raised — Pillar 2 explicitly sanctions long set-and-forget cooks, and burn windows at 3× make them safe).
5. **Pure-TS simulation modules** under `src/sim/progression/`, zero Phaser imports, injected `Clock`, fully unit-testable.
6. **One source per number.** Everything tunable lives in `unlocks.json` / `quests.json` / `toxinLedger.json` / `expansion.json` / `events.json` or a `tuning.ts` key; specs and code cite keys.

### Fidelity notes vs. the original

| Original | Ours | Why changed |
|---|---|---|
| Level cap 100 (General Cookbook stretched to L100) | **Cap 22** (97-dish General ladder compressed to L1–22) | The original padded IAP-era retention; our furniture data tops out at L22. Same ladder, denser. |
| Rating: stars top-left, blink green/red on return, decor star bonuses, bonus stars from review tasks, decays on neglect | Same model, formalized as 0–100 (§3), **including away-decay and the return blink** | — (rev-1's service-loop "no decay" line is deleted; decay is a researched signature) |
| 21 cookbooks / ~320 recipes / 34 rare | **11 cookbooks / 320 / 34** | 21 books over 320 dishes averages 15/book with source ambiguity; 11 gives clean math (97 + 9×21 + 34) and each themed book an identity. Logged deviation. |
| Some cookbooks require special stoves **bought with Cash and upgraded with Toxin** | Same — each themed stove has a 6-vial upgrade gating its book's top 6 dishes (§4.7) | — (restored; rev-1 lost this) |
| Recipe sources: leveling + raids + **friends (order/share)** | Leveling + raids + **Wandering Vendor + Regulars** (§5) | No backend → no social layer. The third acquisition path and the friend-milestone Toxin faucet (1/3/10 friends = +1 vial) get single-player substitutes. **Logged deviation.** |
| Magic Fridge: 30 vials, one free dish/day | Same (§10.1) | — (restored) |
| Industrial Barrel of Zombie Serum: 50 vials, boosts zombie endurance | Same (§10.2) | — (restored) |
| Special tab: pets, outdoor decor, expansion, money machines | Same, incl. outdoor decor anchors (§10.3–10.4) | — (restored) |
| Themed event cafes (Christmas Cafe → Pina Collider) + themed content-update drops (Tiki update) | Four local-clock seasonal event cafes, each with an exclusive rare + quest line + skins (§11) | No live-ops backend; local clock only. Windows repeat yearly — no permanent missables (modernized kindness). |
| 15-pin favorites; 10 versions/recipe (5 Toxin ea / 45 all); 4 tasks per bonus star, ≤3 stars, L6, 2-Toxin bribe; Meat Locker 5 hooks +5/5T max 100; combining cap 4; reviewer-bribe | All identical | — |
| Toxin faucets stingy (10-day streak = 4 vials; friend milestones) | Generous: 7-day-cadence streak, daily quest vial, milestone ladder, Regulars milestones | Owner Pillar 3. **Logged deviation** from the researched 10-day/4-vial cadence. |
| Expansion: square ladder, cash early → Toxin-only late ($3,500→8 … 50v→12; cap grew to 17×16); "cafes are always square" | Research ladder verbatim, **dual-priced** (coins **or** Toxin) on premium tiers (§9) | Pillar 3 — shape preserved, paywall pinch removed. Deviation note: researched start (7×8) and cap (17×16) are themselves non-square; interior tiers are square per research. |
| Burn punishes the wallet only | Same — burns cost cash + the dish, **no rating hit** | rev-1's −0.5 S per burn deleted; no source supports a rating penalty for burning. |
| Zombiepedia (225 intl roster) | Zombiepedia over our 105-zombie catalog, 4-state | Catalog size is what we ported. |

---

## 2. Meter 1 — Cafe Level

### 2.1 XP sources

XP comes **only** from serving and quests. Infections grant zero XP. **There is no collect-tap** — the service loop's interaction model (servers carry finished dishes off the stove; the player never taps a READY pot to collect) is adopted verbatim, and rev-1's 30%-on-collect share is deleted with it.

| Source | XP granted |
|---|---|
| Each serving delivered to a customer | **100% of dish `totalXP` ÷ servings**, accumulated fractionally, credited per delivery |
| Burned dish | 0 for all undelivered servings (already-delivered servings keep their XP) |
| Tutorial/daily/milestone quests | Per `quests.json` (§6) |
| Raid victory | Flat 25 cafe XP + 2 per defeated defender (raid spec implements; feeds this meter). Per-zombie raid XP is the Infection spec's. |

**Dish `totalXP` formula** — the single XP definition in the repo; the service-loop dish generator consumes it as an input:

```
totalXP = max(1, round(0.62 * cookTimeMinutes^0.69))
```

Validated against original published stat blocks: 2 min → 1 XP (orig 1–2), 15 min → 4 (orig 5–10), 8h → 44, 1 day → 95 (orig: Sloppy 'Joe' 95), 3 days → 194 (orig ~200–220, Escargut 200). XP-per-hour **declines** with cook time — short dishes are the leveling engine, long dishes the convenience engine, exactly the original meta. (The rejected profit-based alternative is discussed in Review Notes #2.)

### 2.2 Level curve (cap 22)

`xpToNext[level]` — XP required to advance FROM that level (lives in `src/data/unlocks.json`; documented here):

| L | XP | L | XP | L | XP |
|---|---|---|---|---|---|
| 1 | 30 | 8 | 1,200 | 15 | 10,500 |
| 2 | 70 | 9 | 1,700 | 16 | 13,500 |
| 3 | 130 | 10 | 2,400 | 17 | 17,500 |
| 4 | 220 | 11 | 3,300 | 18 | 22,500 |
| 5 | 350 | 12 | 4,500 | 19 | 29,000 |
| 6 | 550 | 13 | 6,000 | 20 | 37,000 |
| 7 | 820 | 14 | 8,000 | 21 | 47,000 |

Cumulative to L22: 206,270 XP. Pacing intent: L4–5 in session one (tutorial quests contribute ~400 XP), L10 by end of week 1, L16–18 at day 30, L22 a 3–4-month completionist goal. The Service Loop and Build Order cite this file; their rival curves are deleted.

### 2.3 Feature & content unlock ladder (single unlock authority)

Working-zombie slots are **not** defined here — they follow the Infection spec's `slots(L) = min(14, ceil(0.7·L))` (1 at L1 per research; 14 hard max, reached at L20). Column shown derived, for reading convenience only.

| Level | Unlocks (features/content) | Slots (derived) |
|---|---|---|
| 1 | General Cookbook (6 dishes); Zombiepedia visible; chef (energy never depletes) | 1 |
| 2 | **Meat Locker** (5 hooks); Expansion tier 1; recipe **favorites** | 2 |
| 3 | Store Decor tab | 3 |
| 4 | Themed book 1 stove (Bloody Brunch); Walls/Floors painting; Expansion tier 2 gate | 3 |
| 5 | **Raiding** (world map); **Wandering Vendor** first visit (§5.2) | 4 |
| 6 | **Review tasks / bonus stars** (daily Union Rep board); themed book 2; Expansion tier 3 gate | 5 |
| 8 | Themed book 3; **Pets** (first habitat + Zombie Dog quest); Expansion tier 4 gate | 6 |
| 10 | Themed book 4; **Zombie combining**; Expansion tier 5 gate | 7 |
| 12 | Themed book 5; Expansion tier 6 gate | 9 |
| 14 | Themed book 6; 2nd pet habitat | 10 |
| 15 | Expansion tier 7 gate | 11 |
| 16 | Themed book 7 | 12 |
| 18 | Themed book 8; Expansion tier 8 gate | 13 |
| 20 | Themed book 9; Expansion tier 9 gate; 3rd pet habitat | 14 (max) |
| 21 | Expansion tier 10 gate (final room); General L21 dishes | 14 |
| 22 | Final General dishes (72h cap dish); "Head Chef" gold frame cosmetic | 14 |

This table is the **only** unlock ladder; raid spec's L4 raid unlock and infection spec's L1 Meat Locker are corrected to cite it.

### 2.4 Level-up moment

Full-screen `LevelUpModal`: new level, newly unlocked dishes (tappable → cookbook pre-scrolled), feature unlock cards, +reward (level × 50 coins). Publishes registry event `cafe-level-up { level, unlockedDishIds, unlockedFeatures }`. Modal participates in the UI mode stack (§12.3) and pauses the customer/energy sim, not cook wall-clocks (§12.1).

---

## 3. Meter 2 — Star Rating (THE rating canon)

There is exactly one rating system in the game. All other specs' scales (0–1000, 0–50, 1–5 spawn tables) are deleted and regenerated from this section.

### 3.1 Formula

```
Rating R = clamp(S + D + B, 0, 100)      // displayed as R/20 stars (0–5, quarter-star fill)
```

**S — Service Score (0–40, starts at 15).** Event-driven deltas (these ARE the service loop's per-delivery deltas now — it consumes them from tuning keys):

| Event | ΔS |
|---|---|
| Serving delivered while customer happy (< 50% patience elapsed) | +0.25 |
| Serving delivered late (sad bubble showing) | +0.05 |
| Customer leaves unserved (patience expired / no seat) | −1.5 |
| Feral zombie attacks a customer (all customers flee) | −6.0 |
| Dish burns | **0 — no rating change.** Burns punish the wallet, not the stars (no source supports a rating hit; rev-1's −0.5 deleted). |
| Gain-rate cap | +6.0 per rolling **wall-clock** hour (anti-grind) |

**Neglect decay (owned here, once):** while the game is closed, S is untouched for the first 24h, then decays **−1.0 per additional 12h**, floor 5. Decay is applied by the OfflineEngine in its defined settler order (§12.2). On return, the welcome-back report (service loop renders it; data assembled by the OfflineEngine) shows the star meter **blinking red** with the lost amount — or **green** when R rose while away (decor placed pre-departure, bonus star still fresh) — the original's signature away-feedback. The service loop's "no passive decay" line is deleted.

**D — Decor Stars (0–45).** `D = min(45, Σ happinessBonus over placed furniture)` from the ported `furniture.json` field (research magnitudes: Fine Painting +10, Fish Tank +5, Fountain +3, Television +2). Copies of the same item beyond the 3rd contribute 50%. Floors and walls contribute **zero** (fidelity: surfaces are cosmetic). Items in Storage contribute nothing. Outdoor decor (§10.4) contributes like any decor. Upgraded themed stoves contribute their +1 (§4.7).

**B — Bonus Stars (0–15).** Each completed review star (§6.2) = **+5 R for 72h**, max 3 concurrent. They persist even if S drops — a shield against decay, per the original ("Bonus stars last a long time… much like the undead!").

### 3.2 What Rating drives

| Rating R | Customer spawn interval (tuning key `SPAWN_INTERVAL`) | Occupation rarity pool (`zombies.json` rarity) | Tip multiplier `ratingMult` |
|---|---|---|---|
| 0–19 | `22 − 0.14·R` s | common (30 zombies) | `1 + R/200` |
| 20–39 | " | + uncommon (30) | " |
| 40–59 | " | + rare (20) | " |
| 60–79 | " | + epic (15) | " |
| 80–100 | " (floor 8 s) | + legendary (10) | " (max 1.5×) |

This single spawn table replaces the service loop's 18→6s, build order's 20→7s, and rev-1's own restatements — `SPAWN_INTERVAL` is one tuning key.

**Rating → tips is a real loop** (restores the researched "higher rating brings better-tipping customer types" in both of its mechanisms): (a) `ratingMult` multiplies every payment via `DishMath` (§0.2), and (b) higher-rarity pools carry higher Tips stats, so unlocking bands upgrades the clientele itself.

Within an unlocked band, rarity weights: common 100 / uncommon 40 / rare 15 / epic 5 / legendary 1.5. **This is the Zombiepedia acquisition surface**: a legendary can only be infected if a legendary customer walks in, which requires R ≥ 80 — rating chase = collection chase. Zombies additionally carry `appearsAtCafeLevel` (rarity 0→L1, 1→L4, 2→L8, 3→L12, 4→L16), so level and rating gate together.

Rating recomputes on every contributing event and once per minute (bonus-star expiry, decor changes). Publishes `rating-changed { total, delta, breakdown: {s,d,b} }`.

### 3.3 Consumer regeneration (mandatory, same commit as this spec landing)

- **Infection spec** occupation table: `minStars` column regenerated as `minStars₁₀₀ = minStars₅₀ × 2` (e.g. Singularity 34 → 68, inside the epic band); its tier-weight closed form re-parameterized on R∈[0,100].
- **Service loop**: deltas/spawn sections replaced with citations to §3.1–3.2 keys; its golden fixtures regenerated.
- **Build order M7**: spawn-table AC re-written against `SPAWN_INTERVAL`.
- CI grep-gate: no `1000`-scale or `/50` rating arithmetic anywhere in `src/`.

---

## 4. Cookbooks — mapping all 320 dishes

### 4.1 One generator, one owner, fixed inputs

The **service-loop economy workstream's generator** is the only thing that writes `dishes.v2.json` (its closed forms for price/servings/earnings are the tested ones). This spec fixes the generator's **inputs**, which CI asserts:

1. **Book structure** (§4.2 counts: 97 + 9×21 + 34 = 320).
2. **XP column** = §2.1 formula.
3. **Anchor set** = the 59 original 2011 stat lines, re-anchored **by name** through the licensing filter (§0.3): Mystery Meat L1 $8 / 2m / 12 servings / $12 / 1 XP is the tutorial dish; Hobo Delight L1 $30/5m/20/$40; Dishwater Soup L2 $125/15m/50/$150; … Sloppy 'Joe' $1,500/1d/850/$2,550/95 XP; Escargut $5,500/2d/1,100/$7,700/200 XP; the L22 cap dish is the Yucky-soba analog at 72h. The 59 anchors seed the General spine; the generator interpolates the remaining 38 General dishes and renames the 261 `dish_special_*` fillers into themed/rare books (repo pun names like Finger Fries/Brainstem Bisque survive **only** as themed-book filler, never as the General spine — rev-1's invented spine is deleted).
4. **Cook-time bands per level** (the hybrid-pacing contract):

| Cafe level band | Cook times | Session intent |
|---|---|---|
| L1–5 | 15 s – 3 min | Snappy attended play; best profit/hr and XP/hr |
| L6–10 | 3 – 30 min | Errand-length loops |
| L11–15 | 30 min – 4 h | Half-day cadence |
| L16–20 | 4 – 24 h | Overnight set-and-forget |
| L21–22 | **24 – 72 h** | The original's multi-day overnight bet, restored (rev-1 capped at 48h; the service loop's 12h cap is deleted). Biggest absolute payouts, worst rates. |

Burn windows (owned by the service loop, restated as fidelity context): cook ≤5 min → burns at 5× cook time; 6–30 min → 4×; >30 min → 3×. A 72h dish therefore has a 9-day burn horizon — safe to ship without push notifications (§12.6).

### 4.2 Structure (sums to exactly 320)

| # | Book | Dishes | Unlock | Dish level range |
|---|---|---|---|---|
| 1 | **The General Cookbook** | 97 | Always open | L1–L22 |
| 2 | Bloody Brunch | 21 | "Brunch Griddle" stove — 2,500c, L4 | L4–L10 |
| 3 | Cursed Cauldron | 21 | "Cauldron" — 6,000c, L6 | L6–L12 |
| 4 | Gross Grill | 21 | "Charnel Grill" — 15,000c, L8 | L8–L14 |
| 5 | Sinister Sweets | 21 | "Coffin Oven" — 35,000c, L10 | L10–L16 |
| 6 | Deadly Drive-Thru | 21 | "Fry-o-later" — 70,000c, L12 | L12–L17 |
| 7 | Toxic Tiki | 21 | "Tiki Torch Spit" — 120,000c, L14 | L14–L18 |
| 8 | Midnight Mortuary | 21 | "Slab Range" — 200,000c, L16 | L16–L20 |
| 9 | Galactic Gutbuster | 21 | "Plasma Cooker" — 350,000c, L18 | L18–L21 |
| 10 | Haunted Holiday | 21 | "Hearthstone Hearth" — 500,000c, L20 | L20–L22 |
| 11 | **Rare Raids** (gold) | 34 | Raids / event cafes / Vendor rumor / 1 Toxin-only (§4.6) | L5–L22 (level-gated even if stolen early — you can hold a dish you can't yet cook, per original) |

**General ladder (97):** L1: 6 · L2–L10: 5 each (45) · L11–L20: 4 each (40) · L21–L22: 3 each (6).

### 4.3 Data model

`src/data/cookbooks.json` as rev-1 (unlock descriptors `always | stove | raid`), plus dish schema additions consumed here: `cookbookId`, `totalXP`, `rare?: true`, `requiresStoveUpgrade?: true` (§4.7), `eventId?: string` (§11). CI asserts: valid `cookbookId` on all 320; per-book counts; `cafeLevelRequired ≤ 22`; General ladder counts; band compliance; monotonic non-decreasing profit-per-hour violations flagged.

### 4.4 Cookbook UI

Tapping an **idle stove** opens `CookbookPanel` (replaces auto-cook at `CafeScene.ts:69-77`); the panel registers as a modal layer in the UI mode stack (§12.3):
- Tab strip of unlocked books; locked books as silhouettes with unlock hint ("Requires Coffin Oven, L10").
- **Favorites row first**, then dishes grouped by level; locked dishes greyed with "Unlocks at L14"; upgrade-gated dishes show a vial-lock ("Reinforce this stove — 6 Toxin").
- Dish card: full 6-stat block + burn-window hint ("Burns 45 min after ready").
- Confirm = pay `price` (refuse + shake if unaffordable); stove enters cooking.
- Rares render gold-framed; un-unlocked stolen rares show "Serve once" / "Unlock forever" (raid spec's fridge flow).

### 4.5 Favorites (pin 15)

As rev-1: long-press/star to pin, max 15, 16th prompts replace; favorites render first in every tab and as a quick-strip on stove tap. `save.cookbooks.favorites: string[]`.

### 4.6 Rare dishes — all 34 authored at raid launch

All 34 rares exist in `dishes.v2.json` from the raid milestone (resolving the 10-vs-34 contract break):

| Source | Count | Notes |
|---|---|---|
| 5 launch enemy cafes | 25 (5 per cafe) | Raid spec's drop mechanics (counter-steal 4%, boss bonus 8%) |
| 4 seasonal event cafes (§11) | 4 (1 each) | The Pina-Collider pattern — event-tied rares, windows repeat yearly |
| Future cafes | 4 | Listed in `tests/fixtures/deferred-content.json` — the committed allowlist the reachability test reads; CI asserts it only ever shrinks and is **empty at 1.0** |
| Toxin-only "House Special" | 1 | 25 vials direct unlock — the "Beeline Honey Glazed Ham" pattern (research: at least one rare was Toxin-only) |

**Variations land WITH raids, not one milestone later:** research says raiding is the only in-game source of variations, so basic variation drops (Spicy/Fancy/Bulk/…) enter the raid loot table at raid launch. The Toxin purchase UI (5 each / 45 all-nine) may lag one milestone; the schema (`save.cookbooks.variations: Record<dishId, string[]>`) ships from the start. Effects per original: Spicy +10% XP · Very Spicy +20% · Fancy +15% price/earnings · Very Fancy +30% · Bulk 2× price/earnings/XP same time · Fresh burn window ×2 · Frozen cook ×2 price −25% · Quick −10% · Very Quick −20%.

### 4.7 Toxin-upgradeable themed stoves (restored fidelity beat + sink)

Research (dim 0): some cookbooks "require special stoves bought with Cash and **upgraded with Toxin**." Each of the 9 themed stoves has one upgrade tier, **"Reinforced"** — cost **6 Toxin** — which: (a) unlocks that book's final 6 dishes (dishes 16–21 carry `requiresStoveUpgrade`), (b) grants the stove +1 happinessBonus (feeds D), (c) −5% cook time on that stove. 9 × 6 = 54 vials of desirable mid-game sink. The stove remains fully functional un-upgraded for dishes 1–15. Reachability CI includes the upgrade path.

Themed stoves are existing `furniture.json` entries (9 of the 61 stove-type items get `cookbookId` + `upgrade` fields); only that stove type can cook its book's dishes — a real layout constraint on the grid.

---

## 5. Recipe acquisition — three paths, like the original

The original had three recipe sources: leveling, raids, and **friends**. We can't ship friends (no backend — logged deviation, §1 table); the third path gets a single-player substitute so the acquisition texture survives.

### 5.1 Leveling (the spine) — §2/§4.
### 5.2 Raids (the sideways expansion) — raid spec; rares per §4.6.
### 5.3 The Wandering Vendor (friend-ordering substitute, unlocks L5)

A zombie food-truck vendor parks outside the cafe (outdoor anchor, §10.4) **twice a week** (local-clock schedule in `events.json`; Union Rep toast announces arrival; vendor stays 24h):

- Offers **2 recipe orders** drawn from books you own, weighted toward dishes ≤ 3 levels above your current unlock frontier and not yet cooked.
- Order = pay **2× the dish price** in cash → the dish arrives in your **fridge** after a 24h wait (same serve-once-or-unlock flow as raid steals; unlock consumes the order).
- Level gate preserved: you can hold an ordered dish you can't yet cook.
- Occasionally (10%) the vendor instead sells a **rumor**: reveals which enemy/event cafe drops a specific rare you're missing (pure information — feeds the chase).

This reproduces "order food from friends" as pacing (a slower, cash-priced side-channel into the catalog) without any network. Deviation logged.

### 5.4 Regulars (friend-milestone substitute)

A customer archetype becomes a **Regular** after you've served that occupation 25 times (tracked per `zombieId`, shown as a heart pip on the Zombiepedia card). Milestones mirror the original's friend-count Toxin (1/3/10 friends = +1 vial each): **1 / 3 / 10 Regulars → +1 Toxin each** (one-time, 3 vials total). Regulars also get +20% patience when they visit — a small warm loop that rewards not infecting everyone.

---

## 6. Quests & goals — the primary Toxin faucet

Three layers in `src/sim/progression/Quests.ts` + `src/data/quests.json`. All reward numbers live in `quests.json` **only** (build order M11's "3 hoardable vials" line is superseded; note: the original's tutorial did gift 3 vials — ours grants 8 total per Pillar 3, deviation logged).

### 6.1 Tutorial quest chain — 16 steps, PHASED across milestones

Onboarding no longer waits for the final milestone: each block ships **with the system it teaches** (resolving the "game is live from M0 but teaches at M11" hole). Narrated by the **Union Rep** (speech-bubble portrait, dry undead humor; all copy in `strings/en.json`).

| Phase (ships with) | # | Quest | Teach | Reward |
|---|---|---|---|---|
| Service milestone | 1 | Cook Mystery Meat (pay $8, 2 min — the original's first dish) | pay-then-cook | 20c, 10 XP |
| | 2 | Watch the burn ring — Rep demos a free instant-finish on your pot | burn window + the Toxin sink, without spending player vials | 15c, 10 XP |
| | 3 | Dispatch your chef: tap chef → tap counter | tap-to-serve | 30c, 15 XP |
| | 4 | Serve 5 customers | servings pool | 40c, 20 XP |
| | 7* | Cook 2 dishes at once | parallelism | 50c, 20 XP |
| | 8* | Buy + place a table & chair | placement/grid | 60c, 25 XP |
| | 10* | Pin a favorite recipe | favorites | 25c, 10 XP |
| Infection/rating milestone | 5 | Infect your first customer (free tier) | infection | **1 Toxin**, 20 XP |
| | 6 | Assign your zombie to a stove | staffing | 30c, 15 XP |
| | 9 | Reach Rating 20 | rating meter | **1 Toxin**, 25 XP |
| | 11 | Rest a tired zombie | energy | 40c, 20 XP |
| | 12 | Reach Cafe Level 3 | XP meter | **2 Toxin**, 50c |
| Expansion/cookbook milestone | 13 | Buy Expansion Tier 1 (8×8) | expansion | **1 Toxin**, 40 XP |
| | 14 | Buy the Brunch Griddle | cookbooks | 100c, 50 XP |
| Raid milestone | 15 | Win your first raid | raiding | **2 Toxin**, 60 XP |
| | 16 | Complete a Union Rep daily task | daily-loop handoff | **1 Toxin**, 50c |

\* steps renumber contiguously per installed phase; `save.quests.tutorialIndex` tracks position per phase. Total grants: **8 Toxin, ~1,900c, ~400 XP**. No skip (chain is short by design); replay from settings ships with the polish milestone.

### 6.2 Daily Union Rep board (bonus-star tasks) — unlocks L6

- **4 active tasks** drawn daily (local midnight) from a level-band-parameterized template pool: cook N from book X · serve N customers · earn N serving coins · deliver N while happy · infect rarity ≥ r · win a raid · bus N plates · start a cook ≥ T · place decor worth ≥ +2 · combine two zombies (L10+). Never requires a >4h cook.
- All 4 done = **1 Bonus Star** (+5 R, 72h, max 3 concurrent). **First star each day also grants 1 Toxin** (the daily vial); 2nd/3rd stars (board refreshes per star) grant 250×level coins and 40×level XP instead.
- **Bribe (fidelity sink):** skip any single task for **2 Toxin**.
- Missed days don't punish; the board refreshes.
- Empty/locked state pre-L6: board icon visible but chalk-dusted, tooltip "The Rep starts posting jobs at Level 6."

### 6.3 Streaks & milestones

**Daily cook streak ("Frequent Fryer"):** a day counts if you *start or collect* at least one cook while online. Day 3: **+1 Toxin**; day 7: **+3**; every 7 consecutive days thereafter: **+3**. One 24h grace token per 30 days. Dishes >24h count only on their start day (original rule). Deviation logged: original was 10 days = 4 vials; ours is denser per Pillar 3. This table is the only streak definition (build order variant deleted).

**Milestones (one-time, `save.quests.milestonesClaimed`):**

| Milestone | Reward |
|---|---|
| 25 / 50 / 100 / 200 distinct recipes cooked | 2 / 3 / 4 / 6 Toxin + 500×tier coins + 100/250/600/1,500 XP |
| Zombiepedia: all commons / uncommons / rares / epics / legendaries infected | 3 / 4 / 5 / 6 / 8 Toxin |
| Full Zombiepedia (105/105) | 15 Toxin + "Zombie of the Year" statue (+10 D, unique) |
| Each expansion tier purchased (10) | 1 Toxin each |
| First combine / first 4-mark zombie | 1 / 3 Toxin |
| First pet housed / all 9 pets | 1 / 5 Toxin |
| Each themed book fully cooked (21/21) | 2 Toxin each (18 total) |
| Rating 60 / 80 / 100 first reached | 1 / 2 / 3 Toxin |
| Regulars 1 / 3 / 10 (§5.4) | 1 / 1 / 1 Toxin |
| Each seasonal event quest line (§11) | 2 Toxin each |

### 6.4 THE Toxin Ledger — `src/data/toxinLedger.json`

This is the **single source** for every faucet cap and sink price in the game. The raid spec owns *how* drops roll; the ledger owns *how much*: the ledger adopts the raid spec's numbers — **cap 8 vials per rolling 7 days, over-cap converts to +$100** — and rev-1's "20%/cap 2 per day" line is deleted. The service loop's instant-finish tier table and the build order's flat-1 price are deleted in favor of the ledger's formula. The Monte-Carlo weekly-budget CI test lives here and only here.

**Faucets (weekly, engaged player, steady state):**

| Faucet | Vials/week |
|---|---|
| Daily first bonus star (7×1) | 7 |
| Streak (steady, 3 per 7 days) | 3 |
| Raids (EV under the 8/rolling-7d cap) | 4–6 |
| Milestones (amortized, first 2 months) | 2–5 |
| Seasonal quest lines (amortized) | ~0.5 |
| Regulars (one-time, week 1–3) | ~1 |
| Tutorial (week 1 only) | 8 |
| **Steady-state total** | **≈ 16–25** ✓ (target 15–25; tune the daily vial first) |

**Sinks:**

| Sink | Price |
|---|---|
| Instant-finish a cook | `max(1, ceil(remainingHours × 0.75))` |
| **Un-burn** a just-burned dish (≤60s window) | 1 (adopted from build order M5 — on-pillar friction removal; service loop implements) |
| Instant energy refill | 1 |
| Skip 8h zombie revive | 1 |
| Premium infects | 1–50 by zombie (research-anchored tiers: 1-vial Cops → 50-vial Yokozuna-class), from `zombies.json` |
| Variation unlock | 5 each / 45 all-nine |
| Meat Locker +5 hooks | 5 (19 expansions, 100-hook max) |
| Expansion Toxin alternates | 10–130 (§9) |
| Themed stove "Reinforced" upgrade | 6 each (×9 = 54) |
| Daily-task bribe | 2 |
| Boosters (`boosters.json`) | Turbo 5 · Super 10 · Hyper 20 (2×/3×/5× cook speed, 300s) |
| Premium pets | Wolf 8 · Phoenix 12 · Dragon 20 |
| **Magic Fridge** (§10.1) | 30 |
| **Industrial Barrel of Zombie Serum** (§10.2) | 50 |
| Toxin-only rare "House Special" | 25 |
| Premium furniture variants (+star recolors) | 1–75 per item (furniture data) |

Sink menu totals 500+ vials of desirable purchases against ~80–100 earned/month — the currency stays scarce-feeling despite generous faucets.

**Starting state (tuning canon keys):** `STARTING_CASH = 300` (service loop's value adopted), `STARTING_TOXIN = 5` (fidelity), starter layout = service loop's `starterLayout.json` (2 stoves, 2 table+chair pairs +1 chair, 1 counter, 1 sink). brains→toxin migration = `min(brains, 99)` per the save ledger.

### 6.5 0-cash pity (soft-lock removal)

Pay-then-cook + delivery-only income + no sell path = a possible dead end the original punished players with; Pillar 1 says remove dated friction. **Rule (service loop implements; quest data supplies copy):** when `cash < cheapest unlocked dish price` AND no stove is COOKING/READY AND no counter batch exists, the Union Rep appears and comps one free cook of the cheapest unlocked dish ("Union bylaws say I can't let the fryer go cold. Don't tell corporate."). Fires at most once per trigger condition. Property test: no reachable state has zero income paths. (Furniture selling from Storage at 50% `sellValue` is the store spec's call; the pity floor works regardless.)

---

## 7. Zombiepedia — the collection log (owned here; Infection renders)

`src/sim/progression/Zombiepedia.ts`; panel from L1. Four states per zombie (rev-1's model wins over Infection §11.3's three-state; matches the JP "Zombie Collection shows customer+undead forms" note):

1. **Undiscovered** — dark silhouette + "???".
2. **Sighted** — that customer type has entered your cafe (recorded on `customer-spawned`). Shows customer art, name, rarity, infect cost tier.
3. **Infected** — owned at least once (survives release/locker; total infect count shown).
4. **Mastered** — kept instance has 4 combine marks. Gold nameplate + crown pip.

Layout: 5 rarity tabs (30/30/20/15/10), per-tab progress, total at top; per-card: stats (from StaffStats), infect cost, `appearsAtCafeLevel`, required rating band (§3.2), Regular progress heart (§5.4) — the log doubles as a *how-do-I-get-this* guide. **Empty state (0/105):** all silhouettes + banner "Serve customers to meet the neighborhood" + the first Sighted toast is a scripted tutorial beat. Publishes `zombiepedia-updated { zombieId, newState }`.

### 7.1 Zombie combining (unlocks L10)

- Consume a duplicate `ZombieInstance` of the same `zombieId` into a kept instance → +1 mark, max **4** (original cap).
- Per mark: +10% max Energy, +6% Tips, +6% Power (multiplicative on StaffStats base — Infection spec owns the base derivation and the level cap of 15; marks are this spec's modifier layer, applied in one place: `Combining.applyMarks(stats, marks)`).
- Duplicates come from re-infecting the same customer type — purpose for repeat commons and a min-max path for premium re-infects.
- UI: roster → zombie → Combine tab → duplicate list → confirm with stat-delta preview. Consumed instance's marks are lost (no transfer). Guard: cannot consume your last working-slot-assigned copy mid-task.
- `ZombieInstance.marks: number` (0–4).

---

## 8. Pets (9 ported) — habitat buffs

As rev-1, with slots keyed to the unlock ladder (§2.3): habitats at **L8 / L14 / L20**, max 3 active; unhoused pets rest in the roster with no effect. Habitat = `tombstone_pet_habitat` item, footprint from `pets.json`. Cafe passive (this spec, `petBuffs.json`, typed effect enum) + raid ability (raid spec, from existing data):

| Pet | Acquisition | Cafe passive |
|---|---|---|
| Zombie Dog | Free — L8 quest "A Stray Shambles In" | +5% serving walk speed |
| Ghost Cat | 15,000c | −10% energy drain while working |
| Bat | 30,000c | +4% tips |
| Crow | 45,000c | +5% raid coin loot |
| Spider | 60,000c | +10% customer patience |
| Snake | 90,000c | +5% cook speed on stoves within 3 tiles of habitat |
| Wolf | 8 Toxin | +10% zombie Power in raids |
| Phoenix | 12 Toxin | Once/day auto-revives a dead zombie |
| Dragon | 20 Toxin | +8% cook speed cafe-wide |

Same-pet passives never stack; different pets stack (multiplicatively with the Barrel, §10.2). Pets idle-wander near their habitat (grid walker, lowest path priority). **Empty state pre-L8:** Pets panel locked with the stray-dog tease ("Something sniffs at the door… L8").

---

## 9. Expansion ladder — research-verbatim, dual-priced

`src/data/expansion.json` (owned here; the Iso engine exposes `expand(w,h)` and parameterizes its ACs on this file — its AC-7 first step 7×8→8×8 now matches). The legacy-Unity ladder is deleted. Research anchor: "$3,500 → 8 squares; $25,000 or 10 vials → 9; $75,000 or 30 → 10; 40 → 11; 50 → 12; later versions grew the cap to 17×16; cafes are always square." Tiers 1–5 are those values with cash alternates added on Toxin tiers (Pillar 3); tiers 6–10 extend the documented cap growth with prices on the same curve (invented — the 2011 wiki never priced them; logged):

| Tier | Size | Cost | Level gate |
|---|---|---|---|
| — | 7×8 (starter) | — | — |
| 1 | 8×8 | $3,500 | 2 |
| 2 | 9×9 | $25,000 **or** 10 Toxin | 4 |
| 3 | 10×10 | $75,000 **or** 30 Toxin | 6 |
| 4 | 11×11 | $200,000 **or** 40 Toxin | 8 |
| 5 | 12×12 | $450,000 **or** 50 Toxin | 10 |
| 6 | 13×13 | $900,000 **or** 60 Toxin | 12 |
| 7 | 14×14 | $1,500,000 **or** 75 Toxin | 15 |
| 8 | 15×15 | $2,200,000 **or** 90 Toxin | 18 |
| 9 | 16×16 | $3,200,000 **or** 110 Toxin | 20 |
| 10 | 17×16 | $4,500,000 **or** 130 Toxin | 21 |

Deviation note: interior tiers are square per research; the researched starter (7×8) and cap (17×16) are themselves near-square and kept verbatim (they're also the Iso spec's geometry endpoints — 17×16 wins over rev-1's 16×17).

Rules: strictly sequential; each purchase grants the 1-Toxin milestone and fires `cafe-expanded { tier, width, height }`. Entry points: hammer card in Store → Special, plus a tappable ghost-border on the room edge when the next tier is affordable.

**Atomic expansion ordering (resolves the door/seat-invalidation gap):** `Expansion.purchase()` executes as one synchronous transaction — (1) `CafeGrid.expand(w,h)` re-derives walls/floors/walkability; (2) door re-validation: the door **stays at its current perimeter position if still legal** on the new perimeter, else relocates to the default edge tile (never silently mid-frame — a toast explains); (3) exactly one `cafe-expanded` fires **after** grid+door settle; (4) subscribers rebuild in registered priority order within that one dispatch: SeatIndex → TaskQueue (releases claims whose targets' interaction cells changed) → in-flight walkers (re-plan next tick); (5) save write. Integration test: expand mid-service with seated customers and a carrying server → zero dangling references, no scene restart (iso-foundation contract).

Why expand (make it earn its price): more table+chair pairs (throughput cap), more stoves (themed stoves compete for space), pet habitats, Special passive-income machines, decor for D, outdoor anchors (§10.4).

---

## 10. Special-tab items (restored)

The researched Store's **Special** tab = money machines, star boosters, expansion, pets, outdoor decor. The store spec owns the tab UI; this spec owns the items' rules.

### 10.1 Magic Fridge — 30 Toxin (unique)

Research: "Magic Fridge (30 vials) gives one free dish/day." Rule: once per local day, tap the glowing fridge → pick any **unlocked, non-rare** dish ≤ your cafe level → a full READY batch of it materializes on the fridge (acts as a counter-source for serving), price waived, normal burn window from that moment. Resets at local midnight; unused days don't bank. This is the flagship earned-Toxin sink and a daily return hook (it appears in the daily rhythm, §12.5). Presentation's "magic fridge, glowing" sprite now has its mechanic.

### 10.2 Industrial Barrel of Zombie Serum — 50 Toxin (unique)

Research: "boosts zombie endurance." Rule: while placed (not stored), **−15% energy drain cafe-wide**, stacking multiplicatively with Ghost Cat. A premium energy-economy modifier and the second-largest single sink.

### 10.3 Passive-income machines

Already in `furniture.json` (Vending Machine → ATM class): hourly rate + payout cap, collect by tap. Rates/caps per the ported data (research anchors: Vending $25/hr cap $250 … ATM $200/hr cap $5,000). The service loop's offline settlement includes their accrual; this spec only lists them as an expansion motivation and reachability entries.

### 10.4 Outdoor decor

Research puts "outdoor decor" in the Special tab. Rule: the room exterior exposes **4 outdoor anchor slots** (flanking the door and along the front wall — Iso spec defines exact tiles outside the walkable grid): awning, signboard, lamppost, hedge/planter classes from `furniture.json` entries tagged `outdoor: true`. Outdoor items contribute `happinessBonus` to D like any decor, are ignored by pathfinding, and are where the Wandering Vendor parks. Small system, big storefront-personality payoff.

---

## 11. Seasonal event cafes (local clock, no backend)

Research ties rares to event cafes (Pina Collider ← Christmas Cafe) and names themed content drops (Tiki update) as retention hooks. The decision (previously silent): **ship a cheap local-clock seasonal layer, no live-ops.** `src/data/events.json` defines four windows:

| Event | Window (local) | Content |
|---|---|---|
| Haunt Fest | Oct 15 – Nov 5 | Event cafe on the world map + 1 exclusive rare + 6-quest line (2 Toxin) + wall/floor skin set |
| Deep Freeze | Dec 10 – Jan 5 | Same shape (the Pina-Collider slot) |
| Sprout Rot | Mar 15 – Apr 5 | Same shape |
| Tiki Torch | Jul 1 – Jul 21 | Same shape (the Tiki-update homage; pairs with the Toxic Tiki book) |

Rules: event cafes are normal raid targets (raid spec mechanics) that only appear during their window; their rare drops repeat **every year** (no permanent missables — modernized kindness, logged); skins are permanent once bought; quest lines are one-time. Clock injection makes windows fully testable; players who move their system clock only cheat themselves (zero-analytics single-player — accepted).

---

## 12. Cross-cutting integration (the review's structural fixes, as they touch progression)

### 12.1 Time model (consumed from simulation-core)

Two clocks, decided once in simulation-core: **cook timers and burn deadlines are wall-clock absolute timestamps, always**; a single `ACTIVITY_TIME_SCALE` (~12×, the Staff spec's model, inside the researched 10–15× band) applies to the staff activity sim (energy/daydream/serving throughput) in the foreground. The build order's global `FOREGROUND_TIME_SCALE` is deleted. Progression is clock-agnostic — its XP/rating deltas are event-driven and fire on whichever clock emits the event — except: the S gain cap (+6/rolling hour) and streak day-keys are **wall-clock**; bonus-star 72h expiries are wall-clock timestamps. `DEMO_TIME_SCALE` (config.ts:18) is deleted; every sim module takes an injected `Clock`, and the test harness provides `SteppableClock` (dev/CI builds expose a `window.__dd_clock` hook for Playwright, guarded out of production bundles by a CI assertion).

### 12.2 Offline settlement (registered settlers, fixed order)

One `OfflineEngine` (simulation-core) computes a single clamped elapsed window (clamp **7 days** — the 14-day variant is deleted) and runs registered settlers in fixed order: (1) stove completion & burn, (2) counter/serving sales, (3) staff energy & incidents, (4) raid revive timers, (5) **bonus-star expiry** (progression), (6) **S decay** (progression — after expiry so the report shows both), (7) rating recompute + welcome-back report assembly (dishes/coins/burns from the service settlers **plus the red/green rating blink line** — one report, not two). Settlement runs only when hidden ≥60s (below: freeze & resume); a `MAX_LIVE_CATCHUP` (5s) routes throttled-tab bursts through settlement with zero rating deltas (live customers despawn first). Combined golden test: 72h-absence fixture asserts every settler's output including exact decay and blink values.

### 12.3 Input modes & pause

Progression's panels (Cookbook, Quest board, Zombiepedia, Pets, LevelUpModal, ExpansionPrompt) register as **modal layers** on the shared UI mode stack (input-arbitration spec): opening one suspends tap-dispatch/infect/placement modes beneath it; Esc/back pops. Full-screen modals pause the customer/energy sim, never cook wall-clocks.

### 12.4 Empty states (owned panels)

| Surface | Zero-data state |
|---|---|
| Zombiepedia 0/105 | All silhouettes + "Serve customers to meet the neighborhood"; first Sighted toast scripted |
| Quest board < L6 | Chalk-dusted board, "The Rep starts posting jobs at Level 6" |
| World map < L5 | Map button greyed with fog-of-war art + level hint |
| Pets < L8 | Locked panel + stray-dog tease |
| Locked cookbook tabs | Silhouette + unlock hint (already §4.4) |
| Favorites empty | Ghost row: "Long-press a dish to pin it" |

(Fridge-empty and Storage-empty belong to the raid and store specs; flagged there.)

### 12.5 Daily rhythm (hybrid pacing) — updated

Target cadence, settled mid-game player (L10–15). The schedule is created purely by dish choice + burn windows + daily systems:

| Beat | Duration | What happens |
|---|---|---|
| **Morning check** | 2–3 min | Welcome-back report (incl. rating blink); overnight cook finished, burn countdown visible → dispatch, collect. **Tap the Magic Fridge** for the free daily batch. Start a work-day cook (4–8h). Glance at the 4 Rep tasks. Streak tick. |
| **Midday session** | 10–15 min | Favorites rotation for XP/profit rate, serve rushes, infect a good walk-in, 2–3 daily tasks. Vendor day? Place an order. |
| **Evening session** | 15–30 min | 4th task → bonus star + daily vial. 1–2 raids. Decor/expansion shopping. Start the overnight cook (8–24h; 3× burn window covers sleep). Combine/roster housekeeping. |

Return hooks while away are the **service loop's** tab-title/favicon burn countdown and opt-in local notifications (flagged as its M5 requirement); this spec's burn-window tuning assumes **no** push exists (72h top-band → 9-day burn horizon). Design guarantees: an 8h dish burns at 24h — one missed morning recoverable; nothing needs a session >~30 min or >3 check-ins/day; a 2-day absence costs some S and maybe one dish — sting, not spiral.

**Modernization-stack bundle check:** daydream auto-resume + server auto-task-loop + patience pause + free Scout + feral grace are individually logged deviations that jointly risk the game playing itself. They are playtested **as a bundle** at the staffing milestone; the pre-committed fidelity lever is daydream auto-resume tuned long (8–20 sim-s scaling with Focus, **off** for Focus ≤ 3 zombies) so tapping drowsy staff stays a real activity.

### 12.6 Failure modes touching progression data

Data files (`unlocks.json`, `quests.json`, `toxinLedger.json`, `expansion.json`, `events.json`) are schema-validated at boot; a failed parse falls back to the bundled snapshot with a console error (they ship in the JS bundle — no runtime fetch). Save-layer failures (quota, disabled storage, corrupt blob, Safari ITP eviction mitigation via `navigator.storage.persist()` + export prompts) are the save-format spec's; progression only guarantees all its fields default sanely from an empty object.

---

## 13. First two hours — minute-by-minute (regenerated from canon)

**Assumed constants (header — drift is visible here):** `STARTING_CASH 300 · STARTING_TOXIN 5 · starter layout: 2 stoves, 2 table+chair pairs + 1 chair, 1 counter, 1 sink (service loop's starterLayout.json) · S start 15 · SPAWN_INTERVAL 22−0.14R · Mystery Meat L1 $8/2m/12 servings/$12/1 XP (original anchor) · Hobo Delight L1 $30/5m/20/$40 · xpToNext L1 30`.

| Time | Experience |
|---|---|
| 0:00–0:03 | Splash → Union Rep gag → Quest 1: tap stove, cookbook opens (6 dishes, rest greyed), pay $8, **2-minute** timer with countdown. Rep fills the wait teaching the room: seats, counter, sink. |
| 0:03–0:06 | READY jingle + burn ring (Quest 2 — Rep demos a free instant-finish on a second pot so the sink is taught without spending). Quest 3: tap chef → tap counter; chef ferries plates; per-serving coins pop; XP bar nudges. |
| 0:06–0:12 | Quest 4 (serve 5): re-cook loop. **L2 ≈ 0:09** (30 XP, mostly quest XP): Meat Locker + favorites + expansion cards. Star meter ticks up from 15. |
| 0:12–0:16 | Quest 5: a Businessman sits; tap → occupation card, "Infect — FREE" → collapse-and-rise → 2nd zombie, +1 Toxin. Quest 6: assign to stove 2. |
| 0:16–0:28 | Quests 7–8 (2 parallel cooks; buy table $150 + chair $75 with ghost-preview placement). Cooking Hobo Delight (5m, $30). **L3 ≈ 0:24**: 3rd slot + Decor tab. |
| 0:28–0:38 | Quest 9: chase Rating 20 — prompt serves + a cheap +2 decor. Hits 20 → +1 Toxin; first *uncommon* walks in → Zombiepedia "Sighted" toast → player opens the log, sees 105 silhouettes. |
| 0:38–0:48 | Quest 10 (pin favorite) + 11 (rest a tired zombie; Toxin-refill button shown, not pushed). Player browses greyed L4–L6 rows. |
| 0:48–1:05 | Grind rotation on favorites quick-strip; infect a 2nd free common. **L4 ≈ 0:58**: Brunch Griddle appears in Store (2,500c — aspirational). Quest 12 banked → +2 Toxin (≈5 earned + 5 start). |
| 1:05–1:20 | Coin push toward the $3,500 expansion. First sad bubble (tables full, customer leaves, −1.5 S) teaches seating-as-throughput → 3rd table set; rating recovers. |
| 1:20–1:35 | **Quest 13: Expansion Tier 1** — room grows to 8×8 live (atomic expand, no restart), +1 Toxin, confetti. Places new table set + a 3rd stove. |
| 1:35–1:50 | **L5 ≈ 1:40**: Raiding unlocks — world map reveal; Wandering Vendor teased ("a truck rattles up out front"). 4th slot; 3rd common infected. |
| 1:50–2:00 | Tutorial-tuned first raid (near-guaranteed win) → +2 Toxin, stolen dish in fridge with Serve-once/Unlock choice. Starts a 20–30 min dish ("come back after dinner"), burn window stated on the card. **Session-end: L5, Rating ~28, ~$1,300, 8–10 Toxin, 4 zombies, 10–14 recipes cooked, 1 expansion, first raid won.** |

Every original fingerprint appears inside the first 10 minutes: pay-then-cook, the 2-minute Mystery Meat, burn ring, tap-to-dispatch, per-serving coins, tap-to-infect with an occupation cost.

## 13b. 30-day retention arc

| Day(s) | Expected state | Carrot |
|---|---|---|
| 1 | L4–6, tutorial phases 1–2 done, Rating ~25–30, 8–12 Toxin | Tier-2 expansion, Bloody Brunch, daily board at L6 |
| 2–3 | L6–8, daily board + daily vial live, streak day 3 (+1), first Vendor order | Pets tease at L8; Regulars progress visible |
| 4–7 | L8–10, Zombie Dog housed, tiers 3–4, first 30min–2h cooks, streak day 7 (+3), 25-recipes (+2), 1–3 Regulars (+2) | **L10: combining + Sinister Sweets**; rare customers at Rating 40 |
| 8–14 | L10–12, first combines, 2–3 themed books, raid rotation for rares+Toxin, Rating 50–60 via decor, first stove Reinforcement (6T) | Epics at Rating 60; tier-5 (first dual-price decision: $450k vs 50 vials) |
| 15–21 | L13–15, overnight 8–12h cooks habitual, 50-recipes, 2nd habitat (L14), Zombiepedia ~45–60, commons complete (+3), maybe Magic Fridge (30T) as the first big splurge | Tier-7 (L15); Toxic Tiki; legendary sightings need Rating 80 — decor project begins |
| 22–30 | L16–18, Rare-book chase, first 4-mark Mastered (+3), Rating 70–85, seasonal window if calendar aligns | **Day 30: L16–18, Rating ~80, 5–7 books, ~70/105 Zombiepedia, tier 6–7 room, ~40–60 lifetime Toxin.** Remaining tail: L22, 17×16, full Zombiepedia, 34 rares, 9 pets, Mastery, Barrel + all Reinforcements — 3–4 months. |

Levers by week: W1 unlock cadence; W2 daily board + streak + combining + Vendor; W3 rating/decor chase gating legendaries; W4+ completionist long-tail + the daily-rhythm habit + the next seasonal window.

---

## 14. Architecture & file plan

Pure TS under `src/sim/progression/`, zero Phaser, injected `Clock`, vitest (node env). UI panels are thin Phaser views on the typed EventBus.

```
src/sim/progression/
  Progression.ts    // XP ledger, level curve, unlock resolution
  Rating.ts         // THE rating canon: S/D/B, deltas, decay settler
  Cookbooks.ts      // book/upgrade unlock state, availability, favorites, cookedCounts
  Quests.ts         // tutorial phases, daily board (seeded RNG), streaks, milestones
  Vendor.ts         // Wandering Vendor schedule + orders; Regulars tracking
  Zombiepedia.ts    // 4-state machine
  Combining.ts      // marks, applyMarks(stats, marks)
  Pets.ts           // ownership, habitats, BuffSet -> CafeSim
  Expansion.ts      // ladder, atomic purchase orchestration
  Events.ts         // seasonal windows (clock-injected)
src/data/
  cookbooks.json  expansion.json  quests.json  petBuffs.json  unlocks.json
  toxinLedger.json  events.json  dishNames.json  strings/en.json          // NEW
  types.ts  // Dish{cookbookId,totalXP,rare?,requiresStoveUpgrade?,eventId?},
            // Furniture{cookbookId?,upgrade?,outdoor?}, ZombieInstance{marks}
src/ui/
  StarMeter.ts  LevelUpModal.ts  CookbookPanel.ts  QuestPanel.ts
  ZombiepediaPanel.ts  PetPanel.ts  ExpansionPrompt.ts  VendorPanel.ts
tests/fixtures/deferred-content.json   // the shrinking allowlist
```

**Save schema additions** — fields land at save vN **per the build-order save ledger** (`docs/spec/save-format.md`); no version integer is claimed here; all fields default from empty:

```ts
progression: { xp: number; level: number };
rating: { service: number; bonusStars: { grantedAt: number; expiresAt: number }[] };
cookbooks: { unlockedBookIds: string[]; stoveUpgrades: string[]; favorites: string[];
             cookedCounts: Record<string, number>; variations: Record<string, string[]> };
quests: { tutorialIndex: Record<PhaseId, number>;
          daily: { dateKey: string; tasks: QuestTaskState[]; starsToday: number };
          streak: { days: number; lastCookDayKey: string; graceUsedAt?: number };
          milestonesClaimed: string[] };
vendor: { nextVisitAt: number; activeOrders: { dishId: string; arrivesAt: number }[];
          regularCounts: Record<string, number> };
zombiepedia: Record<string, { sighted: boolean; infectedCount: number; marks: number }>;
pets: { owned: string[]; habitats: { tombstonePlacementId: string; petId: string }[] };
expansionTier: number;          // 0 = starter 7x8
special: { magicFridgeUsedDayKey?: string; barrelOwned: boolean };
events: { questLinesDone: string[]; skinsOwned: string[] };
```

Note: `tombstonePlacementId` and all placement references rely on the iso spec's **id-preserving `moveItem`** (PlacementSession "move" must never mint a new id — flagged there).

**EventBus events** — entries in the shared `events.d.ts` registry (build-order appendix owns names/payloads; this spec may add, never rename). Registry keys consumed: `serving-delivered`, `cook-completed` (informational — no XP), `dish-burned`, `customer-left-unserved`, `feral-attack`, `customer-spawned`, `customer-infected`. Published: `cafe-level-up`, `rating-changed`, `quest-completed`, `bonus-star-earned`, `toxin-granted`, `cafe-expanded`, `zombiepedia-updated`, `vendor-arrived`, `event-window-changed`. The rev-1 `dish-collected` event is deleted with the collect interaction.

**Integration order:** (1) Progression + unlocks (replaces infection-count leveling), (2) Cookbooks + favorites + panel, (3) Rating + StarMeter + spawn gating + consumer regeneration (§3.3), (4) Quests/streaks/milestones + ledger, (5) Zombiepedia + combining, (6) Expansion, (7) Vendor + Regulars, (8) Pets, (9) Special items, (10) Seasonal events.

---

## 15. Acceptance criteria

(Structured list attached; highlights:) single 0–100 rating implementation with CI grep-gate and regenerated consumer fixtures; single XP system (cap 22, `unlocks.json`, cookTime formula, 100%-on-delivery) with generator-conformance test; Toxin ledger as the only price/cap source with a 90-day Monte-Carlo budget test hitting 15–25/week; cookbook count/band/anchor CI; all 34 rares in data with a shrink-only allowlist empty at 1.0; research-verbatim expansion ladder with atomic-expand integration test; slots/zombie-levels consumed from Infection; Vendor/Regulars, Magic Fridge, Barrel, stove upgrades, outdoor decor, and seasonal windows all present in the reachability walk; phased tutorial; pity invariant property test; zero Phaser imports + injected clock + prod-guarded test hook; centralized strings; empty states; ledger-governed save fields with no absolute version numbers.

## 16. Risks

1. **Dish regeneration dependency** — mitigated: the generator's inputs (counts, bands, anchors, XP) land first as CI assertions the generator must satisfy.
2. **Toxin inflation** — 16–25/week vs a 500+-vial sink menu; monitor via the deterministic ledger sim; tune the daily vial first.
3. **Rating grind exploits** — S cap (+6/hr wall-clock) + decor dedupe (50% past 3 copies); sim-tested.
4. **Daily-board chore feeling** — templates parameterized to level band; never require a >4h cook.
5. **Level-pacing drift** — curve is data; re-tune after first playable (targets: L2 ≤ 10 min, L5 ≤ 2h, L10 ≤ week 1).
6. **Zombiepedia dead-ends** — S floor 5 + permanent D means a decorated cafe never falls out of the epic band.
7. **Seasonal clock abuse** — accepted (single-player, zero analytics); windows repeat yearly so nothing is lost.
8. **Modernization bundle over-automation** — bundle playtest at staffing milestone; daydream lever pre-committed (§12.5).
9. **Naming/licensing rework** — the two-column `dishNames.json` isolates renames to data; no code churn if licensing.md tightens.

## 17. Art & content assets needed

Union Rep portrait set (4 expressions); 11 cookbook covers + gold RARE frame; star meter (quarter-fill, red/green blink states); bonus-star icon with 72h dial; level-up burst/modal; Zombiepedia silhouettes (auto-derived) + Mastered nameplate + crown pip + Regular heart pip; 9 pet sprites (2-frame idle wander) + habitat tombstones; quest chalkboard + check stamps; expansion ghost-border + confetti; "Zombie of the Year" statue; 9 themed stove sprites **+ 9 "Reinforced" variant overlays (green-glow trim)**; Magic Fridge glow state + daily-ready sparkle; Industrial Barrel; Wandering Vendor truck (parked, 2-frame) + panel; 4 outdoor decor classes (awning/signboard/lamppost/planter); 4 seasonal wall/floor skin sets + 4 event-cafe map icons; Toxin vial icon (replaces the 🧠 emoji).

---

## 18. Review notes — rejected or qualified critiques

Everything not listed here was accepted and applied above.

1. **"Adopt the service loop's 0–1000 rating as canon" (engine-engineer critique).** Rejected in favor of the other two reviewers' recommendation (this spec's 0–100 S+D+B). Rationale: the 0–100 model is the only one that consumes `furniture.json` `happinessBonus` at research magnitudes (Fine Painting +10 reads directly as +10 D), models bonus-star persistence and away-decay (both researched signatures the 0–1000 model omitted — it explicitly denied decay), and decomposes into the S/D/B breakdown the UI and welcome-back report need. The engineer's real requirement — fully enumerated event deltas — is satisfied: §3.1 enumerates them on 0–100 and the service loop consumes them as tuning keys.
2. **"Make the service spec's XP curve/formula authoritative (cap 20, `0.35·profit^0.85`)" (engine-engineer).** Rejected; two reviewers assigned XP authority here, and the cookTime formula is validated against original published XP lines (2m→1, 1d→95, 3d→194≈orig 200). A profit-based formula double-counts the economy (any earnings retune silently retunes leveling) and inverts the original meta where short dishes are the XP engine. The service spec's cap-20 unlock references are re-indexed to this L1–22 ladder.
3. **"Remove serving throughput from the 12× activity clock" (engine-engineer) vs. "include it" (superfan + completeness critic).** Not this spec's decision — simulation-core owns the clock split. Recorded here: two of three reviewers, and the research ("foreground sim runs 10–15× faster" applying to energy/serving), favor including serving throughput; this spec is agnostic because its deltas are event-driven, except the wall-clock items called out in §12.1. The recommendation forwarded to simulation-core is to include it.
4. **"Rename ALL verbatim Capcom dish names" (completeness/licensing) vs. "restore the original menu by name" (superfan).** Both applied via the licensing filter (§0.3): stat lines verbatim (unprotectable numbers, full mechanical fidelity), generic-register pun names kept, distinctive coined names replaced with same-register originals, per-name calls recorded in licensing.md. Neither critique gets 100% of the namespace; the tension is now a signed-off data file instead of a silent contradiction.
5. **"Streak should match the original 10-day = 4 vials" (implicit in the superfan's fidelity framing).** Qualified: kept the modernized 3/7-day cadence — Pillar 3 explicitly mandates a generous faucet, and the 10-day cliff was IAP-era friction. Logged as a deviation in §1; the researched rule that >24h dishes count on their start day IS kept.
6. **"Raid Toxin numbers belong to the raid spec" (engine-engineer) vs. "Progression §5.4 is the single Toxin ledger" (completeness).** Reconciled rather than choosing: the ledger (§6.4) is the single home for *numbers* (adopting the raid spec's 8-per-rolling-7-days cap verbatim, deleting rev-1's 2/day), while drop *mechanics* stay in the raid spec. Both critiques' actual complaints — double-booked numbers, two Monte-Carlo tests — are resolved: one table, one test, here.
7. **"Expansion ladder: 9 tiers ending 16×17" (rev-1) — both reviewers demanded the research/Iso ladder ending 17×16.** Accepted; additionally noted (not raised by any critique) that research prices exist only through the 12-tile tier, so tiers 6–10 prices are invented on the same curve and flagged as such — silent invention was the disease being cured, so the invention is logged.
8. **Defense-mode contradiction.** Out of this spec's jurisdiction; recorded in §0.3 as an owner decision still required in exactly one document. No progression system depends on the outcome.
9. **Onboarding-at-M11 critique.** Accepted via phasing (§6.1); note the reconciliation on vial totals: quests.json's 8 Toxin stands (Pillar 3), the original's 3-vial tutorial gift is acknowledged as the fidelity datum, and the build order's "3 hoardable vials" line is superseded rather than split across two documents.
10. **Perf/browser-matrix/deploy-hygiene critiques.** Valid but owned by engineering-infra/settings specs; this spec deliberately adds no perf ACs and references those documents (§0.2, §12.6) instead of restating them — restatement is the exact failure mode this revision exists to end.

## Acceptance criteria

- [ ] Single rating scale: the repo contains exactly one rating implementation (0–100 = S+D+B in src/sim/progression/Rating.ts); a CI grep-gate fails if any source or spec file references a 0–1000 or 0–50 rating scale; the Infection spec's occupation minStars column and the service loop's per-delivery deltas are regenerated onto 0–100 and their golden fixtures pass against Rating.ts outputs.
- [ ] Single level system: level cap 22, the 21-row xpToNext table in src/data/unlocks.json, and totalXP = max(1, round(0.62·cookTimeMinutes^0.69)) are the only XP definitions in the repo; a vitest asserts the dish generator's XP column equals the formula for all 320 dishes and that no other module defines an XP curve.
- [ ] XP grant timing: 100% of totalXP is granted pro-rata per serving delivered; no collect-tap XP path exists; a burned dish grants 0 XP for undelivered servings; unit test covers partial-batch burn.
- [ ] Rating deltas: happy delivery +0.25, late +0.05, unserved leave −1.5, feral attack −6.0, S gain cap +6.0 per rolling wall-clock hour; dish burns cause NO rating change (wallet-only); all verified by unit tests reading constants from tuning canon keys, never literals.
- [ ] Offline decay: S untouched for first 24h offline, then −1.0 per additional 12h, floor 5; decay is a registered OfflineEngine settler that runs AFTER bonus-star expiry and stove/counter/staff settlement per the documented settler order; a combined golden test (72h absence fixture) asserts the exact report values and that the welcome-back report shows the red/green rating blink.
- [ ] Toxin ledger: src/data/toxinLedger.json is the only file defining faucet caps and sink prices; a 90-day engaged-player Monte-Carlo vitest run against the ledger yields 15–25 vials/week steady-state (raid faucet integrated at the raids spec's 8-per-rolling-7-days cap); the raids and service-loop specs contain no Toxin numbers of their own.
- [ ] Cookbook structure: CI asserts per-book counts 97 + 9×21 + 34 = 320, General ladder counts (6/5×9/4×10/3×2), every dish cafeLevelRequired ≤ 22, every themed book's final 6 dishes carry requiresStoveUpgrade, and every dish has a valid cookbookId.
- [ ] Original-menu anchoring: the General Cookbook spine contains the 59 original 2011 stat lines (Mystery Meat L1 $8/2m/12/$12/1XP as the tutorial dish through the L22 cap dish at 72h) with names passed through the licensing filter in docs/spec/licensing.md; cook-time bands per level match the table including the restored 24–72h top band; burn windows are 5×/4×/3× by band.
- [ ] Rare reachability: all 34 rare dishes exist in data at raid launch; a reachability test walks all 1,052 catalog entries and passes iff every entry is reachable at launch OR listed in tests/fixtures/deferred-content.json; a second test asserts that allowlist only ever shrinks (committed snapshot comparison) and is empty at the 1.0 tag.
- [ ] Expansion: src/data/expansion.json holds the 10-purchase ladder (8×8 $3,500 → 17×16 $4.5M-or-130-Toxin) with research tiers 1–5 priced verbatim (plus cash alternates on Toxin tiers); purchases are strictly sequential and level-gated; the expand flow follows the documented atomic ordering (grid → door re-validation → single 'cafe-expanded' event → priority-ordered index rebuilds) with an integration test that expands mid-service without dangling seat/task references.
- [ ] Working slots and zombie levels: this spec's ladder cites the Infection spec's slots(L)=min(14, ceil(0.7·L)) and level-cap-15 as consumed values; no slot or zombie-level table is defined here; Meat Locker unlocks at L2, raiding at L5 (this ladder is the sole unlock authority).
- [ ] Social substitute: the Wandering Vendor offers 2 recipe orders per week (pay 2× price, 24h arrival, serve-once or unlock; level-gated on cook) and Regulars milestones grant +1 Toxin at 1/3/10 Regulars; both covered by unit tests and included in the reachability walk as an acquisition path.
- [ ] Magic Fridge grants exactly one free READY batch per local day of any unlocked non-rare dish ≤ cafe level with a normal burn window; Industrial Barrel applies −15% cafe-wide energy drain (unique); themed-stove Toxin upgrades (6 vials) unlock each book's final 6 dishes, +1 D and −5% cook time on that stove — all present in the ledger, the store, and the reachability test.
- [ ] Seasonal event cafes: four local-clock windows defined in src/data/events.json each expose one event cafe, one exclusive rare, one quest line, and wall/floor skins; a clock-injected test verifies a window opens/closes correctly and that missed-window rares remain obtainable in the following year's window (no permanent missables).
- [ ] Tutorial is phased: steps 1–8 ship with the service milestone, 9–12 with infection/rating, 13–14 with expansion/cookbooks, 15–16 with raids; total grants (8 Toxin / ~1,900c / ~400 XP) live only in quests.json; the build order's conflicting '3 vials' line is superseded.
- [ ] Pity invariant: a property test asserts no reachable state has zero income paths — when cash < cheapest unlocked dish price, no stove is COOKING/READY, and no counter batch exists, the Union Rep pity grant fires (service loop implements; quests.json supplies copy).
- [ ] All sim modules under src/sim/progression/ import zero Phaser, receive an injected Clock, and are deterministic under SteppableClock; a CI guard asserts the test-clock hook is absent from production bundles.
- [ ] Every player-facing string used by this spec's systems lives in src/data/strings/en.json (i18n decision: English-only, centralized); no inline UI literals in progression modules.
- [ ] Empty states implemented and screenshot-tested for: Zombiepedia 0/105, quest board pre-L6, pets panel pre-L8, world map pre-L5, locked cookbook tabs, and empty favorites row.
- [ ] Save fields land under the build-order save-version ledger (no absolute version numbers in this spec); migration fixtures for progression fields live under the ledger's fixture directory and default correctly from a pre-progression save, including brains→toxin = min(brains, 99).
