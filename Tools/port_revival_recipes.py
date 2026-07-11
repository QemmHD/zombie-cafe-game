#!/usr/bin/env python3
"""Port the authentic Zombie Cafe recipe table into src/data/dishes.json.

Source: docs/spec/93-revival-repo-facts.md, Appendix A — 216 rows decoded from
the original game's foodData.bin (facts extracted from the community revival
repo; data only, no code or assets). Gross income = Servings x $/Serv.

Run from repo root: python3 Tools/port_revival_recipes.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / 'docs' / 'spec' / '93-revival-repo-facts.md'
OUT = ROOT / 'src' / 'data' / 'dishes.json'

EXPECTED_ROWS = 216
COLUMNS = 15  # | # | Name | Lvl | Price | Cook min | Servings | $/Serv | XP | Img | U7..U10 | Tag | CB |


def slug(name: str) -> str:
    s = name.lower()
    s = s.replace('&', 'and').replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return f'dish_{s}'


def parse_rows() -> list[list[str]]:
    rows: list[list[str]] = []
    in_appendix = False
    for line in SPEC.read_text().splitlines():
        if line.startswith('## '):
            if in_appendix:
                break  # next section — Appendix A is over
            in_appendix = line.startswith('## Appendix A')
            continue
        if not in_appendix or not line.startswith('|'):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        # Only true data rows: exactly 15 cells and a numeric index.
        if len(cells) != COLUMNS or not cells[0].isdigit():
            continue
        rows.append(cells)
    return rows


def main() -> None:
    rows = parse_rows()
    assert len(rows) == EXPECTED_ROWS, f'expected {EXPECTED_ROWS} recipes, parsed {len(rows)}'

    dishes = []
    ids: set[str] = set()
    for cells in rows:
        num, name = int(cells[0]), cells[1]
        lvl, price, cook_min = int(cells[2]), int(cells[3]), int(cells[4])
        servings, per_serving, xp = int(cells[5]), int(cells[6]), int(cells[7])
        image_id, tag, cookbook = int(cells[8]), int(cells[13]), int(cells[14])

        dish_id = slug(name)
        if dish_id in ids:  # duplicate names get the original row index
            dish_id = f'{dish_id}_{num}'
        ids.add(dish_id)

        dishes.append({
            'dishId': dish_id,
            'displayName': name,
            'cafeLevelRequired': lvl,
            'cookTimeSeconds': cook_min * 60,
            'price': price,                       # paid when the cook starts (M5)
            'servings': servings,
            'perServing': per_serving,
            'coinReward': servings * per_serving,  # gross income when served out
            'xp': xp,
            'imageId': image_id,
            'stoveTag': tag,                      # 0 = any stove
            'cookbook': cookbook,
        })

    OUT.write_text(json.dumps(dishes, indent=1) + '\n')
    lvl1 = [d for d in dishes if d['cafeLevelRequired'] == 1]
    print(f'wrote {len(dishes)} authentic recipes -> {OUT.relative_to(ROOT)}')
    print(f'level-1 starters: {[d["displayName"] for d in lvl1]}')


if __name__ == '__main__':
    main()
