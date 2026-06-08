#!/usr/bin/env python3
"""Generate Undead Diner's original app icon & splash (no external assets)."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = (28, 19, 38)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def bg(size, top=(74, 54, 117), bot=(20, 16, 28)):
    img = Image.new('RGB', (size, size), top)
    px = img.load()
    for y in range(size):
        c = lerp(top, bot, y / max(1, size - 1))
        for x in range(size):
            px[x, y] = c
    return img


def rr(d, box, r, fill, outline=None, w=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)


def zombie(d, cx, cy, s):
    green, dark = (122, 199, 79), (54, 90, 42)
    rr(d, [cx - s, cy - s, cx + s, cy + s], int(s * 0.42), green, dark, max(2, int(s * 0.06)))
    ew = int(s * 0.30)
    for ex in (cx - int(s * 0.44), cx + int(s * 0.14)):
        d.ellipse([ex, cy - int(s * 0.32), ex + ew, cy - int(s * 0.32) + ew], fill=(245, 245, 245))
        pr = int(ew * 0.42)
        d.ellipse([ex + ew // 2 - pr // 2, cy - int(s * 0.32) + ew // 2 - pr // 2,
                   ex + ew // 2 + pr // 2, cy - int(s * 0.32) + ew // 2 + pr // 2], fill=(192, 57, 43))
    my = cy + int(s * 0.45)
    d.line([cx - int(s * 0.55), my, cx + int(s * 0.55), my], fill=dark, width=max(2, int(s * 0.07)))
    for i in range(-2, 3):
        x = cx + int(i * s * 0.22)
        d.line([x, my - int(s * 0.12), x, my + int(s * 0.12)], fill=dark, width=max(2, int(s * 0.05)))


def plate(d, cx, cy, s):
    d.ellipse([cx - s, cy - s * 0.55, cx + s, cy + s * 0.55], fill=(245, 246, 247), outline=(120, 120, 120), width=max(1, int(s * 0.06)))
    d.ellipse([cx - s * 0.45, cy - s * 0.28, cx + s * 0.45, cy + s * 0.28], fill=(210, 59, 46))


def make_icon(size):
    img = bg(size)
    d = ImageDraw.Draw(img)
    d.ellipse([size * 0.07, size * 0.06, size * 0.93, size * 0.9], outline=(255, 210, 74), width=max(2, int(size * 0.012)))
    zombie(d, int(size * 0.5), int(size * 0.42), int(size * 0.26))
    plate(d, int(size * 0.5), int(size * 0.74), int(size * 0.16))
    return img


def make_splash(size=2732):
    img = bg(size)
    d = ImageDraw.Draw(img)
    icon = make_icon(int(size * 0.34))
    img.paste(icon, (int(size * 0.33), int(size * 0.27)))
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(size * 0.05))
    except Exception:
        font = ImageFont.load_default()
    txt = 'UNDEAD DINER'
    tb = d.textbbox((0, 0), txt, font=font)
    d.text(((size - (tb[2] - tb[0])) / 2, size * 0.66), txt, font=font, fill=(122, 199, 79))
    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print('wrote', os.path.relpath(path, ROOT))


save(make_icon(1024), os.path.join(ROOT, 'assets', 'icon.png'))
save(make_splash(2732), os.path.join(ROOT, 'assets', 'splash.png'))
print('done')
