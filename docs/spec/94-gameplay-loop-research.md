# 94 — Gameplay-loop ground truth (online research, 2026-07-11)

Produced by a 13-agent research workflow: 6 source-angle researchers (in-game
tutorial script preserved on the Fandom wiki, the 2011 wikidot fan wiki,
contemporary guides/reviews, player measurement blogs/forums), 6 adversarial
cross-checkers (independent second sources per claim), 1 synthesizer.
286 sourced facts collected; the spec below marks confidence per mechanic.
Facts archive: workflow wf_b68752ec-3b7 journal (session artifacts).

## Mechanics spec (synthesized, confidence-tagged)

ZOMBIE CAFE (2011) — CORE SERVICE LOOP, IMPLEMENTATION SPEC
Legend: [CONFIRMED] = multi-source verified; [SINGLE-SOURCE] = one credible source, uncontradicted; [INFERRED] = reasonable deduction; UNKNOWN = no number found, default proposed.

=== 1. RECIPE SELECTION & COOK START ===
1.1 [CONFIRMED] Two entry paths: (a) tap a stove (or the cookbook HUD icon) -> cookbook opens -> pick a dish -> a pot appears on the stove; then tap a zombie/chef, then tap the stove to start; OR (b) tap chef/zombie first, then stove (tutorial's literal first instruction) -> cookbook opens -> pick dish -> cooking starts.
1.2 [CONFIRMED] Cookbook rows show per dish: Price (upfront cost), Ready In (cook time), Servings, Total Earnings, Total XP (plus required Level; sortable by each column). Recipes gated by cafe level >= recipe level.
1.3 [CONFIRMED] The dish's Price is deducted from cash the moment cooking starts. If the dish burns, that money is lost.
1.4 [CONFIRMED] A chef or zombie must be standing at the stove for cooking to progress. Removing/reassigning the worker PAUSES the cook; reassigning any worker to the stove RESUMES it. Pot + progress persist on the stove.
1.5 [CONFIRMED] Cooking progresses in real time while the app is closed (wall-clock timers). [SINGLE-SOURCE nuance: a paused, unfinished cook left too long also burns.]
1.6 [CONFIRMED] Toxin instant-finish: tap the stove, then a Finish button; costs Toxin, dish becomes ready immediately.
1.7 [CONFIRMED] Cook-time range is 2 minutes (Mystery Meat: $8, 12 servings, $12 earnings, 2 XP) to ~3 days (Fetidccine); anchors: Dishwater Soup L2 $125/15m/50sv/$150/10XP; Green Eggs & Sam L3 $280/1h/180sv/$360/30XP; Gello Mold L4 $475/12h/400sv/$1200/120XP; Sloppy Joe L6 $1500/1d/850sv/$2550. Shorter dishes yield more profit AND XP per hour (active play rewarded); long dishes are for overnight idle.
1.8 [SINGLE-SOURCE, JP wiki] XP split: 1/3 of dish XP granted at cook start, 2/3 granted as servings are served. Default: adopt this (it rewards completing the chain).
1.9 [CONFIRMED] Stove upgrades reduce cook time (-10% Suped-Up, -20% Laser/Grill/Steam) [percentages SINGLE-SOURCE]; themed stoves unlock exclusive recipes.

=== 2. READY STATE, BURNING, MOVE-TO-COUNTER ===
2.1 [CONFIRMED] When cooking completes, the finished dish sits ON the stove; the stove is blocked for new cooks until the dish is moved off. A big red arrow/indicator appears over the stove [SINGLE-SOURCE for arrow specifics; INFERRED it offers serve/discard options].
2.2 [CONFIRMED] Burn rule: a finished dish left on the stove too long burns — pot blackens, dish and all money spent are destroyed; the burnt pot must be cleared before recooking. Two documented eras: early flat rule = 2x cook time after finish [CONFIRMED for 2011]; later tiered rule = grace of 5x cook time (dishes <=5 min), 4x (6–30 min), 3x (31 min–3 days) [SINGLE-SOURCE fandom, plausibly a patch]. Default: use the tiered rule (friendlier, matches the version most players remember) and surface a countdown.
2.3 [CONFIRMED] Move-to-counter is a manual two-tap: with a zombie/chef selected, tap the finished food (on stove) -> worker walks to stove, physically CARRIES the whole serving dish to a serving counter and places it there. This frees the stove.
2.4 [CONFIRMED] Counters store prepared dishes between stove and tables ("Store your dishes here until you're ready to serve them"). One dish (a platter with N remaining servings) per counter [strongly implied, SINGLE-SOURCE for the strict cap]; multiple counters = dish queue control (choose which dish serves first). Default: 1 dish per counter tile-object.

=== 3. SERVING (WAITER LOOP) ===
3.1 [CONFIRMED] Serving is role-assignment, then autonomous: the player taps a zombie/chef, then taps a serving counter, sink, or table -> that worker becomes a server. Servers then automatically shuttle: take ONE serving per trip from a counter dish, deliver it to a seated waiting customer, return; also clear dirty plates to a sink. No per-customer player input.
3.2 [CONFIRMED] A waiter only needs to be ADJACENT to (touching) the table to deliver — no specific approach tile. Layout meta: minimize table<->counter distance.
3.3 [SINGLE-SOURCE, plausible] Dispatch queue: among idle servers, the HIGHEST tip-rating zombie takes the next serve task; the LOWEST tip-rating zombie takes the next dirty-plate task unless a customer is waiting for food (serving outranks bussing). Daydreaming zombies drop out of the queue. Default: adopt as-is — it's cheap and gives stats meaning.
3.4 [CONFIRMED] Path integrity is enforced: servers need a clear walkable path to every table, counter, and sink or they stand motionless; the game shows explicit warnings ("clear path to the sink, serving counter, and tables" / "You blocked the door!").
3.5 [CONFIRMED] When a server has no valid task (counter empty, no dirty plates), it stands idle and must be re-tasked manually — original friction; keep the idle state but modernize with a subtle "idle" indicator.
3.6 [INFERRED] There is no drag verb for characters anywhere: the full gesture vocabulary is tap (select/buttons), tap-A-then-tap-B (assign), touch-and-hold (pick up furniture), drag (move furniture / drag-to-store to sell). Camera pan by drag is INFERRED (17x16 max grid > one screen); pinch-zoom unconfirmed.

=== 4. CUSTOMER FLOW & PAYMENT ===
4.1 [CONFIRMED] Customers spawn at the door on a rate driven by star rating (higher rating = more customers AND better/rarer customer types; some types have explicit min-star and min-level requirements).
4.2 [CONFIRMED] Arriving customer walks to the NEAREST open table (no queue). One customer per table; each table needs exactly one chair. If no table is free, the customer leaves unhappy -> rating drops.
4.3 [CONFIRMED] Customers do not order: any serving from any dish satisfies any waiting customer. After receiving food they eat ~a few moments (UNKNOWN exact; default 8–12 s), then PAY AUTOMATICALLY AT THE TABLE (no cash-collection task) and leave, leaving a DIRTY PLATE on the table.
4.4 [CONFIRMED] Payment = per-serving price (Total Earnings / Servings, e.g. Mystery Meat $1/plate) + optional tip, shown as a table popup like "$10 + 2 TIP" [popup format SINGLE-SOURCE].
4.5 [CONFIRMED-with-caveats] Tips: scale with server tip rating; rating 10 ~= 20% of meal price, granted in $1/$2 quanta (probabilistic on cheap dishes to average out). Tip multipliers on premium zombies (x2/x3/x5). [SINGLE-SOURCE] No tip if the customer waited too long for food (~>30 s; default 30 s). [SINGLE-SOURCE] Tip also divided by time-to-serve -> near tables tip best. Default formula: tip = round_to_$1_or_$2( plate_price * 0.02 * tipRating * multiplier ) with 0 if waitTime > 30 s.
4.6 [CONFIRMED] Mood is expressed via thought bubbles at departure: yellow happy face (was fed) or blue frowning face (no seat / no food / scared). Happy leave -> +rating and payment; unhappy leave -> -rating, no payment.
4.7 [CONFIRMED] Infection: tap customer -> Infect button (cost per customer type: $0 commons up to cash/Toxin premiums); deterministic zombie counterpart with fixed stats. Info button shows Energy (50–1250), Tip Rating/Speed/Atk (1–12). Staff cap grows with cafe level (1 -> ~12–14).

=== 5. ENERGY, DAYDREAMING, ATTACKS ===
5.1 [CONFIRMED] Every zombie has Energy (red bar on tap). Drains while WORKING (cooking drains much faster than serving [SINGLE-SOURCE for the ratio]); replenished only by RESTING (player sends zombie outside/off-floor via tap-zombie then tap-outside). The chef's energy never drains in the cafe (infinite worker, but only one of him).
5.2 [SINGLE-SOURCE numbers] App-open rates: cook drain ~3 energy/min; rest regen ~3/min; Toxin Barrel item doubles regen. Offline rates ~10x slower both ways. Defaults: drain cooking 3/min, serving 1.5/min [INFERRED from "much faster"], regen 3/min resting, x0.1 offline.
5.3 [CONFIRMED] Daydreaming: idle-out behavior where a working zombie stops and stares; frequency governed by hidden Focus stat (Focus 1 ~ every 100 s) and increases as energy drops. A daydreamer must be tapped and re-tasked. Default: daydream check every 30 s, P = base(focus) * (1 + (1 - energy%)).
5.4 [CONFIRMED] Attack: if energy falls below a hidden Patience threshold (impatient ~20% energy, patient ~2%), the zombie attacks and EATS a customer -> ALL customers flee without paying, rating takes a big hit (~half a star), zombie regains a little energy (~+20 for a normal customer). This is the core management tension: overwork = catastrophe.
5.5 [CONFIRMED] Zombies gain XP (1/serve; none for cooking [SINGLE-SOURCE]), level up -> +max energy and full refill.

=== 6. STAR RATING ===
6.1 [CONFIRMED] 0–5 star meter, top-left HUD, moves gradually (half-star granularity per player reports). +small per happy customer; -small per unhappy leave (no seat, no food); -large per zombie attack. Exact deltas UNKNOWN — default: internal 0–100 popularity score, +1 happy, -2 unhappy, -10 attack, displayed as score/20 stars rounded to halves.
6.2 [CONFIRMED] Rating -> spawn interval and customer-type pool (feedback loop). Default: spawnInterval = lerp(20 s @ 0★, 4 s @ 5★) scaled by seat count.
6.3 [CONFIRMED] Rating drifts while away (customers arrive offline; no food = decay). Green/red blinking stars on return show away-drift direction. Decor items with +star bonuses accelerate climb, don't set a floor [SINGLE-SOURCE].
6.4 [CONFIRMED] Door toggle: cafe can be closed (no new customers; cooks keep cooking; zombies rest safely) — the sanctioned pressure valve.

=== 7. MOVEMENT FEEL ===
7.1 [CONFIRMED] All characters pathfind autonomously on the iso grid; Speed stat (1–12) scales walk speed; per-type feel matters (Mathlete visibly fast, Couch Potato shuffles). No direct movement control existed in the original (players ASKED for the tap-to-walk we already have — keep ours as a sanctioned modernization).
7.2 [CONFIRMED] Furniture verbs: touch-and-hold to pick up/move (green placement boxes show validity), drag into store to sell (50% refund); only 2 facings (E/S).

=== 8. OFFLINE ===
8.1 [CONFIRMED] Offline sim on return: cooks progress by wall-clock, servers keep serving at reduced throughput (star-item dependent, ~100–150 dishes/hr reported), rating drifts, energy drains/regens slowly, burn timers run; a cash+tips "earned while away" total pops over the chef's head [SINGLE-SOURCE for the popup]. Default: closed-form simulation on load, capped per pillar #2.

## Gap analysis vs the build (rank = fidelity impact) and implementation status

### 1. No serve chain: coins pop out of the stove instead of food flowing stove -> counter -> table
- Original: A finished dish is a physical platter with N servings. A worker manually carries it from stove to a serving counter (freeing the stove); assigned waiters then autonomously ferry ONE serving per trip from counter to each seated customer, who eats, pays per-plate at the table, and leaves a dirty plate. Income arrives customer-by-customer over minutes, not as one lump.
- Ours (pre-pass): Cook finishes -> coin bubble on the stove -> tap collects full gross income instantly; counter is decorative; customers eat a disconnected generic green plate; no servings stock, no carrying, no per-plate payment.
- Plan: Introduce a FoodPlatter entity (dishId, servingsRemaining) with three homes: Stove(ready), Carried(by worker), Counter slot (1 platter per counter). Remove stove coin collection entirely. New worker tasks in the engine-side task system: MOVE_DISH (selected worker + tap ready food -> path to stove, pick up, path to nearest free counter, deposit) and SERVE (waiter loop: nearest counter platter -> decrement servings -> path adjacent to a WAITING seated customer -> customer enters EATING). Customer pays perServing (already in dish JSON) + tip at the table with a floating '$X + Y TIP' text. Gate customer WAITING->EATING on actual delivery. This one system is the game's identity; build it before everything below.
- **Status: CLOSED this pass — platter carry chain (stove -> counter -> table), per-plate payment at the table.**

### 2. No cookbook, no dish choice, no upfront cost — cooking is free auto-assigned income
- Original: Tap stove (or chef-then-stove) opens the cookbook listing Price / Ready In / Servings / Total Earnings / Total XP, gated by cafe level. Picking a dish DEDUCTS its price immediately; the pot appears; a worker must then man the stove. Choosing 2-minute vs 12-hour dishes IS the strategy layer (profit/hr vs idle coverage), and the upfront cost makes burning hurt.
- Ours (pre-pass): Tap unstaffed stove -> zombie walks over and instantly cooks an auto-assigned dish at zero cost; same dish auto-restarts forever.
- Plan: Build a CookbookScene/panel bound to the existing 216-recipe JSON (columns: name, price, time, servings, earnings, xp; sortable; level-locked rows greyed). Flow: stove tap with no pot -> open cookbook -> select -> assert cash >= price, deduct, create CookJob{dishId, elapsed:0, paid:true} on the stove -> stove shows pot + radial timer. Remove auto-restart. Grant xp*1/3 at start, xp*2/3 spread across servings served. Keep a 'repeat last dish' one-tap shortcut as a modernization.
- **Status: CLOSED this pass — cookbook panel with Price/Ready-in/Servings/Earnings/XP, upfront payment, no auto-restart.**

### 3. No zombie energy / rest / daydream / customer-attack — the management twist is absent
- Original: Working drains a red energy bar (cooking fastest). Player must rotate zombies out to rest (tap zombie, send outside). Low energy -> frequent daydreaming (worker stalls, needs re-tap); below a per-type Patience threshold (2–20%) the zombie EATS a customer: everyone flees unpaid and the rating craters. Watching energy bars is the active vigilance task that makes this a zombie game, not a cafe skin.
- Ours (pre-pass): Zombies have no energy, never tire, never stop, never misbehave; stats other than walk speed unused.
- Plan: Add to Zombie model: energy/maxEnergy, focus, patience (seed from existing stat data). Engine tick: drain 3/min cooking, 1.5/min serving (app-open rates); regen 3/min in REST state (walk to off-floor rest zone). UI: red bar in the tap card + a small pip over low-energy workers. Daydream: probabilistic stall state (sit-down anim, zZz bubble), cleared by tap+retask. Attack: when energy% < patienceThreshold and a customer is present -> attack sequence -> all customers flee (no pay), rating -10, zombie +20 energy. Ship energy+rest+daydream first; attack can follow one release later.
- **Status: PARTIAL this pass — energy drain (cooking fastest) / idle regen / daydream-refusal + Toxin refill + zZz badge. Attack-customer + focus/patience stats deferred.**

### 4. No star rating / popularity loop driving traffic
- Original: 0–5 star meter (top-left) rises with each happy departure and falls on no-seat, no-food, or zombie-attack departures, shown via yellow/blue thought bubbles. Rating controls BOTH customer spawn rate and which customer types appear (some types gated by min stars); it drifts while away. It is the game's central feedback loop and failure signal.
- Ours (pre-pass): Fixed timer spawns; no rating, no unhappy state, no thought bubbles, no traffic feedback.
- Plan: Add popularity: number (0–100) to game state; display as stars HUD (halves). Hooks: +1 on happy leave, -2 on leave-hungry (add a customer patience timer, ~60–90 s seated without food -> blue bubble + leave unpaid) and on full-house bounce (spawn a customer who turns away at the door), -10 on attack. spawnInterval = f(popularity, seatCount). Thought bubbles are one sprite pair on the departure path. Later: gate premium customer archetypes on star thresholds using existing customer data.
- **Status: CLOSED this pass — star rating HUD, +served / -angry, rating-driven spawn interval. Full-house bounce + type gating deferred.**

### 5. No burning — long cooks and neglect carry zero risk
- Original: A finished dish left on the stove burns after a grace window tiered by cook time (5x for <=5 min dishes, 4x for 6–30 min, 3x for 31 min–3 days; early builds flat 2x). Burning blackens the pot, destroys the dish and its full upfront cost, and the pot must be cleared. A red arrow flags ready food. Burning is what makes 'come back for your food' a real appointment.
- Ours (pre-pass): Finished food waits forever; no penalty, no urgency, no ready indicator beyond the coin.
- Plan: On CookJob completion set burnDeadline = now + cookTime * tierMultiplier(cookTime). Stove states: COOKING -> READY (bouncing red arrow + smoke-free pot, optional gentle timer ring) -> BURNT (black pot, sad smoke, tap -> 'Discard' clears stove). Runs on wall-clock so it works with offline sim. Add the Toxin 'Finish' button on the stove card while at it (pillar 3: Toxin as accelerant). Browser Notification API can stand in for the original's 'brraaiinns' push when a dish is ready or near burning.
- **Status: CLOSED this pass — tiered burn windows (5x/4x/3x), blackened pot, tap-to-discard. Toxin instant-finish deferred.**

### 6. Serving/bussing is not a role — no auto-serve assignment, no sinks, no dirty plates
- Original: Player assigns a zombie to service by tapping it then a counter/sink/table; from then on it autonomously serves waiting customers and clears dirty plates to a sink (highest-tip idle zombie serves next plate; lowest-tip clears, serving prioritized). Customers leave dirty plates that occupy the table until bussed; blocked paths make workers stand motionless with an explicit warning.
- Ours (pre-pass): Only cook assignment exists; no server role, no sink, no dirty plates; tables free up instantly.
- Plan: Add worker role SERVER (assign: tap zombie -> tap counter/sink/table). Table lifecycle: FREE -> OCCUPIED_WAITING -> EATING -> DIRTY (plate sprite blocks reseating) -> FREE after a BUS_PLATE task delivers it to a sink. Task allocator in engine (pure TS): queue of ServeTask/BusTask, claim rule = max tipRating for serve / min tipRating for bus, serve > bus. Sink becomes functional furniture. Reuse A* reachability to validate counter/table/sink connectivity; surface the original's 'blocked path' toast when a task is unreachable and leave the worker visibly stalled.
- **Status: CLOSED this pass — auto serve/bus AI, dirty plates block reseating, sink clearing. Tap-role assignment + tip-rating queue order deferred.**

### 7. Income model wrong: flat tip per customer instead of per-serving price + earned tips
- Original: Each customer pays the dish's per-serving price (Total Earnings / Servings — data we already ship) plus a tip that depends on the server's Tip Rating (~20% at rating 10, in $1/$2 quanta, premium multipliers x2–x5) and is FORFEITED if the customer waited >~30 s. So dish choice, staff choice, and layout all shape income.
- Ours (pre-pass): Flat 12 + level*6 paid by every customer regardless of dish, server, or wait; cook income separately collected as gross at the stove (double-counting once gap 1 lands).
- Plan: Delete flat tip. On delivery: cash += dish.perServing; tip = quantize(dish.perServing * 0.02 * server.tipRating * server.tipMult) if seatedWait <= 30 s else 0; float '$P + T TIP' at the table. Track seatedWait from sit-down. This makes the existing zombie tipRating stat and the per-dish perServing field load-bearing and creates the layout meta (near tables tip more via the wait timer) for free.
- **Status: CLOSED this pass — perServing + ~20% tip forfeited past 30s wait, "+$P +$T TIP" float. Per-zombie tip ratings deferred.**

### 8. Cooking is unmanned and instant-feeling; no pause/resume, no offline progression
- Original: A worker must stand at the stove the whole cook; pulling them pauses the pot (state persists), reassigning resumes. Timers are wall-clock: dishes finish while the app is closed — the hybrid idle backbone (set an 8 h dish + servers before bed, wake to money). Offline: servers keep working at reduced throughput, energy drains ~10x slower, an away-earnings total pops over the chef.
- Ours (pre-pass): Zombie is bound to the stove but nothing depends on presence; no pause concept; nothing progresses when the tab is closed; no away summary.
- Plan: CookJob accumulates elapsed only while a worker occupies the stove tile (pause = worker leaves; pot sprite stays with progress ring dimmed). Persist {jobs, platters, workers, popularity, lastSeen} to localStorage; on boot run a deterministic catch-up sim in engine/ (pure TS, unit-test it): advance cooks by manned-time, run serving throughput f(servers, seats, platter stock, popularity), apply slow energy curves and burn deadlines, then show a 'While you were out' card over the chef (cash, tips, dishes served, anything burned). This directly implements locked pillar 2.
- **Status: PARTIAL this pass — manned-cooking rule (unmanned pot pauses, resumable). Offline catch-up sim still the old idle-rate model.**

### 9. Command grammar diverges: our tap verbs don't cover the original's task vocabulary and feedback
- Original: Everything is tap-select then tap-target: zombie->stove (cook), zombie->food (carry to counter), zombie->counter/sink/table (serve role), stove->Finish (toxin), stove->Serve shortcut, customer->Infect/Info, zombie->Info (fire/stats). Selection plays a zombie groan; tapped zombies show an energy card. No character dragging anywhere.
- Ours (pre-pass): Tap zombie -> tap tile/stove only; no food tap, no counter/sink/table assignment, no contextual buttons, no info card, no selection audio; infection is a random kitchen chance rather than a player verb.
- Plan: Generalize the current select-then-target code into a CommandResolver: resolve(selectedActor, tappedThing) -> Task, with a registry per target type (stove, readyFood, counter, sink, table, tile, customer). Add contextual radial/button cards on bare taps (stove: Cook/Finish/Serve-shortcut; customer: Infect $cost/Info; zombie: Info/Rest). Replace kitchen-chance infection with the tap->Infect button using per-type costs from the customer data. Add selection groan SFX + bounce — it's the most remembered feedback in the game.
- **Status: PARTIAL — tap-select-then-target grammar and Toxin infect verb shipped; contextual button cards, info card, selection SFX deferred.**

### 10. Progression is servings-count, not XP; recipes and staff cap aren't driven by the real economy
- Original: Cafe levels come from XP earned by cooking (1/3) and serving (2/3), purchases (+8 XP furniture), and raids; XP curve is documented (L1 100, L5 2400, L10 4575...). Leveling unlocks recipes (level-gated cookbook), higher staff caps (1 -> ~12), new customer types, and store items. Zombies separately level from serves (+max energy).
- Ours (pre-pass): Level up every 6 servings flat; dish unlocks hang off that; no XP anywhere despite per-dish xp already in our JSON.
- Plan: Add xp/level to game state using the JP wiki curve table (store as data/levels.json). Award dish XP per the 1/3–2/3 split (gaps 2/1), +XP on furniture purchase. Drive from level: cookbook gating (already per-dish), staffCap table (1,2,2,3,3,4... to 12), customer pool tiers. Add per-zombie xp (1/serve) -> level -> +maxEnergy +full refill with a small 'level up!' burst. This retires the 6-servings hack and makes every existing data field meaningful.
- **Status: OPEN — XP-based cafe leveling (1/3 cook + 2/3 serve split, curve table) still the 6-servings placeholder.**

