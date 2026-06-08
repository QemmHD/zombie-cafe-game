# 🧟 Undead Diner

An original isometric **zombie restaurant management sim** — run a diner staffed
by zombies who cook, serve, and clean while human customers eat, pay, and leave.
Built with **React + TypeScript + Phaser 3**, mobile-first, with a LocalStorage
save. All art is **original placeholder art generated procedurally in-engine**
(no third-party assets), so it runs with zero downloads.

> This is an original game inspired by the *genre* of classic café-management
> sims. It deliberately uses no copyrighted names, logos, art, or UI from any
> existing game.

## Run it

```bash
cd undead-diner
npm install
npm run dev      # open the printed http://localhost:5173
# or a production build:
npm run build && npm run preview
```

## How it plays
- **Zombies** auto-cook at stations → drop food at the **counter** → carry it to
  seated **customers** → clean dirty tables. Toggle **Auto** off to micromanage.
- **Customers** enter, sit, order a dish (thought bubble), wait (patience ring),
  eat, pay money + XP, and leave. Make them wait too long and your **★ rating** drops.
- Tap a **station** to change its recipe. Build **Tables/Counters/Stoves/Grills/
  Ovens** from the bottom bar, then tap a tile to place. **Infect** a customer
  (toxin) to gain a zombie. **Raid** rivals for loot. **Expand** for space and
  **Franchise** at level 10 for prestige.

## Architecture
- **React DOM** UI overlays the **Phaser** canvas. A **Zustand** store holds HUD
  state the scene pushes up; an **eventBus** sends button commands down.
- `BootScene` procedurally generates all textures. `GameScene` owns the iso world.
- Systems: `IsoGrid`, `PathfindingSystem` (A*), `CustomerManager`,
  `ZombieStaffManager`, `TaskManager`, `RecipeSystem`, `FurnitureSystem`,
  `PlacementSystem`, `EconomySystem`, `XPLevelSystem`, `RatingSystem`,
  `InfectionSystem`, `RaidSystem`, `SaveSystem`.

## Folder structure
```
src/
  main.tsx, App.tsx, styles.css
  game/
    config.ts, store.ts, eventBus.ts
    data/        recipes.ts, furniture.ts
    iso/         IsoGrid.ts
    entities/    Customer.ts, Zombie.ts, Furniture.ts, move.ts
    systems/     (all managers/systems listed above)
    scenes/      BootScene.ts, GameScene.ts, UIScene.ts
    PhaserGame.ts
  ui/            TopHUD.tsx, LeftBar.tsx, ActionBar.tsx, Panels.tsx
```
