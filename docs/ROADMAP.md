# Deadbeat Diner — Roadmap (v2)

> This is the index. The implementation-ready plan lives in **[`docs/spec/`](spec/)** —
> seven system specs, adversarially reviewed and revised, plus the review findings and
> the canon constants document. **Where any spec conflicts with `spec/00-canon.md`,
> canon wins.** Build from `spec/07-build-order.md`.

## The spec set

| Doc | System |
|---|---|
| [`00-canon.md`](spec/00-canon.md) | **Single-authority constants** — tile dims, time model, rating scale, XP curve, dish economy, expansion ladder, Toxin economy, save-version registry |
| [`01-isometric-engine.md`](spec/01-isometric-engine.md) | Tile-based isometric foundation (pure-TS `src/engine/` + thin `src/view/`) — **priority #1** |
| [`02-service-loop.md`](spec/02-service-loop.md) | Stoves, pay-then-cook, servings, burn windows, tap-to-dispatch serving, seats, patience |
| [`03-infection-staff.md`](spec/03-infection-staff.md) | Occupation-tiered infection, zombie energy/feral, roster, Meat Locker, leveling |
| [`04-progression-content.md`](spec/04-progression-content.md) | Cafe Level + Star Rating, cookbooks (all 320 dishes), quests/Toxin faucets, Zombiepedia, pets, expansion |
| [`05-raids.md`](spec/05-raids.md) | World map, tap-to-command combat, loot/recipe theft, defense |
| [`06-presentation.md`](spec/06-presentation.md) | Art bible, modular tile/wall/furniture assets, sprite sheets, UI kit, VFX, audio, juice |
| [`07-build-order.md`](spec/07-build-order.md) | **The milestone plan** (below) with acceptance criteria per milestone |
| [`90-review-findings.md`](spec/90-review-findings.md) | The 86 adversarial-review problems the canon pass resolves |

## Milestones (from `spec/07-build-order.md`)

| # | Milestone | Player-visible outcome |
|---|---|---|
| M-R | **Reconciliation pass** | Canon constants locked (runs alongside M0) |
| M0 | **Rails & Rename** | Test/CI/save-durability infrastructure; licensing position; save export/import |
| M1 | **The Room Is Real** | True isometric tiled room replaces the painted backdrop — per-tile floors, real walls, door tile |
| M2 | **Shamble & Seat** | A* pathfinding, authentic shambling movement, seats, freeze-when-blocked |
| M3 | **Build & Decorate** | Ghost-preview placement, footprints, move/sell, layout persistence |
| M4 | **One True Clock** | Simulation extracted from rendering; one time model; robust offline settlement |
| M5 | **The 2011 Dish Economy** | Pay-then-cook, servings, burn windows, the classic menu (Mystery Meat onward) |
| M6 | **Infect the Clientele** | Tap-to-infect with occupation cost tiers — the identity mechanic |
| M7 | **Energy, Rating & the Feral Failure** | Zombie energy loop, star rating, the feral-attack consequence |
| M8 | **Alive & Loud** | Full art/animation/audio/UI pass — the glow-up |
| M9 | **Raid the Rivals** | PvE raids with tap-to-command combat |
| M10 | **The Long Tail** | Zombiepedia, combining, pets, favorites, variations |
| M11 | **Open for (Un)Death** | Launch hardening: onboarding polish, settings, browser matrix, perf budget |

Every milestone leaves the live game playable and visibly better. The live build ships
continuously to https://qemmhd.github.io/zombie-cafe-game/ on every push.
