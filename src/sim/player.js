// Plays back the baked cloth animation (see tools/bake.mjs).
//
// Each knot has one chapter per step: the frames that take the tie from
// the settled previous step to the settled current step. Every frame was
// simulated with the penetration-free solver and checked for intersections
// before it was written.
import { gunzipSync } from 'fflate';

function b64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Predicted (quantised) value of the column between stored columns c and
 * c + 1 in row i: the midpoint of a Catmull-Rom curve across the tie.
 */
export function midPrediction(st, i, c, k, ns) {
  const c0 = Math.max(0, c - 1), c3 = Math.min(ns - 1, c + 2), b = i * ns;
  return Math.round((-st[(b + c0) * 3 + k] + 9 * st[(b + c) * 3 + k] + 9 * st[(b + c + 1) * 3 + k] - st[(b + c3) * 3 + k]) / 16);
}

export class BakedKnot {
  constructor(meta, data) {
    this.meta = meta;
    this.n = meta.rows * meta.cols * 3;
    this.stored = meta.storedCols || [...Array(meta.cols).keys()];
    this.nStored = meta.rows * this.stored.length * 3;
    this.fps = meta.fps;
    this.bytes = gunzipSync(b64(data));
    this.cache = new Map(); // chapter -> Float32Array[] (decoded lazily)
  }

  get chapterCount() { return this.meta.chapters.length; }

  /** All frames of a chapter as Float32Arrays (cm). */
  chapter(c) {
    if (this.cache.has(c)) return this.cache.get(c);
    const { frames, offset, length } = this.meta.chapters[c];
    const { rows, cols, Q } = this.meta, S = this.stored, ns = S.length, nm = ns - 1, bytes = this.bytes;
    const n = this.nStored, m = rows * nm * 3;
    const out = [];
    const p1 = new Int32Array(n), p2 = new Int32Array(n), r1 = new Int32Array(m), st = new Int32Array(n);
    let p = offset;
    const end = offset + length;
    const next = () => {
      let z = 0, shift = 0, b;
      do { b = bytes[p++]; z |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80 && p <= end);
      return (z >>> 1) ^ -(z & 1);
    };
    for (let f = 0; f < frames; f++) {
      const fr = new Float32Array(rows * cols * 3);
      // stored columns: residual against a constant-velocity prediction
      for (let i = 0; i < rows; i++) for (let cc = 0; cc < ns; cc++) for (let k = 0; k < 3; k++) {
        const a = (i * ns + cc) * 3 + k;
        const pred = f === 0 ? 0 : f === 1 ? p1[a] : 2 * p1[a] - p2[a];
        const v = pred + next();
        p2[a] = p1[a]; p1[a] = v; st[a] = v;
        fr[(i * cols + S[cc]) * 3 + k] = v / Q;
      }
      // the columns between them: residual against a smooth curve through
      // their neighbours, itself stored relative to the previous frame's
      if (nm > 0 && ns < cols) {
        for (let i = 0; i < rows; i++) for (let cc = 0; cc < nm; cc++) for (let k = 0; k < 3; k++) {
          const a = (i * nm + cc) * 3 + k;
          const r = r1[a] + (this.meta.midResiduals ? next() : 0);
          r1[a] = r;
          fr[(i * cols + (S[cc] + S[cc + 1]) / 2) * 3 + k] = (midPrediction(st, i, cc, k, ns) + r) / Q;
        }
      }
      out.push(fr);
    }
    this.cache.set(c, out);
    return out;
  }

  /** The settled state at the end of a step. */
  last(c) { const ch = this.chapter(c); return ch[ch.length - 1]; }
}

/**
 * Plays chapters forwards or backwards, interpolating between baked frames
 * so playback is smooth at any display rate.
 */
export class Player {
  constructor() {
    this.knot = null;
    this.frames = null;
    this.t = 0;
    this.dir = 1;
    this.playing = false;
    this.out = null;
  }

  setKnot(baked) {
    this.knot = baked;
    this.out = new Float32Array(baked.n);
  }

  /** Jump straight to the settled state of a step. */
  show(step) {
    this.playing = false;
    this.frames = null;
    this.chapterIndex = step;
    this.out.set(this.knot.last(step));
  }

  /** Play the move into `step` (or backwards out of it). */
  play(step, { reverse = false } = {}) {
    this.chapterIndex = step;
    this.frames = this.knot.chapter(step);
    this.dir = reverse ? -1 : 1;
    this.t = reverse ? this.frames.length - 1 : 0;
    this.playing = true;
    this._sample();
  }

  get duration() { return this.frames ? (this.frames.length - 1) / this.knot.fps : 0; }

  /** Advance by dt seconds; returns true while playing. */
  update(dt) {
    if (!this.playing) return false;
    this.t += this.dir * dt * this.knot.fps;
    const last = this.frames.length - 1;
    if (this.t >= last) { this.t = last; this.playing = false; }
    if (this.t <= 0) { this.t = 0; this.playing = false; }
    this._sample();
    return true;
  }

  finish() {
    if (!this.frames) return;
    this.t = this.dir > 0 ? this.frames.length - 1 : 0;
    this.playing = false;
    this._sample();
  }

  _sample() {
    const f = this.frames, i = Math.floor(this.t), a = this.t - i;
    const A = f[i], B = f[Math.min(f.length - 1, i + 1)], o = this.out;
    if (a === 0) { o.set(A); return; }
    // where the baker found that blending two frames would let layers touch,
    // step from one to the other instead
    if (this.knot.meta.noBlend?.[this.chapterIndex]?.includes(i)) { o.set(a < 0.5 ? A : B); return; }
    for (let k = 0; k < o.length; k++) o[k] = A[k] + (B[k] - A[k]) * a;
  }

  get reversed() { return this.dir < 0; }

  /** Which row of the tie the (invisible) hand is feeding round, or -1. */
  get handRow() {
    if (!this.frames || !this.playing) return -1;
    const g = this.knot.meta.grips?.[this.chapterIndex];
    if (!g) return -1;
    return g[Math.min(g.length - 1, Math.round(this.t))] ?? -1;
  }

  /** 0..1 progress through the current chapter (in playback direction). */
  get progress() {
    if (!this.frames) return 1;
    const u = this.t / Math.max(1, this.frames.length - 1);
    return this.dir > 0 ? u : 1 - u;
  }
}
