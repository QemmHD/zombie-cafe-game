#!/usr/bin/env python3
"""
build_puppets.py — slice AI-generated puppet parts sheets into per-part sprites
and emit the rig JSONs the game's PuppetBody consumes.

Input sheets (Higgsfield nano-banana, style-referenced on the shipped character
art) live in the scratchpad; each contains 6 isolated parts on solid white:
head, torso, two arms, two legs. This tool:
  1. removes the exterior white by border flood-fill (interior whites — eyes,
     hat, apron — are enclosed by outlines and survive),
  2. labels connected alpha components, maps them to named parts by expected
     centroid position,
  3. crops each part -> public/art/puppets/<char>_<part>.png,
  4. writes src/data/puppets/<char>.json — the rig: per-part pivot (joint),
     attach point in assembled feet-space, z order, pose channel,
  5. renders an assembled rest-pose preview for tuning.

Attach geometry is derived from measured part sizes via the ANATOMY ratios
below — tune those, re-run, check the preview.
"""
from __future__ import annotations

import json
import math
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = Path('/tmp/claude-0/-home-user-zombie-cafe-game/ad4e45ed-b032-5c2e-87a1-69fe4d0cedea/scratchpad')
ART_OUT = ROOT / 'public' / 'art' / 'puppets'
RIG_OUT = ROOT / 'src' / 'data' / 'puppets'
ART_OUT.mkdir(parents=True, exist_ok=True)
RIG_OUT.mkdir(parents=True, exist_ok=True)

WHITE_T = 238  # border flood-fill threshold: all channels above -> background
TARGET_H = 300  # normalized assembled character height in rig units
TEX_SCALE = 0.3  # shipped texture downscale (~3x on-screen headroom; the rig
#                  uses setDisplaySize, so texture resolution is independent)


def remove_exterior_white(img: Image.Image) -> Image.Image:
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    seen = [[False] * h for _ in range(w)]
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        seen[x][y] = True
        r, g, b, a = px[x, y]
        if r > WHITE_T and g > WHITE_T and b > WHITE_T:
            px[x, y] = (0, 0, 0, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return img


def components(img: Image.Image, min_area: int = 900) -> list[dict]:
    """4-connected alpha components -> [{bbox, area, cx, cy}] sorted by area."""
    w, h = img.size
    px = img.load()
    lab = [[0] * h for _ in range(w)]
    out = []
    nxt = 0
    for sx in range(w):
        for sy in range(h):
            if px[sx, sy][3] > 8 and lab[sx][sy] == 0:
                nxt += 1
                q = deque([(sx, sy)])
                lab[sx][sy] = nxt
                minx = maxx = sx; miny = maxy = sy
                area = 0; sumx = 0; sumy = 0
                while q:
                    x, y = q.popleft()
                    area += 1; sumx += x; sumy += y
                    minx = min(minx, x); maxx = max(maxx, x)
                    miny = min(miny, y); maxy = max(maxy, y)
                    for nx2, ny2 in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx2 < w and 0 <= ny2 < h and px[nx2, ny2][3] > 8 and lab[nx2][ny2] == 0:
                            lab[nx2][ny2] = nxt
                            q.append((nx2, ny2))
                if area >= min_area:
                    out.append({'bbox': (minx, miny, maxx + 1, maxy + 1), 'area': area,
                                'cx': sumx / area, 'cy': sumy / area})
    out.sort(key=lambda c: -c['area'])
    return out


# Expected part centroids per sheet (eyeballed from the chosen generations).
SHEETS = {
    'zombie_waiter': {
        'file': 'flat/zw_a.png',
        'style': 'zombie',
        'expect': {
            'head': (225, 440), 'torso': (540, 545), 'armL': (745, 355),
            'armR': (915, 440), 'legL': (760, 715), 'legR': (885, 700),
        },
        # tray arm: shoulder is the torn sleeve at the part's lower-left
        'pivots': {'head': (0.45, 0.92), 'torso': (0.5, 0.94), 'armL': (0.18, 0.72),
                   'armR': (0.5, 0.08), 'legL': (0.5, 0.06), 'legR': (0.5, 0.06)},
        'swing': {'armL': 0.25},  # cloche stays level — barely swings
        'rest': {'armL': -0.55},  # swing the platter out front at chest height
        'anatomy': {'shoulder_spread': 0.6},
    },
    'customer': {
        'file': 'flat/cu_a.png',
        'style': 'human',
        'expect': {
            'head': (255, 265), 'torso': (525, 520), 'armL': (165, 690),
            'armR': (830, 530), 'legL': (345, 830), 'legR': (725, 810),
        },
        'pivots': {'head': (0.45, 0.93), 'torso': (0.5, 0.94), 'armL': (0.75, 0.1),
                   'armR': (0.2, 0.12), 'legL': (0.5, 0.06), 'legR': (0.5, 0.06)},
        'swing': {},
        'rest': {},
    },
    'customer_w': {
        'file': 'flat/cw_a.png',
        'short': 'cw',
        'style': 'human',
        'expect': {
            'head': (499, 251), 'torso': (504, 635), 'armL': (221, 600),
            'armR': (765, 568), 'legL': (330, 865), 'legR': (693, 865),
        },
        'pivots': {'head': (0.5, 0.92), 'torso': (0.5, 0.94), 'armL': (0.6, 0.08),
                   'armR': (0.08, 0.3), 'legL': (0.5, 0.06), 'legR': (0.5, 0.06)},
        'swing': {'armR': 0.5},
        'rest': {'armR': 1.25},  # the horizontal art hangs down at rest
    },
    'customer_s': {
        'file': 'flat/cs_a.png',
        'short': 'cs',
        'style': 'human',
        'expect': {
            'head': (517, 275), 'torso': (501, 729), 'armL': (123, 718),
            'armR': (794, 667), 'legL': (283, 863), 'legR': (737, 887),
        },
        'pivots': {'head': (0.5, 0.93), 'torso': (0.5, 0.94), 'armL': (0.5, 0.08),
                   'armR': (0.08, 0.3), 'legL': (0.5, 0.06), 'legR': (0.5, 0.06)},
        'swing': {'armR': 0.5},
        'rest': {'armR': 1.25},
    },
}

# Anatomy ratios (fractions of sizes measured off the sliced parts).
ANATOMY = {
    'leg_overlap': 0.10,   # hips tuck up under the torso hem by this * legH
    'hip_spread': 0.16,    # +/- of torso width
    'torso_overlap': 0.06, # pelvis sits this * torsoH above the leg tops
    'shoulder_y': 0.80,    # shoulders at this fraction up the torso
    'shoulder_spread': 0.40,
    'head_overlap': 0.06,  # neck tuck: head pivot this * headH below torso top
}


def build(char: str) -> None:
    cfg = SHEETS[char]
    anat = {**ANATOMY, **cfg.get('anatomy', {})}
    sheet = remove_exterior_white(Image.open(SCRATCH / cfg['file']))
    comps = components(sheet)
    if len(comps) < 6:
        sys.exit(f'{char}: expected >=6 parts, found {len(comps)}')
    comps = comps[:6]
    # assign each expected part its nearest component (greedy by distance)
    assigned: dict[str, dict] = {}
    used: set[int] = set()
    pairs = []
    for name, (ex, ey) in cfg['expect'].items():
        for i, c in enumerate(comps):
            pairs.append((math.hypot(c['cx'] - ex, c['cy'] - ey), name, i))
    for dist, name, i in sorted(pairs):
        if name in assigned or i in used:
            continue
        assigned[name] = comps[i]
        used.add(i)
    if len(assigned) < 6:
        sys.exit(f'{char}: could not assign all parts')

    short = cfg.get('short') or ('zw' if char == 'zombie_waiter' else 'cu')
    dims: dict[str, tuple[int, int]] = {}
    for name, c in assigned.items():
        x0, y0, x1, y1 = c['bbox']
        part = sheet.crop((x0 - 3, y0 - 3, x1 + 3, y1 + 3))
        dims[name] = part.size  # rig geometry uses full-res measurements
        ship = part.resize(
            (max(1, round(part.size[0] * TEX_SCALE)), max(1, round(part.size[1] * TEX_SCALE))),
            Image.LANCZOS,
        )
        ship.save(ART_OUT / f'{short}_{name}.png')
        print(f'  {char}.{name}: {part.size[0]}x{part.size[1]} area={c["area"]}')

    # ---- rig geometry (feet origin, y negative = up), normalized to TARGET_H
    legH = max(dims['legL'][1], dims['legR'][1])
    torW, torH = dims['torso']
    headH = dims['head'][1]
    raw_h = legH * (1 - anat['leg_overlap']) + torH * (1 - anat['torso_overlap']) \
        + headH * (1 - anat['head_overlap'] - (1 - cfg['pivots']['head'][1]))
    s = TARGET_H / raw_h  # normalize all part sizes + offsets into rig units

    hip_y = -legH * (1 - anat['leg_overlap'] - 0.06) * s
    pelvis_y = hip_y - legH * 0.06 * s
    shoulder_y = torH * anat['shoulder_y'] * s  # up from pelvis (positive)
    torso_top = torH * (1 - anat['torso_overlap']) * s

    def P(name: str, attach: tuple[float, float], group: str, z: int,
          channel: str | None) -> dict:
        w, h = dims[name]
        part = {
            'name': name, 'tex': f'pp_{short}_{name}',
            'w': round(w * s, 1), 'h': round(h * s, 1),
            'pivot': list(cfg['pivots'][name]),
            'attach': [round(attach[0], 1), round(attach[1], 1)],
            'group': group, 'z': z,
        }
        if channel:
            part['channel'] = channel
        if name in cfg['swing']:
            part['swing'] = cfg['swing'][name]
        if name in cfg['rest']:
            part['rest'] = cfg['rest'][name]
        return part

    hs = torW * anat['hip_spread'] * s
    ss = torW * anat['shoulder_spread'] * s
    rig = {
        'style': cfg['style'],
        'height': TARGET_H,
        'pelvis': [0, round(pelvis_y, 1)],
        'parts': [
            # feet-space parts (legs hang from the root at the hips)
            P('legR', (hs, hip_y), 'root', 1, 'legR'),
            P('legL', (-hs, hip_y), 'root', 2, 'legL'),
            # pelvis-space parts (upper body rotates as one around the pelvis)
            P('torso', (0, 0), 'upper', 3, None),
            P('armR', (ss, -shoulder_y), 'upper', 4, 'armR'),
            P('armL', (-ss, -shoulder_y), 'upper', 5, 'armL'),
            P('head', (0, -(torso_top - headH * anat['head_overlap'] * s)), 'upper', 6, 'head'),
        ],
    }
    (RIG_OUT / f'{char}.json').write_text(json.dumps(rig, indent=1) + '\n')

    # ---- rest-pose preview for tuning
    canvas = Image.new('RGBA', (500, 420), (40, 44, 56, 255))
    ox, oy = 250, 400
    for part in sorted(rig['parts'], key=lambda p: p['z']):
        img = Image.open(ART_OUT / f'{short}_{part["name"]}.png')
        w2, h2 = int(part['w']), int(part['h'])
        img = img.resize((w2, h2), Image.LANCZOS)
        ax, ay = part['attach']
        if part['group'] == 'upper':
            ax += rig['pelvis'][0]
            ay += rig['pelvis'][1]
        px0 = int(ox + ax - part['pivot'][0] * w2)
        py0 = int(oy + ay - part['pivot'][1] * h2)
        canvas.alpha_composite(img, (px0, py0))
    canvas.save(SCRATCH / f'puppet_preview_{short}.png')
    print(f'  -> rig {char}.json, preview puppet_preview_{short}.png')


if __name__ == '__main__':
    for char in SHEETS:
        build(char)
