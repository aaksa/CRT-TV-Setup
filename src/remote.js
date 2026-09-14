import * as THREE from 'three';
import { tween, ease, damp, reducedMotion } from './motion.js';

const HOVER = new THREE.Color(0xffc987);
const TRAVEL = 0.11; // button travel in remote units (≈2.3 mm)

/**
 * The exported remote is an empty `Remote` holding `Remote_Body` and one
 * mesh per button named `RBTN_<LABEL>`. Remote local axes (three.js):
 * +Y = button face, −Z = the power end.
 */
export class RemoteControl {
  constructor(root, scene, opacityMap = null) {
    this.root = root;
    scene.attach(root); // keep world transform, drop the glTF parent
    this.home = {
      pos: root.position.clone(),
      quat: root.quaternion.clone(),
    };
    this.buttons = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      // the scanned roughness map reads as wet glass under the lamp; soft-touch plastic instead
      o.material.roughnessMap = null;
      o.material.roughness = 0.62;
      o.material.envMapIntensity = 0.5;
      // printed labels are decals cut out by the opacity map (not carried by glTF export)
      if (opacityMap) {
        o.material.alphaMap = opacityMap;
        o.material.alphaTest = 0.5;
        o.material.needsUpdate = true;
      }
      if (o.name.startsWith('RBTN_')) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0x000000);
        o.userData.label = o.name.slice(5);
        o.userData.rest = o.position.y;
        o.userData.press = 0;
        o.userData.glow = 0;
        this.buttons.push(o);
      }
    });
    this.hovered = null;
    this.inHand = false;
    this.handPose = null;
    this._bob = new THREE.Vector3();
  }

  /** which half of a rocker (VOL / CH) was hit: +1 upper (+), −1 lower (−) */
  half(button, point) {
    const local = button.worldToLocal(point.clone());
    return local.z < 0 ? 1 : -1;
  }

  setHover(button) {
    this.hovered = button;
  }

  press(button) {
    button.userData.press = 1;
  }

  /** a comfortable "held in the right hand" pose in front of a camera pose */
  computeHandPose(camPos, camTarget, aspect = 1.5) {
    const f = new THREE.Vector3().subVectors(camTarget, camPos).normalize();
    const r = new THREE.Vector3().crossVectors(f, THREE.Object3D.DEFAULT_UP).normalize();
    const u = new THREE.Vector3().crossVectors(r, f).normalize();
    const side = aspect < 0.9 ? 0.06 : 0.15; // narrow screens: hold it closer to centre
    const pos = camPos.clone().addScaledVector(f, 0.4).addScaledVector(r, side).addScaledVector(u, -0.112);
    const face = f.clone().negate().multiplyScalar(0.78).addScaledVector(u, 0.62).normalize();
    const top = u.clone().multiplyScalar(0.55).addScaledVector(f, 0.83);
    top.sub(face.clone().multiplyScalar(top.dot(face))).normalize();
    top.applyAxisAngle(face, 0.26);
    const Y = face;
    const Z = top.clone().negate();
    const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    return { pos, quat };
  }

  pickUp(pose, duration = 1.7, delay = 0.25) {
    this.handPose = pose;
    this.inHand = true;
    return this._moveTo(pose, duration, delay, 0.1);
  }

  putDown(duration = 1.4) {
    this.inHand = false;
    return this._moveTo(this.home, duration, 0, 0.08);
  }

  _moveTo(to, duration, delay, arc) {
    const p0 = this.root.position.clone();
    const q0 = this.root.quaternion.clone();
    this.settled = false;
    return tween({
      key: 'remote',
      duration,
      delay,
      easing: ease.inOutCubic,
      update: (e) => {
        this.root.position.lerpVectors(p0, to.pos, e).y += Math.sin(Math.PI * e) * arc;
        this.root.quaternion.slerpQuaternions(q0, to.quat, e);
      },
      complete: () => { this.settled = true; },
    });
  }

  update(dt, t) {
    for (const b of this.buttons) {
      const d = b.userData;
      d.glow = damp(d.glow, b === this.hovered ? 1 : 0, 14, dt);
      b.material.emissive.copy(HOVER).multiplyScalar(d.glow * 0.32);
      d.press = Math.max(0, d.press - dt * 7);
      const k = d.press > 0.6 ? 1 : d.press / 0.6; // snap down, ease back up
      b.position.y = d.rest - TRAVEL * k;
    }
    // idle hand sway while held
    if (this.inHand && this.settled && !reducedMotion) {
      this._bob.set(Math.sin(t * 0.9) * 0.0022, Math.sin(t * 1.3) * 0.0016, 0);
      this.root.position.copy(this.handPose.pos).add(this._bob);
    }
  }
}
