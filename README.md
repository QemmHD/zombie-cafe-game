# 🧟 Zombie Cafe

A 2D, browser-based fan recreation of the classic *Zombie Cafe* restaurant-management game —
run a cafe staffed by zombies, cook spooky dishes, serve (and infect) human customers, and
grow your undead empire.

This is an **original re-implementation of the gameplay**, built from scratch with original
art drawn in-engine and original code. It does not use any assets from the original game.

## ▶️ Play it

No build step, no dependencies. Either:

- **Just open `index.html`** in any modern browser, **or**
- Serve the folder (recommended, avoids any `file://` quirks):

  ```bash
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

Your cafe auto-saves to the browser's local storage.

## 🎮 How to play

| Action | How |
| --- | --- |
| **Cook food** | Stoves auto-cook their set recipe. **Click a stove** to choose its dish. |
| **Serve customers** | Zombies automatically carry finished food to seated customers for 🪙 coins. |
| **Feed a zombie** | Serving drains a zombie's energy — when empty it collapses 💤. **Click it** to feed 🥩 flesh and revive it. |
| **Build** | Buy tables, stoves and decorations from the shop bar, then click a floor tile to place. Decor raises **appeal** → faster customers. |
| **🧪 Infect** | Turn a seated customer into a new zombie staffer (costs toxin). |
| **⚔️ Raid** | Send free zombies to scavenge the city for coins, flesh and toxin. |
| **Level up** | Earn XP by serving. New, more valuable recipes unlock at higher levels. |

Currencies: **🪙 Coins** (earned by serving, spent on building) · **🧪 Toxin** (premium —
infecting, buying flesh) · **🥩 Flesh** (restores zombie energy).

## 📱 Get it on your iPhone (build an IPA — no Mac needed)

The game is wrapped as a native iOS app with [Capacitor](https://capacitorjs.com/),
and GitHub Actions builds an **unsigned `.ipa`** for you on a cloud macOS runner.
You then sign it with your own tool (AltStore / Sideloadly / a signing service) and
install it.

1. Go to the repo's **Actions** tab → **"Build iOS IPA (unsigned)"** → **Run workflow**
   (it also runs automatically whenever the game files change). Free macOS runners
   require the repo to be **public**, or Actions minutes enabled.
2. When it finishes (~5 min), grab `ZombieCafe-unsigned.ipa` from either:
   - the run's **Artifacts**, or
   - the **Releases** tab under the **`ios-latest`** release.
3. **Sign** the `.ipa` with your sideloading tool and install it on your iPhone.

> The IPA is intentionally **unsigned** — signing is what ties it to *your* Apple ID /
> certificate, which only you can do. The app id is `com.zombiecafe.game`.

Prefer no install at all? It's also a normal mobile web game — host it (e.g. GitHub
Pages) and open it in Safari, or use **Add to Home Screen** for a full-screen app icon.

## 🗂 Project structure

```
index.html        – markup + HUD
css/style.css      – all styling
js/data.js         – recipes, shop items, tuning constants
js/engine.js       – math helpers, input, procedural sprite drawing
js/entities.js     – Table, Stove, Decor, Zombie, Customer
js/game.js         – core controller: update loop, economy, AI, save/load
js/ui.js           – HUD, shop bar, recipe menu, toasts
js/main.js         – bootstrap + requestAnimationFrame loop
```

Pure vanilla JavaScript + HTML5 Canvas. No frameworks.
