# Reference Analysis — *Zombie Cafe* (Beeline, 2011)

> The screenshots are **copyrighted reference only** and are NOT committed (see
> `references/.gitignore`). This document is the durable, legally-safe record of
> what they show, so every screen of our **original** undead-café tycoon can be
> built and compared against a concrete target. We capture *structure, density,
> composition, interaction grammar and art language* — never the exact art,
> names, dialogue, logos or recipes.

Source set: ~35 screenshots (BlueStacks capture, landscape; the game itself is a
portrait/landscape mobile title). Player café observed at Level 1 (tutorial) and
Level 61 (endgame raid), so the set spans the whole progression.

---

## 0. Cross-cutting visual language (applies to every screen)

- **Art**: hand-drawn, painterly **2.5D** cartoon-horror. Thick dark uneven
  outlines, visible brush/grain texture, grime everywhere. NOT vector-clean.
- **Lighting**: single soft key from upper area; top planes lighter, side/front
  planes darker, soft contact shadows ground everything.
- **Top HUD**: a **maroon/burgundy scalloped bar** (looks like a row of rounded
  drips/awning bumps) with cream bold text + thick outlines. Always present in
  world screens.
- **Currencies**: green **$** (cash) and a green **toxin** flask/"+" (premium).
  Big numbers, green pill chips.
- **Right badge**: a circular **"ZC" green logo coin** top-right.
- **Bottom panels**: **chalkboard/blackboard** slabs in a **wood frame**, white +
  green chalk text. Primary actions = **green** buttons; close/cancel = **red X**
  or red BACK arrow; destructive = red.
- **Popups**: dark framed board + **pinned torn-paper card(s)** with red pushpins,
  big bold title, green OK / SHARE, red X.
- **Tone**: comedic horror — gross food, drooling zombies, dead-eyed but funny.

---

## 1. Home Café (`home-cafe/`)
**What it shows:** a **cutaway isometric room** — two back walls meeting at a
corner, open front edge, **gray tiled floor**, and the room is embedded in an
**exterior**: gray **road with yellow centre-lines**, **sidewalk slabs**, **green
grass** patches around it. The café is a small dirty restaurant inside a city block.
- **Walls**: yellow (early) / maroon (raid enemy), with **cracks, claw gashes,
  boarded planks, green slime drips, brown stains**.
- **Floor**: gray tiles with **smears, blood/grime decals, scuttling rats**.
- **Appliances** line a wall: **stove/oven with a steel pot**, **sink with dirty
  green water + faucet**, **stained fridge** (tall, side+front+handle), **prep/
  serving counters** (blue-topped), trash.
- **Characters**: zombie staff + human customers, big-headed, walking in 3/4,
  seated at tables (partly behind the table edge), carrying plates in-hand.
- **Tables/chairs**: square wooden tables with thickness + side faces; separate
  chairs with backrest/seat/legs; **plates/food/dirty stains on the table top**.
- **HUD**: café name "YOUR CAFÉ", **star rating** (e.g. 1 dim star → 5 purple
  filled), **level number** in a chip, **XP bar**, **$cash**, **toxin**, ZC badge.
- **Left side**: stacked **illustrated icon buttons** (shopping bag = store,
  clipboard = tasks, map = raid, etc.) plus **count badges** (e.g. zombie head
  "1/1", "2/2").
**State purpose:** the main hub; tap zombies/objects to command; everything else
is reached from the side icons and bottom panels.
**Our gaps:** exterior framing (road/grass/sidewalk) is missing; walls/floor are
too clean (no cracks/slime/stains/decals); appliances read as boxes not grimy
illustrated units; HUD is not the maroon scalloped style; side icons are small.

## 2. Tutorial — Giant Undead Chef (`tutorial/`)
**What it shows:** a **huge cropped portrait of an undead chef** on the LEFT
(green face, droopy yellow eyes, blue tongue, **white chef toque**, grimy chef
coat, **holding a pink/steel spatula**), overlapping the world. A **chalkboard
dialogue bar** spans the bottom with short, bossy, playful instructions, and a
**red arrow / highlight** points at the relevant object. Big green **OK**.
Examples of steps shown: "tap zombie → stove", "buy another stove", "ugly dead
plant making customers unhappy — hold to move, drag to store to sell", "touch
the customer and infect", "your zombies took food from that rival café — touch
the fridge", "make room… put old zombies in cold storage — tap the Meat Locker".
**Purpose:** visual, touch-guided onboarding voiced by a mascot.
**Our gaps:** no mascot guide, no chalkboard dialogue bar, no pointing arrows, no
scripted multi-step tutorial.

## 3. Build / Store Tray (`build-store/`)
**What it shows:** the room stays visible; a **bottom tray** slides up with
**category tabs** across the top of the tray: **FEATURED · DECOR · UTILITY ·
FURNITURE · WALLS/FLOORS · SPECIAL** (red maroon tab chips, active one lit).
Below: a horizontal **strip of item thumbnails** (illustrated tables, chairs,
appliances, slime barrel, vending machines) each with a **green $ price** under
it; **locked items show a dark padlock silhouette**; **left/right red arrows** to
page; a **red X** close. Tapping an item enters placement.
**Our gaps:** our store is a modal list with tabs but not the bottom **thumbnail
tray over the live room**, no locked silhouettes, no paging arrows.

## 4. Placement Mode (`placement/`)
**What it shows:** after picking an item, a **semi-transparent ghost** of the
object follows the finger. The target footprint shows **green tiles = valid**,
**red tiles = invalid/blocked**. The bottom **black panel** names the item ("Just
a regular ol' chair."), gives **TOTAL COST $100 / +2XP**, and a **green PURCHASE**
button; "DRAG THE NEW ITEM TO PLACE IT." A green circular **rotate/refresh** icon
appears. Special items (toxin slime barrel) cost **toxin** and show "+2000XP".
**Our gaps:** no ghost preview that follows input, no per-tile green/red overlay
during drag (we only warn after), no cost/XP placement panel, no rotate.

## 5. Café Expansion (`expansion/`)
**What it shows:** selecting expansion draws a **green outline of the new, larger
café footprint** over the world; bottom panel: "THIS EXPANDS THE SIZE OF YOUR
CAFE TO 8X7." with **TOTAL COST $3500 / +0XP** and green **PURCHASE**. Buying
grows floor + walls + exterior.
**Our gaps:** no expandable café footprint at all (fixed grid).

## 6. Cookbook (`cookbook/`)
**What it shows:** a **full-screen recipe book** — aged paper pages, a **wood
shelf header** with **cookbook category icons** (fork/knife = general, green hand
= special/raid). A central **title plate** "THE GENERAL COOKBOOK" and a **RANK**
("Fresh Corpse Chef"). A horizontal **strip of recipe slots** (cooked = dish art,
locked = numbered dark slot 3/4/5/6, page count "2/80"). Selected recipe shows a
**big dish illustration**, **stylized name** ("DISHWATER SOUP"), **LEVEL**, **READY
IN** (15M), **SERVINGS** (50), **TOTAL EARNINGS** (150), **TOTAL XP** (5), and a
**green COOK** button. A bottom row of **variant tokens** (normal, spicy, fancy,
bulk, fresh, frozen, quick… shown as little flask/leaf/snowflake/anvil icons).
**Our gaps:** our cookbook is a plain list; no book/paper UI, no cookbooks/ranks,
no recipe slots strip, no variant tokens, no big dish card.

## 7. Raid Map (`raid-map/`)
**What it shows:** a **full-screen isometric neighbourhood** — gray roads with
yellow lines, **parking-lot hatching**, sidewalks, hedges/grass, and **small café
buildings** with **rooftop café signs** and **printed labels** ("YOUR CAFÉ /
LEVEL 2", "BARRY'S CAFÉ", "ENEMY CAFÉ", "EUGENE'S CAFÉ", "RANDOM CAFÉ",
"PETER432 / LEVEL 26"). Friends' cafés show **REOPEN timers**; **INVITE FRIENDS /
EARN TOXIN** slab; **LEADERBOARD** button; red **BACK**; paging arrows.
**Our gaps:** our raid screen is a list of rivals, not a navigable iso city map.

## 8. Raid Battle (`raid-battle/`)
**What it shows:** a **separate isometric enemy-café scene**. Your **zombie squad
(and pets — undead dog, bone cat)** enter; enemies (rival staff/customers) defend;
units have **green/red health bars** over them; **skull burst** marks a defeated
unit. Bottom **black action panel** shows the **selected unit name** ("LOLA",
"CURRIE", "YOU") + a red **health bar** + state ("ATTACKING") and three big green
buttons: **ATTACK · ENERGIZE · INFO**; a **white flag retreat** + red X. Endgame
shows **SEND ALL ZOMBIES**, a big horde (13/14), gravestones/hooks, a boss.
**Floating loot popups** ($299, +toxin) appear on hits. Grammar = **tap zombie →
tap Attack → tap target**.
**Victory popup:** dark board, "YOUR ZOMBIES WON! HERE'S WHAT THEY STOLE:",
pinned dish card ("LEFTUNDERS"), **$40**, **+1 toxin**, **OK/SHARE**.
**Our gaps:** our raid is a timer + power formula; there is no battle scene,
no tap-combat, no attack/energize/info, no white-flag retreat, no pets, no loot popup.

## 9. Fridge / Raid Loot (`fridge-loot/`)
**What it shows:** an **open fridge** interior (wire shelves, frost) with the
stolen dish: name ("LEFTUNDERS"), a **down red arrow**, **SERVE** (green) and
**UNLOCK** (green) options with numbers (Serve 75 / Unlock 225). Tutorial chef
explains "serve food or save it / unlock to add to your recipe book — you won't
serve it but you get a valuable recipe."
**Our gaps:** we have a fridge inventory + serve/unlock already (good), but it's a
plain modal — not the fridge-interior framing.

## 10. Meat Locker / Cold Storage (`meat-locker/`)
**What it shows:** a **cold blue-gray storage room** titled **MEATLOCKER** with a
metal sign, **frosted cracked-glass case**, a rail of **hanging hooks** (5 hooks,
counter **0/5**), a black **info slab**, **ADD 5 HOOKS** (green) using toxin, and
red **BACK**. Stored zombies hang on hooks.
**Our gaps:** our roster/locker is a sheet of cards; no cold-room theme, no hooks,
no capacity counter/upgrade visual.

## 11. Zombiepedia (`zombiepedia/`)
**What it shows:** a **tabbed scrapbook** "THE ZOMBIEPEDIA — FEATURED ZOMBIES"
with side tabs (FEATURED / THEMED / ALL). Grid of **zombie cards**, undiscovered
shown as **dark silhouettes** with **UNLOCK AT: Player Level X / Café Rating Y**
(e.g. Supper Girl rating 2; Henchman Lv10 rating 2; Shadow Skull Lv12 rating 3…).
Red X close, page badge.
**Our gaps:** no collection book at all.

## 12. Review / Task Board (`review-board/`)
**What it shows:** "NEXT CAFE BONUS:" — a **dark board** with a **pinned yellow
"TO DO:" note** listing tasks (RAID 2 ENEMY CAFÉS 0/2, COOK 5 DISHES OF …, SERVE
10 CUSTOMERS 0/10, INVITE 1 FRIEND 0/1) each with a small green **progress chip**;
a side **café rating card** (1 star). **% COMPLETE** footer. Green **GET REVIEW**
when 100%, or **BRIBE REVIEWER** (toxin) to skip. Completing grants a temporary
bonus star.
**Our gaps:** no task/review system or bonus stars.

## 13. Level-Up Popup (`level-up/`)
**What it shows:** a big **dark framed board**, green check, **"LEVEL UP!"**,
"YOUR CAFÉ HAS REACHED **LEVEL 9**", a **pinned torn-paper card** "YOU CAN NOW
COOK:" with a **dish illustration + name** ("Gnasty Gnocchi", "Green Eggs & Sam"),
"CHECK YOUR COOKBOOK AND THE STORE FOR NEW OPTIONS!", green **OK**, **SHARE**.
**Our gaps:** we have a small level banner; not this framed pinned-card reward moment.

## 14. Infection / Recruitment (`infection/`)
**What it shows:** tap a customer → a **thought bubble** (happy face = recruitable)
+ a big green **INFECT** button (toxin icon) in the corner; bottom panel names the
customer ("CURRIE — MAN") with a red bar. Confirm → **green toxic-cloud transform**
→ customer becomes a zombie worker (inheriting hair/clothes/role). Tutorial frames
it as getting "good free labor."
**Our gaps:** we have infection + a recruit panel (good); missing the in-world
INFECT corner button + thought bubble framing and a stronger transform.

## 15. Options (`options/`)
**What it shows:** a **brick/plaster wall background**, maroon scalloped top, big
**OPTIONS** title; **MUSIC VOLUME** + **SFX VOLUME** sliders (green knob on a black
bar, numeric value); black slab buttons **NOTIFICATIONS → EDIT (green)**,
**FACEBOOK → LOGIN (green)**; **RESTART CAFÉ → DELETE DATA (red)**; red **BACK**.
**Our gaps:** no options/settings screen.

---

## Priority deltas (what most makes us look like a prototype)
1. **Exterior framing** of the café (road/grass/sidewalk) + grimy walls/floors.
2. **Maroon scalloped HUD** + **chalkboard bottom panels** + **green/red button language**.
3. **Tutorial chef mascot** + chalkboard dialogue + pointing arrows.
4. **Hand-drawn texture/grime** on every surface (kill the clean vector look).
5. **Store thumbnail tray over the live room** + **ghost placement w/ green/red tiles**.
6. **Full cookbook screen** with dish cards + variants.
7. **Raid map (iso city)** + **raid battle scene** (attack/energize/info, pets, loot popup).
8. **Themed panels**: meat locker (cold room/hooks), review board, level-up pinned card, options.
