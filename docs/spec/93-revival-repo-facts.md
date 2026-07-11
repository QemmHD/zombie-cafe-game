# 93 — Facts mined from the "Zombie Cafe Revival" reverse-engineering repo

**Status:** REFERENCE (fidelity evidence). Facts, field layouts, and numbers extracted from the
community reverse-engineering repo *zombie-cafe-revival* (cloned locally for analysis; referred to
below as `zc-revival:`) and its companion article <https://airyz.xyz/p/zombie-cafe-revival/>.

**Provenance & legal handling:** that repo has **no license** and embeds decompiled Capcom/Beeline
files (`zc-revival:src/assets/**`, `src/smali/**`, `src/lib/armeabi/libZombieCafeAndroid.so`).
Per project rules, **no code or assets were copied** — this document records only mechanics,
numbers, field names, and behavioral descriptions, each with a file-path citation. Where the repo
is silent, that is stated explicitly. The repo targets the **Android build `ZombieCafeAndroid
1.1.2.0a`, versionCode 19** (`zc-revival:src/apktool.yml`), package `com.capcom.zombiecafeandroid`
(`zc-revival:src/AndroidManifest.xml`). In-client HTTP user-agents observed: `ZombieCafe/1.0.1.0a`
and `ZombieCafe/1.0.1.0a Amazon` (`zc-revival:src/smali/com/capcom/zombiecafeandroid/URLManager.smali`).

How to read citations: `zc-revival:<path>` is a path inside that repo's working tree.
`.so strings` means literal strings extracted from `zc-revival:src/lib/armeabi/libZombieCafeAndroid.so`
with `strings(1)` (no code lifted).

---

## 1. Server / online mechanics

### 1.1 Endpoint catalog (complete, from the shipped client)

The native library embeds every server route as a printf format string (`.so strings`). Base URLs
were `http://zombiecafe.capcomcanada.com/zca`, `.../x`, and `.../updater/%s` (the revival patch
overwrites these three in-memory strings at fixed offsets — `zc-revival:src/lib/cpp/ZombieCafeExtension.cpp`).

| Route (format string) | Purpose (evidence) |
|---|---|
| `%s/gettimestamp.php` | Server time fetch; used to record session start and validate IAP ("`L_GOTSERVERTIMEFORHOOVER, Record Session Start Or IAP`", `.so strings`) — i.e., server-time anti-cheat anchor |
| `%s/savegamestate.php?%s&h=%s` | Upload the player's cafe snapshot (see §1.3) |
| `%s/getgamestate.php?v=%d&u=%s` | Download a specific friend's cafe snapshot (`u` = user id) |
| `%s/getrandomgamestate.php?v=%d` | Download a **random stranger's** cafe (matchmaking for "Random Caf" visits/raids; "Next Random" UI string exists in `zc-revival:src/assets/data/strings_google.bin.mid`) |
| `%s/getspecialgamestate.php?v=%d&u=%s` | Special/curated cafe download (repo silent on use) |
| `%s/getmetadata.php?v=%d` and `?v=%d&u0=%s` | Batch metadata for the friends list (see §1.4) |
| `%s/getspecialmetadata.php?v=%d&k=%s` | Keyed metadata variant (repo silent) |
| `%s/getgifts.php?v=%d` and `?v=%d&udid=%s` | Poll the player's gift pile (see §1.5) |
| `%s/gotgifts.php?%s&h=%s` | Ack/consume gifts |
| `%s/givegift.php?%s&h=%s` | Send a gift (food order, raid result notice, etc.) |
| `%s/settoken.php?%s&h=%s` | Push-notification / session token registration |
| `%s/versioncheck.php?v=%s&app=%s` | Client version gate |
| `%s/glinfo.php?v=%d&u=%s` | Device GL info telemetry |
| `%s/getsng.php?v=%d&gv=%d&u=%s` | Unknown ("sng"); repo silent |

Other request-building format strings from `.so strings`:
`v=%d&md_v=%d&udid=%s&data=%s`, `v=%d&md_v=%d&udid=%s&%s&data=%s`,
`v=%d&userid=%s&udid=%s&data=%s%s:`, `l=%s&udid=%s`, `udid=%s`,
`app=%s&deviceid=%s&model=%s&app_version=%s&hash=%s&mktver=%i&lite=%i`,
`app=%s&ver=%s&did=%s&pid=%i&lite=%i&device=%s&m=%s&andid=%s`,
`?a=%s&v=%s&u=%s&d=%s&c=%s`.
The recurring `&h=%s` and `hash=%s` parameters plus the log string
`server=%d callback=%d friendscreen=%d SALT=%s` (`.so strings`) show requests were signed with a
**salted hash** (algorithm not documented in the repo). Identity was the device **UDID** built
from `TelephonyManager.getDeviceId()` + SIM serial + `ANDROID_ID` hashed into a UUID
(`zc-revival:docs/compat/device_id_security_exception_fix.md`) — there were no accounts.

The revival's reimplemented server (Cloudflare Worker, Go) mounts:
`/v1/zca/gettimestamp.php`, `/v1/zca/savegamestate.php`, `/v1/zca/getrandomgamestate.php`,
`/v1/zca/getgamestate.php`, `/v1/zca/getmetadata.php`, plus Facebook emulation at
`/v1/facebook/graph/me` and `/v1/facebook/restserver.php`; `getgifts.php`/`gotgifts.php` are
stubbed out (`zc-revival:tool/server/endpoints/endpoints.go`).

### 1.2 Transport & encoding

Everything is plain HTTP GET/POST with **colon-and-newline delimited text** responses — no JSON
(article; `zc-revival:tool/server/endpoints/*.go`). Client string encoding is ISO-8859-1
(`URLManager.smali`); spaces and angle brackets are manually escaped to `%20`, `%3c`, `%3e`
(`URLManager.smali`).

### 1.3 Save upload (`savegamestate.php`) — how visiting/raiding got its data

- The client periodically POSTs its **entire serialized cafe** (state header + full tile map — the
  `FriendCafe` blob of §3.6) as a **multipart form file field named `fnam`** with content type
  `plain/text`, boundary literal `--<thisSureIsABoundary!!dnsiovd>`, plus `udid` in the query
  string (`URLManager.smali`; parsed exactly this way in
  `zc-revival:tool/server/endpoints/save_game_state.go`).
- The revival server stores the blob keyed by `udid` in a KV store, after validating it parses as a
  **version-63** `FriendCafe` and consumes the stream to EOF
  (`save_game_state.go`, `zc-revival:tool/file_types/friend_cafe.go`).
- `getgamestate.php` / `getrandomgamestate.php` return such a blob verbatim; the client then
  **simulates the friend's cafe locally** from that snapshot. All visiting, fee collection, and
  raid combat runs client-side against the downloaded snapshot — the original server was a dumb
  blob/gift store. (Revival note, not original behavior: their server randomly drops ~90% of
  uploads to save bandwidth — `save_game_state.go`.)

### 1.4 Friends list & metadata (`getmetadata.php`)

- Friend discovery was **Facebook**: the client calls Graph `me` (needs `name`, `first_name`,
  `last_name`, `id`) and the legacy REST/FQL `restserver.php` (form fields `format`, `query`,
  `access_token`, `method`) expecting an array of friends with `uid`, `name`, `first_name`,
  `last_name`, `pic_square` (avatar URL fetched over HTTP)
  (`zc-revival:tool/server/endpoints/facebook_graph_me.go`, `facebook_rest_server.go`;
  `.so strings`: `FetchFaceBookFriends`, `CCServer::RetrieveMetaDataFor %d Friends`).
- `getmetadata.php` response: **one line per friend**, colon-delimited. The revival server answers
  `FRIEND_ID:10:0.000000:63:0:0:0:0` per line (`zc-revival:tool/server/endpoints/get_metadata.go`).
  Field semantics beyond position 1 = uid, 2 = cafe level, 3 = a float (star rating), 4 = save
  format version (63) are **not documented in the repo** (last four fields unexplained; the stub
  sends zeros and the game accepts it).
- Client-side friend-cafe version gating exists: "This friend is using a newer version of the
  game, please update your build to play with them." and a recipe-gift version check
  (`strings_google.bin.mid`).

### 1.5 Gifts (`getgifts.php` / `givegift.php` / `gotgifts.php`) — the async social bus

- Gift pile response format (article + disabled revival implementation
  `zc-revival:tool/server/endpoints/get_gifts.go`): first line is a numeric value, then one line
  per gift like `1:160,1:0:0:<sender_user_id>:<sender_name>:<32-hex-md5>`.
  **Client quirk:** the parser **skips the first line** of the body, so a well-formed response
  needs the count/value line (the article notes they prepended `\n`) — fragile framing worth
  avoiding in a remake.
- Gift *sending* format strings in the client (`.so strings`):
  `%i:%s:%s:%s:Attacker Win:`, `%i:%s:%s:%s:Defender Win:`, `%i:%s:%s:%s:Food Order:`,
  plus generic `%i:%f:%i:%i:%s:%s:%i` / `%i:%s:%i:%i:%s:%s:`. So the gift channel carried at
  least three typed payloads: **raid attacker-win notices, defender-win notices, and food
  orders**. `Unhandled gift type: %i` (`.so strings`) confirms a numeric gift-type enum.
- Gift/order UX rules (all from `strings_google.bin.mid`): "You can only send one order to each
  friend per day!", "Your order of X has been filled by Y", "You have received a gift of X from Y",
  gifts deliverable only when the friend's cafe "is no longer green" (recently-updated marker),
  and Facebook wall-post templates for raid wins ("X's zombies have defeated Y…"), new-recipe
  brags, and franchise invites.

### 1.6 Online play rules (limits, loot, defense)

All quoted from `strings_google.bin.mid` unless noted:

- **Raid frequency:** "You can only attack each friend once per day. Please try raiding another
  caf" — friend raids are 1/day/friend; enemy (NPC) cafes and random cafes are the grind outlet.
- **Fee collection:** "You can only collect fees from a friend once per day."
- **Anti-griefing/defense validity:** "You can not attack this player because they have blocked
  their staff's path to the door." — a cafe whose door path is blocked is unraidable.
- **Attack requirements:** "You can't attack this caf! You have no zombies to attack with!"
- **Raid loot:** Raid Summary screen lists **"Cash earned / Dishes found / Toxin found"**; tutorial
  says raids "can get food, money, and maybe even Toxin!"; stolen dishes land in the fridge
  inventory and unknown dishes can be **unlocked as recipes** ("That's a new one! Choose unlock to
  add newly found dishes to your recipe book- you won't get to serve it, but you'll get a valuable
  recipe."). Numeric loot tables are **not in the repo** (native code / server-side).
- **Defense:** "Your caf was raided by X", "Your zombies defended your caf from X", "Your zombies
  earned N xp for defending your caf", counters "Raid Wins: N / Caf Defense Wins: N", and a
  "Collect" button for defense rewards. Defense resolution math is **not in the repo**.
- **Retreat:** all-zombie retreat via a flag icon; per-raid confirm "Are you sure you want to
  retreat?"; zombie KOs in raids require reanimation time (see §5).
- **Franchise metagame:** "Your franchise now has N cafés run by your friends! You get N toxin.
  Your next reward will be for reaching N playing friends." — Toxin rewards for recruiting
  friends; referral codes also grant Toxin (referral strings block, incl. "You have already
  entered a referral code from this device.").
- **Enemy raid trigger:** NPC competitor event — "A Competitor is Stealing Your Customers! X has
  established a thriving business in your area - raid their restaurant now to recover your star
  rating!" — links NPC raids to star-rating recovery.

---

## 2. Game data tables (decoded)

The repo decodes four content files to JSON with reversible Go serializers
(`zc-revival:tool/resource_manager/serialization/serialization.go`):
`foodData.bin.mid` → 216 recipes, `characterData.bin.mid` → 219 characters,
`furnitureData.bin.mid` → 484 items, `animationData.bin.mid` → 60 entries.
Full dumps are in Appendices A–C below; highlights and semantics here.

### 2.1 Recipes (`zc-revival:src/assets/data/foodData.bin.mid.json`, 216 entries)

Fields (binary order, `zc-revival:tool/file_types/food.go`): `Name` (string), `Price` (i16),
`UnlockLevel` (u8), `CookTimeMinutes` (i16), `Servings` (i16), `PricePerServing` (i16, sic
"PricePerSeving"), `ExperiencePoints` (i16), `ImageID` (i16), then unknowns
`U7` (u8), `U8` (u8), `U9` (u8), `U10` (u8), `U11` (i16), `U12` (u8).

- **Income model confirmed:** gross = `Servings × PricePerServing` (e.g., Mystery Meat: cost 8,
  2 min, 12 servings × $1; Leftunders: cost 400, 480 min, 300 × $3 = $900).
- **XP** is a flat per-dish award (`ExperiencePoints`), not per serving.
- Cook times range 2 min → 4,320 min (72 h, Fetidccine); prices 8 → 5,500 (Escargut);
  servings 1 → 1,420; XP 1 → 232.
- **`U12` = cookbook ID** (strong evidence): values 1–9 align exactly with the cookbook list order
  in `cookbookData.bin.mid` (§2.4) — 1 = General, 2 = Raid (raid-discovered recipes), 3 = Mafia
  pizzas, 4 = Politician, 5 = Day of the Dead, 6 = Medieval, 7 = Pirate, 8 = Vampire, 9 = Super
  Hero; the Pirate/Vampire/Super-Hero cookbook blurbs name dishes whose rows carry exactly those
  IDs (Plundered Blowfish→7, Nosfera-Stew/Garlic Choke→8, Reactor Burger/Super Fruit Punch→9).
  So roughly half the base list (U12=2) is **unlocked by raiding, not leveling** — matching the
  "UNLOCK BY RAIDING" UI string.
- **`U11` = equipment tag**: themed recipes carry a link ID (391–394 pizza ovens, 397–399 grills,
  410–412 estufas, 430–432 witch stoves, 478–480 super stoves) that matches the same tag on the
  corresponding special stove rows (Furniture `U23`) and themed chef rows (Character `U20`) —
  i.e., these recipes require their themed stove.
- `U7`/`U8`/`U9`/`U10`: semantics unresolved in the repo (observed small enums; `U9=1` marks the
  post-launch content waves). A recipe trait "Takes longer to burn." exists in the UI strings but
  the repo does not identify which field encodes it. Recipe adjectives in UI: Spicy / Very Spicy /
  Fancy / Very Fancy / Bulk / Fresh / Frozen / Quick / Very Quick; plus RANK / RARE flags on the
  cookbook screen (`strings_google.bin.mid`).

### 2.2 Characters (`zc-revival:src/assets/data/characterData.bin.mid.json`, 219 entries)

Fields (binary order, `zc-revival:tool/file_types/character.go`): `CafeLevelRequired` (u8), `U2`
(u8), `U3` (u8), `Name`, `CharacterArtStringHead`, `CharacterArtString` (strings — art-part folder
keys), `U4` (u8), `Energy` (u16), `Speed` (u8), `AttackStrength` (u8), `TipRating` (u8), `U8` `U9`
`U10` (u8 ×3), `IsFemale` (bool), `Cost` (i32), `PurchaseWithToxin` (bool), `U14` (u8),
`CookSpeedBonus` (f32), `TipMultiplier` (i32), `RegenBoost` (f32), `CookXPBonus` (f32), `U19`
(bool), `U20` (i16), `U21` (u8), `HumanDescription`, `ZombieDescription` (strings).

- One table drives **customers, zombies, chefs, and enemy chefs** alike; `Cost` +
  `PurchaseWithToxin` say whether infection costs cash or Toxin. `CafeLevelRequired = 255` marks
  non-recruitable/boss entries ("DEFEAT TO UNLOCK" in UI).
- Stat ranges: Energy 50–1,200 (baseline customer 100; Sumo 400; Yokozuna 625; bosses
  Frankenstein/Evil Leprechaun 1,200); Speed 1–12; AttackStrength 2–10; TipRating 1–20.
- Chef-only multipliers: `CookSpeedBonus` 1.0–1.2, `TipMultiplier` 1–5 (int), `RegenBoost`
  1.0–1.5, `CookXPBonus` 1.0–1.3 — the UI labels these "Cook Speed / Tip Multiplier / Zombie
  Regen / Cook XP" (`strings_google.bin.mid`); zombie info shows "Tip Rating / Atk. Speed /
  Atk. Strength / Energy", so one of `U8/U9/U10` is likely attack speed (repo doesn't resolve
  which).
- Example costs: Politician $100 @L6; CEO $1,500 @L12; Cop 1 Toxin; Sergeant 10 Toxin; The Champ
  20 Toxin; Sumo 30 Toxin; Yokozuna 50 Toxin @L12 (625 energy); boss zombies 70–100 Toxin
  (Deadbeard 70, Evil Leprechaun 75, The Mad Griller 85, Chef Dracula 90, Frankenstein 100).
  A few cash-sink outliers exist ($30,000 Maid, $50,000–$100,000 special zombies).
- Duplicate-name rows are the **hireable-chef vs infectable-zombie vs premium** variants of the
  same design (e.g., three "The Champ" rows: 250 energy/20 Toxin infect, 250/$1,200 chef,
  500/20 Toxin premium chef with TipMultiplier 3).
- JP build (v1.7) uses a widened variant of this record (i32 energy, i16 stats, extra f32) —
  `zc-revival:tool/file_types/character_jp.go` — and 5 character sheets vs the US 2.

### 2.3 Furniture / store catalog (`zc-revival:src/assets/data/furnitureData.bin.mid.json`, 484 entries)

Fields (binary order, `zc-revival:tool/file_types/furniture.go`): `UnlockLevel` (u8), `Name`,
`Price` (i32), `PurchaseWithToxin` (bool), `SizeX` (u8), `SizeY` (u8), `ImageIndexNorth/East/
South/West` (i16 ×4 — four-orientation sprites), `Type` (u8), `Category` (u8), `Color` (4 bytes
RGBA), `MoneyPerHour` (i16), `MaximumMoney` (i16), `RatingBonus` (f32), `BuyMoneyAmount` (i32),
`ImagePackIndex` (u8), `StoveSpeedMult` (f32), `Description`, `ExperiencePoints` (f32),
`IsAvailableInStore` (bool), `U21` (u8), `U22` (bool), `U23` (i16 = theme tag, see §2.1).

**Type enum** (observed from rows): 0 = floor decor/appliance, 1 = stove, 2 = serving counter,
3 = table, 4 = chair, 5 = wall, 6 = window/wall-mounted, 7 = floor tile, 8 = fridge, 9 = divider,
10 = Toxin⇄cash exchange pack, 11 = sink/trash, 12 = cafe expansion, 13 = toxic barrel,
14 = tombstone. Counts: {0:112, 6:96, 4:50, 3:49, 7:49, 5:35, 1:24, 9:15, 12:15, 2:11, 11:8,
14:8, 8:7, 10:4, 13:1}. **Category** (store tab): 1 decor, 2 kitchen, 3 tables/chairs,
4 build (walls/floors/windows), 5 specials, 255 starter/unlisted; counts {4:161, 3:99, 1:79,
5:69, 2:47, 255:29}.

Key numeric facts:

- **Starter junk** (level 0, Category 255): Dirty fridge/stove/sink $50 each, Dead plant $5 —
  each with **RatingBonus −0.01** (they actively hurt rating until sold). Starter Plain
  table $150 / chair $75.
- **Stoves (all 24 rows in Appendix C):** Plain stove L1 $500; Stainless L5 $25,000 (+0.02
  rating); premium stoves 15–25 Toxin with **StoveSpeedMult 1.11–1.3** (e.g., Laser Oven L7,
  25 Toxin, 1.2×; Italian Stallion Pizza Oven 20 Toxin, 1.3×, +0.04 rating). Cash themed stoves:
  Standard Pizza Oven L15 $5,000; Economic Grill L16 $12,000; Traditional Estufa L5 $6,000; Witch
  Potion Stove L8 $8,000 (1.1×); Super Stove L14 $10,000 (1.1×). Themed stoves unlock their
  cookbook (§2.4).
- **Serving counters (11 rows):** Plain $500 L1 → Marble L18 $50,000 (+0.02); several +0.03
  cash counters at $1,500.
- **Expansions (Type 12):** cafe grows through fixed sizes **8×7 → 15×14** (implying base 7×6).
  Cash: 8×7 $3,500; 9×8 $25,000; 10×9 $75,000; 11×10 $100,000; 12×11 $120,000; 13×12/14×13/15×14
  $150,000 each. Toxin alternates: 9×8 10; 10×9 30; 11×10 40; 12×11–15×14 50 each (Toxin
  variants flagged not-in-store — likely offered contextually).
- **Income furniture (Type 0 with MoneyPerHour/MaximumMoney):** Vending machine $16,000 or
  8 Toxin → 25/h cap 250; Arcade cabinet $50,000 → 75/h cap 1,000 (Toxin variant 25 Toxin →
  100/h cap 1,200); ATM 60 Toxin → **200/h cap 5,000**. This is the passive/offline earner
  system ("Collect Fees" from friends taps these).
- **Toxin⇄cash exchange (Type 10):** rows named "10/30/175/750 Toxin" with Price
  20,000/50,000/250,000/1,000,000 and BuyMoneyAmount 10/30/175/750 — the cash-for-Toxin exchange
  (~2,000 cash per Toxin small, degrading to ~1,333 at the largest pack). See §4 for how the
  revival repurposes this via a binary patch.
- **Tombstones (Type 14):** Strength Tombstone and Health Tombstone 50 Toxin (L5), Level-2
  variants 55 Toxin; usable buffs with **24 h recharge** ("Sorry, you have depleted all uses of
  this tombstone. Please wait 24 hours.", rechargeable early with Toxin; activation confirms for
  energy boost / attack-strength boost / **reviving dead zombies** — `strings_google.bin.mid`).
  Decorative tombstone variants are pure rating decor (+0.02/+0.04).
- **Toxic barrel (Type 13):** 50 Toxin, XP 2,000 — the giant XP-buy item.
- **Magic Fridge:** 30 Toxin (L1, Type 8) — grants a **free daily dish** ("A GIFT FROM MAGIC
  FRIDGE! YOUR FREE DAILY DISH OF FOOD IS…", `strings_google.bin.mid`).
- `ExperiencePoints` (float) is the XP awarded for buying/placing the item ("Spend $# on your
  caf" quests key off purchases too); `RatingBonus` contributes to star rating (see §5).

### 2.4 Cookbooks (`zc-revival:src/assets/data/cookbookData.bin.mid`, strings readable)

10 cookbooks in order: **Favorites** ("You must have at least 1 starred recipe in your
'favorites' book." — `.so strings`), **General** (default), **Raid** (default; holds
raid-discovered recipes), **Mafia** ("Purchase the Standard Pizza Oven… to unlock"), **Politician**
(Economic Grill), **Day of the Dead** (Traditional Estufa), **Medieval** (Witch Potion stove),
**Pirate**, **Vampire**, **Super Hero**. The Mafia record carries bytes `13 88` = 5,000 —
matching the Standard Pizza Oven's $5,000 price.

### 2.5 Enemy (NPC) cafes (`zc-revival:src/assets/data/enemyCafeData.bin.mid`, `enemyItems.bin.mid`, `enemyLayouts.bin.mid`)

- 14 NPC cafes (leading count byte `0x0e`), named: Cafe, Diner, Italian Eatery, Asian Restaurant,
  Tex Mex, Pub, Chez [name] Restaurant, Lab, Frankenstein's Restaurant, Leprechaun's Clover
  Field, [?] Gourmet, Goblin['s], Deadbeard's X'Spot, Drac's Snack Shack, The Grillin' Villain.
  UI also carries the name-stitching strings (Diner, Italian Eatery, …, Snack Shack) in
  `strings_google.bin.mid`. Boss cafes pair with the boss zombies of §2.2
  (Frankenstein / Evil Leprechaun / Goblin Chef / Chef Deadbeard / Chef Dracula / The Mad
  Griller).
- Each record embeds its enemy-chef character index and an underscore-joined layout-ID list
  (most standard cafes: `55_56_57_58_59_60_61_62_63`; Frankenstein's: `128_129_130_131`;
  Goblin: `189_…_194`; Deadbeard: `195_…_199`; Drac's: `201_…_206`; Grillin' Villain: `214`) —
  i.e., **NPC cafes escalate through numbered layout variants**. `enemyItems.bin.mid` lists, per
  cafe, the furniture-row IDs its layouts use (readable ID lists per slot). The full binary
  layout format (`enemyLayouts.bin.mid`, per-tile records) has **no parser in the repo** —
  layout grid semantics remain undecoded.
- `enemyItemData.bin.mid` (321 bytes = 20 records × 16 bytes after a count byte `0x14`) is a
  20-level table of small indices — plausibly per-player-level enemy loadout tiers; **repo is
  silent** on exact semantics.

### 2.6 XP / level curve, star-rating math, other tunables

**The repo is silent.** `zc-revival:src/assets/data/constants.bin.mid` (9,789 bytes) clearly
holds the tuning tables (visible raw values include 1000, 10000, 3000, repeated 5-value blocks
that look like per-difficulty rows, floats like 0.8/0.15/1.4, and the embedded string
`playerCafe`), but the repo ships **no deserializer** for it, and the level curve lives there or
in native code. Star-rating **inputs** are documented (furniture `RatingBonus`, happy/unhappy
customers, bonus-quest star, NPC competitor stealing rating) but the aggregation formula is not.

---

## 3. File formats (from the repo's reversible codecs)

### 3.1 Shared binary conventions (`zc-revival:tool/file_types/binary_reader.go` / `binary_writer.go`)

- Integers (u8/i16/i32/i64) are **big-endian**; `float32`/`float64` are **little-endian** IEEE —
  a genuinely mixed-endian format (worth knowing when reading any original file).
- `string` = i16 big-endian byte length + raw bytes (no terminator). Empty string = length 0.
- `bool` = 1 byte, strictly 0/1.
- `Date` = 7 bytes: i16 year, u8 month, day, hour, minute, second.
- Content files carry a leading count (u8 for foods/characters/animationData, i32 for furniture,
  i16 for image-offset tables).
- Original asset filenames end in `.mid` (e.g., `foodData.bin.mid`) — an APK-packaging trick:
  `.mid` is on apktool's `doNotCompress` list (`zc-revival:src/apktool.yml`), so the engine can
  mmap uncompressed assets.

### 3.2 Image atlas + offsets (`zc-revival:tool/file_types/image_offsets.go`)

`*Offsets.bin.mid` layout: u8 `Type`, i16 count, then per entry —
Type 1: `X,Y,W,H` (i16 ×4) plus (in the decoded JSONs) four extra i16s.
Type 2: leading `Name` string, `X,Y,W,H`, then `XOffset, YOffset, XOffsetFlipped, YOffsetFlipped`
(i16 ×4) — **draw-origin offsets, with a separate pair used when the sprite is horizontally
flipped** (the engine mirrors SW↔SE / NW↔NE from just two authored directions; see §3.5).
Known offset files and their atlas scale factors (hardcoded per file in the engine, reproduced in
`zc-revival:tool/resource_manager/serialization/serialization.go`):
recipeImages ×0.5, recipeImages2 ×0.5, mapTiles ×1, furniture ×1, furniture2 ×0.75, furniture3 ×1,
ingameUiImages ×1, menuImages ×1, menuTitleImages ×1, characterParts ×0.75 (US; JP = ×1).
Atlases are packed into **2048×2048** sheets (`serialization.go`, `cct_file/packed_texture.go`).

### 3.3 CCT texture container (`zc-revival:tool/cctpacker/cct_file/cctexture.go`)

Header (little-endian i32s): magic `"CCTX"` (4 bytes), `U1` (=2 in repacked files), `Width`,
`Height`, `U2`, `U3`, `U4` (= compressed payload byte length when writing). Payload: **zlib**
stream of 16-bit texels, 2 bytes/pixel, **RGBA4444 packed as byte0 = (B<<4)|A, byte1 = (R<<4)|G**
(4 bits/channel; the repo up-converts n/15→n/255 by rounding).

### 3.4 Character art assembly (`zc-revival:tool/file_types/character_art.go`, `serialization.go`)

`characterArt.bin.mid`: u8 `PiecesPerString` then a string list terminated by an empty string.
Each string names a character sheet folder (e.g., `Frankenstein-zombie`); each character consists
of a fixed **27-piece** set (observed per folder: 12 front body parts, 12 back ("back_*") parts,
1×1 fillers, spacer, 2 chairback overlays; pieces: head, torso, pelvis, left/right arm ×2
segments, left/right leg ×2 segments — i.e., a segmented paper-doll skeleton). Per-piece JSON
sidecars store the Type-2 draw offsets (`XOffset/YOffset` + flipped pair). Characters reference
sheets via `CharacterArtStringHead` (head/skin key) + `CharacterArtString` (body key) allowing
head/body mix-and-match (§2.2 sample rows: Senior = head `oldman` + body `faris`). Human and
zombie forms are separate sheets (`*-human`, `*-zombie`).

### 3.5 Animations (`zc-revival:src/assets/data/animationData.bin.mid` + `animation/*.bin.mid`)

`animationData.bin.mid` (parsed — `zc-revival:tool/file_types/animation_data.go`): 60 records of
u8 `Form` (255 = all forms), u8 `Type` (0–29 action enum), u8 `Direction` (1 = SW, 2 = NW), string
filename. The 30 actions: walk, idle, sit, attack, carry, serve, death, eat, operate, run, bump,
celebrate, hit, attack2, attackHuman, idle3, idle4, idle5, startled, walk2, walk3, walk4, crouch,
feast, mouthwipe, hungry1, hungry2, rise, hung, hung2. **Only SW and NW are authored; SE/NE are
runtime mirrors** (hence the flipped-offset pairs in §3.2).
The per-clip skeletal format (`animation/*.bin.mid`) has **no parser in the repo**. Raw
inspection of `walkSW.bin.mid` (14,832 B) shows little-endian header `03 00 00 00 | 18 00 00 00 |
0D 00 00 00` (3, 24, 13 — plausibly version/frames/bones), literal `_PTR` placeholders where the
runtime patches pointers, 4×4 identity float matrices per node, and `0xCDCDCDCD` fill bytes
(MSVC uninitialized-heap signature — the pipeline serialized live C++ structs to disk). Treat the
clip format as **undecoded**.

### 3.6 Save game / cafe snapshot (`zc-revival:tool/file_types/save_game.go`, `cafe.go`, `friend_cafe.go`)

- Current save **format version = 63** (u8 leading byte; parser panics on other versions). Version
  branch points inside the format (>23, >24, >25, >29, >33, >46, >47, >48, >51, >58, >61, >62)
  document its evolution across game updates.
- `CafeState` (economy header): f64 `U1` (timestamp?), **f32 ExperiencePoints, i32 Toxin, i32
  Money, i32 Level**, i32 `U6`, i32 `U7`, f32 `U8`, i32 `U9`, bool `U10`, then the **chef**
  `CharacterInstance`, u8 zombie count + that many zombie `CharacterInstance`s, an i32-counted
  byte list `U12`, bool `U13`. XP being a float matches float furniture-XP awards.
- `CharacterInstance`: u8 type (row index into characterData), string name (zombies get names
  from the 200+ name pool in `strings_google.bin.mid`), then u8,u8,f32,u8,i64,u8,i64,i64,
  i32×4 (+u8, +i32×2 in newer versions) — field meanings not resolved by the repo (energy,
  timers, lifetime stats per the "Converted on / Days on staff / Customers served / Number of
  raids / Kills / Deaths" info panel).
- `SaveGame` adds two string-list blocks, two `Date`s, an i16 order count (order records
  unimplemented in the repo's parser), and 3 trailing flags.
- `Cafe` (tile map): u8 version, f64, u8 SizeX, u8 SizeY, i16 ×2, i32 MapSizeX, i32 MapSizeY,
  bool, then **MapSizeX×MapSizeY tile records**. Each `CafeTile`: i16, i32, bool, then up to
  **three optional stacked `CafeObject`s** (floor layer / object layer / ?). `CafeObject`:
  u8 type (1 = furniture, 2 = wall), payload, then i32, i16, i16, bool (position/rotation
  block). `CafeFurniture` discriminates: food-on-floor, stove (type 1), serving counter (type 2),
  or generic (with u8 orientation). **Stoves serialize an optional in-progress `FoodStack` plus
  two i64s (start/end cook timestamps)**; serving counters serialize an i16-counted list of
  `FoodStack`s (the queue of plated dishes); food stacks carry recipe id, count, a string, and a
  `Date`. Walls carry flags + optional decoration object. The trailing i32-counted int lists are
  unconfirmed ("Tbh this might not be right" comment).
- `FriendCafe` = the §1.3 upload: u8 version(63) + `CafeState` + full `Cafe`
  (`friend_cafe.go`) — friends/raiders receive your **entire live cafe including cook timers**.

---

## 4. Runtime patches — original bugs & quirks they reveal

From `zc-revival:src/lib/cpp/ZombieCafeExtension.cpp` (an injected .so that live-patches
`libZombieCafeAndroid.so` at fixed file offsets) and `zc-revival:docs/compat/*.md`:

1. **Server URL literals at fixed offsets** — base-URL strings live at lib offsets 0x1a6610
   (updater), 0x1a839c (`/x`), 0x1a842c (`/zca`), version-info string at 0x1a14dc; the revival
   memcpy's replacements over them. Confirms all endpoints derive from three base URLs.
2. **Offline = crash cascade:** with servers dead, the cafe-load path hung/crashed on gift-fetch
   redirects; the revival NOPs the internet-connectivity check at 0x9dee8 (4 bytes) so the game
   runs fully offline (article + code comment). I.e., the original **hard-required its gift
   endpoint during cafe load** — a fragility to avoid.
3. **Texture lifetime bugs:** crashes in `CImage` destructor and
   `CFTextureRef::~CFTextureRef` → `CFTexture::releaseRef` → `CFTexture::~CFTexture` (double
   free via scudo) — the revival NOPs the destructor calls (offsets 0x13d530/0x13d550/0x13d9e8/
   0x13d9ee and 0x13d3ae/0x13d3b4), accepting a deliberate ~0x18-byte leak per texture. The
   original engine's texture unload path was memory-unsafe on modern allocators.
4. **Currency-purchase retarget:** at 0xab018 the code computes struct offset `0xd6<<1 = 0x1ac`
   (cash field); the patch writes `0xb8` (Toxin field) and NOPs the shift — converting the §2.3
   Type-10 "buy cash with Toxin" store items into "buy Toxin with cash", eliminating IAP
   dependence. Confirms player-struct layout: **Toxin at +0xb8, cash at +0x1ac** (article).
5. **`MEDIA_MOUNTED` broadcast crash:** startup crashed on modern Android with "Permission
   Denial: not allowed to send broadcast android.intent.action.MEDIA_MOUNTED" — fixed by removing
   the deprecated API call (article).
6. **Modern-Android bring-up chain** (`docs/compat/`): targetSdk 14→24 clears the install gate;
   then exactly **one text relocation** (`R_ARM_RELATIVE` @ 0x5ddcc, a GCC `crtbegin_so`
   finalizer thunk; lib is ARMv5TE, GCC 4.4.3, 1,947,420 bytes, sha256 `24c6509a…`) must be
   neutered because API ≥ 23 rejects `DT_TEXTREL`; then
   `TelephonyManager.getDeviceId()/getSimSerialNumber()` throw `SecurityException` on API 29+ and
   are stubbed with `"000000000000000"`, keeping the UDID stable via `ANDROID_ID`
   (`device_id_security_exception_fix.md`).
7. **Toxin IAP catalog (removed by our no-monetization pillar, recorded for fidelity):** SKUs
   `zc_50_toxin_3`, `zc_125_toxin_2`, `zc_350_toxin_2`, `zc_800_toxin_2`, `zc_2000_toxin_2`
   (50/125/350/800/2000 Toxin packs; `zc-revival:src/smali/com/capcom/zombiecafeandroid/
   ZombieCafeAndroid.smali`), plus a **15-minute purchase throttle** ("…limit on the number of
   Toxin you can purchase within 15 minutes", `strings_google.bin.mid`) and Tapjoy-style
   offerwalls ("WATCH THESE SHORT VIDEOS AND EARN FREE TOXIN!").

---

## 5. Behavioral constants & mechanics gleaned from UI/tutorial text

All from `zc-revival:src/assets/data/strings_google.bin.mid` (the Amazon variant differs by one
URL only) or `.so strings` as noted. Numbers embedded at runtime are shown as N when the string
uses a placeholder.

- **Core loop wording (tutorial, in order):** chef→stove to cook; touch finished food→carry to
  serving counter→serve; happy customers pay **and raise star rating/popularity**; out-of-food
  makes customers leave unhappy and **drops rating**; each customer needs 1 chair + 1 table
  (2 customers can't share a table); pathing must reach door, tables, sink, serving counter
  (unreachable targets are called out); blocked door is an explicit error state.
- **Burn rule:** "A dish will burn if it does not have a cook assigned to it." — finished food
  left unserved burns; local notifications fire "X is about to burn! You need to check on your
  stove!" and the engine schedules a "NEXT BURN DISH NOTIFICATION" (`.so strings`). Burn window
  duration numbers: **repo silent** (native/constants).
- **Zombie states:** Serving / Resting / Attacking / Cooking / Reanimating / Daydreaming.
  Daydreaming zombies must be re-tasked; low-energy zombies **attack customers** ("One of your
  zombies attacked a customer, and that's not good for business"); resting slowly refills energy;
  Toxin fills instantly; defeated zombies **reanimate over time** or can be fired; the energy
  warning threshold string "This zombie's energy is above N" gates Toxin refill spam.
- **Energy drain rates:** repo silent (numbers live in native code / constants.bin.mid).
- **Staff capacity:** grows "every few levels"; firing frees a slot; **Meat Locker** (cold
  storage) stores zombies without firing them (post-launch feature string).
- **Toxin uses confirmed:** instant-finish cooking, instant energy refill, revive-in-raid, buy
  premium items/zombies, reopen a closed cafe ("Do you wish to use N toxin to reopen this caf"),
  recipe unlock ("…unlock this recipe… or Toxin"), tombstone recharge, cash exchange (§2.3).
- **Toxin earn paths confirmed (fits our earned-only pillar):** raids ("maybe even Toxin!"),
  daily streak (below), franchise/friend-count rewards, referral codes, offerwall/video promos
  (dropped in remake), defense rewards ("Collect").
- **Daily streak — "Online Frequent Fryer":** "You have returned to cook for: N day(s) in a row",
  "You are entitled to a prepared meal of: / a reward of: …", "Tomorrow's Bonus:", rewards
  include a **Mystery Dish** and "N toxin". (Also `RaidToxin=%d … FrequentFryer=%d …
  FrequentFryerCount=%d` debug string in `.so strings`.)
- **Bonus quest / review system:** icon opens a task list; "Complete four tasks, and you'll earn
  a restaurant review, and a **bonus star**. Bonus stars last a long time…"; "THIS BONUS LASTS
  FOR N HOURS", "BONUS EXPIRES IN", "% COMPLETE"; tasks can be skipped at the cost of the rating
  bonus; a paid **"BRIBE REVIEWER"** shortcut exists (`BonusQuestBribes` in `.so strings`);
  near-max duration is clamped ("You are very close to the maximum bonus duration! You will not
  gain very much time!"). Quest templates (singular + plural forms): Raid # enemy caf / Raid #
  friend caf / Raid any # caf / Serve # customers / Cook # dishes of X / Invite # friends /
  Spend $# on your caf / Collect fees from # friends caf / Give # gifts to friends / Order #
  dishes from friends. Review flavor: "Best Brains in Town", "#1 Most Putrid", "Rotten, Rancid
  and Revolting" by -Gangrene Gourmand / -Batty Cooker / -Ghoulia Chilled.
- **Recipe-collection XP meta:** "You've earned a N xp bonus for unlocking N recipes! Unlock N
  more for a N xp bonus!"
- **Chef rank ladder (10 titles):** Fresh Corpse Chef, Slightly-Decomposed Chef, Reeking Chef,
  Rigor Mortised Chef, Maggoty Chef, Oozing Chef, Living Dead Chef, Mummified Chef, Worst
  Nightmare Chef, Inhuman Remains Chef.
- **Clock-cheat detection:** "GRRRAG! You've been overworking your zombies by changing the
  clock! Careful or they might revolt." — device-clock rollback detection existed (server
  `gettimestamp.php` anchored sessions, §1.1).
- **Lapsed-player notification at 14 days:** "You haven't visited your caf in two weeks! Your
  zombies miss you."
- **Local notification categories:** Cooking Finished, Food Burned, Out of Food, Enemy Raids,
  Other Notifications, Game Updates (individually toggleable).
- **Cafe open/close:** the cafe can be closed and reopened ("It's time to open your caf! (You
  can close it later if you need to)", "Reopening in N", Toxin instant reopen) — customer inflow
  is gated by open state.
- **Backup saves UI:** Preview / Load / "Backup Saves" with corrupted-save recovery flow —
  the original kept multiple local save slots.
- **Zombiepedia:** an in-game zombie catalog (post-launch); "Hive member" cross-promo rewards
  string exists.
- **Offline earnings:** beyond income furniture caps (§2.3) and fee collection, the repo is
  **silent** on offline accrual formulas.

---

## 6. Explicit silence list (what this repo does NOT contain)

- XP-per-level curve, star-rating aggregation formula, customer spawn pacing, tip math,
  energy-drain and regen rates, burn-window durations, raid combat math/loot tables, defense
  AI, offline-earning rules — all live in `constants.bin.mid` (no decoder in repo) or the
  stripped native library.
- Gift-type enum values beyond the three named payloads; `gotgifts`/`givegift` full parameter
  semantics; the salted-hash algorithm for `&h=`.
- Per-clip animation binary layout (§3.5), enemy layout grid format (§2.5), most `CafeTile` /
  `CharacterInstance` unknown fields (the repo's own structs label them `U*`).
- Quest reward quantities, streak reward table, franchise reward thresholds (strings show the
  mechanics, numbers were server/native).
- iOS-specific content and the JP 1.7 build's data values (only its record *shapes* are decoded).

The appendices below are complete dumps of the three decoded stat tables, so this repo never
needs to be consulted again for these numbers.

---

## Appendix A — Complete recipe table (216 rows)

Source: `zc-revival:src/assets/data/foodData.bin.mid.json` (decoded from `foodData.bin.mid`).
Gross income = Servings x $/Serv. CB = cookbook id (see 2.1/2.4); Tag = required-stove tag (0 = none).

| # | Name | Lvl | Price | Cook min | Servings | $/Serv | XP | Img | U7 | U8 | U9 | U10 | Tag | CB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Mystery Meat | 1 | 8 | 2 | 12 | 1 | 1 | 28 | 0 | 1 | 0 | 0 | 0 | 1 |
| 1 | Hobo Delight | 1 | 30 | 5 | 20 | 2 | 2 | 26 | 0 | 0 | 0 | 0 | 0 | 2 |
| 2 | Dishwater Soup | 2 | 125 | 15 | 50 | 3 | 5 | 50 | 0 | 1 | 0 | 0 | 0 | 1 |
| 3 | Leftunders | 3 | 400 | 480 | 300 | 3 | 65 | 33 | 0 | 0 | 0 | 0 | 0 | 2 |
| 4 | Green Eggs & Sam | 3 | 280 | 60 | 180 | 2 | 15 | 19 | 1 | 1 | 0 | 0 | 0 | 1 |
| 5 | Finger Sandwiches | 3 | 1100 | 1080 | 650 | 3 | 90 | 12 | 1 | 0 | 0 | 0 | 0 | 2 |
| 6 | Gello Mold | 4 | 475 | 720 | 400 | 3 | 60 | 17 | 1 | 1 | 0 | 0 | 0 | 1 |
| 7 | Toe Jam Sandwiches | 4 | 190 | 90 | 100 | 3 | 20 | 42 | 1 | 0 | 0 | 0 | 0 | 2 |
| 8 | Dough-Nots | 4 | 235 | 180 | 220 | 2 | 25 | 7 | 1 | 0 | 0 | 0 | 0 | 2 |
| 9 | Handburgers & Flies | 5 | 310 | 300 | 320 | 2 | 45 | 24 | 1 | 1 | 0 | 0 | 0 | 1 |
| 10 | Green-plate Special | 5 | 300 | 30 | 115 | 3 | 12 | 20 | 1 | 0 | 0 | 0 | 0 | 2 |
| 11 | Onion Wrongs | 5 | 100 | 15 | 125 | 1 | 6 | 34 | 1 | 0 | 0 | 0 | 0 | 2 |
| 12 | Sloppy "Joe" | 6 | 1500 | 1440 | 850 | 3 | 95 | 36 | 2 | 1 | 0 | 0 | 0 | 1 |
| 13 | Tumor Melts | 6 | 2600 | 2880 | 1100 | 4 | 160 | 43 | 2 | 0 | 0 | 0 | 0 | 2 |
| 14 | Zomelets | 6 | 300 | 60 | 190 | 2 | 20 | 46 | 2 | 0 | 0 | 0 | 0 | 2 |
| 15 | Meat Lover Pizza | 7 | 460 | 120 | 150 | 4 | 30 | 31 | 2 | 1 | 0 | 0 | 0 | 1 |
| 16 | Pork 'n' Brains | 7 | 650 | 660 | 430 | 3 | 70 | 35 | 2 | 0 | 0 | 0 | 0 | 2 |
| 17 | Fetidccine | 7 | 3200 | 4320 | 1900 | 3 | 220 | 11 | 2 | 0 | 0 | 0 | 0 | 2 |
| 18 | Mac & Fleas | 8 | 380 | 360 | 400 | 2 | 55 | 29 | 2 | 1 | 0 | 0 | 0 | 1 |
| 19 | Wormicelli | 8 | 1800 | 1200 | 900 | 3 | 90 | 45 | 2 | 0 | 0 | 0 | 0 | 2 |
| 20 | Gnasty Gnocchi | 9 | 475 | 840 | 375 | 3 | 80 | 18 | 3 | 1 | 0 | 0 | 0 | 1 |
| 21 | Tiramiseeeww | 9 | 250 | 90 | 120 | 3 | 30 | 41 | 3 | 0 | 0 | 0 | 0 | 2 |
| 22 | Flied Lice | 9 | 200 | 150 | 185 | 2 | 40 | 15 | 3 | 0 | 0 | 0 | 0 | 2 |
| 23 | Wonton Goop | 10 | 320 | 20 | 115 | 3 | 9 | 44 | 3 | 1 | 0 | 0 | 0 | 1 |
| 24 | Curry Slurry | 10 | 1100 | 1080 | 950 | 2 | 110 | 6 | 3 | 0 | 0 | 0 | 0 | 2 |
| 25 | Bul-goo-gi | 10 | 3000 | 1920 | 1100 | 4 | 150 | 2 | 3 | 0 | 0 | 0 | 0 | 2 |
| 26 | Misfortune Cookies | 11 | 100 | 15 | 125 | 1 | 7 | 47 | 3 | 1 | 0 | 0 | 0 | 1 |
| 27 | Faux Noodles | 11 | 475 | 420 | 300 | 3 | 70 | 10 | 3 | 0 | 0 | 0 | 0 | 2 |
| 28 | Ground Chuck | 12 | 440 | 120 | 200 | 3 | 40 | 21 | 4 | 1 | 0 | 0 | 0 | 1 |
| 29 | Burro-itos | 12 | 650 | 720 | 650 | 2 | 90 | 3 | 4 | 0 | 0 | 0 | 0 | 2 |
| 30 | Chili con Carney | 13 | 30 | 5 | 40 | 1 | 5 | 4 | 4 | 1 | 0 | 0 | 0 | 1 |
| 31 | Loco Tacos | 13 | 265 | 60 | 350 | 1 | 30 | 5 | 4 | 0 | 0 | 0 | 0 | 2 |
| 32 | Entrail-ladas | 14 | 125 | 15 | 75 | 2 | 9 | 8 | 4 | 1 | 0 | 0 | 0 | 1 |
| 33 | Guck-a-mole | 14 | 300 | 300 | 650 | 1 | 55 | 22 | 4 | 0 | 0 | 0 | 0 | 2 |
| 34 | Blood Pudding | 15 | 1900 | 1440 | 850 | 3 | 120 | 1 | 5 | 1 | 0 | 0 | 0 | 1 |
| 35 | Hag-Gus | 15 | 220 | 90 | 100 | 3 | 35 | 23 | 5 | 0 | 0 | 0 | 0 | 2 |
| 36 | Stake & Kidney Pies | 16 | 415 | 720 | 300 | 3 | 95 | 38 | 5 | 1 | 0 | 0 | 0 | 1 |
| 37 | Fishy Chips | 16 | 300 | 180 | 220 | 2 | 40 | 14 | 5 | 0 | 0 | 0 | 0 | 2 |
| 38 | Head Cheesesteak | 17 | 385 | 30 | 140 | 3 | 15 | 25 | 5 | 1 | 0 | 0 | 0 | 1 |
| 39 | Bangers & Mush | 17 | 1400 | 1080 | 650 | 3 | 130 | 81 | 5 | 0 | 1 | 0 | 0 | 2 |
| 40 | Lady Fingers | 18 | 210 | 15 | 120 | 6 | 10 | 27 | 6 | 1 | 0 | 0 | 0 | 1 |
| 41 | Foie Gross | 18 | 1250 | 480 | 300 | 6 | 85 | 16 | 6 | 0 | 0 | 0 | 0 | 2 |
| 42 | Escargut | 19 | 5500 | 2880 | 1100 | 7 | 200 | 9 | 6 | 1 | 0 | 0 | 0 | 1 |
| 43 | Stake Tar-Tar | 19 | 1040 | 120 | 150 | 8 | 45 | 39 | 6 | 0 | 0 | 0 | 0 | 2 |
| 44 | Fileted Minion | 20 | 1850 | 720 | 430 | 6 | 110 | 13 | 6 | 1 | 0 | 0 | 0 | 1 |
| 45 | Muscles Sprouts | 20 | 750 | 300 | 220 | 5 | 65 | 32 | 6 | 0 | 0 | 0 | 0 | 2 |
| 46 | Anti Hero Sandwich | 21 | 2500 | 1200 | 360 | 8 | 145 | 51 | 7 | 0 | 0 | 0 | 0 | 2 |
| 47 | Brine Shrimp Cocktail | 22 | 600 | 60 | 120 | 6 | 40 | 52 | 7 | 0 | 0 | 0 | 0 | 2 |
| 48 | Tofu Brain | 7 | 650 | 120 | 200 | 4 | 50 | 53 | 3 | 0 | 0 | 0 | 0 | 2 |
| 49 | Army Rations | 8 | 290 | 60 | 210 | 2 | 25 | 54 | 2 | 0 | 0 | 0 | 0 | 2 |
| 50 | Rot Dogs | 6 | 250 | 45 | 165 | 2 | 14 | 55 | 0 | 0 | 0 | 0 | 0 | 2 |
| 51 | Keblobs | 9 | 400 | 480 | 300 | 3 | 75 | 56 | 0 | 0 | 0 | 0 | 0 | 2 |
| 52 | Street Pizza | 8 | 340 | 240 | 350 | 2 | 40 | 57 | 0 | 2 | 0 | 0 | 0 | 2 |
| 53 | Jam on Toes | 5 | 260 | 300 | 340 | 2 | 90 | 58 | 0 | 3 | 0 | 0 | 0 | 2 |
| 54 | Net Prawn | 24 | 1100 | 180 | 250 | 6 | 60 | 59 | 0 | 1 | 0 | 0 | 0 | 1 |
| 55 | Haggis | 5 | 250 | 120 | 260 | 2 | 50 | 60 | 0 | 2 | 0 | 0 | 0 | 2 |
| 56 | Mice Pudding | 25 | 220 | 15 | 150 | 6 | 15 | 61 | 7 | 1 | 0 | 0 | 0 | 1 |
| 57 | Sandwitch | 26 | 420 | 60 | 280 | 3 | 35 | 62 | 0 | 1 | 0 | 0 | 0 | 1 |
| 58 | Caramel Adam's Apple | 5 | 275 | 60 | 260 | 3 | 50 | 63 | 8 | 2 | 0 | 0 | 0 | 2 |
| 59 | Roast Turk-key | 12 | 410 | 240 | 415 | 2 | 40 | 64 | 4 | 0 | 0 | 0 | 0 | 2 |
| 60 | Cremated Brulee | 15 | 500 | 440 | 315 | 3 | 80 | 65 | 0 | 0 | 0 | 0 | 0 | 2 |
| 61 | Snot Cross Buns | 17 | 2800 | 1850 | 1100 | 4 | 140 | 66 | 0 | 2 | 0 | 0 | 0 | 2 |
| 62 | Blood Shake | 19 | 325 | 310 | 360 | 2 | 50 | 67 | 0 | 2 | 0 | 0 | 0 | 2 |
| 63 | Fish Fingers | 27 | 1600 | 650 | 400 | 5 | 110 | 68 | 0 | 1 | 0 | 0 | 0 | 1 |
| 64 | Cuss-Turd Tart | 28 | 750 | 280 | 200 | 5 | 60 | 69 | 0 | 1 | 0 | 0 | 0 | 1 |
| 65 | Fruit Cake | 29 | 4500 | 2500 | 900 | 7 | 180 | 70 | 0 | 1 | 0 | 0 | 0 | 1 |
| 66 | Puking Duck | 16 | 1500 | 1100 | 700 | 5 | 130 | 71 | 0 | 2 | 0 | 0 | 0 | 2 |
| 67 | Leg Rolls | 18 | 400 | 700 | 350 | 3 | 100 | 72 | 0 | 2 | 0 | 0 | 0 | 2 |
| 68 | Lion's Head Meatballs | 30 | 1260 | 470 | 320 | 6 | 85 | 73 | 0 | 1 | 0 | 0 | 0 | 1 |
| 69 | Torn-Up-Cake | 31 | 315 | 180 | 240 | 3 | 45 | 74 | 0 | 1 | 0 | 0 | 0 | 1 |
| 70 | Bleeding Hearts | 32 | 3250 | 1900 | 1150 | 4 | 150 | 75 | 0 | 1 | 0 | 0 | 0 | 1 |
| 71 | Ape-a-Teaser | 19 | 500 | 440 | 315 | 3 | 80 | 76 | 0 | 0 | 0 | 0 | 0 | 2 |
| 72 | Festering Hot Chocolate | 20 | 800 | 460 | 400 | 5 | 150 | 77 | 0 | 2 | 0 | 0 | 0 | 2 |
| 73 | Hunch-Back Roast | 22 | 650 | 45 | 120 | 6 | 40 | 0 | 0 | 2 | 1 | 0 | 0 | 2 |
| 74 | Rotten-Apple Pie | 33 | 1500 | 500 | 320 | 6 | 95 | 1 | 0 | 1 | 1 | 0 | 0 | 1 |
| 75 | Tweet Loaf | 34 | 350 | 200 | 240 | 6 | 45 | 2 | 0 | 1 | 1 | 0 | 0 | 1 |
| 76 | Putrefied Clam Chowder | 35 | 1200 | 165 | 300 | 8 | 60 | 3 | 0 | 1 | 1 | 0 | 0 | 1 |
| 77 | Ham and Sneeze Sandwich | 36 | 450 | 400 | 300 | 4 | 75 | 4 | 0 | 1 | 1 | 0 | 0 | 1 |
| 78 | Chicken Fried Snake | 37 | 850 | 500 | 500 | 5 | 200 | 5 | 0 | 1 | 1 | 0 | 0 | 1 |
| 79 | Pigs in a Blanket | 38 | 3000 | 1850 | 1100 | 5 | 200 | 6 | 0 | 1 | 1 | 0 | 0 | 1 |
| 80 | Shamrock Shake | 11 | 2500 | 1800 | 1050 | 4 | 150 | 7 | 0 | 2 | 1 | 0 | 0 | 2 |
| 81 | Mourned Beef and Cabbage | 14 | 3300 | 1920 | 1200 | 4 | 145 | 8 | 0 | 2 | 1 | 0 | 0 | 2 |
| 82 | Entropy Cassoulet | 17 | 800 | 470 | 390 | 5 | 140 | 9 | 0 | 2 | 1 | 0 | 0 | 2 |
| 83 | Quasar Coffee | 21 | 1500 | 1000 | 700 | 5 | 140 | 10 | 0 | 2 | 1 | 0 | 0 | 2 |
| 84 | String (Theory) Cheese | 24 | 2500 | 1000 | 800 | 5 | 100 | 11 | 0 | 2 | 1 | 0 | 0 | 2 |
| 85 | Dark Matter Loaf | 25 | 800 | 450 | 410 | 6 | 150 | 12 | 0 | 0 | 1 | 0 | 0 | 2 |
| 86 | Frozen T-Oort Cloud | 13 | 1000 | 90 | 200 | 5 | 60 | 13 | 0 | 0 | 1 | 0 | 0 | 2 |
| 87 | Khyber-Belt Kebabs | 10 | 500 | 450 | 290 | 3 | 60 | 14 | 0 | 0 | 1 | 0 | 0 | 2 |
| 88 | Plutonian Cider | 39 | 500 | 800 | 500 | 5 | 100 | 15 | 0 | 1 | 1 | 0 | 0 | 1 |
| 89 | Europan Sea Slugs | 40 | 1500 | 500 | 390 | 6 | 110 | 16 | 0 | 1 | 1 | 0 | 0 | 1 |
| 90 | Spaghettified Meat Balls | 41 | 2200 | 1000 | 750 | 5 | 110 | 17 | 0 | 1 | 1 | 0 | 0 | 1 |
| 91 | Beeline Honey Glazed "Ham" | 7 | 550 | 400 | 500 | 3 | 110 | 18 | 8 | 4 | 1 | 0 | 0 | 2 |
| 92 | Buffalo Wings | 27 | 325 | 315 | 400 | 3 | 55 | 19 | 0 | 2 | 1 | 0 | 0 | 2 |
| 93 | Cockroach Calzone | 28 | 1945 | 825 | 540 | 5 | 95 | 20 | 0 | 2 | 1 | 0 | 0 | 2 |
| 94 | Deep Fried Bacon Wrapped Pizza | 29 | 2730 | 1050 | 835 | 6 | 112 | 21 | 0 | 2 | 1 | 0 | 0 | 2 |
| 95 | English Breakfast Pizza | 30 | 865 | 350 | 450 | 4 | 65 | 22 | 0 | 2 | 1 | 0 | 0 | 2 |
| 96 | Head Cheese Pizza | 31 | 1430 | 1250 | 625 | 5 | 56 | 23 | 0 | 0 | 1 | 0 | 0 | 2 |
| 97 | Meatzza | 32 | 525 | 350 | 425 | 3 | 55 | 24 | 0 | 0 | 1 | 0 | 0 | 2 |
| 98 | Peanut Butter & Jelly Pizza | 42 | 610 | 720 | 576 | 3 | 35 | 25 | 0 | 1 | 1 | 0 | 0 | 1 |
| 99 | Spoiled Sea Food Pizza | 43 | 1230 | 846 | 640 | 4 | 75 | 26 | 0 | 1 | 1 | 0 | 0 | 1 |
| 100 | Vegan Pizza | 44 | 2050 | 975 | 720 | 5 | 95 | 27 | 0 | 1 | 1 | 0 | 0 | 1 |
| 101 | Thorn Bread | 33 | 2000 | 950 | 650 | 5 | 85 | 35 | 0 | 2 | 1 | 0 | 0 | 2 |
| 102 | Ox Tail | 34 | 736 | 300 | 220 | 5 | 70 | 32 | 0 | 2 | 1 | 0 | 0 | 2 |
| 103 | Boiled Mystery Meat | 35 | 235 | 18 | 165 | 6 | 65 | 28 | 0 | 2 | 1 | 0 | 0 | 2 |
| 104 | Toe-Cooked Baked Beans | 36 | 1875 | 810 | 600 | 5 | 90 | 36 | 0 | 0 | 1 | 0 | 0 | 2 |
| 105 | Coal-Slaw | 37 | 532 | 800 | 550 | 5 | 95 | 29 | 0 | 0 | 1 | 0 | 0 | 2 |
| 106 | Rotisserie Chicken | 10 | 1366 | 1000 | 626 | 3 | 125 | 34 | 0 | 0 | 1 | 0 | 0 | 2 |
| 107 | Grief Brisket | 45 | 3850 | 2000 | 875 | 7 | 170 | 31 | 0 | 1 | 1 | 0 | 0 | 1 |
| 108 | Rancid Pulled Pork | 46 | 723 | 285 | 225 | 6 | 65 | 33 | 0 | 1 | 1 | 0 | 0 | 1 |
| 109 | Cracked Ribs | 47 | 1492 | 475 | 375 | 6 | 105 | 30 | 0 | 1 | 1 | 0 | 0 | 1 |
| 110 | Gruesome Gruel | 23 | 2450 | 1200 | 355 | 8 | 145 | 37 | 0 | 2 | 1 | 0 | 0 | 2 |
| 111 | Thumb Pudding | 26 | 3340 | 1900 | 1150 | 4 | 180 | 38 | 0 | 2 | 1 | 0 | 0 | 2 |
| 112 | Vile Veal | 34 | 425 | 800 | 550 | 5 | 80 | 39 | 0 | 2 | 1 | 0 | 0 | 2 |
| 113 | Rabid Rabbit | 17 | 1350 | 1000 | 650 | 4 | 130 | 40 | 0 | 0 | 1 | 0 | 0 | 2 |
| 114 | Tainted Sparkling Water | 23 | 285 | 15 | 150 | 6 | 20 | 41 | 0 | 0 | 1 | 0 | 0 | 2 |
| 115 | Toxic Trifle | 21 | 1050 | 120 | 150 | 8 | 50 | 42 | 0 | 0 | 1 | 0 | 0 | 2 |
| 116 | Stewed Ox Cheek | 48 | 265 | 18 | 180 | 6 | 66 | 43 | 0 | 1 | 1 | 0 | 0 | 1 |
| 117 | Torn Tripe | 49 | 650 | 710 | 576 | 3 | 40 | 44 | 0 | 1 | 1 | 0 | 0 | 1 |
| 118 | Broxy | 50 | 2010 | 935 | 670 | 6 | 85 | 45 | 0 | 1 | 1 | 0 | 0 | 1 |
| 119 | Ew-Nagi | 51 | 723 | 285 | 275 | 6 | 68 | 46 | 0 | 1 | 1 | 0 | 0 | 1 |
| 120 | Bento Brain Box | 52 | 525 | 350 | 425 | 4 | 58 | 47 | 0 | 1 | 1 | 0 | 0 | 1 |
| 121 | Roe Boat | 53 | 1500 | 1000 | 730 | 5 | 145 | 48 | 0 | 1 | 1 | 0 | 0 | 1 |
| 122 | Ghoul Cheese Pizza | 15 | 500 | 440 | 315 | 3 | 80 | 49 | 0 | 5 | 1 | 1 | 391 | 3 |
| 123 | Crunchy Crow Pizza | 15 | 300 | 180 | 220 | 2 | 40 | 50 | 0 | 0 | 1 | 1 | 0 | 3 |
| 124 | Red Eye Gratin | 15 | 2800 | 315 | 400 | 3 | 55 | 51 | 0 | 2 | 1 | 1 | 0 | 3 |
| 125 | Brain Rattail Pizza | 15 | 415 | 720 | 300 | 3 | 95 | 52 | 0 | 5 | 1 | 1 | 392 | 3 |
| 126 | Leech Ball Pizza | 15 | 300 | 180 | 220 | 2 | 40 | 53 | 0 | 5 | 1 | 1 | 392 | 3 |
| 127 | Cheesey Bake Tongue | 15 | 385 | 30 | 140 | 3 | 15 | 54 | 0 | 5 | 1 | 1 | 393 | 3 |
| 128 | Brain & Grease Pizza | 15 | 1400 | 1080 | 650 | 3 | 130 | 55 | 0 | 5 | 1 | 1 | 393 | 3 |
| 129 | Lavaian Maggot Pizza | 15 | 210 | 15 | 120 | 6 | 10 | 56 | 0 | 5 | 1 | 1 | 394 | 3 |
| 130 | Slug Lime Pizza | 15 | 1250 | 480 | 300 | 6 | 85 | 57 | 0 | 5 | 1 | 1 | 394 | 3 |
| 131 | Kidney Pie | 54 | 1500 | 1000 | 750 | 6 | 124 | 58 | 0 | 1 | 1 | 0 | 0 | 1 |
| 132 | Piranha Stew | 55 | 2900 | 1700 | 1420 | 5 | 188 | 59 | 0 | 1 | 1 | 0 | 0 | 1 |
| 133 | Roasted Scorpion King | 56 | 700 | 645 | 300 | 7 | 88 | 60 | 0 | 1 | 1 | 0 | 0 | 1 |
| 134 | Alfred and Pesto | 16 | 300 | 180 | 220 | 2 | 40 | 61 | 0 | 0 | 1 | 1 | 0 | 3 |
| 135 | Sneeze Disease Pizza | 16 | 450 | 240 | 350 | 2 | 40 | 62 | 0 | 0 | 1 | 1 | 0 | 3 |
| 136 | Reformed Burger | 16 | 800 | 660 | 400 | 4 | 130 | 63 | 0 | 5 | 1 | 2 | 397 | 4 |
| 137 | Donkey Dog | 16 | 500 | 440 | 315 | 3 | 80 | 64 | 0 | 5 | 1 | 2 | 397 | 4 |
| 138 | Grilled Foot n' Mouth | 16 | 220 | 90 | 100 | 3 | 35 | 65 | 0 | 5 | 1 | 2 | 398 | 4 |
| 139 | Jerk Elephant Skewers | 16 | 415 | 720 | 300 | 3 | 95 | 66 | 0 | 5 | 1 | 2 | 398 | 4 |
| 140 | Smoked Choppa | 16 | 300 | 180 | 220 | 2 | 40 | 67 | 0 | 5 | 1 | 2 | 399 | 4 |
| 141 | Body Builder Burger | 16 | 385 | 30 | 140 | 3 | 15 | 68 | 0 | 5 | 1 | 2 | 399 | 4 |
| 142 | Toads & Tofu | 57 | 1500 | 1000 | 750 | 6 | 124 | 69 | 0 | 1 | 1 | 0 | 0 | 1 |
| 143 | Vamp Burger | 58 | 2900 | 1700 | 1420 | 5 | 188 | 70 | 0 | 1 | 1 | 0 | 0 | 1 |
| 144 | Scissors Salad | 59 | 700 | 645 | 300 | 2 | 88 | 71 | 0 | 1 | 1 | 0 | 0 | 1 |
| 145 | Guts N' Guacamole | 5 | 150 | 20 | 200 | 1 | 10 | 72 | 0 | 5 | 1 | 3 | 410 | 5 |
| 146 | Batty Burritos | 5 | 200 | 40 | 175 | 2 | 15 | 73 | 0 | 5 | 1 | 3 | 410 | 5 |
| 147 | Bread Of The Dead | 5 | 250 | 90 | 225 | 2 | 40 | 74 | 0 | 5 | 1 | 3 | 411 | 5 |
| 148 | Time Bomb Tamales | 5 | 300 | 180 | 220 | 3 | 65 | 75 | 0 | 5 | 1 | 3 | 411 | 5 |
| 149 | Sugar Skulls | 5 | 225 | 45 | 100 | 4 | 25 | 76 | 0 | 5 | 1 | 3 | 412 | 5 |
| 150 | Fried Finger Fajitas | 5 | 550 | 360 | 450 | 3 | 100 | 77 | 0 | 5 | 1 | 3 | 412 | 5 |
| 151 | Leperoni Pizza | 60 | 1220 | 860 | 600 | 4 | 135 | 78 | 0 | 1 | 1 | 0 | 0 | 1 |
| 152 | Meatish Sweetballs | 61 | 950 | 700 | 650 | 3 | 108 | 79 | 0 | 1 | 1 | 0 | 0 | 1 |
| 153 | Riga Tony | 62 | 2075 | 1200 | 830 | 5 | 155 | 80 | 0 | 1 | 1 | 0 | 0 | 1 |
| 154 | Swampish Mousse | 63 | 2250 | 1260 | 850 | 3 | 170 | 78 | 0 | 1 | 0 | 0 | 0 | 1 |
| 155 | Sluggish Eclair | 64 | 1530 | 1045 | 735 | 4 | 126 | 79 | 0 | 1 | 0 | 0 | 0 | 1 |
| 156 | Hash Clown | 65 | 1875 | 735 | 550 | 6 | 100 | 80 | 0 | 1 | 0 | 0 | 0 | 1 |
| 157 | Quick Stir-fly | 8 | 580 | 420 | 500 | 2 | 62 | 81 | 0 | 0 | 0 | 0 | 0 | 2 |
| 158 | Bread & Brains Spread | 11 | 360 | 500 | 250 | 3 | 55 | 82 | 0 | 0 | 0 | 0 | 0 | 2 |
| 159 | Beetle in Beetroot Sauce | 14 | 670 | 600 | 680 | 2 | 90 | 83 | 0 | 0 | 0 | 0 | 0 | 2 |
| 160 | Spiderello | 18 | 850 | 350 | 480 | 4 | 85 | 84 | 0 | 0 | 0 | 0 | 0 | 2 |
| 161 | Fried Snakeroll | 20 | 1000 | 600 | 400 | 5 | 88 | 85 | 0 | 0 | 0 | 0 | 0 | 2 |
| 162 | Jumble Eye-ah | 24 | 1230 | 720 | 645 | 4 | 100 | 86 | 0 | 0 | 0 | 0 | 0 | 2 |
| 163 | Garden Gnome Salad | 66 | 1340 | 450 | 700 | 4 | 105 | 87 | 0 | 1 | 0 | 0 | 0 | 1 |
| 164 | Fetid Djinni | 67 | 1670 | 800 | 685 | 5 | 150 | 88 | 0 | 1 | 0 | 0 | 0 | 1 |
| 165 | Verminestroni | 68 | 1915 | 960 | 555 | 7 | 160 | 89 | 0 | 1 | 0 | 0 | 0 | 1 |
| 166 | Wiccan Nuggets | 69 | 1420 | 600 | 950 | 3 | 120 | 90 | 0 | 1 | 0 | 0 | 0 | 1 |
| 167 | Voodoo Fondue | 70 | 1815 | 860 | 720 | 5 | 145 | 91 | 0 | 1 | 0 | 0 | 0 | 1 |
| 168 | Eyestir Sauce Noodles | 71 | 2170 | 1320 | 580 | 8 | 162 | 92 | 0 | 1 | 0 | 0 | 0 | 1 |
| 169 | Leech Melba | 26 | 650 | 240 | 320 | 5 | 50 | 93 | 0 | 0 | 0 | 0 | 0 | 2 |
| 170 | Nukes'n Puke | 27 | 840 | 480 | 500 | 4 | 75 | 94 | 0 | 0 | 0 | 0 | 0 | 2 |
| 171 | Knuckle Sandwich | 28 | 915 | 520 | 330 | 6 | 82 | 95 | 0 | 0 | 0 | 0 | 0 | 2 |
| 172 | Druid's Juice | 8 | 220 | 150 | 265 | 2 | 22 | 96 | 0 | 5 | 0 | 4 | 430 | 6 |
| 173 | Hydrapanic Salad | 8 | 315 | 190 | 350 | 2 | 27 | 97 | 0 | 5 | 0 | 4 | 430 | 6 |
| 174 | Helm & Cheese | 8 | 445 | 225 | 360 | 3 | 40 | 98 | 0 | 5 | 0 | 4 | 431 | 6 |
| 175 | Unicorn Chowder | 8 | 540 | 280 | 375 | 3 | 45 | 99 | 0 | 5 | 0 | 4 | 431 | 6 |
| 176 | Dragon Soup | 8 | 615 | 360 | 420 | 3 | 60 | 100 | 0 | 5 | 0 | 4 | 432 | 6 |
| 177 | Holy Gauntlet Pottage | 8 | 680 | 400 | 480 | 3 | 65 | 101 | 0 | 5 | 0 | 4 | 432 | 6 |
| 178 | Crimonade Can | 72 | 1755 | 880 | 900 | 4 | 152 | 102 | 0 | 1 | 0 | 0 | 0 | 1 |
| 179 | Orc Steak | 73 | 1580 | 580 | 1080 | 3 | 123 | 103 | 0 | 1 | 0 | 0 | 0 | 1 |
| 180 | Mandragora Dip | 74 | 2375 | 1220 | 695 | 7 | 168 | 104 | 0 | 1 | 0 | 0 | 0 | 1 |
| 181 | Eyeberry Jelly | 11 | 580 | 620 | 385 | 3 | 80 | 105 | 10 | 0 | 0 | 0 | 0 | 2 |
| 182 | Red Dragon | 11 | 2250 | 1200 | 950 | 4 | 140 | 106 | 10 | 2 | 0 | 0 | 0 | 2 |
| 183 | Plundered Blowfish | 11 | 740 | 280 | 530 | 3 | 70 | 107 | 0 | 6 | 0 | 0 | 0 | 7 |
| 184 | Oyster Pearls | 11 | 635 | 240 | 445 | 3 | 85 | 108 | 0 | 6 | 0 | 0 | 0 | 7 |
| 185 | Jelly Roger Custard | 11 | 410 | 180 | 505 | 2 | 65 | 109 | 0 | 6 | 0 | 0 | 0 | 7 |
| 186 | Molar Breakers | 11 | 860 | 330 | 440 | 4 | 90 | 110 | 0 | 6 | 0 | 0 | 0 | 7 |
| 187 | Shark Tooth Dullers | 11 | 935 | 385 | 495 | 4 | 95 | 111 | 0 | 6 | 0 | 0 | 0 | 7 |
| 188 | Killer Squid | 11 | 1005 | 500 | 520 | 4 | 100 | 112 | 0 | 6 | 0 | 0 | 0 | 7 |
| 189 | Snake-Snacks | 75 | 1840 | 900 | 755 | 5 | 155 | 113 | 0 | 1 | 0 | 0 | 0 | 1 |
| 190 | Greasy Grizzly | 76 | 2215 | 1160 | 800 | 6 | 167 | 114 | 0 | 1 | 0 | 0 | 0 | 1 |
| 191 | Elephant Toe Jam | 77 | 3055 | 1440 | 860 | 8 | 195 | 115 | 0 | 1 | 0 | 0 | 0 | 1 |
| 192 | Vampire Ash Browns | 13 | 140 | 240 | 120 | 3 | 50 | 116 | 0 | 6 | 0 | 0 | 0 | 8 |
| 193 | Staked Steak | 13 | 200 | 15 | 110 | 2 | 40 | 117 | 0 | 6 | 0 | 0 | 0 | 8 |
| 194 | Nosfera-Stew | 13 | 200 | 100 | 450 | 1 | 20 | 118 | 0 | 6 | 0 | 0 | 0 | 8 |
| 195 | Bat BQ | 13 | 210 | 220 | 145 | 3 | 45 | 119 | 0 | 6 | 0 | 0 | 0 | 8 |
| 196 | Heart Dog on a Stake | 13 | 225 | 180 | 250 | 2 | 35 | 120 | 0 | 6 | 0 | 0 | 0 | 8 |
| 197 | Garlic Choke | 13 | 500 | 450 | 300 | 1 | 30 | 121 | 0 | 6 | 0 | 0 | 0 | 8 |
| 198 | Crucy Fries | 78 | 835 | 360 | 580 | 3 | 80 | 125 | 0 | 1 | 0 | 0 | 0 | 1 |
| 199 | Eye Pop Candy | 79 | 600 | 180 | 1215 | 1 | 100 | 126 | 0 | 1 | 0 | 0 | 0 | 1 |
| 200 | Crypt Cake | 80 | 780 | 420 | 750 | 2 | 75 | 124 | 0 | 1 | 0 | 0 | 0 | 1 |
| 201 | Fish Bones & Gold Chips | 12 | 925 | 315 | 505 | 4 | 80 | 127 | 11 | 0 | 0 | 0 | 0 | 2 |
| 202 | Chili Chili Bang Bang | 12 | 1425 | 440 | 610 | 5 | 95 | 128 | 11 | 2 | 0 | 0 | 0 | 2 |
| 203 | Blueberry Fangcake | 13 | 2600 | 600 | 700 | 6 | 105 | 139 | 12 | 2 | 0 | 0 | 0 | 2 |
| 204 | Dracooler | 13 | 1350 | 90 | 250 | 6 | 65 | 138 | 12 | 0 | 0 | 0 | 0 | 2 |
| 205 | Fireball Spaghetti | 14 | 250 | 100 | 265 | 2 | 44 | 129 | 0 | 5 | 0 | 5 | 478 | 9 |
| 206 | Zap Bar | 14 | 150 | 60 | 200 | 2 | 32 | 130 | 0 | 5 | 0 | 5 | 478 | 9 |
| 207 | Super Fruit Punch | 14 | 405 | 15 | 295 | 3 | 12 | 131 | 0 | 5 | 0 | 5 | 479 | 9 |
| 208 | Orion Soup | 14 | 400 | 200 | 285 | 3 | 68 | 132 | 0 | 5 | 0 | 5 | 479 | 9 |
| 209 | Green Belt Peppers | 14 | 430 | 245 | 235 | 4 | 75 | 133 | 0 | 5 | 0 | 5 | 480 | 9 |
| 210 | Reactor Burger | 14 | 700 | 450 | 290 | 4 | 80 | 134 | 0 | 5 | 0 | 5 | 480 | 9 |
| 211 | Tropical Coco Brain | 81 | 2820 | 840 | 720 | 7 | 205 | 135 | 0 | 1 | 0 | 0 | 0 | 1 |
| 212 | Cali Snail Rolls | 82 | 3295 | 1200 | 820 | 8 | 218 | 136 | 0 | 1 | 0 | 0 | 0 | 1 |
| 213 | Croccoli Soup | 83 | 3640 | 1560 | 900 | 9 | 232 | 137 | 0 | 1 | 0 | 0 | 0 | 1 |
| 214 | Brain Washer Soup | 14 | 600 | 20 | 600 | 2 | 18 | 143 | 13 | 0 | 0 | 0 | 0 | 2 |
| 215 | Nuke Fondue | 14 | 1800 | 1080 | 975 | 4 | 110 | 144 | 13 | 0 | 0 | 0 | 0 | 2 |

## Appendix B — Complete character table (219 rows)

Source: `zc-revival:src/assets/data/characterData.bin.mid.json`. Cost is cash unless Tox=Y
(then Toxin). Lvl 255 = not recruitable (enemy/boss/defeat-to-unlock). CkSpd/TipX/Regen/CkXP
are chef multipliers. F = IsFemale. U8/U9/U10 are unresolved 1-10 stats (one is attack speed).
Tag links themed packs (see 2.1). ArtHead/Art = character-part sheet keys.

| # | Name | Lvl | Energy | Spd | Atk | Tip | F | Cost | Tox | CkSpd | TipX | Regen | CkXP | U8 | U9 | U10 | Tag | ArtHead | Art |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Man | 0 | 100 | 4 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | generic |  |
| 1 | Senior | 0 | 100 | 4 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | oldman | faris |
| 2 | Woman | 0 | 100 | 4 | 4 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | genericfemale |  |
| 3 | Hipster | 0 | 100 | 4 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | generic | omar |
| 4 | Cashier | 0 | 100 | 4 | 4 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | genericfemale | cutegirl |
| 5 | Couch Potato | 0 | 100 | 4 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 4 | 4 | 0 | nerd | faris |
| 6 | Couch Potato | 0 | 100 | 4 | 4 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 4 | 4 | 0 | genericfemale |  |
| 7 | Telemarketer | 0 | 100 | 3 | 4 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | generic |  |
| 8 | Telemarketer | 0 | 100 | 3 | 4 | 5 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 5 | 5 | 0 | generic | businesswoman |
| 9 | Teacher | 0 | 100 | 4 | 3 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 6 | 6 | 0 | nerd | generic |
| 10 | Teacher | 0 | 100 | 4 | 3 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 6 | 6 | 0 | nerd | oldlady |
| 11 | Accountant | 0 | 100 | 4 | 4 | 2 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 6 | 6 | 0 | businessman | oldman |
| 12 | Yoga Instructor | 0 | 100 | 4 | 5 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 5 | 4 | 4 | 0 | firefighter | cutegirl |
| 13 | Businessman | 0 | 100 | 4 | 3 | 4 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 4 | 6 | 0 | businessman | faris |
| 14 | Businessman | 0 | 90 | 4 | 3 | 4 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 4 | 6 | 0 | businessman |  |
| 15 | Businesswoman | 0 | 90 | 4 | 3 | 4 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 4 | 6 | 0 | businesswoman |  |
| 16 | Politician | 6 | 90 | 4 | 3 | 5 |  | 100 |  | 1 | 1 | 1 | 1 | 3 | 6 | 6 | 0 | businessman |  |
| 17 | Politician | 2 | 90 | 4 | 3 | 5 | Y | 100 |  | 1 | 1 | 1 | 1 | 3 | 6 | 6 | 0 | businesswoman |  |
| 18 | Executive | 9 | 90 | 4 | 3 | 7 |  | 750 |  | 1 | 1 | 1 | 1 | 3 | 8 | 8 | 0 | businessman |  |
| 19 | Executive | 9 | 90 | 4 | 3 | 7 | Y | 750 |  | 1 | 1 | 1 | 1 | 3 | 8 | 8 | 0 | businesswoman |  |
| 20 | CEO | 12 | 90 | 4 | 3 | 10 |  | 1500 |  | 1 | 1 | 1 | 1 | 3 | 8 | 6 | 0 | businessman |  |
| 21 | CEO | 12 | 90 | 4 | 3 | 10 | Y | 1500 |  | 1 | 1 | 1 | 1 | 3 | 8 | 6 | 0 | businesswoman |  |
| 22 | Retiree | 0 | 70 | 1 | 2 | 6 |  | 0 |  | 1 | 1 | 1 | 1 | 3 | 2 | 10 | 0 | oldman |  |
| 23 | Retiree | 0 | 70 | 1 | 2 | 6 | Y | 0 |  | 1 | 1 | 1 | 1 | 3 | 2 | 10 | 0 | genericfemale | oldlady |
| 24 | Veteran | 0 | 100 | 2 | 6 | 6 |  | 100 |  | 1 | 1 | 1 | 1 | 4 | 4 | 6 | 0 | firefighter | oldman |
| 25 | Centenarian | 6 | 50 | 1 | 2 | 6 |  | 0 |  | 1 | 1 | 1 | 1 | 1 | 2 | 10 | 0 | oldman |  |
| 26 | Teenager | 0 | 85 | 7 | 4 | 1 |  | 0 |  | 1 | 1 | 1 | 1 | 6 | 2 | 2 | 0 | teen |  |
| 27 | Punk | 7 | 85 | 8 | 5 | 1 |  | 500 |  | 1 | 1 | 1 | 1 | 6 | 6 | 2 | 0 | teen |  |
| 28 | Underachiever | 0 | 80 | 5 | 4 | 1 |  | 0 |  | 1 | 1 | 1 | 1 | 6 | 1 | 2 | 0 | teen | omar |
| 29 | Class Clown | 11 | 90 | 7 | 4 | 6 |  | 750 |  | 1 | 1 | 1 | 1 | 6 | 6 | 2 | 0 | teen |  |
| 30 | Nerd | 2 | 65 | 7 | 2 | 4 |  | 200 |  | 1 | 1 | 1 | 1 | 1 | 9 | 9 | 0 | nerd |  |
| 31 | Mathlete | 2 | 65 | 9 | 4 | 3 |  | 750 |  | 1 | 1 | 1 | 1 | 1 | 9 | 6 | 0 | businessman | nerd |
| 32 | CIO | 10 | 75 | 8 | 3 | 8 |  | 1500 |  | 1 | 1 | 1 | 1 | 1 | 6 | 1 | 0 | oldman | nerd |
| 33 | Construction Worker | 3 | 140 | 3 | 9 | 1 |  | 250 |  | 1 | 1 | 1 | 1 | 2 | 3 | 2 | 0 | teen | constructionworker |
| 34 | Engineer | 4 | 140 | 3 | 7 | 2 |  | 500 |  | 1 | 1 | 1 | 1 | 2 | 7 | 2 | 0 | constructionworker |  |
| 35 | Foreman | 7 | 150 | 4 | 8 | 3 |  | 1500 |  | 1 | 1 | 1 | 1 | 2 | 6 | 3 | 0 | businessman | constructionworker |
| 36 | Cop | 5 | 140 | 6 | 7 | 2 |  | 1 | Y | 1 | 1 | 1 | 1 | 3 | 7 | 9 | 0 | officer |  |
| 37 | Traffic Cop | 10 | 140 | 5 | 6 | 3 |  | 1 | Y | 1 | 1 | 1 | 1 | 3 | 10 | 10 | 0 | constructionworker | officer |
| 38 | Sergeant | 7 | 150 | 5 | 8 | 7 |  | 10 | Y | 1 | 1 | 1 | 1 | 3 | 8 | 10 | 0 | businessman | officer |
| 39 | Local Hero | 8 | 160 | 6 | 7 | 6 |  | 10 | Y | 1 | 1 | 1 | 1 | 3 | 8 | 10 | 0 | officer | omar |
| 40 | Boxer | 7 | 225 | 7 | 9 | 1 |  | 15 | Y | 1 | 1 | 1 | 1 | 6 | 1 | 1 | 0 | boxer |  |
| 41 | Has-been | 15 | 150 | 5 | 7 | 2 |  | 1 | Y | 1 | 1 | 1 | 1 | 3 | 2 | 1 | 0 | boxer |  |
| 42 | The Champ | 7 | 250 | 8 | 10 | 6 |  | 20 | Y | 1 | 1 | 1 | 1 | 7 | 2 | 1 | 0 | boxer |  |
| 43 | Football Player | 3 | 160 | 7 | 7 | 1 |  | 2 | Y | 1 | 1 | 1 | 1 | 9 | 1 | 1 | 0 | footballplayer |  |
| 44 | Benchwarmer | 15 | 130 | 5 | 5 | 1 |  | 1 | Y | 1 | 1 | 1 | 1 | 9 | 1 | 1 | 0 | generic | footballplayer |
| 45 | Star Player | 7 | 180 | 9 | 8 | 3 |  | 15 | Y | 1 | 1 | 1 | 1 | 9 | 5 | 3 | 0 | footballplayer | generic |
| 46 | Clown | 8 | 110 | 5 | 5 | 10 |  | 8 | Y | 1 | 1 | 1 | 1 | 1 | 7 | 5 | 0 | clown |  |
| 47 | Stoogey the Clown | 8 | 130 | 9 | 5 | 10 |  | 12 | Y | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | teen | clown |
| 48 | Fire Fighter | 9 | 120 | 6 | 7 | 4 |  | 750 |  | 1 | 1 | 1 | 1 | 6 | 5 | 2 | 0 | firefighter |  |
| 49 | Fire Chief | 10 | 140 | 5 | 8 | 6 |  | 1800 |  | 1 | 1 | 1 | 1 | 8 | 6 | 3 | 0 | businessman | firefighter |
| 50 | Sumo Wrestler | 8 | 400 | 5 | 10 | 1 |  | 30 | Y | 1 | 1 | 1 | 1 | 7 | 3 | 10 | 0 | sumowrestler |  |
| 51 | Celebrity | 10 | 80 | 7 | 4 | 9 | Y | 5 | Y | 1 | 1 | 1 | 1 | 8 | 3 | 3 | 0 | model |  |
| 52 | Supermodel | 12 | 80 | 10 | 4 | 8 | Y | 10 | Y | 1 | 1 | 1 | 1 | 10 | 3 | 3 | 0 | model |  |
| 53 | Movie Star | 12 | 100 | 8 | 5 | 10 | Y | 15 | Y | 1 | 1 | 1 | 1 | 5 | 7 | 5 | 0 | model |  |
| 54 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef |  |
| 55 | Chef | 0 | 90 | 5 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | generic |
| 56 | Chef | 0 | 90 | 5 | 4 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | genericfemale |
| 57 | Chef | 0 | 90 | 5 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | businessman |
| 58 | Chef | 0 | 90 | 5 | 4 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | businesswoman |
| 59 | Chef | 0 | 90 | 5 | 4 | 3 | Y | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | cutegirl |
| 60 | Chef | 0 | 90 | 5 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | teen |
| 61 | Chef | 0 | 90 | 5 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | faris |
| 62 | Chef | 0 | 90 | 5 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | nerd |
| 63 | Chef | 0 | 90 | 5 | 4 | 3 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | omar |
| 64 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefgeneric |
| 65 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefdiner |
| 66 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefitalian |
| 67 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefasian |
| 68 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemycheftexmex |
| 69 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefpub |
| 70 | Enemy Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemycheffrench |
| 71 | Mad Scientist Chef | 255 | 100 | 5 | 5 | 5 |  | 0 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefscientist |
| 72 | Chef | 3 | 120 | 5 | 5 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | generic |
| 73 | Chef | 3 | 120 | 5 | 5 | 6 | Y | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | genericfemale |
| 74 | Chef | 3 | 120 | 5 | 5 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | businessman |
| 75 | Chef | 3 | 120 | 5 | 5 | 6 | Y | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | businesswoman |
| 76 | Chef | 3 | 120 | 5 | 5 | 6 | Y | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | cutegirl |
| 77 | Chef | 3 | 120 | 5 | 5 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | teen |
| 78 | Chef | 3 | 120 | 5 | 5 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | faris |
| 79 | Chef | 3 | 120 | 5 | 5 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | nerd |
| 80 | Reality Star | 15 | 80 | 6 | 4 | 8 | Y | 1 | Y | 1 | 1 | 1 | 1 | 8 | 1 | 1 | 0 | model |  |
| 81 | Mikazuna | 12 | 625 | 6 | 10 | 6 |  | 50 | Y | 1 | 1 | 1 | 1 | 7 | 7 | 10 | 0 | sumowrestler |  |
| 82 | Yokozuna | 12 | 625 | 6 | 10 | 6 |  | 50 | Y | 1 | 1 | 1 | 1 | 7 | 7 | 10 | 0 | sumowrestler |  |
| 83 | Retro-Boxer | 15 | 180 | 8 | 8 | 1 |  | 12 | Y | 1 | 1 | 1 | 1 | 6 | 1 | 1 | 0 | boxer |  |
| 84 | Middleweight | 15 | 180 | 8 | 8 | 1 |  | 12 | Y | 1 | 1 | 1 | 1 | 6 | 1 | 1 | 0 | boxer |  |
| 85 | Chef | 3 | 120 | 5 | 5 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | omar |
| 86 | Veteran Cop | 15 | 125 | 6 | 7 | 6 |  | 1 | Y | 1 | 1 | 1 | 1 | 3 | 7 | 9 | 0 | officer | oldman |
| 87 | Football Player | 3 | 160 | 7 | 7 | 1 |  | 20 |  | 1 | 1 | 1 | 1 | 9 | 1 | 1 | 0 | enemyChef | footballplayer |
| 88 | Engineer | 4 | 140 | 3 | 7 | 2 |  | 200 |  | 1 | 1 | 1 | 1 | 2 | 7 | 2 | 0 | enemyChef | constructionworker |
| 89 | Retiree | 5 | 70 | 1 | 2 | 6 | Y | 500 |  | 1 | 1 | 1 | 1 | 3 | 2 | 10 | 0 | enemyChef | oldlady |
| 90 | Veteran | 6 | 100 | 2 | 6 | 6 |  | 800 |  | 1 | 1 | 1 | 1 | 4 | 4 | 6 | 0 | enemyChef | oldman |
| 91 | The Champ | 7 | 250 | 8 | 10 | 6 |  | 1200 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | boxer |
| 92 | Local Hero | 8 | 260 | 10 | 7 | 6 |  | 1400 |  | 1 | 1 | 1 | 1 | 3 | 8 | 10 | 0 | enemyChef | officer |
| 93 | Stoogey the Clown | 9 | 150 | 9 | 5 | 10 |  | 2400 |  | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | enemyChef | clown |
| 94 | Fire Chief | 10 | 160 | 5 | 8 | 6 |  | 3200 |  | 1 | 1 | 1 | 1 | 8 | 6 | 3 | 0 | enemyChef | firefighter |
| 95 | Yokozuna | 12 | 525 | 6 | 10 | 6 |  | 5000 |  | 1 | 1 | 1 | 1 | 7 | 7 | 10 | 0 | enemyChef | sumowrestler |
| 96 | Movie Star | 12 | 100 | 8 | 5 | 10 | Y | 5000 |  | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | model |
| 97 | Football Player | 3 | 320 | 7 | 7 | 1 |  | 2 | Y | 1 | 1 | 1 | 1 | 9 | 1 | 1 | 0 | enemyChef | footballplayer |
| 98 | Engineer | 4 | 280 | 3 | 7 | 2 |  | 10 | Y | 1 | 1 | 1 | 1 | 2 | 7 | 2 | 0 | enemyChef | constructionworker |
| 99 | Retiree | 5 | 140 | 1 | 2 | 6 | Y | 5 | Y | 1 | 1 | 1 | 1 | 3 | 2 | 10 | 0 | enemyChef | oldlady |
| 100 | Veteran | 6 | 200 | 2 | 6 | 6 |  | 5 | Y | 1 | 1 | 1 | 1 | 4 | 4 | 6 | 0 | enemyChef | oldman |
| 101 | The Champ | 7 | 500 | 8 | 10 | 6 |  | 20 | Y | 1 | 3 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | boxer |
| 102 | Local Hero | 8 | 520 | 10 | 7 | 6 |  | 10 | Y | 1 | 1 | 1 | 1 | 3 | 8 | 10 | 0 | enemyChef | officer |
| 103 | Stoogey the Clown | 9 | 300 | 9 | 5 | 10 |  | 12 | Y | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 0 | enemyChef | clown |
| 104 | Fire Chief | 10 | 320 | 5 | 8 | 6 |  | 10 | Y | 1 | 1 | 1 | 1 | 8 | 6 | 3 | 0 | enemyChef | firefighter |
| 105 | Yokozuna | 12 | 1050 | 6 | 10 | 6 |  | 50 | Y | 1 | 1 | 1.1 | 1 | 7 | 7 | 10 | 0 | enemyChef | sumowrestler |
| 106 | Movie Star | 12 | 200 | 8 | 5 | 10 | Y | 15 | Y | 1 | 5 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | model |
| 107 | Robo | 8 | 500 | 8 | 10 | 10 |  | 50 | Y | 1.11 | 1 | 1 | 1 | 8 | 8 | 8 | 0 | robot |  |
| 108 | Captain Jack | 10 | 500 | 8 | 10 | 10 |  | 50 | Y | 1 | 1 | 1 | 1.2 | 8 | 8 | 8 | 0 | pirate |  |
| 109 | Cafe Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefgeneric |
| 110 | Diner Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefdiner |
| 111 | Italian Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefitalian |
| 112 | Asian Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefasian |
| 113 | Tex Mex Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemycheftexmex |
| 114 | Pub Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefpub |
| 115 | French Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemycheffrench |
| 116 | Mad Scientist Chef | 255 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 3 | 1 | 1 | 5 | 5 | 5 | 0 | enemyChef | enemychefscientist |
| 117 | Private | 0 | 100 | 5 | 5 | 2 |  | 600 |  | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | military | teen |
| 118 | Colonel | 7 | 120 | 6 | 6 | 2 |  | 1000 |  | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | military | businessman |
| 119 | Corporal | 9 | 150 | 6 | 8 | 2 |  | 2000 |  | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | military | military |
| 120 | Old Hippie | 4 | 80 | 2 | 4 | 5 |  | 400 |  | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | hippie | oldman |
| 121 | Young Male Hippie | 6 | 100 | 3 | 4 | 5 |  | 800 |  | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | hippie | teen |
| 122 | Young Female Hippie | 8 | 100 | 3 | 4 | 5 | Y | 1500 |  | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | hippie | hippie |
| 123 | Corporal Chef | 9 | 150 | 6 | 8 | 2 |  | 2000 |  | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | enemyChef | military |
| 124 | Hippie Chef | 4 | 80 | 2 | 4 | 5 | Y | 400 |  | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | enemyChef | hippie |
| 125 | Corporal Chef | 9 | 500 | 6 | 8 | 2 |  | 40 | Y | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | enemyChef | military |
| 126 | Hippie Chef | 4 | 160 | 2 | 4 | 5 | Y | 5 | Y | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | enemyChef | hippie |
| 127 | Frankenstein | 255 | 1200 | 9 | 10 | 7 |  | 100 | Y | 1 | 5 | 1 | 1 | 8 | 5 | 7 | 0 | enemyChef | Frankenstein |
| 128 | Mummy Chef | 5 | 240 | 2 | 4 | 5 | Y | 5 | Y | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | FrankieFemaleMummy | femaleMummy |
| 129 | Male Mummy Chef | 6 | 240 | 2 | 4 | 5 |  | 5 | Y | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | FrankieMaleMummy | maleMummy |
| 130 | Witch Chef | 7 | 360 | 6 | 8 | 2 | Y | 20 | Y | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | FrankieWitch | witch |
| 131 | Wolfman Chef | 8 | 500 | 8 | 5 | 10 |  | 40 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | FrankieWolfman | wolfman |
| 132 | Mummy | 5 | 120 | 2 | 4 | 5 | Y | 1000 |  | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | femaleMummy | femaleMummy |
| 133 | Mummy | 6 | 120 | 2 | 4 | 5 |  | 1000 |  | 1 | 1 | 1 | 1 | 3 | 2 | 7 | 0 | maleMummy | maleMummy |
| 134 | Witch | 7 | 180 | 6 | 8 | 2 | Y | 10 | Y | 1 | 1 | 1 | 1 | 3 | 5 | 7 | 0 | witch | witch |
| 135 | Werewolf | 8 | 250 | 8 | 5 | 10 |  | 20 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | wolfman | wolfman |
| 136 | Bride of Frankenstein | 10 | 1000 | 8 | 9 | 9 | Y | 80 | Y | 1 | 2 | 1 | 1 | 8 | 6 | 8 | 0 | femaleMummy | BrideOfFrankenstein |
| 137 | Alien | 15 | 500 | 9 | 8 | 5 |  | 50 | Y | 1 | 1 | 1.5 | 1 | 10 | 10 | 10 | 0 | robot | Martian |
| 138 | Evil Leprechaun | 255 | 1200 | 9 | 5 | 10 |  | 75 | Y | 1.11 | 1 | 1 | 1 | 8 | 6 | 6 | 0 | enemyChef | Leprechaun |
| 139 | Martian Scientist | 7 | 250 | 8 | 5 | 5 |  | 99000 |  | 1 | 1 | 1 | 1.2 | 5 | 10 | 7 | 0 | martian1 | martian1 |
| 140 | Martian Soldier | 7 | 650 | 8 | 10 | 6 |  | 30 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | martian2 | martian2 |
| 141 | Martian Commander | 7 | 700 | 7 | 6 | 10 |  | 30 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 7 | 0 | martian3 | martian3 |
| 142 | Martian Doctor | 8 | 250 | 5 | 5 | 7 |  | 95000 |  | 1 | 1 | 1.2 | 1 | 6 | 7 | 10 | 0 | martian4 | martian4 |
| 143 | Italian Chef (Red) | 6 | 500 | 5 | 7 | 7 |  | 25 | Y | 1 | 2 | 1 | 1 | 5 | 7 | 5 | 0 | chefitalian1 | chefitalian1 |
| 144 | Italian Chef (Green) | 7 | 500 | 7 | 5 | 7 |  | 25 | Y | 1.11 | 1 | 1 | 1 | 7 | 5 | 5 | 0 | chefitalian2 | chefitalian2 |
| 145 | Italian Chef (Yellow) | 8 | 500 | 5 | 7 | 5 |  | 25 | Y | 1 | 1 | 1.3 | 1 | 7 | 7 | 5 | 0 | chefitalian3 | chefitalian3 |
| 146 | Betty Sue | 10 | 500 | 7 | 5 | 9 | Y | 25 | Y | 1 | 2 | 1.2 | 1 | 8 | 6 | 6 | 0 | enemyChef | chefwesternBettySue |
| 147 | Billy Bob | 10 | 500 | 6 | 9 | 6 |  | 25 | Y | 1.11 | 1 | 1 | 1 | 7 | 8 | 5 | 0 | enemyChef | chefwesternBillyBob |
| 148 | Bobby Billy | 10 | 500 | 9 | 8 | 5 |  | 25 | Y | 1 | 1 | 1 | 1.2 | 6 | 6 | 7 | 0 | enemyChef | chefwesternBobbyBill |
| 149 | Cowboy | 11 | 500 | 7 | 6 | 8 |  | 30 | Y | 1 | 1 | 1.1 | 1 | 5 | 10 | 5 | 0 | cowboy | cowboy |
| 150 | Steam Punk Professor | 11 | 600 | 7 | 6 | 8 |  | 30 | Y | 1 | 2 | 1.1 | 1 | 6 | 9 | 6 | 0 | steampukHarold | steampukHarold |
| 151 | Steam Punk Lord | 11 | 500 | 6 | 5 | 6 |  | 97500 |  | 1 | 1 | 1 | 1.2 | 5 | 9 | 8 | 0 | steampukHarold | steampukJeoffry |
| 152 | Steam Punk Chef | 11 | 500 | 9 | 8 | 5 |  | 25 | Y | 1 | 1 | 1 | 1.2 | 6 | 6 | 7 | 0 | steampukChef | steampukChef |
| 153 | Black Ninja | 15 | 250 | 8 | 5 | 5 |  | 99000 |  | 1 | 1 | 1 | 1.2 | 5 | 10 | 7 | 0 | ninjaBlack | ninjaBlack |
| 154 | Blue Ninja | 15 | 650 | 8 | 10 | 6 |  | 25 | Y | 1 | 1 | 1 | 1 | 5 | 5 | 5 | 0 | ninjaBlue | ninjaBlue |
| 155 | Brown Ninja | 14 | 700 | 7 | 6 | 10 |  | 30 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 7 | 0 | ninjaBrown | ninjaBrown |
| 156 | Green Ninja | 7 | 250 | 5 | 5 | 7 |  | 85000 |  | 1 | 1 | 1.2 | 1 | 6 | 7 | 10 | 0 | ninjaGreen | ninjaGreen |
| 157 | Red Ninja | 15 | 700 | 7 | 6 | 10 |  | 30 | Y | 1 | 2 | 1 | 1 | 5 | 5 | 7 | 0 | ninjaRed | ninjaRed |
| 158 | White Ninja | 15 | 800 | 7 | 7 | 7 |  | 30 | Y | 1 | 1 | 1 | 1.2 | 6 | 7 | 10 | 0 | ninjaWhite | ninjaWhite |
| 159 | East Coast Rap Artist | 7 | 250 | 8 | 10 | 6 |  | 20 | Y | 1 | 1 | 1 | 1 | 7 | 2 | 1 | 0 | eastRapper1 | eastRapper1 |
| 160 | East Coast DJ | 7 | 180 | 9 | 8 | 3 |  | 15 | Y | 1 | 1 | 1 | 1 | 9 | 5 | 3 | 0 | eastRapper2 | eastRapper2 |
| 161 | West Coast DJ | 8 | 400 | 5 | 10 | 1 |  | 30 | Y | 1 | 1 | 1 | 1 | 7 | 3 | 10 | 0 | westRapper1 | westRapper1 |
| 162 | West Coast Rap Artist | 7 | 250 | 8 | 10 | 6 |  | 20 | Y | 1 | 1 | 1 | 1 | 7 | 2 | 1 | 0 | westRapper2 | westRapper2 |
| 163 | Chef Cousin Jimmy | 15 | 500 | 5 | 5 | 5 |  | 50 | Y | 1.2 | 3 | 1.5 | 1.3 | 5 | 5 | 5 | 394 | enemyChef | chefmafia4 |
| 164 | a` Papa Joe | 15 | 500 | 5 | 5 | 5 |  | 50 | Y | 1.15 | 2 | 1.3 | 1.2 | 5 | 5 | 5 | 393 | enemyChef | chefmafia3 |
| 165 | Chef Don Tony | 15 | 500 | 5 | 5 | 5 |  | 50 | Y | 1.1 | 2 | 1.2 | 1.1 | 5 | 5 | 5 | 392 | enemyChef | chefmafia2 |
| 166 | a` Chef Maurizio | 15 | 500 | 5 | 5 | 5 |  | 50 | Y | 1 | 2 | 1.1 | 1 | 5 | 5 | 5 | 391 | enemyChef | chefmafia1 |
| 167 | Mafia Goon | 15 | 800 | 9 | 10 | 1 |  | 50 | Y | 1 | 2 | 1.5 | 1 | 8 | 1 | 1 | 391 | mafiaCronies | mafiaCronies |
| 168 | NY Sports Fan | 6 | 250 | 7 | 7 | 3 |  | 20 | Y | 1 | 2 | 1.3 | 1 | 6 | 3 | 5 | 392 | yankeeFan | yankeeFan |
| 169 | Godfather | 15 | 500 | 5 | 6 | 10 |  | 50 | Y | 1 | 3 | 1.2 | 1 | 5 | 8 | 8 | 393 | godFather | godFather |
| 170 | Ditzy Mafia Girl | 14 | 250 | 6 | 5 | 8 | Y | 15 | Y | 1 | 3 | 1.1 | 1 | 6 | 5 | 8 | 394 | dumbMafiaGirl | dumbMafiaGirl |
| 171 | Chef Elephant | 16 | 500 | 5 | 5 | 5 |  | 50 | Y | 1.15 | 2 | 1.1 | 1.15 | 5 | 5 | 5 | 0 | enemyChef | chefElephant |
| 172 | Chef Donkey | 16 | 500 | 5 | 5 | 5 |  | 50 | Y | 1.15 | 2 | 1.1 | 1.15 | 5 | 5 | 5 | 0 | enemyChef | chefDonkey |
| 173 | Politician | 16 | 800 | 6 | 7 | 4 |  | 50 | Y | 1 | 2 | 1.3 | 1 | 6 | 3 | 4 | 397 | politican | politican |
| 174 | Candidate | 16 | 250 | 7 | 7 | 3 |  | 50 | Y | 1 | 2 | 1.3 | 1 | 5 | 3 | 5 | 398 | candidate | candidate |
| 175 | Governor | 16 | 500 | 5 | 3 | 9 | Y | 15 | Y | 1 | 3 | 1.2 | 1 | 4 | 8 | 1 | 0 | governor | governor |
| 176 | Ex-Governor | 16 | 250 | 4 | 9 | 9 |  | 20 | Y | 1 | 3 | 1.5 | 1 | 7 | 2 | 9 | 399 | exGovernor | exGovernor |
| 177 | Skeletal Bandito Chef | 5 | 500 | 5 | 5 | 5 |  | 50 | Y | 1.15 | 2 | 1.1 | 1.15 | 5 | 5 | 5 | 410 | enemyChef | chefBandito |
| 178 | Skeleton Bride | 5 | 700 | 7 | 8 | 4 | Y | 40 | Y | 1 | 2 | 1.3 | 1 | 5 | 3 | 3 | 411 | skeletonBride | skeletonBride |
| 179 | Skeleton Groom | 5 | 700 | 6 | 9 | 3 |  | 40 | Y | 1 | 2 | 1.3 | 1 | 4 | 3 | 5 | 410 | skeletonGroom | skeletonGroom |
| 180 | Calavera de Catrina | 5 | 200 | 5 | 3 | 9 | Y | 50000 |  | 1 | 3 | 1.2 | 1 | 4 | 8 | 1 | 412 | cavalera | cavalera |
| 181 | Zombie Claus | 10 | 650 | 5 | 8 | 7 |  | 25 | Y | 1 | 1 | 1.2 | 1 | 3 | 4 | 3 | 0 | enemyChef | chefSanta |
| 182 | Stir Fly Head Chef | 10 | 500 | 5 | 7 | 7 |  | 30 | Y | 1.15 | 2 | 1.1 | 1.15 | 3 | 4 | 3 | 0 | enemyChef | chefFlyHeader |
| 183 | Fish Head Monster | 10 | 400 | 7 | 7 | 7 |  | 40 | Y | 1 | 3 | 1.2 | 1 | 5 | 8 | 2 | 0 | fishface | fishface |
| 184 | Dr. Mantis Face | 10 | 400 | 5 | 7 | 8 |  | 30 | Y | 1.15 | 2 | 1.1 | 1.15 | 3 | 8 | 3 | 0 | mantisHead | mantisHead |
| 185 | Mr. ? | 9 | 350 | 6 | 5 | 7 |  | 20 | Y | 1 | 2 | 1.2 | 1 | 5 | 8 | 2 | 0 | mr | mr |
| 186 | Pink Retro Robot | 9 | 250 | 3 | 8 | 8 |  | 75000 |  | 1 | 1 | 1.2 | 1 | 5 | 5 | 4 | 0 | redRobotX | redRobotX |
| 187 | Blue Retro Robot | 10 | 800 | 3 | 10 | 8 |  | 50 | Y | 1 | 2 | 1.2 | 1 | 5 | 5 | 4 | 0 | robotX | robotX |
| 188 | Goblin Chef | 255 | 500 | 5 | 7 | 4 |  | 50 | Y | 1.2 | 2 | 1.1 | 1.2 | 4 | 4 | 6 | 0 | enemyChef | goblin |
| 189 | Knight in Armor | 8 | 350 | 3 | 7 | 6 |  | 95000 |  | 1 | 1 | 1.3 | 1 | 4 | 5 | 7 | 0 | knight | knight |
| 190 | Executioner | 8 | 250 | 4 | 6 | 4 |  | 75000 |  | 1 | 2 | 1.1 | 1 | 6 | 2 | 8 | 0 | executioner | executioner |
| 191 | Wizard | 8 | 400 | 5 | 8 | 3 |  | 30 | Y | 1 | 2 | 1.3 | 1 | 5 | 6 | 3 | 0 | wizard | wizard |
| 192 | Mighty King | 8 | 700 | 8 | 7 | 6 |  | 40 | Y | 1 | 3 | 1.1 | 1 | 4 | 2 | 3 | 0 | king | king |
| 193 | Dragon | 8 | 1000 | 7 | 10 | 2 |  | 50 | Y | 1 | 1 | 1.3 | 1 | 2 | 1 | 8 | 0 | dragon | dragon |
| 194 | Evil Queen | 8 | 700 | 7 | 9 | 3 | Y | 40 | Y | 1 | 1 | 1.1 | 1 | 7 | 2 | 2 | 0 | evilqueen | evilqueen |
| 195 | Female Captain | 11 | 650 | 8 | 6 | 6 | Y | 35 | Y | 1 | 3 | 1.1 | 1 | 7 | 5 | 4 | 0 | femaleCap | femaleCap |
| 196 | Marooner | 11 | 200 | 3 | 5 | 2 |  | 65000 |  | 1 | 1 | 1.1 | 1 | 3 | 2 | 3 | 0 | marooner | marooner |
| 197 | Undead Skeleton Pirate | 11 | 900 | 8 | 10 | 3 |  | 50 | Y | 1 | 1 | 1.3 | 1 | 5 | 5 | 3 | 0 | undeadPirate | undeadPirate |
| 198 | Shipmate | 11 | 350 | 6 | 4 | 3 |  | 90000 |  | 1 | 1 | 1.3 | 1 | 4 | 4 | 4 | 0 | shipmate | shipmate |
| 199 | Conquistador | 11 | 700 | 8 | 7 | 5 |  | 40 | Y | 1 | 2 | 1.2 | 1 | 6 | 6 | 8 | 0 | conquistador | conquistador |
| 200 | Chef Deadbeard | 255 | 950 | 8 | 9 | 7 |  | 70 | Y | 1.2 | 2 | 1.1 | 1.2 | 4 | 3 | 6 | 0 | deadbeard | deadbeard |
| 201 | Vampire Bride | 12 | 700 | 9 | 9 | 8 | Y | 45 | Y | 1 | 2 | 1.3 | 1 | 5 | 5 | 4 | 0 | undeadBride | undeadBride |
| 202 | Nosferatu | 9 | 300 | 3 | 7 | 4 |  | 80000 |  | 1 | 1 | 1.3 | 1 | 6 | 5 | 6 | 0 | nosferatu | nosferatu |
| 203 | Pure Blood | 10 | 650 | 7 | 7 | 8 |  | 35 | Y | 1 | 2 | 1.4 | 1 | 4 | 4 | 4 | 0 | pureBlood | pureBlood |
| 204 | Vampire Hunter | 12 | 850 | 10 | 9 | 6 |  | 50 | Y | 1 | 1 | 1.1 | 1 | 7 | 6 | 5 | 0 | vampireHunter | vampireHunter |
| 205 | Vampire Ghoul | 13 | 1000 | 9 | 10 | 3 |  | 60 | Y | 1 | 1 | 1.3 | 1 | 4 | 2 | 1 | 0 | worshiper | worshiper |
| 206 | Goth | 6 | 300 | 6 | 5 | 9 | Y | 15 | Y | 1 | 3 | 1.3 | 1 | 4 | 8 | 4 | 0 | gothGirl | gothGirl |
| 207 | Chef Dracula | 255 | 1000 | 10 | 9 | 9 |  | 90 | Y | 1.2 | 3 | 1.4 | 1.2 | 8 | 5 | 7 | 0 | dracula | dracula |
| 208 | Break-fast | 12 | 550 | 10 | 5 | 8 |  | 40 | Y | 1 | 2 | 1.2 | 1.2 | 10 | 8 | 6 | 0 | quickfast | quickfast |
| 209 | Shadow Skull | 12 | 750 | 6 | 9 | 4 |  | 40 | Y | 1 | 1 | 1.2 | 1 | 6 | 9 | 4 | 0 | shadowskull | shadowskull |
| 210 | Supper girl | 6 | 500 | 9 | 4 | 10 | Y | 35 | Y | 1 | 3 | 1.2 | 1.2 | 9 | 8 | 9 | 0 | suppergirl | suppergirl |
| 211 | Zombie Man | 14 | 1000 | 9 | 9 | 9 |  | 60 | Y | 1 | 2 | 1.3 | 1.1 | 9 | 9 | 10 | 0 | zombieman | zombieman |
| 212 | Dr. Hoboken | 13 | 950 | 9 | 10 | 4 |  | 50 | Y | 1 | 1 | 1.3 | 1 | 6 | 10 | 5 | 0 | drhoboken | drhoboken |
| 213 | Galacticus | 13 | 975 | 10 | 9 | 6 |  | 50 | Y | 1 | 1 | 1.3 | 1 | 4 | 9 | 4 | 0 | galacticus | galacticus |
| 214 | Henchman | 10 | 450 | 5 | 7 | 3 |  | 100000 |  | 1 | 1 | 1 | 1 | 6 | 3 | 2 | 0 | henchman | henchman |
| 215 | The Mad Griller | 255 | 1100 | 8 | 9 | 8 |  | 85 | Y | 1.2 | 2 | 1.2 | 1.2 | 8 | 7 | 6 | 0 | madgriller | madgriller |
| 216 | Maid | 14 | 200 | 12 | 5 | 20 | Y | 30000 |  | 1 | 1 | 1 | 1 | 5 | 8 | 50 | 0 | maidSA | maidSA |
| 217 | Maid | 14 | 200 | 12 | 5 | 20 | Y | 30000 |  | 1 | 1 | 1 | 1 | 5 | 8 | 50 | 0 | maidSB | maidSB |
| 218 | Lieutenant Colonel | 14 | 200 | 6 | 10 | 5 | Y | 60000 |  | 1 | 1 | 1 | 1 | 5 | 8 | 50 | 0 | MilitaryWomanK | MilitaryWomanK |

## Appendix C — Complete furniture/store table (484 rows)

Source: `zc-revival:src/assets/data/furnitureData.bin.mid.json`. Price is cash unless Tox=Y.
Type/Cat enums in 2.3. $/h + Cap = passive income. Rating = star-rating bonus. StvX =
stove speed multiplier. XP = award on purchase. Store = visible in store. Tag as in 2.1.

| # | Name | Lvl | Price | Tox | WxH | Type | Cat | $/h | Cap | Rating | StvX | XP | Store | Tag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Dirty fridge | 0 | 50 |  | 1x1 | 8 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 1 | Dirty stove | 0 | 50 |  | 1x1 | 1 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 2 | Dirty Sink | 0 | 50 |  | 1x1 | 11 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 3 | Plain table | 0 | 150 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 4 | Plain chair | 0 | 75 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 1 | Y | 0 |
| 5 | Boarded window | 1 | 50 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 1 | Y | 0 |
| 6 | Dead plant | 0 | 5 |  | 1x1 | 0 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 7 | Toxic barrel | 1 | 50 | Y | 1x1 | 13 | 5 | 0 | 0 | 0 | 1 | 2000 | Y | 0 |
| 8 | Vending machine | 1 | 16000 |  | 1x1 | 0 | 5 | 25 | 250 | 0 | 1 | 240 | Y | 0 |
| 9 | Vending machine | 1 | 8 | Y | 1x1 | 0 | 5 | 25 | 250 | 0 | 1 | 320 | Y | 0 |
| 10 | Flatscreen TV | 1 | 16000 |  | 1x1 | 0 | 5 | 0 | 0 | 0.02 | 1 | 240 | Y | 0 |
| 11 | Flatscreen TV | 1 | 8 | Y | 1x1 | 0 | 5 | 0 | 0 | 0.02 | 1 | 320 | Y | 0 |
| 12 | Arcade cabnet | 1 | 50000 |  | 1x1 | 0 | 5 | 75 | 1000 | 0 | 1 | 750 | Y | 0 |
| 13 | Arcade cabnet 2 | 1 | 25 | Y | 1x1 | 0 | 5 | 100 | 1200 | 0 | 1 | 1000 | Y | 0 |
| 14 | ATM | 1 | 60 | Y | 1x1 | 0 | 5 | 200 | 5000 | 0 | 1 | 2400 | Y | 0 |
| 15 | Plain stove | 1 | 500 |  | 1x1 | 1 | 2 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 16 | Plain serving counter | 1 | 500 |  | 1x1 | 2 | 2 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 17 | Plain sink | 1 | 500 |  | 1x1 | 11 | 2 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 18 | Plain fridge | 1 | 500 |  | 1x1 | 8 | 2 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 19 | Plain table | 1 | 200 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 20 | Plain table | 1 | 200 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 21 | Plain table | 1 | 200 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 22 | Plain table | 1 | 200 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 23 | Plain chair | 1 | 100 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 24 | Plain chair | 1 | 100 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 25 | Plain chair | 1 | 100 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 26 | Plain chair | 1 | 100 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 27 | Plain wall | 1 | 30 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 28 | Plain wall | 1 | 40 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 29 | Plain wall | 1 | 40 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 30 | Plain wall | 1 | 40 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 31 | Plain wall | 1 | 40 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 32 | Plain wall | 1 | 75 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 1 | Y | 0 |
| 33 | Small window | 1 | 200 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 34 | Plain tiled floor | 1 | 10 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 35 | Plain tiled floor | 1 | 15 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 36 | Plain tiled floor | 1 | 15 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 37 | Plain tiled floor | 1 | 15 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 38 | Plain tiled floor | 1 | 15 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 39 | Plain tiled floor | 1 | 25 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 40 | Small potted plant | 1 | 100 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 41 | Plain table | 1 | 1 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 40 | Y | 0 |
| 42 | Plain chair | 1 | 1 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 40 | Y | 0 |
| 43 | Plain round table | 2 | 225 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 44 | Plain round table | 2 | 225 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 45 | Plain round table | 2 | 225 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 46 | Plain round table | 2 | 225 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 47 | Plain round table | 3 | 1 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 40 | Y | 0 |
| 48 | Small window w/plain curtains | 2 | 200 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 49 | Small potted plant 2 | 2 | 100 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 50 | Standing lamp | 2 | 300 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 51 | Standing lamp | 3 | 350 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 52 | Standing lamp | 4 | 350 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 53 | Standing lamp | 5 | 1 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 40 | Y | 0 |
| 54 | Diner chair | 3 | 150 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 55 | Diner stool | 3 | 130 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 56 | Diner table | 3 | 350 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 57 | Large potted plant/tree | 4 | 500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 58 | Plain divider | 4 | 200 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 59 | Plain divider | 5 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 60 | Plain divider | 5 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 61 | Plain divider | 5 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 62 | Plain divider | 5 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 63 | Plain divider | 6 | 1 | Y | 1x1 | 9 | 1 | 0 | 0 | 0.01 | 1 | 40 | Y | 0 |
| 64 | Diner chair 2 | 4 | 200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 65 | Diner stool 2 | 4 | 175 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 66 | Diner table 2 | 4 | 400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 6 | Y | 0 |
| 67 | Rounded-corner/steel window | 4 | 750 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 11 | Y | 0 |
| 68 | Hat/coat rack | 4 | 200 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 69 | checkered tile | 4 | 40 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 70 | checkered tile | 5 | 50 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 71 | checkered tile | 5 | 50 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 72 | checkered tile | 6 | 50 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 73 | checkered tile | 6 | 50 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 74 | Stainless steel stove | 5 | 25000 |  | 1x1 | 1 | 2 | 0 | 0 | 0.02 | 1 | 375 | Y | 0 |
| 75 | Stainless steel serving counter | 5 | 15000 |  | 1x1 | 2 | 2 | 0 | 0 | 0.01 | 1 | 225 | Y | 0 |
| 76 | Stainless steel sink | 5 | 25000 |  | 1x1 | 11 | 2 | 0 | 0 | 0.02 | 1 | 375 | Y | 0 |
| 77 | Stainless steel fridge | 5 | 25000 |  | 1x1 | 8 | 2 | 0 | 0 | 0.02 | 1 | 375 | Y | 0 |
| 78 | Neon sign | 5 | 20000 |  | 1x1 | 6 | 5 | 0 | 0 | 0.02 | 1 | 300 | Y | 0 |
| 79 | Neon sign | 5 | 10 | Y | 1x1 | 6 | 5 | 0 | 0 | 0.02 | 1 | 400 | Y | 0 |
| 80 | Diner wall lamp | 5 | 250 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 81 | Jukebox | 5 | 40000 |  | 1x1 | 0 | 5 | 55 | 1500 | 0 | 1 | 600 | Y | 0 |
| 82 | Jukebox 2 | 5 | 20 | Y | 1x1 | 0 | 5 | 75 | 1800 | 0 | 1 | 800 | Y | 0 |
| 83 | checkered tile | 5 | 60 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 1 | Y | 0 |
| 84 | Large window w/plain curtains | 6 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 85 | Large window w/blinds | 6 | 1100 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 17 | Y | 0 |
| 86 | Classic wooden chair | 6 | 500 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 87 | Table (red checked table cloth) | 6 | 1000 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 88 | Grape divider | 6 | 1500 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 89 | Wine rack | 6 | 2500 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 38 | Y | 0 |
| 90 | Wall lamp | 6 | 500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 91 | Hardwood floor | 6 | 125 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 92 | Hardwood floor | 7 | 150 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 93 | Hardwood floor | 7 | 150 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 94 | Large potted plant/tree | 7 | 500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 95 | Classic wooden chair | 7 | 600 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 96 | Classic wooden chair | 8 | 600 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 97 | Classic wooden chair | 8 | 600 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 98 | Classic wooden chair | 8 | 600 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 99 | Classic wooden chair | 8 | 600 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 100 | Classic wooden chair | 9 | 1 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 40 | Y | 0 |
| 101 | Brick wall | 7 | 250 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 102 | Brick wall | 7 | 300 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 103 | Brick wall | 7 | 300 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 104 | Brick wall | 8 | 300 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 105 | Brick wall | 8 | 300 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 106 | Brick-lined window | 7 | 1500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 107 | Hardwood floor | 7 | 175 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 108 | Brick wall | 9 | 500 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 109 | Sleek table | 9 | 1200 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 110 | Sleek table | 9 | 1400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 21 | Y | 0 |
| 111 | Sleek table | 9 | 1400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 21 | Y | 0 |
| 112 | Sleek table | 9 | 1400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 21 | Y | 0 |
| 113 | Sleek table | 9 | 1400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 21 | Y | 0 |
| 114 | Sleek chair | 9 | 1000 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 115 | Sleek chair | 9 | 1200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 116 | Sleek chair | 9 | 1200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 117 | Sleek chair | 9 | 1200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 118 | Sleek chair | 9 | 1200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 119 | Paper lamp | 9 | 750 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 11 | Y | 0 |
| 120 | Fish tank | 9 | 8000 |  | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 120 | Y | 0 |
| 121 | Sleek table | 9 | 2 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 122 | Sleek chair | 9 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 123 | Potted bamboo | 10 | 1000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 124 | Exotic fish tank | 10 | 15 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 1 | 600 | Y | 0 |
| 125 | Chopstick poster | 10 | 30000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.04 | 1 | 450 | Y | 0 |
| 126 | Chopstick poster | 9 | 15 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.04 | 1 | 600 | Y | 0 |
| 127 | Banzai tree (on stand) | 10 | 1500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 128 | Table (generic/classic/country) | 12 | 1500 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 129 | Table (generic/classic/country) | 13 | 1800 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 27 | Y | 0 |
| 130 | Table (generic/classic/country) | 13 | 1800 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 27 | Y | 0 |
| 131 | Table (generic/classic/country) | 13 | 1800 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 27 | Y | 0 |
| 132 | Chair (generic/classic/country) | 12 | 1200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 133 | Chair (generic/classic/country) | 13 | 1500 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 134 | Chair (generic/classic/country) | 13 | 1500 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 135 | Chair (generic/classic/country) | 13 | 1500 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 136 | Chair (generic/classic/country) | 13 | 1500 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 137 | Wood panel wall | 12 | 500 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 138 | Slot machine | 12 | 100000 |  | 1x1 | 0 | 1 | 150 | 1800 | 0 | 1 | 1500 | Y | 0 |
| 139 | Slot machine | 11 | 50 | Y | 1x1 | 0 | 1 | 150 | 1800 | 0 | 1 | 2000 | Y | 0 |
| 140 | Table (generic/classic/country) | 13 | 2 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 141 | Chair (generic/classic/country) | 13 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 142 | Wagon wheel | 13 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 143 | Large window with red/green/white curtains | 13 | 2000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 30 | Y | 0 |
| 144 | Potted cactus | 13 | 2500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 38 | Y | 0 |
| 145 | Two-tone brown tile | 13 | 200 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 146 | Wood panel wall | 14 | 600 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 147 | Steer skull | 14 | 1500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 148 | dartboard | 15 | 2000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 30 | Y | 0 |
| 149 | Bar serving counter | 15 | 2000 |  | 1x1 | 2 | 2 | 0 | 0 | 0 | 1 | 30 | Y | 0 |
| 150 | Foosball table | 15 | 60000 |  | 1x1 | 0 | 5 | 90 | 1000 | 0 | 1 | 900 | Y | 0 |
| 151 | Foosball table | 15 | 30 | Y | 1x1 | 0 | 5 | 100 | 1200 | 0 | 1 | 1200 | Y | 0 |
| 152 | carpet | 15 | 500 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 153 | carpet | 16 | 600 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 154 | carpet | 16 | 600 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 155 | carpet | 16 | 600 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 156 | carpet | 16 | 600 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 157 | Booze rack/shelf | 16 | 12000 |  | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 180 | Y | 0 |
| 158 | carpet | 16 | 800 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 12 | Y | 0 |
| 159 | Zombeer ad/poster | 17 | 30 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.07 | 1 | 1200 | Y | 0 |
| 160 | White tablecloth | 18 | 3000 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 45 | Y | 0 |
| 161 | Maitre'd stand/podium | 18 | 12000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 180 | Y | 0 |
| 162 | Marble tile | 18 | 700 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 11 | Y | 0 |
| 163 | Marble tile | 18 | 850 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 13 | Y | 0 |
| 164 | Marble tile | 19 | 850 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 13 | Y | 0 |
| 165 | Marble tile | 19 | 850 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 13 | Y | 0 |
| 166 | Marble tile | 19 | 850 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 13 | Y | 0 |
| 167 | Wallpaper wall | 19 | 1000 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 168 | Wallpaper wall | 20 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 169 | Wallpaper wall | 20 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 170 | Wallpaper wall | 20 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 171 | Wallpaper wall | 20 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 172 | Wallpaper wall | 20 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 173 | Candelabra | 19 | 3000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 45 | Y | 0 |
| 174 | Fountain | 19 | 50000 |  | 1x1 | 0 | 1 | 0 | 0 | 0.03 | 1 | 750 | Y | 0 |
| 175 | Velvet rope divider | 19 | 3000 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 45 | Y | 0 |
| 176 | Van Gogh's self portrait as zombie | 20 | 610100 |  | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 1 | 3000 | Y | 0 |
| 177 | Van Gogh's self portrait as zombie | 20 | 75 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 1 | 6000 | Y | 0 |
| 178 | Marble tile | 20 | 1000 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 179 | Wall crack | 255 | 50 |  | 1x1 | 6 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 180 | Floor stain | 255 | 5 |  | 1x1 | 7 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 181 | Loose tile | 255 | 5 |  | 1x1 | 7 | 255 | 0 | 0 | -0.01 | 1 | 0 | Y | 0 |
| 182 | 10 Toxin | 0 | 20000 |  | 1x1 | 10 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 183 | 30 Toxin | 0 | 50000 |  | 1x1 | 10 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 184 | 175 Toxin | 0 | 250000 |  | 1x1 | 10 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 185 | 750 Toxin | 0 | 1000000 |  | 1x1 | 10 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 186 | Pot | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 187 | Plate | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 188 | Grass tile 1 | 255 | 0 |  | 1x1 | 7 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 189 | Grass tile 2 | 255 | 0 |  | 1x1 | 7 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 190 | Sidewalk tile | 255 | 0 |  | 1x1 | 7 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 191 | Road tile | 255 | 0 |  | 1x1 | 7 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 192 | Road stripe tile | 255 | 0 |  | 1x1 | 7 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 193 | Dirty plate | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 194 | Tile cover | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 195 | Closed Door | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 196 | Open Door | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 197 | Burnt Pot | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 198 | Expand to 8x7 | 0 | 3500 |  | 8x7 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 199 | Expand to 9x8 | 0 | 25000 |  | 9x8 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 200 | Expand to 9x8 | 0 | 10 | Y | 9x8 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 201 | Expand to 10x9 | 0 | 75000 |  | 10x9 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 202 | Expand to 10x9 | 0 | 30 | Y | 10x9 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 203 | Expand to 11x10 | 0 | 100000 |  | 11x10 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 204 | Expand to 11x10 | 0 | 40 | Y | 11x10 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 205 | Red trash can | 1 | 1500 |  | 1x1 | 11 | 2 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 206 | Diner clock | 5 | 1500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 207 | Specials Board | 6 | 12000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 180 | Y | 0 |
| 208 | Specials Board | 6 | 6 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 240 | Y | 0 |
| 209 | Diner wall | 6 | 250 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 210 | Marble Serving Counter | 18 | 50000 |  | 1x1 | 2 | 2 | 0 | 0 | 0.02 | 1 | 750 | Y | 0 |
| 211 | Mad Scientist Control Panel 1 | 10 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 212 | Mad Scientist Control Panel 3 | 10 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 213 | Mad Scientist Control Panel 2 | 10 | 5 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 200 | Y | 0 |
| 214 | Mad Scientist Floor | 10 | 185 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 215 | Mad Scientist Cabinet 1 | 11 | 4500 |  | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 68 | Y | 0 |
| 216 | Mad Scientist Cabinet 2 | 11 | 4500 |  | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 68 | Y | 0 |
| 217 | Mad Scientist Chair | 10 | 1000 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 218 | Mad Scientist Serving Counter | 10 | 7000 |  | 1x1 | 2 | 2 | 0 | 0 | 0 | 1 | 105 | Y | 0 |
| 219 | Mad Scientist Table | 10 | 1700 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 26 | Y | 0 |
| 220 | Mad Scientist Wall | 10 | 600 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 221 | Spindle Chair | 15 | 2000 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 30 | Y | 0 |
| 222 | Booth | 15 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 223 | Bookshelf | 15 | 3000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 45 | Y | 0 |
| 224 | Wood Pub Floor | 15 | 500 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 225 | Pool Table | 15 | 40 | Y | 1x1 | 0 | 5 | 125 | 2000 | 0 | 1 | 1600 | Y | 0 |
| 226 | Pub Serving Counter | 15 | 2 | Y | 1x1 | 2 | 2 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 227 | Pub Table | 15 | 3000 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 45 | Y | 0 |
| 228 | Pub Window | 15 | 5000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 75 | Y | 0 |
| 229 | Stone Window | 15 | 4000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 60 | Y | 0 |
| 230 | Tiffany Lamp 1 | 15 | 10000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 150 | Y | 0 |
| 231 | Tiffany Lamp 2 | 15 | 10000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 150 | Y | 0 |
| 232 | Tiffany Lamp 3 | 15 | 10000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 150 | Y | 0 |
| 233 | Green Trash Bin | 15 | 3000 |  | 1x1 | 11 | 2 | 0 | 0 | 0 | 1 | 45 | Y | 0 |
| 234 | Pub Wall | 15 | 600 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 235 | Stone Wall | 15 | 600 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 236 | Expand to 12x11 | 0 | 120000 |  | 12x11 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 237 | Expand to 12x11 | 0 | 50 | Y | 12x11 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 238 | Hippie Poster 1 | 6 | 500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 239 | Hippie Poster 2 | 8 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 240 | Guitar | 6 | 1200 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 241 | Hanging Plant | 6 | 500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 242 | Planter | 6 | 500 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 243 | Barbed Wire | 6 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 244 | Sand Bags 1 | 6 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 245 | Sand Bags 2 | 6 | 250 |  | 1x1 | 9 | 1 | 0 | 0 | 0 | 1 | 4 | Y | 0 |
| 246 | Wall Sconce | 6 | 500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 247 | Fancy Window | 6 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 248 | Magic Fridge | 1 | 30 | Y | 1x1 | 8 | 2 | 0 | 0 | 0.01 | 1 | 1200 | Y | 0 |
| 249 | Suped Up Fridge | 7 | 25000 |  | 1x1 | 8 | 2 | 0 | 0 | 0.01 | 1 | 375 | Y | 0 |
| 250 | Hippie Table | 6 | 1000 |  | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 15 | Y | 0 |
| 251 | Fancy Table | 6 | 2 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 252 | Suped Up Stove | 7 | 20 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.01 | 1.11 | 800 | Y | 0 |
| 253 | Fancy Chair | 6 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 254 | BBQ Stove | 8 | 2 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 255 | Beach Ball | 7 | 500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 256 | Beach Blanket | 7 | 500 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 257 | Folding Chair | 7 | 600 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 9 | Y | 0 |
| 258 | Folding Table | 7 | 1400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 21 | Y | 0 |
| 259 | Surfboard | 8 | 1400 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 21 | Y | 0 |
| 260 | Ice Fridge | 7 | 10 | Y | 1x1 | 0 | 5 | 30 | 400 | 0.03 | 1 | 400 | Y | 0 |
| 261 | Ice Cream Machine | 7 | 20 | Y | 1x1 | 0 | 5 | 75 | 900 | 0.01 | 1 | 800 | Y | 0 |
| 262 | Slushy Machine | 8 | 20 | Y | 1x1 | 0 | 5 | 75 | 900 | 0.01 | 1 | 800 | Y | 0 |
| 263 | Expand to 13x12 | 0 | 150000 |  | 13x12 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 264 | Persistance of brains | 21 | 10000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 150 | Y | 0 |
| 265 | Ghoul with the Pearl Earring | 21 | 5 | Y | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 200 | Y | 0 |
| 266 | Van Gogh Starry night | 21 | 75 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 1 | 3000 | Y | 0 |
| 267 | Jack-o-Lantern | 10 | 5 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 200 | Y | 0 |
| 268 | Orange and Black Tile | 1 | 30 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 269 | Spider Web Wall | 10 | 2500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 38 | Y | 0 |
| 270 | Orange Table | 10 | 2000 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 30 | Y | 0 |
| 271 | Orange Chair | 10 | 1000 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 272 | Orange Serving Counter | 10 | 6000 |  | 1x1 | 2 | 2 | 0 | 0 | 0 | 1 | 90 | Y | 0 |
| 273 | Wooden Table With Autumn Leaves | 9 | 2500 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 38 | Y | 0 |
| 274 | Thanksgiving Wreath | 10 | 4000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 60 |  | 0 |
| 275 | Big Pumpkin | 10 | 1500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 276 | Small Pumpkin | 10 | 1500 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 23 | Y | 0 |
| 277 | Leaves Tile | 5 | 40 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 278 | Small Wagon | 11 | 5 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 300 | Y | 0 |
| 279 | Home Sweet Home sign | 22 | 50 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 1 | 3000 | Y | 0 |
| 280 | Wall Candle | 12 | 700 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 11 | Y | 0 |
| 281 | Expand to 13x12 | 0 | 50 | Y | 13x12 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 282 | Expand to 14x13 | 0 | 150000 |  | 14x13 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 283 | Expand to 14x13 | 0 | 50 | Y | 14x13 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 284 | Cauldron | 22 | 50 | Y | 1x1 | 0 | 5 | 150 | 5000 | 0 | 1 | 3000 | Y | 0 |
| 285 | Strength Tombstone | 5 | 50 | Y | 1x1 | 14 | 5 | 0 | 0 | 0 | 1 | 3000 | Y | 0 |
| 286 | Health Tombstone | 5 | 50 | Y | 1x1 | 14 | 5 | 0 | 0 | 0 | 1 | 3000 | Y | 0 |
| 287 | Christmas Wreath | 12 | 50 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.05 | 1 | 3000 |  | 0 |
| 288 | Christmas Table | 11 | 2500 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 40 |  | 0 |
| 289 | Christmas Chair | 11 | 1500 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 20 |  | 0 |
| 290 | Christmas Tree | 12 | 50 | Y | 1x1 | 0 | 1 | 200 | 4000 | 0 | 1 | 2500 |  | 0 |
| 291 | Christmas Arcade Cabinet | 10 | 30 | Y | 1x1 | 0 | 5 | 150 | 2000 | 0 | 1 | 900 |  | 0 |
| 292 | Lanterns | 13 | 888 |  | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 1 | 15 | Y | 0 |
| 293 | Fire Crackers | 13 | 10 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 1 | 500 | Y | 0 |
| 294 | Foo Dog | 22 | 35 | Y | 1x1 | 0 | 5 | 0 | 0 | 0.12 | 1 | 900 | Y | 0 |
| 295 | Dragon Painting | 5 | 80 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 1 | 4000 | Y | 0 |
| 296 | Eastern Table | 15 | 2450 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 40 | Y | 0 |
| 297 | Eastern Chair | 15 | 1450 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 298 | Smiling Buddha | 22 | 40 | Y | 1x1 | 0 | 5 | 150 | 3000 | 0.01 | 1 | 1000 | Y | 0 |
| 299 | Heart Table | 8 | 5 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 300 | Heart Chair | 8 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 301 | Heart Wall Hangars | 10 | 3000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 55 | Y | 0 |
| 302 | Heart Shaped Lights | 10 | 800 |  | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 1 | 13 | Y | 0 |
| 303 | Strength Tombstone - Level 2 | 5 | 55 | Y | 1x1 | 14 | 5 | 0 | 0 | 0 | 1 | 5000 | Y | 0 |
| 304 | Health Tombstone - Level 2 | 5 | 55 | Y | 1x1 | 14 | 5 | 0 | 0 | 0 | 1 | 5000 | Y | 0 |
| 305 | Decorative Tombstone 1 | 5 | 1500 |  | 1x1 | 14 | 5 | 0 | 0 | 0.02 | 1 | 20 | Y | 0 |
| 306 | Decorative Tombstone 2 | 5 | 10 | Y | 1x1 | 14 | 5 | 0 | 0 | 0.04 | 1 | 25 | Y | 0 |
| 307 | Decorative Tombstone 3 | 5 | 15 | Y | 1x1 | 14 | 5 | 0 | 0 | 0.06 | 1 | 30 | Y | 0 |
| 308 | Decorative Tombstone 4 | 5 | 20 | Y | 1x1 | 14 | 5 | 0 | 0 | 0.08 | 1 | 35 | Y | 0 |
| 309 | Green Pub Counter | 8 | 1500 |  | 1x1 | 2 | 2 | 0 | 0 | 0.03 | 1 | 20 | Y | 0 |
| 310 | Green Pub Stool | 8 | 1000 |  | 1x1 | 4 | 3 | 0 | 0 | 0.03 | 1 | 20 | Y | 0 |
| 311 | Pot Of Gold | 10 | 35 | Y | 1x1 | 0 | 5 | 100 | 2500 | 0 | 1 | 2000 | Y | 0 |
| 312 | Green Pub Divider | 10 | 3000 |  | 1x1 | 9 | 1 | 0 | 0 | 0.03 | 1 | 30 | Y | 0 |
| 313 | Green Pub Table | 8 | 2000 |  | 1x1 | 3 | 3 | 0 | 0 | 0.03 | 1 | 25 | Y | 0 |
| 314 | Coat of Arms | 11 | 40 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.1 | 1 | 3000 | Y | 0 |
| 315 | Horse Shoe | 11 | 10 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.05 | 1 | 800 | Y | 0 |
| 316 | Pub Poster | 0 | 15 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.05 | 1 | 900 |  | 0 |
| 317 | Pub Sign | 12 | 20 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.08 | 1 | 1000 | Y | 0 |
| 318 | Pub Bar Cabinet | 8 | 6000 |  | 1x1 | 0 | 1 | 0 | 0 | 0.04 | 1 | 30 | Y | 0 |
| 319 | Space Divider _ Grey | 7 | 4000 |  | 1x1 | 9 | 1 | 0 | 0 | 0.02 | 1 | 50 | Y | 0 |
| 320 | Space Divider _ White | 8 | 4500 |  | 1x1 | 9 | 1 | 0 | 0 | 0.02 | 1 | 60 | Y | 0 |
| 321 | Freeze Dried Fridge | 7 | 10 | Y | 1x1 | 8 | 2 | 0 | 0 | 0.01 | 1 | 500 | Y | 0 |
| 322 | Holographic Table | 14 | 3 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.02 | 1 | 300 | Y | 0 |
| 323 | Round Holographic Table | 8 | 6000 |  | 1x1 | 3 | 3 | 0 | 0 | 0.05 | 1 | 70 | Y | 0 |
| 324 | Laser Oven | 7 | 25 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.02 | 1.2 | 1000 | Y | 0 |
| 325 | Nebula Painting | 7 | 10 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.05 | 1 | 80 | Y | 0 |
| 326 | Port Window 1 | 7 | 2500 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 1 | Y | 0 |
| 327 | Port Window 2 | 8 | 2500 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 20 | Y | 0 |
| 328 | Space Counter | 14 | 3 | Y | 1x1 | 2 | 2 | 0 | 0 | 0.02 | 1 | 300 | Y | 0 |
| 329 | Space Sink | 7 | 4500 |  | 1x1 | 11 | 2 | 0 | 0 | 0.04 | 1 | 40 | Y | 0 |
| 330 | LED Light | 7 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 30 | Y | 0 |
| 331 | LED Lights | 8 | 2000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 15 | Y | 0 |
| 332 | Glass Tile (Black & White) | 7 | 500 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 333 | Glass Tile (Metal) | 8 | 600 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 8 | Y | 0 |
| 334 | Glass Tile (White) | 8 | 700 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 10 | Y | 0 |
| 335 | Space Fighter Arcade Machine | 14 | 45 | Y | 1x1 | 0 | 5 | 300 | 4500 | 0 | 1 | 1200 | Y | 0 |
| 336 | Captain's Chair | 7 | 3 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.02 | 1 | 100 | Y | 0 |
| 337 | Air Hockey Table | 12 | 30 | Y | 1x1 | 0 | 5 | 100 | 1200 | 0 | 1 | 1200 | Y | 0 |
| 338 | Deep Fryer | 8 | 20 | Y | 1x1 | 0 | 5 | 75 | 900 | 0.01 | 1 | 800 | Y | 0 |
| 339 | Pinball Machine | 13 | 25 | Y | 1x1 | 0 | 5 | 100 | 1200 | 0 | 1 | 1000 | Y | 0 |
| 340 | Pizza Display Warmer | 9 | 50000 |  | 1x1 | 0 | 5 | 75 | 900 | 0.01 | 1 | 800 | Y | 0 |
| 341 | Pool Table (Blue) | 17 | 40 | Y | 1x1 | 0 | 5 | 125 | 2000 | 0 | 1 | 1600 | Y | 0 |
| 342 | Wall Menu | 8 | 12000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 200 | Y | 0 |
| 343 | Graffiti Poster | 9 | 25000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.03 | 1 | 400 | Y | 0 |
| 344 | Zombie Arcade Sign | 9 | 10 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.03 | 1 | 400 | Y | 0 |
| 345 | Wood Fire Pizza Oven | 9 | 20 | Y | 1x1 | 0 | 5 | 75 | 900 | 0.03 | 1 | 800 | Y | 0 |
| 346 | Zombie Fighter Arcade Machine | 8 | 45 | Y | 1x1 | 0 | 5 | 300 | 4500 | 0 | 1 | 1200 | Y | 0 |
| 347 | MAX LEVEL | 0 | 1 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 626621 |  | 0 |
| 348 | Apache Blanket | 10 | 11000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 200 | Y | 0 |
| 349 | Banjo | 11 | 7000 |  | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 100 | Y | 0 |
| 350 | Gas Lamp | 10 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 1 | 30 | Y | 0 |
| 351 | Grill | 11 | 25 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.02 | 1.2 | 1000 | Y | 0 |
| 352 | Gun Rack | 14 | 10 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.03 | 1 | 400 | Y | 0 |
| 353 | Meat Smoker | 14 | 15 | Y | 1x1 | 0 | 5 | 50 | 600 | 0.01 | 1 | 500 | Y | 0 |
| 354 | Moonshine Shelf | 10 | 12000 |  | 1x1 | 6 | 1 | 0 | 0 | 0.05 | 1 | 200 | Y | 0 |
| 355 | Road Worn Guitar | 10 | 5000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 1 | 70 | Y | 0 |
| 356 | Rotisserie | 10 | 20 | Y | 1x1 | 0 | 5 | 75 | 900 | 0.03 | 1 | 800 | Y | 0 |
| 357 | Zombie Cowboy Painting | 14 | 20 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.05 | 1 | 800 | Y | 0 |
| 358 | Steam Powered Arcade Cabinet | 16 | 45 | Y | 1x1 | 0 | 5 | 300 | 4500 | 0 | 1 | 1200 | Y | 0 |
| 359 | Steam Powered Chair | 12 | 1000 |  | 1x1 | 4 | 3 | 0 | 0 | 0.03 | 1 | 20 | Y | 0 |
| 360 | Cuthulhu Painting | 16 | 20 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.05 | 1 | 800 | Y | 0 |
| 361 | Steam Powered Fridge | 12 | 10 | Y | 1x1 | 8 | 2 | 0 | 0 | 0.01 | 1 | 500 | Y | 0 |
| 362 | Clock Work Table | 12 | 8000 |  | 1x1 | 3 | 3 | 0 | 0 | 0.05 | 1 | 70 | Y | 0 |
| 363 | Phono-Box | 16 | 20 | Y | 1x1 | 0 | 5 | 75 | 1800 | 0 | 1 | 800 | Y | 0 |
| 364 | Steam Powered Stove | 12 | 25 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.02 | 1.2 | 1000 | Y | 0 |
| 365 | Tesla TV | 12 | 16000 |  | 1x1 | 0 | 5 | 0 | 0 | 0.02 | 1 | 240 | Y | 0 |
| 366 | Victorian Counter | 12 | 1500 |  | 1x1 | 2 | 2 | 0 | 0 | 0.03 | 1 | 20 | Y | 0 |
| 367 | Victorian Sink | 12 | 4250 |  | 1x1 | 11 | 2 | 0 | 0 | 0.03 | 1 | 40 | Y | 0 |
| 368 | Victorian Window | 12 | 2500 |  | 1x1 | 6 | 4 | 0 | 0 | 0.03 | 1 | 20 | Y | 0 |
| 369 | Zen Wall | 15 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 370 | Zen Wall | 15 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 371 | Zen Wall | 15 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 372 | Zen Wall | 15 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 373 | Zen Wall | 15 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 374 | Zen Wall | 15 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 375 | Babmoo Floor | 15 | 150 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 376 | Babmoo Floor | 15 | 150 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 377 | Babmoo Floor | 15 | 150 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 2 | Y | 0 |
| 378 | Eastern Chair 2 | 15 | 1450 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 379 | Eastern Chair 3 | 9 | 5 | Y | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 300 | Y | 0 |
| 380 | Dojo Counter | 15 | 1500 |  | 1x1 | 2 | 2 | 0 | 0 | 0.03 | 1 | 20 | Y | 0 |
| 381 | Dojo Sink | 15 | 5500 |  | 1x1 | 11 | 2 | 0 | 0 | 0.04 | 1 | 40 | Y | 0 |
| 382 | Cherry Blossom Lantern | 18 | 10 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 1 | 800 | Y | 0 |
| 383 | Blue Lantern | 15 | 888 |  | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 1 | 15 | Y | 0 |
| 384 | Eastern Table 2 | 15 | 2450 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 40 | Y | 0 |
| 385 | Eastern Table 3 | 9 | 5 | Y | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 300 | Y | 0 |
| 386 | Wall Fan | 15 | 10 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.05 | 1 | 800 | Y | 0 |
| 387 | Ninja Scroll | 15 | 15 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.03 | 1 | 1000 | Y | 0 |
| 388 | Ninja Weapons | 18 | 25 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.05 | 1 | 1500 | Y | 0 |
| 389 | Bling Table | 15 | 10000 |  | 1x1 | 3 | 3 | 0 | 0 | 0.05 | 1 | 70 | Y | 0 |
| 390 | Bling Chair | 15 | 6000 |  | 1x1 | 4 | 3 | 0 | 0 | 0.03 | 1 | 60 | Y | 0 |
| 391 | Standard Pizza Oven | 15 | 5000 |  | 1x1 | 1 | 2 | 0 | 0 | 0.01 | 1 | 800 | Y | 0 |
| 392 | Brick Oven Pizza | 15 | 11000 |  | 1x1 | 1 | 2 | 0 | 0 | 0.02 | 1.1 | 1000 | Y | 391 |
| 393 | Deep Dish Oven | 15 | 15 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.03 | 1.2 | 1200 | Y | 392 |
| 394 | Italian Stallion Pizza Oven | 15 | 20 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.04 | 1.3 | 1400 | Y | 393 |
| 395 | Pizza | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 396 | Burnt Pizza | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 397 | Economic Grill | 16 | 12000 |  | 1x1 | 1 | 2 | 0 | 0 | 0.02 | 1.1 | 1000 | Y | 0 |
| 398 | Corporate Grill | 16 | 15 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.03 | 1.2 | 1200 | Y | 397 |
| 399 | T-8000 Grill | 16 | 20 | Y | 1x1 | 1 | 2 | 0 | 0 | 0.04 | 1.3 | 1400 | Y | 398 |
| 400 | BBQ | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 401 | Burnt BBQ | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 402 | Donkey Donation Box | 16 | 50 | Y | 1x1 | 0 | 5 | 150 | 5000 | 0 | 1 | 2500 | Y | 0 |
| 403 | Elephant Donation Box | 16 | 50 | Y | 1x1 | 0 | 5 | 150 | 5000 | 0 | 1 | 2500 | Y | 0 |
| 404 | Elephant Wall Poster | 16 | 3000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 600 | Y | 0 |
| 405 | Donkey Wall Poster | 16 | 3000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 600 | Y | 0 |
| 406 | Campaign Decoration | 16 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 407 | Campaign Banner | 16 | 1200 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 20 | Y | 0 |
| 408 | Vote Now Poster | 16 | 25 | Y | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 800 | Y | 0 |
| 409 | Zombie Vote Now Poster | 16 | 25 | Y | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 800 | Y | 0 |
| 410 | Traditional Estufa | 5 | 6000 |  | 1x1 | 1 | 2 | 0 | 0 | 0 | 1 | 150 | Y | 0 |
| 411 | Chiminea Estufa | 5 | 15 | Y | 1x1 | 1 | 2 | 0 | 0 | 0 | 1 | 300 | Y | 410 |
| 412 | Estufa Del Jefe | 5 | 20 | Y | 1x1 | 1 | 2 | 0 | 0 | 0 | 1 | 350 | Y | 411 |
| 413 | Mexican Food | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 414 | Burnt Mexican Food | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 415 | Aztec Calendar | 5 | 2400 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 175 | Y | 0 |
| 416 | Pinata | 5 | 20 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 1 | 300 | Y | 0 |
| 417 | Skeleton Chair | 5 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 175 | Y | 0 |
| 418 | Skeleton Table | 5 | 2400 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 75 | Y | 0 |
| 419 | Aztec Stone Wall | 5 | 2400 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 30 | Y | 0 |
| 420 | Day of the Dead Altar | 5 | 20 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 1 | 175 | Y | 0 |
| 421 | Wall Mounted Candles | 5 | 1000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 1 | 15 | Y | 0 |
| 422 | Skull-ptural Lamp | 5 | 15 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 1 | 120 | Y | 0 |
| 423 | Monster Movie Poster | 12 | 20 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.05 | 1 | 800 | Y | 0 |
| 424 | Star Walk Tiles | 10 | 400 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 1 | 5 | Y | 0 |
| 425 | Zombie Golden Award | 12 | 30 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 1 | 1200 | Y | 0 |
| 426 | Director Chair | 11 | 2 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 427 | Clapper Table | 11 | 2500 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 38 | Y | 0 |
| 428 | Film Reel | 11 | 2 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 429 | Film Set Light | 10 | 5 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 1 | 150 | Y | 0 |
| 430 | Witch potion Stove | 8 | 8000 |  | 1x1 | 1 | 2 | 0 | 0 | 0 | 1.1 | 170 | Y | 0 |
| 431 | Lava Stove | 8 | 15 | Y | 1x1 | 1 | 2 | 0 | 0 | 0 | 1.2 | 330 | Y | 430 |
| 432 | Fiery Dragon Stove | 8 | 20 | Y | 1x1 | 1 | 2 | 0 | 0 | 0 | 1.3 | 400 | Y | 431 |
| 433 | Legendary Sword | 9 | 20 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 1 | 800 | Y | 0 |
| 434 | King's Table | 9 | 5 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 1 | 150 | Y | 0 |
| 435 | King's Throne | 9 | 5 | Y | 1x1 | 4 | 3 | 0 | 0 | 0.01 | 1 | 150 | Y | 0 |
| 436 | Tavern Table | 8 | 1200 |  | 1x1 | 3 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 437 | Tavern Chair | 8 | 1200 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 1 | 18 | Y | 0 |
| 438 | Big Stones Wallpaper | 8 | 300 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 1 | 3 | Y | 0 |
| 439 | Stained Glass Window | 9 | 3 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 1 | 100 | Y | 0 |
| 440 | Sword & Shield | 8 | 2 | Y | 1x1 | 6 | 1 | 0 | 0 | 0.01 | 1 | 80 | Y | 0 |
| 441 | The Zombie Book | 8 | 15 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.04 | 1 | 950 | Y | 0 |
| 442 | Medieval Tile | 8 | 600 |  | 1x1 | 7 | 4 | 0 | 0 | 0 | 0 | 8 | Y | 0 |
| 443 | Medieval Pod | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 444 | Burnt Medieval Pod | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 445 | Expand to 15x14 | 0 | 150000 |  | 15x14 | 12 | 5 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 446 | Expand to 15x14 | 0 | 50 | Y | 15x14 | 12 | 5 | 0 | 0 | 0 | 1 | 0 |  | 0 |
| 447 | Ship Steering Wheel | 12 | 5000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 0 | 100 | Y | 0 |
| 448 | Salad Bar | 12 | 35 | Y | 2x1 | 0 | 5 | 100 | 2500 | 0 | 0 | 2500 | Y | 0 |
| 449 | Book shelf | 12 | 2000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 0 | 30 | Y | 0 |
| 450 | Parrot on Stand | 12 | 5 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 0 | 150 | Y | 0 |
| 451 | Standard Cannon | 12 | 20000 |  | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 0 | 400 | Y | 0 |
| 452 | Gold Cannon | 12 | 30 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 0 | 1200 | Y | 0 |
| 453 | Treasure Map | 12 | 20 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.02 | 0 | 1200 | Y | 0 |
| 454 | Antique wall lamp | 12 | 1500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 0 | 23 | Y | 0 |
| 455 | Ship window | 12 | 2500 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 0 | 38 | Y | 0 |
| 456 | Treasure Chest | 12 | 30 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.06 | 0 | 1300 | Y | 0 |
| 457 | Pirate table | 12 | 5 | Y | 1x1 | 3 | 3 | 0 | 0 | 0.01 | 0 | 200 | Y | 0 |
| 458 | Pirate chair | 12 | 1750 |  | 1x1 | 4 | 3 | 0 | 0 | 0 | 0 | 27 | Y | 0 |
| 459 | Holy water fountain | 13 | 10 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.01 | 0 | 300 | Y | 0 |
| 460 | Garlic Wreath | 13 | 3 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.01 | 0 | 350 | Y | 0 |
| 461 | Classic Coffin | 13 | 25 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 0 | 2000 | Y | 0 |
| 462 | Gothic Column | 13 | 4000 |  | 1x1 | 0 | 1 | 0 | 0 | 0 | 0 | 40 | Y | 0 |
| 463 | Stone Wall | 13 | 2000 |  | 1x1 | 5 | 4 | 0 | 0 | 0 | 0 | 20 | Y | 0 |
| 464 | Gothic Arched Window | 13 | 3000 |  | 1x1 | 6 | 4 | 0 | 0 | 0 | 0 | 30 | Y | 0 |
| 465 | Spooky Pipe Organ | 13 | 30 | Y | 1x2 | 0 | 1 | 0 | 0 | 0.06 | 0 | 2500 | Y | 0 |
| 466 | Portrait of Vlad | 13 | 666000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 0 | 3000 | Y | 0 |
| 467 | Portrait of Vlad | 13 | 75 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.12 | 0 | 6000 | Y | 0 |
| 468 | Gargoyle | 13 | 15 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 0 | 900 | Y | 0 |
| 469 | Zombie Man Poster | 14 | 30 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.06 | 0 | 1400 | Y | 0 |
| 470 | Supper Girl Poster | 6 | 10 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.03 | 0 | 500 | Y | 0 |
| 471 | Mad Griller Wanted Poster | 14 | 35 | Y | 1x1 | 6 | 4 | 0 | 0 | 0.08 | 0 | 2400 | Y | 0 |
| 472 | Comics Spinner Racks | 6 | 18000 |  | 1x1 | 0 | 5 | 30 | 300 | 0 | 0 | 300 | Y | 0 |
| 473 | Meteorite | 7 | 25 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.05 | 0 | 1000 | Y | 0 |
| 474 | Super Hero Power Armor | 14 | 55 | Y | 2x2 | 0 | 1 | 0 | 0 | 0.13 | 0 | 5000 | Y | 0 |
| 475 | Phonebooth | 9 | 20 | Y | 1x1 | 0 | 5 | 80 | 1900 | 0.01 | 0 | 800 | Y | 0 |
| 476 | Hero Research Center | 14 | 50 | Y | 1x1 | 0 | 1 | 0 | 0 | 0.12 | 0 | 3000 | Y | 0 |
| 477 | Comics Stand | 14 | 40 | Y | 1x1 | 0 | 5 | 130 | 2800 | 0 | 0 | 1500 | Y | 0 |
| 478 | Super Stove | 14 | 10000 |  | 1x1 | 1 | 2 | 0 | 0 | 0 | 1.1 | 1000 | Y | 0 |
| 479 | Spectro-Tastilizer | 14 | 15 | Y | 1x1 | 1 | 2 | 0 | 0 | 0 | 1.2 | 1200 | Y | 478 |
| 480 | The Flavor Matrix | 14 | 20 | Y | 1x1 | 1 | 2 | 0 | 0 | 0 | 1.3 | 1400 | Y | 479 |
| 481 | SuperHero Pod | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 482 | Burnt SuperHero Pod | 255 | 0 |  | 1x1 | 0 | 255 | 0 | 0 | 0 | 1 | 0 | Y | 0 |
| 483 | Mint Condition Comic | 14 | 200000 |  | 1x1 | 6 | 4 | 0 | 0 | 0.05 | 0 | 2000 | Y | 0 |

## Appendix D — Animation action map (60 rows, complete)

Source: `zc-revival:src/assets/data/animationData.bin.mid.json`. Form 255 = all forms;
Direction 1 = SW, 2 = NW (SE/NE are runtime mirrors). Types 0-29 in 3.5.

| # | Form | Type | Dir | File |
|---|---|---|---|---|
| 0 | 255 | 0 | SW | walkSW.bin |
| 1 | 255 | 0 | NW | walkNW.bin |
| 2 | 255 | 1 | SW | idleSW.bin |
| 3 | 255 | 1 | NW | idleNW.bin |
| 4 | 255 | 2 | SW | sitSW.bin |
| 5 | 255 | 2 | NW | sitNW.bin |
| 6 | 255 | 3 | SW | attackSW.bin |
| 7 | 255 | 3 | NW | attackNW.bin |
| 8 | 255 | 4 | SW | carrySW.bin |
| 9 | 255 | 4 | NW | carryNW.bin |
| 10 | 255 | 5 | SW | serveSW.bin |
| 11 | 255 | 5 | NW | serveNW.bin |
| 12 | 255 | 6 | SW | deathSW.bin |
| 13 | 255 | 6 | NW | deathNW.bin |
| 14 | 255 | 7 | SW | eatSW.bin |
| 15 | 255 | 7 | NW | eatNW.bin |
| 16 | 255 | 8 | SW | operateSW.bin |
| 17 | 255 | 8 | NW | operateNW.bin |
| 18 | 255 | 9 | SW | runSW.bin |
| 19 | 255 | 9 | NW | runNW.bin |
| 20 | 255 | 10 | SW | bumpSW.bin |
| 21 | 255 | 10 | NW | bumpNW.bin |
| 22 | 255 | 11 | SW | celebrateSW.bin |
| 23 | 255 | 11 | NW | celebrateNW.bin |
| 24 | 255 | 12 | SW | hitSW.bin |
| 25 | 255 | 12 | NW | hitNW.bin |
| 26 | 255 | 13 | SW | attack2SW.bin |
| 27 | 255 | 13 | NW | attack2NW.bin |
| 28 | 255 | 14 | SW | attackHumanSW.bin |
| 29 | 255 | 14 | NW | attackHumanNW.bin |
| 30 | 255 | 15 | SW | idle3SW.bin |
| 31 | 255 | 15 | NW | idle3NW.bin |
| 32 | 255 | 16 | SW | idle4SW.bin |
| 33 | 255 | 16 | NW | idle4NW.bin |
| 34 | 255 | 17 | SW | idle5SW.bin |
| 35 | 255 | 17 | NW | idle5NW.bin |
| 36 | 255 | 18 | SW | startledSW.bin |
| 37 | 255 | 18 | NW | startledNW.bin |
| 38 | 255 | 19 | SW | walk2SW.bin |
| 39 | 255 | 19 | NW | walk2NW.bin |
| 40 | 255 | 20 | SW | walk3SW.bin |
| 41 | 255 | 20 | NW | walk3NW.bin |
| 42 | 255 | 21 | SW | walk4SW.bin |
| 43 | 255 | 21 | NW | walk4NW.bin |
| 44 | 255 | 22 | SW | crouchSW.bin |
| 45 | 255 | 22 | NW | crouchNW.bin |
| 46 | 255 | 23 | SW | feastSW.bin |
| 47 | 255 | 23 | NW | feastNW.bin |
| 48 | 255 | 24 | SW | mouthwipeSW.bin |
| 49 | 255 | 24 | NW | mouthwipeNW.bin |
| 50 | 255 | 25 | SW | hungry1SW.bin |
| 51 | 255 | 25 | NW | hungry1NW.bin |
| 52 | 255 | 26 | SW | hungry2SW.bin |
| 53 | 255 | 26 | NW | hungry2NW.bin |
| 54 | 255 | 27 | SW | riseSW.bin |
| 55 | 255 | 27 | NW | riseNW.bin |
| 56 | 255 | 28 | SW | hungSW.bin |
| 57 | 255 | 28 | NW | hungNW.bin |
| 58 | 255 | 29 | SW | hung2SW.bin |
| 59 | 255 | 29 | NW | hung2NW.bin |
