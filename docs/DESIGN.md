# Deadbeat Diner — Design Bible

> **Working title:** *Deadbeat Diner* — "The staff's undead, and the service is to die for."
> A web-native remake of Capcom/Beeline's **Zombie Cafe** (iOS 2011), rebuilt in
> Phaser 3 + TypeScript and deployed to GitHub Pages.

This document captures **what the original game is**, **what we have**, **the gap**,
and **the art & tech direction**. The sequenced build plan lives in [ROADMAP.md](./ROADMAP.md).

---

## 1. What makes Zombie Cafe *the game*

Zombie Cafe is a **freemium restaurant tycoon with a horror-comedy twist**. Its
identity is one tight loop:

> **Cook** a grisly dish → a **zombie server carries it to a seated customer** →
> the **customer pays** (the *only* coin source) → you **tap that customer to infect
> them** into your next zombie server. *Your labor force literally is your clientele.*

Everything else hangs off that spine:

| Pillar | How the original does it |
|---|---|
| **Cooking** | Tap a stove, pick an unlocked recipe, pay its price up front, a staffer cooks it on a **real-time timer (2 min → 3 days)**. A finished dish yields N *servings* and **burns** if not served in time. |
| **Serving** | Not automatic — you **dispatch** a zombie/chef to a counter; they ferry plates to seated customers, collect coins, clear dishes. Seats (table+chair pairs) cap throughput. |
| **Infecting** | The signature hook. Convert customers into staff; the customer's **occupation** sets the infect cost tier (Free / Cash / **Toxin**) and the resulting zombie's stats. |
| **Currencies** | **Coins** (soft, earned by serving) + **Toxin** (premium green serum — time-skips, energy refills, premium infects). *Not "Brains."* |
| **Zombie energy** | Working drains **Energy**; a starved zombie goes **feral and attacks a customer**, scaring everyone off without paying. The core anti-idle tension. |
| **Expanding** | A **square tile-grid room** you expand one step at a time; per-tile floors, per-section walls, utility stations (stove/counter/sink/fridge), furniture = seating, decor = **star rating**. |
| **Raiding** | Send zombies to raid rival AI cafés in **real-time tap-to-command auto-battle**; steal recipes and loot. |
| **Progression** | Two *separate* meters — **Level** (XP → unlocks) and **Rating** (stars → customer volume/quality). Cookbooks (~320 recipes), Zombiepedia collection, pets, boosters. |
| **Idle** | It's a **wait-based** game: long cooks earn overnight, short cooks reward frequent check-ins. Offline earnings + return cadence are the retention engine. |
| **Look & feel** | **2.5D isometric "diorama room"**, hand-drawn cartoon, saturated **grimy-diner** colors that visibly clean up as you upgrade. **Horror-COMEDY**, not horror: "spooky yet adorable" shambling waiters, gore hidden behind a comic CENSORED bar, dishes drawn as comical body parts. |

**The single most-copied-wrong detail:** payment happens at the **serve** moment
to a **seated** customer — not by tapping a finished stove. Coin-tapping a stove
is a faucet, not a restaurant.

---

## 2. Where the project was (pre-pivot)

The repo began as a **Unity 2022.3** skeleton (now preserved under
[`legacy-unity/`](../legacy-unity)). Assessment from the deep-dive:

**Strengths**
- Clean, well-namespaced C# systems (EventBus, GameManager, JSON SaveSystem, ScriptableObject data).
- A large generated content catalog: **105 zombies, 320 dishes, 602 furniture**, + pets/tombstones/boosters — numbers tuned for an idle economy.

**Fatal gaps (why it wasn't a game yet)**
- **The loop was never connected.** `CollectDish()` minted coins on stove-tap; the customer/infection subsystem was orphaned (no prefab, never added to a scene, `Customer.ZombieVariant` never set) → **infection was 100% non-functional**.
- **No offline/idle earnings** — the genre's beating heart — despite the data being shaped for it.
- **No serving, seats, patience, rating, or zombie energy.**
- Broken content pipeline (placeholder script GUIDs, gitignored `.meta`, generator/C# field-name drift) → the 1,052-asset catalog largely failed to bind on a fresh clone.
- **Zero art/audio**, empty committed scenes, editor-only boot.
- The name literally infringed Capcom's **"Zombie Cafe"** trademark.

---

## 3. The pivot — web-native, deployable, real loop

To satisfy "deploy through GitHub Pages," the remake is now **web-native**
(Phaser 3 + TypeScript + Vite), a static site with instant loads and no engine
license. The Unity work's real value — **design, balance, and the 1,052 content
entries** — was ported to JSON (`Tools/export_content_json.py` → `src/data/*.json`).

**Already true in the web build (v0.1):**
- The **cook → serve → earn → infect** loop is *connected*: a staffed stove cooks a real dish timer; customers walk in, eat, **pay**, and can be **infected into a new zombie** that joins the roster.
- **Offline/idle earnings** on load (`SaveManager` computes capped accrual from the kitchen's earn-rate snapshot) — the biggest original miss, fixed on day one.
- **Real art** (Higgsfield): isometric dingy-diner backdrop + hand-drawn zombie-waiter, customer, and bubbling-pot stove sprites.
- Two-currency economy, EventBus, HUD, toasts, localStorage saves, GitHub Pages CI.

**Known simplifications to deepen (see roadmap):** payment currently credits on
*eat* rather than on a server delivering a *specific* dish; infection is an
auto-roll rather than a paid tap-to-infect keyed to occupation; no seats/energy/
rating yet.

---

## 4. Art direction (locked)

- **View:** 2.5D isometric/oblique diorama — a square tiled room with two back walls.
- **Style:** hand-drawn cartoon, thick clean outlines, saturated **grimy-diner** palette; upgrades visibly clean the room from dingy → stainless-and-marble.
- **Tone:** horror-**comedy**. Spooky-yet-adorable. Gore behind a comic CENSORED bar. Dishes are punny body parts.
- **Palette:** charcoal `#141821` / toxic green `#7ee081` / blood `#c0392b` / coin gold `#f2c14e` / toxin serum `#e08fb0`→green.
- **Pipeline:** Higgsfield `nano_banana_pro` for scenes + sprites → `remove_background` for cutouts → `Tools/optimize_art.py` (trim + downscale) → `public/art/`. Character "style bible" batch keeps the roster consistent.

---

## 5. Tech architecture (web)

```
src/
  main.ts            Phaser bootstrap (Boot → Preload → Cafe)
  config.ts          BRAND (rename lives here), palette, tuning constants
  core/              EventBus, Economy (coins+toxin), SaveManager (+offline earnings)
  data/              types.ts + content.ts loader + *.json (ported catalogs)
  game/              Stove, Customer (gameplay actors)
  scenes/            BootScene, PreloadScene, CafeScene
  ui/                Hud (+ toasts)
public/art/          Higgsfield-generated backdrop + sprites
Tools/               export_content_json.py, optimize_art.py, generate_so_catalog.py
```

- **State:** single `SaveManager` (localStorage, versioned + migration hook), `Economy` façade, global typed `EventBus`.
- **Content:** JSON catalogs imported at build time; large sets (furniture) can move to lazy `fetch` if bundle size grows.
- **Deploy:** `vite build` → `dist/` → `actions/deploy-pages`. See [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 6. Naming & legal

"Zombie Cafe" is a live Capcom/Beeline trademark; the old `productName`/`companyName`
were direct infringement risk and are removed. New brand: **Deadbeat Diner**
(namespace-safe root `DeadbeatDiner`, bundle `com.rottenroost.deadbeatdiner`).
Alternatives on the shortlist: *Ghoulash, Grave Grub, Rot & Serve, Necro Nosh,
Rigor Bistro, Shamble & Sons*. The brand is centralized in `src/config.ts` (`BRAND`)
so it's a one-line change.
