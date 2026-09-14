/**
 * Evidence cards are rendered to canvases so they keep the tactile, printed
 * character of the board. The news photographs are AI-generated editorial
 * illustrations; every fact and label is typeset here to keep Indonesian copy
 * accurate and easy to update.
 */

const TYPE = '"Special Elite", "Courier New", monospace';
const HAND = 'Caveat, "Bradley Hand", cursive';
const HEAD = 'Oswald, Impact, "Arial Narrow", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** aged paper: tone, fibres, speckle, darkened edges */
function paper(ctx, w, h, r, { tone = '#ebe2c9', age = 0.5, speckle = 10 } = {}) {
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * speckle;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#6b5a3c';
  for (let i = 0; i < 180; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI;
    ctx.lineWidth = 0.5 + r();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 30 * r(), y + Math.sin(a) * 30 * r());
    ctx.stroke();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(120,90,40,0)');
  g.addColorStop(1, `rgba(110,78,30,${0.35 * age})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function coffeeRing(ctx, x, y, rad, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(120,70,20,0.16)';
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 3 + r() * 6;
    ctx.beginPath();
    ctx.arc(x + r() * 4, y + r() * 4, rad - i * 3, r() * 0.8, Math.PI * 2 - r() * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(150,95,35,0.05)';
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function fold(ctx, x0, y0, x1, y1) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(80,60,30,0.14)';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,240,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 3); ctx.lineTo(x1 + 3, y1 + 3); ctx.stroke();
  ctx.restore();
}

/** typewriter: each strike lands a little differently */
function type(ctx, str, x, y, size, r, color = '#1c1915') {
  ctx.save();
  ctx.font = `${size}px ${TYPE}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  const adv = ctx.measureText('M').width;
  for (const ch of str) {
    if (ch !== ' ') {
      ctx.globalAlpha = 0.62 + r() * 0.38;
      ctx.fillText(ch, x + (r() - 0.5) * 1.2, y + (r() - 0.5) * size * 0.05);
    }
    x += adv;
  }
  ctx.restore();
  return x;
}

function hand(ctx, str, x, y, size, color = '#1f2f7a', rot = 0, weight = 600) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${weight} ${size}px ${HAND}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

function stamp(ctx, text, x, y, rot, size, color, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `700 ${size}px ${HEAD}`;
  const w = ctx.measureText(text).width;
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.07;
  ctx.strokeRect(-w / 2 - size * 0.3, -size * 0.85, w + size * 0.6, size * 1.25);
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, size * 0.28);
  // worn ink
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = r() * 0.6;
    ctx.beginPath();
    ctx.arc((r() - 0.5) * (w + size), (r() - 0.6) * size * 1.4, r() * size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function redact(ctx, x, y, w, h, r) {
  ctx.save();
  ctx.fillStyle = '#0d0c0b';
  ctx.beginPath();
  ctx.moveTo(x, y + r() * 3);
  ctx.lineTo(x + w, y + r() * 3);
  ctx.lineTo(x + w + r() * 4, y + h - r() * 3);
  ctx.lineTo(x - r() * 3, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** black & white photographic finish: contrast, grain, vignette */
function photoFinish(ctx, x, y, w, h, r, { contrast = 1.25, grain = 26, tint = [1, 1, 1], lift = 0 } = {}) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % w, py = Math.floor(i / 4 / w);
    const dx = px / w - 0.5, dy = py / h - 0.5;
    const vig = 1 - (dx * dx + dy * dy) * 1.25;
    let l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    l = (l - 0.5) * contrast + 0.5 + lift;
    l = l * vig + (r() - 0.5) * grain / 255;
    const v = Math.max(0, Math.min(1, l)) * 255;
    d[i] = v * tint[0]; d[i + 1] = v * tint[1]; d[i + 2] = v * tint[2];
  }
  ctx.putImageData(img, x, y);
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

const NEWS_IMAGE_PATHS = {
  karhutla: 'images/news/karhutla-2026.jpg',
  krakatau: 'images/news/anak-krakatau-2026.jpg',
  gempa: 'images/news/gempa-flores-ntt-2026.jpg',
  banjir: 'images/news/banjir-langkat-2026.jpg',
  longsor: 'images/news/longsor-bandung-2026.jpg',
  bbm: 'images/news/krisis-bbm-makassar-2026.jpg',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Gagal memuat aset berita: ${src}`));
    image.src = src;
  });
}

export async function loadNewsImages() {
  const entries = Object.entries(NEWS_IMAGE_PATHS);
  const images = await Promise.all(entries.map(([, src]) => loadImage(src)));
  return Object.fromEntries(entries.map(([key], i) => [key, images[i]]));
}

function coverImage(ctx, image, x, y, w, h) {
  if (!image) {
    ctx.fillStyle = '#252525';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale, sh = h / scale;
  const sx = (image.width - sw) / 2, sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function photoPanel(ctx, image, x, y, w, h, r) {
  ctx.save();
  ctx.fillStyle = '#f7f0df';
  ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  coverImage(ctx, image, x, y, w, h);
  photoFinish(ctx, x, y, w, h, r, {
    contrast: 1.16,
    grain: 26,
    tint: [1.04, 0.99, 0.9],
    lift: -0.015,
  });
  ctx.fillStyle = 'rgba(25, 20, 15, 0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(35, 28, 20, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawTextBlock(ctx, text, x, y, maxW, lineHeight, color = '#1c1915') {
  const lines = wrapLines(ctx, text, maxW);
  ctx.fillStyle = color;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function drawHeadline(ctx, text, x, y, maxW, size, r) {
  ctx.font = `700 ${size}px ${HEAD}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#161412';
  const lines = wrapLines(ctx, text, maxW).slice(0, 3);
  lines.forEach((line, i) => {
    ctx.globalAlpha = 0.9 + r() * 0.1;
    ctx.fillText(line, x + (r() - 0.5) * 1.1, y + i * size * 0.92);
  });
  ctx.globalAlpha = 1;
  return y + lines.length * size * 0.92;
}

function drawNewsCard(_sceneShot, assets, spec) {
  const W = spec.canvasW || 1120, H = spec.canvasH || 1320;
  const c = canvas(W, H), x = c.getContext('2d'), r = rng(spec.seed || 101);
  paper(x, W, H, r, { tone: '#e9e0c9', age: 0.64, speckle: 12 });
  const b = Math.round(W * 0.075);
  const innerW = W - b * 2;
  const imageH = Math.round(H * (spec.imageRatio || 0.42));

  type(x, spec.code, b, Math.round(H * 0.065), Math.round(W * 0.034), r, '#8d1b19');
  x.fillStyle = '#8d1b19';
  x.fillRect(b, Math.round(H * 0.083), innerW, Math.max(3, Math.round(W * 0.004)));
  photoPanel(x, assets?.[spec.imageKey], b, Math.round(H * 0.105), innerW, imageH, r);

  let y = Math.round(H * 0.105) + imageH + Math.round(H * 0.055);
  y = drawHeadline(x, spec.headline, b, y, innerW, Math.round(W * 0.072), r);
  x.font = `700 ${Math.round(W * 0.029)}px ${TYPE}`;
  y = drawTextBlock(x, spec.location, b, y + Math.round(H * 0.03), innerW, Math.round(W * 0.04), '#8d1b19');
  x.font = `${Math.round(W * 0.027)}px ${SERIF}`;
  y = drawTextBlock(x, spec.body, b, y + Math.round(H * 0.035), innerW, Math.round(W * 0.04), '#27221b');

  const footerY = H - Math.round(H * 0.09);
  x.fillStyle = 'rgba(45, 35, 25, 0.35)';
  x.fillRect(b, footerY - Math.round(H * 0.03), innerW, 2);
  x.font = `700 ${Math.round(W * 0.024)}px ${TYPE}`;
  x.fillStyle = '#3d3427';
  x.fillText(spec.source, b, footerY);
  x.textAlign = 'right';
  x.fillStyle = '#8d1b19';
  x.fillText(spec.date, W - b, footerY);
  x.textAlign = 'left';
  x.font = `${Math.round(W * 0.019)}px ${TYPE}`;
  x.fillStyle = 'rgba(45, 35, 25, 0.62)';
  x.fillText(spec.credit || 'FOTO ILUSTRASI AI', b, H - Math.round(H * 0.035));
  stamp(x, 'TERKINI', W - b - Math.round(W * 0.11), H - Math.round(H * 0.045), 0.05, Math.round(W * 0.042), '#a01818', r);
  return c;
}

function drawSituationCard() {
  const W = 1360, H = 840, c = canvas(W, H), x = c.getContext('2d'), r = rng(203);
  paper(x, W, H, r, { tone: '#f0ead9', age: 0.4, speckle: 8 });
  const b = 78;
  type(x, 'PAPAN PANTAU  /  INDONESIA 2026', b, 112, 42, r, '#8d1b19');
  x.fillStyle = '#8d1b19'; x.fillRect(b, 145, W - b * 2, 5);
  x.font = `700 132px ${HEAD}`; x.fillStyle = '#191613'; x.fillText('1.730', b, 310);
  x.font = `700 48px ${TYPE}`; x.fillStyle = '#8d1b19'; x.fillText('KEJADIAN BENCANA', b, 378);
  x.font = `34px ${SERIF}`; x.fillStyle = '#30281e';
  drawTextBlock(x, 'Tercatat di seluruh Indonesia sejak 1 Januari sampai 7 September 2026. Angka bersifat dinamis.', b, 445, 610, 48);
  const stats = [
    ['627', 'KARHUTLA'], ['543', 'BANJIR'], ['324', 'CUACA EKSTREM'],
    ['105', 'LONGSOR'], ['101', 'KEKERINGAN'],
  ];
  stats.forEach(([n, label], i) => {
    const col = i < 3 ? i : i - 3, row = i < 3 ? 0 : 1;
    const sx = 760 + col * 182, sy = 256 + row * 170;
    x.fillStyle = 'rgba(125, 30, 25, 0.14)'; x.fillRect(sx - 18, sy - 42, 154, 112);
    x.font = `700 58px ${HEAD}`; x.fillStyle = '#191613'; x.fillText(n, sx, sy + 10);
    x.font = `700 22px ${TYPE}`; x.fillStyle = '#8d1b19'; x.fillText(label, sx, sy + 48);
  });
  x.font = `700 27px ${TYPE}`; x.fillStyle = '#3d3427';
  x.fillText('SUMBER: BNPB / ANTARA  ·  08 SEP 2026', b, H - 70);
  hand(x, 'cek sumber resmi', 920, H - 58, 50, '#1b2a6b', -0.05, 700);
  return c;
}

function drawFieldNote() {
  const W = 800, H = 800, c = canvas(W, H), x = c.getContext('2d'), r = rng(211);
  paper(x, W, H, r, { tone: '#ead05a', age: 0.22, speckle: 8 });
  x.fillStyle = 'rgba(125, 93, 0, 0.18)'; x.fillRect(0, 0, W, 104);
  hand(x, 'PANTAU', 66, 196, 112, '#171613', -0.04, 700);
  hand(x, 'BERITA BENCANA', 46, 304, 77, '#171613', -0.02, 700);
  hand(x, 'ikuti kanal resmi:', 68, 432, 66, '#1b2a6b', -0.02, 600);
  hand(x, 'BNPB  •  BMKG', 68, 526, 71, '#8d1b19', -0.03, 700);
  hand(x, 'BADAN GEOLOGI', 68, 616, 65, '#8d1b19', -0.02, 700);
  x.strokeStyle = '#8d1b19'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(70, 646); x.quadraticCurveTo(320, 670, 640, 642); x.stroke();
  hand(x, 'data dapat berubah', 220, 735, 56, '#171613', -0.04, 600);
  return c;
}

/** ragged torn edge along one side (alpha) */
function tear(ctx, w, h, r, sides = { bottom: true }) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  const j = (a) => (r() - 0.5) * a;
  ctx.moveTo(0, 0);
  if (sides.top) for (let x = 0; x <= w; x += 14) ctx.lineTo(x, 10 + j(16)); else ctx.lineTo(w, 0);
  if (sides.right) for (let y = 0; y <= h; y += 14) ctx.lineTo(w - 10 + j(16), y); else ctx.lineTo(w, h);
  if (sides.bottom) for (let x = w; x >= 0; x -= 14) ctx.lineTo(x, h - 12 + j(18)); else ctx.lineTo(0, h);
  if (sides.left) for (let y = h; y >= 0; y -= 14) ctx.lineTo(10 + j(16), y); else ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ================================================================= items

function drawReport() {
  const W = 1240, H = 1654, c = canvas(W, H), x = c.getContext('2d'), r = rng(7);
  paper(x, W, H, r, { tone: '#ece4cf', age: 0.55 });
  fold(x, 0, H * 0.34, W, H * 0.335);
  fold(x, 0, H * 0.67, W, H * 0.672);
  coffeeRing(x, W * 0.78, H * 0.86, 95, r);
  const L = 110;
  type(x, 'ORGANIZED CRIME TASK FORCE', L, 150, 40, r);
  type(x, 'CHICAGO FIELD OFFICE', L, 198, 30, r);
  type(x, 'FILE No. 77-1023', W - 440, 198, 30, r);
  x.fillStyle = '#1c1915'; x.fillRect(L, 226, W - 2 * L, 3);
  const rows = [
    ['DATE', 'OCT. 24, 1977'],
    ['AGENT', 'R. HALLORAN  #4471'],
    ['SUBJECT', 'MORETTI, VINCENT "THE TAILOR"'],
    ['RE', 'PIER 17 / LOT 23 SHIPMENT'],
  ];
  rows.forEach(([k, v], i) => { type(x, `${k}:`, L, 300 + i * 50, 32, r); type(x, v, L + 210, 300 + i * 50, 32, r); });
  type(x, 'FIELD REPORT', L, 560, 44, r);
  const body = [
    'At approx. 0214 hrs on 10/23 surveillance at',
    'PIER 17 (Gate B) recorded three (3) males',
    'unloading crates marked "AUTO PARTS - CHICAGO",',
    'LOT 23, from a black sedan.',
    '',
    'Crates were moved to the warehouse on',
    '             St. Informant           states the',
    'crates do not contain auto parts. Contents are',
    'believed to be ledgers kept by the individual',
    'known only as "THE ACCOUNTANT".',
    '',
    'A switchblade (ivory handle) was recovered',
    'at the scene. Fire reported at 0351 hrs.',
    'Warehouse a total loss.',
    '',
    'RECOMMEND: continued surveillance on MORETTI.',
    'Secure CAM 04 footage before it is',
  ];
  body.forEach((line, i) => type(x, line, L, 640 + i * 46, 30, r));
  redact(x, L, 640 + 6 * 46 - 30, 190, 38, r);
  redact(x, L + 575, 640 + 6 * 46 - 30, 190, 38, r);
  redact(x, L + 650, 640 + 16 * 46 - 30, 290, 38, r);
  stamp(x, 'CONFIDENTIAL', W - 360, 520, -0.16, 78, '#a3141a', r);
  stamp(x, 'COPY', W - 210, H - 90, 0.1, 50, '#27407a', r);
  hand(x, 'R. Halloran', L + 20, H - 150, 84, '#1b2a6b', -0.05);
  x.fillStyle = 'rgba(28,25,21,0.7)'; x.fillRect(L, H - 130, 380, 2);
  hand(x, 'who ordered the fire?', W - 590, 1470, 64, '#1b2a6b', -0.06);
  return c;
}

function drawNewspaper() {
  const W = 1100, H = 1362, c = canvas(W, H), x = c.getContext('2d'), r = rng(19);
  paper(x, W, H, r, { tone: '#ddd5c1', age: 0.7, speckle: 14 });
  const ink = '#1a1917';
  x.fillStyle = ink;
  x.textAlign = 'center';
  x.font = `700 92px ${SERIF}`;
  x.fillText('The Evening Courier', W / 2, 120);
  x.fillRect(50, 140, W - 100, 4);
  x.font = `24px ${SERIF}`;
  x.fillText('CHICAGO, TUESDAY, OCTOBER 25, 1977  ·  FINAL EDITION  ·  15 CENTS', W / 2, 176);
  x.fillRect(50, 190, W - 100, 2);
  x.font = `700 104px ${HEAD}`;
  x.fillText('BLAZE GUTS', W / 2, 310);
  x.fillText('PIER 17 WAREHOUSE', W / 2, 420);
  x.font = `italic 40px ${SERIF}`;
  x.fillText('Police Suspect Arson; Mob Ties Probed', W / 2, 482);

  // halftone photo of the burning warehouse
  const px = 60, py = 520, pw = 560, ph = 400;
  const tmp = canvas(pw, ph), t = tmp.getContext('2d');
  const sky = t.createLinearGradient(0, 0, 0, ph);
  sky.addColorStop(0, '#555'); sky.addColorStop(1, '#bbb');
  t.fillStyle = sky; t.fillRect(0, 0, pw, ph);
  for (let i = 0; i < 40; i++) {
    t.fillStyle = `rgba(20,20,20,${0.08 + r() * 0.12})`;
    t.beginPath(); t.arc(220 + r() * 200 + i * 3, 160 - i * 4 + r() * 40, 40 + r() * 70, 0, Math.PI * 2); t.fill();
  }
  t.fillStyle = '#161616';
  t.fillRect(40, 230, 470, 170);
  t.beginPath(); t.moveTo(40, 230); t.lineTo(275, 160); t.lineTo(510, 230); t.fill();
  t.fillStyle = '#f2f2f2';
  for (let i = 0; i < 7; i++) t.fillRect(80 + i * 60, 280 + (i % 2) * 8, 28, 40 + r() * 30);
  x.fillStyle = '#e9e3d4'; x.fillRect(px, py, pw, ph);
  const src = t.getImageData(0, 0, pw, ph).data;
  x.fillStyle = ink;
  const step = 9;
  for (let yy = 0; yy < ph; yy += step) {
    for (let xx = (yy / step) % 2 ? step / 2 : 0; xx < pw; xx += step) {
      const l = src[(yy * pw + xx) * 4] / 255;
      const rad = (1 - l) * step * 0.62;
      if (rad > 0.4) { x.beginPath(); x.arc(px + xx, py + yy, rad, 0, Math.PI * 2); x.fill(); }
    }
  }
  x.textAlign = 'left';
  x.font = `italic 22px ${SERIF}`;
  x.fillText('Firemen battle the blaze early Sunday. (Courier photo)', px, py + ph + 34);

  // columns of copy
  x.font = `22px ${SERIF}`;
  const copy = 'Fire swept through a lakefront warehouse at Pier 17 early Sunday, leaving the building a blackened shell and raising new questions about the shipments that moved through its doors. Firemen answered the first alarm at 3:51 a.m. and fought the flames for more than four hours. No one was injured. Investigators said the blaze started in at least two places. A night watchman told police he saw a black sedan leave the gate minutes before the fire was reported. Harbor records list the tenant as a firm dealing in auto parts, but officials would not say what the building held. Federal agents were seen at the scene Monday. A spokesman declined to comment on reports that the warehouse was under surveillance. Neighbors said trucks came and went at odd hours all summer.';
  const lines = wrapLines(x, copy, 400);
  lines.slice(0, 15).forEach((l, i) => x.fillText(l, 650, 548 + i * 29));
  const lines2 = wrapLines(x, copy.split('. ').reverse().join('. '), W - 120);
  lines2.slice(0, 7).forEach((l, i) => x.fillText(l, 60, 1010 + i * 29));
  x.fillRect(630, 520, 2, 460);
  hand(x, 'same night as CAM 04!', 520, 1285, 58, '#9c1b1b', -0.05, 700);
  tear(x, W, H, r, { bottom: true, right: true, left: true });
  return c;
}

function drawSceneShot(shot) {
  const W = 1300, H = 975, c = canvas(W, H), x = c.getContext('2d'), r = rng(31);
  x.fillStyle = '#f3f0e8'; x.fillRect(0, 0, W, H);
  const b = 44, ph = H - b * 2 - 70;
  if (shot) x.drawImage(shot, 0, 0, shot.width, shot.height, b, b, W - b * 2, ph);
  else { x.fillStyle = '#333'; x.fillRect(b, b, W - b * 2, ph); }
  photoFinish(x, b, b, W - b * 2, ph, r, { contrast: 1.45, grain: 42, lift: 0.04 });
  x.strokeStyle = 'rgba(200,20,20,0.85)';
  x.lineWidth = 9;
  x.beginPath(); x.ellipse(W * 0.52, ph * 0.62, 250, 150, -0.1, 0.2, Math.PI * 2.05); x.stroke();
  hand(x, 'Pier 17 — Gate B — 10/23  2:14 AM', b + 10, H - 36, 64, '#1b2a6b', -0.01);
  return c;
}

function drawMugshot() {
  const W = 900, H = 1200, c = canvas(W, H), x = c.getContext('2d'), r = rng(43);
  x.fillStyle = '#f1eee6'; x.fillRect(0, 0, W, H);
  const b = 36, pw = W - b * 2, ph = H - b * 2 - 120;
  x.save(); x.beginPath(); x.rect(b, b, pw, ph); x.clip();
  x.fillStyle = '#b9b7b0'; x.fillRect(b, b, pw, ph);
  x.strokeStyle = '#3a3a3a'; x.fillStyle = '#3a3a3a'; x.lineWidth = 3;
  x.font = `30px ${TYPE}`;
  for (let i = 0; i < 9; i++) {
    const y = b + 60 + i * 100;
    x.beginPath(); x.moveTo(b, y); x.lineTo(b + pw, y); x.stroke();
    x.fillText(`${6 - Math.floor(i / 2)}'${i % 2 ? 0 : 6}"`, b + 14, y - 10);
  }
  const cx = W / 2, cy = b + 380;
  // suit & shoulders
  x.fillStyle = '#202020';
  x.beginPath(); x.moveTo(cx - 330, b + ph); x.bezierCurveTo(cx - 320, cy + 250, cx - 160, cy + 200, cx, cy + 210);
  x.bezierCurveTo(cx + 160, cy + 200, cx + 320, cy + 250, cx + 330, b + ph); x.fill();
  x.fillStyle = '#e8e8e8';
  x.beginPath(); x.moveTo(cx - 70, cy + 190); x.lineTo(cx, cy + 330); x.lineTo(cx + 70, cy + 190); x.fill();
  x.fillStyle = '#111'; x.fillRect(cx - 14, cy + 210, 28, 140);
  // neck + head
  x.fillStyle = '#8f8f8f'; x.fillRect(cx - 60, cy + 90, 120, 130);
  const face = x.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, 190);
  face.addColorStop(0, '#b4b4b4'); face.addColorStop(1, '#5c5c5c');
  x.fillStyle = face;
  x.beginPath(); x.ellipse(cx, cy, 128, 170, 0, 0, Math.PI * 2); x.fill();
  // slicked-back hair hugging the skull, a little receding at the temples
  x.fillStyle = '#1b1b1b';
  x.beginPath();
  x.moveTo(cx - 126, cy - 40);
  x.bezierCurveTo(cx - 140, cy - 150, cx - 60, cy - 195, cx, cy - 192);
  x.bezierCurveTo(cx + 60, cy - 195, cx + 140, cy - 150, cx + 126, cy - 40);
  x.bezierCurveTo(cx + 110, cy - 110, cx + 60, cy - 128, cx + 10, cy - 122);
  x.bezierCurveTo(cx - 60, cy - 128, cx - 110, cy - 110, cx - 126, cy - 40);
  x.fill();
  x.fillStyle = 'rgba(20,20,20,0.75)';
  x.beginPath(); x.ellipse(cx - 48, cy - 10, 26, 12, 0, 0, Math.PI * 2); x.ellipse(cx + 48, cy - 10, 26, 12, 0, 0, Math.PI * 2); x.fill();
  x.fillRect(cx - 80, cy - 42, 62, 9); x.fillRect(cx + 18, cy - 42, 62, 9);
  x.fillStyle = 'rgba(30,30,30,0.45)';
  x.beginPath(); x.moveTo(cx + 6, cy - 5); x.lineTo(cx + 22, cy + 55); x.lineTo(cx - 8, cy + 58); x.fill();
  x.fillRect(cx - 40, cy + 92, 80, 6);
  // placard
  x.fillStyle = '#121212'; x.fillRect(cx - 230, b + ph - 230, 460, 190);
  x.fillStyle = '#eee'; x.textAlign = 'center';
  x.font = `38px ${TYPE}`;
  x.fillText('POLICE DEPARTMENT', cx, b + ph - 170);
  x.font = `56px ${TYPE}`;
  x.fillText('77 - 4471', cx, b + ph - 108);
  x.font = `34px ${TYPE}`;
  x.fillText('10  26  77', cx, b + ph - 62);
  x.restore();
  // soften the drawn shapes so they read as an out-of-focus print
  x.save();
  x.filter = 'blur(4px)';
  x.drawImage(c, b, b, pw, ph - 250, b, b, pw, ph - 250);
  x.restore();
  photoFinish(x, b, b, pw, ph, r, { contrast: 1.2, grain: 40 });
  hand(x, 'V. Moretti — "The Tailor"', b + 6, H - 70, 70, '#1b2a6b', -0.02);
  return c;
}

function drawMap() {
  const W = 1400, H = 1011, c = canvas(W, H), x = c.getContext('2d'), r = rng(57);
  paper(x, W, H, r, { tone: '#e7e1cb', age: 0.45 });
  // lake
  x.fillStyle = '#b9c3c1';
  x.beginPath(); x.moveTo(W * 0.66, 0); x.bezierCurveTo(W * 0.6, H * 0.4, W * 0.7, H * 0.7, W * 0.62, H); x.lineTo(W, H); x.lineTo(W, 0); x.fill();
  x.strokeStyle = 'rgba(60,80,90,0.25)'; x.lineWidth = 2;
  for (let i = 0; i < 26; i++) { x.beginPath(); x.moveTo(W * 0.72 + i * 16, 0); x.lineTo(W * 0.66 + i * 16, H); x.stroke(); }
  // piers
  x.fillStyle = '#d8d1b8'; x.strokeStyle = '#4b4536'; x.lineWidth = 3;
  const piers = [[0.16, 'PIER 15'], [0.42, 'PIER 17'], [0.7, 'PIER 19']];
  for (const [py, name] of piers) {
    const y = H * py, x0 = W * 0.62;
    x.fillRect(x0, y, 300, 70); x.strokeRect(x0, y, 300, 70);
    x.fillStyle = '#3b362b'; x.font = `28px ${SERIF}`; x.fillText(name, x0 + 90, y + 46); x.fillStyle = '#d8d1b8';
  }
  // streets
  x.save();
  x.translate(0, 0);
  x.strokeStyle = '#5a5346';
  for (let i = 0; i < 10; i++) { x.lineWidth = i % 3 ? 3 : 7; x.beginPath(); x.moveTo(40, 60 + i * 100); x.lineTo(W * 0.63, 40 + i * 100 + 20); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.lineWidth = i % 2 ? 3 : 6; x.beginPath(); x.moveTo(60 + i * 110, 20); x.lineTo(40 + i * 110, H - 20); x.stroke(); }
  x.restore();
  x.fillStyle = '#3b362b';
  x.font = `italic 30px ${SERIF}`;
  x.fillText('LAKE', W * 0.82, H * 0.3); x.fillText('MICHIGAN', W * 0.8, H * 0.34);
  x.font = `24px ${SERIF}`;
  const streets = ['E. RANDOLPH ST', 'E. LAKE ST', 'WACKER DR', 'N. WATER ST', 'E. GRAND AVE'];
  streets.forEach((s, i) => x.fillText(s, 90 + (i % 2) * 180, 95 + i * 200));
  // warehouse block
  x.fillStyle = 'rgba(40,30,20,0.55)'; x.fillRect(W * 0.5, H * 0.43, 90, 70);
  // marker
  x.strokeStyle = 'rgba(190,20,20,0.9)'; x.lineWidth = 10;
  x.beginPath(); x.ellipse(W * 0.66, H * 0.46, 180, 120, 0.1, 0.3, Math.PI * 2.1); x.stroke();
  x.lineWidth = 8; x.beginPath(); x.moveTo(W * 0.54, H * 0.47); x.lineTo(W * 0.52, H * 0.72); x.stroke();
  hand(x, 'drop point? 2:14 AM', W * 0.34, H * 0.2, 70, '#a31818', -0.05, 700);
  hand(x, 'warehouse (burned)', W * 0.32, H * 0.8, 62, '#a31818', 0.03, 700);
  hand(x, 'Gate B', W * 0.72, H * 0.63, 58, '#a31818', 0.06, 700);
  fold(x, W / 2, 0, W / 2 + 6, H);
  fold(x, 0, H / 2, W, H / 2 - 4);
  tear(x, W, H, r, { left: true, top: true });
  return c;
}

function drawPolaroid() {
  const W = 880, H = 1080, c = canvas(W, H), x = c.getContext('2d'), r = rng(71);
  x.fillStyle = '#f2efe6'; x.fillRect(0, 0, W, H);
  const b = 52, pw = W - b * 2, ph = pw;
  x.save(); x.beginPath(); x.rect(b, b, pw, ph); x.clip();
  const sky = x.createLinearGradient(0, b, 0, b + ph);
  sky.addColorStop(0, '#0c1320'); sky.addColorStop(0.62, '#1a2233'); sky.addColorStop(1, '#0a0c10');
  x.fillStyle = sky; x.fillRect(b, b, pw, ph);
  const lamp = x.createRadialGradient(b + 150, b + 130, 5, b + 150, b + 130, 260);
  lamp.addColorStop(0, 'rgba(255,214,150,0.95)'); lamp.addColorStop(0.15, 'rgba(255,190,110,0.35)'); lamp.addColorStop(1, 'rgba(255,190,110,0)');
  x.fillStyle = lamp; x.fillRect(b, b, pw, ph);
  x.fillStyle = '#05070a'; x.fillRect(b + 145, b + 130, 10, ph);
  // sedan
  const cy = b + ph * 0.7;
  x.fillStyle = '#030406';
  x.beginPath();
  x.moveTo(b + 90, cy); x.lineTo(b + 150, cy - 70); x.lineTo(b + 300, cy - 88); x.lineTo(b + 470, cy - 90);
  x.lineTo(b + 560, cy - 60); x.lineTo(b + 700, cy - 50); x.lineTo(b + 720, cy + 40); x.lineTo(b + 80, cy + 40); x.fill();
  x.fillStyle = 'rgba(110,130,160,0.25)';
  x.beginPath(); x.moveTo(b + 200, cy - 72); x.lineTo(b + 300, cy - 84); x.lineTo(b + 450, cy - 84); x.lineTo(b + 520, cy - 60); x.lineTo(b + 200, cy - 60); x.fill();
  for (const wx of [210, 600]) { x.fillStyle = '#000'; x.beginPath(); x.arc(b + wx, cy + 40, 48, 0, Math.PI * 2); x.fill(); }
  const hl = x.createRadialGradient(b + 715, cy - 20, 2, b + 715, cy - 20, 150);
  hl.addColorStop(0, 'rgba(255,250,225,1)'); hl.addColorStop(0.2, 'rgba(255,240,200,0.5)'); hl.addColorStop(1, 'rgba(255,240,200,0)');
  x.fillStyle = hl; x.fillRect(b, b, pw, ph);
  x.fillStyle = 'rgba(255,240,200,0.12)';
  x.beginPath(); x.moveTo(b + 700, cy + 60); x.lineTo(b + pw, cy + 130); x.lineTo(b + pw, cy + 230); x.lineTo(b + 640, cy + 90); x.fill();
  x.restore();
  photoFinish(x, b, b, pw, ph, r, { contrast: 1.1, grain: 30, tint: [1.06, 0.98, 0.9], lift: 0.02 });
  hand(x, 'black sedan — plate ILL 4?7?', b, H - 90, 60, '#1b2a6b', -0.03);
  return c;
}

function drawSticky() {
  const W = 800, H = 800, c = canvas(W, H), x = c.getContext('2d'), r = rng(83);
  paper(x, W, H, r, { tone: '#f0d65f', age: 0.25, speckle: 8 });
  x.fillStyle = 'rgba(160,120,0,0.18)'; x.fillRect(0, 0, W, 110);
  hand(x, 'Who is', 70, 210, 110, '#1a1a1a', -0.04, 700);
  hand(x, 'THE ACCOUNTANT??', 44, 330, 86, '#1a1a1a', -0.03, 700);
  hand(x, 'follow the money', 70, 470, 92, '#1a1a1a', -0.02);
  hand(x, '→ watch CH 3', 70, 610, 100, '#b01818', -0.03, 700);
  hand(x, '2:14 AM', 330, 710, 88, '#b01818', -0.03, 700);
  x.strokeStyle = '#b01818'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(90, 632); x.quadraticCurveTo(360, 645, 620, 626); x.stroke();
  return c;
}

function drawIndexCard() {
  const W = 1360, H = 840, c = canvas(W, H), x = c.getContext('2d'), r = rng(97);
  paper(x, W, H, r, { tone: '#f4f1e8', age: 0.3, speckle: 6 });
  x.fillStyle = 'rgba(190,40,40,0.55)'; x.fillRect(0, 140, W, 4);
  x.fillStyle = 'rgba(60,110,190,0.35)';
  for (let y = 220; y < H; y += 80) x.fillRect(0, y, W, 3);
  type(x, 'KNOWN ASSOCIATES  —  77-1023', 70, 110, 52, r);
  const people = [
    ['V. MORETTI', '"The Tailor" - boss'],
    ['S. BENEDETTO', 'driver, black sedan'],
    ['E. KOWALSKI', 'dockmaster, Pier 17'],
    ['F. RUSSO', 'enforcer (switchblade)'],
    ['? ? ? ?', '"THE ACCOUNTANT"'],
  ];
  people.forEach(([n, role], i) => {
    const y = 210 + i * 80;
    type(x, n, 80, y, 44, r);
    type(x, role, 520, y, 40, r);
  });
  x.strokeStyle = '#b01818'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(70, 358); x.lineTo(1000, 350); x.stroke();
  hand(x, 'found in river 10/24', 1010, 326, 46, '#b01818', -0.06, 700);
  hand(x, 'who??', 1080, 540, 66, '#1b2a6b', -0.1, 700);
  return c;
}

/** layout in metres on the cork: centre (x, y above the floor), size, rotation */
export const EVIDENCE = [
  {
    id: 'karhutla', title: 'Karhutla Indonesia', draw: drawNewsCard,
    imageKey: 'karhutla', code: 'KLI P-01  /  KEBAKARAN HUTAN',
    headline: 'ASAP MENEKAN VISIBILITAS', location: 'RIAU  ·  1 JAN–4 SEP 2026',
    body: 'Luas lahan terbakar di Riau tercatat sekitar 18.882,16 hektare. Karhutla masih mendominasi laporan bencana pada awal September.',
    source: 'SUMBER: BNPB', date: '05 SEP 2026', seed: 307,
    w: 0.26, h: 0.195, x: -0.44, y: 1.3, rot: -0.07, gloss: true, pin: 0xc8201e,
  },
  {
    id: 'krakatau', title: 'Erupsi Anak Krakatau', draw: drawNewsCard,
    imageKey: 'krakatau', code: 'KLI P-02  /  GUNUNG API',
    headline: 'ERUPSI MENERUS 25 JAM', location: 'SELAT SUNDA  ·  4–6 SEP 2026',
    body: 'Episode erupsi menerus berakhir pada 6 September pukul 00.04 WIB. Status aktivitas tetap Level III (Siaga); radius bahaya 3 kilometer.',
    source: 'SUMBER: BADAN GEOLOGI / ESDM', date: '10 SEP 2026', seed: 311,
    w: 0.15, h: 0.2, x: -0.075, y: 1.3, rot: 0.05, gloss: true, pin: 0x2c55b8,
  },
  {
    id: 'gempa', title: 'Gempa Flores, NTT', draw: drawNewsCard,
    imageKey: 'gempa', code: 'KLI P-03  /  GEMPA BUMI',
    headline: 'GEMPA M7,7 GUNCANG FLORES', location: 'NTT  ·  15 AGUSTUS 2026  ·  04.58 WIB',
    body: 'Peringatan dini tsunami diakhiri pukul 07.30 WIB. Verifikasi BNPB mencatat 2.382 rumah rusak berat; data masih diperbarui.',
    source: 'SUMBER: BMKG / BNPB', date: '07 SEP 2026', seed: 313,
    w: 0.21, h: 0.28, x: 0.43, y: 1.2, rot: -0.03, gloss: true, pin: 0xc8201e,
  },
  {
    id: 'banjir', title: 'Banjir Langkat', draw: drawNewsCard,
    imageKey: 'banjir', code: 'KLI P-04  /  BANJIR',
    headline: '1.110 KK TERDAMPAK', location: 'LANGKAT, SUMATERA UTARA  ·  7 SEP 2026',
    body: 'Hujan deras dan tanggul jebol menggenangi tiga kecamatan. Ketinggian air dilaporkan sekitar 20–120 sentimeter.',
    source: 'SUMBER: BNPB', date: '08 SEP 2026', seed: 317,
    w: 0.21, h: 0.26, x: -0.47, y: 0.93, rot: 0.08, pin: 0xe0b31c,
  },
  {
    id: 'longsor', title: 'Longsor Bandung', draw: drawNewsCard,
    imageKey: 'longsor', code: 'KLI P-05  /  TANAH LONGSOR',
    headline: '3 RUMAH RUSAK', location: 'KUTAWARINGIN, JAWA BARAT  ·  9 SEP 2026',
    body: 'Tanggul irigasi jebol memicu longsor. Dua rumah rusak berat, satu rusak sedang, dan sekitar 20 jiwa terdampak.',
    source: 'SUMBER: ANTARA', date: '09 SEP 2026', seed: 331,
    w: 0.27, h: 0.195, x: -0.06, y: 0.985, rot: -0.045, pin: 0x2f8a3a,
  },
  {
    id: 'bbm', title: 'Krisis BBM Makassar', draw: drawNewsCard,
    imageKey: 'bbm', code: 'KLI P-06  /  ENERGI',
    headline: 'KRISIS BBM MAKASSAR', location: 'MAKASSAR, SULAWESI SELATAN  ·  SEP 2026',
    body: 'Antrean SPBU mengular beberapa kilometer selama sebulan. Pembelian BBM subsidi diatur ganjil-genap pelat nomor pada 13–20 September; SPBU modular dibuka di CPI.',
    source: 'SUMBER: ANTARA', date: '14 SEP 2026', credit: 'ILUSTRASI', seed: 337,
    w: 0.16, h: 0.19, x: 0.2, y: 1.2, rot: 0.04, pin: 0xe0b31c,
  },
  {
    id: 'situasi', title: 'Ringkasan bencana 2026', draw: drawSituationCard,
    w: 0.17, h: 0.105, x: -0.07, y: 0.8, rot: 0.035, pin: 0x2c55b8,
  },
  {
    id: 'note', title: 'Catatan sumber resmi', draw: drawFieldNote,
    w: 0.095, h: 0.095, x: 0.585, y: 0.95, rot: 0.14, pin: 0xc8201e,
  },
];

/** red string between pins, by id */
export const STRINGS = [
  ['karhutla', 'krakatau'], ['krakatau', 'gempa'], ['karhutla', 'banjir'], ['banjir', 'longsor'],
  ['longsor', 'situasi'], ['situasi', 'gempa'], ['longsor', 'note'], ['situasi', 'note'], ['krakatau', 'longsor'],
  ['krakatau', 'bbm'], ['bbm', 'gempa'],
];

export async function loadPaperFonts() {
  const faces = ['32px "Special Elite"', '600 32px Caveat', '700 32px Caveat', '700 32px Oswald', '32px VT323'];
  await Promise.allSettled(faces.map((f) => document.fonts.load(f)));
}
