// Penetration-free cloth for the tie.
//
// The tie is a strip of particles, ROWS along its length and COLS across,
// cut to a real tie's width profile. It is solved with position-based
// dynamics in small sub-steps, and the contact handling is built so that
// no part of the tie can ever pass through another part, or through the
// collar:
//
//   1. Conservative motion bounds. At the start of every sub-step, each
//      particle finds its distance d to the nearest piece of fabric (or
//      collar) that isn't its own immediate neighbourhood. Nothing is then
//      allowed to move more than 0.45·d in that sub-step. Two things that
//      are d apart can close by at most 0.9·d, so they can never cross.
//      (This is the idea behind recent penetration-free solvers such as
//      "Offset Geometric Contact".)
//   2. Contact offset. Surfaces closer than the fabric thickness are pushed
//      apart along the contact normal, on the side they started on.
//   3. Everything else is ordinary cloth: barely-stretching silk, soft
//      bending along the length, stiffer across the width, gravity, air
//      drag, the shirt and neck as solid bodies.
//
// The simulation is run offline (tools/bake.mjs) and every recorded frame
// is checked with an exact triangle-intersection test.

import { TIE_LENGTH, tieWidth } from '../engine/tie-engine.js';
import { chestZFast as chestZ, NECK, COLLAR, collarLeafSurface } from '../engine/body.js';

export const ROWS = 264;
export const COLS = 5;
export const CONTACT = 0.42; // minimum distance between layers' mid-surfaces (cm)
const SEARCH = 0.9; // neighbourhood used for motion bounds (cm)
const GAMMA = 0.45; // fraction of the free distance a particle may move per bound interval
const BOUND_EVERY = 2; // sub-steps per bound measurement
// Elements whose rows are within one row of each other are the same patch of
// fabric (they share or neighbour vertices) and don't collide with each other.
// Anything further apart along the tie does, so a fold can never be tighter
// than the fabric is thick.

const GRAVITY = -981; // cm/s^2
const STRAIN = 0.01; // most a segment may stretch along the tie (silk hardly stretches)

// constraint stiffness per sub-step
const K_STRETCH = 1.0;
const K_ACROSS = 1.0;
const K_SHEAR = 0.6;
const K_BEND_ALONG = 0.03;
const K_BEND_ACROSS = 0.5;

export class TieCloth {
  constructor({ collar = true } = {}) {
    const R = ROWS, C = COLS, n = R * C;
    this.n = n;
    this.x = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.xs = new Float32Array(n * 3);
    this.t = new Float32Array(n * 3); // targets
    this.pull = new Float32Array(n); // attraction to targets per sub-step
    this.invMass = new Float32Array(n).fill(1);
    this.bound = new Float32Array(n);
    this.rowS = new Float32Array(R);
    this.rowW = new Float32Array(R);
    this.drag = 0.35; // fraction of speed kept after one second of free flight
    for (let i = 0; i < R; i++) {
      const s = (i / (R - 1)) * TIE_LENGTH;
      this.rowS[i] = s;
      this.rowW[i] = Math.max(0.25, tieWidth(Math.min(TIE_LENGTH - 0.02, Math.max(0.02, s))));
    }

    // constraints from the flat rest layout
    const rx = new Float32Array(n), ry = new Float32Array(n);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      rx[i * C + j] = (j / (C - 1) - 0.5) * this.rowW[i];
      ry[i * C + j] = this.rowS[i];
    }
    const cons = [], stretch = [];
    const add = (a, b, k, list = cons) => list.push(a, b, Math.hypot(rx[a] - rx[b], ry[a] - ry[b]), k);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const p = i * C + j;
      if (i + 1 < R) add(p, p + C, K_STRETCH, stretch);
      if (j + 1 < C) add(p, p + 1, K_ACROSS, stretch);
      if (i + 1 < R && j + 1 < C) { add(p, p + C + 1, K_SHEAR); add(p + 1, p + C, K_SHEAR); }
      if (i + 2 < R) add(p, p + 2 * C, K_BEND_ALONG);
      if (j + 2 < C) add(p, p + 2, K_BEND_ACROSS);
    }
    for (let i = 0; i < R; i++) add(i * C, i * C + C - 1, K_BEND_ACROSS);
    const pack = (list) => {
      const m = list.length / 4;
      const o = { a: new Uint32Array(m), b: new Uint32Array(m), rest: new Float32Array(m), k: new Float32Array(m) };
      for (let c = 0; c < m; c++) { o.a[c] = list[c * 4]; o.b[c] = list[c * 4 + 1]; o.rest[c] = list[c * 4 + 2]; o.k[c] = list[c * 4 + 3]; }
      return o;
    };
    this.cons = pack(cons);
    this.stretch = pack(stretch);
    // rest length to the next row down each column, for strain limiting
    this.restNext = new Float32Array(n);
    for (let i = 0; i + 1 < R; i++) for (let j = 0; j < C; j++) {
      const p = i * C + j;
      this.restNext[p] = Math.hypot(rx[p] - rx[p + C], ry[p] - ry[p + C]);
    }

    // cloth triangles
    const tris = [];
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
      const p = i * C + j;
      tris.push(p, p + C, p + 1, p + C, p + C + 1, p + 1);
    }
    this.tri = new Uint32Array(tris);
    this.nTri = tris.length / 3;
    this.triRow = new Int32Array(this.nTri); // lowest row the triangle touches (it spans two)
    for (let k = 0; k < this.nTri; k++) this.triRow[k] = Math.min(Math.floor(this.tri[k * 3] / C), Math.floor(this.tri[k * 3 + 1] / C), Math.floor(this.tri[k * 3 + 2] / C));

    // edges (along, across, triangle diagonals) for edge-edge bounds
    const edges = [];
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const p = i * C + j;
      if (i + 1 < R) edges.push(p, p + C);
      if (j + 1 < C) edges.push(p, p + 1);
      if (i + 1 < R && j + 1 < C) edges.push(p + 1, p + C);
    }
    this.edge = new Uint32Array(edges);
    this.nEdge = edges.length / 2;
    this.edgeRow = new Int32Array(this.nEdge);
    this.edgeRowMax = new Int32Array(this.nEdge);
    for (let e = 0; e < this.nEdge; e++) {
      this.edgeRow[e] = Math.min(Math.floor(edges[e * 2] / C), Math.floor(edges[e * 2 + 1] / C));
      this.edgeRowMax[e] = Math.max(Math.floor(edges[e * 2] / C), Math.floor(edges[e * 2 + 1] / C));
    }
    this.eHead = new Int32Array(this.TABLE_E = 1 << 15);
    this.eStamp = new Int32Array(this.TABLE_E);
    this.eEnt = new Int32Array(1 << 17);
    this.eNext = new Int32Array(1 << 17);
    this.eSeen = new Int32Array(this.nEdge + 1).fill(-1);

    // the collar leaf as a solid obstacle (coarse copy of the drawn one)
    if (collar) {
      const { pos, idx } = collarLeafSurface(56, 9);
      this.obsPos = pos; this.obsTri = idx; this.nObs = idx.length / 3;
    } else { this.obsPos = new Float32Array(0); this.obsTri = new Uint32Array(0); this.nObs = 0; }
    {
      const seenE = new Set(), oe = [];
      for (let k = 0; k < this.nObs; k++) for (let m = 0; m < 3; m++) {
        const a = this.obsTri[k * 3 + m], b = this.obsTri[k * 3 + (m + 1) % 3];
        const key = Math.min(a, b) * 1e6 + Math.max(a, b);
        if (!seenE.has(key)) { seenE.add(key); oe.push(a, b); }
      }
      this.obsEdge = new Uint32Array(oe);
      this.nObsEdge = oe.length / 2;
      this.nObsVert = this.obsPos.length / 3;
    }

    // spatial hash
    this.cell = 1.1;
    this.TABLE = 1 << 15;
    this.head = new Int32Array(this.TABLE);
    this.stamp = new Int32Array(this.TABLE);
    this.now = 0;
    this.entTri = new Int32Array(1 << 17);
    this.entNext = new Int32Array(1 << 17);
    this.seen = new Int32Array(this.nTri + this.nObs).fill(-1);
    // contacts found at the start of a sub-step: particle, triangle (>= nTri means obstacle), side
    this.cP = new Int32Array(1 << 16); this.cT = new Int32Array(1 << 16); this.cS = new Int8Array(1 << 16);
    this.nC = 0;
    // edge-edge contacts: edge, other edge (>= nEdge means a collar edge), separation direction
    this.eeA = new Int32Array(1 << 15); this.eeB = new Int32Array(1 << 15); this.eeN = new Float32Array(3 << 15);
    this.nEE = 0;
    this.stats = { contacts: 0, clamped: 0 };
  }

  /** Put the cloth on a set of positions, at rest. */
  place(pos) {
    this.x.set(pos); this.prev.set(pos); this.xb = null;
  }

  // ---------------------------------------------------------------------

  step(dt, substeps) {
    const h = dt / substeps;
    for (let s = 0; s < substeps; s++) this._substep(h, s);
  }

  // Bounds are measured every BOUND_EVERY sub-steps; the clamp then limits
  // the motion accumulated since that measurement, so the guarantee holds
  // over the whole interval.
  _substep(dt, s = 0) {
    const n = this.n, x = this.x, prev = this.prev, xs = this.xs, t = this.t, pull = this.pull, im = this.invMass;
    xs.set(x);
    if (s % BOUND_EVERY === 0 || !this.xb) {
      if (!this.xb) this.xb = new Float32Array(n * 3);
      this.xb.set(x);
      this._boundsAndContacts();
    }
    const g = GRAVITY * dt * dt;
    const keep = Math.pow(this.drag, dt);
    // integrate (Verlet), then pull towards targets
    for (let i = 0; i < n; i++) {
      const q = i * 3;
      if (im[i] === 0) { x[q] = t[q]; x[q + 1] = t[q + 1]; x[q + 2] = t[q + 2]; continue; }
      let nx = x[q] + (x[q] - prev[q]) * keep;
      let ny = x[q + 1] + (x[q + 1] - prev[q + 1]) * keep + g;
      let nz = x[q + 2] + (x[q + 2] - prev[q + 2]) * keep;
      const k = pull[i];
      if (k > 0) { nx += (t[q] - nx) * k; ny += (t[q + 1] - ny) * k; nz += (t[q + 2] - nz) * k; }
      x[q] = nx; x[q + 1] = ny; x[q + 2] = nz;
    }
    this._solve(this.stretch);
    this._solve(this.cons);
    this._solve(this.stretch);
    this._strainLimit();
    this._body();
    this._contacts();
    this._edgeContacts();
    this._clamp();
    prev.set(xs);
  }

  _solve(c) {
    const x = this.x, im = this.invMass, A = c.a, B = c.b, rest = c.rest, K = c.k;
    for (let i = 0, m = A.length; i < m; i++) {
      const a = A[i], b = B[i];
      const wa = im[a], wb = im[b], ws = wa + wb;
      if (ws === 0) continue;
      const qa = a * 3, qb = b * 3;
      const dx = x[qb] - x[qa], dy = x[qb + 1] - x[qa + 1], dz = x[qb + 2] - x[qa + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const corr = ((d - rest[i]) / (d * ws)) * K[i];
      x[qa] += dx * corr * wa; x[qa + 1] += dy * corr * wa; x[qa + 2] += dz * corr * wa;
      x[qb] -= dx * corr * wb; x[qb + 1] -= dy * corr * wb; x[qb + 2] -= dz * corr * wb;
    }
  }

  // A few Gauss-Seidel passes leave a long hanging chain stretchy: a blade
  // hanging under its own weight would sag 10-40% longer than it is. Silk
  // hardly stretches, so walk out from the held part of the tie (the neck
  // loop) to both ends and limit every segment to STRAIN over its rest
  // length. The weight of the hanging blades is then carried all the way up
  // to the neck, the way it is on a real tie.
  _strainLimit() {
    const R = ROWS, C = COLS, x = this.x, im = this.invMass, rn = this.restNext;
    let i0 = -1, i1 = -1;
    for (let i = 0; i < R; i++) if (im[i * C + 2] === 0) { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 < 0) return;
    const lim = 1 + STRAIN;
    const limit = (a, b, r) => { // move b towards a until |b - a| <= r
      const qa = a * 3, qb = b * 3;
      const dx = x[qb] - x[qa], dy = x[qb + 1] - x[qa + 1], dz = x[qb + 2] - x[qa + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= r * r || im[b] === 0) return;
      const f = r / Math.sqrt(d2);
      x[qb] = x[qa] + dx * f; x[qb + 1] = x[qa + 1] + dy * f; x[qb + 2] = x[qa + 2] + dz * f;
    };
    for (let j = 0; j < C; j++) {
      for (let i = i1 + 1; i < R; i++) limit((i - 1) * C + j, i * C + j, rn[(i - 1) * C + j] * lim);
      for (let i = i0 - 1; i >= 0; i--) limit((i + 1) * C + j, i * C + j, rn[i * C + j] * lim);
    }
  }

  // Shirt front (a height field in z) and the neck / collar band (cylinders).
  _body() {
    const n = this.n, x = this.x, im = this.invMass;
    const r = CONTACT * 0.5;
    for (let i = 0; i < n; i++) {
      if (im[i] === 0) continue;
      const q = i * 3;
      const px = x[q], py = x[q + 1];
      if (py < 0.5) {
        const z0 = chestZ(px, py);
        if (Number.isFinite(z0) && x[q + 2] < z0 + r) x[q + 2] = z0 + r;
      }
      if (py > -1.2 && py < NECK.top) {
        const rr = py < 5.5 ? COLLAR.bandR + r : NECK.r + r;
        const dx = px, dz = x[q + 2] - NECK.z;
        const d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-6) { const f = rr / d; x[q] = dx * f; x[q + 2] = NECK.z + dz * f; }
      }
    }
  }

  // Bounds (how far each particle may move) and contacts, from the
  // positions at the start of the sub-step.
  _boundsAndContacts() {
    const C = COLS, xs = this.xb, tri = this.tri, nT = this.nTri, nO = this.nObs, op = this.obsPos, ot = this.obsTri;
    const bound = this.bound, im = this.invMass;
    bound.fill(SEARCH);
    const cs = this.cell, inv = 1 / cs, MASK = this.TABLE - 1;
    const head = this.head, stamp = this.stamp, ent = this.entTri, next = this.entNext, seen = this.seen;
    const now = ++this.now;
    const hash = (ix, iy, iz) => (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) >>> 0) & MASK;
    let ne = 0;
    const insert = (k, x0, x1, y0, y1, z0, z1) => {
      const ax = Math.floor(x0 * inv), bx = Math.floor(x1 * inv), ay = Math.floor(y0 * inv), by = Math.floor(y1 * inv), az = Math.floor(z0 * inv), bz = Math.floor(z1 * inv);
      for (let ix = ax; ix <= bx; ix++) for (let iy = ay; iy <= by; iy++) for (let iz = az; iz <= bz; iz++) {
        if (ne >= ent.length) return;
        const hh = hash(ix, iy, iz);
        if (stamp[hh] !== now) { stamp[hh] = now; head[hh] = -1; }
        ent[ne] = k; next[ne] = head[hh]; head[hh] = ne; ne++;
      }
    };
    const sph = this._sph || (this._sph = new Float32Array((nT + nO) * 4));
    for (let k = 0; k < nT; k++) {
      const a = tri[k * 3] * 3, b = tri[k * 3 + 1] * 3, c = tri[k * 3 + 2] * 3;
      const cx = (xs[a] + xs[b] + xs[c]) / 3, cy = (xs[a + 1] + xs[b + 1] + xs[c + 1]) / 3, cz = (xs[a + 2] + xs[b + 2] + xs[c + 2]) / 3;
      sph[k * 4] = cx; sph[k * 4 + 1] = cy; sph[k * 4 + 2] = cz;
      sph[k * 4 + 3] = Math.sqrt(Math.max(
        (xs[a] - cx) ** 2 + (xs[a + 1] - cy) ** 2 + (xs[a + 2] - cz) ** 2,
        (xs[b] - cx) ** 2 + (xs[b + 1] - cy) ** 2 + (xs[b + 2] - cz) ** 2,
        (xs[c] - cx) ** 2 + (xs[c + 1] - cy) ** 2 + (xs[c + 2] - cz) ** 2)) + SEARCH;
      insert(k, Math.min(xs[a], xs[b], xs[c]), Math.max(xs[a], xs[b], xs[c]),
        Math.min(xs[a + 1], xs[b + 1], xs[c + 1]), Math.max(xs[a + 1], xs[b + 1], xs[c + 1]),
        Math.min(xs[a + 2], xs[b + 2], xs[c + 2]), Math.max(xs[a + 2], xs[b + 2], xs[c + 2]));
    }
    for (let k = 0; k < nO; k++) {
      const a = ot[k * 3] * 3, b = ot[k * 3 + 1] * 3, c = ot[k * 3 + 2] * 3;
      const cx = (op[a] + op[b] + op[c]) / 3, cy = (op[a + 1] + op[b + 1] + op[c + 1]) / 3, cz = (op[a + 2] + op[b + 2] + op[c + 2]) / 3;
      const s4 = (nT + k) * 4;
      sph[s4] = cx; sph[s4 + 1] = cy; sph[s4 + 2] = cz;
      sph[s4 + 3] = Math.sqrt(Math.max(
        (op[a] - cx) ** 2 + (op[a + 1] - cy) ** 2 + (op[a + 2] - cz) ** 2,
        (op[b] - cx) ** 2 + (op[b + 1] - cy) ** 2 + (op[b + 2] - cz) ** 2,
        (op[c] - cx) ** 2 + (op[c + 1] - cy) ** 2 + (op[c + 2] - cz) ** 2)) + SEARCH;
      insert(nT + k, Math.min(op[a], op[b], op[c]), Math.max(op[a], op[b], op[c]),
        Math.min(op[a + 1], op[b + 1], op[c + 1]), Math.max(op[a + 1], op[b + 1], op[c + 1]),
        Math.min(op[a + 2], op[b + 2], op[c + 2]), Math.max(op[a + 2], op[b + 2], op[c + 2]));
    }
    seen.fill(-1);
    const out = this._cp || (this._cp = new Float64Array(4));
    let nc = 0;
    const n = this.n, cP = this.cP, cT = this.cT, cS = this.cS, near = CONTACT * 1.6;
    for (let p = 0; p < n; p++) {
      const q = p * 3;
      const px = xs[q], py = xs[q + 1], pz = xs[q + 2];
      const row = Math.floor(p / C);
      const ix = Math.floor(px * inv), iy = Math.floor(py * inv), iz = Math.floor(pz * inv);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const hh = hash(ix + dx, iy + dy, iz + dz);
        if (stamp[hh] !== now) continue;
        for (let e = head[hh]; e !== -1; e = next[e]) {
          const k = ent[e];
          if (seen[k] === p) continue;
          seen[k] = p;
          {
            const s4 = k * 4, ex = px - sph[s4], ey = py - sph[s4 + 1], ez = pz - sph[s4 + 2], rr = sph[s4 + 3];
            if (ex * ex + ey * ey + ez * ez > rr * rr) continue;
          }
          let ax, ay, az, bx, by, bz, cx, cy, cz, va = -1, vb = -1, vc = -1;
          if (k < nT) {
            const r0 = this.triRow[k];
            if (row >= r0 - 1 && row <= r0 + 2) continue; // same patch
            va = tri[k * 3]; vb = tri[k * 3 + 1]; vc = tri[k * 3 + 2];

            ax = xs[va * 3]; ay = xs[va * 3 + 1]; az = xs[va * 3 + 2];
            bx = xs[vb * 3]; by = xs[vb * 3 + 1]; bz = xs[vb * 3 + 2];
            cx = xs[vc * 3]; cy = xs[vc * 3 + 1]; cz = xs[vc * 3 + 2];
          } else {
            const o = (k - nT) * 3;
            const a3 = ot[o] * 3, b3 = ot[o + 1] * 3, c3 = ot[o + 2] * 3;
            ax = op[a3]; ay = op[a3 + 1]; az = op[a3 + 2];
            bx = op[b3]; by = op[b3 + 1]; bz = op[b3 + 2];
            cx = op[c3]; cy = op[c3 + 1]; cz = op[c3 + 2];
          }
          const d = closestPointTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, out);
          if (d >= SEARCH) continue;
          if (d < bound[p]) bound[p] = d;
          if (va >= 0) {
            if (d < bound[va]) bound[va] = d;
            if (d < bound[vb]) bound[vb] = d;
            if (d < bound[vc]) bound[vc] = d;
          }
          if (d < near && nc < cP.length) {
            // which side of the triangle's plane the particle is on, right now
            const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
            const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
            const sd = (px - ax) * nx + (py - ay) * ny + (pz - az) * nz;
            if (sd === 0) continue;
            cP[nc] = p; cT[nc] = k; cS[nc] = sd > 0 ? 1 : -1; nc++;
          }
        }
      }
    }
    this.nC = nc;
    this.stats.contacts = nc;
    // collar corners against tie faces (a collar point must not poke through the tie)
    for (let v = 0; v < this.nObsVert; v++) {
      const px = op[v * 3], py = op[v * 3 + 1], pz = op[v * 3 + 2];
      const ix = Math.floor(px * inv), iy = Math.floor(py * inv), iz = Math.floor(pz * inv);
      const tag = -2 - v; // distinct from particle ids in `seen`
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const hh = hash(ix + dx, iy + dy, iz + dz);
        if (stamp[hh] !== now) continue;
        for (let e = head[hh]; e !== -1; e = next[e]) {
          const k = ent[e];
          if (k >= nT || seen[k] === tag) continue;
          seen[k] = tag;
          const va = tri[k * 3], vb = tri[k * 3 + 1], vc = tri[k * 3 + 2];
          const d = closestPointTriangle(px, py, pz, xs[va * 3], xs[va * 3 + 1], xs[va * 3 + 2], xs[vb * 3], xs[vb * 3 + 1], xs[vb * 3 + 2], xs[vc * 3], xs[vc * 3 + 1], xs[vc * 3 + 2], null);
          if (d >= SEARCH) continue;
          if (d < bound[va]) bound[va] = d;
          if (d < bound[vb]) bound[vb] = d;
          if (d < bound[vc]) bound[vc] = d;
        }
      }
    }
    this._edgeBounds();
  }

  // Edge-edge distances: two edges can cross without either's corners going
  // through a face (think of two folded sheets sliding past each other), so
  // their endpoints are bounded by the edge-edge distance as well.
  _edgeBounds() {
    const xs = this.xb, E = this.edge, nE = this.nEdge, bound = this.bound, im = this.invMass;
    const cs = this.cell, inv = 1 / cs, MASK = this.TABLE_E - 1;
    const head = this.eHead, stamp = this.eStamp, ent = this.eEnt, next = this.eNext, seen = this.eSeen;
    const now = this.now;
    const hash = (ix, iy, iz) => (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) >>> 0) & MASK;
    let ne = 0;
    for (let e = 0; e < nE; e++) {
      const a = E[e * 2] * 3, b = E[e * 2 + 1] * 3;
      const ax = Math.floor(Math.min(xs[a], xs[b]) * inv), bx = Math.floor(Math.max(xs[a], xs[b]) * inv);
      const ay = Math.floor(Math.min(xs[a + 1], xs[b + 1]) * inv), by = Math.floor(Math.max(xs[a + 1], xs[b + 1]) * inv);
      const az = Math.floor(Math.min(xs[a + 2], xs[b + 2]) * inv), bz = Math.floor(Math.max(xs[a + 2], xs[b + 2]) * inv);
      for (let ix = ax; ix <= bx; ix++) for (let iy = ay; iy <= by; iy++) for (let iz = az; iz <= bz; iz++) {
        if (ne >= ent.length) break;
        const hh = hash(ix, iy, iz);
        if (stamp[hh] !== now) { stamp[hh] = now; head[hh] = -1; }
        ent[ne] = e; next[ne] = head[hh]; head[hh] = ne; ne++;
      }
    }
    const OE = this.obsEdge, nOE = this.nObsEdge, op = this.obsPos;
    for (let j = 0; j < nOE; j++) {
      const a = OE[j * 2] * 3, b = OE[j * 2 + 1] * 3;
      const ax = Math.floor(Math.min(op[a], op[b]) * inv), bx = Math.floor(Math.max(op[a], op[b]) * inv);
      const ay = Math.floor(Math.min(op[a + 1], op[b + 1]) * inv), by = Math.floor(Math.max(op[a + 1], op[b + 1]) * inv);
      const az = Math.floor(Math.min(op[a + 2], op[b + 2]) * inv), bz = Math.floor(Math.max(op[a + 2], op[b + 2]) * inv);
      for (let ix = ax; ix <= bx; ix++) for (let iy = ay; iy <= by; iy++) for (let iz = az; iz <= bz; iz++) {
        if (ne >= ent.length) break;
        const hh = hash(ix, iy, iz);
        if (stamp[hh] !== now) { stamp[hh] = now; head[hh] = -1; }
        ent[ne] = nE + j; next[ne] = head[hh]; head[hh] = ne; ne++;
      }
    }
    const eeA = this.eeA, eeB = this.eeB, eeN = this.eeN, cp = this._cp6 || (this._cp6 = new Float64Array(8));
    let nee = 0;
    const oSeen = this._oSeen || (this._oSeen = new Int32Array(nOE));
    oSeen.fill(-1);
    seen.fill(-1);
    const eRow = this.edgeRow, eMax = this.edgeRowMax;
    const es = this._esph || (this._esph = new Float32Array(nE * 4));
    for (let e = 0; e < nE; e++) {
      const a = E[e * 2] * 3, b = E[e * 2 + 1] * 3;
      es[e * 4] = (xs[a] + xs[b]) * 0.5; es[e * 4 + 1] = (xs[a + 1] + xs[b + 1]) * 0.5; es[e * 4 + 2] = (xs[a + 2] + xs[b + 2]) * 0.5;
      es[e * 4 + 3] = 0.5 * Math.hypot(xs[b] - xs[a], xs[b + 1] - xs[a + 1], xs[b + 2] - xs[a + 2]);
    }
    for (let e = 0; e < nE; e++) {
      const i0 = E[e * 2], i1 = E[e * 2 + 1];
      const a = i0 * 3, b = i1 * 3;
      const re = eRow[e];
      // every cell within SEARCH of any point of this edge
      const x0 = Math.floor((Math.min(xs[a], xs[b]) - SEARCH) * inv), x1 = Math.floor((Math.max(xs[a], xs[b]) + SEARCH) * inv);
      const y0 = Math.floor((Math.min(xs[a + 1], xs[b + 1]) - SEARCH) * inv), y1 = Math.floor((Math.max(xs[a + 1], xs[b + 1]) + SEARCH) * inv);
      const z0 = Math.floor((Math.min(xs[a + 2], xs[b + 2]) - SEARCH) * inv), z1 = Math.floor((Math.max(xs[a + 2], xs[b + 2]) + SEARCH) * inv);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) {
        const hh = hash(cx, cy, cz);
        if (stamp[hh] !== now) continue;
        for (let k = head[hh]; k !== -1; k = next[k]) {
          const f = ent[k];
          if (f >= nE) {
            // a collar edge (static): only this edge's ends are bounded
            const j = f - nE;
            if (oSeen[j] === e) continue;
            oSeen[j] = e;
            const c = OE[j * 2] * 3, d = OE[j * 2 + 1] * 3;
            const dist = segSegDist(xs[a], xs[a + 1], xs[a + 2], xs[b], xs[b + 1], xs[b + 2], op[c], op[c + 1], op[c + 2], op[d], op[d + 1], op[d + 2], cp);
            if (dist < CONTACT * 1.3 && dist > 1e-7 && nee < eeA.length) {
              eeA[nee] = e; eeB[nee] = f;
              eeN[nee * 3] = (cp[0] - cp[3]) / dist; eeN[nee * 3 + 1] = (cp[1] - cp[4]) / dist; eeN[nee * 3 + 2] = (cp[2] - cp[5]) / dist;
              nee++;
            }
            if (dist < SEARCH) {
              if (dist < bound[i0]) bound[i0] = dist;
              if (dist < bound[i1]) bound[i1] = dist;
            }
            continue;
          }
          if (f <= e || seen[f] === e) continue;
          seen[f] = e;
          if (eRow[f] <= eMax[e] + 1 && re <= eMax[f] + 1) continue; // same patch
          {
            const ex = es[e * 4] - es[f * 4], ey = es[e * 4 + 1] - es[f * 4 + 1], ez = es[e * 4 + 2] - es[f * 4 + 2];
            const rr = es[e * 4 + 3] + es[f * 4 + 3] + SEARCH;
            if (ex * ex + ey * ey + ez * ez > rr * rr) continue;
          }
          const j0 = E[f * 2], j1 = E[f * 2 + 1];

          const c = j0 * 3, d = j1 * 3;
          const dist = segSegDist(xs[a], xs[a + 1], xs[a + 2], xs[b], xs[b + 1], xs[b + 2], xs[c], xs[c + 1], xs[c + 2], xs[d], xs[d + 1], xs[d + 2], cp);
          if (dist >= SEARCH) continue;
          if (dist < CONTACT * 1.3 && dist > 1e-7 && nee < eeA.length) {
            eeA[nee] = e; eeB[nee] = f;
            eeN[nee * 3] = (cp[0] - cp[3]) / dist; eeN[nee * 3 + 1] = (cp[1] - cp[4]) / dist; eeN[nee * 3 + 2] = (cp[2] - cp[5]) / dist;
            nee++;
          }
          if (dist < bound[i0]) bound[i0] = dist;
          if (dist < bound[i1]) bound[i1] = dist;
          if (dist < bound[j0]) bound[j0] = dist;
          if (dist < bound[j1]) bound[j1] = dist;
        }
      }
    }
    this.nEE = nee;
  }

  // Edges closer than the fabric thickness are pushed apart along the
  // direction that separated them when the contact was found.
  _edgeContacts() {
    const x = this.x, im = this.invMass, E = this.edge, nE = this.nEdge, OE = this.obsEdge, op = this.obsPos;
    const cp = this._cp6b || (this._cp6b = new Float64Array(8));
    for (let c = 0; c < this.nEE; c++) {
      const e = this.eeA[c], f = this.eeB[c];
      const nx = this.eeN[c * 3], ny = this.eeN[c * 3 + 1], nz = this.eeN[c * 3 + 2];
      const i0 = E[e * 2], i1 = E[e * 2 + 1];
      const a = i0 * 3, b = i1 * 3;
      let j0 = -1, j1 = -1, P;
      if (f < nE) { j0 = E[f * 2]; j1 = E[f * 2 + 1]; P = x; } else { j0 = OE[(f - nE) * 2]; j1 = OE[(f - nE) * 2 + 1]; P = op; }
      const q0 = j0 * 3, q1 = j1 * 3;
      segSegDist(x[a], x[a + 1], x[a + 2], x[b], x[b + 1], x[b + 2], P[q0], P[q0 + 1], P[q0 + 2], P[q1], P[q1 + 1], P[q1 + 2], cp);
      const dn = (cp[0] - cp[3]) * nx + (cp[1] - cp[4]) * ny + (cp[2] - cp[5]) * nz;
      const pen = CONTACT - dn;
      if (pen <= 0) continue;
      const s = cp[6], t = cp[7];
      const w0 = im[i0] * (1 - s), w1 = im[i1] * s;
      const v0 = f < nE ? im[j0] * (1 - t) : 0, v1 = f < nE ? im[j1] * t : 0;
      const denom = w0 * (1 - s) + w1 * s + v0 * (1 - t) + v1 * t;
      if (denom < 1e-9) continue;
      const lam = pen / denom;
      x[a] += nx * lam * w0; x[a + 1] += ny * lam * w0; x[a + 2] += nz * lam * w0;
      x[b] += nx * lam * w1; x[b + 1] += ny * lam * w1; x[b + 2] += nz * lam * w1;
      if (f < nE) {
        x[q0] -= nx * lam * v0; x[q0 + 1] -= ny * lam * v0; x[q0 + 2] -= nz * lam * v0;
        x[q1] -= nx * lam * v1; x[q1 + 1] -= ny * lam * v1; x[q1 + 2] -= nz * lam * v1;
      }
    }
  }

  // Keep contacting surfaces at least CONTACT apart, each on its own side.
  _contacts() {
    const x = this.x, im = this.invMass, tri = this.tri, nT = this.nTri, op = this.obsPos, ot = this.obsTri;
    const h = CONTACT;
    for (let c = 0; c < this.nC; c++) {
      const p = this.cP[c], k = this.cT[c], side = this.cS[c];
      const q = p * 3;
      let ax, ay, az, bx, by, bz, cx, cy, cz, va = -1, vb = -1, vc = -1;
      if (k < nT) {
        va = tri[k * 3]; vb = tri[k * 3 + 1]; vc = tri[k * 3 + 2];
        ax = x[va * 3]; ay = x[va * 3 + 1]; az = x[va * 3 + 2];
        bx = x[vb * 3]; by = x[vb * 3 + 1]; bz = x[vb * 3 + 2];
        cx = x[vc * 3]; cy = x[vc * 3 + 1]; cz = x[vc * 3 + 2];
      } else {
        const o = (k - nT) * 3;
        const a3 = ot[o] * 3, b3 = ot[o + 1] * 3, c3 = ot[o + 2] * 3;
        ax = op[a3]; ay = op[a3 + 1]; az = op[a3 + 2];
        bx = op[b3]; by = op[b3 + 1]; bz = op[b3 + 2];
        cx = op[c3]; cy = op[c3 + 1]; cz = op[c3 + 2];
      }
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      const px = x[q], py = x[q + 1], pz = x[q + 2];
      const d = (px - ax) * nx + (py - ay) * ny + (pz - az) * nz;
      const pen = h - side * d;
      if (pen <= 0) continue;
      // barycentric weights of the projection (clamped onto the triangle)
      const qx = px - d * nx - ax, qy = py - d * ny - ay, qz = pz - d * nz - az;
      const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z, d11 = e2x * e2x + e2y * e2y + e2z * e2z;
      const d20 = qx * e1x + qy * e1y + qz * e1z, d21 = qx * e2x + qy * e2y + qz * e2z;
      const den = d00 * d11 - d01 * d01;
      if (den < 1e-12) continue;
      let bv = (d11 * d20 - d01 * d21) / den, bw = (d00 * d21 - d01 * d20) / den;
      // only push if the particle is over the triangle (with a small margin)
      if (bv < -0.15 || bw < -0.15 || bv + bw > 1.15) continue;
      bv = Math.min(1, Math.max(0, bv)); bw = Math.min(1 - bv, Math.max(0, bw));
      const bu = 1 - bv - bw;
      const wp = im[p];
      const wa = va >= 0 ? im[va] : 0, wb = va >= 0 ? im[vb] : 0, wc = va >= 0 ? im[vc] : 0;
      const denom = wp + wa * bu * bu + wb * bv * bv + wc * bw * bw;
      if (denom < 1e-9) continue;
      const lam = pen / denom;
      const sx = side * nx * lam, sy = side * ny * lam, sz = side * nz * lam;
      x[q] += sx * wp; x[q + 1] += sy * wp; x[q + 2] += sz * wp;
      if (va >= 0) {
        x[va * 3] -= sx * wa * bu; x[va * 3 + 1] -= sy * wa * bu; x[va * 3 + 2] -= sz * wa * bu;
        x[vb * 3] -= sx * wb * bv; x[vb * 3 + 1] -= sy * wb * bv; x[vb * 3 + 2] -= sz * wb * bv;
        x[vc * 3] -= sx * wc * bw; x[vc * 3 + 1] -= sy * wc * bw; x[vc * 3 + 2] -= sz * wc * bw;
      }
    }
  }

  // The guarantee: no particle moves further than GAMMA x its free distance.
  _clamp() {
    const n = this.n, x = this.x, xs = this.xb, bound = this.bound, im = this.invMass;
    let clamped = 0;
    // (pinned points too: when a pin moves, it must not jump through anything either)
    for (let i = 0; i < n; i++) {
      const q = i * 3;
      const dx = x[q] - xs[q], dy = x[q + 1] - xs[q + 1], dz = x[q + 2] - xs[q + 2];
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const maxL = GAMMA * bound[i];
      if (L > maxL) {
        const f = maxL / L;
        x[q] = xs[q] + dx * f; x[q + 1] = xs[q + 1] + dy * f; x[q + 2] = xs[q + 2] + dz * f;
        clamped++;
      }
    }
    this.stats.clamped = clamped;
  }
}

// Distance between segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection).
export function segSegDist(p1x, p1y, p1z, q1x, q1y, q1z, p2x, p2y, p2z, q2x, q2y, q2z, out = null) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z;
  const d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) { s = t = 0; }
  else if (a <= 1e-12) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-12) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const den = a * e - b * b;
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const ax = p1x + d1x * s, ay = p1y + d1y * s, az = p1z + d1z * s;
  const bx = p2x + d2x * t, by = p2y + d2y * t, bz = p2z + d2z * t;
  if (out) { out[0] = ax; out[1] = ay; out[2] = az; out[3] = bx; out[4] = by; out[5] = bz; out[6] = s; out[7] = t; }
  const x = ax - bx, y = ay - by, z = az - bz;
  return Math.sqrt(x * x + y * y + z * z);
}

// Closest point on triangle abc to p (Ericson, Real-Time Collision Detection).
// Returns the distance; writes the closest point into out[0..2].
export function closestPointTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, out) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let rx, ry, rz;
  if (d1 <= 0 && d2 <= 0) { rx = ax; ry = ay; rz = az; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { rx = bx; ry = by; rz = bz; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3); rx = ax + abx * v; ry = ay + aby * v; rz = az + abz * v;
      } else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { rx = cx; ry = cy; rz = cz; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const w = d2 / (d2 - d6); rx = ax + acx * w; ry = ay + acy * w; rz = az + acz * w;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
              rx = bx + (cx - bx) * w; ry = by + (cy - by) * w; rz = bz + (cz - bz) * w;
            } else {
              const den = 1 / (va + vb + vc);
              const v = vb * den, w = vc * den;
              rx = ax + abx * v + acx * w; ry = ay + aby * v + acy * w; rz = az + abz * v + acz * w;
            }
          }
        }
      }
    }
  }
  if (out) { out[0] = rx; out[1] = ry; out[2] = rz; }
  return Math.sqrt((px - rx) * (px - rx) + (py - ry) * (py - ry) + (pz - rz) * (pz - rz));
}

// Targets for every particle from a knot pose (centre-line P, silk normal N).
export function poseTargets(P, N, samples, rowW, out) {
  const R = ROWS, C = COLS;
  let pwx = 0, pwy = 0, pwz = 0;
  for (let i = 0; i < R; i++) {
    const f = (i / (R - 1)) * (samples - 1);
    const k = Math.min(samples - 2, Math.floor(f)), a = f - k;
    const px = P[k * 3] + (P[k * 3 + 3] - P[k * 3]) * a;
    const py = P[k * 3 + 1] + (P[k * 3 + 4] - P[k * 3 + 1]) * a;
    const pz = P[k * 3 + 2] + (P[k * 3 + 5] - P[k * 3 + 2]) * a;
    const k0 = Math.max(0, k - 1), k1 = Math.min(samples - 1, k + 2);
    let tx = P[k1 * 3] - P[k0 * 3], ty = P[k1 * 3 + 1] - P[k0 * 3 + 1], tz = P[k1 * 3 + 2] - P[k0 * 3 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let nx = N[k * 3] + (N[k * 3 + 3] - N[k * 3]) * a;
    let ny = N[k * 3 + 1] + (N[k * 3 + 4] - N[k * 3 + 1]) * a;
    let nz = N[k * 3 + 2] + (N[k * 3 + 5] - N[k * 3 + 2]) * a;
    const d = nx * tx + ny * ty + nz * tz;
    nx -= d * tx; ny -= d * ty; nz -= d * tz;
    let wx = ny * tz - nz * ty, wy = nz * tx - nx * tz, wz = nx * ty - ny * tx;
    let wl = Math.hypot(wx, wy, wz);
    if (wl < 1e-6) { wx = pwx; wy = pwy; wz = pwz; wl = 1; }
    wx /= wl; wy /= wl; wz /= wl;
    if (i > 0 && wx * pwx + wy * pwy + wz * pwz < 0) { wx = -wx; wy = -wy; wz = -wz; }
    pwx = wx; pwy = wy; pwz = wz;
    for (let j = 0; j < C; j++) {
      const o = (j / (C - 1) - 0.5) * rowW[i];
      const q = (i * C + j) * 3;
      out[q] = px + wx * o; out[q + 1] = py + wy * o; out[q + 2] = pz + wz * o;
    }
  }
  return out;
}
