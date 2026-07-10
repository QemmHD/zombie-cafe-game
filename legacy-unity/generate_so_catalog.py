#!/usr/bin/env python3
"""
generate_so_catalog.py
Generates Unity ScriptableObject .asset YAML files for:
  - ZombieData   (Assets/Resources/Zombies/)
  - DishData     (Assets/Resources/Dishes/)
  - FurnitureData (Assets/Resources/Furniture/)
  - TombstoneData (Assets/Resources/Tombstones/)
  - BoosterData  (Assets/Resources/Boosters/)
  - PetData      (Assets/Resources/Pets/)

Run from the zombie-cafe-game project root:
  python Tools/generate_so_catalog.py

All values are reasonable gameplay defaults derived from the original game's
balance (increasing stats per rarity/level tier). Override values via the
Unity Inspector after generation.
"""

import os
import textwrap
from pathlib import Path

# ── Unity YAML header ───────────────────────────────────────────────────────
HEADER = """%%YAML 1.1
%%TAG !u! tag:unity3d.com,2011:
--- !u!114 &11400000
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: 0}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: %(guid)s, type: 3}
  m_Name: %(name)s
  m_EditorClassIdentifier:
"""

# Placeholder GUIDs — Unity will re-serialize with real GUIDs after import.
# These are consistent fakes so diffs are stable.
GUIDS = {
    "ZombieData":    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "DishData":      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "FurnitureData": "cccccccccccccccccccccccccccccccc",
    "TombstoneData": "dddddddddddddddddddddddddddddddd",
    "BoosterData":   "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "PetData":       "ffffffffffffffffffffffffffffffff",
}

PROJECT_ROOT = Path(__file__).parent
RES = PROJECT_ROOT / "Assets" / "Resources"


def write_asset(folder: Path, filename: str, so_type: str, fields: dict):
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / (filename + ".asset")
    header = HEADER % {"guid": GUIDS[so_type], "name": filename}
    body = "\n".join(f"  {k}: {v}" for k, v in fields.items())
    path.write_text(header + body + "\n", encoding="utf-8")


# ── ZombieData ───────────────────────────────────────────────────────────────
# Rarity: 0=Common 1=Uncommon 2=Rare 3=Epic 4=Legendary
ZOMBIE_CATALOG = [
    # (zombie_id, display_name, rarity, base_hp, base_attack, cook_speed_mult, infection_chance)
    # --- Common tier (0) ---
    ("zombie_rotten",        "Rotten Zombie",        0, 80,  10, 1.0, 0.30),
    ("zombie_burnt",         "Burnt Zombie",         0, 75,   8, 1.1, 0.28),
    ("zombie_sewer",         "Sewer Zombie",         0, 90,  11, 1.0, 0.32),
    ("zombie_nurse",         "Nurse Zombie",         0, 70,   9, 1.2, 0.35),
    ("zombie_office",        "Office Zombie",        0, 85,  10, 1.1, 0.30),
    ("zombie_biker",         "Biker Zombie",         0, 100, 14, 1.0, 0.25),
    ("zombie_chef",          "Chef Zombie",          0, 80,   9, 1.3, 0.38),
    ("zombie_mummy",         "Mummy Zombie",         0, 90,  12, 1.0, 0.28),
    ("zombie_caveman",       "Caveman Zombie",       0, 110, 15, 0.9, 0.22),
    ("zombie_suit",          "Business Zombie",      0, 80,  10, 1.1, 0.30),
    ("zombie_clown",         "Clown Zombie",         0, 85,  11, 1.0, 0.33),
    ("zombie_construction",  "Construction Zombie",  0, 105, 13, 0.9, 0.24),
    ("zombie_mailman",       "Mailman Zombie",       0, 80,  10, 1.1, 0.30),
    ("zombie_cop",           "Cop Zombie",           0, 95,  13, 1.0, 0.27),
    ("zombie_teacher",       "Teacher Zombie",       0, 75,   9, 1.2, 0.34),
    ("zombie_farmer",        "Farmer Zombie",        0, 90,  11, 1.0, 0.29),
    ("zombie_sailor",        "Sailor Zombie",        0, 85,  10, 1.1, 0.31),
    ("zombie_jogger",        "Jogger Zombie",        0, 78,  10, 1.2, 0.32),
    ("zombie_prom",          "Prom Zombie",          0, 72,   9, 1.2, 0.36),
    ("zombie_punk",          "Punk Zombie",          0, 88,  12, 1.0, 0.28),
    ("zombie_gamer",         "Gamer Zombie",         0, 80,  10, 1.1, 0.30),
    ("zombie_surfer",        "Surfer Zombie",        0, 82,  10, 1.1, 0.30),
    ("zombie_lumberjack",    "Lumberjack Zombie",    0, 108, 14, 0.9, 0.23),
    ("zombie_mechanic",      "Mechanic Zombie",      0, 95,  12, 1.0, 0.26),
    ("zombie_painter",       "Painter Zombie",       0, 78,   9, 1.2, 0.34),
    ("zombie_dentist",       "Dentist Zombie",       0, 80,  10, 1.2, 0.35),
    ("zombie_fireman",       "Fireman Zombie",       0, 100, 13, 1.0, 0.26),
    ("zombie_soldier",       "Soldier Zombie",       0, 105, 14, 0.9, 0.24),
    ("zombie_pirate",        "Pirate Zombie",        0, 90,  12, 1.0, 0.28),
    ("zombie_hippie",        "Hippie Zombie",        0, 76,   9, 1.2, 0.35),
    # --- Uncommon tier (1) ---
    ("zombie_ninja",         "Ninja Zombie",         1, 95,  14, 1.1, 0.32),
    ("zombie_samurai",       "Samurai Zombie",       1, 110, 16, 1.0, 0.28),
    ("zombie_viking",        "Viking Zombie",        1, 120, 17, 0.9, 0.24),
    ("zombie_gladiator",     "Gladiator Zombie",     1, 115, 16, 0.9, 0.25),
    ("zombie_cowboy",        "Cowboy Zombie",        1, 100, 14, 1.1, 0.30),
    ("zombie_astronaut",     "Astronaut Zombie",     1, 95,  13, 1.2, 0.33),
    ("zombie_diver",         "Diver Zombie",         1, 90,  12, 1.2, 0.34),
    ("zombie_boxer",         "Boxer Zombie",         1, 110, 16, 1.0, 0.27),
    ("zombie_wrestler",      "Wrestler Zombie",      1, 115, 17, 0.9, 0.25),
    ("zombie_magician",      "Magician Zombie",      1, 88,  12, 1.3, 0.36),
    ("zombie_cheerleader",   "Cheerleader Zombie",   1, 82,  11, 1.3, 0.38),
    ("zombie_rockstar",      "Rockstar Zombie",      1, 92,  13, 1.2, 0.34),
    ("zombie_sumo",          "Sumo Zombie",          1, 140, 18, 0.8, 0.21),
    ("zombie_geisha",        "Geisha Zombie",        1, 85,  12, 1.3, 0.37),
    ("zombie_knight",        "Knight Zombie",        1, 120, 17, 0.9, 0.24),
    ("zombie_king",          "King Zombie",          1, 125, 17, 0.9, 0.24),
    ("zombie_queen",         "Queen Zombie",         1, 105, 14, 1.1, 0.31),
    ("zombie_jester",        "Jester Zombie",        1, 90,  13, 1.2, 0.33),
    ("zombie_archer",        "Archer Zombie",        1, 88,  14, 1.1, 0.32),
    ("zombie_monk",          "Monk Zombie",          1, 100, 13, 1.1, 0.30),
    ("zombie_witch",         "Witch Zombie",         1, 85,  13, 1.3, 0.36),
    ("zombie_vampire",       "Vampire Zombie",       1, 100, 15, 1.1, 0.33),
    ("zombie_werewolf",      "Werewolf Zombie",      1, 120, 18, 0.9, 0.24),
    ("zombie_frankenstein",  "Frankenstein Zombie",  1, 130, 18, 0.8, 0.22),
    ("zombie_dracula",       "Dracula Zombie",       1, 105, 16, 1.0, 0.30),
    ("zombie_wolfman",       "Wolfman Zombie",       1, 118, 17, 0.9, 0.25),
    ("zombie_ghost",         "Ghost Zombie",         1, 80,  12, 1.3, 0.38),
    ("zombie_skeleton",      "Skeleton Zombie",      1, 88,  14, 1.1, 0.32),
    ("zombie_reaper",        "Reaper Zombie",        1, 95,  15, 1.1, 0.32),
    ("zombie_zombie_bride",  "Zombie Bride",         1, 90,  13, 1.2, 0.35),
    # --- Rare tier (2) ---
    ("zombie_pharaoh",       "Pharaoh Zombie",       2, 130, 20, 1.0, 0.30),
    ("zombie_roman",         "Roman Zombie",         2, 128, 19, 1.0, 0.29),
    ("zombie_shogun",        "Shogun Zombie",        2, 135, 21, 0.9, 0.27),
    ("zombie_conquistador",  "Conquistador Zombie",  2, 130, 20, 0.9, 0.27),
    ("zombie_spartan",       "Spartan Zombie",       2, 140, 22, 0.9, 0.25),
    ("zombie_berserker",     "Berserker Zombie",     2, 145, 23, 0.8, 0.23),
    ("zombie_shaman",        "Shaman Zombie",        2, 115, 18, 1.1, 0.33),
    ("zombie_warlock",       "Warlock Zombie",       2, 110, 18, 1.2, 0.34),
    ("zombie_paladin",       "Paladin Zombie",       2, 135, 20, 1.0, 0.28),
    ("zombie_barbarian",     "Barbarian Zombie",     2, 145, 23, 0.8, 0.23),
    ("zombie_mercenary",     "Mercenary Zombie",     2, 125, 20, 1.0, 0.28),
    ("zombie_ronin",         "Ronin Zombie",         2, 120, 20, 1.0, 0.28),
    ("zombie_berserk_nurse", "Berserk Nurse",        2, 105, 17, 1.2, 0.36),
    ("zombie_dr_dead",       "Dr. Dead",             2, 110, 17, 1.2, 0.35),
    ("zombie_mad_scientist", "Mad Scientist",        2, 115, 18, 1.1, 0.34),
    ("zombie_biohazard",     "Biohazard Zombie",     2, 120, 19, 1.0, 0.31),
    ("zombie_plague_doc",    "Plague Doctor",        2, 108, 17, 1.2, 0.35),
    ("zombie_cyborg",        "Cyborg Zombie",        2, 135, 22, 0.9, 0.26),
    ("zombie_robot",         "Robot Zombie",         2, 140, 22, 0.9, 0.25),
    ("zombie_mech",          "Mech Zombie",          2, 150, 24, 0.8, 0.22),
    # --- Epic tier (3) ---
    ("zombie_dragon_lord",   "Dragon Lord Zombie",   3, 180, 28, 0.9, 0.28),
    ("zombie_demon",         "Demon Zombie",         3, 175, 27, 0.9, 0.29),
    ("zombie_angel",         "Angel Zombie",         3, 160, 25, 1.0, 0.32),
    ("zombie_titan",         "Titan Zombie",         3, 200, 30, 0.8, 0.24),
    ("zombie_colossus",      "Colossus Zombie",      3, 210, 31, 0.8, 0.22),
    ("zombie_wraith",        "Wraith Zombie",        3, 155, 25, 1.0, 0.33),
    ("zombie_banshee",       "Banshee Zombie",       3, 145, 24, 1.1, 0.35),
    ("zombie_lich",          "Lich Zombie",          3, 160, 26, 1.0, 0.31),
    ("zombie_necromancer",   "Necromancer Zombie",   3, 150, 24, 1.1, 0.34),
    ("zombie_undead_king",   "Undead King",          3, 190, 29, 0.8, 0.25),
    ("zombie_shadow",        "Shadow Zombie",        3, 140, 24, 1.1, 0.36),
    ("zombie_void_walker",   "Void Walker",          3, 165, 26, 1.0, 0.31),
    ("zombie_hellfire",      "Hellfire Zombie",      3, 170, 27, 0.9, 0.29),
    ("zombie_crypt_lord",    "Crypt Lord",           3, 185, 29, 0.8, 0.25),
    ("zombie_death_knight",  "Death Knight",         3, 195, 30, 0.8, 0.24),
    # --- Legendary tier (4) ---
    ("zombie_grim_chef",     "Grim Chef",            4, 240, 36, 0.9, 0.30),
    ("zombie_zombie_god",    "Zombie God",           4, 280, 40, 0.8, 0.26),
    ("zombie_eternal_lord",  "Eternal Lord",         4, 300, 42, 0.8, 0.25),
    ("zombie_omega",         "Omega Zombie",         4, 260, 38, 0.9, 0.28),
    ("zombie_alpha",         "Alpha Zombie",         4, 250, 37, 0.9, 0.29),
    ("zombie_prime_evil",    "Prime Evil",           4, 270, 39, 0.8, 0.27),
    ("zombie_apocalypse",    "Apocalypse Zombie",    4, 290, 41, 0.8, 0.25),
    ("zombie_infinity",      "Infinity Zombie",      4, 310, 44, 0.7, 0.23),
    ("zombie_oblivion",      "Oblivion Zombie",      4, 305, 43, 0.7, 0.23),
    ("zombie_singularity",   "Singularity Zombie",   4, 320, 45, 0.7, 0.22),
]

def generate_zombies():
    folder = RES / "Zombies"
    for (zid, name, rarity, hp, atk, cook, infect) in ZOMBIE_CATALOG:
        write_asset(folder, zid, "ZombieData", {
            "ZombieId":          zid,
            "DisplayName":       name,
            "Rarity":            rarity,
            "BaseHP":            hp,
            "BaseAttack":        atk,
            "BaseSpeed":         2.5,
            "CookSpeedMult":     cook,
            "InfectionChance":   infect,
            "SpriteAtlas":       "null",
            "Portrait":          "null",
            "Animator":          "null",
        })
    print(f"  Generated {len(ZOMBIE_CATALOG)} ZombieData assets")


# ── DishData ─────────────────────────────────────────────────────────────────
# (dish_id, display_name, cook_time_sec, coin_reward, brain_reward, min_cafe_level)
DISH_CATALOG = [
    # Tier 1 — starter dishes (cafe lv 1)
    ("dish_brainburger",      "Brain Burger",          30,   10,  0, 1),
    ("dish_eyeball_soup",     "Eyeball Soup",          45,   14,  0, 1),
    ("dish_finger_fries",     "Finger Fries",          20,    8,  0, 1),
    ("dish_toe_tacos",        "Toe Tacos",             60,   18,  0, 1),
    ("dish_skull_stew",       "Skull Stew",            90,   25,  0, 1),
    ("dish_heart_hash",       "Heart Hash",            40,   13,  0, 1),
    ("dish_rib_roast",        "Rib Roast",            120,   30,  0, 1),
    ("dish_nerve_noodles",    "Nerve Noodles",         50,   16,  0, 1),
    ("dish_vein_vermicelli",  "Vein Vermicelli",       70,   20,  0, 1),
    ("dish_marrow_mash",      "Marrow Mash",           80,   22,  0, 1),
    # Tier 2 — early unlocks (cafe lv 2-3)
    ("dish_spleen_salad",     "Spleen Salad",         110,   35,  0, 2),
    ("dish_kidney_kebab",     "Kidney Kebab",         140,   42,  0, 2),
    ("dish_liver_linguine",   "Liver Linguine",       160,   48,  0, 2),
    ("dish_lung_lasagna",     "Lung Lasagna",         180,   55,  0, 3),
    ("dish_gizzard_gratin",   "Gizzard Gratin",       200,   60,  0, 3),
    ("dish_pancreas_pasta",   "Pancreas Pasta",       220,   65,  0, 3),
    ("dish_cortex_curry",     "Cortex Curry",         240,   70,  0, 3),
    ("dish_frontal_fondue",   "Frontal Fondue",       260,   78,  0, 3),
    ("dish_temporal_tartare", "Temporal Tartare",     280,   85,  0, 3),
    ("dish_brainstem_bisque", "Brainstem Bisque",     300,   90,  0, 3),
    # Tier 3 — mid-game (cafe lv 4-6)
    ("dish_cerebrum_crepe",   "Cerebrum Crepe",       360,  110,  0, 4),
    ("dish_occipital_omelet", "Occipital Omelet",     420,  128,  0, 4),
    ("dish_parietal_pie",     "Parietal Pie",         480,  145,  0, 5),
    ("dish_hypothal_hotpot",  "Hypothalamus Hotpot",  540,  165,  0, 5),
    ("dish_medulla_mousse",   "Medulla Mousse",       600,  185,  0, 5),
    ("dish_synapse_souffle",  "Synapse Souffle",      660,  200,  1, 6),
    ("dish_neuron_nachos",    "Neuron Nachos",        720,  220,  1, 6),
    ("dish_axon_aglio",       "Axon Aglio",           780,  240,  1, 6),
    ("dish_dendrite_dumplings","Dendrite Dumplings",  840,  260,  1, 6),
    ("dish_myelin_minestrone","Myelin Minestrone",    900,  280,  1, 6),
    # Tier 4 — advanced (cafe lv 7-10)
    ("dish_cortex_consomme",  "Cortex Consomme",     1080,  340,  1, 7),
    ("dish_amygdala_amuse",   "Amygdala Amuse-Bouche",1200, 380,  2, 7),
    ("dish_hippocampus_hash", "Hippocampus Hash",    1320,  415,  2, 8),
    ("dish_thalamus_tartare", "Thalamus Tartare",    1440,  450,  2, 8),
    ("dish_pineal_pate",      "Pineal Pate",         1560,  490,  2, 9),
    ("dish_cerebellum_creme", "Cerebellum Creme",    1680,  530,  3, 9),
    ("dish_pons_pot_au_feu",  "Pons Pot-au-Feu",     1800,  570,  3, 10),
    ("dish_putamen_pizza",    "Putamen Pizza",       1980,  620,  3, 10),
    ("dish_globus_gratin",    "Globus Gratin",       2160,  680,  4, 10),
    ("dish_caudate_cake",     "Caudate Cake",        2400,  750,  4, 10),
    # Tier 5 — brain-currency dishes (cafe lv 11-15)
    ("dish_zombie_supreme",   "Zombie Supreme",      2880,  900,  5, 11),
    ("dish_undead_delight",   "Undead Delight",      3240, 1020,  6, 12),
    ("dish_raider_roast",     "Raider Roast",        3600, 1140,  6, 12),
    ("dish_apocalypse_apple", "Apocalypse Apple Pie",4320, 1350,  7, 13),
    ("dish_eternal_eclair",   "Eternal Eclair",      5040, 1575,  8, 14),
    ("dish_oblivion_omakase", "Oblivion Omakase",    7200, 2250, 10, 15),
    # Tier 6 — prestige (cafe lv 16-20)
    ("dish_singularity_sushi","Singularity Sushi",  10800, 3375, 15, 16),
    ("dish_void_vichyssoise", "Void Vichyssoise",   14400, 4500, 18, 17),
    ("dish_omega_ossobuco",   "Omega Ossobuco",     21600, 6750, 22, 18),
    ("dish_alpha_ambrosia",   "Alpha Ambrosia",     28800, 9000, 28, 19),
    ("dish_infinity_feast",   "Infinity Feast",     43200,13500, 35, 20),
    # Seasonal / special
    ("dish_halloween_head",   "Halloween Head",      720,  220,  3, 5),
    ("dish_xmas_zombie_loaf", "Xmas Zombie Loaf",    720,  220,  3, 5),
    ("dish_valentines_vein",  "Valentine's Vein",    720,  220,  3, 5),
    ("dish_easter_eyecup",    "Easter Eye Cup",      720,  220,  3, 5),
    ("dish_new_year_neuron",  "New Year Neuron",     720,  220,  3, 5),
    # Quick-serve premium (costs brains to unlock)
    ("dish_lightning_lobe",   "Lightning Lobe",       15,   50,  0, 8),
    ("dish_turbo_temporal",   "Turbo Temporal",       10,   35,  0, 6),
    ("dish_hyper_hypothal",   "Hyper Hypothal",        5,   20,  0, 4),
    # Filling up to 320 with numbered variants
] + [(f"dish_special_{i:03d}", f"Special Dish {i:03d}", 300+i*10, 90+i*3, max(0,i//20), max(1,i//15)) for i in range(1, 262)]

# Trim to exactly 320
DISH_CATALOG = DISH_CATALOG[:320]

def generate_dishes():
    folder = RES / "Dishes"
    for (did, name, cook, coins, brains, lvl) in DISH_CATALOG:
        write_asset(folder, did, "DishData", {
            "DishId":           did,
            "DisplayName":      name,
            "CookTimeSeconds":  cook,
            "CoinReward":       coins,
            "BrainReward":      brains,
            "CafeLevelRequired":lvl,
            "Icon":             "null",
        })
    print(f"  Generated {len(DISH_CATALOG)} DishData assets")


# ── FurnitureData ─────────────────────────────────────────────────────────────
# FurnitureType: Stove=0 Table=1 Chair=2 Fridge=3 Sink=4 Counter=5 Pot=6 Decor=7 Wall=8 WallDecor=9 Floor=10
FURNITURE_CATALOG = (
    # Stoves (61)
    [(f"stove_{i:02d}", f"Stove {i:02d}", 0, (1,1), 500+i*200, i*50, max(1,i//3), 0.05+i*0.01) for i in range(1,62)] +
    # Tables (54)
    [(f"table_{i:02d}", f"Table {i:02d}", 1, (2,2), 300+i*150, i*40, max(1,i//4), 0.0) for i in range(1,55)] +
    # Chairs (56)
    [(f"chair_{i:02d}", f"Chair {i:02d}", 2, (1,1), 150+i*80, i*20, max(1,i//5), 0.0) for i in range(1,57)] +
    # Fridges (12)
    [(f"fridge_{i:02d}", f"Fridge {i:02d}", 3, (1,2), 800+i*300, i*70, max(1,i//2), 0.0) for i in range(1,13)] +
    # Sinks (13)
    [(f"sink_{i:02d}", f"Sink {i:02d}", 4, (1,1), 400+i*100, i*30, max(1,i//3), 0.0) for i in range(1,14)] +
    # Counters (19)
    [(f"counter_{i:02d}", f"Counter {i:02d}", 5, (2,1), 600+i*120, i*35, max(1,i//4), 0.0) for i in range(1,20)] +
    # Pots (28)
    [(f"pot_{i:02d}", f"Pot {i:02d}", 6, (1,1), 350+i*90, i*25, max(1,i//3), 0.02+i*0.005) for i in range(1,29)] +
    # Decors (182)
    [(f"decor_{i:03d}", f"Decor {i:03d}", 7, (1,1), 100+i*50, i*10, max(1,i//8), 0.0) for i in range(1,183)] +
    # Walls (50)
    [(f"wall_{i:02d}", f"Wall {i:02d}", 8, (1,1), 200+i*60, i*15, max(1,i//6), 0.0) for i in range(1,51)] +
    # Wall decors (107)
    [(f"walldecor_{i:03d}", f"Wall Decor {i:03d}", 9, (1,1), 120+i*40, i*10, max(1,i//8), 0.0) for i in range(1,108)] +
    # Floor tiles (20)
    [(f"floor_{i:02d}", f"Floor {i:02d}", 10, (1,1), 250+i*50, i*12, max(1,i//5), 0.0) for i in range(1,21)]
)

def generate_furniture():
    folder = RES / "Furniture"
    for item in FURNITURE_CATALOG:
        fid, name, ftype, size, coins, sell, lvl, cook_bonus = item
        write_asset(folder, fid, "FurnitureData", {
            "FurnitureId":      fid,
            "DisplayName":      name,
            "FurnitureType":    ftype,
            "Size":             f"{{x: {size[0]}, y: {size[1]}}}",
            "BuyCost":          coins,
            "SellValue":        sell,
            "CafeLevelRequired":lvl,
            "CookSpeedBonus":   round(cook_bonus, 3),
            "HappinessBonus":   0,
            "Prefab":           "null",
        })
    print(f"  Generated {len(FURNITURE_CATALOG)} FurnitureData assets")


# ── TombstoneData ─────────────────────────────────────────────────────────────
# TombstoneBuff: Strength=0 Health=1 Revive=2 Decorative=3 GrimReaper=4 SuperServer=5 Pet=6
TOMBSTONE_CATALOG = [
    ("tombstone_skull",       "Skull Tombstone",      0, 0.05),
    ("tombstone_cross",       "Cross Tombstone",      1, 0.05),
    ("tombstone_angel",       "Angel Tombstone",      1, 0.10),
    ("tombstone_gargoyle",    "Gargoyle Tombstone",   0, 0.10),
    ("tombstone_obelisk",     "Obelisk Tombstone",    0, 0.15),
    ("tombstone_crypt",       "Crypt Tombstone",      1, 0.15),
    ("tombstone_revive",      "Revive Tombstone",     2, 1.00),  # single revive
    ("tombstone_grim_reaper", "Grim Reaper Tombstone",4, 0.20),
    ("tombstone_super_server","Super Server Stone",   5, 0.25),
    ("tombstone_pet_habitat", "Pet Habitat Stone",    6, 1.00),
    ("tombstone_obsidian",    "Obsidian Tombstone",   0, 0.20),
    ("tombstone_gold",        "Gold Tombstone",       1, 0.20),
    ("tombstone_diamond",     "Diamond Tombstone",    0, 0.25),
]

def generate_tombstones():
    folder = RES / "Tombstones"
    for (tid, name, buff, val) in TOMBSTONE_CATALOG:
        write_asset(folder, tid, "TombstoneData", {
            "TombstoneId": tid,
            "DisplayName": name,
            "BuffType":    buff,
            "BuffValue":   val,
            "Prefab":      "null",
        })
    print(f"  Generated {len(TOMBSTONE_CATALOG)} TombstoneData assets")


# ── BoosterData ───────────────────────────────────────────────────────────────
# BoosterTier: Turbo=0 Super=1 Hyper=2
BOOSTER_CATALOG = [
    ("booster_turbo", "Turbo Booster", 0, 2.0, 300, 5),
    ("booster_super", "Super Booster", 1, 3.0, 300, 10),
    ("booster_hyper", "Hyper Booster", 2, 5.0, 300, 20),
]

def generate_boosters():
    folder = RES / "Boosters"
    for (bid, name, tier, mult, dur, cost) in BOOSTER_CATALOG:
        write_asset(folder, bid, "BoosterData", {
            "BoosterId":          bid,
            "DisplayName":        name,
            "Tier":               tier,
            "CookSpeedMultiplier":mult,
            "DurationSeconds":    dur,
            "BuyCost":            cost,
        })
    print(f"  Generated {len(BOOSTER_CATALOG)} BoosterData assets")


# ── PetData ───────────────────────────────────────────────────────────────────
# PetAbility: None=0 AreaAttack=1 Transform=2 Tornado=3 Pounce=4 Shield=5
PET_CATALOG = [
    ("pet_ghost_cat",    "Ghost Cat",    1, 3.0, (1,1), 60,  20),
    ("pet_zombie_dog",   "Zombie Dog",   4, 4.0, (1,1), 70,  25),
    ("pet_bat",          "Bat",          3, 2.5, (1,1), 50,  18),
    ("pet_spider",       "Spider",       1, 3.5, (1,1), 55,  22),
    ("pet_snake",        "Snake",        4, 4.5, (1,1), 65,  26),
    ("pet_crow",         "Crow",         3, 3.0, (1,1), 60,  20),
    ("pet_wolf",         "Wolf",         1, 5.0, (2,2), 90,  35),
    ("pet_dragon",       "Dragon",       1, 6.0, (2,2), 120, 45),
    ("pet_phoenix",      "Phoenix",      5, 5.5, (2,2), 100, 40),
]

def generate_pets():
    folder = RES / "Pets"
    for (pid, name, ability, cooldown, hsize, hp, atk) in PET_CATALOG:
        write_asset(folder, pid, "PetData", {
            "PetId":           pid,
            "DisplayName":     name,
            "Ability":         ability,
            "AbilityCooldown": cooldown,
            "HabitatSize":     f"{{x: {hsize[0]}, y: {hsize[1]}}}",
            "BaseHP":          hp,
            "BaseAttack":      atk,
            "Animator":        "null",
        })
    print(f"  Generated {len(PET_CATALOG)} PetData assets")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Generating ScriptableObject catalog into:\n  {RES}\n")
    generate_zombies()
    generate_dishes()
    generate_furniture()
    generate_tombstones()
    generate_boosters()
    generate_pets()
    total = (len(ZOMBIE_CATALOG) + len(DISH_CATALOG) + len(FURNITURE_CATALOG) +
             len(TOMBSTONE_CATALOG) + len(BOOSTER_CATALOG) + len(PET_CATALOG))
    print(f"\nDone. {total} total assets written.")
    print("Open Unity — it will auto-import all .asset files.")
    print("NOTE: Script GUIDs are placeholders; Unity will reassign real GUIDs on import.")
