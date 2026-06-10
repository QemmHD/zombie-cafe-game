# Screen Target Matrix

One row per screen. `Status`: ✅ done · 🟡 partial · ⬜ missing. Each screen has a
concrete acceptance test so we never call it done without proof (screenshot in
`artifacts/screenshots/current/` + checklist pass).

| Screen | Ref category | Status | Missing visual | Missing gameplay | Required UI | Animations | Acceptance test |
|---|---|---|---|---|---|---|---|
| **Home Café** | home-cafe | 🟡 | exterior road/grass/sidewalk; grimy walls/floor (cracks/slime/stains/decals); maroon HUD; big left rail | café open/closed; exterior expands | maroon scalloped HUD, left sticker rail, ZC badge | rats, slime drip, steam | café fills screen, framed by road/grass, grimy walls, dense HUD, big side icons |
| **Tutorial (Chef guide)** | tutorial | ⬜ | giant cropped chef portrait; chalkboard dialogue bar; pointing arrows | scripted multi-step flow + gating | chalkboard bar, OK button, arrow/highlight | chef mouth bob, arrow pulse | first-run runs cook→serve→infect→build steps with mascot + arrows |
| **Cooking flow** | home-cafe/tutorial | 🟡 | pot on burner, stove glow, ready ✓ / attention ! markers | finish(toxin)/discard states surfaced | bottom chalkboard cooking panel (dish/name/time/Finish/Discard) | steam, glow, ready pop | tap zombie→tap stove→pick recipe→timer panel→ready marker→XP pop |
| **Cookbook** | cookbook | 🟡 | paper book UI, shelf header, cookbook tabs, recipe slot strip, big dish card, variant tokens | cookbooks/ranks, variants, favorites | full-screen book, slots, COOK btn, locked slots, arrows | page turn | book opens with general+special cookbooks, dish card w/ stats, variant row, COOK |
| **Build Store** | build-store | 🟡 | bottom thumbnail tray over live room; locked silhouettes; paging arrows | featured tab | category tabs, thumb strip, prices, red X, paging | tray slide | store tray over the room, 6 categories, thumbnails+prices, locked padlocks |
| **Placement** | placement | 🟡 | ghost that follows finger; per-tile green/red overlay; cost/XP panel; rotate | live drag validation; rotate | placement chalkboard (name/cost/XP/PURCHASE/rotate) | ghost follow, tile flash | dragging an item shows ghost + green/red tiles + cost panel + PURCHASE |
| **Expansion** | expansion | ⬜ | green new-footprint outline over world | expandable café size | "expands to NxM" panel + PURCHASE | floor/wall grow | buying expansion grows the room + exterior |
| **Infection** | infection | 🟡 | in-world INFECT corner button + thought bubble; stronger toxic transform | — | recruit panel (have) + INFECT button | toxic cloud, shake | tap customer→bubble+INFECT→cloud→new zombie popup (stat inheritance) |
| **Roster / Cold Storage** | meat-locker | 🟡 | cold blue room, hanging hooks, capacity counter, ADD HOOKS | — | locker screen w/ hooks, upgrade, BACK | frost shimmer | open locker → active+stored on hooks, capacity X/Y, buy slots |
| **Fridge / Loot** | fridge-loot | ✅/🟡 | fridge-interior framing | — | serve/unlock/discard (have) | door open | fridge lists raid batches, Serve/Unlock(level-gated)/Discard |
| **Review / Task board** | review-board | ⬜ | dark board, pinned note, progress chips, rating card | 4 tasks, bonus stars, bribe | board, GET REVIEW/BRIBE, X | star award | board shows 4 tasks w/ progress; 100%→bonus star (timed) |
| **Level-Up popup** | level-up | 🟡 | framed board + pinned dish card | — | LEVEL UP board, OK/SHARE | pop/scale | level-up shows "reached Lv X" + unlocked dish card + OK |
| **Raid Map** | raid-map | 🟡 | iso city: roads/lots/cafés/labels/timers | choose café→enter battle; reopen timers | iso map, labels, BACK, arrows, leaderboard | — | raid opens an iso neighbourhood of café buildings w/ labels, pick one |
| **Raid Battle** | raid-battle | ⬜ | enemy café scene, health bars, pets, loot popups, skull bursts | tap-combat (attack/energize/info), retreat | bottom action panel (unit/health/ATTACK/ENERGIZE/INFO), white-flag, SEND ALL | attack lunge, hit, defeat | enter battle, tap zombie→Attack→tap enemy, health drops, loot popup, victory board |
| **Options** | options | ⬜ | brick wall bg, sliders, themed slabs | music/sfx vols, reset | OPTIONS title, sliders, NOTIF/FACEBOOK/RESTART, BACK | knob drag | options screen w/ working sliders + reset (delete data) |

## Notes
- Rows already partly built sit on the existing sim (cook/serve/infect/raid/roster/
  fridge/build all exist as logic). Most remaining work is **presentation** (the
  reason for this whole pass) plus three new gameplay screens: **tutorial script**,
  **raid battle scene**, **review tasks**.
- Build order follows `the prompt`’s Stages 3→10 / A→G; this matrix is the
  per-screen contract for each.
