// Drives the tie from one step's pose to the next.
//
// The knot pose (from the tie engine) is the *intent*: where the fabric is
// going. During a move we sweep that intent from the old pose to the new
// one by rotating each little segment of the tie towards its new direction,
// so the moving blade swings round the knot instead of cutting through it.
// The cloth simulation then follows the intent with real inertia, gravity,
// stiffness and collisions, which is what makes it flow like silk.

import { SAMPLES } from '../engine/tie-engine.js';
import { TieCloth, ROWS } from './cloth.js';

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Spherical interpolation between two unit vectors stored at a[o], b[o].
// Opposite vectors turn through "towards you" (+z), like fabric folding over.
export function slerp(a, b, o, k, out) {
  const ax = a[o], ay = a[o + 1], az = a[o + 2], bx = b[o], by = b[o + 1], bz = b[o + 2];
  let dot = ax * bx + ay * by + az * bz;
  if (dot > 0.9995) {
    const x = ax + (bx - ax) * k, y = ay + (by - ay) * k, z = az + (bz - az) * k;
    const l = Math.hypot(x, y, z) || 1;
    out[0] = x / l; out[1] = y / l; out[2] = z / l;
    return;
  }
  if (dot < -0.995) {
    let ux = ay, uy = -ax, uz = 0; // a x z
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const ang = Math.PI * k, c = Math.cos(ang), s = Math.sin(ang);
    const cx = uy * az - uz * ay, cy = uz * ax - ux * az, cz = ux * ay - uy * ax;
    const d2 = ux * ax + uy * ay + uz * az;
    out[0] = ax * c + cx * s + ux * d2 * (1 - c);
    out[1] = ay * c + cy * s + uy * d2 * (1 - c);
    out[2] = az * c + cz * s + uz * d2 * (1 - c);
    return;
  }
  dot = Math.min(1, Math.max(-1, dot));
  const th = Math.acos(dot), st = Math.sin(th);
  const wa = Math.sin((1 - k) * th) / st, wb = Math.sin(k * th) / st;
  out[0] = ax * wa + bx * wb; out[1] = ay * wa + by * wb; out[2] = az * wa + bz * wb;
}

export class TieAnimator {
  constructor() {
    const n = SAMPLES * 3;
    this.cloth = new TieCloth();
    this.cur = { P: new Float32Array(n), N: new Float32Array(n), C: new Float32Array(SAMPLES), pinch: [0, -4, 0] };
    this.from = null; this.to = null; this.swing = null;
    this.glow = new Float32Array(SAMPLES);
    this.glowTarget = new Float32Array(SAMPLES);
    this.moveW = new Float32Array(SAMPLES);
    this.t = 1; this.dur = 1.6;
    this.highlight = true;
  }

  get moving() { return !!this.from; }

  /**
   * Show a pose, instantly or as an animated move from the current one.
   * `swing`: 'front' lifts the moving blade towards you as it goes round,
   * 'back' eases the knot forward so the blade can pass behind it.
   */
  show(pose, { animate = true, swing = null, glow = true, duration = 1.6, settle = 0.4 } = {}) {
    const cloth = this.cloth;
    if (!this.to || !animate) {
      this.cur.P.set(pose.P); this.cur.N.set(pose.N); this.cur.C.set(pose.C);
      this.cur.pinch = pose.pinch.slice();
      this.from = null; this.to = pose; this.t = 1;
      this.glowTarget.fill(0);
      this.glow.fill(0);
      // drop the cloth onto the pose and let it settle before it's seen
      cloth.setTargets(this.cur.P, this.cur.N, SAMPLES);
      cloth.setRoles(pose.roles);
      cloth.snap();
      if (settle) cloth.settle(settle);
      return;
    }
    this.from = { P: this.cur.P.slice(), N: this.cur.N.slice(), C: this.cur.C.slice(), pinch: this.cur.pinch.slice() };
    this.to = pose;
    this.swing = swing;
    this._prepSwing(this.from, pose);
    this.t = 0;
    this.dur = duration;
    // glow follows whatever part of the tie moves the most
    let maxD = 0;
    const d = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const dx = pose.P[i * 3] - this.from.P[i * 3], dy = pose.P[i * 3 + 1] - this.from.P[i * 3 + 1], dz = pose.P[i * 3 + 2] - this.from.P[i * 3 + 2];
      d[i] = Math.hypot(dx, dy, dz);
      maxD = Math.max(maxD, d[i]);
    }
    for (let i = 0; i < SAMPLES; i++) {
      this.glowTarget[i] = glow && maxD > 0.5 ? clamp((d[i] / maxD - 0.18) * 1.6, 0, 1) : 0;
      this.moveW[i] = maxD > 0 ? clamp(d[i] / (maxD * 0.6), 0, 1) : 0;
    }
    // The part that moves is "carried" by your hand while it travels, then
    // let go so it can fall and settle on its own.
    const carry = new Float32Array(ROWS);
    const carried = new Uint8Array(ROWS);
    for (let r = 0; r < ROWS; r++) {
      const i = Math.round((r / (ROWS - 1)) * (SAMPLES - 1));
      if (swing !== 'slide' && this.moveW[i] > 0.25) { carry[r] = 0.05; carried[r] = 1; }
    }
    cloth.setRoles(pose.roles, { carry });
    // the blade in your hand travels round the knot; contacts resume when you let go
    cloth.setCarried(carried);
  }

  /** Advance by dt seconds. Returns true if anything visible changed. */
  update(dt) {
    let changed = false;
    if (this.from && this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const k = ease(this.t);
      const A = this.from, B = this.to;
      const N = this.cur.N, C = this.cur.C;
      this._swingPositions(k);
      const tmp = [0, 0, 0];
      for (let i = 0; i < SAMPLES; i++) {
        slerp(A.N, B.N, i * 3, k, tmp);
        N[i * 3] = tmp[0]; N[i * 3 + 1] = tmp[1]; N[i * 3 + 2] = tmp[2];
      }
      for (let i = 0; i < SAMPLES; i++) C[i] = A.C[i] + (B.C[i] - A.C[i]) * k;
      for (let i = 0; i < 3; i++) this.cur.pinch[i] = A.pinch[i] + (B.pinch[i] - A.pinch[i]) * k;
      this.cloth.setTargets(this.cur.P, this.cur.N, SAMPLES);
      if (this.t >= 1) {
        this.from = null;
        this.cloth.setRoles(this.to.roles); // let go
        this.cloth.setCarried(null);
      }
      changed = true;
    }
    if (this.cloth.step(dt)) changed = true;
    // glow: rises during the move, then fades back slowly
    for (let i = 0; i < SAMPLES; i++) {
      const target = this.highlight ? this.glowTarget[i] : 0;
      const g = this.glow[i] + (target - this.glow[i]) * Math.min(1, dt * 4);
      if (Math.abs(g - this.glow[i]) > 1e-4) changed = true;
      this.glow[i] = g;
    }
    return changed;
  }

  /** Jump to the end of the current move and let the cloth come to rest. */
  finish(settle = 1.2) {
    if (this.from) this.update(this.dur * (1 - this.t) + 1e-3);
    this.cloth.settle(settle);
  }

  // Precompute segment directions/lengths for both poses. During a move we
  // rotate each little segment from its old direction to its new one and
  // re-chain them from the back of the neck, so the tie swings like real
  // fabric and keeps its length instead of cutting straight through itself.
  _prepSwing(A, B) {
    const n = SAMPLES;
    const seg = (P) => {
      const d = new Float32Array(n * 3), l = new Float32Array(n);
      for (let i = 0; i < n - 1; i++) {
        const x = P[i * 3 + 3] - P[i * 3], y = P[i * 3 + 4] - P[i * 3 + 1], z = P[i * 3 + 5] - P[i * 3 + 2];
        const len = Math.hypot(x, y, z) || 1e-6;
        d[i * 3] = x / len; d[i * 3 + 1] = y / len; d[i * 3 + 2] = z / len; l[i] = len;
      }
      return { d, l };
    };
    this.sA = seg(A.P); this.sB = seg(B.P);
    this.anchor = B.anchor ?? Math.floor(n / 2);
  }

  _swingPositions(k) {
    const n = SAMPLES, P = this.cur.P, A = this.from, B = this.to;
    if (this.swing === 'slide') {
      // tightening: the knot simply slides up the narrow blade
      for (let i = 0; i < n * 3; i++) P[i] = A.P[i] + (B.P[i] - A.P[i]) * k;
      return;
    }
    const { d: dA, l: lA } = this.sA, { d: dB, l: lB } = this.sB;
    const dir = this._dir || (this._dir = new Float32Array(n * 3));
    const tmp = [0, 0, 0];
    for (let i = 0; i < n - 1; i++) {
      slerp(dA, dB, i * 3, k, tmp);
      dir[i * 3] = tmp[0]; dir[i * 3 + 1] = tmp[1]; dir[i * 3 + 2] = tmp[2];
    }
    const a = this.anchor;
    for (let c = 0; c < 3; c++) P[a * 3 + c] = A.P[a * 3 + c] + (B.P[a * 3 + c] - A.P[a * 3 + c]) * k;
    for (let i = a; i < n - 1; i++) {
      const l = lA[i] + (lB[i] - lA[i]) * k;
      for (let c = 0; c < 3; c++) P[(i + 1) * 3 + c] = P[i * 3 + c] + dir[i * 3 + c] * l;
    }
    for (let i = a - 1; i >= 0; i--) {
      const l = lA[i] + (lB[i] - lA[i]) * k;
      for (let c = 0; c < 3; c++) P[i * 3 + c] = P[(i + 1) * 3 + c] - dir[i * 3 + c] * l;
    }
    // re-chaining drifts a little; blend it out so we land exactly on both ends
    const e = Math.sin(Math.PI * k);
    for (let i = 0; i < n * 3; i++) {
      const lin = A.P[i] + (B.P[i] - A.P[i]) * k;
      P[i] = lin + (P[i] - lin) * e;
    }
    // swing the moving blade clear of the knot
    if (this.swing) {
      const ky = this.to.meta?.P?.K?.y ?? -8;
      for (let i = 0; i < n; i++) {
        const w = this.moveW[i];
        let dz;
        if (this.swing === 'front') dz = 4.2 * w * e;
        else {
          const near = Math.max(0, 1 - Math.abs(P[i * 3 + 1] - ky) / 14);
          dz = (2.6 * (1 - w) * near - 0.6 * w) * e;
        }
        P[i * 3 + 2] += dz;
      }
    }
  }
}
