#!/usr/bin/env python3
"""
build_room_art.py — synthesize the modular room surfaces to EXACT canon geometry.

AI image models can't hit pixel-exact 2:1 diamonds or the 64x224 wall-section
parallelogram, so these are generated procedurally (seeded, reproducible) in the
game's grimy-diner palette. Character/furniture sprites stay AI-generated.

Outputs (@2x for crisp zoom; the view scales by 0.5):
  public/art/room/floor_01_a.png  256x128  cream worn tile diamond
  public/art/room/floor_01_b.png  256x128  charcoal worn tile diamond
  public/art/room/wall_01.png     128x448  striped wallpaper section (right wall;
                                           left wall is flipX of this asset)
  public/art/room/door_mat.png    256x128  entrance mat diamond

Geometry (canon §1, @2x): tile 256x128; wall section canvas 128x448 — for column
x the filled rows run [x/2, 384 + x/2) (64px base rise + 384px wall height).
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent.parent / "public" / "art" / "room"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 256, 128  # @2x tile
WALL_W, WALL_H = 128, 448  # @2x wall section

# Palette matched to the established art (grimy diner)
CREAM = (216, 205, 180)
CREAM_GROUT = (150, 138, 115)
CHAR = (43, 43, 50)
CHAR_GROUT = (24, 24, 30)
OUTLINE = (20, 18, 24)
STRIPE_A = (138, 148, 84)  # olive green
STRIPE_B = (196, 138, 77)  # burnt orange
WALL_GRIME = (60, 50, 38)
BASEBOARD = (58, 44, 32)
MAT = (96, 34, 30)


def diamond_mask(w: int, h: int) -> Image.Image:
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(w // 2, 0), (w - 1, h // 2), (w // 2, h - 1), (0, h // 2)], fill=255)
    return m


def grime(draw: ImageDraw.ImageDraw, rng: random.Random, w: int, h: int, n: int, shade, alpha=(6, 16)):
    """Small soft stains — many faint marks read as wear; big ones read as blobs."""
    for _ in range(n):
        cx, cy = rng.randrange(w), rng.randrange(h)
        rx, ry = rng.randint(2, 9), rng.randint(2, 6)
        a = rng.randint(*alpha)
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(*shade, a))


def cracks(draw: ImageDraw.ImageDraw, rng: random.Random, w: int, h: int, n: int, shade):
    for _ in range(n):
        x, y = rng.randrange(w), rng.randrange(h)
        for _ in range(rng.randint(3, 7)):
            nx = x + rng.randint(-18, 18)
            ny = y + rng.randint(-10, 10)
            draw.line([x, y, nx, ny], fill=(*shade, rng.randint(50, 100)), width=2)
            x, y = nx, ny


def floor_tile(base, grout, seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tex = Image.new("RGBA", (W, H), (*base, 255))
    d = ImageDraw.Draw(tex, "RGBA")
    # subtle per-pixel tone noise via many tiny translucent specks
    for _ in range(900):
        x, y = rng.randrange(W), rng.randrange(H)
        tone = rng.choice([(255, 255, 255), (0, 0, 0)])
        d.point((x, y), fill=(*tone, rng.randint(4, 14)))
    grime(d, rng, W, H, 24, WALL_GRIME)
    cracks(d, rng, W, H, 2, grout)
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    # inner bevel: light top-left edges, dark bottom-right edges, then outline
    dd = ImageDraw.Draw(img, "RGBA")
    dd.line([(W // 2, 2), (2, H // 2)], fill=(255, 255, 255, 34), width=4)
    dd.line([(W // 2, 2), (W - 2, H // 2)], fill=(255, 255, 255, 22), width=4)
    dd.line([(2, H // 2), (W // 2, H - 2)], fill=(0, 0, 0, 60), width=4)
    dd.line([(W - 2, H // 2), (W // 2, H - 2)], fill=(0, 0, 0, 70), width=4)
    dd.polygon(
        [(W // 2, 1), (W - 2, H // 2), (W // 2, H - 2), (1, H // 2)],
        outline=(*grout, 255),
    )
    return img


def wall_section(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", (WALL_W, WALL_H), (0, 0, 0, 0))
    px = img.load()
    stripe_w = 32
    for x in range(WALL_W):
        top = x // 2  # base rise: 64px over 128 wide
        col = STRIPE_A if (x // stripe_w) % 2 == 0 else STRIPE_B
        for y in range(top, top + 384):
            # vertical tone falloff: darker near the floor line
            f = (y - top) / 384
            shade = 1.0 - 0.28 * f
            px[x, y] = (int(col[0] * shade), int(col[1] * shade), int(col[2] * shade), 255)
    d = ImageDraw.Draw(img, "RGBA")
    grime(d, rng, WALL_W, WALL_H, 40, WALL_GRIME, alpha=(6, 20))
    # a couple of small peeling patches low on the face
    for _ in range(2):
        x = rng.randrange(WALL_W - 18)
        y = rng.randint(320, 372)
        wpe, hpe = rng.randint(8, 16), rng.randint(5, 10)
        d.polygon([(x, y), (x + wpe, y + rng.randint(-2, 2)), (x + wpe - 2, y + hpe), (x + 2, y + hpe - 1)],
                  fill=(84, 72, 56, 180))
    # baseboard strip along the floor line (parallelogram-following)
    for x in range(WALL_W):
        top = x // 2
        for y in range(top + 384 - 26, top + 384):
            r, g, b, a = px[x, y]
            px[x, y] = BASEBOARD + (255,)
    # edge outlines along the slanted top and bottom
    for x in range(WALL_W):
        top = x // 2
        for t in range(3):
            px[x, min(top + t, WALL_H - 1)] = (*OUTLINE, 255)
            px[x, min(top + 384 - 1 - t, WALL_H - 1)] = (*OUTLINE, 255)
    for y in range(0, 384):
        for t in range(2):
            px[t, y] = (*OUTLINE, 255) if y >= 0 else px[t, y]
    for y in range(63, 448):
        for t in range(2):
            if y >= 64 // 2:
                px[WALL_W - 1 - t, min(y, WALL_H - 1)] = (*OUTLINE, 255) if y - 63 < 384 else px[WALL_W - 1 - t, min(y, WALL_H - 1)]
    return img


def street_tile(base, seed: int, curb: bool = False) -> Image.Image:
    """Sidewalk/asphalt diamond for the street strip along the cafe's front edge."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tex = Image.new("RGBA", (W, H), (*base, 255))
    d = ImageDraw.Draw(tex, "RGBA")
    for _ in range(1100):
        x, y = rng.randrange(W), rng.randrange(H)
        tone = rng.choice([(255, 255, 255), (0, 0, 0)])
        d.point((x, y), fill=(*tone, rng.randint(5, 16)))
    grime(d, rng, W, H, 30, (20, 18, 20), alpha=(8, 22))
    cracks(d, rng, W, H, 3, (30, 28, 30))
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    dd = ImageDraw.Draw(img, "RGBA")
    if curb:
        # light curb line along the NE edge (faces the cafe)
        dd.line([(W // 2, 4), (W - 4, H // 2)], fill=(200, 195, 185, 120), width=5)
    dd.polygon([(W // 2, 1), (W - 2, H // 2), (W // 2, H - 2), (1, H // 2)],
               outline=(28, 26, 30, 255))
    return img


def door_mat(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = floor_tile(MAT, (40, 12, 10), seed)
    d = ImageDraw.Draw(img, "RGBA")
    # stitched border diamond
    d.polygon([(W // 2, 14), (W - 26, H // 2), (W // 2, H - 14), (26, H // 2)],
              outline=(240, 220, 190, 160))
    grime(d, rng, W, H, 6, (10, 4, 4), alpha=(30, 70))
    return img


if __name__ == "__main__":
    floor_tile(CREAM, CREAM_GROUT, 11).save(OUT / "floor_01_a.png")
    floor_tile(CHAR, CHAR_GROUT, 22).save(OUT / "floor_01_b.png")
    wall_section(33).save(OUT / "wall_01.png")
    door_mat(44).save(OUT / "door_mat.png")
    street_tile((126, 122, 118), 55, curb=True).save(OUT / "sidewalk.png")
    street_tile((58, 58, 64), 66).save(OUT / "asphalt.png")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name:18s} {Image.open(f).size} {f.stat().st_size // 1024}KB")
