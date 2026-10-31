// Cloth simulation for the tie.
//
// The tie is a strip of particles: ROWS along its length, COLS across its
// width, cut to the real width profile (narrow blade, neck section, wide
// blade, pointed tips). It is solved with position-based dynamics in many
// small sub-steps:
//
//   * stretch / shear constraints  -> silk with interlining barely stretches
//   * soft bending along the length -> it drapes, swings and curls
//   * stiffer bending across        -> it stays flat-ish, like a real blade
//   * collisions with the shirt, neck and collar
//   * self-collision with thickness -> layers in the knot can't pass through
//     each other; which side a layer belongs on comes from the knot pose
//
// The knot engine supplies a target pose. The neck loop is pinned, the
// knot itself is held firmly to the pose, and the free ends are only gently
// guided, so gravity and inertia decide how they hang and swing.

import { TIE_LENGTH, tieWidth } from '../engine/tie-engine.js';
import { chestZFast as chestZ, NECK, COLLAR } from '../engine/body.js';

export const ROWS = 264;
export const COLS = 5;
export const THICK = 0.34; // collision thickness (cm)

const SUBSTEPS = 6;
const GRAVITY = -981; // cm/s^2
const DAMP = 0.994; // per sub-step velocity retention (air drag)

// stiffness per sub-step (small-step PBD: one pass per sub-step)
const K_STRETCH = 1.0;
const K_ACROSS = 1.0;
const K_SHEAR = 0.6;
const K_BEND_ALONG = 0.05;
const K_BEND_ACROSS = 0.55;

// attraction to the pose, per sub-step
const PULL_KNOT = 0.05;
const PULL_FREE = 0.0035;
const PULL_NEAR = 0.06; // first few cm of a free end, where it leaves the knot
const PULL_HAND = 0.35;

export class TieCloth {
  constructor() {
    const R = ROWS, C = COLS, n = R * C;
    this.n = n;
    this.x = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3); // previous positions (Verlet)
    this.t = new Float32Array(n * 3); // targets
    this.pull = new Float32Array(n);
    this.invMass = new Float32Array(n).fill(1);
    this.rowS = new Float32Array(R);
    this.rowW = new Float32Array(R);
    for (let i = 0; i < R; i++) {
      const s = (i / (R - 1)) * TIE_LENGTH;
      this.rowS[i] = s;
      this.rowW[i] = Math.max(0.25, tieWidth(Math.min(TIE_LENGTH - 0.02, Math.max(0.02, s))));
    }
    // flat rest layout: (across offset, along s)
    const rx = new Float32Array(n), ry = new Float32Array(n);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      rx[i * C + j] = (j / (C - 1) - 0.5) * this.rowW[i];
      ry[i * C + j] = this.rowS[i];
    }
    const cons = [];
    const add = (a, b, k) => cons.push(a, b, Math.hypot(rx[a] - rx[b], ry[a] - ry[b]), k);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const p = i * C + j;
      if (i + 1 < R) add(p, p + C, K_STRETCH);
      if (j + 1 < C) add(p, p + 1, K_ACROSS);
      if (i + 1 < R && j + 1 < C) { add(p, p + C + 1, K_SHEAR); add(p + 1, p + C, K_SHEAR); }
      if (i + 2 < R) add(p, p + 2 * C, K_BEND_ALONG);
      if (j + 2 < C) add(p, p + 2, K_BEND_ACROSS);
    }
    for (let i = 0; i < R; i++) add(i * C, i * C + C - 1, K_BEND_ACROSS);
    const m = cons.length / 4;
    this.cA = new Uint32Array(m); this.cB = new Uint32Array(m);
    this.cRest = new Float32Array(m); this.cK = new Float32Array(m);
    for (let c = 0; c < m; c++) {
      this.cA[c] = cons[c * 4]; this.cB[c] = cons[c * 4 + 1];
      this.cRest[c] = cons[c * 4 + 2]; this.cK[c] = cons[c * 4 + 3];
    }

    // triangles for self-collision
    const tris = [];
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
      const p = i * C + j;
      tris.push(p, p + C, p + 1, p + C, p + C + 1, p + 1);
    }
    this.tri = new Uint32Array(tris);
    this.nTri = tris.length / 3;
    this.triRow = new Float32Array(this.nTri);
    for (let t = 0; t < this.nTri; t++) this.triRow[t] = this.rowS[Math.floor(this.tri[t * 3] / C)];

    // spatial hash
    this.cell = 1.1;
    this.TABLE = 1 << 14;
    this.head = new Int32Array(this.TABLE);
    this.stamp = new Int32Array(this.TABLE);
    this.stampNow = 0;
    this.entTri = new Int32Array(1 << 16);
    this.entNext = new Int32Array(1 << 16);
    this.triN = new Float32Array(this.nTri * 3);

    this.sides = new Map(); // remembered contact sides
    this.ghost = new Uint8Array(n); // fabric being carried by hand: no contacts while it travels
    this.anchors = { narrow: -1, wide: -1, hold: -1 };
    this.sleeping = false;
    this.acc = 0;
    this.motion = 0;
    this.selfCollide = true;
  }

  // ---------------------------------------------------------------------
  // Targets from a knot pose (centre-line P, silk normal N, both SAMPLES long)

  setTargets(P, N, samples) {
    const R = ROWS, C = COLS, t = this.t;
    let pwx = 0, pwy = 0, pwz = 0;
    for (let i = 0; i < R; i++) {
      const f = (i / (R - 1)) * (samples - 1);
      const k = Math.min(samples - 2, Math.floor(f)), a = f - k;
      const px = P[k * 3] + (P[k * 3 + 3] - P[k * 3]) * a;
      const py = P[k * 3 + 1] + (P[k * 3 + 4] - P[k * 3 + 1]) * a;
      const pz = P[k * 3 + 2] + (P[k * 3 + 5] - P[k * 3 + 2]) * a;
      const k0 = Math.max(0, k - 1), k1 = Math.min(samples - 1, k + 2);
      let tx = P[k1 * 3] - P[k0 * 3], ty = P[k1 * 3 + 1] - P[k0 * 3 + 1], tz = P[k1 * 3 + 2] - P[k0 * 3 + 2];
      let tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let nx = N[k * 3] + (N[k * 3 + 3] - N[k * 3]) * a;
      let ny = N[k * 3 + 1] + (N[k * 3 + 4] - N[k * 3 + 1]) * a;
      let nz = N[k * 3 + 2] + (N[k * 3 + 5] - N[k * 3 + 2]) * a;
      const d = nx * tx + ny * ty + nz * tz;
      nx -= d * tx; ny -= d * ty; nz -= d * tz;
      // across direction w = n x T
      let wx = ny * tz - nz * ty, wy = nz * tx - nx * tz, wz = nx * ty - ny * tx;
      let wl = Math.hypot(wx, wy, wz);
      if (wl < 1e-6) { wx = pwx; wy = pwy; wz = pwz; wl = 1; }
      wx /= wl; wy /= wl; wz /= wl;
      if (i > 0 && wx * pwx + wy * pwy + wz * pwz < 0) { wx = -wx; wy = -wy; wz = -wz; }
      pwx = wx; pwy = wy; pwz = wz;
      const W = this.rowW[i];
      for (let j = 0; j < C; j++) {
        const o = (j / (C - 1) - 0.5) * W;
        const q = (i * C + j) * 3;
        t[q] = px + wx * o; t[q + 1] = py + wy * o; t[q + 2] = pz + wz * o;
      }
    }
    this.wake();
  }

  /** How firmly each part follows the pose (see roles from the tie engine). */
  setRoles(roles, { carry = null } = {}) {
    const R = ROWS, C = COLS;
    this.roles = roles;
    let narrowAnchor = -1, wideAnchor = -1, hold = -1;
    for (let i = 0; i < R; i++) {
      const s = this.rowS[i];
      let k, pinned = false;
      if (s >= roles.loopStart + 1.5 && s <= roles.loopEnd - 1.5) { k = 1; pinned = true; }
      else if (s < roles.narrowEnd) {
        const d = roles.narrowEnd - s;
        k = d < 3 ? PULL_KNOT : d < 7 ? PULL_NEAR : PULL_FREE;
      } else if (s <= roles.coreEnd) k = PULL_KNOT;
      else {
        const d = s - roles.coreEnd;
        k = d < 2.5 ? PULL_KNOT : d < 6 ? PULL_NEAR : PULL_FREE;
        if (roles.hold != null && Math.abs(s - roles.hold) < 2.2) k = PULL_HAND;
      }
      if (carry) k = Math.max(k, carry[i]);
      for (let j = 0; j < C; j++) {
        this.pull[i * C + j] = k;
        this.invMass[i * C + j] = pinned ? 0 : 1;
      }
      if (s < roles.narrowEnd) narrowAnchor = i;
      if (wideAnchor < 0 && s > roles.coreEnd) wideAnchor = i;
      if (roles.hold != null && hold < 0 && s >= roles.hold) hold = i;
    }
    this.anchors = { narrow: narrowAnchor + 1, wide: wideAnchor - 1, hold };
    this.wake();
  }

  /** Rows carried by hand during a move pass freely round the knot. */
  setCarried(rows) {
    const C = COLS;
    this.ghost.fill(0);
    if (rows) for (let i = 0; i < ROWS; i++) if (rows[i]) for (let j = 0; j < C; j++) this.ghost[i * C + j] = 1;
    this.sides.clear();
    this.wake();
  }

  /** Put the cloth exactly on its targets (no motion). */
  snap() {
    this.x.set(this.t);
    this.v.set(this.t);
    this.sides.clear();
    this.wake();
  }

  wake() { this.sleeping = false; this.quiet = 0; this.awake = 0; }

  // ---------------------------------------------------------------------

  step(dt) {
    if (this.sleeping) return false;
    this.acc = Math.min(this.acc + dt, 1 / 20);
    const h = 1 / 60;
    let did = false;
    if (!this.frameStart) this.frameStart = new Float32Array(this.n * 3);
    this.frameStart.set(this.x);
    while (this.acc >= h) {
      this.acc -= h;
      for (let s = 0; s < SUBSTEPS; s++) this._substep(h / SUBSTEPS, s);
      did = true;
    }
    // go to sleep once everything has come to rest
    if (did) {
      let m = 0;
      const x = this.x, f = this.frameStart;
      for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - f[i]); if (d > m) m = d; }
      this.frameMotion = m;
      this.awake += dt;
      if (m < 0.015) { this.quiet++; if (this.quiet > 45) this.sleeping = true; }
      else this.quiet = 0;
      // the last fraction of a millimetre isn't worth burning a laptop battery on
      if (this.awake > 4 && m < 0.08) this.sleeping = true;
    }
    return did;
  }

  /** Run the simulation for a while without drawing (used before first display). */
  settle(seconds = 0.6) {
    const h = 1 / 60;
    for (let f = 0; f < Math.round(seconds / h); f++) for (let s = 0; s < SUBSTEPS; s++) this._substep(h / SUBSTEPS, s);
  }

  _substep(dt, sIndex) {
    const n = this.n, x = this.x, v = this.v, t = this.t, pull = this.pull, im = this.invMass;
    const g = GRAVITY * dt * dt;
    let motion = 0;
    // integrate (Verlet), then pull towards the pose
    for (let i = 0; i < n; i++) {
      const q = i * 3;
      if (im[i] === 0) {
        v[q] = x[q] = t[q]; v[q + 1] = x[q + 1] = t[q + 1]; v[q + 2] = x[q + 2] = t[q + 2];
        continue;
      }
      const px = x[q], py = x[q + 1], pz = x[q + 2];
      let nx = px + (px - v[q]) * DAMP;
      let ny = py + (py - v[q + 1]) * DAMP + g;
      let nz = pz + (pz - v[q + 2]) * DAMP;
      const k = pull[i];
      nx += (t[q] - nx) * k; ny += (t[q + 1] - ny) * k; nz += (t[q + 2] - nz) * k;
      v[q] = px; v[q + 1] = py; v[q + 2] = pz;
      x[q] = nx; x[q + 1] = ny; x[q + 2] = nz;
      const m = Math.abs(nx - px) + Math.abs(ny - py) + Math.abs(nz - pz);
      if (m > motion) motion = m;
    }
    this.motion = motion;

    this._constraints();
    this._constraints(); // two passes: silk with interlining barely stretches
    this._tethers();
    if (this.selfCollide) this._selfCollide();
    this._bodyCollide();
  }

  _constraints() {
    const x = this.x, im = this.invMass, A = this.cA, B = this.cB, rest = this.cRest, K = this.cK;
    for (let c = 0, m = A.length; c < m; c++) {
      const a = A[c], b = B[c];
      const wa = im[a], wb = im[b], ws = wa + wb;
      if (ws === 0) continue;
      const qa = a * 3, qb = b * 3;
      const dx = x[qb] - x[qa], dy = x[qb + 1] - x[qa + 1], dz = x[qb + 2] - x[qa + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const corr = ((d - rest[c]) / (d * ws)) * K[c];
      x[qa] += dx * corr * wa; x[qa + 1] += dy * corr * wa; x[qa + 2] += dz * corr * wa;
      x[qb] -= dx * corr * wb; x[qb + 1] -= dy * corr * wb; x[qb + 2] -= dz * corr * wb;
    }
  }

  // Long-range tethers: a hanging end can never be further from where it
  // leaves the knot than the fabric in between. Stops long ends stretching.
  _tethers() {
    const C = COLS, x = this.x, im = this.invMass;
    const tether = (anchorRow, from, to) => {
      if (anchorRow < 0 || anchorRow >= ROWS) return;
      const a = (anchorRow * C + 2) * 3;
      const ax = x[a], ay = x[a + 1], az = x[a + 2];
      const s0 = this.rowS[anchorRow];
      for (let i = from; i !== to; i += from < to ? 1 : -1) {
        const L = Math.abs(this.rowS[i] - s0) + this.rowW[i] * 0.5 + 0.05;
        for (let j = 0; j < C; j++) {
          const p = i * C + j;
          if (im[p] === 0) continue;
          const q = p * 3;
          const dx = x[q] - ax, dy = x[q + 1] - ay, dz = x[q + 2] - az;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > L) {
            const f = L / d;
            x[q] = ax + dx * f; x[q + 1] = ay + dy * f; x[q + 2] = az + dz * f;
          }
        }
      }
    };
    const { narrow, wide, hold } = this.anchors;
    tether(narrow, narrow - 1, -1);
    if (hold > 0) tether(hold, hold + 1, ROWS);
    else tether(wide, wide + 1, ROWS);
  }

  _bodyCollide() {
    const n = this.n, x = this.x, im = this.invMass;
    const r = THICK * 0.6;
    for (let i = 0; i < n; i++) {
      if (im[i] === 0) continue;
      const q = i * 3;
      const px = x[q], py = x[q + 1];
      // shirt front
      if (py < 0.5) {
        const z0 = chestZ(px, py);
        if (Number.isFinite(z0) && x[q + 2] < z0 + r) {
          x[q + 2] = z0 + r;
          this.v[q + 2] = x[q + 2]; // stop dead against the shirt (no bounce)
          // friction: shirt cotton grips silk a little
          this.v[q] += (px - this.v[q]) * 0.3;
          this.v[q + 1] += (py - this.v[q + 1]) * 0.3;
        }
      }
      // neck and collar band (the part of the tie held by the knot pose is left alone)
      if (py > -1.2 && py < NECK.top && this.pull[i] < PULL_KNOT) {
        const rr = py < 5.5 ? COLLAR.bandR + r + 0.05 : NECK.r + r;
        const dx = px, dz = x[q + 2] - NECK.z;
        const d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-6) {
          const f = rr / d;
          x[q] = dx * f; x[q + 2] = NECK.z + dz * f;
          this.v[q] = x[q]; this.v[q + 2] = x[q + 2];
        }
      }
    }
  }

  _selfCollide() {
    const C = COLS, x = this.x, t = this.t, im = this.invMass, tri = this.tri, nT = this.nTri;
    const h = THICK, cs = this.cell, inv = 1 / cs, TABLE = this.TABLE, MASK = TABLE - 1;
    const head = this.head, stamp = this.stamp, ent = this.entTri, next = this.entNext, triN = this.triN;
    const sides = this.sides, pull = this.pull;
    const now = ++this.stampNow;
    let ne = 0;
    const hash = (ix, iy, iz) => (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) >>> 0) & MASK;
    // insert triangles
    for (let k = 0; k < nT; k++) {
      if (im[tri[k * 3]] === 0 && im[tri[k * 3 + 1]] === 0 && im[tri[k * 3 + 2]] === 0) { triN[k * 3] = triN[k * 3 + 1] = triN[k * 3 + 2] = 0; continue; }
      const a = tri[k * 3] * 3, b = tri[k * 3 + 1] * 3, c = tri[k * 3 + 2] * 3;
      // normal
      const e1x = x[b] - x[a], e1y = x[b + 1] - x[a + 1], e1z = x[b + 2] - x[a + 2];
      const e2x = x[c] - x[a], e2y = x[c + 1] - x[a + 1], e2z = x[c + 2] - x[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz);
      // skip slivers (the pointed tips, or fabric squashed edge-on): their
      // normals are unreliable and they'd push neighbours about
      if (nl < 0.04) { triN[k * 3] = 0; triN[k * 3 + 1] = 0; triN[k * 3 + 2] = 0; continue; }
      triN[k * 3] = nx / nl; triN[k * 3 + 1] = ny / nl; triN[k * 3 + 2] = nz / nl;
      const x0 = Math.floor((Math.min(x[a], x[b], x[c]) - h) * inv), x1 = Math.floor((Math.max(x[a], x[b], x[c]) + h) * inv);
      const y0 = Math.floor((Math.min(x[a + 1], x[b + 1], x[c + 1]) - h) * inv), y1 = Math.floor((Math.max(x[a + 1], x[b + 1], x[c + 1]) + h) * inv);
      const z0 = Math.floor((Math.min(x[a + 2], x[b + 2], x[c + 2]) - h) * inv), z1 = Math.floor((Math.max(x[a + 2], x[b + 2], x[c + 2]) + h) * inv);
      for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) {
        if (ne >= ent.length) break;
        const hh = hash(ix, iy, iz);
        if (stamp[hh] !== now) { stamp[hh] = now; head[hh] = -1; }
        ent[ne] = k; next[ne] = head[hh]; head[hh] = ne; ne++;
      }
    }
    // test every particle against nearby triangles
    const n = this.n, rowS = this.rowS;
    const ghost = this.ghost;
    for (let p = 0; p < n; p++) {
      if (im[p] === 0 || ghost[p]) continue;
      const q = p * 3;
      const px = x[q], py = x[q + 1], pz = x[q + 2];
      const hh = hash(Math.floor(px * inv), Math.floor(py * inv), Math.floor(pz * inv));
      if (stamp[hh] !== now) continue;
      const sp = rowS[Math.floor(p / C)];
      for (let e = head[hh]; e !== -1; e = next[e]) {
        const k = ent[e];
        if (Math.abs(this.triRow[k] - sp) < 5.5) continue; // same stretch of fabric
        const ia = tri[k * 3], ib = tri[k * 3 + 1], ic = tri[k * 3 + 2];
        if (ghost[ia] || ghost[ib] || ghost[ic]) continue;
        const wp = im[p], wa = im[ia], wb = im[ib], wc = im[ic];
        if (wp + wa + wb + wc === 0) continue;
        const a = ia * 3, b = ib * 3, c = ic * 3;
        const nx = triN[k * 3], ny = triN[k * 3 + 1], nz = triN[k * 3 + 2];
        if (nx === 0 && ny === 0 && nz === 0) continue;
        const d = (px - x[a]) * nx + (py - x[a + 1]) * ny + (pz - x[a + 2]) * nz;
        if (d >= h || d <= -h) continue;
        // barycentric coordinates of the projection
        const qx = px - d * nx - x[a], qy = py - d * ny - x[a + 1], qz = pz - d * nz - x[a + 2];
        const e1x = x[b] - x[a], e1y = x[b + 1] - x[a + 1], e1z = x[b + 2] - x[a + 2];
        const e2x = x[c] - x[a], e2y = x[c + 1] - x[a + 1], e2z = x[c + 2] - x[a + 2];
        const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z;
        const d11 = e2x * e2x + e2y * e2y + e2z * e2z;
        const d20 = qx * e1x + qy * e1y + qz * e1z, d21 = qx * e2x + qy * e2y + qz * e2z;
        const den = d00 * d11 - d01 * d01;
        if (den < 1e-12) continue;
        const bv = (d11 * d20 - d01 * d21) / den, bw = (d00 * d21 - d01 * d20) / den, bu = 1 - bv - bw;
        if (bu < -0.02 || bv < -0.02 || bw < -0.02) continue;
        // Which side should this point be on? Ask the knot pose: in the pose
        // every layer is already in the right order.
        const tax = t[a], tay = t[a + 1], taz = t[a + 2];
        const f1x = t[b] - tax, f1y = t[b + 1] - tay, f1z = t[b + 2] - taz;
        const f2x = t[c] - tax, f2y = t[c + 1] - tay, f2z = t[c + 2] - taz;
        const tnx = f1y * f2z - f1z * f2y, tny = f1z * f2x - f1x * f2z, tnz = f1x * f2y - f1y * f2x;
        const tnl = Math.hypot(tnx, tny, tnz) || 1;
        const td = ((t[q] - tax) * tnx + (t[q + 1] - tay) * tny + (t[q + 2] - taz) * tnz) / tnl;
        // When the pose is clear about it, use that; otherwise stay on the
        // side this point was on when the two first touched.
        const key = p * nT + k;
        let side;
        if (Math.abs(td) > h * 0.9 && Math.abs(td) < 3) {
          side = Math.sign(td) * Math.sign(tnx * nx + tny * ny + tnz * nz || 1);
          sides.set(key, side);
        } else {
          side = sides.get(key);
          if (side === undefined) { side = d >= 0 ? 1 : -1; sides.set(key, side); }
        }
        const pen = h - side * d;
        if (pen <= 0) continue;
        const denom = wp + wa * bu * bu + wb * bv * bv + wc * bw * bw;
        if (denom < 1e-9) continue;
        // Inside the knot both layers are already held by the pose, so only
        // nudge them apart; free fabric meeting anything gets a full push.
        const both = pull[p] >= PULL_KNOT && pull[ia] >= PULL_KNOT && pull[ib] >= PULL_KNOT && pull[ic] >= PULL_KNOT;
        const lam = (pen / denom) * (both ? 0.12 : 1);
        const sx = side * nx * lam, sy = side * ny * lam, sz = side * nz * lam;
        x[q] += sx * wp; x[q + 1] += sy * wp; x[q + 2] += sz * wp;
        x[a] -= sx * wa * bu; x[a + 1] -= sy * wa * bu; x[a + 2] -= sz * wa * bu;
        x[b] -= sx * wb * bv; x[b + 1] -= sy * wb * bv; x[b + 2] -= sz * wb * bv;
        x[c] -= sx * wc * bw; x[c + 1] -= sy * wc * bw; x[c + 2] -= sz * wc * bw;
        // silk on silk: no bounce. Remove the velocity that drives the two
        // layers into each other (and let them slide along each other).
        const v = this.v, gx = side * nx, gy = side * ny, gz = side * nz;
        const rel = ((x[q] - v[q]) - (x[a] - v[a]) * bu - (x[b] - v[b]) * bv - (x[c] - v[c]) * bw) * gx
          + ((x[q + 1] - v[q + 1]) - (x[a + 1] - v[a + 1]) * bu - (x[b + 1] - v[b + 1]) * bv - (x[c + 1] - v[c + 1]) * bw) * gy
          + ((x[q + 2] - v[q + 2]) - (x[a + 2] - v[a + 2]) * bu - (x[b + 2] - v[b + 2]) * bv - (x[c + 2] - v[c + 2]) * bw) * gz;
        if (rel < 0) {
          const mu = rel / denom;
          v[q] += gx * mu * wp; v[q + 1] += gy * mu * wp; v[q + 2] += gz * mu * wp;
          v[a] -= gx * mu * wa * bu; v[a + 1] -= gy * mu * wa * bu; v[a + 2] -= gz * mu * wa * bu;
          v[b] -= gx * mu * wb * bv; v[b + 1] -= gy * mu * wb * bv; v[b + 2] -= gz * mu * wb * bv;
          v[c] -= gx * mu * wc * bw; v[c + 1] -= gy * mu * wc * bw; v[c + 2] -= gz * mu * wc * bw;
        }
      }
    }
  }
}
