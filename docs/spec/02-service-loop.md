# Complete Service Loop (stoves, burn windows, serving, seats, patience, star rating)

> Status: **revised after adversarial review** — where this conflicts with `00-canon.md`, canon wins.

# Deadbeat Diner — Complete Service Loop Specification

**System:** Stoves, burn windows, servings, tap-to-dispatch serving, seats, customer patience, star rating (consumer)
**Status:** Implementation-ready design (spec v2.0 — post hostile-review reconciliation)
**Fidelity source:** `original_game_research.json` (dimensions 0, 3, 4, 5) — all mechanics below cite it
**Owner pillars honored:** #1 fidelity, #2 hybrid pacing, #3 no IAP / earned-only Toxin, #4 built on the isometric tile foundation

---

## 0. Canon & authority map (READ FIRST)

This revision's root cause of failure was restated constants. This spec now **owns** some things and **consumes** everything else by reference. No number owned elsewhere is restated as a value in this document — only as a canon key.

| Domain | Single owner | This spec's role |
|---|---|---|
| Star rating model, scale, decay, decor bonus, bonus stars | **Progression spec** — `R = clamp(S+D+B, 0, 100)`, shown as R/20 stars | Emits per-delivery **S-deltas** (proposed in §10, ratified into the rating canon); consumes `RatingSystem` |
| Cafe XP curve, level cap (22), dish `totalXP` formula, `unlocks.json` | **Progression spec** — `totalXP = max(1, round(0.62 · cookMinutes^0.69))`, 21-row curve | Emits XP on delivery (100%, §6.2); generator consumes the formula |
| Cookbook structure (97 General / 9 themed × 21 / 34 rare), unlock ladder | **Progression spec** (counts are **generator inputs** here, CI-asserted) | Generator assigns `cookbookId` from `unlocks.json` |
| Toxin ledger: every faucet, every sink, every price (instant-finish, un-burn, Magic Fridge, stove upgrades) | **Progression spec §5.4** | Registers its sinks there; consumes prices by key |
| Save-version numbers, migration chain, fixtures | **Build Order ledger** (`docs/spec/save-ledger.md`) | Lists field *additions* only; "lands at the service milestone's version per ledger" |
| Grid, pathfinding, placement ids, door, expansion ladder, `starterLayout.json`, IsoConfig (tile 128×64 etc.) | **Iso Engine spec** (contracts in `src/engine/contracts.ts`) | Consumer; states hard invariants the starter layout must satisfy (§7.4) |
| Zombie stats (Tips, Speed, energy), level cap, StaffStats derivation, activity clock (12×) | **Infection/Staff spec** | Consumer; interim shim in §4.3 is DELETED at the staff milestone |
| Character/actor speeds | **Staff spec** formula `zombieTilesPerSec = 0.45 + 0.09 · Speed`; customer constants in the speed canon module | Consumer (`src/sim/speed.ts` exports; other specs deleted their formulas) |
| Typed event names/payloads | **Shared events registry** (`src/core/events.d.ts` + `docs/spec/events.md`) — specs may ADD, never rename | This spec's §3.4 events are registered there; `plate-delivered` is the canonical delivery event; `serving-delivered`/`dish-collected` are deleted from other specs |
| Tuning constants | **`src/sim/tuning.ts` + `docs/spec/canon.md`** — the ONLY place values are written; CI diff-checks canon ↔ tuning ↔ `Tools/artconfig.json` | Tables in this doc are **proposals ratified into canon**, cited by key thereafter |
| Offline settlement sequencing | **Shared `OfflineEngine`** (`docs/spec/simulation-core.md`) | Registers the service settler; execution order in §12.1 |
| Input-mode arbitration | **Shared `InputRouter`** (`docs/spec/input-modes.md`) | Registers DISPATCH mode; behavior in §3.5 |

---

## 1. Purpose and scope

This spec designs the loop that *is* Zombie Cafe:

> Tap stove → pick a dish from the cookbook → **pay its price in Cash up front** → a staffed zombie cooks it in real time → the finished dish **sits on the stove** with a **burn countdown** → you **tap a zombie, then tap a counter, table, or sink** → the server ferries plates **from the stove** to seated customers → **coins arrive per serving, on delivery** → dirty plates go to the sink → happy/sad thought bubbles feed the **star rating**, which controls who walks in next.

It replaces, wholesale, the current build's two fake coin faucets:

* `Stove.collect()` minting `coinReward` on a stove tap (`src/game/Stove.ts:96-104`) — **deleted**.
* `Customer.eat()` auto-paying a dish-independent tip (`src/game/Customer.ts:54-66`, tip formula at `src/scenes/CafeScene.ts:129`) — **deleted**.

After this spec ships, gameplay coin income flows only through the enumerated faucet allowlist (§6.3).

### In scope
Stove state machine (pay/staff/cook/pause/ready/serve-down/burn), serve-from-stove flow, tap-to-dispatch server AI with priority task queue, seat capacity from table+chair adjacency, customer lifecycle FSM, patience/thought bubbles, rating S-delta emission, Dish v2 data model, the 320-dish retune (original-name spine, hybrid bands to 72h), offline settlement via the shared OfflineEngine, return hooks (tab title/favicon/notifications), soft-lock pity, furniture-lifecycle interaction matrix, save field additions, UI panels, typed events, input-mode registration, SimClock test harness, tests.

### Out of scope (adjacent specs, interfaces defined here)
* **Infection** (tap-customer infect): hooks on `SEATED_*` states; occupation tier table and its rating gates (regenerated onto the 0–100 scale) live there.
* **Zombie energy / daydream / feral**: `IEnergyHook` emitted here; drain/feral logic and the 12× activity clock are the staff spec's. Feral's rating delta value lives in the rating canon.
* **Recipe variations, rare raid dishes**: schema carries `cookbookId` + `variant`; drops are the Raids spec's.
* **Isometric foundation**: consumed via `src/engine/contracts.ts` (§3.3).
* **Store / decor / special machines**: passive-income machines and stove-upgrade purchase UI are the store spec's; the stove-modifier hook they drive is §5.7.

---

## 2. Fidelity contract vs the original

| Original mechanic (research cite) | This spec | Deviation & why |
|---|---|---|
| Pay dish Price in Cash **before** cooking; coins only from servings sold (research[0] mech 0, commonlyMissed 1-2) | Identical | None |
| Six-attribute dish block: Level, Price, Cook Time, Servings, Total Earnings, Total XP (research[0] mech 1) | Identical schema | Values retuned to hybrid bands (§11); curve *shape* preserved; XP column from Progression's validated formula (2m→1XP, 1d→95XP anchors) |
| Cook timers 2min–3days | **15s–72h** | Pillar 2 hybrid: early loop compressed; **1–3-day overnight bets restored** at L20–22 (prior 12h cap was a fidelity regression — fixed) |
| The original menu (Mystery Meat, Sloppy 'Joe', Escargut…) | **Restored as the 97-dish General spine** (§11.1) | Repo pun names move to themed/rare book filler; licensing contingency via alternate-name column (§11.1) |
| Finished dish **sits on the stove**, served from there; stove occupied until batch exhausted or burns (research[0] mech 0/3) | **Identical — counter-batching from spec v1 is deleted** | The v1 "counters are the safe zone" claim was an uncited invention; reverted per review |
| Burn window 5×/4×/3× cook time by band (≤5min / 6–30min / 31min+; research[0] concreteNumbers 9) | Identical bands on retuned times, plus a **90s floor** | Floor is a logged usability modernization (mis-tap trap removal) |
| Burn destroys the (remaining) dish, price forfeited, applies while app closed (research[4] mech 2) | Identical; partial batches lose remaining servings | **Un-burn mercy** added: 1 Toxin restores a BURNT batch to READY with 50% window (logged modernization; priced in the Toxin ledger) |
| Chef/zombie staffs the stove for the whole cook; pausable; Toxin instant-finish (research[0] mech 0) | Identical | Instant-finish price = one formula in the Toxin ledger |
| Tap-to-dispatch: tap zombie → tap **counter, sink, or table**; auto-ferry; freeze when blocked (research[0] mech 3) | Identical — **table target added** (v1 omitted it) | None |
| Seats = table+chair sets cap concurrent customers (research[0] mech 3) | Identical, grid adjacency | None |
| Bubbles drive rating; rating drives customer volume/quality; Level and Rating separate meters (research[0] mech 9; research[3] cM 1) | Identical; rating model owned by Progression (0–100 S+D+B); **rating multiplies tips** (§6.2) and gates better-tipping tiers via infection | None |
| Rating decays on neglect; stars blink green/red on return (research[3] lookAndFeel) | **Consumed** — decay formula is Progression's; welcome-back report shows the away-rating blink (§12.5) | v1's "no passive decay" claim is retracted |
| Foreground sim ~10–15× faster than closed (research[4] mech 3) | Two-clock model (§3.2): cook/burn/patience real-time; energy/daydream on the staff spec's 12× activity clock. Live serving is real-time animated | The researched accel applied to energy and serving rates; our live loop is the "fast side" by construction. Offline serving settles at **1×** of the live model — the v1 25% nerf is deleted |
| Offline: cooking continues, a dispatched zombie serves it (research[4]) | Identical: dispatched servers sell from READY stoves during the burn window while away (§12.2) | None |
| Three recipe sources: leveling, raids, **ordering from friends** (+ friend-milestone Toxin) | Leveling + raids + **Catering Ledger** substitute (progression-owned quest line awarding themed recipes + Toxin); friend-milestone Toxin replaced by Zombiepedia collection milestones | **Logged deviation**: no backend, so the social path gets a single-player replacement instead of silent deletion |
| ~760 plates/hour peak measured throughput (research[4] mech 1) | Serve-from-stove topology + spawn-table ceiling caps endgame at ≈450/hr (§8.5) — same order of magnitude | v1's 7,800/hr was a topology artifact; fixed by the reversion |
| Currencies Cash + Toxin, never "Brains" (research[1] cM 0) | `cash`/`toxin` throughout; migration `toxin = min(brains, 99)` (player-friendly mapping, one rule, stated once) | Fidelity fix |
| Servers "stand motionless" when blocked | Identical + "blocked" emote | Logged readability modernization |

**Modernization-stack note (bundle risk):** daydream auto-resume + auto-task-loop servers + patience grace + pity grants individually pass review but jointly erode the original's constant-re-tasking texture. They are play-tested **as a bundle** at the service milestone; the cheapest fidelity lever (long/low-Focus-disabled daydream auto-resume) is the staff spec's knob and is flagged there.

---

## 3. Architecture

### 3.1 Layering

```
src/sim/            PURE TypeScript. Zero Phaser imports (ESLint no-restricted-imports,
                    boundary covers src/sim/** including any raid subtree).
  ServiceSim.ts     Orchestrator: entities, tick(dtMs), command API, layout-change ordering
  StoveSim.ts       Stove FSM (§5)
  SeatIndex.ts      Table+chair adjacency → seats (§7)
  CustomerSim.ts    Customer FSM (§8)
  ServerSim.ts      Server modes + task execution (§9)
  TaskQueue.ts      Claim-based priority arbitration (§9.3)
  DishMath.ts       Burn bands, per-serving math, the ONE payment formula, XP accrual
  speed.ts          Speed canon: zombieTilesPerSec(Speed), CUSTOMER/ANGRY constants
  OfflineSettle.ts  Service settler registered with the shared OfflineEngine (§12)
  SimClock.ts       Injected clock contract + test harness (§3.6)
  tuning.ts         Canon values (single write location; mirrored in docs/spec/canon.md)
  types.ts          Entity types; events re-exported from the shared registry

src/game/           Phaser VIEWS only: StoveView, CustomerView, ServerView, BubbleView.
src/ui/             CookbookPanel, StovePanel, WelcomeBackModal, StarMeter (consumer), Hud.
```

Consumed rating logic (`RatingSystem`) lives with the Progression spec's code; this spec calls `rating.applyServiceDelta(key)`.

### 3.2 The time model (two clocks, stated once)

| Clock | Drives | Never drives |
|---|---|---|
| **Wall clock** (`Date.now()`), read only at save-write and settlement | Absolute `readyAtUtc` / `burnAtUtc` stamps; offline elapsed | — |
| **Real-time sim clock** (`SimClock`, 100ms fixed-step accumulator on `performance.now()`) | Cook progress display, burn countdown, patience, movement, spawns, eating | — |
| **Activity clock** (staff spec, `ACTIVITY_TIME_SCALE = 12`, foreground only) | Zombie energy drain/regen, daydream timers | **Cook timers and burn deadlines are NEVER scaled** — by any clock, in any build. Serving throughput is NOT on the activity clock: live serving is literally animated actors |

`DEMO_TIME_SCALE` (`src/config.ts:18`) is deleted; the Build Order's global `FOREGROUND_TIME_SCALE` is deleted (amendment filed there). All authored times are real seconds.

**MAX_LIVE_CATCHUP:** if the fixed-step accumulator holds > 5s of un-ticked time (browser throttling, GC stall, sleep without `visibilitychange`), the excess does **not** replay live: live customers despawn without rating deltas, the excess elapsed routes through `OfflineSettle`, then live ticking resumes. Unit test: inject a 60s frame gap, assert zero angry-leave rating deltas.

### 3.3 Contracts consumed from the isometric foundation

Imported from **`src/engine/contracts.ts`** (the engine's real published signatures — v1's invented `src/iso/` names are corrected):

```ts
interface ICafeGrid {
  walkable(t: Tile): boolean;
  placements(filter?: FurnitureTypeLabel): PlacementInfo[];  // 'table'|'chair'|'counter'|'sink'|'stove'
  footprint(placementId: string): Tile[];
  door(): Tile;
  canRemove(id: string): RemoveVerdict;    // sim supplies the veto hook (§7.3)
  onLayoutChanged(cb: (e: LayoutChange) => void): Unsubscribe; // single batched event per mutation
}
interface IPathfinder {
  findPath(from: Tile, to: Tile): PathResult;   // { ok:true, tiles } | { ok:false } — blocked = authentic freeze
  pathCost(from: Tile, to: Tile): number | null;
}
```

Movement is **4-connected** everywhere (engine canon; no diagonals, no corner-cut rules exist to match).

**PlacementId stability is a hard dependency:** `seatId`, `SavedStove.stoveId`, dispatch homes, and bus-task claims key off placement ids. The engine's PlacementSession **move must be id-preserving** (`moveItem`), never remove+re-place. This spec's tests include a moved-mid-cook stove fixture asserting cook state survives.

**No shipped stub:** v1's `StubGrid.ts` workstream is deleted — the Build Order sequences the engine before this system. Unit tests use a ~10-line in-test fake implementing the two interfaces; no adapter file ships.

### 3.4 Typed events (registered in the shared events registry)

This spec registers (may not be renamed by any other spec):

```ts
'cook-started'    { stoveId; dishId; pricePaid; readyAtUtc }
'cook-paused'     { stoveId; remainingMs }
'cook-resumed'    { stoveId; readyAtUtc }
'dish-ready'      { stoveId; dishId; burnAtUtc; servings }
'dish-burnt'      { stoveId; dishId; servingsLost; lostCash }     // partial batches report remaining
'dish-unburnt'    { stoveId; toxinSpent }
'plate-picked-up' { serverId; stoveId }
'plate-delivered' { serverId; customerId; dishId; cash; tip; xp } // THE canonical delivery event
'plate-bussed'    { serverId; sinkId }
'seat-claimed'    { customerId; seatId }
'customer-left'   { customerId; mood; reason: 'served'|'no-seat'|'starved' }
'server-blocked'  { serverId; taskKind }
'server-dispatched' { serverId; mode; homeId }
'xp-gained'       { amount; total }                               // consumed by Progression
'offline-report'  OfflineReport                                   // §12.5
'notify'          { text }
```

`rating-changed`, `cafe-level-up`, `cash-changed`, `toxin-changed` are owned by Progression/Economy in the registry; this spec subscribes. `serving-delivered` and `dish-collected` are deleted registry-wide (there is no collect-tap; see §6.2).

### 3.5 Input-mode registration

Registered with the shared `InputRouter` (mode stack: `DEFAULT < DISPATCH < PANEL < PLACEMENT`):

* Tapping a zombie enters **DISPATCH**. While active: taps on counter / table / sink / READY stove / walkable floor resolve per §9.1; tap the selected zombie or Esc cancels; tapping **another zombie** switches selection; tapping a **customer deselects and does nothing else** (never opens the infect card on the same tap — prevents accidental infects; a second tap opens it); opening any panel cancels DISPATCH.
* PLACEMENT (edit mode) suspends DISPATCH and customer taps entirely.
* PANEL (any modal) captures all pointer input; the sim-pause rule for modals is §12.3.

### 3.6 SimClock test harness (replaces DEMO_TIME_SCALE for CI/dev)

```ts
interface SimClock { nowUtc(): number; monotonicMs(): number }
```

Production injects `RealClock`. Vitest injects `TestClock` with `advance(ms)`. The Playwright harness build (`vite --mode test-harness`) exposes `window.__sim = { advance(ms), snapshot() }`; a `import.meta.env` guard plus a CI grep of the production bundle assert `__sim` is **unreachable in production**. CI smokes "cook Mystery Meat → `advance` → dispatch → deliver" and "12h cook survives settle" without wall waiting.

---

## 4. Data model

### 4.1 Dish schema v2 (replaces `src/data/types.ts:6-13`)

```ts
export interface Dish {
  dishId: string;
  displayName: string;      // fidelity name set (§11.1)
  altName?: string;         // licensing-clean alternate; NAME_SET build flag selects column
  level: number;            // cafe level gate, 1..22 (cook AND serve; research[0] mech 4)
  price: number;            // Cash deducted at cook start
  cookTimeSeconds: number;  // real time
  servings: number;         // plates; each feeds exactly one customer
  totalEarnings: number;    // = perServing * servings (integer by construction)
  totalXP: number;          // from Progression's formula; fractional accrual on delivery
  cookbookId: string;       // assigned from Progression's unlocks.json (97/9×21/34 CI-asserted)
  requiresStoveType?: string; // special-stove cookbooks (research dim 0); default any stove
  variant?: string;         // raid-variation slot (Raids spec fills)
  iconKey: string;
}
```

Dropped: `coinReward`, `brainReward`, `cafeLevelRequired` (renamed `level`). **Validator** (`src/data/validateCatalog.ts`, boot-dev + vitest): all fields present; `price ≥ 1`; `servings ≥ 4`; `totalEarnings > price`; `totalEarnings % servings === 0`; cook time within its level band (§11.2); ids unique; cookbook counts match the generator inputs; every `requiresStoveType` exists in furniture data; every reachable dish has an icon or the specced placeholder icon.

### 4.2 Save field additions (version number assigned by the Build Order ledger)

This spec **adds fields**; it does not claim a version integer. Ledger entry: "service-loop fields land at the service milestone's version bump."

```ts
// additions:
cash: number;                 // renamed from coins
toxin: number;                // renamed from brains; MIGRATION (one rule): toxin = min(brains, 99)
ratingScore ... OWNED BY PROGRESSION (S/D/B fields live in its schema section)
stoves: SavedStove[];
dirtyPlates: string[];        // seatIds
favorites: string[];          // max FAVORITES_MAX
magicFridge?: { lastFreeCookUtc: number };   // §5.8, present once purchased
lastSaveUtc: number;
// DELETED: idleCoinsPerSec (drip model gone), SavedCounter (counter-batching gone)

interface SavedStove {
  stoveId: string;            // grid placement id (id-preserving moves required, §3.3)
  state: 'idle'|'cooking'|'paused'|'ready'|'burnt';
  dishId: string | null;
  zombieId: string | null;
  cookStartUtc: number | null;
  pausedRemainingMs: number | null;
  readyAtUtc: number | null;  // burnAt = readyAt + burnWindow*1000
  servingsLeft: number;       // decrements as plates are taken (serve-from-stove)
  xpAccrued: number;          // fractional XP accumulator for this batch
}
```

Fresh-save values (`STARTING_CASH`, `STARTING_TOXIN`, starting S component) are canon keys; proposals: 300 cash (first cookbook choice is a real budget decision), 5 toxin (research[1] concreteNumbers 4), S = 15 (Progression's value). Progression regenerates its first-two-hours walkthrough from these canon keys with an assumed-constants header so drift is visible.

**Storage durability (consumed from the save-format spec, required by this spec at its milestone, not M11):** quota/write failure → toast + auto-download of save JSON; storage disabled → in-memory session + persistent banner; corrupt save → "download broken save" offered before any wipe; `navigator.storage.persist()` requested; export/import buttons in settings from the layout milestone. Fault-injection tests use a throwing storage stub. SavedStove absolute timestamps must survive export/import byte-exact.

### 4.3 Zombie serving stats — interim shim (DELETED at the staff milestone)

Until StaffStats lands, derive from `src/data/zombies.json`: `Tips = clamp(2 + 2·rarityIndex, 1, 12)`, `Speed = 3 + 2·rarityIndex`. This mapping file is explicitly a shim: the staff-spec landing **deletes it** and `DishMath`/`speed.ts` consume real StaffStats. Carry capacity is 1 plate per trip (fidelity), permanent.

---

## 5. Stoves: pay-then-cook, staffing, pause, burn

### 5.1 State machine

```
            pay price, staff assigned
   IDLE ───────────────────────────────► COOKING ◄──────────┐
    ▲                                       │    resume      │
    │ tap-to-clear / unburn(1 Toxin)        │ unstaff/pause  │
    │                                       ▼                │
  BURNT ◄──────────── READY ◄────────── PAUSED ──────────────┘
         burn deadline    cook timer
         (servings>0)     completes
                 READY ──(last serving delivered)──► IDLE
```

| State | Behavior | Exits |
|---|---|---|
| `IDLE` | Tap opens CookbookPanel | → COOKING (dish chosen, price paid, zombie staffed) |
| `COOKING` | Absolute `readyAtUtc`; steam FX; progress ring; staffer locked `assignment:'kitchen'` at the stove's work tile, cook-stir anim; `IEnergyHook.onCookingTick` | → READY · → PAUSED (player pause / zombie removed) |
| `PAUSED` | `pausedRemainingMs` frozen; no burn risk; zombie freed | → COOKING (re-staff; `readyAtUtc = now + pausedRemainingMs`) |
| `READY` | **The batch sits on the stove and is served from here.** Burn ring (green→amber→red at <`BURN_RED_THRESHOLD`); servings chip shows `servingsLeft`; stove remains occupied — no new cook until exhausted or burnt (fidelity: stoves are the production cap) | → IDLE (`servingsLeft` hits 0) · → BURNT (deadline passes with `servingsLeft > 0`, live or offline) |
| `BURNT` | Pot blackened, smoke, sad-trombone; `dish-burnt {servingsLost, lostCash}` (partial batches lose the remainder; price was sunk at cook start — no refund) | → IDLE (tap to scrape, free) · → READY (**un-burn mercy**: 1 Toxin — ledger key `TOXIN.UNBURN` — restores `servingsLeft` with 50% of a fresh burn window; adopted per review as on-pillar friction removal) |

**Cook start (atomic):** level gate (`dish.level ≤ cafeLevel`) → `requiresStoveType` gate → affordable (or Magic Fridge token, §5.8) → assignable zombie → `spendCash(price)` → stamp `cookStartUtc`/`readyAtUtc` → `cook-started`. **No auto-restart** — re-selection is the strategic beat (research[4] mech 4).

### 5.2 Staffing rules

As v1: stove cooks only while staffed (research[0] mech 0); removing the zombie auto-pauses; `cookSpeedMult` applies at cook start against the dish's base time; burn window computes from the **base** cook time (fast cooks aren't punished). Working-slot counts and zombie level caps are the **Infection spec's** ladder — nothing restated here.

### 5.3 Pause / resume

Only from `COOKING`. **READY cannot be paused** — the burn clock is the point (research[0] mech 2); StovePanel greys the button: "Too late to pause — serve it!"

### 5.4 Burn windows (the offline cap)

```ts
burnWindowSeconds(T) = max(90, (T <= 300 ? 5 : T <= 1800 ? 4 : 3) * T)
```

Original bands exactly (research[0] concreteNumbers 9) + 90s floor (logged modernization). Burn applies while the tab is closed (§12) — absence isn't capped, it's *penalized*, exactly like the original. Burn is **wallet-only: no rating penalty** (recorded in the rating canon; no source shows a star hit for burning).

### 5.5 Energy hook

`IEnergyHook { onCookingTick(zombieId, dtMs); onServeTrip(zombieId) }` — default no-op; staff spec swaps in the real drain on its 12× activity clock without touching this system.

### 5.6 Toxin instant-finish

Button while `COOKING`/`PAUSED`; jumps to `READY` with a full burn window. **Price: one formula, one location — the Toxin ledger** (key `TOXIN.INSTANT_FINISH`; registered proposal: `clamp(ceil(remainingHours × 0.75), 1, 8)` vials). This spec's v1 tier table and all other specs' prices are deleted in favor of the ledger row.

### 5.7 Special-stove modifiers (fidelity: Toxin-upgraded stoves)

Research dim 0: some cookbooks require special stoves bought with Cash and **upgraded with Toxin**. Mechanic hook (purchase/upgrade UI is the store spec's; prices in the Toxin ledger): stove furniture entries may carry

```ts
stoveMods?: { cookSpeedMult?: number; burnWindowMult?: number; stoveType?: string }
```

`StoveSim` applies `cookSpeedMult` at cook start and `burnWindowMult` to §5.4's output; `stoveType` satisfies `requiresStoveType` gates. Toxin upgrade tiers improve the mods — a real earned-Toxin sink restored.

### 5.8 Magic Fridge (restored researched item)

Special-tab purchase (30 Toxin — ledger key `TOXIN.MAGIC_FRIDGE`): grants **one free cook per day** (research: "gives one free dish/day"). Implementation: if `now − magicFridge.lastFreeCookUtc ≥ 20h`, the CookbookPanel shows a glowing "Fridge special — free" badge; choosing any unlocked dish waives `price` and stamps the token. One token, no banking.

---

## 6. Serving from the stove: payment on delivery

### 6.1 Flow (original topology — v1's counter-batching deleted)

1. Cook completes → the batch (`servings` plates) sits on the stove in `READY`, burn clock running against the **whole remaining batch**.
2. Player dispatches servers (tap zombie → tap counter / table / sink / READY stove, §9.1).
3. A `SERVING`-mode server loops: walk to a READY stove → take **1 plate** (`servingsLeft−−`) → deliver to a seated `WAITING_FOOD` customer → **payment on delivery** → repeat.
4. `servingsLeft` hits 0 → stove → `IDLE`, `xpAccrued` remainder flushes. Deadline hits first → remaining servings burn (§5.1).

**Counters** are dispatch anchors and decor (their `happinessBonus` feeds the rating's D component via the store spec) — they hold no batches and stop no burn clocks. The overnight play is the original's: *return within the burn window and dispatch*, not "park it somewhere safe."

### 6.2 Payment & XP — the ONE formula (`DishMath`)

```ts
perServing = dish.totalEarnings / dish.servings;                    // integer by construction
payment    = round(perServing * (1 + 0.05 * Tips) * (1 + R / 200)); // Tips 1–12 from StaffStats;
                                                                    // R 0–100 from the rating canon
tip        = payment - perServing;                                  // reported in 'plate-delivered'
xpPerServe = dish.totalXP / dish.servings;                          // fractional accrual on the stove batch
```

This is the composition rule the three specs lacked: **base × tips-mult × rating-mult**, replacing the staff spec's `1+0.06·Tips`, this spec's v1 `0.05·tipsStat` additive, and standing alone as Progression's `1+R/200` consumer. Golden test: 3 zombies × 3 ratings. It also closes the researched loop *inside this spec*: higher rating → better tips directly, and better-tipping customer *types* via the infection tier gates.

**XP: 100% on delivery, pro-rata.** There is no collect-tap in the serve-from-stove topology, so Progression's 30%-on-collect share is deleted (amendment filed there); the interaction model is stated identically in both specs. Level-ups are Progression's (`unlocks.json`, cap 22); this spec only emits `xp-gained`. `CafeScene.maybeLevelUp` (infection counting) is deleted.

### 6.3 The coin-faucet allowlist (reworded AC)

`Economy.addCash` gameplay callers, lint-enforced enumerated allowlist: `ServeSystem.deliver` (this spec), `OfflineSettle`, raid loot (Raids spec), special-machine passive income (store spec), quest/catering rewards (Progression). Nothing else — the v1 "single faucet" absolutism was self-contradicted by the plan's own raid/quest income.

### 6.4 Soft-lock pity (0-cash dead end)

Invariant: **no reachable state has zero income paths.** When `cash < cheapest unlocked dish price` AND no stove is `COOKING/PAUSED/READY` AND no Magic Fridge token is available, the Union Rep toasts and grants a **free cook of the cheapest unlocked dish** (gag-flavored: "the union covers staff meals"), once per triggering condition. Unit test walks the trap state and asserts recovery. (Furniture sell-back at 50% is the store spec's decision; the pity floor here does not depend on it.)

---

## 7. Seats: table+chair adjacency

### 7.1 Seat derivation

Unchanged from v1 in substance: a **seat** = a `chair` placement orthogonally adjacent (4-neighborhood) to any tile of a `table` footprint, with a walkable `serviceTile` and reachability from the door. Chair adjacent to two tables binds to the nearest (tie: lowest placementId). Unreachable/walled-in chairs seat nobody — layout is gameplay.

### 7.2 Dirty plates

Customer leaves after eating → seat `dirty` (plate sprite); `dirty` seats can't be claimed; servers bus to a **sink** (instant wash, drop target). No sink → plates silt up capacity — why sinks exist.

### 7.3 Furniture lifecycle × live sim (interaction matrix — new)

Enforced via the grid's `canRemove(id)` veto hook, which `ServiceSim` supplies:

| Action | Rule |
|---|---|
| Store/sell/move a stove in `COOKING/PAUSED/READY/BURNT` | **Blocked**, toast "finish, scrape, or serve first" (move via id-preserving `moveItem` is allowed for `IDLE` only) |
| Remove a chair/table under a `claimed/occupied` seat | **Blocked** until the customer leaves ("someone's sitting there!") |
| Remove a sink mid-bus-trip | Allowed; in-flight bus task releases, server re-arbitrates; if no sink remains, bus tasks are ungenerated |
| Remove a counter/table a server is homed to | Allowed; server's mode clears to `IDLE_AT` its current tile with a shrug emote |
| Any in-flight task whose target placement vanishes | Task claim released; server re-arbitrates next tick |

### 7.4 Layout-change ordering (expansion, door relocation)

The grid emits **one batched `onLayoutChanged`** per mutation (place/move/remove/expand/door-move). `ServiceSim` handles it in a fixed synchronous order: (1) `SeatIndex` rebuilds (seat set, service tiles, door-reachability); (2) `TaskQueue` revalidates every claim against the new index (invalid → release); (3) in-flight movers replan from their current tile (unreachable → authentic freeze). Consumers therefore never observe a frame where a claim references a dead seat. Test: expand + door-relocate fixture asserts no dangling seatIds and no double-claims.

**Starter-layout invariants (CI test against the engine-owned `starterLayout.json`):** ≥2 stoves, ≥1 counter (tutorial dispatch beat), ≥1 sink, ≥3 seats, all stations reachable from the door. The layout itself, expansion ladder, and door edge are the Iso Engine spec's; this spec only asserts the invariants.

---

## 8. Customer lifecycle FSM

### 8.1 States (unchanged shape from v1)

`SPAWNED → ENTERING → SEEKING_SEAT → (QUEUING ≤ QUEUE_PATIENCE_S | claim) → SEATED_ORDERING (ORDERING_S) → WAITING_FOOD (≤ FOOD_PATIENCE_S) → EATING (EATING_S) → LEAVING`; failures → `LEAVING_ANGRY (reason: 'no-seat' | 'starved')`; any `SEATED_*` → `INFECTED` (infection spec takes the entity; seat freed clean — they became staff, not diners). One customer eats exactly one serving (research[0] cM 2).

Canon-key durations (proposals): `QUEUE_PATIENCE_S 20`, `ORDERING_S 2`, `FOOD_PATIENCE_S 45`, `EATING_S 8`, `QUEUE_MAX 2`. Customer speeds from the speed canon: `CUSTOMER_TILES_PER_S 1.6`, `ANGRY 2.1` — one definition, faster than the fastest zombie shamble (1.53 t/s from the staff formula): humans stride, zombies shuffle.

### 8.2 Patience modifiers

Not rating-scaled (one lever). Paused while a plate is visibly inbound to this customer (logged grace modernization). `Fresh` variant hook extends patience — schema slot only.

### 8.3 Thought bubbles

`order / happy / neutral / sad / angry / blocked`; mood thresholds on remaining patience: >30s happy · 15–30s neutral · <15s sad. **Mood at the moment of delivery locks the rating delta** — a sad delivery still pays full cash but earns no rating: speed of service is the rating game, revenue is the throughput game (original pressure preserved). Accessibility (UI-kit spec, consumed): bubbles carry glyphs, not color alone; star deltas always show a signed number.

### 8.4 Spawner

`spawnIntervalMs = jitter(SPAWN_TABLE[stars], ±20%)`, gated by `freeSeats > 0 || queueLen < QUEUE_MAX`. **`SPAWN_TABLE` is a canon key on the 0–100 rating's star readout** (proposal, replacing all three specs' tables): 0–1★ 22s · 2★ 17s · 3★ 13s · 4★ 10s · 5★ 8s. Occupation-tier selection (who walks in) is the infection spec's table, regenerated onto the 0–100 scale there.

### 8.5 Throughput sanity (design math)

Early: server ≈ 1.1 t/s (shim Speed), stove→table round trip ≈ 8 tiles ≈ 7.3s + 1s handling ≈ **~7 plates/min/server**; 3 seats + 22s spawns ≈ 2.7 customers/min — server capacity exceeds demand, so the pressure is *dispatching at all*, then seats. Endgame: spawn floor 8s caps arrivals at 450/hr; stoves stay occupied while serving (production cap), so plates/hr ≤ ~450 — **same order as the original's measured ~760/hr** (fidelity row honest again; v1's 7,800/hr topology artifact is gone with counter-batching).

---

## 9. Server AI: tap-to-dispatch + priority task queue

### 9.1 Modes (player dispatch; research[0] mech 3 — counter, **sink, or table**)

| Tap zombie → tap … | Mode | Behavior |
|---|---|---|
| **counter** | `SERVING` (home = counter) | Auto-task loop (§9.3); idles at the counter between trips |
| **table** | `SERVING` (home = table) | Same loop, deliver-target selection biased to that table's seats — **new in v2; v1's omission of the researched table target is fixed** |
| **sink** | `BUSSING` | Bus tasks first; delivers only when no bus work |
| **READY stove** | `SERVING` (home = stove) | Serves that batch first |
| **floor tile** | `IDLE_AT` | Walks there, wanders ±2 tiles |
| selected zombie again / Esc | cancel | Per InputRouter (§3.5) |

Kitchen-assigned zombies can't be dispatched while their stove is `COOKING` (StovePanel "unstaff" pauses the cook). A never-dispatched zombie serves nothing — identical to the original.

### 9.2 Task types

```ts
type Task =
  | { kind: 'deliver'; stoveId: string; customerId: string }   // plate from a READY stove
  | { kind: 'bus';     seatId: string; sinkId: string }
  | { kind: 'wander' };
```
(v1's `rescue`/`carry` tasks are deleted with counter-batching; urgency is a priority modifier below.)

### 9.3 Arbitration (strict priority, then shortest path cost)

```
P0  explicit player dispatch (always preempts; auto-task released)
P1  deliver from a stove with burnRemaining < BURN_RED_THRESHOLD   (the rescue, reborn)
P2  deliver (any READY stove × WAITING_FOOD customer)
P3  bus (dirty seat + sink)
P4  wander near home
```
`BUSSING` swaps P2/P3. Claims are exclusive (`claimedBy`), released on completion, preemption, or blocked > `BLOCKED_RECLAIM_S`. Deliver target = lowest patience remaining (triage), tie → nearest. Property test: 8 servers × 50 tasks → no double-claims, no starvation.

### 9.4 Movement & the authentic freeze

Speeds from `src/sim/speed.ts` **only**: `zombieTilesPerSec = 0.45 + 0.09 · Speed` (staff canon; makes the researched Speed 1–12 stat load-bearing). `findPath → {ok:false}` ⇒ **freeze on current tile**, `blocked` emote, `server-blocked`; replans on `onLayoutChanged` and every 2s; claim releases after `BLOCKED_RECLAIM_S` so a routable server can take it. This is the original's "stand motionless" (research[0] cM 0). Mid-walk invalidation → replan from current tile; unreachable → freeze.

### 9.5 Rating (consumer)

The model is **Progression's**: `R = clamp(S + D + B, 0, 100)` — S service (0–40), D decor (0–45, from `furniture.json` `happinessBonus`), B bonus stars (0–15) — displayed as R/20 stars, StarMeter blinks green/red on change. **Offline decay exists and is owned by Progression** (v1's "no passive decay" is retracted); burn is wallet-only (§5.4).

This spec's contribution is the **service S-deltas**, proposed here and ratified into the rating canon (keys, not restatements, thereafter):

| Event | Δ S |
|---|---|
| Delivery, happy bubble | **+0.25** |
| Delivery, neutral | **+0.10** |
| Delivery, sad | 0 |
| Angry leave — no seat | **−1.0** (only fires on queue overflow; spawner never spawns into a full house, so death-spirals require real neglect) |
| Angry leave — starved | **−1.5** |
| Feral attack | **−6** (staff-spec hook; value canonical from Progression) |

The infection spec's occupation `minStars` column and the v1 0–1000 scale are regenerated/deleted against this canon (amendments filed).

---

## 10. (merged into §9.5 — section number retained so cross-references from other specs don't dangle)

---

## 11. Dish data: the original menu, hybrid bands, one generator

### 11.1 Names: the original spine restored

The **97-dish General Cookbook spine uses the original 2011 menu** — Mystery Meat is once again the tutorial dish; the ladder runs through Handburger & Flies, Green Eggs & Sam, Dishwater Soup, Hobo Delight, Leftunders, Gello Mold, Sloppy 'Joe', Tumor Melt, Rot Dogs, Escargut, Fetidccine, and caps at **Yucky-soba**. The repo's pun catalog (Finger Fries, Brainstem Bisque, …) is *good* — it fills the 9 themed books and rare filler slots.

**Licensing contingency (coordinated with `docs/spec/licensing.md`):** dish names ship in a `displayName` column with a same-register `altName` alternate; a `NAME_SET` build flag flips the column. The fidelity set is the default per Pillar 1; the final call on verbatim original names is escalated to the owner in the licensing spec (generic diner slang like "Mystery Meat" is low-risk; coined names are the owner's risk call). A rename is a one-line config, not a retune.

### 11.2 Cook-time bands per level (hybrid pacing; top band extended per review)

| L | Band | L | Band | L | Band | L | Band |
|---|---|---|---|---|---|---|---|
| 1 | 15–60s | 7 | 4–10m | 13 | 30–50m | 19 | 3–8h |
| 2 | 30s–2m | 8 | 5–15m | 14 | 40–60m | 20 | **4–24h** |
| 3 | 1–3m | 9 | 8–20m | 15 | 45–60m | 21 | **8–48h** |
| 4 | 1.5–3m | 10 | 10–30m | 16 | 1–2h | 22 | **12–72h** |
| 5 | 2–3m | 11 | 15–40m | 17 | 1.5–4h | | |
| 6 | 3–8m | 12 | 20–45m | 18 | 2–6h | | |

L1–5 snappy attended loop · L6–15 session-scale · L16–22 set-and-forget, with the **1–3-day overnight bet restored** (v1's 12h cap killed the research's "pacing/retention engine" — fixed; Pillar 2 explicitly sanctions long cooks, and burn windows of 3× make them safe: a 72h Yucky-soba gives a 9-day burn window).

### 11.3 The generator (`scripts/retune-dishes.ts` → `src/data/dishes.v2.json`) — the ONLY dish authority

Build Order M5's rival re-anchoring and every other spec's dish table are deleted (amendments filed); their assertions regenerate from these closed forms. **Generator inputs:** the band table, the name spine, and Progression's cookbook counts (97/9×21/34) + `unlocks.json` — so Progression's CI test and this retune cannot drift.

```ts
const T = cookTimeSeconds, L = level, minutes = T / 60;
servings      = clamp(round(12 * (T/60) ** 0.65), 4, 1900);
PER_SERVING   = [ ,1,1,2,2,2, 3,3,3,4,4, 5,5,6,6,7, 8,9,10,11,12, 13,14 ][L];
totalEarnings = PER_SERVING * servings;
margin        = min(0.5, 0.42 * (T/60) ** -0.15);
price         = max(1, round(totalEarnings * (1 - margin)));
totalXP       = max(1, round(0.62 * minutes ** 0.69));   // PROGRESSION'S formula — validated
                                                          // vs original stat lines: 2m→1XP, 1d→94≈95XP
```

**CI-verified invariants** over all 320: within each level, profit/hr strictly ↓ as T ↑ (post-pass enforces at integer-rounding edges); the newest tier's shortest dish beats every idle dish per hour; `earnings % servings === 0`; every T in band; book counts exact; the three legacy rate-outlier dishes are regenerated into bands (idle exploit dead). Ancient short dishes stay the best raw coins/hr forever — authentic (so was Mystery Meat); XP taper + seats + attention are the counterweights.

### 11.4 Anchor table (hand-verified generator output; full 320-row json is committed generator output)

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
| dish_yucky_soba | Yucky-soba *(cap dish)* | 22 | 72h | 23,408 | 1,900 | 14 | 26,600 | 3,192 | 200 | 216h |

Sloppy 'Joe' is again what it was: a **14k-cash overnight bet** that you'll dispatch within 72 hours of it finishing. XP at 24h → 94 matches the original's ~95 stat line — the formula earns its ownership.

### 11.5 XP curve / level pacing

Owned by Progression (cap 22, 21-row `unlocks.json`). This spec's v1 curve (`6·L^2.4`, cap 20) is **deleted**. Note filed with Progression: with delivery-only grants and 1-XP L1 batches, its walkthrough must re-validate time-to-L2 against the canon constants (flagged, not solved here — its document, its math).

### 11.6 Canon keys registered by this spec (values = proposals; `tuning.ts`/`canon.md` authoritative)

`SIM_TICK_MS 100 · MAX_LIVE_CATCHUP_S 5 · STARTING_CASH 300 · STARTING_TOXIN 5 · BURN_FLOOR_S 90 · BURN_RED_THRESHOLD 0.25 · FOOD_PATIENCE_S 45 · QUEUE_PATIENCE_S 20 · ORDERING_S 2 · EATING_S 8 · QUEUE_MAX 2 · FAVORITES_MAX 15 · BLOCKED_RECLAIM_S 3 · OFFLINE_CLAMP_DAYS 7 · HIDDEN_SETTLE_THRESHOLD_S 60 · CUSTOMER_TILES_PER_S 1.6 · ANGRY_TILES_PER_S 2.1 · SPAWN_TABLE {22,17,13,10,8} · SERVICE_S_DELTAS (§9.5)`

---

## 12. Offline settlement, pause semantics, multi-tab

`applyOfflineEarnings` / `computeIdleRate` / `idleCoinsPerSec` are **deleted**. This spec ships a **settler registered with the shared OfflineEngine**, which owns the single clamped elapsed window and the execution order.

### 12.1 OfflineEngine contract (defined in simulation-core; restated as the binding order)

`elapsed = clamp(now − lastSaveUtc, 0, OFFLINE_CLAMP_DAYS)`, one value for all settlers, run in fixed order: **(1) service settler** (stoves ready/burn + offline serving, below) → **(2) staff settler** (energy incidents) → **(3) rating decay** (Progression's formula, after bonus-star expiry) → **(4) raid timers** (revive/retaliation). One combined golden test exercises all four against a single fixture — the order-dependence bug class (counter sales vs exhausted servers, decay vs bonus expiry) is tested away, not hoped away.

### 12.2 Service settler algorithm (deterministic, golden-tested)

```
For each stove (absolute timestamps; paused stoves NEVER advance or burn):
  window = [max(readyAtUtc, saveAt), min(burnAtUtc, now)]      // serving window while away
  throughputPerMin = min(seatCount, servingModeServerCount, 60 / spawnIntervalSec(starsAtSave))
      // 1× of the coarse live model — the v1 0.25 factor is DELETED per review
      // (original's closed-app sim ran at full closed-rate; pillar 2: offline earnings matter)
  sold = min(servingsLeft, floor(throughputPerMin * windowMinutes))
  cashEarned += sold * perServing        // NO tips or rating-mult offline (attended-play flavor)
  xp += sold * xpPerServe                // may level up; reported
  if burnAtUtc ≤ now and servingsLeft > 0 → BURNT (servingsLost reported)
Customers/patience: not simulated offline; live customers despawned at save; no service S-deltas offline.
```

The design consequence is the *original's*: to earn offline you must **dispatch servers before you leave and return within the burn window**. Burn windows — not an arbitrary hour cap — are the offline ceiling. (Note: top-band burn windows exceed `OFFLINE_CLAMP_DAYS`; absolute stamps make multi-visit stewardship of a 72h dish work correctly across several settlements.)

### 12.3 Pause & hidden-tab semantics (one rule set)

* Tab hidden **< `HIDDEN_SETTLE_THRESHOLD_S` (60s)**: sim freezes (no ticks, no patience burn), resumes on visibility — a 3s alt-tab no longer empties the dining room.
* Hidden **≥ 60s**: save, despawn live customers (no rating deltas), and settle via OfflineEngine on return. `pagehide` also saves (iOS).
* **Full-screen modals** (cookbook, welcome-back, settings): customer/energy sim pauses; **cook/burn wall-clocks never pause** (they're absolute).
* Live-raid tab-hide behavior is the Raids spec's (auto-pause + resume/retreat), noted for the shared table in simulation-core.

### 12.4 Multi-tab writer election (fixed race)

`navigator.locks.request(SAVE_LOCK_NAME)` (Web Locks, Safari 15.4+); fallback: localStorage lease renewed every 5s, takeover at 15s stale. Loser tabs load **read-only** with a banner. Lock/channel name is one constant in the save-format module (v1's 250ms BroadcastChannel race and the two channel names are gone). Election messages carry `SAVE_VERSION`: a tab seeing a newer version than its own code goes read-only (cross-deploy safety for already-open tabs).

### 12.5 Welcome-back report

Shown when settled elapsed > 60s and anything happened:
* Header: "While you were out (4h 12m):" — cash earned (coin-fly on close), XP/levels.
* **Rating line with the researched away-blink**: stars pulse green/red for the net away change (offline decay from Progression's settler + any bonus-star expiry) — the signature beat v1 dropped.
* Per stove: "🍲 *Gello Mold* finished 2h ago — sold 84 servings — **burns in 1h 48m** — [Dispatch]" or "💀 *Rot Dogs* burned — 5 servings lost."
* Subtitle = next burn deadline. *"Collect before it burns"* is the retention engine, restated.

---

## 13. Return hooks (the burn window must be rememberable)

Ships **with this milestone**, not at PWA time:

* **Tab title** cycles while hidden: `🍲 Ready in 12m — Deadbeat Diner` / `⚠ READY — burns in 3h`.
* **Favicon badge** swap on READY / red-zone.
* **Opt-in, settings-gated local Notifications** (permission requested only from an explicit settings toggle): dish-ready and burn-T-minus-30-min, only while a tab exists.
* Explicitly documented limit: true push with no tab open is **out of scope** — the burn-window tuning (3–5× + floors) is what must tolerate that, and does.

---

## 14. UI requirements

* **CookbookPanel** (tap idle stove): level-gated list; row = icon, name, six stats + burn window, price button (disabled+red unaffordable, padlock+level gated, "FREE" under a Fridge token); favorites tab (≤ `FAVORITES_MAX`); sort by cook time | profit/hr | newest; footer hint "Away for a while? Pick a dish whose burn window covers it." **Empty favorites state**: ghost star + "Pin dishes you cook often." Unillustrated dishes render the specced placeholder icon (never invisible content).
* **StovePanel**: dish icon, timer / burn ring + `servingsLeft` chip, Pause/Resume, Toxin instant-finish (ledger price), Unstaff, Un-burn (on BURNT).
* **StarMeter**: consumer of Progression's meter component (R/20 stars), blink on `rating-changed`, signed-number delta toast (colorblind-safe).
* **Dispatch affordances**: selection ring + groan SFX; valid targets (counters/tables/sinks/READY stoves/floor) glow; invalid targets shake; behavior per §3.5.
* **HUD**: Cash + Toxin chips, XP bar (Progression's), `setScrollFactor(0)`.
* Touch targets ≥ the canon minimum (one key, UI-kit owned — the 44/48px fork is resolved there).
* **i18n**: English-only at launch, but all strings in `src/ui/strings/en.json` from day one (no inline literals) — the cheap half of the decision now, the expensive half deferred.

---

## 15. File plan

```
NEW  src/sim/ServiceSim.ts, StoveSim.ts, SeatIndex.ts, CustomerSim.ts, ServerSim.ts,
     TaskQueue.ts, DishMath.ts, speed.ts, OfflineSettle.ts, SimClock.ts, tuning.ts, types.ts
NEW  src/game/ReturnHooks.ts            §13 title/favicon/notifications
NEW  scripts/retune-dishes.ts           §11.3 → src/data/dishes.v2.json
NEW  src/data/validateCatalog.ts
NEW  src/ui/CookbookPanel.ts, StovePanel.ts, WelcomeBackModal.ts
NEW  tests: src/sim/*.test.ts

REWRITE  src/game/Stove.ts → StoveView; src/game/Customer.ts → CustomerView + BubbleView
REWRITE  src/scenes/CafeScene.ts        thin composition; InputRouter registration
MODIFY   src/core/SaveManager.ts        field additions per ledger; durability UX (§4.2)
MODIFY   src/core/Economy.ts            cash/toxin rename; addCash allowlist lint (§6.3)
MODIFY   src/core/EventBus.ts           consumes shared events registry; drops Phaser dep
MODIFY   src/data/types.ts, src/ui/Hud.ts
DELETE   DEMO_TIME_SCALE; dishes.json v1; idle-drip block; v1's StubGrid/CounterSim plans
AMEND (filed with owners): Progression (XP grant = 100% delivery; walkthrough regen; rating canon
     adopts §9.5 deltas), Build Order (M4 global timescale deleted; M5 dish table deleted;
     ledger rows for this milestone), Infection (minStars regen to 0–100), Staff (payment formula
     §6.2 replaces its tip mult), events registry (delete serving-delivered/dish-collected)
```

### Build order (each step ships green; save-version integers from the ledger)
1. Events registry + Dish v2 + generator + validator + save migration (`min(brains,99)`) + storage-durability UX.
2. Sim core vs in-test fake grid: StoveSim + DishMath + tests → pay-then-cook + burn live.
3. SeatIndex + CustomerSim + spawner + bubbles (delivery stubbed) + core tutorial beats land here per the split-onboarding amendment (tap stove → pay → burn ring → dispatch → first delivery).
4. ServerSim + TaskQueue + dispatch input + InputRouter registration — loop closes; both fake faucets deleted same commit; ReturnHooks.
5. Rating S-delta emission + XP emission — infection-leveling deleted.
6. OfflineSettle registered with OfflineEngine + WelcomeBackModal + Web-Locks guard — idle drip deleted.
7. Wire to the real `src/engine/contracts.ts` when the foundation merges.

---

## 16. Testing

* **Unit (vitest, node, <5s)**: burn-band boundaries (300/301, 1800/1801, 90 floor); pause arithmetic; per-serving integer invariant; XP fractional accrual sums to totalXP; payment golden (3 zombies × 3 ratings); seat adjacency (2×2 tables, chair between tables, walled chair); layout-change ordering fixture (§7.4); moved-mid-cook stove fixture; task claims property test; patience moods; spawn gating; settlement goldens (burn-at-exactly-now, partial-batch sale, 72h dish across two settlements); combined OfflineEngine golden (four settlers, fixed order); MAX_LIVE_CATCHUP 60s-gap test; pity-invariant walk (§6.4); migration fixtures; storage fault injection (throwing stub).
* **Economy invariants** over the full generated catalog + cookbook counts.
* **Determinism**: same seed + command script ⇒ identical save hash.
* **Playwright smoke**: chromium **and WebKit** projects (browser matrix per engineering-infra: last-2 Chrome/Edge/Firefox + Safari/iOS 16.4+); boot → cook Mystery Meat → `window.__sim.advance` → dispatch → delivery pays → mid-cook save round-trips. Production-bundle grep asserts the harness is stripped.
* **Perf**: relative CI budget (sim tick < K× an in-process calibration loop) + generous absolute ceiling; device-class 60fps claims move to the manual per-milestone device checklist (one iPhone, one mid Android) recorded in the milestone PR — no flaky absolute-ms CI assertions.

---

## 17. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Serve-from-stove reversion makes stoves the bottleneck players park on | That's the original's actual tension (buy more stoves); validated at the milestone playtest against the §8.5 model |
| Early burn windows punish new players | 90s floor + burn ring + ReturnHooks + first-burn tutorial toast + 1-Toxin un-burn mercy |
| Offline 1× over-earns vs attended play | No tips/rating-mult offline, spawn-table term caps it, and the economy test asserts offline ≤ live for the same span |
| Rating deltas mis-tuned → spawn spiral | No-seat penalty only on queue overflow; spawner never overfills; canon-key retune is one file |
| Modernization stack plays itself | Bundle playtest at the milestone (§2 note); daydream knob flagged to staff spec |
| Original dish names create IP exposure | `altName` column + `NAME_SET` flag; decision escalated in licensing.md; rename is config, not retune |
| Cross-spec drift recurs | Everything numeric is a canon key; CI diff canon ↔ tuning ↔ artconfig; amendments filed in §15 are merge-blockers for this spec |

---

## 18. Art & audio briefs (to the presentation spec)

Dish icons for the 97-spine (20 launch-quality for L1–3) under the **fidelity name set**; on-stove batch render + servings chip; blackened pot + smoke; bubble atlas (order/happy/neutral/sad/angry/blocked, glyph-bearing); carry-plate walk, cook-stir, sit/eat, stomp-out (rig per the presentation spec's paper-doll canon — character production strategy is its call); cookbook/stove panel frames, burn ring, star meter (Progression's component), welcome-back frame; SFX set as v1 plus un-burn "sizzle-rescue" and Fridge hum.

---

## 19. Review notes (critiques adjudicated, not silently applied)

1. **"Adopt the 0–1000 rating scale" (engine engineer) — REJECTED.** Two of three reviewers, the furniture `happinessBonus` magnitudes, bonus-star persistence, and away-decay all live naturally in Progression's 0–100 S+D+B. The 0–1000 model's only asset (enumerated deltas) is preserved by restating them as S-deltas (§9.5).
2. **"Service spec's XP curve/cap-20 is authoritative" (engine engineer) — REJECTED.** Progression's `0.62·cookMin^0.69` reproduces the original's published stat lines (2m→1, 1d→95; verified again in §11.4: 24h→94); a formula validated against the fidelity source outranks one with a committed-but-unvalidated table. The engineer's *other* demand — one grant trigger — is honored: 100% on delivery, collect-tap deleted everywhere.
3. **"Restore the original menu" vs "rename Capcom names for licensing" — BOTH honored structurally.** Fidelity names are the default spine (Pillar 1 is locked); the `altName` column + build flag makes the licensing call a config decision escalated to the owner in licensing.md, not a spec deadlock.
4. **Door edge (front vs NE back wall)** — contested *between* critics and owned by the Iso Engine spec; this spec consumes `door()` and is correct under either resolution. Not adjudicated here.
5. **"Offline tips excluded is fine as flavor"** — accepted as stated; also excluded the rating multiplier offline for the same reason.
6. **Starter-layout counter requirement** — with counter-batching deleted, counters are no longer functionally required to serve; the starter still includes one because the researched tutorial beat is "tap zombie, tap counter." Recorded as a soft (tutorial) requirement, hard-asserted anyway in §7.4's CI test.
7. **Missing items owned elsewhere, acknowledged not absorbed:** seasonal/event cafes, outdoor decor, Industrial Barrel of Zombie Serum, telemetry decision, settings spec, Zombiepedia states, working-slot ladder, raid rare-dish counts — each belongs to Progression/Store/Staff/Infra per §0's authority map; this spec's touchpoints (generator accepts seasonal book inputs; stove-mod hook §5.7; energy hook §5.5) are in place. The friends-layer recipe substitute and Magic Fridge were absorbed here because they touch the cookbook and stove directly.
8. **Zero-analytics stance** (flagged by the missing-items list): this spec's tuning knobs are all single canon keys precisely so post-launch tuning can run on playtest feedback without telemetry; the one-paragraph product decision itself belongs to engineering-infra.

---

## 20. Definitive-experience checklist (masterpiece bar)

A Zombie Cafe fan's first session, in order, zero inversions: cookbook opens on stove tap → **Mystery Meat, 3 cash, price leaves the wallet** → timer → READY on the stove with a **visibly ticking burn ring** → tap zombie, tap counter → shambling ferry from the stove → plate lands, **coins pop at the table** → thought bubble → star blink. Their first overnight: bet 14k on a Sloppy 'Joe', dispatch two servers, close the tab, come back to *"your Sloppy 'Joe' sold 431 servings while you slept — the batch burns in 39 hours"* — with the stars blinking green. That is the game, restored — this time from one set of numbers.

## Acceptance criteria

- [ ] Rating is consumed from Progression's 0-100 S+D+B canon: this spec ships no rating scale of its own, its per-delivery S-deltas (+0.25 happy / +0.10 neutral / 0 sad / -1.0 no-seat / -1.5 starved / -6 feral) are registered as canon keys, offline decay and burn-is-wallet-only are recorded once in the rating canon, and the 0-1000 model is deleted.
- [ ] XP: Progression owns the curve (cap 22) and dish totalXP formula (max(1, round(0.62 * cookMinutes^0.69))); grants are 100% on delivery via 'plate-delivered'; no collect-tap exists anywhere; the 6*L^2.4 curve is deleted.
- [ ] Serve-from-stove topology: the finished batch stays on the stove, the stove is occupied until exhausted or burnt, the burn clock never stops while servings remain, counters hold no batches, and the v1 rescue/carry-to-counter tasks are deleted (rescue survives only as delivery priority P1).
- [ ] Tap-to-dispatch supports all researched targets: counter, table, sink, READY stove, and floor; tap-table homes SERVING mode biased to that table's seats.
- [ ] The 97-dish General Cookbook spine uses the original 2011 menu names (Mystery Meat tutorial dish through Yucky-soba cap dish) with an altName licensing column and NAME_SET flag; cookbook counts 97/9x21/34 are generator inputs CI-asserted against Progression's unlocks.json.
- [ ] Cook-time bands extend to L22 with 4-24h / 8-48h / 12-72h top bands restoring 1-3-day overnight bets; burn bands remain 5x/4x/3x with the 90s floor; band membership validated over all 320 dishes.
- [ ] Offline serving settles at 1x of the coarse live model min(seats, servingServers, 60/spawnInterval) with no tips or rating multiplier, routed through the shared OfflineEngine in the fixed order service -> staff -> rating decay -> raids, with one combined golden test.
- [ ] Time model: cook timers and burn deadlines are absolute wall-clock timestamps never scaled by any clock; energy/daydream run on the staff spec's 12x activity clock; DEMO_TIME_SCALE and the Build Order's global FOREGROUND_TIME_SCALE are deleted.
- [ ] SimClock harness: production injects RealClock; a test-harness build exposes window.__sim.advance(ms); a CI grep of the production bundle proves the harness is stripped; Playwright smokes use advance instead of wall waiting.
- [ ] MAX_LIVE_CATCHUP (5s): a 60s injected frame gap produces zero angry-leave rating deltas, despawns live customers, and routes excess time through OfflineSettle (unit-tested).
- [ ] Hidden-tab semantics: <60s hidden freezes and resumes; >=60s saves, despawns customers, and settles; modals pause customer/energy sim but never cook/burn wall-clocks.
- [ ] Multi-tab: navigator.locks with localStorage-lease fallback replaces the 250ms BroadcastChannel race; one lock-name constant; election messages carry SAVE_VERSION and stale-version tabs go read-only.
- [ ] Save schema: no version integer claimed; fields land per the Build Order ledger; brains->toxin migration is min(brains, 99) stated once; SavedCounter is deleted and SavedStove gains servingsLeft/xpAccrued.
- [ ] One payment formula in DishMath: round(perServing * (1 + 0.05*Tips) * (1 + R/200)) with Tips from StaffStats (interim shim explicitly deleted at the staff milestone), golden-tested across 3 zombies x 3 ratings.
- [ ] Coin-faucet AC is an enumerated lint-enforced allowlist (deliver, OfflineSettle, raid loot, special machines, quest/catering rewards) instead of the falsified single-faucet grep.
- [ ] Soft-lock pity: the invariant 'no reachable state has zero income paths' is unit-tested; the Union Rep grants a free cheapest-dish cook when cash < cheapest price and nothing is cooking or READY.
- [ ] Toxin sinks (instant-finish, 1-Toxin un-burn, Magic Fridge 30-vial free-dish-per-day, special-stove upgrades) are mechanically specced here but priced only in Progression's Toxin ledger.
- [ ] Furniture lifecycle matrix enforced via canRemove: non-IDLE stoves and occupied seats are removal-blocked; sink/counter removal releases in-flight tasks; layout changes process in the fixed order SeatIndex -> TaskQueue revalidation -> path replans (fixture-tested including expansion and door relocation).
- [ ] Speeds come only from src/sim/speed.ts: zombieTilesPerSec = 0.45 + 0.09*Speed (staff canon) plus single CUSTOMER/ANGRY constants; movement is 4-connected; contracts consumed from src/engine/contracts.ts with the engine's real signatures and id-preserving moves (moved-mid-cook stove test).
- [ ] Return hooks ship with this milestone: hidden-tab title countdown, favicon badge on READY, opt-in settings-gated local notifications; welcome-back report includes the away-rating green/red star blink.
- [ ] Endgame throughput is capped by the spawn table (5-star floor 8s => <=450 plates/hr), same order of magnitude as the researched ~760/hr; the 7,800/hr v1 artifact is gone.
- [ ] Storage-failure UX (quota -> toast + auto-download, disabled -> in-memory + banner, corrupt -> download-before-wipe, navigator.storage.persist) is required at this milestone with fault-injection tests; Playwright runs chromium and WebKit; perf ACs are relative CI budgets plus a manual device checklist.
- [ ] All UI strings live in src/ui/strings/en.json; empty states (favorites, unillustrated dish placeholder icons) are specced; DISPATCH input mode is registered with the shared InputRouter and a tap on a customer while a zombie is selected deselects without opening the infect card.
- [ ] The spec contains a Review Notes section adjudicating rejected critiques (0-1000 scale, service-owned XP curve) and listing missing items owned by other specs, plus a deviation log covering the friends-layer Catering Ledger substitute, offline-ratio change, un-burn mercy, and licensing contingency.
