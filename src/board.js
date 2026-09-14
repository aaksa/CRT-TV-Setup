import * as THREE from 'three';
import { EVIDENCE, STRINGS } from './papers.js';
import { damp } from './motion.js';

// Cork surface of the exported board in its local space (measured in Blender):
// front faces local +Z, cork sits 5 mm behind the origin plane.
const CORK_Z = -0.0053;
const CORK_CENTRE_Y = 0.965; // metres above the floor
const CORK_SIZE = { w: 1.48, h: 0.99 };

function paperGeometry(w, h, seed) {
  const g = new THREE.PlaneGeometry(w, h, 12, 16);
  const p = g.attributes.position;
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  const side = s - Math.floor(s) > 0.5 ? 1 : -1;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (w / 2);
    const ny = p.getY(i) / (h / 2);
    // pinned at the top: flat there, the lower corners lift off the cork
    const lift = Math.max(0, -ny + 0.2) ** 2 * 0.0045 * (0.6 + 0.4 * nx * side);
    p.setZ(i, nx * nx * 0.0014 + lift);
  }
  g.computeVertexNormals();
  return g;
}

const pinGeo = {
  head: new THREE.CylinderGeometry(0.0052, 0.0062, 0.007, 20).rotateX(Math.PI / 2).translate(0, 0, 0.009),
  cap: new THREE.SphereGeometry(0.0052, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, 0.0125),
  shaft: new THREE.CylinderGeometry(0.0018, 0.0026, 0.006, 12).rotateX(Math.PI / 2).translate(0, 0, 0.003),
  needle: new THREE.CylinderGeometry(0.0004, 0.0004, 0.012, 6).rotateX(Math.PI / 2).translate(0, 0, -0.004),
};
const steel = new THREE.MeshStandardMaterial({ color: 0xb9b9b9, metalness: 1, roughness: 0.3 });

function makePin(color) {
  const plastic = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0 });
  const pin = new THREE.Group();
  for (const [geo, mat] of [[pinGeo.head, plastic], [pinGeo.cap, plastic], [pinGeo.shaft, plastic], [pinGeo.needle, steel]]) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    pin.add(m);
  }
  pin.rotation.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0);
  return pin;
}

export class EvidenceBoard {
  constructor(boardMesh, renderer, sceneShot, newsImages) {
    this.mesh = boardMesh;
    const s = new THREE.Vector3();
    boardMesh.updateWorldMatrix(true, false);
    boardMesh.getWorldScale(s);
    this.anchor = new THREE.Group(); // metres, origin at cork surface / floor height
    this.anchor.position.set(0, 0, CORK_Z);
    this.anchor.scale.setScalar(1 / s.x);
    boardMesh.add(this.anchor);

    const aniso = renderer.capabilities.getMaxAnisotropy();
    this.items = EVIDENCE.map((def, i) => {
      const tex = new THREE.CanvasTexture(def.draw(sceneShot, newsImages, def));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: def.gloss ? 0.38 : 0.9,
        metalness: 0,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        envMapIntensity: def.gloss ? 1.2 : 0.25,
        emissive: 0xffe2b8,
        emissiveIntensity: 0,
      });
      const mesh = new THREE.Mesh(paperGeometry(def.w, def.h, i + 1), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const group = new THREE.Group();
      group.position.set(def.x, def.y, 0.0025 + i * 0.0009);
      group.rotation.z = def.rot;
      group.add(mesh);
      const pin = makePin(def.pin);
      pin.position.set(0, def.h / 2 - 0.016, 0);
      group.add(pin);
      this.anchor.add(group);
      const item = { def, group, mesh, pin, base: group.position.clone(), hover: 0, focus: 0 };
      mesh.userData.item = item;
      pin.traverse((o) => { o.userData.item = item; });
      return item;
    });

    this.strings = this._buildStrings();
    this.pickables = this.items.flatMap((it) => [it.mesh, ...it.pin.children]);
    this.hovered = null;
    this.focused = null;
  }

  _pinPoint(item) {
    const p = item.pin.position.clone().setZ(0.011);
    p.applyAxisAngle(new THREE.Vector3(0, 0, 1), item.def.rot);
    return p.add(item.base);
  }

  _buildStrings() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8e1515, roughness: 0.85 });
    const byId = Object.fromEntries(this.items.map((i) => [i.def.id, i]));
    const group = new THREE.Group();
    for (const [a, b] of STRINGS) {
      const p0 = this._pinPoint(byId[a]);
      const p1 = this._pinPoint(byId[b]);
      const mid = p0.clone().lerp(p1, 0.5);
      mid.y -= p0.distanceTo(p1) * 0.07;
      mid.z = 0.014;
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0011, 5), mat);
      tube.castShadow = true;
      group.add(tube);
    }
    this.anchor.add(group);
    return group;
  }

  normal() {
    return new THREE.Vector3(0, 0, 1).transformDirection(this.anchor.matrixWorld);
  }

  /** frame the whole cork. `fov` is the effective vertical FOV in degrees */
  boardPose(aspect, fov) {
    const c = this.anchor.localToWorld(new THREE.Vector3(0, CORK_CENTRE_Y, 0));
    const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const dist = Math.max((CORK_SIZE.h * 0.56) / t, (CORK_SIZE.w * 0.56) / (t * aspect));
    // a little above centre, looking slightly down: clears the boombox and knife in front
    const pos = c.clone().addScaledVector(this.normal(), dist);
    pos.y += 0.24;
    c.y += 0.05;
    return { pos, target: c };
  }

  notePose(item, aspect, fov) {
    const { def, base } = item;
    const c = this.anchor.localToWorld(new THREE.Vector3(def.x, def.y, base.z + 0.05));
    const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const dist = Math.max((def.h * 0.62) / t, (def.w * 0.62) / (t * aspect));
    return { pos: c.clone().addScaledVector(this.normal(), dist), target: c };
  }

  update(dt) {
    for (const it of this.items) {
      it.hover = damp(it.hover, it === this.hovered && !this.focused ? 1 : 0, 10, dt);
      it.focus = damp(it.focus, it === this.focused ? 1 : 0, 5, dt);
      it.group.position.z = it.base.z + it.hover * 0.012 + it.focus * 0.05;
      it.group.rotation.z = it.def.rot * (1 - it.focus);
      it.group.scale.setScalar(1 + it.hover * 0.035);
      it.mesh.material.emissiveIntensity = it.hover * 0.06 + it.focus * 0.05;
    }
  }
}
