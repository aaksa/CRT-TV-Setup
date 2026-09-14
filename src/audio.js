/**
 * Everything audible is synthesised with WebAudio — no sound files.
 * The context can only start after a user gesture, so `start()` is called
 * from the "step inside" click; before that every method is a no-op.
 */
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.tvVolume = 0.5; // 0..1, driven by the remote
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.noise = this._noiseBuffer(3);

    // continuous TV static bed
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    const s = this._loop(this.noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.35;
    s.connect(bp).connect(this.staticGain).connect(this.master);

    // mains hum + flyback whine of a warm CRT (very quiet)
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    for (const [f, g] of [[60, 0.5], [120, 0.3], [180, 0.12]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.humGain);
      o.start();
    }
    const whine = ctx.createOscillator();
    whine.frequency.value = 15734 / 2;
    const wg = ctx.createGain();
    wg.gain.value = 0.015;
    whine.connect(wg).connect(this.humGain);
    whine.start();
    this.humGain.connect(this.master);

    // room tone: low rumble + distant air
    const room = this._loop(this._noiseBuffer(4, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0;
    room.connect(lp).connect(this.roomGain).connect(this.master);
    this.roomGain.gain.setTargetAtTime(0.16, ctx.currentTime, 2.5);
  }

  resume() { this.ctx?.state === 'suspended' && this.ctx.resume(); }

  get tvLevel() { return this.muted ? 0 : this.tvVolume; }

  /** static bed level 0..1 (scaled by TV volume) */
  setStatic(level, tc = 0.08) {
    if (!this.ctx) return;
    this.staticGain.gain.setTargetAtTime(level * 0.16 * this.tvLevel, this.ctx.currentTime, tc);
  }

  setHum(on) {
    if (!this.ctx) return;
    this.humGain.gain.setTargetAtTime(on ? 0.012 : 0, this.ctx.currentTime, on ? 0.6 : 0.08);
  }

  /** channel-change burst: loud static swoosh */
  burst(duration = 0.45) {
    if (!this.ctx || this.tvLevel === 0) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.6;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(4800, t + duration * 0.5);
    bp.frequency.exponentialRampToValueAtTime(1800, t + duration);
    const g = ctx.createGain();
    const peak = 0.34 * this.tvLevel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setValueAtTime(peak, t + duration * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + duration + 0.05);
  }

  /** plastic remote button click */
  click(soft = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = soft ? 2400 : 3800;
    hp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(soft ? 0.12 : 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.05);
  }

  /** degauss thump + rising whine */
  powerOn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(52, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1);
    this.burst(0.25);
    this.setHum(true);
  }

  powerOff() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.35);
    this.setHum(false);
    this.setStatic(0, 0.02);
  }

  /** soft paper handling sound for the evidence board */
  paper() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.4);
  }

  _noiseBuffer(seconds, brown = false) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  _loop(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }
}
