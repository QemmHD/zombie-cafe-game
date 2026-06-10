# IP & Originality — what we can use vs. what we must reinvent

> Practical engineering guidance, **not legal advice**. When in doubt, make it
> original. The goal: a game that plays and *feels* like the genre leader while
> sharing **none** of its protected expression.

## The principle: idea–expression dichotomy
Copyright protects the **specific expression** of a work, **not the ideas,
systems, mechanics, or methods** behind it (this is the long-standing idea–
expression split; game *rules/mechanics* in particular are treated as
uncopyrightable systems — only the audiovisual *expression* and code are
protected). Trademarks separately protect **names/logos/brand identity**.

So for a tycoon-sim "inspired by" reference:

### ✅ FREE TO USE (ideas / systems / structure — not protected)
- **Game mechanics & loops**: cook→serve→pay→clean; infect-customer-to-recruit;
  energy/rest; rating drives traffic; raid rivals for loot; fridge unlock; staff
  roster/storage; review tasks; recipe variants; café expansion.
- **Genre conventions & UI *structure***: an isometric cutaway café framed by an
  exterior; a top resource HUD; a left icon rail; a bottom action panel; a
  category store tray; ghost placement with valid/invalid tiles; a recipe book;
  an iso raid map; a tap-target battle; level-up/loot popups; an options screen.
- **Interaction grammar**: tap-unit → tap-target; drag-to-place; tap-to-collect.
- **Art *direction* as a genre**: "grimy hand-drawn 2.5D comedic-horror" — a
  style/mood is not ownable; only specific drawings are.
- **Functional facts**: progression curves, timer lengths, price scaling, stat
  categories (speed/serve/clean/attack), currency types (soft + premium).

### ❌ PROTECTED — must be ORIGINAL (do not copy)
- **The "Zombie Cafe" name and any logo** (trademark + the wordmark/coin badge).
  → we use our own title (**"The Rotten Spoon"**) and our own logo coin.
- **Specific character designs / sprites** (the exact chef mascot, named zombies
  like "Supper Girl/Henchman/Shadow Skull", pets). → original designs + names.
- **Exact recipe names** ("Dishwater Soup", "Gnasty Gnocchi", "Green Eggs & Sam",
  "Leftunders"). → our own gross-funny names (Mystery Meat, Sewer Stew, Slime
  Dumplings, Graveyard Hash, Toxic Noodles…).
- **Exact UI artwork**: the precise maroon HUD graphic, the chalkboard textures,
  button graphics, paper/pushpin art, the cookbook page art, map tiles. → we
  rebuild equivalents from our own primitives/palette.
- **Dialogue / tutorial text** verbatim. → original wording, same intent.
- **Specific named locations/people** ("Barry's Cafe", "Eugene's", "PETER432"). →
  our own rival names.
- **Their code/assets** (we have none; everything is drawn procedurally by us).

## Operating rules baked into this repo
1. Reference screenshots are **git-ignored** (`references/.gitignore`) — analysis
   lives only as text in `/docs`.
2. All art is **procedurally drawn by us** (`render.js`) or original assets — no
   imported sprites.
3. All names (title, recipes, zombies, rivals, dishes, UI labels) are **original**
   and live in `data.js`/`docs` so they're easy to audit.
4. The model identifier and any internal tooling notes never ship in-game.
5. When a screen is built, confirm: *same structure & feel, zero shared assets,
   names, logos, or text.*

## Net
We reproduce the **systems, layout grammar, density and mood** (all fair game)
and supply **100% original expression** (art, names, text, logo). That is the
legally-distinct "spiritual successor" the project is aiming for.
