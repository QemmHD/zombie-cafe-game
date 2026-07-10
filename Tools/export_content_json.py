#!/usr/bin/env python3
"""
export_content_json.py
Ports the Unity ScriptableObject .asset catalogs (Assets/Resources/*) into flat
JSON arrays consumable by the web-native (Phaser/TS) remake.

Reads:  Assets/Resources/{Zombies,Dishes,Furniture,Pets,Tombstones,Boosters}/*.asset
Writes: src/data/{zombies,dishes,furniture,pets,tombstones,boosters}.json

The .asset files are flat Unity YAML; every gameplay field lives on a 2-space
indented `Key: value` line after `m_EditorClassIdentifier:`. We parse those
generically, normalise keys to camelCase, decode Unity vectors, and attach
human-readable enum labels so the web client never hard-codes magic integers.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
RES = ROOT / "legacy-unity" / "Assets" / "Resources"
OUT = ROOT / "src" / "data"

# Enum orderings mirror the C# definitions in Assets/_Game/Scripts/Data/*.cs
RARITY = ["common", "uncommon", "rare", "epic", "legendary"]
FURNITURE_TYPE = ["stove", "table", "chair", "fridge", "sink", "counter",
                  "pot", "decor", "wall", "wallDecor", "floor"]
PET_ABILITY = ["none", "areaAttack", "transform", "tornado", "pounce", "shield"]
TOMBSTONE_BUFF = ["strength", "health", "revive", "decorative", "grimReaper",
                  "superServer", "pet"]
BOOSTER_TIER = ["turbo", "super", "hyper"]

VEC_RE = re.compile(r"\{x:\s*([-\d.]+),\s*y:\s*([-\d.]+)\}")

# Unity-internal / art-pointer fields we drop from the web data model.
SKIP_KEYS = {"m_ObjectHideFlags", "m_CorrespondingSourceObject", "m_PrefabInstance",
             "m_PrefabAsset", "m_GameObject", "m_Enabled", "m_EditorHideFlags",
             "m_Script", "m_Name", "m_EditorClassIdentifier",
             "Prefab", "HabitatPrefab", "Icon", "Portrait", "Animator",
             "DishSprite", "SpriteAtlas", "Sprite"}


def camel(key: str) -> str:
    return key[0].lower() + key[1:] if key else key


def decode(value: str):
    value = value.strip()
    if value == "" or value == "null":
        return None
    m = VEC_RE.match(value)
    if m:
        return {"x": num(m.group(1)), "y": num(m.group(2))}
    return num(value)


def num(value):
    try:
        f = float(value)
        return int(f) if f.is_integer() else f
    except (ValueError, TypeError):
        return value


def parse_asset(path: Path) -> dict:
    obj = {}
    started = False
    for raw in path.read_text().splitlines():
        if "m_EditorClassIdentifier" in raw:
            started = True
            continue
        if not started:
            continue
        if ":" not in raw:
            continue
        key, _, val = raw.strip().partition(":")
        if key in SKIP_KEYS:
            continue
        obj[camel(key)] = decode(val)
    return obj


def enrich(category: str, obj: dict) -> dict:
    if category == "zombies" and isinstance(obj.get("rarity"), int):
        obj["rarityLabel"] = RARITY[obj["rarity"]] if obj["rarity"] < len(RARITY) else "common"
    if category == "furniture" and isinstance(obj.get("furnitureType"), int):
        i = obj["furnitureType"]
        obj["typeLabel"] = FURNITURE_TYPE[i] if i < len(FURNITURE_TYPE) else "decor"
    if category == "pets" and isinstance(obj.get("ability"), int):
        i = obj["ability"]
        obj["abilityLabel"] = PET_ABILITY[i] if i < len(PET_ABILITY) else "none"
    if category == "tombstones" and isinstance(obj.get("buffType"), int):
        i = obj["buffType"]
        obj["buffLabel"] = TOMBSTONE_BUFF[i] if i < len(TOMBSTONE_BUFF) else "decorative"
    if category == "boosters" and isinstance(obj.get("tier"), int):
        i = obj["tier"]
        obj["tierLabel"] = BOOSTER_TIER[i] if i < len(BOOSTER_TIER) else "turbo"
    return obj


def export(category: str, folder: str):
    src = RES / folder
    if not src.exists():
        print(f"  ! missing {src}")
        return 0
    items = [enrich(category, parse_asset(p)) for p in sorted(src.glob("*.asset"))]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{category}.json").write_text(json.dumps(items, indent=1))
    print(f"  {category:12s} {len(items):4d}  -> src/data/{category}.json")
    return len(items)


def main():
    print("Exporting Unity content catalogs -> JSON")
    total = 0
    total += export("zombies", "Zombies")
    total += export("dishes", "Dishes")
    total += export("furniture", "Furniture")
    total += export("pets", "Pets")
    total += export("tombstones", "Tombstones")
    total += export("boosters", "Boosters")
    print(f"Done. {total} entries exported.")


if __name__ == "__main__":
    main()
