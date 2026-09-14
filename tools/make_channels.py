#!/usr/bin/env python3
"""Indonesian-style placeholder TV channels -> public/videos/ch2..ch7.mp4

CH 1 is real footage (public/videos/ch1.mp4) and is never generated here.

A fictional station, "TVSN - Televisi Swara Nusantara", in the look of
late-night Indonesian broadcasts: test card, Berita Malam with a Sekilas Info
crawl, Prakiraan Cuaca, wayang kulit semalam suri, a volcano watch camera and
the Merah Putih sign-off. Frames are drawn with Pillow and piped to ffmpeg.

    python3 tools/make_channels.py            # all channels
    python3 tools/make_channels.py 3 5        # only CH 3 and CH 5

Replace any chN.mp4 with real footage later (4:3 framing fits the tube).
"""
import math
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, SECONDS = 640, 480, 24, 12
OUT = Path(__file__).resolve().parent.parent / 'public' / 'videos'
SUP = '/System/Library/Fonts/Supplemental/'

STATION = 'TVSN'
STATION_FULL = 'TELEVISI SWARA NUSANTARA'
MERAH = (206, 17, 38)
PUTIH = (246, 244, 238)


def futura(size, bold=True):
    return ImageFont.truetype(SUP + 'Futura.ttc', size, index=2 if bold else 0)


def futura_cond(size):
    return ImageFont.truetype(SUP + 'Futura.ttc', size, index=4)


def cond(size, weight=0):  # Avenir Next Condensed: 0 bold, 5 medium, 8 heavy
    return ImageFont.truetype(SUP + 'Avenir Next Condensed.ttc', size, index=weight)


def mono(size):
    return ImageFont.truetype(SUP + 'Courier New Bold.ttf', size)


def clock(t, h, m, s):
    total = int(h * 3600 + m * 60 + s + t)
    return f'{total // 3600 % 24:02d}.{total // 60 % 60:02d}.{total % 60:02d}'


def vgradient(top, bottom, w=W, h=H):
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(top, bottom)))
    return img


def rotate(points, angle, pivot):
    c, s = math.cos(angle), math.sin(angle)
    px, py = pivot
    return [(px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c) for x, y in points]


def ease(k):
    k = max(0.0, min(1.0, k))
    return k * k * (3 - 2 * k)


def encode(name, render, seconds=SECONDS):
    cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p',
           '-movflags', '+faststart', '-an', str(OUT / name)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(FPS * seconds)):
        proc.stdin.write(render(i / FPS).convert('RGB').tobytes())
    proc.stdin.close()
    if proc.wait():
        sys.exit(f'ffmpeg failed on {name}')
    print('wrote', name)


# ---------------------------------------------------------------- CH 7
def ch7_test_card(t):
    img = Image.new('RGB', (W, H), (92, 92, 96))
    d = ImageDraw.Draw(img)
    for x in range(0, W + 1, 40):
        d.line([(x, 0), (x, H)], fill=(205, 205, 205), width=2)
    for y in range(0, H + 1, 40):
        d.line([(0, y), (W, y)], fill=(205, 205, 205), width=2)

    cx, cy, R = W // 2, 214, 188
    inner = Image.new('RGB', (W, H), (18, 18, 20))
    di = ImageDraw.Draw(inner)
    di.rectangle([0, cy - R, W, cy - 128], fill=MERAH)
    di.rectangle([0, cy - 128, W, cy - 70], fill=PUTIH)
    bars = [(192, 192, 192), (192, 192, 0), (0, 192, 192), (0, 192, 0), (192, 0, 192), (192, 0, 0), (0, 0, 192)]
    bw = 2 * R / len(bars)
    for k, col in enumerate(bars):
        di.rectangle([cx - R + k * bw, cy - 70, cx - R + (k + 1) * bw, cy + 24], fill=col)
    for k in range(6):
        v = int(k * 255 / 5)
        di.rectangle([cx - R + k * (2 * R / 6), cy + 24, cx - R + (k + 1) * (2 * R / 6), cy + 70], fill=(v, v, v))
    for k in range(0, 2 * R, 12):  # frequency gratings
        di.rectangle([cx - R + k, cy + 70, cx - R + k + 5, cy + 104], fill=(235, 235, 235))
    di.rectangle([cx - 120, cy + 114, cx + 120, cy + 164], fill=(10, 10, 10))
    di.text((cx, cy + 139), 'PUKUL ' + clock(t, 23, 14, 5), font=mono(28), fill=(240, 240, 240), anchor='mm')
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    img.paste(inner, (0, 0), mask)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(240, 240, 240), width=4)
    d.line([(cx, cy - R), (cx, cy - 70)], fill=(30, 30, 30), width=2)

    d.rounded_rectangle([cx - 96, cy - 124, cx + 96, cy - 76], radius=6, fill=(12, 12, 14))
    d.text((cx, cy - 99), STATION, font=futura(38), fill=PUTIH, anchor='mm')

    d.rectangle([0, 404, W, H], fill=(8, 8, 10))
    msg = ('MOHON MAAF, ADA GANGGUAN TEKNIS', 'SIARAN AKAN SEGERA DILANJUTKAN')[int(t / 2.5) % 2]
    d.text((W // 2, 430), msg, font=cond(30), fill=PUTIH, anchor='mm')
    d.text((W // 2, 462), STATION_FULL + '  ·  JAKARTA', font=cond(18, 5), fill=(190, 190, 190), anchor='mm')
    return img


# ---------------------------------------------------------------- CH 2
def icon_volcano(d, box, t, rnd):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d.rectangle(box, fill=(26, 34, 52))
    sea = y0 + h * 0.78
    d.rectangle([x0, sea, x1, y1], fill=(18, 40, 70))
    peak = (x0 + w * 0.5, y0 + h * 0.36)
    d.polygon([(x0 + w * 0.18, sea), (peak[0] - 14, peak[1]), (peak[0] + 14, peak[1]), (x0 + w * 0.82, sea)], fill=(10, 10, 12))
    for k in range(26):
        age = (t * 0.6 + k / 26) % 1
        r = 8 + age * 34
        px = peak[0] + math.sin(k * 1.7) * 6 + age * 60
        py = peak[1] - age * h * 0.42
        g = int(90 + 60 * (1 - age))
        d.ellipse([px - r, py - r, px + r, py + r], fill=(g, g, g + 6))
    glow = 150 + int(80 * (0.5 + 0.5 * math.sin(t * 5)))
    d.ellipse([peak[0] - 16, peak[1] - 6, peak[0] + 16, peak[1] + 8], fill=(255, glow // 2, 20))


def icon_seismo(d, box, t, rnd):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=(232, 226, 210))
    for gx in range(int(x0), int(x1), 16):
        d.line([(gx, y0), (gx, y1)], fill=(210, 190, 180))
    mid = (y0 + y1) / 2
    pts = []
    for k, x in enumerate(range(int(x0), int(x1), 3)):
        phase = (x - x0) / (x1 - x0)
        shock = math.exp(-((phase - 0.55) * 9) ** 2)
        amp = 4 + shock * (y1 - y0) * 0.42
        pts.append((x, mid + math.sin(k * 2.3 + t * 30) * amp * (0.6 + 0.4 * math.sin(k * 0.7))))
    d.line(pts, fill=(160, 20, 20), width=2)
    d.text((x0 + 10, y0 + 8), 'M 7,7', font=futura(28), fill=(120, 16, 16))


def icon_flood(d, box, t, rnd):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d.rectangle(box, fill=(120, 132, 140))
    for k in range(4):
        hx = x0 + 20 + k * w / 4
        base = y0 + h * 0.62
        d.polygon([(hx, base), (hx + 26, base - 26), (hx + 52, base)], fill=(92, 40, 30))
        d.rectangle([hx + 6, base, hx + 46, base + 30], fill=(210, 200, 180))
    water = y0 + h * 0.7
    for layer in range(3):
        pts = [(x0, y1)]
        for x in range(int(x0), int(x1) + 1, 6):
            pts.append((x, water + layer * 10 + math.sin(x * 0.06 + t * 3 + layer) * 4))
        pts.append((x1, y1))
        d.polygon(pts, fill=(96 - layer * 16, 118 - layer * 12, 110 - layer * 8))


def icon_haze(d, box, t, rnd):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d.rectangle(box, fill=(170, 120, 70))
    for k in range(9):
        tx = x0 + 10 + k * w / 9
        th = h * (0.3 + 0.15 * math.sin(k * 2.1))
        d.polygon([(tx, y1 - h * 0.2), (tx + 13, y1 - h * 0.2 - th), (tx + 26, y1 - h * 0.2)], fill=(40, 30, 22))
    flick = 0.5 + 0.5 * math.sin(t * 9)
    d.rectangle([x0, y1 - h * 0.2, x1, y1], fill=(255, int(110 + 60 * flick), 20))
    for k in range(18):
        age = (t * 0.25 + k / 18) % 1
        r = 20 + age * 40
        px, py = x0 + (k * 37) % w, y1 - h * 0.25 - age * h * 0.6
        d.ellipse([px - r, py - r, px + r, py + r], fill=(190, 150, 110))


def drawn(icon):
    """adapt a vector icon to the story-visual signature"""
    return lambda panel, t, local, rnd: icon(ImageDraw.Draw(panel), (0, 0, *panel.size), t, rnd)


def photo(name):
    """slow push-in on one of the board's news pictures"""
    src = Image.open(OUT.parent / 'images' / 'news' / name).convert('RGB')

    def visual(panel, t, local, rnd):
        pw, ph = panel.size
        zoom = 1.0 + 0.1 * min(local / 3.0, 1.0)
        cw = src.width / zoom
        ch = cw * ph / pw
        cx, cy = src.width * 0.45, src.height * 0.55
        crop = src.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2)))
        panel.paste(crop.resize((pw, ph), Image.LANCZOS))
    return visual


# headlines mirror the evidence board (src/papers.js)
STORIES = [
    ('KRISIS BBM MAKASSAR', 'Ganjil-genap pelat nomor berlaku 13–20 September', 'SULAWESI SELATAN', photo('krisis-bbm-makassar-2026.jpg')),
    ('ERUPSI ANAK KRAKATAU', 'Status Level III (Siaga), radius bahaya 3 km', 'SELAT SUNDA', drawn(icon_volcano)),
    ('GEMPA M7,7 GUNCANG FLORES', 'Peringatan dini tsunami telah diakhiri', 'NUSA TENGGARA TIMUR', drawn(icon_seismo)),
    ('BANJIR RENDAM LANGKAT', '1.110 KK terdampak di tiga kecamatan', 'SUMATERA UTARA', drawn(icon_flood)),
    ('ASAP KARHUTLA DI RIAU', 'Visibilitas menurun, warga diminta waspada', 'RIAU', drawn(icon_haze)),
]
CH2_SECONDS = 3 * len(STORIES)
CRAWL = ('ANTREAN BBM DI MAKASSAR MULAI TERURAI   •   GANJIL-GENAP BBM SUBSIDI BERLAKU 13–20 SEPTEMBER'
         '   •   IKUTI INFORMASI RESMI DARI BNPB, BMKG DAN BADAN GEOLOGI   •   SIAPKAN TAS SIAGA BENCANA'
         '   •   WASPADAI CUACA EKSTREM DI MUSIM PANCAROBA   •   JANGAN MUDAH PERCAYA KABAR BOHONG   •   ')


def wrap(d, text, font, width):
    words, lines, line = text.split(), [], ''
    for w in words:
        test = f'{line} {w}'.strip()
        if d.textlength(test, font=font) > width and line:
            lines.append(line)
            line = w
        else:
            line = test
    return lines + [line]


def ch2_berita_malam(t):
    img = vgradient((8, 22, 58), (16, 58, 118))
    d = ImageDraw.Draw(img)
    for y in range(0, H, 6):
        d.line([(0, y), (W, y)], fill=(20, 48, 96))
    d.rectangle([20, 24, 216, 72], fill=MERAH)
    d.text((118, 48), 'BERITA MALAM', font=futura_cond(30), fill=PUTIH, anchor='mm')
    d.text((W - 30, 36), STATION, font=futura(26), fill=PUTIH, anchor='rm')
    d.text((W - 30, 62), clock(t, 21, 7, 30) + ' WIB', font=mono(18), fill=(255, 214, 90), anchor='rm')

    per = CH2_SECONDS / len(STORIES)
    k = int(t // per) % len(STORIES)
    local = t - k * per
    slide = (1 - ease(local / 0.45)) * W
    title, sub, place, visual = STORIES[k]
    panel = Image.new('RGB', (260, 192))
    visual(panel, t, local, random.Random(k))  # own tile, so smoke stays inside the frame
    box = (40 + slide, 108, 300 + slide, 300)
    img.paste(panel, (int(box[0]), box[1]))
    d.rectangle(box, outline=PUTIH, width=3)

    tx = 322 + slide
    d.rectangle([tx, 110, tx + 18 + d.textlength(place, font=cond(20)), 138], fill=MERAH)
    d.text((tx + 9, 124), place, font=cond(20), fill=PUTIH, anchor='lm')
    y = 156
    for line in wrap(d, title, futura_cond(42), 290):
        d.text((tx, y), line, font=futura_cond(42), fill=PUTIH)
        y += 46
    for line in wrap(d, sub, cond(22, 5), 290):
        d.text((tx, y + 6), line, font=cond(22, 5), fill=(210, 225, 245))
        y += 28

    d.rectangle([0, 404, W, 446], fill=(6, 10, 22))
    fnt = cond(22)
    span = d.textlength(CRAWL, font=fnt)
    off = (t * 95) % span
    for rep in range(3):
        d.text((150 - off + rep * span, 425), CRAWL, font=fnt, fill=(255, 214, 90), anchor='lm')
    d.rectangle([0, 404, 140, 446], fill=MERAH)
    d.text((70, 425), 'SEKILAS INFO', font=cond(19), fill=PUTIH, anchor='mm')
    d.text((W // 2, 466), 'CUPLIKAN ILUSTRASI  ·  ' + STATION_FULL, font=cond(15, 5), fill=(150, 170, 200), anchor='mm')
    return img


# ---------------------------------------------------------------- CH 3
ISLANDS = [
    [(95.3, 5.6), (97.5, 5.2), (100.3, 2.5), (103.8, -1.0), (106.0, -3.2), (105.8, -5.8), (104.5, -5.9), (102.3, -4.0), (100.3, -1.0), (98.7, 1.7), (96.0, 3.8)],
    [(105.2, -6.8), (106.8, -6.0), (108.3, -6.3), (110.4, -6.9), (112.6, -6.9), (114.4, -7.7), (114.5, -8.7), (112.0, -8.3), (110.0, -8.1), (108.0, -7.8), (106.4, -7.4)],
    [(112.7, -6.9), (114.1, -6.9), (113.9, -7.2), (112.8, -7.2)],
    [(115.0, -8.1), (115.7, -8.4), (115.2, -8.8), (114.6, -8.4)],
    [(116.0, -8.4), (119.0, -8.2), (119.1, -8.8), (116.4, -8.9)],
    [(119.8, -8.4), (123.0, -8.2), (122.8, -8.8), (120.0, -8.8)],
    [(119.0, -9.4), (120.8, -9.7), (120.2, -10.2), (118.9, -9.8)],
    [(123.5, -10.2), (125.2, -9.1), (127.3, -8.4), (125.0, -9.6), (124.0, -10.4)],
    [(108.8, 1.5), (109.6, -1.0), (110.3, -3.0), (114.5, -4.0), (116.5, -3.3), (116.1, -1.0), (118.0, 1.0), (117.6, 4.2), (119.2, 5.3), (117.0, 7.0), (115.3, 5.0), (113.0, 3.2), (111.0, 1.8), (109.6, 2.0)],
    [(119.4, -5.5), (120.4, -5.6), (120.3, -2.8), (121.3, -1.9), (122.9, -4.8), (123.2, -4.1), (121.9, -1.9), (123.3, -0.9), (121.2, -1.0), (120.1, 0.5), (120.9, 1.0), (124.9, 1.6), (124.2, 0.4), (121.0, 0.4), (120.0, -0.3), (119.8, -1.2), (118.8, -2.6), (119.6, -3.4)],
    [(127.5, 1.8), (128.7, 1.3), (128.0, 0.3), (128.8, -0.5), (127.9, -0.7), (127.4, 0.5)],
    [(126.0, -3.2), (127.2, -3.1), (127.0, -3.8), (126.1, -3.7)],
    [(128.0, -3.0), (130.5, -3.2), (130.0, -3.6), (128.0, -3.5)],
    [(105.2, -1.5), (106.8, -2.4), (106.2, -3.0), (105.1, -2.2)],
    [(131.0, -1.2), (132.5, -0.4), (134.2, -0.9), (135.0, -3.3), (137.8, -1.5), (141.0, -2.6), (141.0, -9.1), (139.0, -8.1), (138.0, -8.4), (137.6, -7.5), (138.6, -6.8), (136.0, -4.6), (133.2, -4.0), (132.2, -2.9), (133.5, -2.4), (132.0, -2.0)],
]
CITIES = [  # illustrative values only; (dx, dy) places the label box
    ('MEDAN', 98.67, 3.59, 'rain', 31, (10, -38)),
    ('PEKANBARU', 101.45, 0.51, 'haze', 33, (-70, 10)),
    ('JAKARTA', 106.85, -6.21, 'partly', 33, (-118, 10)),
    ('PONTIANAK', 109.34, -0.03, 'storm', 31, (10, -40)),
    ('SURABAYA', 112.75, -7.25, 'sun', 34, (-20, 12)),
    ('MAKASSAR', 119.43, -5.14, 'partly', 32, (12, -8)),
    ('KUPANG', 123.60, -10.17, 'sun', 33, (12, -16)),
    ('AMBON', 128.18, -3.70, 'cloud', 29, (-40, -40)),
    ('JAYAPURA', 140.70, -2.53, 'rain', 30, (-126, 12)),
]
LABEL = {'sun': 'CERAH', 'partly': 'CERAH BERAWAN', 'cloud': 'BERAWAN', 'rain': 'HUJAN RINGAN', 'storm': 'HUJAN PETIR', 'haze': 'BERASAP'}


def geo(lon, lat):
    return 24 + (lon - 94) * 12.3, 132 + (7.0 - lat) * 14.2


def weather_icon(d, x, y, kind, t):
    if kind in ('sun', 'partly'):
        r = 11
        for a in range(8):
            ang = a * math.pi / 4 + t * 0.8
            d.line([(x + math.cos(ang) * (r + 3), y + math.sin(ang) * (r + 3)), (x + math.cos(ang) * (r + 8), y + math.sin(ang) * (r + 8))], fill=(255, 210, 40), width=3)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 200, 30))
    if kind in ('partly', 'cloud', 'rain', 'storm', 'haze'):
        col = (235, 235, 240) if kind in ('partly', 'cloud') else (150, 155, 165) if kind != 'haze' else (190, 160, 120)
        ox = 6 if kind == 'partly' else 0
        for dx, dy, r in ((-8, 2, 9), (2, -4, 11), (12, 2, 9)):
            d.ellipse([x + ox + dx - r, y + dy - r, x + ox + dx + r, y + dy + r], fill=col)
    if kind in ('rain', 'storm'):
        for k in range(3):
            fy = y + 12 + ((t * 40 + k * 7) % 12)
            d.line([(x - 8 + k * 8, fy), (x - 11 + k * 8, fy + 6)], fill=(110, 170, 255), width=2)
    if kind == 'storm':
        d.polygon([(x + 2, y + 6), (x - 5, y + 20), (x + 1, y + 19), (x - 3, y + 30), (x + 9, y + 14), (x + 3, y + 15)], fill=(255, 225, 60))


def ch3_prakiraan_cuaca(t):
    img = vgradient((0, 86, 150), (0, 38, 92))
    d = ImageDraw.Draw(img)
    for isl in ISLANDS:
        pts = [geo(*p) for p in isl]
        d.polygon([(x + 3, y + 3) for x, y in pts], fill=(0, 30, 70))
        d.polygon(pts, fill=(70, 150, 72), outline=(190, 225, 140))
    d.rectangle([0, 0, W, 64], fill=(255, 196, 0))
    d.rectangle([0, 64, W, 70], fill=MERAH)
    d.text((24, 32), 'PRAKIRAAN CUACA', font=futura_cond(38), fill=(18, 30, 70), anchor='lm')
    d.text((W - 24, 22), 'SELASA, 15 SEPTEMBER 2026', font=cond(18), fill=(18, 30, 70), anchor='rm')
    d.text((W - 24, 46), STATION, font=futura(20), fill=(18, 30, 70), anchor='rm')
    for k, (name, lon, lat, kind, temp, (dx, dy)) in enumerate(CITIES):
        appear = ease((t - 0.4 - k * 0.75) / 0.35)
        if appear <= 0:
            continue
        x, y = geo(lon, lat)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=MERAH, outline=PUTIH)
        lx, ly = x + dx, y + dy + (1 - appear) * 12
        text = f'{name}  {temp}°'
        tw = d.textlength(text, font=cond(15))
        d.rounded_rectangle([lx, ly, lx + tw + 56, ly + 26], radius=4, fill=(10, 24, 60), outline=(90, 130, 190))
        weather_icon(d, lx + 18, ly + 13, kind, t)
        d.text((lx + 46, ly + 13), text, font=cond(15), fill=PUTIH, anchor='lm')
    cur = CITIES[int(t / 1.4) % len(CITIES)]
    d.rectangle([0, 420, W, 452], fill=(10, 24, 60))
    d.text((24, 436), f'{cur[0]}:  {LABEL[cur[3]]}  ·  SUHU {cur[4] - 8}–{cur[4]}°C  ·  KELEMBAPAN 65–90%', font=cond(18), fill=PUTIH, anchor='lm')
    d.text((W // 2, 468), 'DATA ILUSTRASI  ·  IKUTI PRAKIRAAN RESMI BMKG', font=cond(15, 5), fill=(170, 200, 235), anchor='mm')
    return img


# ---------------------------------------------------------------- CH 4
STARS = [(random.Random(s).random() * W, random.Random(s + 99).random() * 300) for s in range(70)]


def ch4_penutup_siaran(t):
    img = vgradient((6, 12, 34), (34, 52, 92))
    d = ImageDraw.Draw(img)
    for k, (sx, sy) in enumerate(STARS):
        b = int(120 + 100 * (0.5 + 0.5 * math.sin(t * 2 + k)))
        d.point((sx, sy), fill=(b, b, b + 20))
    pole_x, top = 170, 58
    d.rectangle([pole_x - 3, top, pole_x + 3, 400], fill=(200, 200, 205))
    d.ellipse([pole_x - 8, top - 14, pole_x + 8, top + 2], fill=(222, 184, 70))
    fw, fh = 300, 196
    for x in range(0, fw, 2):
        phase = x * 0.034 - t * 4.2
        amp = 9 * (x / fw) ** 0.8
        dy = math.sin(phase) * amp
        shade = 0.82 + 0.18 * math.cos(phase)
        px = pole_x + 3 + x
        y0 = top + 6 + dy
        red = tuple(int(c * shade) for c in MERAH)
        white = tuple(int(c * shade) for c in PUTIH)
        d.rectangle([px, y0, px + 2, y0 + fh / 2], fill=red)
        d.rectangle([px, y0 + fh / 2, px + 2, y0 + fh], fill=white)
    d.text((W // 2, 322), 'SELAMAT MALAM', font=futura(52), fill=PUTIH, anchor='mm')
    d.text((W // 2, 370), 'SAMPAI JUMPA ESOK HARI', font=cond(28, 5), fill=(220, 225, 240), anchor='mm')
    d.rectangle([0, 414, W, H], fill=(4, 8, 20))
    d.text((W // 2, 438), f'{STATION} MENGAKHIRI SIARAN HARI INI', font=cond(20), fill=(255, 214, 90), anchor='mm')
    d.text((W // 2, 464), 'PUKUL ' + clock(t, 23, 59, 40) + ' WIB', font=mono(16), fill=(180, 190, 210), anchor='mm')
    return img


# ---------------------------------------------------------------- CH 5
GUNUNGAN = [(-58, 0), (58, 0), (64, -40), (72, -92), (64, -150), (42, -206), (16, -242), (0, -266),
            (-16, -242), (-42, -206), (-64, -150), (-72, -92), (-64, -40)]
# a satria in profile facing left: long nose, gelung crown, flared dodot, feet apart
FIGURE = [(-40, 0), (-12, 0), (-6, -40), (6, -40), (12, 0), (38, 0), (40, -60), (20, -70), (14, -110),
          (18, -150), (8, -164), (14, -176), (14, -192), (18, -214), (8, -232), (-6, -224), (-10, -206),
          (-8, -192), (-36, -179), (-16, -175), (-12, -167), (-6, -164), (-20, -150), (-14, -110), (-22, -70), (-44, -60)]


def silhouette(layer, shape, origin, angle, holes):
    d = ImageDraw.Draw(layer)
    ox, oy = origin
    pts = rotate([(ox + x, oy + y) for x, y in shape], angle, origin)
    d.polygon(pts, fill=255)
    for hx, hy, r in holes:  # carved perforations let the lamp shine through
        cx, cy = rotate([(ox + hx, oy + hy)], angle, origin)[0]
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=60)
    return pts


GUNUNGAN_HOLES = [(0, -40 - k * 22, 5) for k in range(9)] + \
    [(s * (14 + k * 7), -70 - k * 20, 4) for k in range(6) for s in (-1, 1)] + \
    [(s * 30, -30, 9) for s in (-1, 1)] + [(0, -12, 12)]


def ch5_wayang(t):
    flick = 0.9 + 0.06 * math.sin(t * 7.1) + 0.04 * math.sin(t * 13.3 + 1)
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for r in range(420, 0, -6):
        k = r / 420
        col = tuple(int(c * flick) for c in (int(255 - 150 * k), int(205 - 150 * k), int(130 - 110 * k)))
        d.ellipse([W / 2 - r * 1.3, 220 - r, W / 2 + r * 1.3, 220 + r], fill=col)
    shadow = Image.new('L', (W, H), 0)
    sway = math.sin(t * 1.3) * 0.12
    enter = ease((t - 5) / 2.2)
    g_x = W / 2 - enter * 120
    g_angle = sway * (1 - enter * 0.6)
    g_origin = (g_x, 360)
    silhouette(shadow, GUNUNGAN, g_origin, g_angle, GUNUNGAN_HOLES)
    sd = ImageDraw.Draw(shadow)
    # carved tree of life: trunk, branches and the gate at the base
    tree = [[(0, -46), (0, -232)]] + [[(0, -70 - k * 26), (s * (34 - k * 5), -94 - k * 26)] for k in range(6) for s in (-1, 1)]
    for seg in tree:
        sd.line(rotate([(g_x + x, 360 + y) for x, y in seg], g_angle, g_origin), fill=60, width=3)
    sd.polygon(rotate([(g_x + x, 360 + y) for x, y in [(-24, -4), (24, -4), (24, -40), (-24, -40)]], g_angle, g_origin), fill=60)
    sd.line(rotate([(g_x, 356), (g_x, 324)], g_angle, g_origin), fill=255, width=3)
    sd.line([(g_x, 360), (g_x + sway * 30, 420)], fill=255, width=3)
    if enter > 0:
        fx = W + 70 - enter * 250
        base = 368 + math.sin(t * 2.2) * 4
        silhouette(shadow, FIGURE, (fx, base), math.sin(t * 1.7) * 0.04,
                   [(0, -130, 3), (0, -100, 3), (-12, -66, 3), (12, -66, 3), (0, -210, 3)])
        wave = math.sin(t * 2.5) * 18
        front_hand = (fx - 64, base - 96 + wave)
        sd.line([(fx - 16, base - 148), (fx - 40, base - 126 + wave * 0.5), front_hand], fill=255, width=5)
        sd.line([front_hand, (fx - 54, 432)], fill=210, width=2)  # tuding (arm rod)
        back_hand = (fx + 36, base - 84)
        sd.line([(fx + 14, base - 148), (fx + 30, base - 116), back_hand], fill=255, width=5)
        sd.line([back_hand, (fx + 44, 432)], fill=210, width=2)
        sd.line([(fx, base), (fx + 4, 432)], fill=255, width=3)  # gapit (main rod)
    shadow = shadow.filter(ImageFilter.GaussianBlur(1.6))
    img.paste((24, 12, 6), (0, 0), shadow)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 404, W, H], fill=(58, 40, 22))
    d.rectangle([0, 404, W, 410], fill=(92, 66, 36))
    d.text((W // 2, 30), 'PAGELARAN WAYANG KULIT SEMALAM SURI', font=futura_cond(28), fill=(255, 238, 200), anchor='mm')
    d.text((W // 2, 60), 'LAKON: SEMAR MBANGUN KAHYANGAN', font=cond(19, 5), fill=(255, 226, 170), anchor='mm')
    d.text((24, 440), STATION, font=futura(22), fill=(255, 226, 170), anchor='lm')
    d.text((W - 24, 440), 'SIARAN TUNDA', font=cond(17), fill=(255, 226, 170), anchor='rm')
    return img


# ---------------------------------------------------------------- CH 6
PLUME = [(random.Random(k).random(), random.Random(k + 7).random()) for k in range(90)]


def ch6_kamera_krakatau(t):
    img = vgradient((22, 26, 34), (48, 52, 60))
    d = ImageDraw.Draw(img)
    sea = 330
    d.rectangle([0, sea, W, H], fill=(20, 24, 30))
    for y in range(sea + 4, H, 7):
        shimmer = int(34 + 10 * math.sin(y * 0.3 + t * 2))
        d.line([(0, y), (W, y)], fill=(shimmer, shimmer + 2, shimmer + 6))
    crater = (402, 214)
    haze = Image.new('L', (W, H), 0)
    hd = ImageDraw.Draw(haze)
    for k, (a, b) in enumerate(PLUME):
        age = (t * 0.07 + a) % 1
        r = 10 + age * 70
        px = crater[0] + (b - 0.5) * 30 + age * 210 + math.sin(age * 6 + k) * 16
        py = crater[1] - age * 230
        hd.ellipse([px - r, py - r, px + r, py + r], fill=int(120 * (1 - age) + 30))
    haze = haze.filter(ImageFilter.GaussianBlur(8))
    img.paste((150, 150, 156), (0, 0), haze)
    d = ImageDraw.Draw(img)
    d.polygon([(250, sea), (372, crater[1] + 6), (432, crater[1] + 6), (560, sea)], fill=(12, 12, 14))
    d.polygon([(80, sea), (150, sea - 40), (230, sea)], fill=(16, 16, 18))
    pulse = 0.5 + 0.5 * math.sin(t * 3.3) * math.sin(t * 1.1)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([crater[0] - 40, crater[1] - 22, crater[0] + 40, crater[1] + 18], fill=int(120 + 120 * pulse))
    img.paste((255, 120, 30), (0, 0), glow.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(img)
    rnd = random.Random(int(t * 2))
    if pulse > 0.75:
        for _ in range(6):
            a = rnd.uniform(-1.2, -0.2) * math.pi / 2 - math.pi / 4
            s = rnd.uniform(20, 60)
            d.line([crater, (crater[0] + math.cos(a) * s, crater[1] + math.sin(a) * s)], fill=(255, 170, 60), width=2)
    d.text((18, 20), 'KAMERA PANTAU  ·  G. ANAK KRAKATAU', font=mono(18), fill=PUTIH)
    d.text((18, 44), 'KAM-02  ARAH BARAT DAYA', font=mono(16), fill=(200, 200, 200))
    d.rectangle([W - 190, 16, W - 16, 44], fill=(230, 150, 0))
    d.text((W - 103, 30), 'LEVEL III (SIAGA)', font=cond(18), fill=(20, 16, 10), anchor='mm')
    d.text((18, H - 30), '14-09-2026  ' + clock(t, 23, 14, 5).replace('.', ':') + ' WIB', font=mono(18), fill=PUTIH)
    d.text((W - 18, H - 30), 'ILUSTRASI', font=mono(16), fill=(200, 200, 200), anchor='ra')
    if int(t * 2) % 2 == 0:
        d.ellipse([W - 186, 56, W - 174, 68], fill=(230, 30, 30))
        d.text((W - 168, 62), 'REC', font=mono(16), fill=(230, 30, 30), anchor='lm')
    return img


CHANNELS = {
    2: ch2_berita_malam,
    3: ch3_prakiraan_cuaca,
    4: ch4_penutup_siaran,
    5: ch5_wayang,
    6: ch6_kamera_krakatau,
    7: ch7_test_card,
}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    only = [int(a) for a in sys.argv[1:]] or list(CHANNELS)
    for n in only:
        encode(f'ch{n}.mp4', CHANNELS[n], CH2_SECONDS if n == 2 else SECONDS)
