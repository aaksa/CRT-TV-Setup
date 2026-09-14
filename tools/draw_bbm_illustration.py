#!/usr/bin/env python3
"""Placeholder illustration for the "Krisis BBM Makassar" card:
a dusk queue of motorbikes and cars at an SPBU, taillights glowing.

    python3 tools/draw_bbm_illustration.py
    -> public/images/news/krisis-bbm-makassar-2026.jpg   (1448 x 1086, like the other news images)

Replace the JPEG with a real or generated photo of the same name at any time.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1448, 1086
HORIZON = 520
OUT = Path(__file__).resolve().parent.parent / 'public' / 'images' / 'news' / 'krisis-bbm-makassar-2026.jpg'
rnd = random.Random(2026)


def lerp(a, b, k):
    return tuple(int(x + (y - x) * k) for x, y in zip(a, b))


def main():
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for y in range(HORIZON + 40):  # dusk sky
        k = y / (HORIZON + 40)
        d.line([(0, y), (W, y)], fill=lerp((28, 36, 64), (214, 128, 78), k ** 1.6))
    for y in range(HORIZON, H):  # asphalt
        k = (y - HORIZON) / (H - HORIZON)
        d.line([(0, y), (W, y)], fill=lerp((70, 62, 64), (34, 32, 34), k))

    # skyline: shophouses, palms, power poles and lines
    x = 0
    while x < W:
        bw, bh = rnd.randint(60, 150), rnd.randint(40, 150)
        d.rectangle([x, HORIZON - bh, x + bw, HORIZON + 6], fill=(24, 22, 30))
        for wy in range(HORIZON - bh + 14, HORIZON - 10, 26):
            for wx in range(x + 10, x + bw - 14, 24):
                if rnd.random() < 0.3:
                    d.rectangle([wx, wy, wx + 9, wy + 12], fill=(236, 190, 110))
        x += bw + rnd.randint(0, 20)
    for px in (90, 420, 1010):
        top = HORIZON - 260
        d.line([(px, HORIZON), (px + 14, top)], fill=(18, 16, 22), width=9)
        for a in range(9):
            ang = -math.pi / 2 + (a - 4) * 0.36
            d.line([(px + 14, top), (px + 14 + math.cos(ang) * 120, top + math.sin(ang) * 40 + 40)], fill=(18, 16, 22), width=6)
    for px in (260, 640):
        d.line([(px, HORIZON), (px, HORIZON - 300)], fill=(16, 14, 20), width=7)
        d.line([(px - 36, HORIZON - 280), (px + 36, HORIZON - 280)], fill=(16, 14, 20), width=5)
    d.line([(0, HORIZON - 250), (260, HORIZON - 278), (640, HORIZON - 276), (W, HORIZON - 230)], fill=(16, 14, 20), width=2)

    # SPBU canopy on the right
    d.rectangle([760, 250, W, 330], fill=(232, 232, 228))
    d.rectangle([760, 300, W, 330], fill=(186, 32, 36))
    d.rectangle([760, 330, W, 352], fill=(250, 246, 226))
    for cx in (860, 1130, 1400):
        d.rectangle([cx - 14, 352, cx + 14, 620], fill=(206, 206, 200))
    for cx in (960, 1250):
        d.rectangle([cx - 44, 470, cx + 44, 626], fill=(214, 214, 208))
        d.rectangle([cx - 30, 490, cx + 30, 540], fill=(60, 80, 70))
        d.rectangle([cx - 44, 470, cx + 44, 486], fill=(186, 32, 36))
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Futura.ttc', 54, index=2)
    d.rectangle([640, 150, 740, 330], fill=(186, 32, 36))
    d.text((690, 214), 'SP', font=font, fill=(250, 250, 245), anchor='mm')
    d.text((690, 272), 'BU', font=font, fill=(250, 250, 245), anchor='mm')
    d.rectangle([684, 330, 696, 560], fill=(170, 170, 166))

    glow = Image.new('RGB', (W, H))
    g = ImageDraw.Draw(glow)
    g.rectangle([770, 336, W, 360], fill=(255, 250, 220))

    # the queue: motorbikes (lane 1) and cars (lane 2), seen from behind
    def along(k, lane):
        # k: 0 = nearest (bottom left), 1 = far (under the canopy)
        x0, y0 = (220, 1030) if lane == 1 else (-40, 960)
        x1, y1 = (900, 610) if lane == 1 else (820, 590)
        e = k ** 0.8
        return x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, 1.0 - 0.8 * e

    for k in [i / 17 for i in range(17)][::-1]:
        cx, cy, s = along(k, 2)
        w, h = 250 * s, 120 * s
        d.rounded_rectangle([cx - w / 2, cy - h, cx + w / 2, cy], radius=int(18 * s), fill=(20, 20, 24))
        d.rounded_rectangle([cx - w * 0.36, cy - h * 1.5, cx + w * 0.36, cy - h * 0.9], radius=int(16 * s), fill=(26, 26, 32))
        for sx in (-1, 1):
            lx = cx + sx * w * 0.38
            g.ellipse([lx - 18 * s, cy - h * 0.62 - 9 * s, lx + 18 * s, cy - h * 0.62 + 9 * s], fill=(255, 40, 30))
    for k in [i / 26 for i in range(26)][::-1]:
        cx, cy, s = along(k, 1)
        cx += rnd.uniform(-12, 12) * s
        d.ellipse([cx - 22 * s, cy - 44 * s, cx + 22 * s, cy], fill=(14, 14, 16))  # rear wheel
        d.polygon([(cx - 30 * s, cy - 40 * s), (cx + 30 * s, cy - 40 * s), (cx + 22 * s, cy - 92 * s), (cx - 22 * s, cy - 92 * s)], fill=(30, 28, 34))
        d.polygon([(cx - 26 * s, cy - 92 * s), (cx + 26 * s, cy - 92 * s), (cx + 20 * s, cy - 170 * s), (cx - 20 * s, cy - 170 * s)], fill=lerp((60, 70, 90), (120, 60, 50), rnd.random()))
        d.ellipse([cx - 19 * s, cy - 214 * s, cx + 19 * s, cy - 168 * s], fill=lerp((30, 30, 36), (170, 40, 40), rnd.random() * 0.6))
        g.ellipse([cx - 12 * s, cy - 70 * s, cx + 12 * s, cy - 58 * s], fill=(255, 50, 30))

    # hand-lettered sign propped against the pump island
    sign = Image.new('RGB', (300, 150), (240, 234, 212))
    sd = ImageDraw.Draw(sign)
    marker = ImageFont.truetype('/System/Library/Fonts/MarkerFelt.ttc', 52)
    sd.text((150, 48), 'PERTALITE', font=marker, fill=(170, 20, 20), anchor='mm')
    sd.text((150, 106), 'HABIS', font=marker, fill=(20, 20, 20), anchor='mm')
    sign = sign.rotate(-6, expand=True, fillcolor=(0, 0, 0))
    mask = Image.new('L', sign.size, 0)
    ImageDraw.Draw(mask).polygon([(0, 16), (sign.size[0] - 16, 0), (sign.size[0], sign.size[1] - 16), (16, sign.size[1])], fill=255)
    img.paste(sign, (1020, 700), mask)
    d.line([(1100, 850), (1090, 960)], fill=(60, 44, 30), width=10)
    d.line([(1260, 836), (1270, 950)], fill=(60, 44, 30), width=10)

    # light blooms, slight lens softness and film grain
    img = ImageChops.add(img, glow.filter(ImageFilter.GaussianBlur(14)))
    img = img.filter(ImageFilter.GaussianBlur(1.1))
    noise = Image.effect_noise((W, H), 18).convert('RGB')
    img = ImageChops.add(img, noise, scale=1.0, offset=-128)  # noise is centred on 128
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, quality=86, optimize=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
