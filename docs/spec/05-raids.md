# Raids & Rival Cafes (world map, tap-to-command combat, loot, defense)

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# Deadbeat Diner — RAIDS Specification (v2.0, post-review revision)

**System:** Raids & Rival Cafes — world map, squad selection, real-time tap-to-command combat, loot, injury, retaliation defense, and the world-map meta (seasonal event cafes, Wandering Gourmand).
**Status:** Post-core milestone (the build order's raid milestone). Blocked on: isometric engine foundation (Pillar #4), Staff/Infection system (StaffStats), Service Loop (fridge/counter/dish schema), unified OfflineEngine, canonical events map, save-version ledger.
**Fidelity source:** `original_game_research.json`, dimension "Raiding and combat" (confidence: high) plus the economy/progression dimensions.
**Revision:** v2.0 applies the hostile-review reconciliation pass. The headline change is structural: this spec no longer *defines* anything another spec owns — it **consumes** canon and owns only raid mechanics and raid content. See §0 and §16 (Review notes).

---

## 0. Canon contract — what this spec consumes vs owns

The review found the six specs restating each other's constants with drift in nearly every case. This spec now follows the one-owner rule strictly. **Any number below that mirrors another spec's value is annotated `[mirror]` — the cited owner is authoritative and a CI check (`tests/canon-drift.test.ts`) fails if a mirror diverges.**

**Consumed (owner in parentheses — never redefined here):**

| Thing | Owner | Raids' usage |
|---|---|---|
| Tile metrics, wall geometry, room bounds, depth bands, camera clamps | Iso Engine spec / `src/engine/IsoConfig.ts` | Rival rooms render with the identical config; no raid-local values |
| Grid/pathfinding contracts | `src/engine/contracts.ts` (real signatures: `walkable(t: Tile)`, `placements()`, `door()`, `findPath(...): PathResult`) | RaidSim consumes these interfaces verbatim |
| Movement model: **4-connected A\***, no diagonals | Iso Engine spec | All raid pathing (see §4.2 for attack *range*, which is not pathing) |
| Walk speeds: `zombieSpeed(stats)`, `CUSTOMER_SPEED`, `FLEE_SPEED` | Shared speed module (Staff spec's formula, per reconciliation) | Raiders use `zombieSpeed`; fleeing customers use `FLEE_SPEED` |
| Zombie levels, stat derivation, energy pools | Infection/Staff spec `StaffStats.ts` — level cap **15**, `levelMult(L) = 1 + 0.05·(L−1)`, `maxEnergy = baseHP × levelMult` | §4.1 derives raid HP/ATK from these; raids adds **no** stat or schema of its own |
| Working-slot ladder, zombie XP-to-level curve | Infection/Staff spec | Raids only *credits* zombie XP (§4.6) |
| Cafe level curve, cap, `totalXP` formula, unlock ladder | Progression spec / `src/data/unlocks.json` | Raid unlock level, squad-slot levels, cafe XP per win (§8) |
| Star rating | Progression's rating canon (R = S+D+B on 0–100) | Raids **never touches rating** (asserted in tests); retaliation stakes exclude it (§9) |
| Toxin ledger (all faucet allocations + all sink prices) | Progression §5.4 (the single ledger) | Raids implements the *mechanics* that must land inside the ledger's raid allocation (§8) |
| Dish schema (6-attribute stat block), burn windows, fridge serve-batch behavior | Service Loop / dish generator | Stolen dishes are ordinary `dishes.v2.json` entries |
| Save version numbers & migration chain | Build order's `docs/spec/save-ledger.md` | §11 lists *fields only*; the ledger assigns the version integer |
| Typed events map | Canonical `events.d.ts` appendix | §3 events are **additions**; raids may never rename/redefine existing events |
| Offline settlement order & elapsed-window clamp | Unified OfflineEngine spec | §11.1 registers raid settlers |
| Input-mode stack | Input-arbitration spec | WorldMapScene and RaidScene are pushed modes (§4.3.1) |
| Settings surface | Settings spec | Retaliation toggle, aggro-ring toggle, reduced-motion (disables shake/hit-stop) |
| Time model | Simulation-core canon: cook/burn timers wall-clock; `ACTIVITY_TIME_SCALE` only for energy/daydream/serving | Raid combat is **always real-time, unscaled** — it is a foreground activity, exempt from the activity clock by definition |
| Licensing / naming | `docs/spec/licensing.md` (M0) | §6 names pass the verbatim-name blocklist lint |

**Owned by this spec (single authority):** raid combat rules and tuning (`RaidTuning.ts` keys, registered in the tuning canon); `rivalCafes.json`; `raidDishes.json` (the 34 rare golds); raid loot **mechanics** (drop odds, caps, anti-farm); fridge serve-or-unlock flow; the world map and its meta (seasonal cafes §6.7, Wandering Gourmand §6.8); Rival Retaliation (§9 — **the single decision record for defense**, see §16.1); knockout/revive.

---

## 1. Design goals

1. **Original fidelity.** A Zombie Cafe fan must recognize raiding in the first ten seconds: a world map of rival AI cafes, tap-a-zombie-then-tap-a-target live commanding, staff that fight back while customers flee and get eaten behind a CENSORED bar, a head-chef boss you save for last, a white truce flag top-left, and steal-the-counter-dish loot with the serve-or-unlock choice.
2. **Raids are the demand sink for combat-statted zombies** and a budgeted earned faucet for Toxin (Pillar 3). Fighting-statted zombies that are useless waiters finally matter.
3. **Raids feed progression without unbalancing the free economy.** Coins from raids stay a minority income stream (~10–15% of cooking income at par level, §10). Recipes — including **all** dish variations (§8.1) — are the real prize.
4. **Deterministic, testable core.** All combat runs in a pure-TS, seeded, fixed-timestep `RaidSim` under `src/sim/raid/`; the Phaser scene is a renderer. Every number in this spec is assertable in vitest against data files, not prose.

### 1.1 Fidelity notes vs the original (deliberate deviations, all logged)

| Topic | Original (2011) | Deadbeat Diner | Why |
|---|---|---|---|
| Own-cafe defense | **Did not exist** — pure PvE | Thin "Rival Retaliation" event (§9), capped stakes, first-trigger consent, opt-out | Owner request; §9 is the recorded decision (§16.1) |
| Toxin from raids | Rare drops + IAP pressure | Budgeted, capped faucet inside the Progression ledger's raid allocation | Pillar 3; no IAP to protect |
| Rival cafe count | ~4 permanent rivals + themed **event cafes** | **5 permanent** + a rotating **seasonal event slot** (§6.7) | Content scoping; event slot restores the researched event-cafe hook the plan previously dropped |
| Raid kill cash | Research cites **$20 per rival customer defeated** | $20 per staff/boss kill + $15–25 per customer eaten | Tuned split (§16.5): paying only for customer kills would make staff fights pure cost; totals per raid match the researched magnitude |
| Rare gold dishes | 34 | **All 34 in data at launch**; 10 obtainable from the 5 launch cafes, 24 on a shrink-to-zero deferred allowlist (§7.6) | Repairs the Progression CI contract |
| Content names | Capcom's names (Gourmet Goblin, Drac's Snack Shack, Red Dragon, Blueberry Fangcake…) | Same-register **original** names (§6), verbatim names blocklisted per licensing.md | Legal safety for a public deploy; mechanics/trade-dress-free homage preserved (§16.7) |
| Friend "franchise" (order food / share recipes / friend-Toxin) | Facebook social layer; the 3rd recipe source | No backend → replaced single-player: **Wandering Gourmand** NPC (§6.8) is the third recipe-acquisition path; friend-milestone Toxin (1/3/10 friends) is reallocated to Progression's quest faucet — logged there | Previously the path silently vanished; now a logged substitute |
| Pets in raids | Later update | Deferred; RaidSim reserves a 5th squad slot type `pet` | Scoping; pets.json exists |
| Variations from raids | Raiding was the **only** variation source | Variation-ingredient drops in the launch loot table (§8.1) | Previously a one-milestone gap; closed |

---

## 2. Player flow

```
HUD "Raid" button (locked state pre-unlock, §2.1)
  → WorldMapScene (5 rival cafes + home cafe + seasonal slot + Gourmand cart)
    → tap a rival → Cafe card (theme, difficulty skulls, recommended level, loot preview, rebuild timer)
      → "Scout" (free: shows enemy roster + counter dish category)   [modernization, see §16.8]
      → "Raid" → Squad picker (2–4 idle zombies, energy ≥ 40%)
        → RaidScene: real-time battle in the rival's iso room
          → WIN (boss dead): result screen → loot → fridge choice queued
          → RETREAT (truce flag): keep kill/eat loot, forfeit dish + chest
          → WIPE (all zombies KO): keep kill/eat loot earned so far
        → back to WorldMap → back to cafe
```

- **Unlock:** raids unlock at the cafe level assigned in `unlocks.json` key `raids.unlock` — this spec requests **cafe level 4** `[mirror — unlocks.json authoritative]` — via a Zombie Union Rep popup ("Time to unionize the competition… permanently").
- **Squad size:** 2 slots at unlock, 3 and 4 at `unlocks.json` keys `raids.squad3` / `raids.squad4` (requested L8/L12 `[mirror]`; hard max 4 + reserved pet slot).
- **Eligibility:** `assignment ∈ {idle, meatlocker}`, `energy ≥ 40% of maxEnergy` (StaffStats pool), not knocked out. Assigned kitchen/serving zombies can be unassigned with one tap inside the picker.
- **Session length target:** tier-1 raid 60–120 s; tier-5 raid 4–6 min. Raids are the "snappy" pole of the hybrid pacing pillar.

### 2.1 Empty / zero-data states (previously unspecced)

- **Pre-unlock:** the HUD Raid button renders locked (padlock + skull) with tooltip "Rival cafes unlock at Cafe Lv 4". Tapping it shows a one-line teaser toast, not a dead click.
- **World map, nothing scouted:** cafe cards show silhouetted vignettes + "??? — Scout to reveal" until first scout; difficulty skulls always visible.
- **Fridge, empty:** "No stolen dishes yet. Raid a rival and take theirs." + a Raid shortcut button.
- **Defense tab, empty (§9):** hidden entirely until the first retaliation consent dialog has been shown; after that, empty slots read "Defaults to your strongest idle zombies".

---

## 3. Architecture & file plan

Raids reuse the Pillar-#4 engine wholesale. A rival cafe **is** a `CafeGrid` room — same data format, same renderer, same pathfinding — loaded from static JSON instead of the save.

```
src/sim/raid/            // moved from src/raid/ so the sim-purity ESLint boundary (no Phaser,
                         // no DOM, no Date.now) covers it without special-casing
  RaidSim.ts             // pure TS. Fixed 100 ms tick, advanced only by tick(n) — no wall-clock reads.
                         // Seeded RNG (mulberry32). Owns: units[], orders, cooldowns, aggro,
                         // energy drain, loot rolls, win/lose state.
  RaidUnit.ts            // plain-data unit: id, side ('raider'|'staff'|'boss'|'customer'), hp, maxHp,
                         //   atk, atkCooldownS, speedTilesPerSec, tile, state ('idle'|'moving'|'attacking'|
                         //   'channeling'|'fleeing'|'eaten'|'dead'|'exiting'), targetId?,
                         //   channel? {kind:'eat'|'steal', endsAtTick}
  RaidCommands.ts        // typed command log {tick, unitId, order} — the replay/determinism surface
  RaidLoot.ts            // pure loot resolution: kill cash, chest, recipe roll, rare roll, variation roll,
                         //   toxin roll vs rolling-7-day cap
  RaidStats.ts           // thin adapter: StaffStats → RaidUnit (see §4.1). The ONLY place staff data
                         //   becomes combat data. No formulas of its own beyond §4.1's two lines.
  RaidTuning.ts          // every §5 constant as named exports, each registered in the tuning canon;
                         //   canon-drift CI test compares registry ↔ exports
  RaidsSettlers.ts       // OfflineEngine settler registrations (§11.1)
src/scenes/
  WorldMapScene.ts       // map, cafe cards, scout, squad picker overlay, seasonal slot, Gourmand cart
  RaidScene.ts           // renderer/input only: draws the rival room via the shared room renderer,
                         //   mirrors RaidSim at 60 fps (interpolating between ticks), forwards taps
                         //   as RaidCommands, owns pause-on-hidden (§4.7)
src/data/
  rivalCafes.json        // 5 authored cafes + seasonal cafes: room layout (CafeGrid format), enemy
                         //   roster, boss, loot table, raid-only `anchors`
  raidDishes.json        // ALL 34 rare gold dishes (dishes.v2 schema + {rare:true, sourceCafe,
                         //   deferred?:true}); deferred entries listed in tests/deferred-content-allowlist.json
src/sim/raid/__tests__/
  RaidSim.test.ts        // determinism replay, aggro rules, TTK bounds derived from data (§6)
  RaidLoot.test.ts       // Monte-Carlo vs the Progression ledger's raid allocation (§8)
  RaidsSettlers.test.ts  // settlement ordering + clamped-window behavior (§11.1)
```

**Sim/render split & clocks.** `RaidSim.tick()` advances 100 ms of game time. `RaidScene.update()` accumulates real dt from the injected `Clock` (simulation-core's; never `Date.now`) and calls `tick()`. Combat is real-time and unscaled — the activity clock (`ACTIVITY_TIME_SCALE`) does not apply inside raids. Pathfinding goes through the shared `Pathfinder` (`contracts.ts` signatures) over the rival room's walkability grid; the sim stores integer tile paths plus a scalar progress per unit (determinism-safe).

**Test/CI harness (replaces `DEMO_TIME_SCALE`).** Because RaidSim is advanced only by `tick(n)`, tests fast-forward by calling `tick` directly. For Playwright smokes, dev/CI builds expose `window.__ddTest.raid = { step(nTicks), state() }` behind an `import.meta.env.DEV` guard; a CI bundle-grep asserts the hook is absent from production output. No time-scale constant exists anywhere in raid code.

**No stub grid.** The v1 plan to build RaidSim against a shipped stub grid is deleted (the build order sequences the engine first). Unit tests use a ~10-line in-test fake implementing the `contracts.ts` interfaces.

**Typed events** — *added* to the canonical `events.d.ts` (additive only; raids never renames or reshapes another spec's event): `raid-started`, `raid-unit-killed {side, unitId, cash}`, `raid-customer-eaten {cash, energyRestoredPct}`, `raid-dish-stolen {dishId}`, `raid-variation-dropped {dishId, variationId}`, `raid-won {loot}`, `raid-retreated {loot}`, `raid-wiped {loot}`, `raid-paused {reason}`, `zombie-knocked-out {zombieId, reviveAtMs}`, `retaliation-consent-shown`, `retaliation-scheduled`, `retaliation-resolved {won, coinsLost}`. HUD toasts, SFX, and quest hooks subscribe; nothing in the cafe layer imports raid modules (lint-enforced both directions).

---

## 4. Combat model

### 4.1 Unit stats — derived, not defined

**Raiders.** `RaidStats.ts` maps a zombie instance to a combat unit using **only** StaffStats outputs. The Staff spec owns levels (cap **15**), `levelMult(L) = 1 + 0.05·(L−1)`, and `maxEnergy = baseHP × levelMult`. Raids adds exactly two derivations and zero schema:

```
raidMaxHP = maxEnergy(zombie)                         // the energy pool doubles as combat HP —
                                                      // one number, one owner (StaffStats)
ATK       = baseAttack × levelMult(zombie.level)      // same multiplier, same cap (15)
speed     = zombieSpeed(zombie.stats)                 // shared speed module (0.45 + 0.09·Speed,
                                                      // 0.72–1.53 tiles/s) — Speed stat is load-bearing
atkCooldown = RaidTuning.RAIDER_ATK_COOLDOWN (1.5 s)
entryHP   = raidMaxHP × clamp(energy/maxEnergy, 0.5, 1.0)   // tired zombies enter weaker
```

*Deleted from v1:* the `Zombie.energy = round(baseHP × 1.6)` schema addition, the +4%/level growth, and the level-10 cap — all replaced by the StaffStats model above. TTK tables in §6 are re-derived from these stats by CI, not hand-maintained.

**Enemies** (staff, sous, boss, customers) are raid-only actors authored per cafe in `rivalCafes.json` (§6). Staff `atkCooldown = 1.8 s`, boss `2.2 s`; customers never attack. Enemy move speeds are RaidTuning constants (registered in the tuning canon); fleeing customers use the shared `FLEE_SPEED` (2.2 tiles/s `[mirror — speed module]`).

### 4.2 Damage, range, and pathing

```
onAttackReady(attacker, target):
  dmg = attacker.ATK × uniform(0.85, 1.15)     // seeded RNG
  if rng() < 0.05: dmg ×= 1.5                  // crit — floating gold number + heavier hit SFX
  target.hp -= round(dmg)
  attacker.cooldown = atkCooldownS
```

- **Attack range = the 8-neighborhood** of the attacker's tile. **This is range only, not pathing**: all movement uses the shared **4-connected** A\* (the engine has no diagonals and no corner-cut rules — v1's "Chebyshev adjacency matching the corner-cut rules of the shared A\*" clause was wrong and is deleted). A unit ordered to attack paths to the nearest 4-reachable tile whose 8-neighborhood contains the target, then swings. Net effect: units don't shuffle around corners to reach a diagonal, but never move diagonally.
- A unit whose target moves re-paths every 0.5 s. No friendly fire. Dead staff/boss leave a bone-pile decal; eaten/escaped customers despawn through the door.

### 4.3 Command scheme (the original's control feel)

- **Tap a zombie** → selection ring + groan SFX. **Then tap:**
  - an enemy staff/boss → `AttackUnit` (paths adjacent, auto-attacks until target or self dies; then auto-acquires the nearest enemy within 2 tiles, else stands idle — the original's "re-task constantly" feel)
  - a fleeing customer → `EatCustomer` (chase; on catch, a **4 s channel behind a CENSORED bar** with crunch SFX; interrupted by taking a hit — the customer escapes; on completion: +$15–25, **+20% of maxEnergy restored**, bone pile)
  - the counter → `StealCounter` (path to counter's interaction tile, **3 s channel**; on completion the zombie carries the dish icon overhead; the dish is only *secured on victory* — retreat or wipe forfeits it)
  - a floor tile → `MoveTo` (repositioning / aggro-radius play)
- **Re-targeting is free and instant** (order replaces order; path re-plans next tick).
- **Blocked path** → the authentic freeze-in-place with a "?!" emote (shared locomotion failure mode).
- **White truce flag, fixed top-left** (touch-target size per the UI-kit constant `[mirror]`): all raiders switch to `exiting` (path to the entrance door, ignore enemies; enemies keep attacking until they step onto the door tile). One tap, no dialog.

#### 4.3.1 Input-mode arbitration

`WorldMapScene` and `RaidScene` each **push an exclusive mode onto the shared input-mode stack** (input-arbitration spec). No cafe-layer gesture (stove panels, infect cards, edit mode) is reachable while a raid mode is on top. Within RaidScene, pointer priority is: UI chrome (truce flag, portraits) → unit select/order (tap under the drag threshold) → camera pan (drag beyond the shared threshold `[mirror — IsoConfig]`). Esc pops to a Retreat-confirm only if a raid is live; on the world map Esc pops the mode.

### 4.4 Enemy AI

- **Staff:** idle at anchor tiles until a raider comes within **4 tiles** or a raider attacks any staff within **2 tiles** of them (local assist). Then: path to nearest raider, attack. Never flee.
- **Sous** (tiers 2+): as staff, assist radius 4.
- **Boss (head chef):** stands at its kitchen anchor. Aggros only when (a) a raider enters its **3-tile aggro radius**, (b) a raider attacks *it*, or (c) **all staff are dead** (then it charges). This preserves the original's core tactic: *pull and kill staff away from the boss, then gang up.* The aggro radius renders as a faint red floor ring while a raider is selected — with a **check-pattern edge, not color alone** (accessibility), and toggleable off in Settings for purists.
- **Customers** (2–5 per cafe, cosmetic occupations): flee at `FLEE_SPEED` away from the nearest raider toward the door; despawn on reaching it (escaped = uneaten cash). Panic screams. They are the comedy and the snack economy.

### 4.5 Win / lose / retreat

- **WIN:** boss HP ≤ 0. Freeze-frame, "CAFE DEFEATED" stamp, loot screen (§8).
- **WIPE:** all raiders dead. Loot screen shows consolation cash (kills + eats already banked — the original's "rarely a total loss").
- **RETREAT:** truce flag. Keep kill/eat cash; forfeit the carried dish and the win chest.

### 4.6 Injury & energy cost (labor-economy tie-in)

- **In-raid energy drain: 0.25% of maxEnergy per second** for every raider from entry until exit, fighting or not. (Re-expressed as a percentage because energy pools are now StaffStats-scaled; v1's flat 1.5/s assumed the deleted ×1.6 pool.) A 90 s tier-1 raid costs ~22%; a 5-min tier-5 raid costs ~75% of any zombie's pool — the intended "most of the pool" bite at the top tier, independent of rarity. Eating customers is the in-raid refuel (+20% of max, per the original).
  - **Serum Barrel interaction:** if the player owns the *Industrial Barrel of Zombie Serum* (Special-tab Toxin sink, **owned by the Store/Progression ledger** — previously missing from every sink table), in-raid drain is multiplied by the ledger's `serumBarrel.raidDrainMult` (proposed 0.75). Raids only reads the flag.
- **Knockout:** raider HP ≤ 0 → knocked out, not deleted. Revive: **8 h real-time OR 1 Toxin** `[mirror — revive price lives in the Progression Toxin ledger]` (original numbers). While KO'd it cannot work, serve, or raid. Revived zombies return at 25% energy.
- **Post-raid:** survivors keep their reduced energy (rest loop / Toxin refill as normal) — the natural raid-frequency throttle; no artificial daily raid cap.
- **Zombie XP:** **+2 XP per staff/boss kill** (original) credited to the killing zombie. What levels grant is the Staff spec's business (energy +5%/level, Speed at 5/10/15); raids inherits the combat effect automatically via §4.1.

### 4.7 Pause & hidden-tab semantics (previously undefined)

- **Tab hidden mid-raid:** RaidSim pauses within one frame (`raid-paused {reason:'hidden'}`), and a `pendingRaidResult` retreat stub — kills/eats banked so far, dish forfeited — is written to the save immediately. On return within the same session: a Resume / Retreat dialog (resuming discards the stub). If the tab never returns (closed, killed, evicted), the next load settles the stub as a retreat. No raid ever replays elapsed hidden time — combat is live-only by definition.
- **Modals over RaidScene** (none exist by design except the retreat confirm): sim pauses.
- The cafe sim's own hidden-tab and `MAX_LIVE_CATCHUP` rules are the OfflineEngine's; raids adds nothing to them.

---

## 5. Baseline tuning constants (`RaidTuning.ts` — every key registered in the tuning canon)

| Constant | Value | Notes |
|---|---|---|
| `TICK_MS` | 100 | fixed step, `tick(n)` only |
| `RAIDER_ATK_COOLDOWN` | 1.5 s | |
| `STAFF_ATK_COOLDOWN` / `BOSS_ATK_COOLDOWN` | 1.8 s / 2.2 s | |
| Damage variance | ×U(0.85, 1.15) | seeded |
| Crit | 5%, ×1.5 | |
| Raider move speed | `zombieSpeed(stats)` `[consumed — speed module]` | no local formula |
| Enemy staff move / customer flee | 1.2 t/s / `FLEE_SPEED` (2.2) `[mirror]` | staff value is raid-only |
| Boss aggro radius / staff assist / staff sense | 3 / 2 / 4 tiles | |
| Eat channel / steal channel | 4 s / 3 s | |
| Eat reward | $15–25 + 20% maxEnergy | |
| Kill cash | $20 per staff or boss | tuned split of the researched $20-per-customer figure (§16.5) |
| Zombie kill XP | +2 per kill | original |
| `RAID_DRAIN_PCT` | 0.25% maxEnergy/s | §4.6; ×`serumBarrel.raidDrainMult` if owned |
| Entry energy floor | 40% | |
| Knockout revive | 8 h or 1 Toxin `[mirror — ledger]`; return at 25% energy | |
| Rebuild lockout after a win | 4 h; repeat-clear chest ×0.5, Toxin odds ×0.5 | |
| Weekly raid-Toxin hard cap | **8 vials / rolling 7 days** | §8; over-cap → +$100 |
| Variation drop chance | 10 / 12 / 15 / 20 / 25% by tier | §8.1 |

---

## 6. The five launch rival cafes

All rooms use the shared CafeGrid JSON format (`roomSize`, `floorTiles`, `wallSections`, `placements`, `doorTile`, plus raid-only `anchors` for staff/boss/customers/counter). Furniture comes from the existing 602-item `furniture.json`, so rival rooms exercise the same footprint/pathing rules as the home cafe — **layout is the tactical terrain** (chokepoints let you pull staff one at a time). Room sizes stay within the canonical expansion ladder's dimension set `[mirror — expansion.json]`.

**Naming:** every cafe, enemy, and dish name below is an original same-register pun. Verbatim original-game proper names are blocklisted by `licensing.md` and linted in CI (§16.7). Each JSON entry may carry a non-shipped `homageNote` field documenting which original beat it echoes — documentation, never rendered.

**TTK discipline:** the worked numbers below are *illustrative*; the authoritative check is `RaidSim.test.ts`, which derives par-squad DPS from `zombies.json` + StaffStats at the recommended level and asserts clear times inside the target bands. Enemy tables are retuned there if StaffStats tuning moves.

### Tier 1 — **The Greasy Ladle** (unlocks with raids; recommended Lv4)
*Theme:* a failing human greasy spoon. Grimy checkerboard, flickering sign, one sad ceiling fan. The tutorial raid.
- Room 8×8. **Staff:** 3 × Line Cook (HP 40, ATK 4). **Boss:** Head Fry Cook "Sal" (HP 120, ATK 10). **Customers:** 3.
- *Illustrative TTK:* two rarity-0 starters (ATK ≈ 12 avg @1.5 s ≈ 16 dps) drop a Line Cook in ~2.5 s, Sal in ~7.5 s → ~90 s raid. Target band: 60–120 s.
- **Counter-dish pool:** 6 dishes, level band 1–4. **Rare gold (2%):** *Deep-Fried Regret* (L4) and *Toe Jam Tartine* (L5).
- **Chest:** $150. **Boss Toxin:** 8% × 1 vial. **First clear:** +1 vial (one-time, ledger-accounted), +guaranteed recipe.

### Tier 2 — **Igor's Test Kitchen** (beat Tier 1; recommended Lv7)
*Theme:* mad-science bistro. Tesla coils, bubbling vats, exposed-brain lamps; the counter dish glows.
- Room 10×10. **Staff:** 4 × Igor Waiter (HP 70, ATK 7) + 1 × Lab-Assistant Sous (HP 110, ATK 10, assist 4). **Boss:** Dr. Cuisinart (HP 220, ATK 14). **Customers:** 3.
- **Pool:** 7 dishes, band 4–8. **Rares (2.5%):** *Bunsen Burner Bisque* (L7), *Formaldehyde Flambé* (L8).
- **Chest:** $400. **Boss Toxin:** 12% × 1. **First clear:** +2 vials.

### Tier 3 — **The Gilded Gizzard** (beat Tier 2 + cafe Lv9; recommended Lv10)
*Theme:* pretentious goblin fine dining — femur chandeliers, tiny portions, huge attitude.
- Room 11×11 with a chokepoint kitchen corridor. **Staff:** 5 × Goblin Waiter (HP 110, ATK 11) + 1 × Goblin Sommelier Sous (HP 160, ATK 13). **Boss:** Chef Grimtongue (HP 380, ATK 20). **Customers:** 4.
- **Pool:** 8 dishes, band 8–12. **Rares (3%):** *Crimson Wyrm Stir-Fry* (L11), *Goblin Consommé* (L10).
- **Chest:** $900. **Boss Toxin:** 18% × 1. **First clear:** +3 vials.

### Tier 4 — **Vlad's Late-Nite Bites** (beat Tier 3 + cafe Lv13; recommended Lv14)
*Theme:* vampire drive-in diner: coffin booths, garlic-free menu, staff sizzling under the neon "DAYLIGHT" sign.
- Room 12×12. **Staff:** 6 × Thrall Carhop (HP 160, ATK 15) + 1 × Renfield Sous (HP 220, ATK 17). **Boss:** Vlad (HP 560, ATK 26; move 1.5 t/s — he's fast, do not pull sloppily). **Customers:** 4.
- **Pool:** 8 dishes, band 12–16. **Rares (3%):** *Bloodberry Bitecake* (L14), *O-Negative Float* (L15).
- **Chest:** $1,800. **Boss Toxin:** 25% × 1–2 (60/40). **First clear:** +4 vials.

### Tier 5 — **The Chanko Slam** (beat Tier 4 + cafe Lv17; recommended Lv18)
*Theme:* the endgame. A sumo stable turned hotpot house.
- Room 14×14. **Staff:** 6 × Rikishi Server (HP 220, ATK 20) + 2 × Ozeki Sous (HP 300, ATK 24). **Boss:** The Grand Champion (HP 900, ATK 34, cooldown 2.5 s, every 4th attack shoves the target back 2 tiles along a 4-connected line). **Customers:** 5.
- *Illustrative TTK:* a Lv12+ squad of 4 high-rarity fighters (ATK ≈ 30 ea ≈ 80 dps) kills the boss in ~11 s after a ~3-min staff clear → 4–6 min raid.
- **Pool:** 10 dishes, band 16–20. **Rares (4%):** *Chanko Doom-nabe* (L18), *Dearly Departed Beef & Cabbage* (L19).
- **Chest:** $3,200. **Boss Toxin:** 35% × 2. **First clear:** +5 vials.

All tier unlock levels above are `[mirror — unlocks.json]`. Rare-dish stat blocks are generated by the canonical dish generator (one owner) with `rare: true`; the L/price/time values in v1's tables are now generator inputs, not spec-frozen numbers.

**World map presentation:** a single scrollable parchment map; your cafe bottom-left, rivals arranged rightward by tier (the original placed rivals "to the right of your own"). Each cafe is a painted vignette with difficulty skulls (1–5), lock/rebuild state, and a "last raided" stamp.

### 6.7 Seasonal event cafes (restores a researched retention hook)

The original tied specific rares to **themed event cafes** (e.g. a Christmas cafe's exclusive rare) and shipped themed content updates. The plan previously had no event hook anywhere. Raids adds the cheapest faithful version — **no backend, local clock only**:

- The world map has a **6th "event" slot**. `rivalCafes.json` entries may carry `eventWindow: {startMonthDay, endMonthDay}` (local-clock). Inside the window the cafe is raidable; outside it, the slot shows a boarded-up teaser ("Re-opening in December…").
- **Launch calendar:** one authored event cafe per quarter, drawn from the same tier framework (recommended level scales to the player's). First: **Frostbite Bistro** (Dec 1–Jan 6), whose 2 exclusive rares (e.g. *Slay Bells Cider*) come from the deferred-24 pool (§7.6).
- **Clock-cheese guard:** first-clear grants and rare unlocks record real timestamps; rolling the device clock backward cannot re-trigger one-time grants (timestamps are monotonic-checked at load, same rule as the offline clamp). Rare odds are unchanged by the window — events add *content*, not better odds.
- This is the plan's **only** timed content; everything else is permanent (decision logged here; the gaps spec owns the global seasonal statement).

### 6.8 The Wandering Gourmand (single-player substitute for the friend recipe path)

The original had three recipe sources: leveling, raids, and **ordering/sharing via friends**. The social layer is cut (no backend) — previously with no replacement. Substitute, owned here because it lives on the world map:

- A **Gourmand cart** appears on the map for 48 h once per week (seeded from the week number — deterministic, testable). It offers **one random not-yet-unlocked, non-rare dish from any raid pool the player has unlocked**, purchasable **for cash at 3× the dish's price stat**, delivered to the fridge as a normal stolen-dish instance (serve-or-unlock applies, §7).
- This is deliberately a slow third path: it can't outpace raiding (1/week, cash-priced, never rare), but it un-sticks a player hunting one last pool recipe — the same job friend-ordering did.
- The friend-milestone Toxin faucet (1/3/10 friends) is **not** replicated here; its budget is reallocated to Progression's quest/milestone faucet and logged in the ledger (pointer, not a number, per §0).

---

## 7. Recipe steal — fridge, serve-or-unlock (original loot spine)

1. Each raid rolls its **counter dish** at load: 96–98% from the cafe's pool (uniform), else the cafe's rare table (§6 rates; repeat-clears halve rare odds).
2. Winning with a carried dish (or after the steal channel completed) puts the dish **in your fridge** (save array, cap 8 slots; over-cap raids pay +25% chest instead — surfaced on the result screen).
3. From the fridge UI, per dish, the original's choice:
   - **Serve once:** queues it as a ready-to-serve batch (full servings/earnings) with a normal burn window — instant income, no stove time. Batch mechanics are the Service Loop's `[consumed]`.
   - **Permanently unlock:** consumes the dish, adds the recipe to the cookbook forever. **Once-ever per recipe** (`recipeUnlocks: string[]`); later copies are serve-only, exactly like the original.
4. **Level gates hold:** a stolen dish above cafe level sits in the fridge un-servable and un-unlockable ("Requires Cafe Lv N") — you can hold what you can't yet use (original detail).
5. Recipe theft is the primary source of raid-pool dishes and rare golds; the cookbook marks raid recipes with a crossed-cleavers icon and rares in gold.
6. **Magic Fridge interaction:** the *Magic Fridge* (30-vial Special-tab sink, **owned by Store/Progression** — its free-dish-per-day rule was previously unimplemented anywhere) delivers its daily free dish **into this same fridge inventory** as a serve-only copy from the player's unlocked cookbook. Raids owns the fridge UI; the Magic Fridge rule and price live in the ledger.

### 7.6 The 34-rare contract (repairs the Progression CI break)

- `raidDishes.json` ships **all 34** rare golds at raid launch. 10 are obtainable (2 per launch cafe). The remaining **24 carry `deferred: true` plus an assigned future source** (`eventCafe: 'frostbite'`, `futureCafe: 6`, …).
- The catalog **reachability test** treats `deferred` entries as satisfied only if they appear in `tests/deferred-content-allowlist.json`; the allowlist is committed, reviewed, and **must shrink monotonically to zero by 1.0** (CI fails if it grows). Progression's "asserts the counts (34)" test passes against the full file.

---

## 8. Loot mechanics & the Toxin faucet

**Ownership split (resolves the double-spec):** Progression §5.4 is the **single Toxin ledger** — every faucet's weekly *allocation* and every sink's *price* live there and only there. This spec owns the raid drop **mechanics** (odds, caps, anti-farm) whose simulated output must land inside the ledger's raid allocation. The Monte-Carlo CI test lives **here** and reads the allocation from the ledger file. Progression's former concrete raid numbers ("20% / 2 per day") are deleted from that spec per the reconciliation; the ledger line reads "raids: see raids spec §8, allocation X–Y/wk".

**Per-raid income (win, first clear of the day, par level) — illustrative, asserted by Monte-Carlo:**

| Tier | Kills ($20 ea) | Eats (avg) | Chest | Total coins (≈) | Toxin EV |
|---|---|---|---|---|---|
| 1 | 4 → $80 | $40 | $150 | **$270** | 0.08 |
| 2 | 6 → $120 | $40 | $400 | **$560** | 0.12 |
| 3 | 7 → $140 | $60 | $900 | **$1,100** | 0.18 |
| 4 | 8 → $160 | $60 | $1,800 | **$2,020** | 0.35 |
| 5 | 9 → $180 | $80 | $3,200 | **$3,460** | 0.70 |

**Toxin numbers, made internally consistent (v1 asserted EV∈[5,9] under a hard cap of 8 — impossible):**
- **Hard cap: 8 vials per rolling 7 days from raid drops.** Over-cap procs convert to +$100 ("your goons fenced the vials" toast).
- **Modeled engaged player** (daily tier-appropriate raiding, ~10 boss rolls/week): pre-cap **EV ≈ 4–7 vials/week**; the cap is a spike guard, not the mean. `RaidLoot.test.ts` Monte-Carlos 1,000 wins/tier and asserts pre-cap weekly EV ∈ **[4, 7]** and post-cap ≤ 8, and that the result fits the ledger's raid allocation.
- **First-clear grants** (1+2+3+4+5 = 15 one-time vials) are quest-style milestone grants, accounted in the ledger's *milestone* budget, **exempt from the weekly cap**, and naturally spread by tier gating.

**Anti-farm stack:** 4 h rebuild lockout per cafe (max ~6 profitable clears/day even with perfect play); same-day repeat clears pay ×0.5 chest and ×0.5 Toxin odds; energy drain + 8 h knockouts throttle squad availability; **down-raiding decay** — raiding a cafe whose recommended level is ≥4 below cafe level halves Toxin odds and chest (original: drop rates fell against low-level enemies).

### 8.1 Variation drops (closes a fidelity gap)

Research: raiding was the **only** source of dish variations. v1 shipped raids with none until a later milestone — a logged gap now closed: every **win** additionally rolls a **variation ingredient** (10–25% by tier, §5) for a random recipe the player has unlocked. Variation *mechanics* (what an ingredient does, combine rules) are owned by the cookbook/Service-Loop spec `[consumed]`; raids only emits `raid-variation-dropped`. If the variation system's milestone hasn't landed, ingredients accumulate in an inventory the cookbook spec defines — they are never silently discarded.

**Cafe XP per win:** re-derived from Progression's `totalXP` formula (v1's 15/30/60/100/160 accidentally equaled a 12-hour cook at tier 3). New values: **6 / 12 / 22 / 38 / 60 XP** by tier — each ≈ the XP of a 1 h / 2 h / 3 h / 6 h / 12 h cook under `0.62·cookMin^0.69`, keeping raids flavor, not the leveling spine. CI asserts `tierWinXP(t) ≤ totalXP(median dish of the tier's band)`.

---

## 9. Defense: Rival Retaliation — THE decision record

**This section is the single place the defense decision is recorded** (the review found Build Order M9 saying "no defense (fidelity)" while this spec shipped one). **Decision: Rival Retaliation SHIPS, per explicit owner request**, deliberately thin. The Build Order's M9 scope line and the Definition-of-Done checklist are amended in the same reconciliation PR to reference this section (they may not restate its rules). The research is unambiguous that the original had **no** defense — that remains the default *feel* via the consent flow below.

- **First-trigger consent (new):** the first time a retaliation *would* be scheduled (first tier-≥3 win), a one-time dialog: *"Word travels. Rivals may strike back at your cafe. Allow retaliation raids?"* — Allow (default-highlighted) / No thanks. Declining sets the toggle off; either way the dialog never reappears. The toggle lives in **Settings → Gameplay → "Rival retaliation"** (Settings spec owns the surface). Purists get the original's pure-PvE world with one tap, and discover the choice exists.
- **Trigger:** winning a raid on tier ≥3 rolls 25% to schedule a retaliation 24–48 h later (one pending max; timestamp in save).
- **Defender assignment:** a "Defense" tab in the roster panel with **3 defender slots** (any non-KO zombie, including Meat Locker residents — defense is the bench's job). Unfilled slots default to the strongest idle zombies. (Empty state: §2.1.)
- **Resolution:**
  - **Offline/away (the common case):** resolved by the OfflineEngine settler (§11.1) at settlement time: `defPower = Σ defenders (raidMaxHP×0.3 + ATK×2) × (0.75 + 0.5×energy%)` — stats from RaidStats, §4.1 — vs a fixed attacker power per tier (T3: 220, T4: 340, T5: 520), each side ×U(0.9, 1.1) with the save's seeded RNG. Defenders lose 15% energy, never HP/KO.
  - **Online when it fires:** a live RaidScene **in your own cafe room** with sides swapped — pure code reuse, a delightful rarity — with an instant auto-resolve button. If the tab hides mid-defense, §4.7's pause/stub rules apply with the stub resolving via the power formula.
- **Stakes (hard caps, code constants):** a loss costs **10% of uncollected stove earnings, max $500** — never furniture, recipes, Toxin, zombies, **or rating**. A win pays $100×tier and +1 zombie XP per defender. Either way, a report card ("The Gizzard's goons came by. Gary ate two of them.") shows in the next welcome-back report (report surface owned by the OfflineEngine/Progression report spec).

---

## 10. Economy guardrails

- **Coins:** par tier-3 play ≈ $1,100 per ~3-min raid, bounded by lockouts/energy to ~$4–6k/day. Against the canonical dish economy's mid-band earnings `[consumed — dish generator]`, raids sit at **~10–15% of coin income** — flavor, not faucet. A balance test computes both sides from the shipped data files (not prose numbers) and asserts the ratio.
- **Toxin:** §8 cap inside the ledger's global 15–25/week envelope; the sink side (revives, refills, premium infects, Serum Barrel, Magic Fridge, special-stove Toxin upgrades — all ledger-owned) comfortably exceeds it.
- **Recipes:** the genuinely valuable loot, self-limiting — finite pools, once-ever unlocks, level gates (original rule).
- **XP:** ≤ one modest cook per raid (§8); cooking remains the leveling spine.
- **No pity-spiral:** wipes still pay kill/eat cash and cost only energy + revive timers — "rarely a total loss" (original), retry-friendly. (The economy-wide 0-cash soft-lock fix is the Service Loop's pity mechanism `[consumed]`; raids' consolation cash is an additional income path that the no-dead-end invariant test may count.)
- **Telemetry note:** the game ships **zero analytics** (gaps-spec decision `[consumed]`); raid balance is tuned from the Monte-Carlo/balance sims in CI plus the opt-in "copy my anonymized stats" feedback path — this spec's tests are the tuning data source, which is why they read data files rather than pinning prose numbers.

## 11. Save schema additions (version assigned by the save ledger)

Raid fields land **at the raid milestone's version per `docs/spec/save-ledger.md`** — this spec assigns no integer (v1's "v3" claim deleted; the ledger also owns the brains→toxin mapping, which raids has no opinion on). Migration fixture filename comes from the ledger.

```ts
raids: {
  fridge: { dishId: string; stolenAtMs: number; serveOnly?: boolean }[];  // cap 8; serveOnly for Gourmand/MagicFridge copies
  recipeUnlocks: string[];                       // once-ever permanent unlock ids
  knockouts: { zombieId: string; reviveAtMs: number }[];
  clears: Record<CafeId, { firstClearDone: boolean; lastWinMs: number; winsToday: number; dayKey: string }>;
  toxinDrops: number[];                          // ms timestamps, pruned to rolling 7 days
  variationBank: string[];                       // held variation ingredients (cookbook spec consumes)
  retaliation?: { fromCafe: CafeId; firesAtMs: number };
  retaliationConsentShown: boolean;
  retaliationEnabled: boolean;                   // default true, set by consent dialog / settings
  defenders: string[];                           // up to 3 zombieIds
  lastSquad: string[];
  pendingRaidResult?: { kind: 'retreat'; cash: number; eats: number };   // §4.7 stub
  gourmandWeekKey?: string;                      // last week the cart offer was generated/purchased
}
```

### 11.1 Offline settlement — registered settlers, not a private code path

v1 ran its own on-load resolution; the review's OfflineEngine finding applies. Raids registers three settlers with the **unified OfflineEngine**, which owns the single clamped elapsed window and the global execution order:

1. `expireRevives` — pure function of `reviveAtMs` vs settlement clock.
2. `resolveRetaliation` — **declares a dependency on (1)**: zombies whose revive expired during the away window count as available defenders. Uses the power formula (§9) with the save RNG.
3. `tickRebuildLockouts` / `pruneToxinDrops` / `refreshGourmand` — pure timestamp maintenance, order-independent.

`RaidsSettlers.test.ts` proves (a) revive-before-retaliation ordering inside one settlement, (b) all three read the same clamped window, (c) a `pendingRaidResult` stub settles exactly once. Raids does not define the global clamp, the ≥60 s hidden threshold, or where its settlers sit relative to the service/staff settlers — the OfflineEngine spec sequences all subsystems; raids only declares its internal ordering constraint.

## 12. Art & audio assets needed

- **World map:** parchment backdrop; 5 cafe vignettes (~300×220) + locked/rebuilding/boarded-event variants; skull icons; truce-flag icon; Gourmand cart.
- **Enemies:** 5 staff + 5 bosses + 3 sous variants on the shared **paper-doll rig** (per the Presentation spec's character-production decision — rig parts, 2 facings + flipX, not frame sheets); 5 panicking-customer reuses of home rigs with a flee cycle. Every manifest id must exist in `rivalCafes.json` (CI check, mirroring the chars-atlas↔zombies.json rule).
- **FX:** CENSORED bar (animated static + crunch), bone-pile decal, hit spark, crit gold number, KO dizzy-stars, aggro floor ring (check-edged, §4.4), selection ring.
- **UI:** squad picker cards, raid HUD (portraits w/ HP+energy bars, truce flag, boss HP bar), result screen stamps, fridge serve-or-unlock modal, consent dialog, empty states (§2.1).
- **SFX:** groan-select, order grunt, hit ×3, crit, crunch-eat, panic screams, boss stings ×5, victory sting, sad-trombone wipe, retreat whistle; 1 raid music loop. All logged in `public/art/CREDITS.md` per licensing.md.
- **Reduced motion** `[consumed — settings spec]`: hit-stop, screen shake, and the wipe vignette are disabled by the shared flag.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Iso engine slips → raids blocked | Hard dependency; RaidSim + tuning tests run against a 10-line in-test fake of `contracts.ts` (no shipped stub) |
| Combat feels mushy (shamble + long TTK) | TTK bands are data-derived CI tests; hit-stop (60 ms), crit pops, and channels give per-second feedback; the modernization stack (free Scout etc.) is playtested **as a bundle** with the staff-spec conveniences at the raid milestone, per the superfan's "plays itself" warning |
| Toxin faucet inflation | Weekly hard cap + Monte-Carlo CI vs the ledger + down-raid decay |
| Defense scope creep | §9 is the recorded decision; stakes are code constants; no defensive building/placement UI exists by design; consent + toggle |
| StaffStats retune moves TTK | Enemy tables live in data; the TTK test derives squad DPS from StaffStats, so a retune fails CI loudly instead of silently breaking feel |
| Determinism drift | Fixed tick, integer tile paths + scalar progress, seeded RNG, replay test in CI, no wall-clock reads (lint) |
| Browser matrix | Raid boot + tier-1 scripted win included in the Playwright **WebKit** project from the milestone's first playable; device fps is a manual per-milestone checklist item, not a CI assertion |

## 14. Build order (within the raid milestone)

1. `RaidStats` adapter + `RaidSim` + `RaidTuning` + tests (determinism, aggro, data-derived TTK) — no rendering.
2. `rivalCafes.json` tiers 1–2 + `RaidLoot` (incl. variation roll) + Monte-Carlo vs ledger.
3. `RaidScene` renderer + command input + input-mode push + pause-on-hidden; tier-1 playable end-to-end (WebKit smoke added).
4. WorldMap + squad picker + result screens + empty states; save fields at the ledger-assigned version + fixture; `RaidsSettlers` registered.
5. Fridge serve-or-unlock; tiers 3–5; all 34 rares in data + deferred allowlist; Toxin cap wiring; Gourmand cart.
6. Retaliation (consent dialog, offline formula, live mode); seasonal event slot + Frostbite Bistro content; polish/SFX; balance suite green.

A **5-step raid tutorial beat** (select → order → pull → truce-flag awareness → steal) ships with step 3 above, per the reconciliation's "onboarding ships with its system" rule — not deferred to the final polish milestone.

---

## 16. Review notes — critiques applied with modification, or rejected

1. **Defense contradiction (blocker).** Applied: §9 is now the explicit single decision record (retaliation ships, owner-requested; Build Order M9 + DoD amended by pointer). Added beyond the asked fix: the first-trigger consent dialog, so the opt-out isn't buried in settings.
2. **Toxin ownership — the two critics disagreed with each other.** The engineer's fix says "raid spec owns raid drop mechanics; progression's §5.3 becomes a budget allocation"; the completeness critic's fix says "progression §5.4 becomes the single Toxin ledger; raids deletes its tables." Both adopted, split by kind: the **ledger** (allocations + sink prices) is Progression's; the **mechanics** (odds, caps, anti-farm) and the Monte-Carlo test are raids', asserting against the ledger file. Neither critic's fix is followed verbatim because they conflict as written.
3. **Self-found inconsistency neither critic flagged:** v1 asserted weekly Toxin EV ∈ [5,9] under a hard cap of 8 — unsatisfiable. Fixed: pre-cap EV band [4,7], cap 8 as spike guard (§8).
4. **Rating scale (blocker).** The engineer recommended canonizing the 0–1000 scale; the other two critics recommended Progression's 0–100 S+D+B. Raids follows the reconciliation outcome (0–100) but notes it is nearly rating-agnostic: the only rating reference here is negative (retaliation may never touch it), so no raid table regenerates either way.
5. **Kill-cash transposition (minor).** Acknowledged: research grants $20 per rival **customer** defeated; we pay $20 per staff/boss kill + $15–25 per eat. Kept as a **logged tuned deviation** (§1.1) rather than "corrected," because paying only for customer kills would make the mandatory staff fight pure cost and reward ignoring the combat — worse fidelity to the *feel* ("rarely a total loss") than to the citation. The fidelity table now cites it correctly.
6. **Chebyshev melee (major).** The critique is right that "matching the corner-cut rules of the shared A*" referenced rules that don't exist (the engine is 4-connected, no corner-cut concept). Partially adopted: pathing is pure 4-connected; the 8-neighborhood is retained **as attack range only** (explicitly not pathing), the alternative the critique itself offered — pure 4-neighbor range makes surrounded targets feel artificially unhittable at these unit densities.
7. **Licensing renames vs the fidelity purist.** The purist critique (aimed at the dish canon) demands the original 2011 names verbatim; the licensing critique demands renaming all verbatim Capcom proper names. These are irreconcilable as written. This spec's position: **mechanics, numbers, and structure are the fidelity payload and are kept exactly; proper names are the legally exposed surface and are renamed** to same-register puns (§6), with non-shipped `homageNote` annotations and a CI blocklist lint. The final project-wide call belongs to `docs/spec/licensing.md` at M0; if the owner accepts the risk and reverts to canonical names, it is a data-only change. The purist critique's name demand is therefore *deferred to the owner via licensing.md*, not silently ignored.
8. **"Modernization stack plays itself" (minor).** Accepted for the raid-relevant item (free Scout): kept, but §13 commits to playtesting the convenience stack as a bundle at the raid milestone. Scout specifically replaces blind-raid friction the research flags as dated, and removing it punishes new players most; it stays pending that playtest.
9. **Rival count 5 vs Build Order's 4 (minor).** Kept at 5 (logged deviation from the research's ~4, plus the event slot which actually restores the researched event-cafe pattern); Build Order M9 is amended by the reconciliation PR to cite this section rather than restating a count.
10. **Zombie level/stat model (major, two critiques).** Fully adopted: cap 15, StaffStats-derived HP/ATK/energy, ×1.6 schema addition deleted, TTK re-derived in CI (§4.1). The in-raid drain was necessarily re-expressed as %-of-pool (§4.6) — a flat rate is meaningless across the corrected pool model; this goes slightly beyond the asked fix.
11. **Raids unlock L4 vs Progression L5 (minor).** Adopted structurally: `unlocks.json` is the single authority and every level here is a `[mirror]`. This spec *requests* L4 (raids are the mid-game hook; L5 delays the first squad-slot beat) — the reconciliation PR makes the call in one file.

## Acceptance criteria

- [ ] Determinism: replaying a recorded RaidCommands log against the same seed reproduces an identical end-state hash (units, HP, loot rolls, tick count) in CI, on two runs and across Node versions used by CI.
- [ ] No local restatement of canon: src/sim/raid/ contains no walk-speed formula, no zombie level/stat formula, no save-version integer, and no tuning literal not exported from RaidTuning.ts; RaidTuning keys are registered in the tuning canon and a CI check fails on unregistered keys.
- [ ] Stat derivation: RaidSim unit stats for player zombies are produced exclusively by StaffStats.ts (raidHP = maxEnergy(zombie), ATK = baseAttack × levelMult(level), level cap 15); a golden test pins 3 zombies × 3 levels.
- [ ] Pathing/range: all raid pathfinding uses the shared 4-connected Pathfinder via src/engine/contracts.ts signatures; a unit attacks any target in its 8-neighborhood but never paths diagonally (unit test with a diagonal-only gap).
- [ ] TTK bounds: CI derives squad DPS from zombies.json + StaffStats and asserts each tier's par-squad boss-kill and full-clear times fall inside the §6 target bands; the test reads rivalCafes.json, not hardcoded stats.
- [ ] Loot/Toxin: Monte-Carlo (1,000 wins/tier) asserts pre-cap weekly Toxin EV ∈ [4, 7] for the modeled engaged player and that the rolling-7-day cap of 8 is never exceeded post-cap; over-cap procs convert to +$100; first-clear grants are exempt and one-time.
- [ ] Rare-dish contract: raidDishes.json contains exactly 34 rare entries; 10 are obtainable at launch; the other 24 appear on tests/deferred-content-allowlist.json with an assigned future source; the reachability CI passes with the allowlist and fails if the allowlist grows.
- [ ] Variations: the win loot table rolls a variation ingredient (tier-scaled 10–25%) from launch; a test asserts at least one variation source exists at the raid milestone.
- [ ] Fridge rules: serve-once vs permanently-unlock behave per §7; recipeUnlocks is once-ever (attempting a second unlock is impossible in UI and a no-op in sim); over-cap fridge pays +25% chest; level-gated dishes are held but unusable, with the gate string shown.
- [ ] Offline settlers: RaidsSettlers registers (1) revive expiry, (2) retaliation resolution, (3) rebuild lockouts with OfflineEngine; an integration test proves revive expiry runs before retaliation resolution within one settlement and that all use the single clamped elapsed window.
- [ ] Pause semantics: hiding the tab mid-raid pauses RaidSim within one frame and writes a pendingRaidResult retreat stub; returning shows Resume/Retreat; a Playwright test drives this via the injected clock hooks (window.__ddTest, absent from production builds — asserted by a bundle grep in CI).
- [ ] Retaliation: stakes are clamped in code (loss ≤ min(10% uncollected stove earnings, $500); never furniture/recipes/Toxin/zombies/rating); the first-trigger consent dialog appears exactly once; the settings toggle disables scheduling; Build Order M9 and the DoD contain the retaliation line (doc check).
- [ ] Licensing: a CI lint fails if rivalCafes.json, raidDishes.json, or raid UI strings contain any entry from the licensing.md blocklist of verbatim original-game proper names.
- [ ] Events: raid events exist only as additions to the canonical events.d.ts (type-check fails on redefinition); HUD/quests subscribe without importing raid modules (lint boundary on src/sim/raid/ enforces no Phaser import and no reverse imports).
- [ ] Empty states: pre-unlock Raid button, empty fridge, empty defense tab, and never-scouted cafe cards render the specced zero-data content (snapshot tests).
- [ ] Save: raid fields land at the milestone version assigned by docs/spec/save-ledger.md, with a migration fixture named by the ledger; loading a pre-raid save yields the specced defaults.
- [ ] Seasonal cafe: with a mocked local clock inside an event window, the 6th map slot activates with its cafe and seasonal rares; outside the window it shows the teaser state; save timestamps prevent re-farming first-clear grants by clock rollback.
- [ ] Performance: RaidSim.tick() for the tier-5 room stays under a relative CI budget (< K× calibration loop in-process) with a generous absolute ceiling; 60fps device claims live on the manual per-milestone device checklist, not CI.
