# Zombie Cafe — Unity Clone

A fan-made recreation of the original Capcom Zombie Cafe mobile game, built in Unity 2022 LTS.

> **Note:** This project contains no Capcom-owned assets. Original sprites, audio, and fonts are excluded via `.gitignore` and are used only locally as dev placeholders.

---

## Features (implemented)

| System | Scripts |
|--------|---------|
| Save / Load | `Core/SaveSystem.cs` |
| Currency (Coins + Brains) | `Economy/CurrencyManager.cs` |
| Zombie data & levelling | `Data/ZombieData.cs`, `Zombies/ZombieInventory.cs` |
| Zombie movement & animation | `Zombies/ZombieController.cs` |
| Cooking stations with progress | `Cafe/CookingStation.cs` |
| Customer spawning + infection | `Cafe/CustomerSpawner.cs`, `Cafe/Customer.cs` |
| Cafe levelling | `Cafe/CafeManager.cs` |
| Combat units (HP, attack, death) | `Combat/CombatUnit.cs` |
| Raid loop (spawn, fight, loot) | `Combat/RaidManager.cs` |
| HUD (coins, brains, panels) | `UI/HUDManager.cs` |
| Station progress UI | `UI/StationUI.cs` |
| ZombiePedia | `UI/ZombiePediaUI.cs` |
| Raid prep screen | `UI/RaidPrepUI.cs` |
| Shop | `Economy/ShopManager.cs` |
| Audio manager | `Audio/AudioManager.cs` |

## Project structure

```
Assets/
  _Game/
    Scripts/            <- all C# game logic
    Prefabs/            <- zombie, customer, station, UI prefabs
    ScriptableObjects/  <- ZombieData, DishData, EquipmentData assets
    Scenes/             <- Main (cafe), Raid, Boot scenes
    Animations/         <- Animator Controllers
  Sprites/              <- gitignored (local dev placeholders only)
  Audio/                <- gitignored (local dev placeholders only)
  Fonts/                <- bitmap fonts
Packages/               <- Unity package manifest
ProjectSettings/
```

## Getting started

1. Install [Unity Hub](https://unity.com/download) -> install **Unity 2022.3 LTS**
2. Clone this repo
3. Open the project folder in Unity Hub -> Open
4. Import placeholder art into `Assets/Sprites/` (local extracted assets go here)
5. Open `Assets/_Game/Scenes/Main.unity` and press Play

## Zombie types catalogued (280+)

Telemarketer, Teacher, Yoga Instructor, Businessman, Accountant, Cyclone, Miracle Girl,
The Steel, 50s Diner 1, Couchpotato, and 270+ others across human + zombie variants.

## Dish names catalogued (50+)

Toe Jam Sandwiches, Dough-Nots, Handburgers Flies, Onion Wrongs, Sloppy Joe,
Tumor Melts, Fishbone Pudding, Runey Nose, Gello Mold, Green Plate Special, and more.

## License

Original Zombie Cafe IP belongs to Capcom. This project is an independent fan recreation
with original code. No Capcom assets are included or distributed.