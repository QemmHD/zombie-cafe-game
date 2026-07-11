# INFECTION + STAFF

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# Deadbeat Diner — System Spec: INFECTION + STAFF (rev. 2, post-review)

**System:** Infection (tap-to-convert customers), occupation-derived zombie stats, energy/feral loop, roster management, zombie leveling, Meat Locker.
**Status:** Implementation-ready design, reconciled against the cross-spec canon.
**Fidelity source:** `original_game_research.json` (dims 0, 1, 3, 4). Every rule cites its research anchor; every deliberate deviation is logged in §14. All F-numbered citations were re-audited after review; one over-claim (seated-only infection) was found and reclassified (§14, Review notes).

---

## 0. Canon compliance — what this spec OWNS vs CONSUMES

The review's root disease was constants restated across specs. This spec now draws a hard line. Every number below exists exactly once, as a key in the shared tuning canon (`src/sim/tuning.ts`); tables in this document are **generated goldens** of those keys, committed as test fixtures.

### 0.1 This spec is the single authority for

| Domain | Rule |
|---|---|
| Zombie stat derivation (En/Sp/Pw/Tp/Fo) | §3, `src/sim/staff/StaffStats.ts` — the ONLY derivation module. The service loop's §4.3 interim tips/speed mapping is a pre-landing shim and is **deleted** the milestone this system ships (its spec must say so). |
| Zombie level model | Cap **15**, `+5%` base energy per level, `+1 Speed` at 5/10/15 (§8). The raid spec **deletes** its own cap-10 / +4%-per-level / `energy = baseHP × 1.6` schema and derives `raidHP = maxEnergy(level)` and ATK from `Power` via one formula it defines against these numbers. |
| Working-slot ladder | `slots(L) = min(14, ceil(0.7 × L))` — 1 at L1, 14 hard max (§9.1). Progression's 12-slot table and Build Order M6's "2 at L1" ladder are deleted in favor of this (research: "1 → ~12 → 14 hard max"). |
| Zombie walk speed | `zombieTilesPerSec(Speed) = 0.45 + 0.09 × Speed` (§3). Exported from `src/sim/movement/Speeds.ts` together with the once-defined customer constants (§0.3). Iso, service, and raid specs delete their formulas and recompute derived tables (service §8.5 round-trips, raid TTK) from this module. |
| Tips stat + tip-rate term | `Tips` from §3; `tipRate(Tips) = 0.06 × Tips`. Composition is fixed in §0.3. |
| The activity clock | §6.1 — definition and subscriber list. Build Order M4's global `FOREGROUND_TIME_SCALE` is deleted; its AC is rewritten to apply only to activity-clock subscribers. |
| Meat Locker | 5 hooks default, +5 per 5 Toxin, 100 max (§9.2). |
| Occupation spawn-pool gating & tier weights | §5, restated on the canonical 0–100 rating scale. |
| Serum Barrel (endurance modifier) | §9.4 — researched Special-tab item, now implemented here as an energy-economy upgrade. |

### 0.2 This spec consumes by reference (never restates)

| Domain | Owner | What we consume |
|---|---|---|
| Star rating | **Progression** — `R = clamp(S + D + B, 0, 100)`, shown as R/20 stars. The 0–50 scale this spec previously used is **deleted**; §4/§5 gates are regenerated onto 0–100. | `rating.addDelta(key, reason)` with keyed magnitudes: `RATING.feralLive` (canonical −6) and `RATING.feralOfflineIncident` (−2), both defined once in the rating canon. Offline rating decay is progression's alone — this spec applies none. |
| Cafe level & XP | **Progression** — cap 22, its 21-row `unlocks.json` curve. All `unlockLv` gates in §4 are validated against cap 22. | `cafe-level-up` events; `unlocks.json` for Locker availability and any level-gated UI. |
| Time & offline sequencing | **simulation-core** (`docs/spec/simulation-core.md`) — one clamped elapsed window (7 days), one OfflineEngine with a defined settler order, hidden-tab thresholds, `MAX_LIVE_CATCHUP`, pause semantics. | §6.1/§7.4 plug into it; this spec's settler exports an availability timeline (§7.4) that the service settler consumes — resolving the review's order-dependence hazard. |
| Cook timers & burn deadlines | **Service loop** — always wall-clock real time, absolute timestamps, never on the activity clock. | Stove staffing hooks (§6.2 note, §7.4). |
| Payment formula | **Service loop `DishMath`** — one composition: `payment = perServing × (1 + tipRate(Tips)) × ratingMult(R)` (multiplicative; `ratingMult` is progression's `1 + R/200`). Golden test: 3 zombies × 3 ratings. | We supply `tipRate`; we never compute payments. |
| Save versions | **Build-order save ledger** (`docs/spec/save-format.md`). This spec names **fields only** (§12); the integer version is assigned by the ledger at this system's milestone. All concrete version numbers are removed from this document. |
| Typed events | **Canonical events registry** (`src/core/events.d.ts`, build-order appendix). This spec **adds** events (§12) and never renames others'. Delivery XP hooks key off the registry's canonical delivery event name (whatever the reconciled interaction model names it), not a local alias. |
| Zombiepedia state model | **Progression** — 4-state Undiscovered / Sighted / Infected / Mastered (its model is richer and matches the JP "Zombie Collection" note). This spec's panel **renders** that state and fires `Sighted` on spawn; §11.3 no longer defines a rival state machine, and the old `zombiedex`/`seenOccupations` save fields are replaced by progression's collection store. |
| Toxin ledger | **Progression §5.4** — the single table of all faucets and sinks. This spec's sinks (1v refill, 5v hooks, 50v Serum Barrel, future chef heads) are registered there; weekly-budget assertions live only there. |
| Spawn intervals, starting resources, starter layout | **Tuning canon** — this spec references keys only. |
| Input modes | **Input-arbitration spec** (`docs/spec/input-modes.md`) — §10.4 registers this spec's interactions in the shared mode stack. |
| Settings | **Settings spec** — hosts this spec's toggles (§14 note): classic-daydream mode, reduced-motion (disables feral vignette/shake), audio-cues-as-toasts. |
| Strings / i18n | All player-facing strings in this spec live in `src/ui/strings.ts` (English-only v1, centralized for later localization). No inline literals. |

### 0.3 Speeds module (single source, exported for everyone)

`src/sim/movement/Speeds.ts`:

```ts
export const zombieTilesPerSec = (speedStat: number) => 0.45 + 0.09 * speedStat; // 0.72–1.53 t/s
export const FERAL_SEEK_MULT = 1.25;   // feral shamble, relative to the zombie's own speed
export const CUSTOMER_WALK = 2.0;      // t/s — humans stride, zombies shuffle (deliberate contrast)
export const CUSTOMER_FLEE = 2.6;      // angry-leave and feral-panic flee
```

Iso engine, service loop, and raids import these; their local formulas (`0.44×baseSpeed`, `baseSpeed×0.6`, `baseSpeed×0.56`, fixed 1.1 customers) are deleted.

---

## 1. Design goals

1. **Restore the game's identity.** Infection is a *deliberate purchase* (tap customer → Infect → pay Free/Cash/Toxin by occupation), never a reward. The current passive roll that *pays* +1 brain (`src/game/Customer.ts:63,79`) is deleted, not adapted.
2. **Make staff a managed liability.** Energy drains while working; a starved zombie goes feral, eats a patron, and craters the rating (research dim 1: "Neglected zombies are a hazard, not just idle").
3. **Make all 105 zombies reachable** through the level-gated, rating-gated, cost-tiered occupation spawn table.
4. **Owner pillars honored:** Toxin earned-only; no IAP ladder; usability modernizations layered on faithful rules; **pillar 2 explicitly protected** — the energy system is now proven (with an acceptance test) to never kill an overnight cook (§6.5).
5. **Dependency honesty, minus throwaway scaffolding:** the build order lands the iso grid/A* (M1–M2) before this system; per review, the previously planned straight-line-locomotion fallback adapter is **deleted**. The sim unit-tests against a ~10-line in-test fake of `IPathfinder`; no shipped stub file.

---

## 2. Fidelity contract (rule ↔ research) — re-audited

| # | Rule in this spec | Research anchor |
|---|---|---|
| F1 | Infection = tap a customer → "Infect" confirm → instant conversion. No food-spiking step. | dim 1: "just tap them and then tap infected"; "a direct tap-and-pay action, NOT 'serve a toxic dish'". **Audit note:** research contains no seated-only qualifier; our seated-or-queued restriction is a design choice logged in §14, not fidelity. |
| F2 | Cost tiers: Free (commoners) / Cash (skilled) / Toxin vials (premium & supernatural). | dim 1 concreteNumbers: Free list, Cash $100–$2,000, Toxin 1–50 vials |
| F3 | Occupation determines the zombie and its stats: Energy, Speed, Power, Tips, Focus, unlock Level. | dim 1 |
| F4 | Rarer occupations only walk in as cafe level and star rating rise. | dim 1 |
| F5 | Infecting removes a paying diner — their unpaid bill is forfeited. | dim 1 |
| F6 | Energy drains while working; zero energy → feral attack → ALL customers flee unpaid → rating drops. | dim 0; dim 1 |
| F7 | Rest to recover (slow), 1 Toxin instant refill. | dim 1 |
| F8 | Active (foreground) play drains and regenerates energy ~10–15× faster than leaving the app closed; the same acceleration applies to serving throughput. | dim 4 "Foreground time-acceleration (~10–15x)"; "cook overnight; zombies won't consume as much energy". We use 12× (§6.1). |
| F9 | Feral feeding shown behind a comic CENSORED bar + crunch SFX + bones. | dim 2/3 lookAndFeel |
| F10 | Chef avatar: Tips 3 / Speed 5 / Attack 4 / Energy 90; energy never depletes outside raids. | dim 0 |
| F11 | Working-slot cap (1 at start → ~12 → 14 hard max); Meat Locker benches the rest. | dim 3 |
| F12 | Meat Locker: 5 hooks default; +5 hooks per 5 Toxin; 100-hook max. | dim 3 concreteNumbers |
| F13 | Zombie leveling: XP from serving & fighting, +5% energy per level. | dim 3; raids "+2 XP per rival customer" |
| F14 | Focus stat = daydream rate; Focus 1 ≈ daydreams every 1–2 min (real foreground time); daydreamers stop working and, in the original, required manual re-tasking. | dim 1; dim 4 |
| F15 | Roles: high-Tips types serve, high-Power types raid, many deliberately Neutral. | dim 1 |
| F16 | Eating a victim restores ≈20% of the zombie's max energy. | dim 3 |
| F17 | Currencies are Cash + Toxin. "Brains" is banned vocabulary. | dim 1/4 |
| F18 | Industrial Barrel of Zombie Serum: Special-tab item, 50 vials, boosts zombie endurance. | dim 4 Special-tab concreteNumbers (previously unimplemented — now §9.4) |

---

## 3. Stat model & derivation (all 105 zombies)

Unchanged from rev. 1 in substance; restated with the canon consumers fixed. The ported catalog (`src/data/zombies.json`) carries `baseHP`, `baseAttack`, `baseSpeed` (constant 2.5 — dead), `cookSpeedMult` (0.7–1.3), `infectionChance` (0.21–0.38 — its passive-roll use is deleted). Derivation is deterministic from these fields; all formulas live in `src/sim/staff/StaffStats.ts`.

```
statSum       = baseHP + 4 × baseAttack                              // ranking key within a rarity
Energy (base) = baseHP                                                // 70–320
Power  (1–12) = clamp(round(baseAttack × 12 / 45), 1, 12)
Tips   (1–12) = clamp(round((infectionChance − 0.18) × 55), 1, 12)
Speed  (2–12) = clamp(round(3 + (1.3 − cookSpeedMult) × 6 + rarity × 0.8), 2, 12)
Focus  (1–12) = clamp(1 + rarity × 2 + floor(Tips/6) + floor(Power/6), 1, 12)
CookSpeed     = cookSpeedMult (consumed by the stove system)
```

**Why this works:** charismatic catalog types (Chef 0.38, Cheerleader 0.38) have high `infectionChance`, bruisers (Sumo 0.21) low — repurposing it as **Tips** reproduces the original's server-vs-fighter split (CEO Tips 10 vs Yokozuna Tips 1).

**Role classification** (UI badge only; systems always consume raw stats):

```
Server  if Tips ≥ 7 AND Tips ≥ Power + 2
Fighter if Power ≥ 5 AND Tips ≤ 4
Neutral otherwise
```

Result: 47 Servers / 33 Neutral / 25 Fighters — mirroring "many are deliberately Neutral".

**Stat consumers (cross-spec contracts):**
- `Tips` → `tipRate(Tips) = 0.06 × Tips`, consumed inside the service loop's single `DishMath` payment composition (§0.2). No other tips formula may exist.
- `Speed` → `zombieTilesPerSec` (§0.3), consumed by iso actor layer, service round-trip math, and raids.
- `Power` → raid damage (raid spec's formula, computed from this stat and this spec's level model).
- `Focus` → daydream interval (§6.3).
- `Energy` → §6; max scales with level (§8); raid HP derives from it (§0.1).

---

## 4. The Occupation Table (all 105 zombies)

Columns: infect **Cost**, cafe-**Lv** unlock gate, min-rating gate (**R**, canonical 0–100 scale — regenerated from the old 0–50 column, see §4.6), derived stats, Role. Ranked within rarity by `statSum` ascending; the tables are the exact output of §4.6's closed forms — committed as the golden test fixture.

### 4.1 Tier FREE — rarity 0 "commoners" (30) — fidelity: original Free tier structure

| zombieId | Customer archetype | Cost | Lv | R≥ | En | Sp | Pw | Tp | Fo | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| nurse | Nurse | Free | 1 | 0 | 70 | 4 | 2 | 9 | 2 | Server |
| burnt | BBQ Enthusiast | Free | 1 | 0 | 75 | 4 | 2 | 6 | 2 | Neutral |
| prom | Prom Date | Free | 1 | 0 | 72 | 4 | 2 | 10 | 2 | Server |
| teacher | Teacher | Free | 1 | 0 | 75 | 4 | 2 | 9 | 2 | Server |
| hippie | Hippie | Free | 1 | 0 | 76 | 4 | 2 | 9 | 2 | Server |
| painter | House Painter | Free | 1 | 0 | 78 | 4 | 2 | 9 | 2 | Server |
| chef | Line Cook | Free | 2 | 0 | 80 | 3 | 2 | 11 | 2 | Server |
| jogger | Jogger | Free | 2 | 0 | 78 | 4 | 3 | 8 | 2 | Server |
| dentist | Dentist | Free | 2 | 0 | 80 | 4 | 3 | 9 | 2 | Server |
| gamer | Pro Gamer | Free | 2 | 0 | 80 | 4 | 3 | 7 | 2 | Server |
| mailman | Mail Carrier | Free | 2 | 0 | 80 | 4 | 3 | 7 | 2 | Server |
| rotten | Drifter | Free | 2 | 0 | 80 | 5 | 3 | 7 | 2 | Server |
| suit | Businessman | Free | 3 | 0 | 80 | 4 | 3 | 7 | 2 | Server |
| surfer | Surfer | Free | 3 | 0 | 82 | 4 | 3 | 7 | 2 | Server |
| office | Office Worker | Free | 3 | 0 | 85 | 4 | 3 | 7 | 2 | Server |
| sailor | Sailor | Free | 3 | 0 | 85 | 4 | 3 | 7 | 2 | Server |
| clown | Party Clown | Free | 3 | 0 | 85 | 5 | 3 | 8 | 2 | Server |
| farmer | Farmer | Free | 3 | 0 | 90 | 5 | 3 | 6 | 2 | Neutral |
| sewer | Sewer Worker | Free | 4 | 0 | 90 | 5 | 3 | 8 | 2 | Server |
| punk | Punk Rocker | Free | 4 | 0 | 88 | 5 | 3 | 6 | 2 | Neutral |
| mummy | Mummy | Free | 4 | 0 | 90 | 5 | 3 | 6 | 2 | Neutral |
| pirate | Pirate | Free | 4 | 0 | 90 | 5 | 3 | 6 | 2 | Neutral |
| mechanic | Mechanic | Free | 4 | 0 | 95 | 5 | 3 | 4 | 1 | Neutral |
| cop | Beat Cop | Free | 4 | 0 | 95 | 5 | 3 | 5 | 1 | Neutral |
| fireman | Firefighter | Free | 5 | 0 | 100 | 5 | 3 | 4 | 1 | Neutral |
| biker | Biker | Free | 5 | 0 | 100 | 5 | 4 | 4 | 1 | Neutral |
| construction | Construction Worker | Free | 5 | 0 | 105 | 5 | 3 | 3 | 1 | Neutral |
| soldier | Soldier | Free | 5 | 0 | 105 | 5 | 4 | 3 | 1 | Neutral |
| lumberjack | Lumberjack | Free | 5 | 0 | 108 | 5 | 4 | 3 | 1 | Neutral |
| caveman | Caveman | Free | 5 | 0 | 110 | 5 | 4 | 2 | 1 | Neutral |

### 4.2 Tier CASH — rarity 1 "skilled & costumed" (30) — fidelity: original Cash tier arc

| zombieId | Customer archetype | Cost | Lv | R≥ | En | Sp | Pw | Tp | Fo | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| cheerleader | Cheerleader | $200 | 4 | 10 | 82 | 4 | 3 | 11 | 4 | Server |
| ghost | Ghost | $250 | 4 | 10 | 80 | 4 | 3 | 11 | 4 | Server |
| geisha | Geisha | $325 | 4 | 10 | 85 | 4 | 3 | 10 | 4 | Server |
| magician | Stage Magician | $375 | 4 | 10 | 88 | 4 | 3 | 10 | 4 | Server |
| witch | Witch | $450 | 5 | 10 | 85 | 4 | 3 | 10 | 4 | Server |
| diver | Deep-Sea Diver | $500 | 5 | 10 | 90 | 4 | 3 | 9 | 4 | Server |
| jester | Court Jester | $575 | 5 | 12 | 90 | 4 | 3 | 8 | 4 | Server |
| zombie_bride | Runaway Bride | $625 | 5 | 12 | 90 | 4 | 3 | 9 | 4 | Server |
| archer | Olympic Archer | $700 | 6 | 12 | 88 | 5 | 4 | 8 | 4 | Server |
| rockstar | Rock Star | $750 | 6 | 12 | 92 | 4 | 3 | 9 | 4 | Server |
| skeleton | Skeleton | $825 | 6 | 12 | 88 | 5 | 4 | 8 | 4 | Server |
| astronaut | Astronaut | $875 | 6 | 12 | 95 | 4 | 3 | 8 | 4 | Server |
| ninja | Ninja | $950 | 7 | 14 | 95 | 5 | 4 | 8 | 4 | Server |
| monk | Monk | $1000 | 7 | 14 | 100 | 5 | 3 | 7 | 4 | Server |
| reaper | Grim Reaper | $1075 | 7 | 14 | 95 | 5 | 4 | 8 | 4 | Server |
| cowboy | Rodeo Cowboy | $1125 | 7 | 14 | 100 | 5 | 4 | 7 | 4 | Server |
| vampire | Vampire | $1200 | 8 | 14 | 100 | 5 | 4 | 8 | 4 | Server |
| queen | Queen | $1250 | 8 | 14 | 105 | 5 | 4 | 7 | 4 | Server |
| dracula | The Count | $1325 | 8 | 16 | 105 | 6 | 4 | 7 | 4 | Server |
| boxer | Boxer | $1375 | 8 | 16 | 110 | 6 | 4 | 5 | 3 | Neutral |
| samurai | Samurai | $1450 | 9 | 16 | 110 | 6 | 4 | 6 | 4 | Neutral |
| gladiator | Gladiator | $1500 | 9 | 16 | 115 | 6 | 4 | 4 | 3 | Neutral |
| wrestler | Pro Wrestler | $1575 | 9 | 16 | 115 | 6 | 5 | 4 | 3 | Fighter |
| wolfman | Wolfman | $1625 | 9 | 16 | 118 | 6 | 5 | 4 | 3 | Fighter |
| knight | Knight | $1700 | 10 | 18 | 120 | 6 | 5 | 3 | 3 | Fighter |
| viking | Viking | $1750 | 10 | 18 | 120 | 6 | 5 | 3 | 3 | Fighter |
| werewolf | Werewolf | $1825 | 10 | 18 | 120 | 6 | 5 | 3 | 3 | Fighter |
| king | King | $1875 | 10 | 18 | 125 | 6 | 5 | 3 | 3 | Fighter |
| frankenstein | Lab Experiment | $1950 | 11 | 18 | 130 | 7 | 5 | 2 | 3 | Fighter |
| sumo | Sumo Wrestler | $2000 | 11 | 18 | 140 | 7 | 5 | 2 | 3 | Fighter |

### 4.3 Tier TOXIN-LOW — rarity 2 "professionals & warriors" (20), 1–4 vials

| zombieId | Customer archetype | Cost | Lv | R≥ | En | Sp | Pw | Tp | Fo | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| berserk_nurse | Night-Shift Nurse | 1v | 8 | 24 | 105 | 5 | 5 | 10 | 6 | Server |
| plague_doc | Plague Doctor | 1v | 8 | 24 | 108 | 5 | 5 | 9 | 6 | Server |
| dr_dead | Surgeon | 1v | 8 | 24 | 110 | 5 | 5 | 9 | 6 | Server |
| warlock | Warlock | 1v | 9 | 24 | 110 | 5 | 5 | 9 | 6 | Server |
| mad_scientist | Mad Scientist | 1v | 9 | 26 | 115 | 6 | 5 | 9 | 6 | Server |
| shaman | Shaman | 2v | 9 | 26 | 115 | 6 | 5 | 8 | 6 | Server |
| biohazard | Hazmat Technician | 2v | 10 | 26 | 120 | 6 | 5 | 7 | 6 | Server |
| ronin | Ronin | 2v | 10 | 26 | 120 | 6 | 5 | 6 | 6 | Neutral |
| roman | Roman Centurion | 2v | 10 | 28 | 128 | 6 | 5 | 6 | 6 | Neutral |
| mercenary | Mercenary | 2v | 11 | 28 | 125 | 6 | 5 | 6 | 6 | Neutral |
| conquistador | Conquistador | 3v | 11 | 28 | 130 | 7 | 5 | 5 | 5 | Neutral |
| pharaoh | Pharaoh | 3v | 11 | 28 | 130 | 6 | 5 | 7 | 6 | Server |
| paladin | Paladin | 3v | 12 | 30 | 135 | 6 | 5 | 6 | 6 | Neutral |
| shogun | Shogun | 3v | 12 | 30 | 135 | 7 | 6 | 5 | 6 | Neutral |
| cyborg | Cyborg | 3v | 12 | 30 | 135 | 7 | 6 | 4 | 6 | Fighter |
| robot | Robot | 4v | 13 | 30 | 140 | 7 | 6 | 4 | 6 | Fighter |
| spartan | Spartan | 4v | 13 | 32 | 140 | 7 | 6 | 4 | 6 | Fighter |
| barbarian | Barbarian | 4v | 13 | 32 | 145 | 8 | 6 | 3 | 6 | Fighter |
| berserker | Berserker | 4v | 14 | 32 | 145 | 8 | 6 | 3 | 6 | Fighter |
| mech | Mech Pilot | 4v | 14 | 32 | 150 | 8 | 6 | 2 | 6 | Fighter |

### 4.4 Tier TOXIN-MID — rarity 3 "supernatural" (15), 6–15 vials

| zombieId | Customer archetype | Cost | Lv | R≥ | En | Sp | Pw | Tp | Fo | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| shadow | Living Shadow | 6v | 12 | 36 | 140 | 7 | 6 | 10 | 9 | Server |
| banshee | Banshee | 7v | 12 | 36 | 145 | 7 | 6 | 9 | 9 | Server |
| necromancer | Necromancer | 7v | 12 | 36 | 150 | 7 | 6 | 9 | 9 | Server |
| wraith | Wraith | 8v | 13 | 38 | 155 | 7 | 7 | 8 | 9 | Neutral |
| angel | Angel | 9v | 13 | 38 | 160 | 7 | 7 | 8 | 9 | Neutral |
| lich | Lich | 9v | 13 | 38 | 160 | 7 | 7 | 7 | 9 | Neutral |
| void_walker | Void Walker | 10v | 14 | 40 | 165 | 7 | 7 | 7 | 9 | Neutral |
| hellfire | Hellfire Elemental | 10v | 14 | 40 | 170 | 8 | 7 | 6 | 9 | Neutral |
| demon | Demon | 11v | 14 | 40 | 175 | 8 | 7 | 6 | 9 | Neutral |
| dragon_lord | Dragon Lord | 12v | 15 | 42 | 180 | 8 | 7 | 6 | 9 | Neutral |
| crypt_lord | Crypt Lord | 12v | 15 | 42 | 185 | 8 | 8 | 4 | 8 | Fighter |
| undead_king | Undead King | 13v | 15 | 42 | 190 | 8 | 8 | 4 | 8 | Fighter |
| death_knight | Death Knight | 14v | 16 | 44 | 195 | 8 | 8 | 3 | 8 | Fighter |
| titan | Titan | 14v | 16 | 44 | 200 | 8 | 8 | 3 | 8 | Fighter |
| colossus | Colossus | 15v | 16 | 44 | 210 | 8 | 8 | 2 | 8 | Fighter |

### 4.5 Tier TOXIN-HIGH — rarity 4 "legends" (10), 20–50 vials

| zombieId | Customer archetype | Cost | Lv | R≥ | En | Sp | Pw | Tp | Fo | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| grim_chef | Celebrity Chef | 20v | 15 | 50 | 240 | 9 | 10 | 7 | 11 | Neutral (hybrid) |
| alpha | The Alpha | 23v | 15 | 52 | 250 | 9 | 10 | 6 | 11 | Neutral (hybrid) |
| omega | The Omega | 27v | 16 | 54 | 260 | 9 | 10 | 6 | 11 | Neutral (hybrid) |
| prime_evil | Prime Evil | 30v | 16 | 56 | 270 | 9 | 10 | 5 | 10 | Neutral (hybrid) |
| zombie_god | Forgotten God | 33v | 17 | 58 | 280 | 9 | 11 | 4 | 10 | Fighter |
| apocalypse | Apocalypse Herald | 37v | 17 | 60 | 290 | 9 | 11 | 4 | 10 | Fighter |
| eternal_lord | Eternal Lord | 40v | 18 | 62 | 300 | 9 | 11 | 4 | 10 | Fighter |
| oblivion | Oblivion Avatar | 43v | 18 | 64 | 305 | 10 | 11 | 3 | 10 | Fighter |
| infinity | Infinity Being | 47v | 19 | 66 | 310 | 10 | 12 | 3 | 11 | Fighter |
| singularity | The Singularity | 50v | 19 | 68 | 320 | 10 | 12 | 2 | 11 | Fighter |

### 4.6 Closed-form cost/gate rules (source of truth; tables above are the golden output)

Within each rarity, sort ascending by `statSum` (ties by `zombieId`), index `i`, count `n`. Rating gates are authored directly on the canonical **0–100** scale (progression's `R = S + D + B`); the former 0–50 scale is deleted.

| Rarity | Cost | Unlock cafe Lv | Min rating R (0–100) |
|---|---|---|---|
| 0 | Free | `1 + floor(i/6)` → 1–5 | 0 |
| 1 | `round((200 + i×1800/(n−1)) / 25) × 25` → $200–$2,000 | `4 + floor(i/4)` → 4–11 | `10 + 2×floor(i/6)` → 10–18 |
| 2 | `1 + floor(i×4/n)` → 1–4 vials | `8 + floor(i/3)` → 8–14 | `24 + 2×floor(i/4)` → 24–32 |
| 3 | `6 + round(i×9/(n−1))` → 6–15 vials | `12 + floor(i/3)` → 12–16 | `36 + 2×floor(i/3)` → 36–44 |
| 4 | `20 + round(i×30/(n−1))` → 20–50 vials | `15 + floor(i/2)` → 15–19 | `50 + 2×i` → 50–68 |

All 105 are obtainable by cafe level 19 / rating 68 — inside progression's level-22 cap and comfortably below the 100-rating ceiling (a maxed decor-and-service cafe per progression's S/D/B budgets exceeds 68). CI asserts reachability against `unlocks.json` and the rating canon (§13).

---

## 5. Customer spawning & rating gates

Each walk-in is an **occupation instance** drawn from the eligible pool. (Customer lifecycle belongs to the serving spec; spawn *interval* is a tuning-canon key owned by progression's rating table. This section owns *which occupation spawns* and infectability.)

**Eligibility:** `unlockLv ≤ cafeLevel` AND `minRating ≤ R`.

**Tier weights** (R = current rating, canonical 0–100):

```
wFree  = max(35, 70 − 0.5×R)
wCash  = 22 + 0.25×R
wToxin =  8 + 0.25×R
```

At R=0: 70/22/8. At R=60: 40/37/23. At R=100: 35/47/33. Normalize; an empty tier's weight redistributes to the next tier down. Within a tier, uniform pick (seeded RNG).

**Zombiepedia bait (modernization):** every 10th spawn is forced, if possible, to an eligible occupation whose collection state (progression's model) is not yet `Infected` — a visible "you could recruit this" hook, with a subtle green ✦ sparkle on the name tag. Spawning an occupation sets its collection state to `Sighted` (progression's rule; we fire the event).

**Infectability:** any customer who is **seated or standing in the wait queue** (stationary) is infectable. Walking and fleeing customers are not tappable for infection. *(Design choice, not fidelity — §14; research supports "just tap them" with no posture qualifier.)*

---

## 6. Energy system

### 6.1 Time model — the activity clock (F8), authored foreground-native

The prior draft authored rates in an ambiguous "sim-minute" frame and broke its own arithmetic (the COOKING row forgot its 12×; Focus-1 daydreamed every ~5 real seconds). **Rev. 2 reframe: the foreground is the native 1× rate.** All rates below are authored in energy per **real foreground minute** — what the player actually feels. When the game is backgrounded/closed, activity-time advances at **1/12 real time** (`ACTIVITY_OFFLINE_FACTOR = 1/12`, inside the researched 10–15× band).

This is arithmetically identical to "foreground runs 12× faster than closed" and reproduces the original's quirk — "cook overnight; zombies won't consume as much energy" — with no second frame to desynchronize.

**Subscribers of the activity clock:** energy drain/regen, daydream rolls, serving/customer throughput (research dim 4 names serving explicitly — see Review notes for why one critic's proposal to exempt it was declined), feral logic.
**Exempt (always wall-clock):** cook timers, burn deadlines, rest-completion timestamps computed from rates (the rates themselves scale), raid revive timers.

**Pause semantics** (consumed from simulation-core, restated for implementers): full-screen modals (RosterPanel, cookbook, store) pause the activity clock — customers, energy, daydream all freeze; cook wall-clocks keep running. Hidden tab < 60 s: freeze-and-resume. Hidden ≥ 60 s: offline settlement path (§7.4). Live-frame catch-up beyond `MAX_LIVE_CATCHUP` routes through settlement, never a burst of live ticks.

**Test-time acceleration:** the sim receives an injected `Clock`; dev/CI builds may inject a scaled or steppable clock via the harness contract in engineering-infra (replacing the deleted `DEMO_TIME_SCALE`). A build-time guard (`import.meta.env.PROD`) makes the injectable seam unreachable in production bundles; CI asserts the guard.

### 6.2 Rates (energy per real foreground minute; background = value ÷ 12)

| Activity | Foreground rate | Foreground endurance (90-energy commoner) | Background rate | Closed-app effect |
|---|---|---|---|---|
| COOKING (staffing a stove) | −0.8 | ~112 real min | −0.067 | 8 h ≈ −32; 12 h ≈ −48 |
| SERVING (dispatched, ferrying plates) | −2.0 | ~45 real min | −0.167 | applies only while the offline settler has the server actively serving |
| BUSSING (clearing plates) | −1.2 | ~75 real min | −0.10 | same |
| DAYDREAM / IDLE_WANDER | 0 | — | 0 | — |
| RESTING | **+36** | full 90 refill in 2.5 real min | +3.0 | full 90 refill in 30 min closed; 320-energy legend ≈ 107 min |
| EXHAUSTED (collapsed, un-rested) | +18 | to 30% in ~1.5 min | +1.5 | |

All six numbers are single tuning-canon keys; the Serum Barrel (§9.4) multiplies the three drain rows by 0.8.

**Consistency invariant (unit-tested):** for every activity, foreground drain per real second = exactly 12 × background drain per real second.

### 6.3 Daydream calibration (F14) — fixed

Daydream interval is exponential-distributed (seeded RNG) with mean `75 + 15 × Focus` **real foreground seconds**: Focus 1 ≈ 90 s (the researched "every 1–2 min"), Focus 6 ≈ 2.75 min, Focus 12 ≈ 4.25 min. Daydream rolls run only on the live foreground clock — offline settlement never rolls daydreams (deterministic settlement, and drain-0 states don't matter offline).

**Auto-resume, revised for active-play texture** (review: the modernization stack risked the game playing itself): zombies with **Focus ≤ 4 never auto-resume** — they stand dreaming until tapped, exactly like the original; this covers every Free-tier commoner (Fo 1–2), so cheap early staff demand the original's constant re-tasking. Zombies with Focus ≥ 5 auto-resume after **25 real seconds** (they're premium; self-management is their fantasy). Tap always snaps out instantly. The whole modernization bundle (auto-resume + server task-loop + patience-pause + scout + feral grace) gets a dedicated M7 playtest as a bundle, per review.

### 6.4 Thresholds & Toxin

| Rule | Value |
|---|---|
| Feral trigger | energy ≤ 0 while in COOKING / SERVING / BUSSING / DAYDREAM |
| Low-energy warning (modernization) | ≤ 15% max: sprite pulses red, groan SFX every 20 s, roster chip flashes. Honest lead times: ~17 real min for a commoner cooking, ~7 min serving (the old "~30 s" claim was an artifact of the broken math). An accompanying toast shows the countdown estimate. |
| Must-rest lockout | feral/exhausted zombies refuse new tasks until energy ≥ 30% max |
| Feed restore | eating a customer (feral) or raid victim restores 20% max energy (F16) |
| Toxin instant refill | 1 vial → energy = max, clears must-rest (F7); exposed on the RosterPanel card and the on-sprite warning bubble. Registered in the progression Toxin ledger. |
| Zombie death | raids only (raid spec): 8 h revive OR 1 vial — states reserved here |

### 6.5 Offline cooking & the idle pillar (blocker fix)

**Staffing gates cook START and live RESUME only. Once a cook is running, a backgrounded/closed window never pauses it for energy reasons.** Rules:

- Offline, a staffed working zombie drains at background rate (§6.2) down to a **10% max-energy floor** (the clamp). Hitting the clamp: the zombie stops "working" at that timestamp (drain stops), is found EXHAUSTED-standing with `mustRest`, and one **`RATING.feralOfflineIncident` (−2)** is logged — "it scared off would-be patrons while you were away."
- **The stove keeps cooking on its wall-clock regardless.** The dish finishes (and can later burn) on schedule whether or not the staffer clamped out. The cook/burn offline math in the service spec therefore no longer consumes staff pause timestamps.
- Live (foreground), the original tension is intact: a zombie that goes feral or is pulled off a stove **does** pause that stove.

Worked examples (background cooking drain 0.067/min): fresh 90-energy commoner, 12 h cook → loses 48, ends at 42 (47%), **no incident, cook completes** (this is the review-mandated acceptance test). 72 h cook → clamps at ~20 h, one −2 incident, zombie exhausted, **cook still completes** — the overnight-bet dishes from the extended 24–72 h band remain shippable. A 240-energy legend runs ~54 h before clamping.

*Deviation note (§14):* whether the original paused unstaffed offline stoves is unresearched; we choose completion-with-consequence because pillar 2 ("offline earnings matter", long set-and-forget cooks) is a locked owner decision and the alternative provably dead-ended every L16+ dish.

### 6.6 Rest flow

"Rest" sends the zombie outside (original: "send it outside until its meter refills"): pathfind to the door tile, despawn; RosterPanel shows a live ETA (`(max − energy) / currentRate`, rate per the active clock mode). Recall early any time. On full: auto-return to IDLE_WANDER + toast "«name» is rested and ready."

---

## 7. Staff state machine

Owned by `src/sim/staff/StaffSim.ts` (pure TS, no Phaser). One machine per zombie instance; the actor layer renders, never simulates.

### 7.1 States

```
LOCKER          frozen in Meat Locker: no drain, no regen, no daydream, not in cafe
IDLE_WANDER     no task: slow shamble between random walkable tiles (pause 4–9 s), 0 drain
COOKING         anchored at assigned stove; drains per §6.2; a LIVE unstaffed stove pauses (offline: §6.5)
SERVING         dispatched server loop (owned by serving spec); drains per §6.2
DAYDREAM        task paused, 💭 bubble; resume rules per §6.3
RESTING         outside; +36/min fg, +3/min bg; recall or auto-return at full
EXHAUSTED       collapsed/standing; +18/min fg, +1.5/min bg to 30%, then IDLE_WANDER
FERAL_SEEK      A* to nearest seated customer (else nearest walking); ignores commands; red tint + drool
FERAL_ATTACK    2.2 s CENSORED-bar feeding (F9)
RAIDING / DEAD  reserved for the raid spec (DEAD: 8 h timer or 1 vial)
```

### 7.2 Transition table

| From | Trigger | To | Side effects |
|---|---|---|---|
| IDLE_WANDER | player assigns stove | COOKING | walks to stove first, then anchors |
| IDLE_WANDER | player dispatches as server | SERVING | |
| any working | daydream roll fires (§6.3) | DAYDREAM | task paused, not dropped |
| DAYDREAM | auto-resume (Focus ≥ 5, 25 s) OR player tap | previous state | tap = instant |
| any working / DAYDREAM | energy ≤ 0 | FERAL_SEEK | live stove pauses; `zombie-feral` event; horror sting |
| FERAL_SEEK | reached victim | FERAL_ATTACK | victim removed from seat/queue |
| FERAL_SEEK | no customers in cafe | EXHAUSTED | collapse on the spot |
| FERAL_ATTACK | 2.2 s done | RESTING (forced) | victim devoured (bill forfeited, bones prop); ALL other customers flee unpaid at `CUSTOMER_FLEE`; `rating.addDelta(RATING.feralLive)` (canonical −6); energy = 20% max; mustRest until 30% |
| any non-feral | player taps Rest | RESTING | walks to door, despawns |
| RESTING | full OR recall | IDLE_WANDER | toast on auto-return |
| EXHAUSTED | energy ≥ 30% | IDLE_WANDER | |
| any (energy ≥ 30%) | player moves to Locker | LOCKER | not mid-FERAL; task released; confirm dialog if mid-cook ("This will pause the stove") |
| LOCKER | player activates (slot free) | IDLE_WANDER | |
| any | Toxin refill (1v) | previous stable state | energy = max, clears mustRest; NOT usable mid-FERAL_ATTACK (the punishment sticks) |

### 7.3 Feral choreography (the set-piece)

1. Warning (≤15%): red pulse, low groan, roster chip flashes.
2. Snap (0): drops plate/spoon (clatter), 200 ms red edge-vignette, dissonant sting. *(Vignette/shake suppressed under reduced-motion; audio cues mirrored as toasts when the settings flag is on.)*
3. Seek: shamble at `FERAL_SEEK_MULT` × own speed toward nearest seated customer; others get 😨 bubbles.
4. Attack: jittering black **CENSORED** bar over both sprites, 3 crunch SFX, feather/hat particles; bones prop persists 20 s.
5. Panic: all remaining customers flee to the door at `CUSTOMER_FLEE`, 💢 bubbles, bills void (servings not consumed stay on the dish).
6. Aftermath: star meter blinks red, `−6★`-scaled floater (renders whatever the rating canon's delta is), feral zombie trudges out to forced REST. Toast: "«name» went feral and ate a customer!"

### 7.4 Offline resolution — a settler inside the unified OfflineEngine

`OfflineStaff.resolve(state, window) → { instances, incidents, availabilityTimeline }` — a pure function of (saved state, clamped elapsed window), run at the staff slot in simulation-core's fixed settler order. Per active zombie, integrate piecewise at background rates:

- RESTING/EXHAUSTED: regen; may complete → IDLE_WANDER at the computed timestamp.
- COOKING/SERVING/BUSSING: drain to the 10% clamp per §6.5; clamp-hit ⇒ EXHAUSTED-standing + `mustRest` + one `RATING.feralOfflineIncident` (−2) at that timestamp. **Cooks are never paused by this** (§6.5).
- **availabilityTimeline** (new, review-mandated): per server, the sub-intervals of the window during which it was working (i.e., pre-clamp). The service settler consumes this to compute offline counter/serving throughput — eliminating the order-dependence bug where offline sales assumed servers that had exhausted hours earlier.
- Welcome-back report lines: "«name» ran out of energy 3 h ago — it needs a rest." (The report shell, including the researched red/green star-blink summary, is the service/progression report's; we contribute lines.)
- Deterministic; negative elapsed (clock rollback) is a no-op; unit-tested with a fake clock.

---

## 8. Zombie leveling (F13) — the single zombie-level model

| Parameter | Value |
|---|---|
| XP faucets | +1 XP per plate delivered (keyed to the events registry's canonical delivery event); +5 XP per completed cook (the staffing zombie); +2 XP per raid enemy defeated (research-exact); +10 XP per raid boss |
| Curve | `xpToNext(L) = round(25 × L^1.5 / 5) × 5` → 25, 70, 130, 200, 280, 370, 465, 565, 675, 790, … |
| Cap | **Level 15** (raids adopts this; its cap-10 model is deleted per §0.1) |
| Per level | +5% of base energy: `maxEnergy = round(baseEnergy × (1 + 0.05 × (level−1)))` — L15 Singularity = 544. Raid HP derives from this value. |
| Speed bonus | +1 Speed at levels 5/10/15 (owner-requested; capped so the shamble stays shambly) |
| Level-up moment | energy refilled to new max, green toxin-burst, jingle, `zombie-level-up` event, "LEVEL 7!" floater |

Chef avatar gains no levels (F10). Zombie **combining** (4-merge stat marks) stays out of scope for v1; the save schema reserves `merges` so it lands without migration, and progression's `Mastered` Zombiepedia state is defined there against it.

---

## 9. Working slots, the Meat Locker, the Serum Barrel

### 9.1 Active-slot ladder (Chef never consumes a slot) — single authority

`slots(L) = min(14, ceil(0.7 × L))`, L = cafe level on progression's 1–22 curve:

| Cafe Lv | 1 | 2 | 3 | 5 | 7 | 9 | 12 | 14 | 16 | 18 | 20 | 21–22 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Slots | 1 | 2 | 3 | 4 | 5 | 7 | 9 | 10 | 12 | 13 | 14 | 14 |

1 at L1 (research-exact) → 14 hard max from L20. Progression's and the build order's rival ladders are deleted; `unlocks.json` displays these values by importing this function.

### 9.2 Meat Locker

- Default 5 hooks; +5 hooks per **5 Toxin**, max 100 (research-exact). Availability level: per `unlocks.json` (progression owns the unlock ladder; recommendation recorded there: available from L1 — it's storage, not power).
- Locker zombies are frozen: no drain/regen/XP; retain energy/level.
- Swap active ↔ locker free and instant; a working zombie drops its task first (confirm dialog if mid-cook).
- UI: meat-hook rail, dangling zombies, hook cards with portrait + level + energy snapshot.
- Infection exceeding slots AND hooks: Infect button disabled with reason "No room! Expand your Meat Locker (5🧪) or free a hook."

**Empty states (review-mandated):** Locker with 0 residents shows the empty rail with a swinging hook and copy "Nobody's hanging around… yet." Roster with only the Chef shows the Chef card plus a ghosted "Infect a customer to hire staff" slot that deep-links the tutorial pointer at a seated commoner.

### 9.3 Chef avatar (F10)

Constant entity `chef_avatar`: Tips 3 / Speed 5 / Power 4 / Energy 90 / Focus 12 (never daydreams). Energy does not deplete in cafe work (raids only). Makes L1 (1 slot + Chef) playable like the original's opening. Premium "chef heads" remain a reserved economy-spec Toxin sink.

### 9.4 Industrial Barrel of Zombie Serum (F18 — restored researched item)

Special-tab purchase, **50 Toxin**, one-time, account-wide: all zombie energy **drain** rates ×0.8 permanently (endurance +25% in practice; regen unaffected). Registered as a sink in progression's Toxin ledger; save field `serumBarrel: boolean`. It is the late-game answer to running legends on long raids and double shifts — the researched "premium energy-economy modifier" the sink tables were missing. (The Magic Fridge and Toxin-upgradeable special stoves are cooking-side items; they are owned by the service-loop/progression specs — cross-reference logged there, not duplicated here.)

---

## 10. Infection flow (the signature interaction)

### 10.1 UX sequence

1. **Tap an infectable customer** (seated or queued, §5). A compact world-anchored card pops:
   - Portrait + occupation name, tier badge (FREE / CASH / TOXIN + vial icon).
   - Stat preview: ⚡En ❤Tp ⚔Pw 👟Sp 🎯Fo + Role badge.
   - Collection state (progression's model): owned count, or NEW! ribbon, or silhouette-with-hint.
   - Cost chip: `FREE` / `$1,325` / `12 🧪` — red if unaffordable, shortfall tooltip.
   - **INFECT** (toxic-green, syringe) / dismiss (tap anywhere else).
2. **Confirm** = the single INFECT tap (the card is the confirm). Cost deducted via `Economy.spendCoins`/`spendToxin`.
3. **Transformation beat** (keep + upgrade the squash-morph at `Customer.ts:70-88`): clutch throat → collapse (squash 0.55) → toxin-puff particles → rise as zombie with green tint sweep → happy groan → "«name» joined the staff!"
4. **Placement:** free slot → IDLE_WANDER; else free hook → flies to Locker (clank); else the button was already disabled.
5. **Ledger:** unpaid bill forfeited (F5); seat/queue spot frees; in-progress serving voided (the dish's remaining servings untouched).

### 10.2 Rules

| Rule | Value |
|---|---|
| Who is infectable | any seated or queued (stationary) customer (§5; design choice logged §14) |
| Cost | exact per-occupation from §4; Free tier truly $0 |
| Refunds | none |
| Duplicates | allowed (future combining consumes them) |
| Toxin faucet | infection NEVER grants currency — deletes `Economy.addBrains(1)` (`Customer.ts:79`); Toxin is earned per the progression ledger only |
| Gating | implicit via spawn pool — if they walked in, you may infect them |
| During feral panic | fleeing customers are not stationary → not infectable (prevents "farm the panic") |
| Tutorial | first infection scripted on a Free commoner, in the core tutorial that now ships WITH this system's milestone (review fix: onboarding is split across milestones, not parked at M11); the reward values live once in `quests.json` |

### 10.3 Input-mode arbitration (review-mandated)

This spec's taps register in the shared input-mode stack (`docs/spec/input-modes.md`):

- **Neutral mode:** tap customer → InfectCard (this spec). Tap zombie → mini-card / selects for dispatch (enters `dispatch` mode).
- **Dispatch mode (a zombie is selected):** a tap on a customer is a **dispatch-context tap, never an infect** — it targets the customer's seat only if that's a legal serve target, else it deselects back to neutral. One tap = one meaning; no ambiguous dual-action.
- **Edit/placement mode and raid mode:** infection taps disabled entirely; customers are inert.
- InfectCard is dismissed by any outside tap, Esc, opening any panel, or mode change; camera pan past the tap-slop threshold never opens it.

### 10.4 Economy sanity

Anchored to the reconciled dish canon (original menu restored — Mystery-Meat-class L1 dishes, ~$4–10 profit per 2–5 min cook): a $200 Cheerleader ≈ 20–30 early cooks; $2,000 Sumo lands mid-game — mirroring the original's $100–$2,000 arc. Against the ledger's ~15–25 earned vials/week: a 1v Night-Shift Nurse is a daily-ish treat, 12v Dragon Lord ≈ a week's discipline, 50v Singularity ≈ a 2–3-week grail. (Budget assertions run only against progression's ledger file.)

---

## 11. Roster management UI

### 11.1 Entry points
- HUD 🧟 chip → RosterPanel; shows `active/slots`, flashes red when any zombie ≤15% or feral.
- Tap a cafe zombie → mini-card (portrait, energy bar, state): **Assign** / **Rest** / **Refill 1🧪** / **Roster…**

### 11.2 RosterPanel (full-screen modal — pauses the activity clock per §6.1)

- **ACTIVE STAFF (n/slots):** cards — portrait, name, Lv badge + XP bar, energy bar (green >50% / amber 16–50% / red ≤15% pulsing, plus a ⚠ icon state at ≤15% so color is never the only signal), state icon, role badge, stat strip. Buttons: `Assign` (closes into assign mode: eligible stations glow), `Rest`, `Refill 1🧪`, `→ Locker`.
- **MEAT LOCKER (n/hooks):** hook rail; `→ Active` (disabled with reason when slots full). Footer: `+5 hooks — 5 🧪` (disabled at 100). Empty states per §9.2.
- Sort: feral, warning, energy ascending, level descending. Chef pinned with ∞ energy glyph.
- Keyboard: Tab/arrow navigation between cards, Enter activates, Esc closes (accessibility fold-in per review).

### 11.3 Zombiepedia tab (renders progression's collection model)

Grid of all 105 occupations in §4 order, rendering progression's four states: Undiscovered ("???" + unlock hint, e.g. "Reach ★34"), Sighted (silhouette + name + cost tier), Infected (full color + count + best level), Mastered (gold frame; v1 shows the frame art as locked-future). Completion counter feeds progression's milestone Toxin grants. **Empty state (0/105):** a single spotlighted silhouette with "Every customer is a future employee. Tap one to begin." — never a blank grid.

### 11.4 Feedback inventory

Energy bars tween; refill = green flash + liquid SFX; assign = stamp animation; press-squash 0.95; every action acknowledged ≤100 ms. Touch targets: the shared UI-kit constant (one value, defined there — this spec stops restating 44 px).

---

## 12. Architecture, data model, file plan

Pure-TS sim (no Phaser imports under `src/sim/`); views subscribe via the typed EventBus. Interfaces are consumed **verbatim from `src/engine/contracts.ts`** (the engine's real signatures — `walkable(t: Tile)`, `findPath(...): PathResult`, etc.); this spec no longer paraphrases them.

```
src/sim/staff/StaffStats.ts      // §3 derivations + §4.6 rules; pure functions of catalog entry
src/sim/staff/OccupationTable.ts // full table from zombies.json; lookups + spawn pools
src/sim/staff/StaffSim.ts        // state machines, energy integration, daydream; tick(activityDt, ctx); toJSON/fromJSON
src/sim/staff/InfectionSystem.ts // eligibility, cost deduct, placement, events
src/sim/staff/OfflineStaff.ts    // §7.4 settler (pure), incl. availabilityTimeline export
src/sim/movement/Speeds.ts       // §0.3 — THE speed module (all specs import)
src/ui/RosterPanel.ts            // §11
src/ui/InfectCard.ts             // §10.1
src/ui/EnergyBar.ts              // reusable bar
src/game/ZombieActor.ts          // Phaser view: engine path-follower, state animations
```

**Injected dependencies:** `clock` (activity clock per §6.1; steppable in dev/CI per the harness contract), `rng` (seeded), `pathfinder` (engine A* — **no shipped fallback adapter**; tests use an in-test fake), `economy`, `rating` (`addDelta(key, reason)` — magnitudes live in the rating canon).

**Typed events — ADDED to the canonical registry (`src/core/events.d.ts`); payloads defined here once, never redefined elsewhere:**
```ts
'customer-infected'     { instanceId: string; zombieId: string; occupation: string; costTier: 'free'|'cash'|'toxin' }
'infection-blocked'     { reason: 'funds'|'room' }
'zombie-feral'          { instanceId: string }
'zombie-energy-warning' { instanceId: string }
'zombie-level-up'       { instanceId: string; level: number }
'zombie-rested'         { instanceId: string }
'roster-changed'        {}
```
Rating changes flow through `rating.addDelta` (the rating canon emits its own `rating-changed`); this spec no longer defines a `rating-delta` event. Delivery-XP hooks subscribe to the registry's canonical delivery event.

**Save fields (version integer assigned by the build-order save ledger at this system's milestone — no absolute numbers in this spec):**
```ts
interface ZombieInstance {
  id: string;            // nanoid; duplicates of same zombieId allowed
  zombieId: string;
  level: number; xp: number;
  energy: number;        // 0..maxEnergy(level)
  location: 'active' | 'locker';
  task: { kind:'stove'; stoveId:string } | { kind:'server' } | { kind:'rest' } | { kind:'idle' };
  mustRest: boolean;
  merges: number;        // reserved (0)
  infectedAtUtc: number;
}
// SaveData additions owned by this system:
lockerHooks: number;     // default 5, max 100
serumBarrel: boolean;    // §9.4
// Collection state (Sighted/Infected/... per occupation) is progression's save territory.
```
`task.stoveId` references **stable placement ids** — this spec depends on the engine's id-preserving `moveItem` fix (a moved stove keeps its id and its staffer).
**Migration (from the pre-staff shape):** each old `{zombieId, level, xp, assignment}` → instance with `energy = maxEnergy(level)`, `location` from assignment, `task` from assignment (stove by index), `mustRest:false`, `merges:0`; `lockerHooks=5`; `serumBarrel=false`; collection store seeded from owned ids. Fixture-save test lives in the ledger's fixture directory under the assigned version number.

**Storage-failure behavior** is the save layer's (M0 canon: in-memory session + banner, quota toast + auto-download, corrupt-save download-before-wipe); this spec adds no bespoke handling but its settler must tolerate `lastSeenUtc` in the future (clock rollback no-op).

**Deletions from current code (no adaptation):** passive roll + reward (`src/game/Customer.ts:63, 68-83`), `kitchenInfectionChance()` (`src/scenes/CafeScene.ts:117-125`), infection-count cafe leveling (`CafeScene.ts:133-149` — cafe XP moves to progression's dish-XP model), the pinned waiter bob (`CafeScene.ts:79-86` → ZombieActor), `infectionChance` semantic (now a Tips source only), and `DEMO_TIME_SCALE` (`config.ts:18` → injected clock harness).

---

## 13. Testing & performance

**Unit (vitest, node, no Phaser):**
1. Derivation golden: all 105 entries → exact §4 tables (committed fixture); ranges En 70–320, Sp 2–12, Pw 1–12, Tp 1–12, Fo 1–12.
2. **Reachability against canon:** every `unlockLv ≤ 22` (progression's cap) and `minRating ≤ 68`; every occupation is in some spawn pool at (L22, R 68); tier weights normalize at R ∈ {0, 50, 100}.
3. Energy: property tests — never <0 or >max; **foreground rate = exactly 12× background rate per real second, per activity**; endurance design assertions (90-energy commoner: cooking ≥ 100 real fg min, serving ≥ 40); Serum Barrel ×0.8 on drains only.
4. Daydream calibration: Focus 1 mean ∈ [80, 100] real fg seconds; Focus ≤ 4 never auto-resumes; no rolls during offline settlement.
5. Feral: zero energy in each working state → FERAL_SEEK; victim → 20% restore + `RATING.feralLive` delta emitted once; no customers → EXHAUSTED.
6. **Offline idle-pillar AC (review-mandated):** fresh 90-energy commoner staffing a 12 h cook fully offline → cook completes, zombie at 42 energy, zero incidents. 72 h variant → cook completes, exactly one −2 incident, zombie EXHAUSTED+mustRest. Determinism: same (state, elapsed) → same result; negative elapsed no-op; availabilityTimeline sums match drain integrals.
7. Infection: free/cash/toxin deduction, insufficient funds → `infection-blocked('funds')`, slot→hook→blocked cascade, dupes allowed, queued-customer infect allowed, fleeing blocked.
8. Input arbitration: in dispatch mode a customer tap never opens InfectCard (mode-stack fake).
9. Migration: legacy fixture → valid shape under the ledger-assigned version; idempotent.
10. Level curve exact; +5%/level; refill on level-up; `maxEnergy(15)` values consumed by the raid spec's TTK fixtures (shared fixture file so drift fails CI).

**Playwright smoke (chromium + the infra spec's WebKit project):** boot → tap seated commoner → infect → roster +1; debug-set energy 1 → CENSORED bar → rating-drop toast. Long-timer flows use the injected steppable clock via the harness contract (never a prod code path).

**Performance:** StaffSim tick O(≤14 + chef); daydream via next-event timestamps (no per-frame rolls); RosterPanel virtualizes >30 cards; zero allocations in the energy hot path (accumulate, apply at 250 ms activity intervals). Frame-budget assertions follow the infra spec's relative-budget CI method; device-class claims live on the manual per-milestone device checklist, not in CI.

---

## 14. Deliberate deviations from the original

| Deviation | Original | Ours | Why |
|---|---|---|---|
| Toxin is earned-only; no IAP ladder | $4.99–$99.99 packs | quests/raids/streaks/milestones per the progression ledger | Pillar 3 |
| Feral warning grace | silent snap | 15% warning, minutes of honest lead time (§6.4) | "remove dated friction"; failure stays real |
| Daydream auto-resume | always manual re-tasking | manual for Focus ≤ 4 (all commoners — original texture preserved); 25 s auto-resume for Focus ≥ 5 | review fix: keeps re-tasking a real activity while letting premium staff feel premium; bundle-playtested at M7 |
| **Seated-or-queued infection only** | research: "just tap them" — no posture qualifier known | walking/fleeing customers not tappable | **design choice, not fidelity** (reclassified per review): stationary targets make the tap unambiguous under the input-mode stack; queue-standing customers are now included, removing the prior over-restriction |
| **Offline cooks never pause for energy** | unresearched (original's closed-app behavior at zero energy unknown) | staffing gates start/live-resume; offline clamp costs −2 rating + exhausted zombie, cook completes | pillar 2 is locked; the alternative provably killed every ≥13 h cook for common staff |
| Offline feral mercy | zombie attacks while away (implied) | 10% clamp; −2 incident, no eaten customer | no live customers exist offline; absence-penalty without rage-quit losses |
| Occupation names | Accountant/CEO/Yokozuna… | our 105 original-register archetypes (§4) | catalog constraint; structure & tiers faithful — and doubles as the licensing-mandated rename (no verbatim Capcom names ship) |
| Cash tier $200–$2,000 | $100–$2,000 | higher floor | our Free tier is 30-deep (original ~11) |
| Start: 1 slot + Chef | 1 slot | same shape | faithful |
| No PvP-defense-by-default, censored gore, no "Brains" | same | same | fidelity confirmations |

---

## 15. Out of scope (reserved hooks)

- **Zombie combining** (4-merge marks) — `merges` reserved; progression's `Mastered` state anticipates it.
- **Raid integration** — Power consumption, DEAD/RAIDING, 8 h/1v revive, raid XP faucet: values defined here; raid spec implements against §0.1's derivation contract.
- **Premium chef heads** — economy-spec Toxin sink.
- **Pets assisting staff** — content spec.
- **Magic Fridge / Toxin-upgraded stoves / outdoor decor / seasonal event cafes** — cooking/progression/content territory; flagged to those owners as unlogged research items (see Review notes).

## 16. Art & audio assets needed

| Asset | Count / spec |
|---|---|
| Customer archetype sprites | Per the presentation spec's paper-doll rig (canonical character pipeline per review): 12 visual families × palette/prop variants covering all 105; per-occupation portraits (105, 128 px) for InfectCard/Zombiepedia. **CI check: every chars-manifest id exists in `zombies.json`** (presentation's cast list is regenerated from §4, not the original's roster). |
| Zombie conversion | green-tint sweep + per-family zombified texture |
| State animations | idle sway, shamble walk, cook-stir, carry-plate, daydream, collapse, feral-lunge, rest-walk — rig poses per presentation spec; engine emits `Dir` only |
| CENSORED bar | jittering black bar + feather/hat particles + bones prop (1 tile) |
| VFX | toxin puff, red vignette flash (reduced-motion-gated), level-up burst, refill liquid flash |
| SFX | syringe squelch, rise-groan, low-energy groan, plate clatter, feral sting, crunch ×3, panic screams, hook clank, rest snore, level jingle — all mirrored as toasts under the audio-cues-as-toasts setting |
| UI | vial icon, tier/role badges, energy bar 9-slice (+ ⚠ icon state), meat-hook rail, Zombiepedia silhouettes, Serum Barrel store card |

## 17. Build order (within this system; global sequencing per the master build order — the iso engine precedes this system, so no locomotion stubs)

1. `Speeds.ts` + `StaffStats` + `OccupationTable` + golden/reachability tests (pure data).
2. `StaffSim` energy/state machine + `OfflineStaff` (incl. availabilityTimeline) + tests (fake clock/RNG/pathfinder).
3. Save fields + ledger registration + typed-event registration.
4. `InfectionSystem` + InfectCard + input-mode registration + spawn-pool integration (replaces the passive roll; first `spendCoins`/`spendToxin` call sites) + the core-tutorial infect step.
5. RosterPanel + EnergyBar + Zombiepedia rendering (progression's state model) + empty states.
6. ZombieActor animations + feral choreography on the engine path-follower.
7. Serum Barrel + Playwright smoke + M7 modernization-bundle playtest + tuning pass against the progression ledger.

---

## 18. Review notes — critiques applied, and the two rejections

**Applied (all):** foreground-native re-derivation of every energy/daydream rate with published dual columns and the 12× invariant test (the COOKING-row and Focus-1 arithmetic errors are acknowledged and fixed); offline idle-pillar rescue via start/resume-only staffing with the mandated 12 h acceptance test; rating gates regenerated onto the canonical 0–100 scale and feral deltas moved into the rating canon (−6 live / −2 offline, defined once, owned by progression); slot ladder and zombie-level model declared single-authority here with raids' rival math deleted; zombie speed formula promoted to the shared `Speeds.ts` with customer constants set once; tips composition fixed as one multiplicative `DishMath` formula with this spec as the sole `Tips` source and the service shim's deletion made explicit; save-version integers stripped in favor of the ledger; events registered in the canonical registry with single payload definitions (`rating-delta` deleted in favor of `rating.addDelta`); Zombiepedia ceded to progression's 4-state model; the seated-only citation reclassified as a design choice and loosened to seated-or-queued, with all F-citations re-audited; daydream auto-resume made manual for low-Focus staff and the modernization stack scheduled for a bundle playtest; the straight-line locomotion stub workstream deleted; the character-art plan re-anchored to the presentation spec's rig pipeline with a manifest↔catalog CI check.

**Missing-items landed here:** Industrial Barrel of Zombie Serum (§9.4, 50v endurance sink); input-mode arbitration for the infect tap (§10.3); OfflineEngine sequencing contract via availabilityTimeline (§7.4); pause/hidden-tab semantics adoption (§6.1); steppable-clock test harness contract with a prod guard (§6.1, §13); empty-state UX for roster/locker/Zombiepedia (§9.2, §11.3); i18n string centralization (§0.2); settings hooks for classic-daydream/reduced-motion/audio-toasts (§0.2, §7.3); the occupation-roster rename explicitly credited as the licensing fix for character names (§14).

**Missing-items flagged to their owning specs (not duplicated here):** Magic Fridge free-dish-per-day and Toxin-upgradeable special stoves → service loop/progression; friends-layer substitute (third recipe path + friend-milestone Toxin replacement faucet) → progression's ledger and recipe-source design; outdoor decor and seasonal/event cafes → content/progression; original 2011 dish names → the reconciled dish generator (this spec's §10.4 economy examples now cite that canon).

**Rejected critique 1 — canonize the 0–1000 rating scale (engine reviewer).** Two of three reviewers, and the substance, favor progression's 0–100 S+D+B: it is the only model that wires furniture `happinessBonus` at researched magnitudes, models bonus-star persistence, and carries the researched away-decay/star-blink hook. Regenerating this spec's gates onto 0–100 was mechanical (§4.6). The 0–1000 model's fully-enumerated per-delivery deltas are preserved by restating them on 0–100 in the service spec, per the rating canon.

**Rejected critique 2 — remove serving throughput from the activity clock (engine reviewer).** Research dim 4 explicitly includes serving in the foreground acceleration, and the superfan reviewer's reconciliation keeps it there. The desync the engine reviewer feared (coin payouts on real time vs serving on 12×) dissolves under the rev. 2 framing: there is exactly one activity clock, foreground is its native 1× rate, and coins are paid on delivery events which ride that same clock; offline serving income is computed solely by the OfflineEngine's service settler (consuming our availabilityTimeline), so no second live clock ever touches it. Cook timers remain wall-clock, exactly as the reviewer required.

**Rejected critique 3 (partial) — "service spec owns the XP curve, cap 20" (engine reviewer).** Overridden by the other two reviewers and the reconciliation direction: progression owns cafe level (cap 22) and the XP model; this spec's gates were validated against 22. Recorded here so the implementer does not resurrect the cap-20 curve from the service spec's older text.

## Acceptance criteria

- [ ] Golden derivation test: all 105 zombies.json entries produce exactly the committed §4 tables (stats, costs, Lv gates, R gates on the 0-100 scale); stat ranges En 70-320, Sp 2-12, Pw 1-12, Tp 1-12, Fo 1-12.
- [ ] Reachability CI: every occupation has unlockLv <= 22 (progression cap) and minRating <= 68, and appears in some spawn pool at (L22, R68); tier weights normalize at R in {0, 50, 100}.
- [ ] Energy invariant: for every activity, foreground drain/regen per real second equals exactly 12x the background rate; energy never leaves [0, maxEnergy].
- [ ] Endurance design tests: a 90-energy commoner sustains >= 100 real foreground minutes of COOKING and >= 40 of SERVING before feral; Serum Barrel multiplies drain rows (only) by 0.8.
- [ ] Idle-pillar AC: a fresh 90-energy commoner staffing a 12h cook fully offline completes the cook with zero incidents (ends ~42 energy); a 72h offline cook completes with exactly one -2 rating incident and the zombie EXHAUSTED+mustRest.
- [ ] Offline settler is deterministic (same state+elapsed => same result), no-ops on negative elapsed, and exports an availabilityTimeline whose working intervals integrate to the applied drain; the service settler consumes it for offline throughput.
- [ ] Daydream calibration: Focus 1 mean interval is 80-100 real foreground seconds; Focus <= 4 zombies never auto-resume (manual tap only); Focus >= 5 auto-resume after 25s; no daydream rolls during offline settlement.
- [ ] Feral flow: energy <= 0 in any working state triggers FERAL_SEEK; victim consumption restores 20% max energy and emits exactly one rating delta via rating.addDelta(RATING.feralLive) (canonical -6 on the 0-100 scale); no customers present leads to EXHAUSTED; Toxin refill is unusable mid-FERAL_ATTACK.
- [ ] Infection rules: free/cash/toxin deduction paths verified; insufficient funds emits infection-blocked('funds'); placement cascades slot -> hook -> blocked-with-reason; duplicates allowed; queued (stationary) customers infectable, walking/fleeing not; infection never grants currency.
- [ ] Input arbitration: with a zombie selected (dispatch mode) a tap on a customer never opens the InfectCard; InfectCard only opens from neutral mode and dismisses on outside tap/Esc/mode change.
- [ ] Single-authority contracts hold in CI: raids derive raidHP from this spec's maxEnergy(level) (shared fixture file, cap 15); all movement speeds import from src/sim/movement/Speeds.ts; payment uses the one DishMath composition perServing x (1 + 0.06 x Tips) x ratingMult(R) with a 3-zombies x 3-ratings golden test; no rival slot ladder, tips formula, or zombie-level model exists in the codebase.
- [ ] Save discipline: this spec's fields land under the version integer assigned by the build-order save ledger (no hardcoded version in this system's code); legacy-shape migration fixture passes and is idempotent; task.stoveId survives an engine moveItem (placement ids stable).
- [ ] Level model: xpToNext table exact; +5% base energy per level with cap 15 (L15 Singularity maxEnergy = 544); +1 Speed at 5/10/15; energy refills to new max on level-up.
- [ ] Zombiepedia renders progression's 4-state collection model (no local state machine); spawn fires Sighted; empty states render for 0/105 Zombiepedia, empty Meat Locker, and Chef-only roster.
- [ ] Playwright smoke (chromium + WebKit per infra spec): boot -> infect a Free commoner -> roster count +1; debug-forced feral -> CENSORED bar visible -> rating-drop toast; long-timer steps driven via the injected steppable clock, which is build-guarded out of production bundles.
- [ ] Performance: StaffSim tick is O(active <= 14 + chef) with zero allocations in the 250ms-interval energy path; daydream uses next-event timestamps; RosterPanel virtualizes beyond 30 cards.
