#!/usr/bin/env python3
"""
build_room_art.py — synthesize the modular room surfaces to EXACT canon geometry.

AI image models can't hit pixel-exact 2:1 diamonds or the 64x224 wall-section
parallelogram, so these are generated procedurally (seeded, reproducible) in the
authentic starter palette. Character/furniture sprites stay AI-generated.

Outputs (@2x for crisp zoom; the view scales by 0.5):
  public/art/room/floor_01_a.png  256x128  off-white tile diamond (warm)
  public/art/room/floor_01_b.png  256x128  off-white tile diamond (cool parity)
  public/art/room/wall_01.png     128x448  yellow-tinted panel + metal cap (right
                                           wall; left wall is flipX of this asset)
  public/art/room/door_mat.png    256x128  entrance mat diamond

Geometry (canon §1, @2x): tile 256x128; wall section canvas 128x448 — for column
x the filled rows run [x/2, 384 + x/2) (64px base rise + 384px wall height).
"""
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).parent.parent / "public" / "art" / "room"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 256, 128  # @2x tile
WALL_W, WALL_H = 128, 448  # @2x wall section

# Starter palette per ground truth (spec 92 §4): off-white square tiles with
# gray grout; walls are a white panel runtime-tinted yellow with a metallic cap.
TILE_A = (233, 231, 224)  # off-white tile, warm
TILE_B = (219, 218, 213)  # off-white tile, cool (subtle checker parity)
TILE_GROUT = (168, 165, 158)
OUTLINE = (20, 18, 24)
WALL_FACE = (228, 205, 128)  # white panel with the starter yellow tint
WALL_SEAM = (196, 172, 98)
WALL_CAP = (156, 160, 168)  # metallic top cap
WALL_GRIME = (110, 94, 62)
BASEBOARD = (58, 44, 32)
MAT = (96, 34, 30)


def diamond_mask(w: int, h: int) -> Image.Image:
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(w // 2, 0), (w - 1, h // 2), (w // 2, h - 1), (0, h // 2)], fill=255)
    return m


def blend_over(base: Image.Image, draw_fn) -> Image.Image:
    """Draw semi-transparent marks and alpha-composite them over `base`.

    PIL's ImageDraw REPLACES pixels on RGBA images (it never blends), so a
    "faint" alpha-8 stain drawn directly punches a see-through pinhole in the
    sprite — the night backdrop then reads as black pepper in-game. Marks go
    on a transparent overlay, clipped to base's silhouette, then composite.
    """
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(overlay))
    overlay.putalpha(ImageChops.multiply(overlay.getchannel("A"), base.getchannel("A")))
    return Image.alpha_composite(base, overlay)


def grime(draw: ImageDraw.ImageDraw, rng: random.Random, w: int, h: int, n: int, shade, alpha=(8, 20)):
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


def speckle(draw: ImageDraw.ImageDraw, rng: random.Random, w: int, h: int, n: int, tones, alpha=(10, 26)):
    """Per-pixel tone noise (true blend — subtle surface texture, not holes)."""
    for _ in range(n):
        x, y = rng.randrange(w), rng.randrange(h)
        draw.point((x, y), fill=(*rng.choice(tones), rng.randint(*alpha)))


def floor_tile(base, grout, seed: int) -> Image.Image:
    rng = random.Random(seed)
    tex = Image.new("RGBA", (W, H), (*base, 255))
    tex = blend_over(tex, lambda d: (
        speckle(d, rng, W, H, 900, [(255, 255, 255), (0, 0, 0)]),
        grime(d, rng, W, H, 9, WALL_GRIME, alpha=(10, 22)),
        cracks(d, rng, W, H, 1, grout),
    ))
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    # inner bevel: light top-left edges, dark bottom-right edges, then outline
    def edges(dd: ImageDraw.ImageDraw):
        dd.line([(W // 2, 2), (2, H // 2)], fill=(255, 255, 255, 34), width=4)
        dd.line([(W // 2, 2), (W - 2, H // 2)], fill=(255, 255, 255, 22), width=4)
        dd.line([(2, H // 2), (W // 2, H - 2)], fill=(0, 0, 0, 60), width=4)
        dd.line([(W - 2, H // 2), (W // 2, H - 2)], fill=(0, 0, 0, 70), width=4)
        dd.polygon([(W // 2, 1), (W - 2, H // 2), (W // 2, H - 2), (1, H // 2)],
                   outline=(*grout, 255))
    return blend_over(img, edges)


def wall_section(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", (WALL_W, WALL_H), (0, 0, 0, 0))
    px = img.load()
    for x in range(WALL_W):
        top = x // 2  # base rise: 64px over 128 wide
        for y in range(top, top + 384):
            # vertical tone falloff: darker near the floor line
            f = (y - top) / 384
            shade = 1.0 - 0.22 * f
            col = WALL_FACE
            px[x, y] = (int(col[0] * shade), int(col[1] * shade), int(col[2] * shade), 255)
    # panel seams: faint vertical joints every half-section
    for sx in (0, 64):
        for y in range(sx // 2, sx // 2 + 384):
            px[sx, min(y, WALL_H - 1)] = (*WALL_SEAM, 255)
    # metallic top cap following the slanted top edge
    for x in range(WALL_W):
        top = x // 2
        for y in range(top, top + 22):
            f = (y - top) / 22
            shade = 1.06 - 0.3 * f  # brushed-metal falloff
            px[x, y] = (int(WALL_CAP[0] * shade), int(WALL_CAP[1] * shade), int(WALL_CAP[2] * shade), 255)

    def wear(d: ImageDraw.ImageDraw):
        grime(d, rng, WALL_W, WALL_H, 14, WALL_GRIME, alpha=(10, 24))
        # a couple of small peeling patches low on the face
        for _ in range(2):
            x = rng.randrange(WALL_W - 18)
            y = rng.randint(320, 372)
            wpe, hpe = rng.randint(8, 16), rng.randint(5, 10)
            d.polygon([(x, y), (x + wpe, y + rng.randint(-2, 2)), (x + wpe - 2, y + hpe), (x + 2, y + hpe - 1)],
                      fill=(150, 128, 78, 150))
    img = blend_over(img, wear)

    px = img.load()
    # baseboard strip along the floor line (parallelogram-following)
    for x in range(WALL_W):
        top = x // 2
        for y in range(top + 384 - 26, top + 384):
            px[x, y] = BASEBOARD + (255,)
    # edge outlines along the slanted top and bottom
    for x in range(WALL_W):
        top = x // 2
        for t in range(3):
            px[x, min(top + t, WALL_H - 1)] = (*OUTLINE, 255)
            px[x, min(top + 384 - 1 - t, WALL_H - 1)] = (*OUTLINE, 255)
    for y in range(0, 384):
        for t in range(2):
            px[t, y] = (*OUTLINE, 255)
    for y in range(63, 448):
        for t in range(2):
            if y - 63 < 384:
                px[WALL_W - 1 - t, min(y, WALL_H - 1)] = (*OUTLINE, 255)
    return img


def street_tile(base, seed: int, curb: bool = False) -> Image.Image:
    """Sidewalk/asphalt diamond for the street strip behind the cafe."""
    rng = random.Random(seed)
    tex = Image.new("RGBA", (W, H), (*base, 255))
    tex = blend_over(tex, lambda d: (
        speckle(d, rng, W, H, 1100, [(255, 255, 255), (0, 0, 0)], alpha=(12, 30)),
        grime(d, rng, W, H, 24, (20, 18, 20), alpha=(12, 30)),
        cracks(d, rng, W, H, 3, (30, 28, 30)),
    ))
    tex = tex.filter(ImageFilter.GaussianBlur(0.4))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(tex, (0, 0), diamond_mask(W, H))

    def edges(dd: ImageDraw.ImageDraw):
        if curb:
            # light curb line along the NE edge (faces the cafe)
            dd.line([(W // 2, 4), (W - 4, H // 2)], fill=(200, 195, 185, 120), width=5)
        dd.polygon([(W // 2, 1), (W - 2, H // 2), (W // 2, H - 2), (1, H // 2)],
                   outline=(28, 26, 30, 255))
    return blend_over(img, edges)


def grass_tile(seed: int) -> Image.Image:
    """Front lawn (original: grass apron in front of the cafe, street behind)."""
    rng = random.Random(seed)
    tex = Image.new("RGBA", (W, H), (86, 118, 62, 255))

    def blades(d: ImageDraw.ImageDraw):
        speckle(d, rng, W, H, 1400, [(140, 176, 96), (60, 88, 44), (108, 140, 76)], alpha=(30, 90))
        # small grass tufts
        for _ in range(26):
            x, y = rng.randrange(8, W - 8), rng.randrange(6, H - 6)
            for b in range(3):
                d.line([x + b * 2 - 2, y, x + b * 2 - 3 + rng.randint(0, 2), y - rng.randint(3, 6)],
                       fill=(128, 164, 88, 200), width=1)
    tex = blend_over(tex, blades)
    tex = tex.filter(ImageFilter.GaussianBlur(0.3))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    return blend_over(img, lambda dd: dd.polygon(
        [(W // 2, 1), (W - 2, H // 2), (W // 2, H - 2), (1, H // 2)],
        outline=(40, 58, 32, 255)))


def road_stripe_tile(seed: int) -> Image.Image:
    """Asphalt with the original's yellow lane stripe running along the row axis."""
    img = street_tile((58, 58, 64), seed)

    def dashes(d: ImageDraw.ImageDraw):
        for x0 in range(24, W - 24, 40):
            d.line([(x0, H // 2), (min(x0 + 22, W - 24), H // 2)], fill=(214, 176, 60, 230), width=6)
    return blend_over(img, dashes)


def wall_door_section(seed: int) -> Image.Image:
    """A back-wall section with the doorway in it (the original's door is a wall item).

    The opening is a real transparent HOLE — entering customers and the street
    behind show through it instead of vanishing behind painted-on darkness.
    """
    img = wall_section(seed)
    # cut the doorway following the parallelogram (base rise x/2)
    for x in range(28, 100):
        top = x // 2
        arch = 210 if 40 <= x <= 88 else 230  # slight arch shape
        for y in range(top + arch, top + 384 - 4):
            img.putpixel((x, y), (0, 0, 0, 0))
    # door frame posts + lintel rim around the cut
    for x in (27, 28, 99, 100):
        top = x // 2
        for y in range(top + 205, top + 384 - 2):
            img.putpixel((x, y), (96, 66, 40, 255))
    for x in range(28, 100):
        top = x // 2
        arch = 210 if 40 <= x <= 88 else 230
        for t in range(4):
            img.putpixel((x, top + arch - 1 - t), (96, 66, 40, 255))
    # OPEN sign glow above the door
    d = ImageDraw.Draw(img)
    d.rectangle([48, 150, 82, 168], fill=(40, 80, 46, 255), outline=(126, 224, 129, 255))
    return img


def door_mat(seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = floor_tile(MAT, (40, 12, 10), seed)

    def stitches(d: ImageDraw.ImageDraw):
        d.polygon([(W // 2, 14), (W - 26, H // 2), (W // 2, H - 14), (26, H // 2)],
                  outline=(240, 220, 190, 160))
        grime(d, rng, W, H, 6, (10, 4, 4), alpha=(30, 70))
    return blend_over(img, stitches)


if __name__ == "__main__":
    floor_tile(TILE_A, TILE_GROUT, 11).save(OUT / "floor_01_a.png")
    floor_tile(TILE_B, TILE_GROUT, 22).save(OUT / "floor_01_b.png")
    wall_section(33).save(OUT / "wall_01.png")
    door_mat(44).save(OUT / "door_mat.png")
    street_tile((126, 122, 118), 55, curb=True).save(OUT / "sidewalk.png")
    street_tile((58, 58, 64), 66).save(OUT / "asphalt.png")
    grass_tile(77).save(OUT / "grass.png")
    road_stripe_tile(88).save(OUT / "road_stripe.png")
    wall_door_section(33).save(OUT / "wall_door.png")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name:18s} {Image.open(f).size} {f.stat().st_size // 1024}KB")
