import * as THREE from 'three';
import { damp, reducedMotion } from './motion.js';

function surfaceTexture(size, base, spread, stains, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // blotchy low-frequency variation
  for (let i = 0; i < stains; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    const dark = r() > 0.5;
    g.addColorStop(0, dark ? `rgba(0,0,0,${0.05 + r() * 0.1})` : `rgba(255,255,255,${0.02 + r() * 0.04})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save();
    x.translate(r() * size, r() * size);
    x.scale(20 + r() * size * 0.25, 20 + r() * size * 0.25);
    x.fillStyle = g;
    x.fillRect(-1, -1, 2, 2);
    x.restore();
  }
  const img = x.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * spread;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  // hairline cracks
  x.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 14; i++) {
    let px = r() * size, py = r() * size;
    x.lineWidth = 0.6 + r();
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 12; k++) { px += (r() - 0.5) * 40; py += (r() - 0.5) * 40; x.lineTo(px, py); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const beamVertex = /* glsl */ `
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vAlong = 1.0 - (position.y + 0.5);          // 0 at apex → 1 at the base
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
    float fall = smoothstep(0.0, 0.12, vAlong) * (1.0 - smoothstep(0.35, 1.0, vAlong));
    gl_FragColor = vec4(uColor * edge * fall * uStrength, 1.0);
  }
`;

const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightPos[2];
  uniform vec3 uLightDir[2];
  uniform float uCos[2];
  uniform float uPx;
  attribute float aSeed;
  varying float vLit;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.12;
    p.y += mod(uTime * 0.015 * (0.4 + aSeed), 2.4) - 1.2;
    p.y = mod(p.y, 2.5);
    p.z += cos(uTime * 0.09 + aSeed * 31.0) * 0.12;
    float lit = 0.0;
    for (int i = 0; i < 2; i++) {
      vec3 d = normalize(p - uLightPos[i]);
      lit += smoothstep(uCos[i], uCos[i] + 0.06, dot(d, uLightDir[i]));
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // motes right in front of the lens would read as big blobs
    vLit = lit * (0.4 + 0.6 * fract(aSeed * 91.7)) * smoothstep(0.5, 1.4, -mv.z);
    gl_PointSize = min((0.35 + fract(aSeed * 13.1)) * uPx / -mv.z, uPx * 0.9);
    gl_Position = projectionMatrix * mv;
  }
`;
const dustFragment = /* glsl */ `
  varying float vLit;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a * vLit * 0.22, 1.0);
  }
`;

/**
 * Dark room around the props: concrete floor + two walls, a hanging lamp
 * that sways (moving shadows), a board light, cold moonlight rim, dust.
 */
export class Room {
  constructor(scene, renderer) {
    this.scene = scene;
    scene.background = new THREE.Color(0x040506);
    scene.fog = new THREE.FogExp2(0x040506, 0.14);

    const floorMap = surfaceTexture(1024, '#5b5852', 38, 90, 11);
    floorMap.repeat.set(5, 5);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.9, metalness: 0, color: 0x8a8781 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMap = surfaceTexture(1024, '#4a4e52', 22, 60, 29);
    wallMap.repeat.set(3, 1.2);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.95, color: 0x70757a });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallMat);
    back.position.set(0.8, 2.5, -2.7);
    back.receiveShadow = true;
    const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-2.4, 2.5, 0.5);
    left.receiveShadow = true;
    scene.add(back, left);

    // ---------------------------------------------------------------- lights
    this.hemi = new THREE.HemisphereLight(0x1c2536, 0x0a0806, 0.55);
    scene.add(this.hemi);

    this.moon = new THREE.DirectionalLight(0x7d9bd6, 0.5);
    this.moon.position.set(-3, 3.2, -3.5);
    this.moon.target.position.set(0.5, 0.6, -0.8);
    scene.add(this.moon, this.moon.target);

    // hanging lamp: pivot at the ceiling, light at the shade
    this.pivot = new THREE.Group();
    this.pivot.position.set(0.3, 3.4, -0.45);
    scene.add(this.pivot);
    const drop = 1.3;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, drop, 6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
    cord.position.y = -drop / 2;
    const shadeProfile = [new THREE.Vector2(0.02, 0), new THREE.Vector2(0.05, -0.02), new THREE.Vector2(0.1, -0.1), new THREE.Vector2(0.17, -0.2), new THREE.Vector2(0.175, -0.205)];
    const shade = new THREE.Mesh(
      new THREE.LatheGeometry(shadeProfile, 40),
      new THREE.MeshStandardMaterial({ color: 0x2b3a2f, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }),
    );
    shade.position.y = -drop;
    shade.castShadow = false;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 20, 12),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc27a, emissiveIntensity: 9 }),
    );
    bulb.position.y = -drop - 0.12;
    this.pivot.add(cord, shade, bulb);
    this.bulb = bulb;

    this.key = new THREE.SpotLight(0xffb46e, 16, 8, 0.58, 0.62, 1.7);
    this.key.position.set(0, -drop - 0.13, 0);
    this.keyTarget = new THREE.Object3D();
    this.keyTarget.position.set(0.25, 0.45, -0.75);
    scene.add(this.keyTarget);
    this.key.target = this.keyTarget;
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0002;
    this.key.shadow.normalBias = 0.015;
    this.key.shadow.radius = 4;
    this.key.shadow.camera.near = 0.3;
    this.key.shadow.camera.far = 6;
    this.pivot.add(this.key);

    // soft warm light raking across the evidence board
    this.boardLight = new THREE.SpotLight(0xffd6a0, 9, 7, 0.46, 0.75, 1.6);
    this.boardLight.position.set(-0.35, 2.55, 0.35);
    this.boardLight.target.position.set(1.15, 0.95, -1.2);
    this.boardLight.castShadow = true;
    this.boardLight.shadow.mapSize.set(1536, 1536);
    this.boardLight.shadow.bias = -0.0003;
    this.boardLight.shadow.normalBias = 0.01;
    this.boardLight.shadow.radius = 3;
    this.boardLight.shadow.camera.near = 0.5;
    this.boardLight.shadow.camera.far = 6;
    scene.add(this.boardLight, this.boardLight.target);

    // close fill that follows the viewer in focused views (reads the remote & paper)
    this.fill = new THREE.PointLight(0xffe0bd, 0, 1.6, 2);
    scene.add(this.fill);

    // ---------------------------------------------------------------- beam
    const beamLen = 2.6;
    const beamGeo = new THREE.CylinderGeometry(0.06, Math.tan(0.5) * beamLen, 1, 48, 1, true);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xffb46e) }, uStrength: { value: 0.05 } },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.scale.set(1, beamLen, 1);
    this.beam.renderOrder = 5;
    scene.add(this.beam);

    // ---------------------------------------------------------------- dust
    const N = 900;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -0.9 + Math.random() * 2.9;
      pos[i * 3 + 1] = Math.random() * 2.5;
      pos[i * 3 + 2] = -1.8 + Math.random() * 2.6;
      seed[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLightPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
        uLightDir: { value: [new THREE.Vector3(), new THREE.Vector3()] },
        uCos: { value: [Math.cos(0.58), Math.cos(0.46)] },
        uPx: { value: 6 * renderer.getPixelRatio() },
      },
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dust = new THREE.Points(dg, this.dustMat);
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    this.levels = { key: 16, board: 9, fill: 0, moon: 0.5 };
    this.target = { ...this.levels };
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  /** mood per view: focus the eye by dimming what isn't the subject */
  setFocus(mode) {
    const t = this.target;
    if (mode === 'tv') Object.assign(t, { key: 9, board: 2.5, fill: 0.5, moon: 0.35 });
    else if (mode === 'board') Object.assign(t, { key: 6, board: 13, fill: 0.2, moon: 0.4 });
    else if (mode === 'note') Object.assign(t, { key: 4.5, board: 8.5, fill: 0.45, moon: 0.35 });
    else Object.assign(t, { key: 16, board: 9, fill: 0, moon: 0.5 });
  }

  update(t, dt, camera) {
    const sway = reducedMotion ? 0 : 1;
    this.pivot.rotation.z = Math.sin(t * 0.52) * 0.035 * sway;
    this.pivot.rotation.x = Math.sin(t * 0.37 + 1.3) * 0.022 * sway;
    this.pivot.updateMatrixWorld();

    for (const k of Object.keys(this.levels)) this.levels[k] = damp(this.levels[k], this.target[k], 2.2, dt);
    const flick = 1 + (Math.sin(t * 17.0) * Math.sin(t * 7.3) > 0.97 ? -0.08 : 0);
    this.key.intensity = this.levels.key * flick;
    this.bulb.material.emissiveIntensity = 9 * flick;
    this.boardLight.intensity = this.levels.board;
    this.moon.intensity = this.levels.moon;
    this.fill.intensity = this.levels.fill;
    const { f, u } = camera.userData.basis ?? {};
    if (f) this.fill.position.copy(camera.position).addScaledVector(u, 0.25).addScaledVector(f, 0.08);

    // beam follows the swinging lamp
    const apex = this.key.getWorldPosition(this._a);
    const dir = this._b.copy(this.keyTarget.position).sub(apex).normalize();
    this.beam.position.copy(apex).addScaledVector(dir, this.beam.scale.y / 2);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this.beamMat.uniforms.uStrength.value = 0.045 * (this.levels.key / 16) * flick;

    const du = this.dustMat.uniforms;
    du.uTime.value = t;
    du.uLightPos.value[0].copy(apex);
    du.uLightDir.value[0].copy(dir);
    du.uLightPos.value[1].copy(this.boardLight.position);
    du.uLightDir.value[1].copy(this.boardLight.target.position).sub(this.boardLight.position).normalize();
  }
}
