#!/usr/bin/env python3
"""Trim the flat-cel furniture generations (white bg -> alpha, crop, resize)
into public/art/. Border flood-fill only — interior whites survive."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SRC = Path('/tmp/claude-0/-home-user-zombie-cafe-game/ad4e45ed-b032-5c2e-87a1-69fe4d0cedea/scratchpad/flat')
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art'
WHITE_T = 240
MAX_SIDE = 440  # plenty for ~150px on-screen furniture


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


for name in ['stove', 'table', 'chair', 'counter', 'sink', 'fridge']:
    img = remove_exterior_white(Image.open(SRC / f'{name}.png'))
    bbox = img.getbbox()
    img = img.crop(bbox)
    scale = MAX_SIDE / max(img.size)
    if scale < 1:
        img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    img.save(OUT / f'{name}.png')
    print(f'{name}: {img.size} {(OUT / f"{name}.png").stat().st_size // 1024}KB')
