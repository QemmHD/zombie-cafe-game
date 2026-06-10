# 🧟 Zombie Cafe

A spooky **top-down 2D** restaurant-management game inspired by the classic 2011
iOS game **Zombie Cafe**. Run a cafe staffed by the undead: cook cursed food,
watch your zombie waiters walk dishes to seated customers, infect humans into
new staff, and send squads to **raid rival cafes**.

It's rendered on an HTML5 `<canvas>` with procedurally-drawn walking characters —
self-contained (no build step, no network) — that runs in any browser **and**
ships as a sideloadable **iOS app** via Capacitor + GitHub Actions (same proven
pipeline as the reference IPA).

## 🎮 How to play

| Action | What happens |
| --- | --- |
| 🔪 **Cook** | Tap a stove in the kitchen, pick a dish. It cooks in real time, then lands on the **pass** counter. |
| 🧟 **Serve** | Customers walk in and sit at tables. Your zombie staff walk dishes from the pass to them automatically. More zombies = faster service. |
| 🪙 **Collect** | When a customer shows a 🪙 bubble, tap them to grab coins + XP. |
| 🧟‍♀️ **Infect** | Tap a customer showing a green 🧟 bubble to spend ☣️ Toxin and turn them into a new walking zombie worker. |
| ⚔️ **Raid** | Open the Raid Map to send zombie squads to take over rival cafes for loot (coins + toxin). Power = squad size + your level. |
| 🛒 **Grow** | Spend coins & toxin in the Shop on stoves, tables, staff, and decor that boosts **ambiance** (faster customers, bigger tips). |
| ⚡ **Rush** | Tap a cooking stove to spend Toxin and finish it instantly. |

Progress is saved to `localStorage`; cooking continues while you're away.

## 💰 Currencies

- 🪙 **Coins** — soft currency from serving customers. Buys ingredients, stoves,
  tables, and most decor.
- ☣️ **Toxin** — premium currency. Earned on level-up and used to hire/infect
  zombies, rush cooks, and buy top-tier decor.

## 🛠️ Project layout

```
www/            the game (open www/index.html in a browser to play)
  index.html
  styles.css    HUD / toolbar / modal shell around the canvas
  data.js       recipes, shop items, rival cafes, character palettes
  world.js      pure simulation: state, FSMs, cooking, serving, infect, raids
  render.js     2D canvas renderer (floor, kitchen, sprites)
  game.js       glue: game loop, HUD, taps, shop & raid modals, persistence
assets/         1024px app icon source for the iOS build
test/           headless simulation test of the full game loop (no browser)
.github/workflows/
  build-ipa.yml unsigned arm64 device IPA (for iOSGods / Sideloadly re-signing)
  pages.yml     deploy www/ to GitHub Pages to play in-browser
  test.yml      run the simulation tests on push
```

The simulation (`world.js`) is deliberately split from rendering (`render.js`)
so the whole game loop — cook, serve, infect, raid — is unit-testable without a
canvas or a browser.

## ▶️ Run locally

Just open `www/index.html` in a browser, or serve the folder:

```bash
npx serve www      # or: python3 -m http.server -d www
```

## 📱 Build the iOS app (IPA)

Push to the build branch (or run the **Build Zombie Cafe IPA** workflow
manually). GitHub Actions builds an **unsigned device (arm64)** `.ipa` and
publishes it as a Release asset. Download `ZombieCafe.ipa` and upload it into
the **iOSGods** online signer (App+ / VIP) or **Sideloadly** — they re-sign it
with their own certificate and install it on your iPhone. The build is
intentionally unsigned for exactly this flow.

## ✅ Tests

```bash
node --test test/world.test.js
```

The tests load `world.js` into a sandbox with a seeded RNG and drive the real
game logic — cooking, serving, infecting, and raiding — asserting the economy
responds. No dependencies required.
