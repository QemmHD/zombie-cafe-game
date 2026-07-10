#!/usr/bin/env python3
"""
optimize_art.py — trim + downscale Higgsfield art masters into web-ready assets.

Sprites: auto-trim transparent margins, downscale to a target height, save PNG.
Background: downscale to target width, flatten onto the room's dark tone, save JPG.
Run from project root after downloading masters into public/art/.
"""
from PIL import Image
from pathlib import Path

ART = Path(__file__).parent.parent / "public" / "art"


def trim_sprite(name_in: str, name_out: str, target_h: int):
    im = Image.open(ART / name_in).convert("RGBA")
    bbox = im.getbbox()  # bounding box of non-zero (non-transparent) region
    if bbox:
        im = im.crop(bbox)
    if im.height > target_h:
        w = round(im.width * target_h / im.height)
        im = im.resize((w, target_h), Image.LANCZOS)
    im.save(ART / name_out, optimize=True)
    print(f"  {name_out:22s} {im.width}x{im.height}  {(ART/name_out).stat().st_size//1024}KB")


def bg(name_in: str, name_out: str, target_w: int):
    im = Image.open(ART / name_in).convert("RGB")
    if im.width > target_w:
        h = round(im.height * target_w / im.width)
        im = im.resize((target_w, h), Image.LANCZOS)
    im.save(ART / name_out, quality=86, optimize=True)
    print(f"  {name_out:22s} {im.width}x{im.height}  {(ART/name_out).stat().st_size//1024}KB")


if __name__ == "__main__":
    print("Optimizing art assets:")
    bg("cafe_bg.png", "cafe_bg.jpg", 1600)
    trim_sprite("zombie_waiter.png", "zombie_waiter.png", 520)
    trim_sprite("customer.png", "customer.png", 520)
    trim_sprite("stove.png", "stove.png", 420)
    print("Done.")
