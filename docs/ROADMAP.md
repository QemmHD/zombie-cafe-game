# Deadbeat Diner — 10-Update Roadmap

Sequenced by **dependency first, player-visible value second**. Each update is a
shippable release that leaves the game more complete than before. Adapted for the
**web-native (Phaser 3 + TS)** build; the game-design substance mirrors the
faithful-remake analysis in [DESIGN.md](./DESIGN.md).

**Status legend:** ✅ done in v0.1 · 🟡 partial · ⬜ not started

Art is produced with **Higgsfield** (`nano_banana_pro` → `remove_background` →
`Tools/optimize_art.py`), briefed as consistent batches for style lock.

---

### ✅/🟡 v0.1 — Foundation (shipped)
Web-native scaffold, 1,052 content entries ported to JSON, **connected
cook→serve→earn→infect loop**, **offline/idle earnings**, real Higgsfield art
(isometric room + zombie/customer/stove sprites), coins+toxin economy, HUD, saves,
GitHub Pages CI. This already fixes the original's single biggest miss.

---

### ⬜ Update 1 — *The Rename & The Real Restaurant*  · size S–M
**Goal:** Lock the brand and make serving a true restaurant step, not an eat-timer.
- Apply **Deadbeat Diner** brand everywhere (done in config; propagate to store/meta).
- **Serve step:** a Ready dish becomes N *servings*; a **server zombie carries a plate to a seated customer**, who pays **on delivery** — move payout off the stove-tap.
- **Seats:** table+chair pairs cap concurrent customers; unseated customers wait/leave.
- Split coin vs toxin rewards per dish (data already carries `brainReward`→**toxinReward**).
- **Art:** toxin serum-vial HUD icon, coin icon, "welcome back" card.
**Done when:** coins are earned only by delivering to seated diners; seats gate throughput.

### ⬜ Update 2 — *Infect the Clientele*  · size L
**Goal:** The identity mechanic — deliberate, occupation-driven infection.
- **Tap-to-infect** a seated customer → confirm panel showing the tier cost (Free / Cash / Toxin) → convert into a specific occupation zombie.
- **Occupation → zombie mapping:** occupation sets infect cost *and* the zombie's Energy/Speed/Power/Tips (author the table; commoners free, white-collar cash, celebrities/supernatural toxin).
- **Rating-gated spawns:** better occupations only appear as café level + rating rise.
- **Zombie energy loop:** working drains energy; a starved zombie goes **feral**, scaring off customers; rest regenerates, toxin instant-refills.
- **Art:** ~45 occupation customer portraits + matching green zombie forms, infection VFX, feral/flee poses.

### ⬜ Update 3 — *Grow the Grave*  · size L
**Goal:** Build & decorate — real placement, expansion, decor stats, persistence.
- Ghost-preview **grid placement** (snap, green/red validity, confirm/cancel).
- Surface the **9-tier square-expansion ladder** in-game.
- **Persist** placed furniture/tombstones/pets and rebuild on load.
- Move/sell/remove with `sellValue` refunds; decor drives **star rating**.
- **Art:** isometric furniture set (stove/counter/sink/fridge tiers, tables, chairs), decor + special items, floor/wall tile pack, 13 tombstones + 9 pets.

### ⬜ Update 4 — *Raid the Rivals*  · size L–XL
**Goal:** A working PvE raid loop.
- World map of **rival AI cafés**; real-time **tap-to-command auto-battle**; a boss as win condition; retreat/truce.
- **Loot & recipe theft** with per-target reward tables (replace the flat placeholder).
- Café **defense** when raided.
- **Art:** world map + rival pins, 3–5 battle backdrops, enemy combatant sprites, combat VFX (hit sparks, CENSORED bar, bone-pile).

### ⬜ Update 5 — *From Grime to Ghoulish*  · size XL (art-heavy)
**Goal:** Full cohesive art, animation & audio; the visible "glow-up."
- Character **animation** (shamble/serve/cook/feral; customer walk/eat/happy/sad/flee; dish cook/ready/burn; infection puff).
- **Art tiers** so the café visibly upgrades dingy → luxurious (the core reward-feel).
- Themed **UI kit**, **~60 punny dish sprites** (cook→ready→burnt), full environment art, music + comedic SFX.
- Establish sprite atlases / lazy loading to control bundle size.

### ⬜ Update 6 — *The Long Climb*  · size L
**Goal:** Progression spine.
- **Two separate meters:** Café **Level** (XP → unlocks) and Café **Rating** (stars → volume/quality, decays on neglect).
- **Level-gated cookbook ladder** (enforce `cafeLevelRequired`), authored cook-time/earnings curve (short = best rate, long = set-and-forget).
- **Zombie leveling** (author XP curves; +energy/level), rotating **bonus-star quests**.
- **Art:** cookbook browser, quest panel, level-up VFX, thought-bubbles, variation badges.

### ⬜ Update 7 — *Catch Them All*  · size M–L
**Goal:** Completionist meta.
- **Zombiepedia** collection log (customer + zombie forms, completion %).
- **Zombie combining** (merge identical for stat marks, capped at 4).
- **Pets** as a real system (habitat buffs + raid assist + leveling).
- **Favorites:** pin up to 15 recipes for fast re-cook.
- **Art:** Zombiepedia cards + silhouettes, merge VFX, final pet art, favorites strip.

### ⬜ Update 8 — *Feed the Machine*  · size L
**Goal:** Faithful, responsible monetization.
- **Toxin sinks** (instant-finish, energy refill, revive, premium infects, variation unlocks) + **faucets** (start grant, daily-login streak, raid drops) balanced so IAP feels valuable, never mandatory.
- **IAP store** with the classic price ladder ($4.99=50 … $99.99=2000), restore purchases.
- **Boosters** fixed (no downgrade overwrite) + **persisted** + actually applied to cook time.
- **Art:** IAP pack cards, booster icons + active-boost HUD chip, daily-login calendar.

### ⬜ Update 9 — *Polish the Bones*  · size L
**Goal:** Functional → shippable.
- **Onboarding tutorial** (Zombie Union Rep mascot) teaching cook→serve→infect→raid→expand.
- **Juice:** tap tweens, coin/XP/toxin fly-to-HUD, screen shake, idle fidgets, reaction bubbles.
- **UX/architecture cleanup:** one toast system, one event system, consistent init order.
- **Save durability** (versioning, corruption fallback, cloud-save stub), performance passes.
- **Art:** mascot poses, tutorial spotlight/coach-marks, juice particles, settings UI.

### ⬜ Update 10 — *Open for (Un)Death*  · size L + soft-launch
**Goal:** Launch, store readiness, CI & LiveOps.
- Web launch polish + optional **PWA / mobile wrappers**; icons, splash, store metadata, age rating, privacy labels.
- **Analytics + crash reporting** (funnel: tutorial → first infect → first raid → purchase; D1–D7 retention; economy telemetry).
- **Remote config / live-ops:** server-driven economy tuning + feature flags + themed content drops (Halloween/Tiki events) without a client update.
- **Art:** store kit (icon, screenshots, 15–30s trailer), first themed-event bundle, push thumbnails.

---

## Dependency graph (short form)
```
v0.1 ─▶ U1 (serve+seats) ─▶ U2 (infect+energy) ─▶ U3 (build) ─▶ U4 (raid)
                                    └────────────┬───────────────┘
                                                 ▼
                       U5 (art/anim) ─▶ U6 (progression) ─▶ U7 (collection)
                                                 ▼
                                    U8 (monetization) ─▶ U9 (polish) ─▶ U10 (launch)
```
U5 (art) runs partly in parallel with U2–U4 since Higgsfield batches are
independent of the systems code.
