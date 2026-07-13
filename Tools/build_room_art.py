#!/usr/bin/env python3
"""
build_room_art.py — synthesize the room surfaces to EXACT canon geometry, in
the ORIGINAL's measured art direction (spec 95 / decoded-bundle research):

  - projection 1.56:1 (IsoConfig 84x54 per cell; art @2x = 168x108)
  - floor: cream-white tile, each cell showing a 2x2 sub-tile pattern with
    thin grout and soft bevels (measured #cccccc..#e0e0e0 family)
  - walls: WHITE panels, tinted at runtime by the game (the original's own
    technique — starter cafe tints them lemon yellow)
  - outdoors: flat cel grass / sidewalk+curb / asphalt / yellow street stripe
    with colors sampled from the original's tile strip
  - clean surfaces — grime is placeable DECAL content, never baked-in noise

Geometry must mirror src/engine/IsoConfig.ts (HALF_W/HALF_H/WALL_H below).
"""
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).parent.parent / "public" / "art" / "room"
OUT.mkdir(parents=True, exist_ok=True)

# ── canon geometry (mirror of src/engine/IsoConfig.ts), art authored @2x ──────
HALF_W, HALF_H, WALL_H = 42, 27, 160
S = 2  # art scale
W, H = HALF_W * 2 * S, HALF_H * 2 * S  # 168 x 108 tile canvas
WALL_W = HALF_W * S  # 84 — one section per tile edge
WALL_FACE = WALL_H * S  # 320
WALL_CANVAS_H = (HALF_H + WALL_H) * S  # 374: base rise + face
RISE = HALF_H / HALF_W  # slope of the wall base line

# ── palette measured from the decoded original (spec 95) ─────────────────────
FLOOR_BASE = (214, 214, 212)
FLOOR_HI = (228, 228, 226)
FLOOR_SHADE = (184, 184, 182)
GROUT = (168, 168, 166)
OUTLINE = (120, 120, 122)
WALL_WHITE = (244, 244, 242)  # tinted in-engine (starter: lemon yellow)
WALL_SEAM = (226, 226, 224)
GRASS = (85, 119, 34)
GRASS_DARK = (65, 81, 40)
GRASS_LIGHT = (105, 140, 37)
SIDEWALK = (204, 204, 203)
SIDEWALK_SHADE = (187, 187, 187)
CURB = (101, 101, 103)
ASPHALT = (136, 136, 136)
ASPHALT_SPECK = (153, 153, 153)
STRIPE = (194, 176, 100)
DOOR_FRAME = (70, 80, 91)
DOOR_LEAF = (121, 145, 161)


def diamond_mask(w: int, h: int) -> Image.Image:
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(w // 2, 0), (w - 1, h // 2), (w // 2, h - 1), (0, h // 2)], fill=255)
    return m


def blend_over(base: Image.Image, draw_fn) -> Image.Image:
    """Alpha-composite semi-transparent marks (PIL ImageDraw replaces pixels on
    RGBA images; drawing faint marks directly punches holes in the sprite)."""
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(overlay))
    overlay.putalpha(ImageChops.multiply(overlay.getchannel("A"), base.getchannel("A")))
    return Image.alpha_composite(base, overlay)


def _subtile_centers():
    """The four sub-diamond centers of a cell's 2x2 pattern: a diamond splits
    into four congruent diamonds at N/E/S/W of its center (not the corners)."""
    cx, cy = W // 2, H // 2
    qx, qy = W // 4, H // 4
    return [(cx, cy - qy), (cx + qx, cy), (cx, cy + qy), (cx - qx, cy)]


def floor_tile(seed: int) -> Image.Image:
    """Cream-white cafe tile: one cell = 2x2 sub-tiles, thin grout, soft bevel."""
    rng = random.Random(seed)
    tex = Image.new("RGBA", (W, H), (*GROUT, 255))
    d = ImageDraw.Draw(tex)
    qw, qh = W // 4, H // 4
    g = 2  # grout gap @2x
    for (cx, cy) in _subtile_centers():
        # sub-diamond, inset by the grout gap
        pts = [(cx, cy - qh + g), (cx + qw - g * 2, cy), (cx, cy + qh - g), (cx - qw + g * 2, cy)]
        tone = rng.randint(-3, 3)
        base = tuple(min(255, c + tone) for c in FLOOR_BASE)
        d.polygon(pts, fill=(*base, 255))
        # bevel: light top-left edges, shade bottom-right edges
        d.line([pts[3], pts[0]], fill=(*FLOOR_HI, 255), width=2)
        d.line([pts[0], pts[1]], fill=(*FLOOR_HI, 255), width=1)
        d.line([pts[1], pts[2]], fill=(*FLOOR_SHADE, 255), width=2)
        d.line([pts[2], pts[3]], fill=(*FLOOR_SHADE, 255), width=2)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    return blend_over(img, lambda dd: dd.polygon(
        [(W // 2, 0), (W - 1, H // 2), (W // 2, H - 1), (0, H // 2)],
        outline=(*OUTLINE, 140)))


def wall_section(seed: int) -> Image.Image:
    """WHITE wall panel (runtime-tinted): flat face, soft vertical falloff,
    hairline seam between sections, slim baseboard, thin top edge."""
    img = Image.new("RGBA", (WALL_W, WALL_CANVAS_H), (0, 0, 0, 0))
    px = img.load()
    for x in range(WALL_W):
        top = round(x * RISE)
        for y in range(top, top + WALL_FACE):
            f = (y - top) / WALL_FACE
            shade = 1.0 - 0.10 * f  # gentle darkening toward the floor
            px[x, y] = (
                int(WALL_WHITE[0] * shade),
                int(WALL_WHITE[1] * shade),
                int(WALL_WHITE[2] * shade),
                255,
            )
    # hairline seam on the left edge of each section
    for y0 in range(WALL_FACE):
        px[0, min(y0, WALL_CANVAS_H - 1)] = (*WALL_SEAM, 255)
    # slim baseboard (slightly darker warm strip)
    for x in range(WALL_W):
        top = round(x * RISE)
        for y in range(top + WALL_FACE - 14, top + WALL_FACE):
            px[x, min(y, WALL_CANVAS_H - 1)] = (216, 214, 205, 255)
    # thin dark line along the slanted top edge + bottom edge
    for x in range(WALL_W):
        top = round(x * RISE)
        for t in range(3):
            px[x, min(top + t, WALL_CANVAS_H - 1)] = (108, 106, 100, 255)
        px[x, min(top + WALL_FACE - 1, WALL_CANVAS_H - 1)] = (140, 138, 132, 255)
    return img


def wall_door_section(seed: int) -> Image.Image:
    """Back-wall section with the doorway: a transparent opening (street shows
    through) framed in slate blue with the door leaf swung inward — the
    original's bright blue cafe door."""
    img = wall_section(seed)
    x0, x1 = 10, WALL_W - 10
    top_of = lambda x: round(x * RISE)
    # cut the opening
    for x in range(x0, x1):
        arch = 96 if x0 + 8 <= x <= x1 - 8 else 110
        for y in range(top_of(x) + arch, top_of(x) + WALL_FACE - 4):
            img.putpixel((x, y), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # frame posts + lintel
    for x in (x0 - 2, x0 - 1, x1, x1 + 1):
        t = top_of(x)
        for y in range(t + 92, t + WALL_FACE - 2):
            img.putpixel((x, y), (*DOOR_FRAME, 255))
    for x in range(x0 - 2, x1 + 2):
        t = top_of(x)
        arch = 96 if x0 + 8 <= x <= x1 - 8 else 110
        for k in range(5):
            img.putpixel((x, t + arch - 1 - k), (*DOOR_FRAME, 255))
    # door leaf swung open against the inside of the frame (left half)
    leaf_w = (x1 - x0) // 2
    for x in range(x0, x0 + leaf_w):
        t = top_of(x)
        arch = 98 if x0 + 8 <= x <= x1 - 8 else 112
        for y in range(t + arch, t + WALL_FACE - 6):
            f = (x - x0) / leaf_w
            c = tuple(int(DOOR_LEAF[i] * (1 - 0.18 * f)) for i in range(3))
            img.putpixel((x, y), (*c, 255))
    # leaf edge + tiny window
    t0 = top_of(x0 + leaf_w)
    for y in range(t0 + 98, t0 + WALL_FACE - 6):
        img.putpixel((x0 + leaf_w - 1, y), (*DOOR_FRAME, 255))
    d.rectangle([x0 + 8, top_of(x0 + 8) + 118, x0 + leaf_w - 8, top_of(x0 + 8) + 158],
                fill=(228, 238, 244, 255), outline=(*DOOR_FRAME, 255))
    return img


def _flat_tile(base, seed: int) -> Image.Image:
    rng = random.Random(seed)
    tex = Image.new("RGBA", (W, H), (*base, 255))
    d = ImageDraw.Draw(tex)
    for _ in range(140):  # gentle flat-cel speckle, fully opaque (no holes)
        x, y = rng.randrange(W), rng.randrange(H)
        tone = rng.choice([-8, -5, 5, 8])
        c = tuple(max(0, min(255, v + tone)) for v in base)
        d.point((x, y), fill=(*c, 255))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    return img


def grass_tile(seed: int) -> Image.Image:
    """The original's lawn: flat green with darker clump shapes + light blades."""
    rng = random.Random(seed)
    img = _flat_tile(GRASS, seed)
    def clumps(d: ImageDraw.ImageDraw):
        for _ in range(10):
            cx, cy = rng.randrange(20, W - 20), rng.randrange(12, H - 12)
            r = rng.randint(6, 14)
            d.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=(*GRASS_DARK, 120))
        for _ in range(26):
            x, y = rng.randrange(10, W - 10), rng.randrange(8, H - 8)
            for b in range(3):
                d.line([x + b * 3 - 3, y, x + b * 3 - 4 + rng.randint(0, 2), y - rng.randint(4, 8)],
                       fill=(*GRASS_LIGHT, 255), width=2)
    return blend_over(img, clumps)


def sidewalk_tile(seed: int) -> Image.Image:
    """Concrete slab with the curb along the NE edge (faces the cafe)."""
    img = _flat_tile(SIDEWALK, seed)
    def edges(d: ImageDraw.ImageDraw):
        # inner shading band lower-right
        d.line([(W - 4, H // 2), (W // 2, H - 3)], fill=(*SIDEWALK_SHADE, 255), width=6)
        # curb: dark edge along NE (top-right) edge
        d.line([(W // 2, 2), (W - 3, H // 2)], fill=(*CURB, 255), width=7)
        d.line([(W // 2, 8), (W - 8, H // 2 + 2)], fill=(*SIDEWALK_SHADE, 255), width=3)
        d.polygon([(W // 2, 0), (W - 1, H // 2), (W // 2, H - 1), (0, H // 2)], outline=(*CURB, 90))
    return blend_over(img, edges)


def asphalt_tile(seed: int, stripe: bool = False) -> Image.Image:
    rng = random.Random(seed)
    img = _flat_tile(ASPHALT, seed)
    def marks(d: ImageDraw.ImageDraw):
        for _ in range(30):
            x, y = rng.randrange(6, W - 6), rng.randrange(4, H - 4)
            d.point((x, y), fill=(*ASPHALT_SPECK, 255))
        if stripe:
            # solid yellow curb-line along the NE edge (measured placement)
            d.line([(W // 2 + 4, 6), (W - 6, H // 2 + 2)], fill=(*STRIPE, 255), width=9)
    return blend_over(img, marks)


if __name__ == "__main__":
    floor_tile(11).save(OUT / "floor_01_a.png")
    floor_tile(22).save(OUT / "floor_01_b.png")
    wall_section(33).save(OUT / "wall_01.png")
    wall_door_section(33).save(OUT / "wall_door.png")
    grass_tile(77).save(OUT / "grass.png")
    sidewalk_tile(55).save(OUT / "sidewalk.png")
    asphalt_tile(66).save(OUT / "asphalt.png")
    asphalt_tile(88, stripe=True).save(OUT / "road_stripe.png")
    # door_mat retired: the original has no mat — keep a transparent stub so
    # stale caches can't 404 (nothing renders it anymore).
    Image.new("RGBA", (2, 2), (0, 0, 0, 0)).save(OUT / "door_mat.png")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name:18s} {Image.open(f).size} {f.stat().st_size // 1024}KB")
