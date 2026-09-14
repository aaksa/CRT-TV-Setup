import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import '@fontsource/special-elite';
import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import '@fontsource/oswald/700.css';
import '@fontsource/vt323';
import './style.css';

import { CameraRig, stepTweens, tween, ease, damp } from './motion.js';
import { AudioFX } from './audio.js';
import { CRTScreen } from './crt.js';
import { RemoteControl } from './remote.js';
import { EvidenceBoard } from './board.js';
import { Room } from './environment.js';
import { loadNewsImages, loadPaperFonts } from './papers.js';

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio, 1.75);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.02, 40);
const rig = new CameraRig(camera);

RectAreaLightUniformsLib.init();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.07;

const room = new Room(scene, renderer);
const audio = new AudioFX();

// The main shot reproduces the Blender viewport composition (same look-at
// point and view direction), with a longer lens for a more cinematic feel.
const MAIN = (() => {
  const target = new THREE.Vector3(0.55, 0.75, -1.1);
  const dir = new THREE.Vector3(0.7256, -0.2241, -2.0836).normalize();
  return { pos: target.clone().addScaledVector(dir, -3.9), target, fov: 42 };
})();
const INTRO = {
  pos: MAIN.pos.clone().add(new THREE.Vector3(-0.5, 0.42, 1.9)),
  target: MAIN.target.clone().add(new THREE.Vector3(-0.1, 0.2, 0)),
  fov: 42,
};
rig.set(INTRO);

// ------------------------------------------------------------------ post
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.6 },
    uGrain: { value: 0.055 },
    uAberration: { value: 0.014 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uAberration, uFade;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec2 off = d * dot(d, d) * uAberration;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c * vec3(0.9, 1.0, 1.08), c * vec3(1.06, 1.0, 0.92), smoothstep(0.05, 0.6, l));
      c *= mix(1.0, smoothstep(0.92, 0.2, length(d * vec2(1.0, 0.85))), uVignette);
      c += (hash(vUv * 1000.0 + fract(uTime * 7.13) * 100.0) - 0.5) * uGrain * (0.6 + 0.4 * (1.0 - l));
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
    }`,
};

const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const outline = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outline.edgeStrength = 4.5;
outline.edgeGlow = 1.1;
outline.edgeThickness = 2.2;
outline.pulsePeriod = 0;
outline.visibleEdgeColor.set(0xffc98a);
outline.hiddenEdgeColor.set(0x1a1108);
composer.addPass(outline);
// high threshold: only true highlights (bulb, hot spots on the tube) glow — a large
// bright picture shouldn't haze over the whole screen
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const film = new ShaderPass(FilmShader);
composer.addPass(film);

// ------------------------------------------------------------------ ui bits
const $loader = document.getElementById('loader');
const $status = document.getElementById('load-status');
const $bar = document.getElementById('load-bar');
const $enter = document.getElementById('enter');
const $caption = document.getElementById('caption');
let captionTimer;
function caption(text, seconds = 5.5) {
  clearTimeout(captionTimer);
  $caption.classList.remove('show');
  if (!text) return;
  setTimeout(() => {
    $caption.textContent = text;
    $caption.classList.add('show');
    captionTimer = setTimeout(() => $caption.classList.remove('show'), seconds * 1000);
  }, 250);
}

// pop-up subtitles for the programme on the TV, pinned under the screen
const $subtitle = document.getElementById('subtitle');
const $subtitleText = $subtitle.firstElementChild;
const subtitleUI = { text: '', anchor: null, width: 0 };
const _subPos = new THREE.Vector3();

function updateSubtitle() {
  const text = state === 'main' || state === 'tv' ? crt.subtitle : '';
  if (text !== subtitleUI.text) {
    subtitleUI.text = text;
    if (text) {
      $subtitleText.textContent = text;
      $subtitle.classList.remove('pop');
      void $subtitle.offsetWidth; // restart the pop animation
      $subtitle.classList.add('pop', 'show');
    } else {
      $subtitle.classList.remove('show');
    }
  }
  if (!subtitleUI.text) return;
  $subtitle.classList.toggle('near', state === 'tv');
  subtitleUI.width = $subtitle.offsetWidth;
  _subPos.copy(subtitleUI.anchor).project(camera);
  const w = window.innerWidth, h = window.innerHeight;
  const half = subtitleUI.width / 2;
  const x = THREE.MathUtils.clamp(((_subPos.x + 1) / 2) * w, half + 16, w - half - 16);
  const y = THREE.MathUtils.clamp(((1 - _subPos.y) / 2) * h, 16, h - $subtitle.offsetHeight - 48);
  $subtitle.style.transform = `translate(${Math.round(x - half)}px, ${Math.round(y)}px)`;
}

// ------------------------------------------------------------------ world
let crt, remote, evidence, screenLight, tvParts, pickList, boardMesh, screenCentre;
let tvObjects, remoteObjects;

async function build() {
  const draco = new DRACOLoader().setDecoderPath('draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const [gltf, remoteOpacity, _paperFonts, newsImages] = await Promise.all([
    loader.loadAsync('models/room.glb', (e) => {
      const p = e.total ? e.loaded / e.total : e.loaded / 5.6e6;
      $bar.style.width = `${Math.min(p, 1) * 80}%`;
    }),
    new THREE.TextureLoader().loadAsync('textures/remote-opacity.png'),
    loadPaperFonts(),
    loadNewsImages(),
  ]);
  remoteOpacity.flipY = false; // glTF UV convention
  $status.textContent = 'arranging the room…';

  const root = gltf.scene;
  scene.add(root);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (m && m.map) m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
  const get = (n) => root.getObjectByName(n);
  const tvBody = get('TV_Body');
  const tvScreen = get('TV_Screen');
  const vcr = get('VCR');
  boardMesh = get('EvidenceBoard');
  tvParts = [tvBody, tvScreen, vcr];

  crt = new CRTScreen(renderer, tvScreen, audio);
  tvScreen.castShadow = false;
  remote = new RemoteControl(get('Remote'), scene, remoteOpacity);

  // the tube as a light source: an area light over the glass, fed by the picture
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tvScreen);
  screenCentre = box.getCenter(new THREE.Vector3());
  screenLight = new THREE.RectAreaLight(0xffffff, 0, box.max.x - box.min.x, box.max.y - box.min.y);
  screenLight.position.set(screenCentre.x, screenCentre.y, box.max.z + 0.005);
  screenLight.lookAt(screenCentre.x, screenCentre.y, box.max.z + 5);
  scene.add(screenLight);
  subtitleUI.anchor = new THREE.Vector3(screenCentre.x, box.min.y - 0.035, box.max.z);

  // the surveillance photo on the board is a real frame of this room
  crt.update(0.016, 0);
  const shot = renderShot();
  evidence = new EvidenceBoard(boardMesh, renderer, shot, newsImages);

  tvObjects = new Set([tvBody, tvScreen, vcr]);
  remoteObjects = new Set();
  remote.root.traverse((o) => remoteObjects.add(o));
  pickList = [];
  root.traverse((o) => o.isMesh && pickList.push(o));
  remote.root.traverse((o) => o.isMesh && !pickList.includes(o) && pickList.push(o));
  pickList.push(...evidence.pickables);

  $bar.style.width = '92%';
  renderer.compile(scene, camera);
  $bar.style.width = '100%';
}

function renderShot() {
  const w = 1024, h = 640;
  const rt = new THREE.WebGLRenderTarget(w, h);
  const cam = new THREE.PerspectiveCamera(34, w / h, 0.05, 20);
  cam.position.set(2.05, 0.82, 1.15);
  cam.lookAt(0.15, 0.5, -0.75);
  const fog = scene.fog.density;
  scene.fog.density = 0.05;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null);
  scene.fog.density = fog;
  rt.dispose();
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.pow(Math.min(1, (i / 255) * 3.2), 1 / 2.2) * 255;
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4, dst = y * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      img.data[dst + x] = lut[px[src + x]];
      img.data[dst + x + 1] = lut[px[src + x + 1]];
      img.data[dst + x + 2] = lut[px[src + x + 2]];
      img.data[dst + x + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ views
function tvPose() {
  const c = screenCentre;
  const fov = 40;
  // pull back on narrow screens so the whole set (≈0.85 m wide) stays in frame
  const t = Math.tan(THREE.MathUtils.degToRad(rig.fitFov(fov)) / 2);
  const dist = Math.max(0.95, 0.44 / (t * camera.aspect));
  return {
    pos: new THREE.Vector3(c.x + 0.03, c.y + 0.075 * (dist / 0.95), c.z + dist),
    target: new THREE.Vector3(c.x + 0.005, c.y - 0.05, c.z),
    fov,
  };
}
const boardFov = 38;
const noteFov = 34;

let state = 'intro';
let busy = true;
const look = { vignette: 0.55 };

function setLook(mode) {
  const v = mode === 'main' ? 0.55 : 0.85;
  const from = look.vignette;
  tween({ key: 'look', duration: 1.6, update: (e) => { look.vignette = THREE.MathUtils.lerp(from, v, e); } });
}

async function enterRoom() {
  audio.start();
  audio.resume();
  crt.unlockMedia();
  audio.setHum(true);
  $loader.classList.add('gone');
  tween({ key: 'fade', duration: 2.6, easing: ease.outCubic, update: (e) => { film.uniforms.uFade.value = 1 - e; } });
  await rig.flyTo({ ...MAIN, duration: 4.4, arc: 0, parallax: 0.06 });
  state = 'main';
  busy = false;
  caption('Some things in this room still answer to a touch.', 6);
}

async function enterTV() {
  busy = true;
  state = 'tv';
  clearHover();
  room.setFocus('tv');
  setLook('tv');
  const pose = tvPose();
  remote.pickUp(remote.computeHandPose(pose.pos, pose.target, camera.aspect), 1.8, 0.3);
  await rig.flyTo({ ...pose, duration: 1.9, arc: 0.05, parallax: 0.012 });
  busy = false;
  caption('Use the remote.  Click the dark to step back.');
}

async function exitTV() {
  busy = true;
  state = 'main';
  clearHover();
  room.setFocus('main');
  setLook('main');
  remote.putDown(1.5);
  await rig.flyTo({ ...MAIN, duration: 2.0, arc: 0.08, parallax: 0.06 });
  busy = false;
}

async function enterBoard() {
  busy = true;
  state = 'board';
  clearHover();
  room.setFocus('board');
  setLook('board');
  const pose = evidence.boardPose(camera.aspect, rig.fitFov(boardFov));
  await rig.flyTo({ ...pose, fov: boardFov, duration: 2.0, arc: 0.1, parallax: 0.02 });
  busy = false;
  caption('Choose a document.  Click the dark to step back.');
}

async function exitBoard() {
  busy = true;
  state = 'main';
  clearHover();
  room.setFocus('main');
  setLook('main');
  await rig.flyTo({ ...MAIN, duration: 2.0, arc: 0.1, parallax: 0.06 });
  busy = false;
}

async function enterNote(item) {
  busy = true;
  state = 'note';
  clearHover();
  evidence.focused = item;
  room.setFocus('note');
  audio.paper();
  const pose = evidence.notePose(item, camera.aspect, rig.fitFov(noteFov));
  await rig.flyTo({ ...pose, fov: noteFov, duration: 1.35, arc: 0.015, parallax: 0.005 });
  busy = false;
  caption(`${item.def.title}.  Click anywhere to pin it back.`, 4);
}

async function exitNote() {
  busy = true;
  state = 'board';
  evidence.focused = null;
  room.setFocus('board');
  audio.paper();
  const pose = evidence.boardPose(camera.aspect, rig.fitFov(boardFov));
  await rig.flyTo({ ...pose, fov: boardFov, duration: 1.3, arc: 0.02, parallax: 0.02 });
  busy = false;
}

function back() {
  if (busy) return;
  if (state === 'tv') exitTV();
  else if (state === 'note') exitNote();
  else if (state === 'board') exitBoard();
}

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerInside = false;
let pointerDirty = false;
let hovered = { kind: null, obj: null };

function classify(obj) {
  if (!obj) return null;
  if (obj.name.startsWith('RBTN_')) return 'button';
  if (obj.userData.item) return 'item';
  if (remoteObjects.has(obj)) return 'remote';
  let o = obj;
  while (o) {
    if (tvObjects.has(o)) return 'tv';
    if (o === boardMesh) return 'board';
    o = o.parent;
  }
  return 'other';
}

function pick() {
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(pickList, false)[0];
  return hit ? { hit, kind: classify(hit.object) } : { hit: null, kind: null };
}

function setCursor(on) { document.body.classList.toggle('pointer', !!on); }

function clearHover() {
  hovered = { kind: null, obj: null };
  outline.selectedObjects = [];
  crt?.setHover(false);
  remote?.setHover(null);
  if (evidence) evidence.hovered = null;
  setCursor(false);
}

function updateHover() {
  if (!pointerInside || busy || state === 'intro') { if (hovered.kind) clearHover(); return; }
  const { hit, kind } = pick();
  if (state === 'main') {
    const k = kind === 'tv' || kind === 'remote' || kind === 'button' ? 'tv' : kind === 'board' || kind === 'item' ? 'board' : null;
    if (k === hovered.kind) return;
    hovered = { kind: k, obj: null };
    outline.selectedObjects = k === 'tv' ? tvParts : k === 'board' ? [boardMesh] : [];
    crt.setHover(k === 'tv');
    setCursor(k);
  } else if (state === 'tv') {
    const b = kind === 'button' ? hit.object : null;
    remote.setHover(b);
    setCursor(b);
  } else if (state === 'board') {
    const item = kind === 'item' ? hit.object.userData.item : null;
    if (item !== evidence.hovered) {
      evidence.hovered = item;
      outline.selectedObjects = item ? [item.mesh] : [];
    }
    setCursor(item);
  } else if (state === 'note') {
    setCursor(true);
  }
}

function pressButton(btn, point) {
  const label = btn.userData.label;
  const half = label === 'VOL' || label === 'CH' ? remote.half(btn, point) : 0;
  remote.press(btn);
  audio.click();
  crt.press(label, half);
}

function handleClick() {
  if (busy) return;
  const { hit, kind } = pick();
  if (state === 'main') {
    if (kind === 'tv' || kind === 'remote' || kind === 'button') enterTV();
    else if (kind === 'board' || kind === 'item') enterBoard();
  } else if (state === 'tv') {
    if (kind === 'button') pressButton(hit.object, hit.point);
    else if (kind !== 'tv' && kind !== 'remote') exitTV();
  } else if (state === 'board') {
    if (kind === 'item') enterNote(hit.object.userData.item);
    else if (kind !== 'board') exitBoard();
  } else if (state === 'note') {
    exitNote();
  }
}

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rig.pointer.copy(pointer);
  pointerInside = true;
  pointerDirty = true;
}

let down = null;
canvas.addEventListener('pointermove', (e) => setPointer(e));
canvas.addEventListener('pointerleave', () => { pointerInside = false; rig.pointer.set(0, 0); });
canvas.addEventListener('pointerdown', (e) => {
  audio.resume();
  setPointer(e);
  down = { x: e.clientX, y: e.clientY, button: e.button };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const btn = down.button;
  down = null;
  if (moved > 8) return;
  setPointer(e);
  if (btn === 2) return back();
  updateHover();
  handleClick();
  if (e.pointerType !== 'mouse') { pointerInside = false; clearHover(); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Backspace') return back();
  if (state !== 'tv' || busy) return;
  const map = { ArrowUp: ['CH', 1], ArrowDown: ['CH', -1], ArrowRight: ['VOL', 1], ArrowLeft: ['VOL', -1], p: ['POWER', 0], m: ['MUTE', 0], i: ['INFO', 0] };
  const hit = /^\d$/.test(e.key) ? [e.key, 0] : map[e.key];
  if (!hit) return;
  const btn = remote.buttons.find((b) => b.userData.label === hit[0]);
  if (btn) remote.press(btn);
  audio.click();
  crt.press(hit[0], hit[1]);
});

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  if (busy || !evidence) return;
  // re-frame the current view for the new shape
  if (state === 'tv') {
    const pose = tvPose();
    rig.set(pose);
    remote.handPose = remote.computeHandPose(pose.pos, pose.target, camera.aspect);
    remote.root.quaternion.copy(remote.handPose.quat);
  } else if (state === 'board') {
    rig.set({ ...evidence.boardPose(camera.aspect, rig.fitFov(boardFov)), fov: boardFov });
  } else if (state === 'note' && evidence.focused) {
    rig.set({ ...evidence.notePose(evidence.focused, camera.aspect, rig.fitFov(noteFov)), fov: noteFov });
  }
});

document.addEventListener('visibilitychange', () => {
  if (!crt) return;
  const v = crt.current?.video;
  if (document.hidden) v?.pause();
  else if (crt.power) v?.play().catch(() => {});
});

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let started = false;

function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  const t = clock.elapsedTime;
  // transitions follow wall-clock time so a slow device doesn't stretch them out
  stepTweens(Math.min(raw, 1));
  adaptQuality(raw);

  rig.update(dt, t);
  camera.userData.basis = rig.basis();
  room.update(t, Math.min(raw, 0.2), camera);

  if (crt) {
    const fx = Math.min(raw, 0.2); // screen effects & object easing keep wall-clock pace
    crt.update(fx, t);
    screenLight.color.copy(crt.lightColor);
    screenLight.intensity = crt.lightLevel * 26;
    remote.update(fx, t);
    evidence.update(fx);
    if (pointerDirty || !busy) { updateHover(); pointerDirty = false; }
    updateSubtitle();
  }

  film.uniforms.uTime.value = t;
  film.uniforms.uVignette.value = look.vignette;
  composer.render(dt);
  stats.frames++;
  requestAnimationFrame(frame);
}
const stats = { frames: 0, dpr: DPR };

// drop resolution a step if the machine can't hold ~40 fps
const quality = { acc: 0, n: 0 };
function adaptQuality(raw) {
  if (document.hidden || state === 'intro' || raw > 0.25) return;
  quality.acc += raw;
  quality.n++;
  if (quality.n < 120) return;
  const avg = quality.acc / quality.n;
  quality.acc = quality.n = 0;
  if (avg > 0.025 && stats.dpr > 1) {
    stats.dpr = Math.max(1, stats.dpr - 0.35);
    renderer.setPixelRatio(stats.dpr);
    composer.setPixelRatio(stats.dpr);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

// ------------------------------------------------------------------ boot
build()
  .then(() => {
    $status.textContent = 'the tape is ready.';
    $enter.hidden = false;
    $enter.focus({ preventScroll: true });
    if (!started) { started = true; requestAnimationFrame(frame); }
  })
  .catch((err) => {
    console.error(err);
    $status.textContent = 'the evidence could not be loaded. (see console)';
  });

$enter.addEventListener('click', () => { $enter.disabled = true; enterRoom(); });

// render behind the loader so shaders compile and the static is running
requestAnimationFrame(() => { if (!started) { started = true; requestAnimationFrame(frame); } });

// dev-only console hooks
if (import.meta.env.DEV) Object.assign(window, {
  __room: {
    scene, camera, rig, enterTV, enterBoard, back,
    get crt() { return crt; }, get remote() { return remote; }, get board() { return evidence; },
    get state() { return { state, busy }; },
    stats,
    pickAt(x, y) {
      pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      const { hit, kind } = pick();
      return hit && { kind, name: hit.object.name, d: hit.distance };
    },
  },
});
