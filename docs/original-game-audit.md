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

## Sources
- [Zombie Cafe — Wikipedia](https://en.wikipedia.org/wiki/Zombie_Cafe)
- [Zombie Cafe Wiki (Fandom) — main](https://zombiecafe.fandom.com/wiki/Zombie_Cafe), [Energy level](https://zombiecafe.fandom.com/wiki/Energy_level), [Toxin](https://zombiecafe.fandom.com/wiki/Toxin), [Recipe](https://zombiecafe.fandom.com/wiki/Recipe), [Raid](https://zombiecafe.fandom.com/wiki/Raid), [Rating](https://zombiecafe.fandom.com/wiki/Rating), [Customers](https://zombiecafe.fandom.com/wiki/Customers), [Zombie](https://zombiecafe.fandom.com/wiki/Zombie), [Gacha](https://zombiecafe.fandom.com/wiki/Gacha), [Couch Potato](https://zombiecafe.fandom.com/wiki/Couch_Potato), [Astronaut](https://zombiecafe.fandom.com/wiki/Astronaut), [Composer](https://zombiecafe.fandom.com/wiki/Composer)
- [Capcom Database — Zombie Cafe](https://capcom.fandom.com/wiki/Zombie_Cafe)
- [Zombie Cafe Wikidot — Attacking](http://zombiecafe.wikidot.com/attacking), [Acquiring Vials](http://zombiecafe.wikidot.com/acquiring-vials), [Fast Leveling guide](http://zombiecafe.wikidot.com/forum/t-318977/general-guide-to-fast-leveling), [Zombie Stats](http://zombiecafe.wikidot.com/forum/t-362331/zombie-stats)
- [TapGamers — Zombie Cafe Guide](https://www.tapgamers.com/?p=2699)
- [GameFAQs boards — Recipe variations](https://gamefaqs.gamespot.com/boards/620809-zombie-cafe/58252844), [The Zombies Guide](https://gamefaqs.gamespot.com/boards/620809-zombie-cafe/58189845), [Long-term Toxin Planning](https://gamefaqs.gamespot.com/boards/620809-zombie-cafe/58115233)
