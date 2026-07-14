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
FLOOR_BASE = (204, 204, 204)  # audit-measured: uniform #CCCCCC, no checkerboard
FLOOR_HI = (222, 222, 222)
FLOOR_SHADE = (178, 178, 178)  # grout shoulders
GROUT = (108, 108, 108)  # strong dark grout core (~50% darker than the fill)
OUTLINE = (120, 120, 122)
WALL_WHITE = (244, 244, 242)  # tinted in-engine (starter: lemon yellow)
WALL_SEAM = (226, 226, 224)
GRASS = (74, 102, 27)  # split of the two measured references (#557722 / #425C15)
GRASS_DARK = (55, 76, 19)
GRASS_LIGHT = (98, 130, 40)
DIRT = (109, 104, 66)  # worn lawn patches (the original's lot is scruffy)
MOSS = (104, 122, 48)  # swamp-olive grime, matched to the original's dirty cafe
MOSS_DARK = (78, 92, 38)
MOSS_LIGHT = (134, 152, 62)
SIDEWALK = (138, 138, 138)  # concrete — must NOT read as the interior floor
SIDEWALK_SHADE = (124, 124, 124)
CURB = (92, 92, 95)
ASPHALT = (136, 136, 136)
ASPHALT_SPECK = (153, 153, 153)
STRIPE = (194, 176, 100)
DOOR_FRAME = (168, 164, 158)  # light warm-gray frame — pops off the mustard wall
DOOR_LEAF = (42, 46, 50)  # charcoal leaf
DOOR_PANE = (110, 156, 200)  # steel-blue glass
DOOR_SIGN = (140, 24, 20)  # the hanging red sign


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
    """White ceramic cafe tile: one cell = 2x2 sub-tiles with STRONG dark
    grout (the audit measured the original's grout ~50% darker than the fill)
    plus light shoulders and per-pixel speckle."""
    rng = random.Random(seed)
    tex = Image.new("RGBA", (W, H), (*GROUT, 255))
    d = ImageDraw.Draw(tex)
    qw, qh = W // 4, H // 4
    g = 2  # grout gap @2x
    for (cx, cy) in _subtile_centers():
        # sub-diamond, inset by the grout gap
        pts = [(cx, cy - qh + g), (cx + qw - g * 2, cy), (cx, cy + qh - g), (cx - qw + g * 2, cy)]
        d.polygon(pts, fill=(*FLOOR_BASE, 255))
        # light grout shoulders all around (measured profile: shoulder-core-shoulder)
        d.line([pts[3], pts[0]], fill=(*FLOOR_HI, 255), width=2)
        d.line([pts[0], pts[1]], fill=(*FLOOR_HI, 255), width=1)
        d.line([pts[1], pts[2]], fill=(*FLOOR_SHADE, 255), width=2)
        d.line([pts[2], pts[3]], fill=(*FLOOR_SHADE, 255), width=2)
        # ceramic speckle: the original's fill is never mathematically flat
        for _ in range(90):
            x = cx + rng.randint(-qw + 6, qw - 6)
            y = cy + rng.randint(-qh + 4, qh - 4)
            tone = rng.choice([-4, -3, 3, 4])
            c = tuple(max(0, min(255, v + tone)) for v in FLOOR_BASE)
            d.point((x, y), fill=(*c, 255))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(tex, (0, 0), diamond_mask(W, H))
    return img  # no per-cell outline — the original's floor reads continuous


def wall_section(seed: int) -> Image.Image:
    """WHITE wall panel (runtime-tinted): flat face, soft vertical falloff,
    hairline seam between sections, slim baseboard, thin top edge."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (WALL_W, WALL_CANVAS_H), (0, 0, 0, 0))
    px = img.load()
    # subtle vertical streak bands (the original's walls look hand-painted)
    streaks = []
    x0 = 0
    while x0 < WALL_W:
        w_ = rng.randint(4, 9)
        streaks.extend([rng.randint(-5, 5)] * w_)
        x0 += w_
    for x in range(WALL_W):
        top = round(x * RISE)
        band = streaks[x] if x < len(streaks) else 0
        for y in range(top, top + WALL_FACE):
            f = (y - top) / WALL_FACE
            shade = 1.0 - 0.10 * f  # gentle darkening toward the floor
            px[x, y] = (
                max(0, min(255, int(WALL_WHITE[0] * shade) + band)),
                max(0, min(255, int(WALL_WHITE[1] * shade) + band)),
                max(0, min(255, int(WALL_WHITE[2] * shade) + band)),
                255,
            )
    # aged-plaster mottle: soft blotches + fine speckle, monochrome so the
    # runtime tint still owns the hue (the original's plaster swings +-30
    # levels even where "clean"; a bit-identical vector fill reads sterile)
    def mottle(d: ImageDraw.ImageDraw):
        mrng = random.Random(seed * 31 + 7)
        for _ in range(14):
            cx = mrng.randint(0, WALL_W)
            cy = mrng.randint(20, WALL_CANVAS_H - 20)
            rx, ry = mrng.randint(10, 30), mrng.randint(14, 44)
            tone = mrng.choice([(0, 0, 0, 11), (255, 255, 255, 13)])
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=tone)
        for _ in range(420):
            x, y = mrng.randrange(WALL_W), mrng.randrange(WALL_CANVAS_H)
            d.point((x, y), fill=mrng.choice([(0, 0, 0, 22), (255, 255, 255, 26)]))
    img = blend_over(img, mottle)
    px = img.load()
    # hairline seam on the left edge of each section
    for y0 in range(WALL_FACE):
        px[0, min(y0, WALL_CANVAS_H - 1)] = (*WALL_SEAM, 255)
    # slim baseboard (slightly darker warm strip)
    for x in range(WALL_W):
        top = round(x * RISE)
        for y in range(top + WALL_FACE - 14, top + WALL_FACE):
            px[x, min(y, WALL_CANVAS_H - 1)] = (216, 214, 205, 255)
    # top silhouette: 2px dark contour + a light band beneath (the original
    # inks its rooflines; ours vanished into the sky)
    for x in range(WALL_W):
        top = round(x * RISE)
        for t in range(4):
            px[x, min(top + t, WALL_CANVAS_H - 1)] = (92, 88, 66, 255)
        for t in range(4, 8):
            px[x, min(top + t, WALL_CANVAS_H - 1)] = (252, 252, 246, 255)
        px[x, min(top + WALL_FACE - 1, WALL_CANVAS_H - 1)] = (140, 138, 132, 255)
    return img


DOOR_X0, DOOR_X1 = 8, WALL_W - 8  # opening span within the section
DOOR_TOP = 58  # opening starts this far below the top edge (~80% wall height)


def wall_door_section(seed: int) -> Image.Image:
    """Back-wall section with the doorway CUT OUT (street shows through).
    The frame/leaf art lives in door_overlay() and renders UNTINTED on top —
    baking it here would get multiplied by the runtime wall tint and turn the
    steel-blue door olive (exactly the camouflage the audit flagged)."""
    img = wall_section(seed)
    top_of = lambda x: round(x * RISE)
    for x in range(DOOR_X0, DOOR_X1):
        for y in range(top_of(x) + DOOR_TOP, top_of(x) + WALL_FACE - 4):
            img.putpixel((x, y), (0, 0, 0, 0))
    return img


def door_overlay(seed: int) -> Image.Image:
    """The cafe door as its own sprite (same canvas as a wall section):
    light warm-gray frame, charcoal leaf with a 2x3 grid of steel-blue window
    panes, dark-red hanging sign — the original's high-contrast focal door."""
    img = Image.new("RGBA", (WALL_W, WALL_CANVAS_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top_of = lambda x: round(x * RISE)
    x0, x1 = DOOR_X0, DOOR_X1
    # frame posts (4px) + lintel (6px), skewed to the wall slope
    for x in range(x0 - 4, x0):
        t = top_of(x)
        d.line([(x, t + DOOR_TOP - 6), (x, t + WALL_FACE - 2)], fill=(*DOOR_FRAME, 255))
    for x in range(x1, x1 + 4):
        t = top_of(x)
        d.line([(x, t + DOOR_TOP - 6), (x, t + WALL_FACE - 2)], fill=(*DOOR_FRAME, 255))
    for x in range(x0 - 4, x1 + 4):
        t = top_of(x)
        for k in range(6):
            d.point((x, t + DOOR_TOP - 6 + k), fill=(*DOOR_FRAME, 255))
    # charcoal leaf swung against the left 58% of the opening; the rest stays
    # open so arriving customers appear through the doorway
    leaf_w = int((x1 - x0) * 0.58)
    for x in range(x0, x0 + leaf_w):
        t = top_of(x)
        d.line([(x, t + DOOR_TOP), (x, t + WALL_FACE - 5)], fill=(*DOOR_LEAF, 255))
    # 2x3 steel-blue panes in the leaf's upper half
    pane_w = (leaf_w - 18) // 2
    for col in range(2):
        for row in range(3):
            px0 = x0 + 6 + col * (pane_w + 6)
            t = top_of(px0)
            py0 = t + DOOR_TOP + 12 + row * 32
            d.rectangle([px0, py0, px0 + pane_w, py0 + 24], fill=(*DOOR_PANE, 255),
                        outline=(20, 22, 24, 255))
    # dark-red hanging sign with a light border, low on the leaf
    sx = x0 + 8
    sy = top_of(sx) + DOOR_TOP + 118
    d.rectangle([sx, sy, sx + leaf_w - 20, sy + 26], fill=(*DOOR_SIGN, 255),
                outline=(236, 232, 224, 255), width=2)
    # leaf edge line
    t0 = top_of(x0 + leaf_w)
    d.line([(x0 + leaf_w - 1, t0 + DOOR_TOP), (x0 + leaf_w - 1, t0 + WALL_FACE - 5)],
           fill=(18, 20, 22, 255))
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
        for _ in range(2):  # scruffy worn patches — the original's lot is tired
            cx, cy = rng.randrange(20, W - 20), rng.randrange(12, H - 12)
            r = rng.randint(7, 12)
            d.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=(*DIRT, 45))
        # dense hand-drawn blade strokes edge to edge — the reference turf has
        # value activity EVERYWHERE, never runs of flat base color
        for _ in range(70):
            x, y = rng.randrange(4, W - 4), rng.randrange(3, H - 3)
            tone = rng.choice([GRASS_DARK, GRASS_DARK, GRASS_LIGHT])
            d.line([x, y, x + rng.randint(-2, 2), y - rng.randint(3, 7)],
                   fill=(*tone, 150), width=2)
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
            # SOLID center stripe running along the +tx axis THROUGH the tile
            # (edge midpoint to edge midpoint) so adjacent road tiles chain a
            # continuous line — a stripe on the NE edge can never connect
            # across diamonds, which is why the old one read as dashes.
            d.line([(W // 4, H // 4), (3 * W // 4, 3 * H // 4)], fill=(*STRIPE, 255), width=10)
    return blend_over(img, marks)


def corner_seam() -> Image.Image:
    """Dark vertical crease for the wall corner fold — near-black ochre alpha
    gradient, widest at the center (the measured original's corner seam)."""
    CW = 20  # @2x
    img = Image.new("RGBA", (CW, WALL_FACE), (0, 0, 0, 0))
    px = img.load()
    for x in range(CW):
        a = int(105 * (1 - abs(x - CW / 2) / (CW / 2)) ** 1.4)
        for y in range(WALL_FACE):
            px[x, y] = (44, 40, 12, a)
    return img


def ao_strip() -> Image.Image:
    """Soft contact shadow cast by a wall onto the floor: a parallelogram
    following the wall base slope, fading downward. Grounds the room box."""
    FADE = 34
    img = Image.new("RGBA", (WALL_W, round(WALL_W * RISE) + FADE), (0, 0, 0, 0))
    px = img.load()
    for x in range(WALL_W):
        base = x * RISE
        for k in range(FADE):
            y = round(base) + k
            if y >= img.size[1]:
                break
            a = int(70 * (1 - k / FADE) ** 1.6)
            px[x, y] = (24, 24, 26, a)
    return img


def decal_stain(seed: int) -> Image.Image:
    """Dried olive smear — removable floor grime (the original's grime is all
    swamp-green, never coffee-brown)."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (96, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(8):
        cx, cy = rng.randint(22, 74), rng.randint(18, 40)
        rx, ry = rng.randint(11, 24), rng.randint(4, 9)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(*MOSS_DARK, 205))
    for _ in range(7):
        cx, cy = rng.randint(8, 88), rng.randint(10, 48)
        r = rng.randint(2, 4)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*MOSS_DARK, 205))
    return img


def decal_slime(seed: int) -> Image.Image:
    """Wet moss puddle — the kitchen has a leak somewhere."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (96, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(6):
        cx, cy = rng.randint(24, 72), rng.randint(16, 40)
        rx, ry = rng.randint(12, 22), rng.randint(6, 11)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(*MOSS, 235))
    d.ellipse([34, 18, 50, 26], fill=(*MOSS_LIGHT, 225))  # wet highlight
    d.ellipse([58, 30, 67, 35], fill=(*MOSS_LIGHT, 225))
    return img


def decal_rat(seed: int) -> Image.Image:
    """THE rat (the original's most famous floor decal), facing left."""
    img = Image.new("RGBA", (72, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    O = (60, 56, 60, 255)
    BODY = (134, 130, 134, 255)
    d.ellipse([16, 14, 52, 34], fill=BODY, outline=O, width=2)  # body
    d.ellipse([8, 16, 26, 32], fill=BODY, outline=O, width=2)  # head
    d.ellipse([16, 10, 26, 20], fill=BODY, outline=O, width=2)  # ear
    d.ellipse([18, 13, 23, 17], fill=(196, 150, 160, 255))  # inner ear
    d.arc([46, 8, 70, 32], 200, 340, fill=O, width=3)  # tail
    d.ellipse([9, 22, 13, 26], fill=(20, 18, 20, 255))  # eye
    d.polygon([(8, 26), (4, 27), (8, 29)], fill=(230, 160, 170, 255))  # nose
    for x0 in (24, 34, 44):  # feet nubs
        d.ellipse([x0, 31, x0 + 6, 37], fill=BODY, outline=O, width=1)
    return img


def decal_boards(seed: int) -> Image.Image:
    """Nailed-up planks — wall grime. The original nails them CROOKED —
    two opposing steep slants, never parallel shelving."""
    img = Image.new("RGBA", (84, 84), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    PLANK = (196, 160, 108, 255)
    EDGE = (120, 92, 56, 255)
    d.polygon([(4, 40), (72, 6), (78, 16), (10, 50)], fill=PLANK, outline=EDGE)
    d.polygon([(8, 44), (76, 70), (72, 80), (4, 54)], fill=PLANK, outline=EDGE)
    for (nx, ny) in [(10, 42), (68, 10), (12, 48), (68, 70)]:
        d.ellipse([nx, ny, nx + 4, ny + 4], fill=(70, 66, 70, 255))
    return img


def decal_drip(seed: int) -> Image.Image:
    """Moss creeping down from the wall's top edge — small and organic, like
    the original's corner moss, not a curtain of goo."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (46, 62), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    G = (*MOSS, 232)
    d.rectangle([2, 0, 44, 7], fill=G)
    x = 4
    while x < 42:
        w_ = rng.randint(4, 7)
        ln = rng.randint(12, 48)
        d.rounded_rectangle([x, 0, x + w_, ln], radius=w_ // 2, fill=G)
        d.ellipse([x, ln - w_, x + w_, ln], fill=G)
        x += w_ + rng.randint(2, 5)
    d.rectangle([6, 2, 10, 20], fill=(*MOSS_LIGHT, 190))
    return img


if __name__ == "__main__":
    floor_tile(11).save(OUT / "floor_01_a.png")
    floor_tile(22).save(OUT / "floor_01_b.png")
    wall_section(33).save(OUT / "wall_01.png")
    wall_door_section(33).save(OUT / "wall_door.png")
    door_overlay(33).save(OUT / "door_overlay.png")
    corner_seam().save(OUT / "corner_seam.png")
    grass_tile(77).save(OUT / "grass.png")
    sidewalk_tile(55).save(OUT / "sidewalk.png")
    asphalt_tile(66).save(OUT / "asphalt.png")
    asphalt_tile(88, stripe=True).save(OUT / "road_stripe.png")
    # Removable grime decals (the original's cleaning loop — spec 95)
    ao_strip().save(OUT / "ao_strip.png")
    decal_stain(7).save(OUT / "decal_stain.png")
    decal_slime(9).save(OUT / "decal_slime.png")
    decal_rat(1).save(OUT / "decal_rat.png")
    decal_boards(3).save(OUT / "decal_boards.png")
    decal_drip(5).save(OUT / "decal_drip.png")
    # door_mat retired: the original has no mat — keep a transparent stub so
    # stale caches can't 404 (nothing renders it anymore).
    Image.new("RGBA", (2, 2), (0, 0, 0, 0)).save(OUT / "door_mat.png")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name:18s} {Image.open(f).size} {f.stat().st_size // 1024}KB")
