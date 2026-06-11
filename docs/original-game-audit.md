# Original-Game Audit — *Zombie Cafe* (Beeline/Capcom, 2011) vs. *The Rotten Spoon*

> Mechanics research compiled from public wikis/guides (sources at bottom),
> written in our own words. Goal: learn every system of the original, compare
> against our build, and produce a prioritized optimization plan. Per
> `ip-and-originality.md`: mechanics/systems are reusable; names/art/text are not.

---

## 1. How the original works, system by system

### 1.1 Energy (the core constraint)
- Every zombie has an energy bar (shown red when tapped). It **drains while
  working** (cooking AND serving) and **drops when hit during raids** — energy
  doubles as raid HP.
- Recovery: **rest** over time, or spend **Toxin** for an instant refill.
- If energy gets too low, the zombie **attacks customers**, which scares the
  others away and **drops the café rating** — the signature risk loop.
- Zombie types vary widely: max energy in the hundreds (e.g. ~500+ for top
  types), plus per-type **tip rating, speed, attack strength**, and special
  bonuses like **+regen %** or **tip multipliers**.

### 1.2 Toxin (premium currency, many sinks)
- Sinks: instant energy refill, instant-finish cooking, **infecting customers**,
  **bribing the reviewer** (2 per incomplete task).
- Sources are scarce: a small tutorial grant, occasional goals/raid rewards,
  else IAP. Scarcity is what makes every spend a real decision.

### 1.3 Cooking
- Pay dish cost → wait real-time → food ready on stove → **must be served or it
  is ruined** (our "burn"). Dish = cost / cook time / servings / XP.
- **Cooking is the #1 XP source**; the community meta was "always be cooking on
  every stove."

### 1.4 Recipe VARIANTS (the big strategic layer we lack)
Each recipe exists in ~10 versions:
| Variant | Effect |
|---|---|
| Normal | baseline |
| Spicy / Very Spicy | +10% / +20% total XP |
| Fancy / Very Fancy | higher cost, higher total earnings |
| Bulk | ~double cost, ~double earnings AND XP for the same cook time |
| Fresh | longer grace before the dish is ruined |
| Frozen | double cook time, reduced price |
| Quick / Very Quick | −10% / −20% cook time |

Meta: **Quick/Very Quick = best XP/hr** (grinding), **Bulk = best
earnings/hr**, Fancy second for cash. This created real build-choice depth.

### 1.5 Customers
- Many types — normal humans plus **supernatural rare guests** (mummies,
  vampires, aliens, heroes…). **Which types appear depends on level AND café
  rating** — rating literally upgrades your foot traffic.
- **Infection is recruiting**: early/tutorial customers free, later types cost
  cash or toxin; the resulting zombie inherits the customer's profile
  (athletic types = strong fast raiders; lazy types cheap but **daydream more**;
  tough types = high health but fewer tips).

### 1.6 Rating (stars, upper-left)
- Rises from happy customers; falls from dissatisfaction and zombie attacks.
- Gates: number AND quality of customers, plus **hire requirements** (zombie
  types in the catalog demand minimum café rating + player level).

### 1.7 Review / bonus stars (level 6+)
- A "to do" board of **4 random tasks** (raid X, serve X, cook X, spend X,
  friend fees). Completing all four grants a **purple bonus star** (stack up to
  3; they **decay over time**). You can **bribe the reviewer: 2 toxin per
  incomplete task**.

### 1.8 Raids (a real tap-combat scene)
- Pick a rival café on the map → squad enters the rival's room.
- Controls: **tap zombie → tap a person = focused attack**; an **Attack button =
  everyone piles in randomly**; **tap counter food = steal that dish**.
- Enemy staff are weak; the **head chef is the boss** — beat the boss to win.
- **White flag** (upper-left) = retreat. Energy = HP; hits drain it.
- **Losing still pays partial cash** if you took customers down first.
- Loot lands in the **fridge**: each dish can be **Served** or — if unknown —
  **Unlocked** into your recipe book (Unlock button only shows for new recipes).

### 1.9 Zombiepedia (collection catalog)
- Every zombie type listed with energy / tip rating / speed / attack / price /
  café-rating requirement / level requirement. Collection = motivation.

### 1.10 Pets, social, extras
- **Pets**: purchasable companions that fight in raids (don't staff the café).
- **Social**: friend franchises, collecting fees, shared recipes; friend-flavored
  review tasks; daily-play streak bonuses.
- **Gacha** (JP version, level 8): random zombie for cash/toxin.
- **Expansion**: buy bigger café footprints from the store.

---

## 2. Side-by-side: original vs. ours

| System | Original | Ours today | Verdict |
|---|---|---|---|
| Energy drain working | cook + serve + raid hits | serve/carry/clean (not cooking; no raid HP) | 🟡 partial |
| Low-energy attack/scare | yes → rating drop | yes (scare + daydream, patience stat) | ✅ |
| Rest / toxin refill | yes | yes (rest role, coffin cot, feed) | ✅ |
| Toxin sinks | refill, rush, infect, bribe | refill, rush, infect, staff slots | ✅ (bribe later w/ review) |
| Cook→ready→ruin | yes | yes (burn warning → burned → clear) | ✅ |
| Serving counts over food | yes | ✅ added (stove batch + pass total badges) | ✅ |
| Recipe variants (10) | yes — core depth | none | ❌ **P1 gap** |
| XP-vs-cash recipe meta | quick=XP, bulk/fancy=cash | quick dishes win both | 🟡 tuned this pass |
| Customer variety | huge incl. supernatural, gated by rating | 10 archetypes, level+rating gated | 🟡 add rare/supernatural tiers |
| Infection = recruiting | costs scale, stats inherited | ✅ identical model | ✅ |
| Trait→behavior (daydreamers) | lazy types daydream more | patience stat drives it | ✅ (wire more traits) |
| Rating gates traffic+quality | yes + hire requirements | traffic/tips/types ✅; no hire reqs | 🟡 |
| Review board / bonus stars | 4 tasks, +1 star (max 3, decay), bribe | none | ❌ **P1 gap** |
| Raid battle scene | tap-combat, boss, steal, retreat, partial loss pay | timer + power formula | ❌ **P1 gap** |
| Fridge serve/unlock | yes | ✅ identical | ✅ |
| Zombiepedia | full catalog + requirements | none | ❌ P2 |
| Pets | raid companions | none | ❌ P2 |
| Expansion | bigger footprints | fixed room | ❌ P2 |
| Social/franchise | friends/fees | n/a (offline game) | ⬜ out of scope |
| Gacha recruit | random zombie for toxin | none | P3 idea: "mystery coffin" |
| Daily streak bonus | yes | none | P3 |

---

## 3. Prioritized adoption plan

**P1 — gameplay-defining (next builds)**
1. **Recipe variants** — 9–10 modifiers per dish exactly as the table above
   (our own names); recipe picker gains a variant row. Restores the XP/hr vs
   $/hr strategy layer. Mostly data + small cook-flow change.
2. **Raid battle scene** — replace the power formula with the real loop: squad
   enters rival room → tap zombie → tap target (staff/boss/counter-food) →
   energy-as-HP → white-flag retreat → boss kill wins → partial cash on loss →
   loot to fridge. (This was already Stage 9 of the plan; the audit confirms
   its exact grammar.)
3. **Review board** (level 6): 4 random tasks, purple bonus star (max 3,
   slow decay), bribe = 2 toxin per incomplete task.
4. **Zombie depth**: per-type max energy spread (ours barely varies), tip
   rating, regen/tip-multiplier special bonuses; hire requirements (min café
   rating + level) on premium staff.

**P2 — strong flavor**
5. Cooking drains the cooking zombie (assign a zombie to a stove cook).
6. Rare/supernatural customer tier gated by 4–5 stars (our own designs).
7. Zombiepedia-style collection book (our "Zombidex") with silhouettes.
8. Café expansion footprints. 9. Pets as raid companions.

**P3 — retention extras**
10. Daily play bonus. 11. Toxin-gacha "mystery coffin" recruit. 12. Friend
    systems only if the game ever goes online.

## 4. Optimizations applied in this commit
- **Serving-count badges** (parity item): count above finished stove food and a
  total-servings badge above the pass — matches the original's at-a-glance
  inventory readout.
- **Recipe economy retune**: long dishes' prices raised so slow recipes become
  the best *coins-per-cook* (idle play) while quick dishes stay the best
  *XP/hr* (active play) — recreating the original's core tradeoff even before
  variants land.

## 5. Round 2 — deeper findings (all the details we could dig up)

### Timing & numbers
- **Burn rule**: finished food survives on the stove for roughly **one extra
  cook-time** (community rule of thumb: gone by ~2× cook time). The grace is
  **proportional to the recipe**, not flat — quick dishes are fragile, slow
  dishes forgiving. The *Fresh* variant extends this window. → **Adopted in
  this commit** (grace = cook time, min 8s; warning at 60%).
- **Reanimation**: a zombie/pet that dies in a raid reanimates in **8 hours**
  (later patched to ~1 hour) and heals gradually after returning.
- **Stat ranges across the catalog**: energy roughly **50–1250**; tip rating /
  speed / attack on a **1–12** scale. Huge spreads = collection motivation.

### Zombie progression (we lack this entirely)
- Zombies have their **own XP/levels**: ~1 XP per customer served, ~2 XP per
  raid kill (raid kills also pay ~$20 each). **Leveling fully recharges
  energy.** Serving is the fastest way to level staff.
- **Merging**: combining identical zombies grants stat bonuses, maxing out
  after consuming four duplicates — a collection/dupe sink.

### Sink & bussing (mechanic we simplified)
- Dirty dishes are **carried to the SINK** — servers need a clear path to
  every table, the serving counter, **and the sink**. Bussing = pick up plate →
  walk to sink, not wipe-at-the-table (ours cleans in place). → P2 change:
  make the sink functional and route cleaners through it.
- Serving controls: tap zombie → tap **counter / sink / table** to direct it.

### Store & economy infrastructure
- Store sections: **Featured / Decor / Utility / Furniture / Walls-Floors /
  Special** — Special holds outdoor props (tombstones), **pets (via pet
  houses)**, **expansion**, money generators (ATM / vending machine), and
  premium toxin items.
- **Expansion**: starts ~7×8 and grows step-by-step to a **17×16** maximum with
  steeply rising prices.

### Pets (9 total)
- Bought as **pet houses** in Special; pets discount cooking costs, boost tips
  or buff café/raid stats, and **fight in raids** like zombies (with combo
  gimmicks for themed sets). They never cook/serve.

### Raids — extra rules
- Defeated zombies/pets are casualties → 8h reanimation; squads should rest to
  full energy first (energy = HP).
- A defeated rival café **closes temporarily, then reopens** as a new café.
- Losing still pays cash per customer/staff eaten before the wipe.

### Content scale at end of life (targets for our content roadmap)
- ~**320 recipes** across **21 cookbooks**, **88 chefs**, **225 infectable
  customer types**, **9 pets**, **20+ raidable cafés**.

### Updated adoption list (delta from §3)
- **Done now**: proportional burn grace (2× rule); 1×1 serving counters with
  one stack per square (user-confirmed faithful behavior).
- **P1 add**: zombie XP/levels (+full recharge on level-up) — cheap, deep.
- **P2 add**: functional sink bussing (carry plates to sink); duplicate-merge
  stat bonuses; money-generator props (ATM-style); expansion tiers toward a
  large max grid.

## 6. Round 3 — reference-screenshot findings (verified from owner-supplied refs)

These came from direct observation of original-game screenshots; treat them as
ground truth where they conflict with wiki text.

### Map / exterior
- The café sits on a **street corner**: road runs along **two sides only**
  (not a ring). The remaining sides are **grass — that grass is the
  expansion land** the player buys square-by-square. *(Adopted: corner-street
  ground in our renderer; expansion tiers stay P2.)*

### Customer identity & info cards
- Every customer **type** has its own info card with: a **health bar shown as
  cur/max** (e.g. a common at 85/85, an armored elite at 350/350), **Tip
  Rating**, **Attack Speed**, **Attack Strength**, one line of flavor text,
  and an **infect cost in CASH** that scales hugely with rarity — roughly
  **$500** for a tough common (the Boxer) up to **$95,000** for the Knight in
  Armor. Health on the card doubles as the zombie's energy pool when
  infected.
- **Rare customers are visually unmistakable** — the Boxer wears gloves, the
  Knight wears full plate. They are not palette swaps of the base walker.
  *(Adopted: Brawler elite with unique gloves/mohawk/build + cash infect cost;
  more uniques to follow.)*

### Tables & chairs
- **One chair per table** — one dish on the table, one diner. The chair
  **attaches to a specific table across a small gap**, sitting on its own
  square adjacent to the table, so ownership is visually obvious.
- Tables **can pack side-by-side**, but each table must keep **one open side
  for its chair** to connect. *(Adopted: chair-as-attachment on the south
  square + 'blocked' chairState + layout warning.)*

### Raid deployment & mid-raid recharge
- Your raid squad **lines up outside on the sidewalk** of the target café.
  You deploy zombies **one at a time** by selecting them — not as a blob.
- The raid UI on a selected zombie offers **ATTACK**, **INFO**, and
  **ENERGIZE**: Energize spends toxin to **recharge that zombie's energy
  mid-raid** (energy is HP, so this is a mid-fight heal). *(P1: drives the
  raid battle-scene design — sidewalk line-up, one-by-one send-in, Energize
  button.)*

### Updated adoption list (delta from §5)
- **Done now**: corner-street exterior; chair-gap attachment + one-open-side
  rule; first visually-unique elite customer (Brawler) with cash infect.
- **P1 (raid scene spec is now concrete)**: sidewalk line-up → one-by-one
  deployment → ATTACK / ENERGIZE (toxin → energy) / INFO per zombie.
- **P1 add**: per-type customer stat cards (health cur/max, tip rating, atk
  speed/strength, flavor text, cash infect cost) surfaced in the infect
  panel and Zombiepedia.

## 7. Round 3 — web research: confirmed numbers, corrections, adoption status

### Now ADOPTED in our build (this session)
- **Zombie XP/levels**: +1 XP per serve, +2 per raid kill (chef kills pay
  more); level-up = full energy recharge + stat bump. ✅
- **Customer info cards**: health cur/max (= zombie energy pool), Tip Rating /
  Atk Speed / Atk Strength on the 1–12 scale, flavor text, in the recruit
  panel. ✅
- **Recipe variants** with the CONFIRMED multipliers: Spicy +10% XP / Very
  Spicy +20%; Bulk = double cost + double batch for the cook time of ONE;
  Frozen = 2× cook time at −25% price; Quick −10% / Very Quick −20% time.
  Fancy's % and Fresh's grace factor were never documented — ours are
  estimates (Fancy +25/+50% price, Fresh 2× grace). ✅
- **Review Board**: level 6, 4 random tasks from the confirmed pool (serve N /
  cook N of a dish / spend / earn / raid / infect — social tasks dropped),
  purple bonus stars max 3 that fade with time, bribe = 2 toxin per task. ✅
- **Live raid battles** replacing the timer raid: sidewalk line-up →
  one-by-one deployment (send-all also exists, as in the original), tap an
  enemy to retarget, auto-melee with energy-as-HP and Atk-Strength-as-flat-
  damage, weak waiters + head-chef boss who holds the kitchen line, tap the
  counter to steal food, ENERGIZE mid-raid toxin refill, white truce flag,
  eaten cash kept win or lose, downed zombies reanimate in the Meat Locker
  and return at low energy. ✅

### Confirmed details worth keeping on file
- Raid rewards: each customer/staff eaten = ~$20 + 2 zombie XP + a bite of
  energy; head-chef kill = big XP (150 for a normal zombie); 3–4 toxin drops
  for clean wins; rare Vial (merge item) chance on chef kills, lower against
  weaker rivals. Reanimation was 8h originally, patched to 1h (ours: scaled
  to 10 min); the fallen return at energy 20 — ours matches via the
  Meat-Locker assign rule.
- Customer infoboxes recovered (energy / tip / speed / atk / cost): Composer
  525/10/6/5 (30 toxin), Astronaut 550/7/4/7 (35 toxin), Pure Blood vampire
  650/8/7/7 (35 toxin), Fortune Teller 700/9/7/7 (35 toxin), Black Knight
  500/6/3/7 (**$2,000,000 cash**). Cards also carry Tip Multiplier (×2–×3),
  Zombie Regen (+10…40%) and Cook XP (+%) passives — a P2 idea for our
  trait system. NOTE: the web could not corroborate "Boxer 85/85 · $500" or
  "Knight in Armor 350/350 · $95,000", but the owner's reference screenshots
  show them directly — screenshots stay primary evidence; web suggests a
  cash-infect knight tier topping out far higher.
- Energy economy: drain ~1 energy/20 s while working, rest regen the same
  (a Toxin Barrel prop doubles it); daydream frequency scales with low
  energy plus a hidden per-zombie **Focus** stat (first daydream at focus ×
  1 min into a job); hidden **Patience** stat sets the snap threshold
  (attacks a customer at 2–20% energy). Feeding zombies from the fridge does
  NOT exist in the original — toxin refills only (matches our feed/energize).
- Meat Locker: 5 hooks free, +5 per 5 toxin, max 100.
- Expansion: unlocks at level 7, bought with cash square-by-square up to
  17×16; the per-step price table is lost to time.
- Tutorial: hosted by the zombie "union rep" mascot; first cook is a
  2-minute starter dish; the game hands you 1 toxin and prompts an instant
  FINISH (waiting it out keeps the toxin); first infection is free.
- Variants were unlocked by raiding (Raid Cookbook) or bought at 5 toxin per
  variety / 45 toxin for all versions of one recipe — an alternative to our
  level gating worth considering at P2.
- Money props (ATM) generate cash faster with the doors open; JP-only gacha:
  $1,500 random 1–5★, 30 toxin 5–7★, 300 toxin 11-pull.

### Remaining genuine gaps (no surviving data — do not fabricate)
Expansion price table; in-raid Energize exact toxin cost; review-board task
timers and bonus-star decay rate; Boxer's numeric stats (owner screenshot is
the only source); exact Fancy earnings %.

## Sources
- [Zombie Cafe — Wikipedia](https://en.wikipedia.org/wiki/Zombie_Cafe)
- [Zombie Cafe Wiki (Fandom) — main](https://zombiecafe.fandom.com/wiki/Zombie_Cafe), [Energy level](https://zombiecafe.fandom.com/wiki/Energy_level), [Toxin](https://zombiecafe.fandom.com/wiki/Toxin), [Recipe](https://zombiecafe.fandom.com/wiki/Recipe), [Raid](https://zombiecafe.fandom.com/wiki/Raid), [Rating](https://zombiecafe.fandom.com/wiki/Rating), [Customers](https://zombiecafe.fandom.com/wiki/Customers), [Zombie](https://zombiecafe.fandom.com/wiki/Zombie), [Gacha](https://zombiecafe.fandom.com/wiki/Gacha), [Couch Potato](https://zombiecafe.fandom.com/wiki/Couch_Potato), [Astronaut](https://zombiecafe.fandom.com/wiki/Astronaut), [Composer](https://zombiecafe.fandom.com/wiki/Composer)
- [Capcom Database — Zombie Cafe](https://capcom.fandom.com/wiki/Zombie_Cafe)
- [Zombie Cafe Wikidot — Attacking](http://zombiecafe.wikidot.com/attacking), [Acquiring Vials](http://zombiecafe.wikidot.com/acquiring-vials), [Fast Leveling guide](http://zombiecafe.wikidot.com/forum/t-318977/general-guide-to-fast-leveling), [Zombie Stats](http://zombiecafe.wikidot.com/forum/t-362331/zombie-stats)
- [TapGamers — Zombie Cafe Guide](https://www.tapgamers.com/?p=2699)
- [GameFAQs boards — Recipe variations](https://gamefaqs.gamespot.com/boards/620809-zombie-cafe/58252844), [The Zombies Guide](https://gamefaqs.gamespot.com/boards/620809-zombie-cafe/58189845), [Long-term Toxin Planning](https://gamefaqs.gamespot.com/boards/620809-zombie-cafe/58115233)
- Round 2: [Pets (Fandom)](https://zombiecafe.fandom.com/wiki/Pets), [Café/expansion (Fandom)](https://zombiecafe.fandom.com/wiki/Caf%C3%A9), [Store sections (Fandom)](https://zombiecafe.fandom.com/wiki/Store), [Dishes (Fandom)](https://zombiecafe.fandom.com/wiki/Dishes), [Zombie leveling (Wikidot)](http://zombiecafe.wikidot.com/forum/t-366601/zombie-leveling), [Zombie stat info](https://zombiecafefacts.webs.com/zombie-stat-information), [Table/sink placement (Wikidot)](http://zombiecafe.wikidot.com/forum/t-312548/tables-sink-and-counter-placement)
