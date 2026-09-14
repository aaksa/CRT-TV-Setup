import * as THREE from 'three';

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

/** Frame-driven tweens. `tween()` resolves when finished; starting a tween
 *  with the same key cancels the previous one. */
const active = new Map();
let anon = 0;

export function tween({ key, duration = 1, delay = 0, easing = ease.inOutCubic, update, complete }) {
  const id = key ?? `anon${anon++}`;
  const prev = active.get(id);
  if (prev) prev.cancelled = true;
  const scale = reducedMotion ? 0.35 : 1;
  return new Promise((resolve) => {
    const job = { t: -delay * scale, duration: Math.max(duration * scale, 1e-4), easing, update, resolve, complete, cancelled: false };
    active.set(id, job);
  });
}

export function stepTweens(dt) {
  for (const [id, job] of active) {
    if (job.cancelled) { active.delete(id); job.resolve(false); continue; }
    job.t += dt;
    if (job.t < 0) continue;
    const p = Math.min(job.t / job.duration, 1);
    job.update(job.easing(p), p);
    if (p >= 1) {
      active.delete(id);
      job.complete?.();
      job.resolve(true);
    }
  }
}

export const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

/**
 * Cinematic camera: a base pose (position + look target + vertical FOV)
 * that transitions travel between, plus a small pointer parallax layer.
 * FOV is expressed for a reference aspect so framing survives narrow screens.
 */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.fov = 42;
    this.refAspect = 1.52;
    this.parallax = 0.06;
    this.pointer = new THREE.Vector2();
    this.smooth = new THREE.Vector2();
    this.breath = 1;
    this._f = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._u = new THREE.Vector3();
  }

  set({ pos, target, fov }) {
    this.pos.copy(pos);
    this.target.copy(target);
    if (fov) this.fov = fov;
  }

  /** vertical FOV that keeps the reference horizontal coverage on narrow screens */
  fitFov(fov = this.fov, aspect = this.camera.aspect) {
    if (aspect >= this.refAspect) return fov;
    // portrait screens may crop the (empty, dark) sides rather than shrink the subject
    const crop = aspect < 1 ? THREE.MathUtils.lerp(0.7, 1, THREE.MathUtils.clamp((aspect - 0.5) / 0.5, 0, 1)) : 1;
    const h = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * this.refAspect * crop);
    return Math.min(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h) / aspect)), 80);
  }

  flyTo({ pos, target, fov = this.fov, duration = 1.8, arc = 0.12, parallax }) {
    const p0 = this.pos.clone();
    const t0 = this.target.clone();
    const f0 = this.fov;
    const lift = new THREE.Vector3(0, 1, 0);
    return tween({
      key: 'camera',
      duration,
      easing: ease.inOutCubic,
      update: (e) => {
        this.pos.lerpVectors(p0, pos, e).addScaledVector(lift, Math.sin(Math.PI * e) * arc);
        this.target.lerpVectors(t0, target, e);
        this.fov = THREE.MathUtils.lerp(f0, fov, e);
        if (parallax !== undefined) this.parallax = THREE.MathUtils.lerp(this.parallax, parallax, e);
      },
    });
  }

  /** world-space basis of the un-parallaxed base pose */
  basis() {
    this._f.subVectors(this.target, this.pos).normalize();
    this._r.crossVectors(this._f, THREE.Object3D.DEFAULT_UP).normalize();
    this._u.crossVectors(this._r, this._f).normalize();
    return { f: this._f, r: this._r, u: this._u };
  }

  update(dt, t) {
    this.smooth.x = damp(this.smooth.x, this.pointer.x, 2.2, dt);
    this.smooth.y = damp(this.smooth.y, this.pointer.y, 2.2, dt);
    const { r, u } = this.basis();
    const k = this.parallax;
    const drift = reducedMotion ? 0 : this.breath;
    const cam = this.camera;
    cam.position.copy(this.pos)
      .addScaledVector(r, this.smooth.x * k + Math.sin(t * 0.21) * 0.012 * drift)
      .addScaledVector(u, this.smooth.y * k * 0.55 + Math.sin(t * 0.33) * 0.008 * drift);
    cam.lookAt(this.target);
    const fov = this.fitFov();
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}
