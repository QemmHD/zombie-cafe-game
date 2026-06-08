# 🧟 Zombie Cafe

A spooky restaurant-management game inspired by the classic 2011 iOS game
**Zombie Cafe**. Run a cafe staffed by the undead: cook cursed food, serve
hungry humans, and infect a few of them into new zombie waiters.

It's a self-contained HTML5/JS game (no build step, no network) that runs in any
browser **and** ships as a sideloadable **iOS app** via Capacitor + GitHub
Actions — same proven pipeline as the reference IPA.

## 🎮 How to play

| Action | What happens |
| --- | --- |
| 🔪 **Cook** | Tap a stove, pick a dish. It cooks in real time, then glows — tap to plate the batch onto the **Ready Counter**. |
| 🧟 **Serve** | Customers sit at tables. Your zombie staff automatically carry ready dishes to them. More zombies = more served at once. |
| 🪙 **Collect** | When a customer glows **gold**, tap them to grab coins + XP. |
| 🧟‍♀️ **Infect** | Some customers glow **green**. Spend ☣️ Toxin to turn them into a new zombie staff member instead of taking their money. |
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
  styles.css
  data.js       recipes, shop items, customer faces
  game.js       engine: state, simulation, rendering, input
assets/         1024px app icon source for the iOS build
test/           headless jsdom smoke test of the full game loop
.github/workflows/
  build-ipa.yml unsigned arm64 device IPA (for iOSGods / Sideloadly re-signing)
  pages.yml     deploy www/ to GitHub Pages to play in-browser
  test.yml      run the smoke test on push
```

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
npm install --no-save jsdom
node --test 'test/*.test.js'
```

The smoke test boots the real game in jsdom and drives the entire loop —
cook → ready → plate → serve → collect — asserting the economy responds.
