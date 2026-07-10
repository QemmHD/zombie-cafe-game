# 🧟 Deadbeat Diner

> *The staff's undead, and the service is to die for.*

A **web-native horror-comedy restaurant tycoon** — cook grisly dishes, **infect
your customers into staff**, raid rival diners, and grow your undead empire.
Built with **Phaser 3 + TypeScript + Vite** and deployed to **GitHub Pages**.

A love-letter remake of Capcom/Beeline's *Zombie Cafe* (iOS, 2011), rebuilt from
scratch with original code and original AI-generated art.

**▶ Play:** https://qemmhd.github.io/zombie-cafe-game/ &nbsp;·&nbsp;
**📖 Design:** [docs/DESIGN.md](docs/DESIGN.md) &nbsp;·&nbsp;
**🗺 Roadmap:** [docs/ROADMAP.md](docs/ROADMAP.md) &nbsp;·&nbsp;
**🚀 Deploy:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

> First deploy needs a **one-time** repo setting — see [Deployment](docs/DEPLOYMENT.md).

---

## The loop

**Cook** a dish → a **zombie server carries it to a seated customer** → the
**customer pays** → **infect** that customer into your next zombie server.
Your labor force *is* your clientele. Meanwhile your kitchen keeps earning while
you're away (**offline/idle earnings**).

## What's in v0.1

- Connected **cook → serve → earn → infect** core loop
- **Offline/idle earnings** on load (capped accrual from your kitchen's earn rate)
- **1,052 content entries** ported from the original design (105 zombies, 320 dishes, 602 furniture, + pets/tombstones/boosters) → `src/data/*.json`
- Real **hand-drawn art** (isometric diner + zombie/customer/stove sprites), coins + toxin economy, HUD, localStorage saves
- **GitHub Pages** CI (`vite build` → `actions/deploy-pages`)

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173/
npm run build          # tsc typecheck + vite build → dist/
npm run preview        # serve the production build
```

## Project structure

```
src/
  main.ts            Phaser bootstrap (Boot → Preload → Cafe)
  config.ts          BRAND (rename here), palette, tuning
  core/              EventBus · Economy (coins+toxin) · SaveManager (+offline earnings)
  data/              types · content loader · *.json (ported catalogs)
  game/              Stove · Customer
  scenes/            Boot · Preload · Cafe
  ui/                Hud
public/art/          Higgsfield-generated backdrop + sprites
Tools/               export_content_json.py · optimize_art.py
docs/                DESIGN · ROADMAP · DEPLOYMENT
legacy-unity/        original Unity 2022 prototype (reference only; not built)
```

## Art pipeline

Art is generated with **Higgsfield** (`nano_banana_pro`), cut out with
`remove_background`, then trimmed + downscaled for the web by
`Tools/optimize_art.py`. Style: 2.5D isometric hand-drawn cartoon, grimy-diner
palette, horror-**comedy** tone. See [DESIGN.md §4](docs/DESIGN.md).

## Content pipeline

`Tools/export_content_json.py` ports the Unity ScriptableObject catalogs under
`legacy-unity/Assets/Resources/` into flat JSON in `src/data/`, preserving the
original balance (cook times, coin/toxin rewards, rarities).

## Legal

*Zombie Cafe* is a trademark of Capcom/Beeline Interactive. This project is an
independent fan remake with **original code and original art** — no Capcom assets
are included or distributed. The app is branded **Deadbeat Diner** to avoid any
trademark conflict.

## License

Original code © the authors. See repository for details.
