#!/usr/bin/env python3
"""Generate original Zombie Cafe app icons & splash (no external assets)."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def bg_gradient(size, top=(58, 40, 74), bot=(20, 16, 28)):
    img = Image.new('RGB', (size, size), top)
    px = img.load()
    for y in range(size):
        c = lerp(top, bot, y / max(1, size - 1))
        for x in range(size):
            px[x, y] = c
    return img


def rrect(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def draw_zombie(draw, cx, cy, s):
    """Draw a stylised zombie head centred at (cx,cy), scale s (head ~ 2*s wide)."""
    green = (108, 168, 79)
    dark = (44, 62, 31)
    # head
    rrect(draw, [cx - s, cy - s, cx + s, cy + s], int(s * 0.42), green, dark, max(2, int(s * 0.06)))
    # ear nub
    draw.rectangle([cx + s - int(s * 0.05), cy - int(s * 0.2), cx + s + int(s * 0.18), cy + int(s * 0.2)], fill=green, outline=dark, width=max(1, int(s * 0.04)))
    # eyes (white with red pupil)
    ew = int(s * 0.30)
    for ex in (cx - int(s * 0.42), cx + int(s * 0.12)):
        draw.ellipse([ex, cy - int(s * 0.34), ex + ew, cy - int(s * 0.34) + ew], fill=(245, 245, 245))
        pr = int(ew * 0.42)
        draw.ellipse([ex + ew // 2 - pr // 2, cy - int(s * 0.34) + ew // 2 - pr // 2,
                      ex + ew // 2 + pr // 2, cy - int(s * 0.34) + ew // 2 + pr // 2], fill=(192, 57, 43))
    # stitched mouth
    my = cy + int(s * 0.45)
    draw.line([cx - int(s * 0.55), my, cx + int(s * 0.55), my], fill=dark, width=max(2, int(s * 0.07)))
    for i in range(-2, 3):
        x = cx + int(i * s * 0.22)
        draw.line([x, my - int(s * 0.12), x, my + int(s * 0.12)], fill=dark, width=max(2, int(s * 0.05)))


def make_icon(size):
    img = bg_gradient(size)
    d = ImageDraw.Draw(img)
    # subtle vignette ring
    d.ellipse([size * 0.08, size * 0.06, size * 0.92, size * 0.9], outline=(241, 196, 15), width=max(2, int(size * 0.012)))
    draw_zombie(d, int(size * 0.5), int(size * 0.44), int(size * 0.27))
    # little coffee cup
    cw = int(size * 0.16)
    cx, cy = int(size * 0.5 - cw / 2), int(size * 0.72)
    rrect(d, [cx, cy, cx + cw, cy + int(cw * 0.8)], int(cw * 0.18), (236, 240, 241), (120, 120, 120), max(1, int(size * 0.006)))
    d.arc([cx + cw - int(cw * 0.1), cy + int(cw * 0.1), cx + cw + int(cw * 0.45), cy + int(cw * 0.65)], -90, 90, fill=(120, 120, 120), width=max(2, int(size * 0.01)))
    # steam
    for sx in (cx + int(cw * 0.3), cx + int(cw * 0.6)):
        d.line([sx, cy - int(cw * 0.3), sx, cy - int(cw * 0.05)], fill=(200, 210, 220), width=max(2, int(size * 0.008)))
    return img


def make_splash(size=2732):
    img = bg_gradient(size)
    d = ImageDraw.Draw(img)
    icon = make_icon(int(size * 0.34))
    img.paste(icon, (int(size * 0.33), int(size * 0.28)))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.05))
    except Exception:
        font = ImageFont.load_default()
    txt = "ZOMBIE CAFE"
    tb = d.textbbox((0, 0), txt, font=font)
    d.text(((size - (tb[2] - tb[0])) / 2, size * 0.66), txt, font=font, fill=(108, 168, 79))
    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print('wrote', os.path.relpath(path, ROOT))


# Capacitor source assets (used by @capacitor/assets at build time)
save(make_icon(1024), os.path.join(ROOT, 'assets', 'icon.png'))
save(make_splash(2732), os.path.join(ROOT, 'assets', 'splash.png'))
# PWA / web icons
save(make_icon(192), os.path.join(ROOT, 'icons', 'icon-192.png'))
save(make_icon(512), os.path.join(ROOT, 'icons', 'icon-512.png'))
save(make_icon(180), os.path.join(ROOT, 'icons', 'apple-touch-icon.png'))
print('done')
