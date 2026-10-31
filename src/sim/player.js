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
    const n = this.nStored, Q = this.meta.Q, bytes = this.bytes;
    const out = [];
    const p1 = new Int32Array(n), p2 = new Int32Array(n);
    let p = offset;
    const end = offset + length;
    for (let f = 0; f < frames; f++) {
      const st = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let z = 0, shift = 0, b;
        do { b = bytes[p++]; z |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80 && p <= end);
        const d = (z >>> 1) ^ -(z & 1);
        // residual against a constant-velocity prediction (see tools/bake.mjs)
        const pred = f === 0 ? 0 : f === 1 ? p1[i] : 2 * p1[i] - p2[i];
        const v = pred + d;
        p2[i] = p1[i]; p1[i] = v;
        st[i] = v / Q;
      }
      out.push(this._expand(st));
    }
    this.cache.set(c, out);
    return out;
  }

  // Rebuild the full grid from the stored columns: the missing ones lie on
  // a smooth curve (Catmull-Rom midpoint) through their neighbours.
  _expand(st) {
    const { rows, cols } = this.meta, S = this.stored, ns = S.length;
    if (ns === cols) return st;
    const out = new Float32Array(rows * cols * 3);
    for (let i = 0; i < rows; i++) {
      for (let c = 0; c < ns; c++) for (let k = 0; k < 3; k++) out[(i * cols + S[c]) * 3 + k] = st[(i * ns + c) * 3 + k];
      for (let c = 0; c < ns - 1; c++) {
        const j = (S[c] + S[c + 1]) / 2; // the column between two stored ones
        const c0 = Math.max(0, c - 1), c3 = Math.min(ns - 1, c + 2);
        for (let k = 0; k < 3; k++) {
          const p0 = st[(i * ns + c0) * 3 + k], p1 = st[(i * ns + c) * 3 + k], p2 = st[(i * ns + c + 1) * 3 + k], p3 = st[(i * ns + c3) * 3 + k];
          out[(i * cols + j) * 3 + k] = (-p0 + 9 * p1 + 9 * p2 - p3) / 16;
        }
      }
    }
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
