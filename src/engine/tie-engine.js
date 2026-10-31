// Tie engine: turns a Fink–Mao move sequence into the 3D pose of one
// continuous 147 cm tie.
//
// The tie is a single ribbon running from the narrow tip, up the narrow blade,
// around the neck and down through the knot to the wide tip. A pose is a list
// of points along that ribbon plus the direction the *silk* (front) face points.
// Because the ribbon is one continuous piece of fixed length, a few things
// follow from the geometry without extra bookkeeping:
//   * what passes over and under is decided by depth (z) at the crossings,
//   * the seam side shows whenever the blade has just passed underneath,
//   * every wrap uses up length, so bigger knots finish higher up the shirt.
//
// Coordinates: see body.js (mirror view, +x = wearer's right, +z = towards you).

import { Vector3 } from 'three';
import { NECK, COLLAR, bodyClearZ, chestNormal } from './body.js';

export const TIE_LENGTH = 150;
export const SAMPLES = 560;

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// Tie shape (width in cm at a distance s from the narrow tip)

export function tieWidth(s) {
  const L = TIE_LENGTH;
  const tipN = 1.85, wN = 3.7; // narrow blade: 3.7 cm, 90° point
  const tipW = 4.25, wW = 8.5; // wide blade: 8.5 cm, 90° point
  if (s <= 0 || s >= L) return 0;
  if (s < tipN) return wN * (s / tipN);
  if (s > L - tipW) return wW * ((L - s) / tipW);
  if (s < 36) return lerp(wN, 3.0, smooth((s - tipN) / (36 - tipN)));
  if (s < 74) return 3.0;
  const t = (s - 74) / (L - tipW - 74);
  return 3.0 + (wW - 3.0) * Math.pow(t, 1.3);
}

// ---------------------------------------------------------------------------
// Fixed anchors: where the tie leaves the collar on each side.

const LOOP_FRONT = 24 * Math.PI / 180;
function loopPoint(theta) {
  // theta = 0 at the front of the neck, negative towards the wearer's left
  const r = COLLAR.tieR;
  return V(r * Math.sin(theta), 1.55 + 1.6 * (1 - Math.cos(theta)) / 2, NECK.z + r * Math.cos(theta));
}
function loopNormal(theta) {
  return V(Math.sin(theta), 0, Math.cos(theta));
}
export const CL = loopPoint(-LOOP_FRONT); // collar exit, wearer's left (narrow side)
export const CR = loopPoint(LOOP_FRONT); // collar exit, wearer's right (wide side)

function neckLoop() {
  // From the wearer's left collar exit, around the back, to the right exit.
  const out = [];
  const a0 = -LOOP_FRONT, a1 = -2 * Math.PI + LOOP_FRONT;
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const th = lerp(a0, a1, i / n);
    out.push({ p: loopPoint(th), n: loopNormal(th) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spline helpers

function phantomStart(p) { return p.length > 1 ? p[0].clone().multiplyScalar(2).sub(p[1]) : p[0].clone(); }
function phantomEnd(p) { const n = p.length; return n > 1 ? p[n - 1].clone().multiplyScalar(2).sub(p[n - 2]) : p[n - 1].clone(); }

function centripetal(p0, p1, p2, p3, t) {
  const a = 0.5;
  const t01 = Math.max(Math.pow(p0.distanceTo(p1), a), 1e-4);
  const t12 = Math.max(Math.pow(p1.distanceTo(p2), a), 1e-4);
  const t23 = Math.max(Math.pow(p2.distanceTo(p3), a), 1e-4);
  const m1 = p2.clone().sub(p1).add(
    p1.clone().sub(p0).divideScalar(t01).sub(p2.clone().sub(p0).divideScalar(t01 + t12)).multiplyScalar(t12));
  const m2 = p2.clone().sub(p1).add(
    p3.clone().sub(p2).divideScalar(t23).sub(p3.clone().sub(p1).divideScalar(t12 + t23)).multiplyScalar(t12));
  const t2 = t * t, t3 = t2 * t;
  return p1.clone().multiplyScalar(2 * t3 - 3 * t2 + 1)
    .add(m1.multiplyScalar(t3 - 2 * t2 + t))
    .add(p2.clone().multiplyScalar(-2 * t3 + 3 * t2))
    .add(m2.multiplyScalar(t3 - t2));
}

function uniformCR(n0, n1, n2, n3, t) {
  const t2 = t * t, t3 = t2 * t;
  const m1 = n2.clone().sub(n0).multiplyScalar(0.5), m2 = n3.clone().sub(n1).multiplyScalar(0.5);
  return n1.clone().multiplyScalar(2 * t3 - 3 * t2 + 1).add(m1.multiplyScalar(t3 - 2 * t2 + t))
    .add(n2.clone().multiplyScalar(-2 * t3 + 3 * t2)).add(m2.multiplyScalar(t3 - t2));
}

// Waypoints {p, n} -> dense polyline with smoothly varying face normals.
function densify(wps, spacing = 0.45) {
  const P = wps.map((w) => w.p), N = wps.map((w) => w.n.clone().normalize());
  const pts = [], nrm = [], cup = [];
  const nW = P.length;
  const ext = [phantomStart(P), ...P, phantomEnd(P)];
  const extN = [N[0], ...N, N[nW - 1]];
  for (let i = 0; i < nW - 1; i++) {
    const seg = P[i].distanceTo(P[i + 1]);
    const sub = Math.max(2, Math.ceil(seg / spacing));
    for (let j = 0; j < sub; j++) {
      const t = j / sub;
      pts.push(centripetal(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], t));
      nrm.push(uniformCR(extN[i], extN[i + 1], extN[i + 2], extN[i + 3], t).normalize());
      cup.push(lerp(wps[i].cup || 0, wps[i + 1].cup || 0, smooth(t)));
    }
  }
  pts.push(P[nW - 1].clone()); nrm.push(N[nW - 1].clone()); cup.push(wps[nW - 1].cup || 0);
  return { pts, nrm, cup };
}

function polyLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]);
  return l;
}

// ---------------------------------------------------------------------------
// Free ends: let a blade fall under "gravity" and rest on the shirt.
//   mode 'hang' : bend towards straight down, drifting to xTarget
//   mode 'up'   : held up out of the neck loop, then flopping over to `side`

function genTail(p0, d0, sign, length, opt = {}) {
  const pts = [], nrm = [];
  const clear = opt.clear ?? 0.5;
  const radius = opt.radius ?? 5;
  let p = p0.clone();
  let d = d0.clone().normalize();
  let s = 0, phase = opt.mode === 'up' ? 0 : 2;
  const ds = 0.45;
  const rest = (q) => bodyClearZ(q.x, q.y) + clear;
  while (s < length - 1e-6) {
    const step = Math.min(ds, length - s);
    let target;
    if (phase === 0) {
      target = V(0, 1, opt.lean ?? 0.3).normalize();
      if (opt.upLen && s > opt.upLen) phase = 1;
    } else if (phase === 1) {
      target = V(opt.side ?? 1, -0.25, 0.25).normalize();
      if (d.y < -0.2) phase = 2;
    } else {
      const xT = opt.xTarget ?? p.x;
      const dz = clamp((rest(p) - p.z) * (opt.settle ?? 0.25), -0.6, 0.6);
      target = V(clamp((xT - p.x) * 0.06, -0.35, 0.35), -1, dz).normalize();
    }
    const r = phase === 1 ? (opt.flopRadius ?? 3.6) : radius;
    const maxTurn = step / r;
    const ang = d.angleTo(target);
    if (ang > 1e-5) {
      const k = Math.min(1, maxTurn / ang);
      d.lerp(target, k).normalize();
    }
    const prev = p.clone();
    p.addScaledVector(d, step);
    const zMin = rest(p);
    if (p.z < zMin) { p.z = zMin; d.copy(p.clone().sub(prev).normalize()); }
    s += step;
    // face normal: lie flat on the shirt (or face out) with the right side showing
    const cn = chestNormal(p.x, p.y);
    let n = V(cn[0], cn[1], cn[2]).multiplyScalar(sign);
    if (phase !== 2) n = V(0, 0, sign);
    n.addScaledVector(d, -n.dot(d)).normalize();
    pts.push(p.clone());
    nrm.push(n);
  }
  return { pts, nrm };
}

// ---------------------------------------------------------------------------
// Knot geometry

// Hub parameters. LOOSE is how the knot looks while you build it; TIGHT is
// after it has been slid up to the collar. `size` widens bigger knots.
export const LOOSE = {
  K: V(0, -7.8, 1.6), gf: 0.8, gb: 0.62, dyP: 0.75, ra: 2.0, dra: 0.5, flat: 1.9,
  Rt: 3.0, dRt: 0.35, apex: 4.9, dApex: 0.35, apexT: 5.5, bandDrop: 0.45, loose: true, oldScale: 0.62,
};
export const TIGHT = {
  K: V(0, -0.55, -1.75), gf: 0.47, gb: 0.42, dyP: 0.0, ra: 0.85, dra: 0.2, flat: 1.35,
  Rt: 2.1, dRt: 0.14, apex: 1.6, dApex: 0.08, apexT: 2.6, bandDrop: 0.0,
};

const REGION_DIR = {
  L: V(-1, -0.2, 0).normalize(),
  R: V(1, -0.2, 0).normalize(),
  C: V(0, 1, 0),
};

function axisBetween(a, b) {
  const set = a + b;
  if (set === 'LR' || set === 'RL') return 'P'; // passive (narrow) blade
  if (set === 'LC' || set === 'CL') return 'SL'; // left neck strand
  return 'SR'; // right neck strand
}

function scaled(P, size, knot = {}) {
  // bigger knots are built at the same (loose) scale but finish wider
  if (P.loose) size = 1 + (size - 1) * 0.35;
  return { ...P, ra: P.ra * size, Rt: P.Rt * size, dRt: P.dRt * size, apex: P.apex * (0.85 + 0.15 * size), bandLean: knot.bandLean || 0 };
}

// Point on a neck strand at height y (straight line from the hub to the collar).
function strandAt(K, side, y) {
  const C = side < 0 ? CL : CR;
  const t = clamp((y - K.y) / (C.y - K.y), 0, 1);
  return K.clone().lerp(C, t);
}

// Going up "through the neck loop" means rising behind both strands and
// coming out through the opening between them. These two helpers give the
// point where the blade is still behind the strands, and the fold where it
// has come out in front.
function risePoint(K, P, sc, x) {
  const y = K.y + P.apex * 0.5 * sc;
  return { p: V(x, y, strandAt(K, -1, y).z - 0.6), n: V(0, 0.25, -1) };
}
function apexPoint(K, P, sc, x, extraY = 0, extraZ = 0) {
  const y = K.y + P.apex * sc + extraY;
  return { p: V(x, y, strandAt(K, -1, y).z + 0.9 + extraZ), n: V(0, 1, 0.1) };
}

/**
 * Build the active-blade waypoints for the first `k` moves of `moves`.
 * Returns the waypoints after the right neck strand plus anchors used for
 * tails and motion arrows.
 */
function knotWaypoints(moves, k, P) {
  const K = P.K;
  const strandL = CL.clone().sub(K).normalize();
  const strandR = CR.clone().sub(K).normalize();
  const wps = [];
  const passes = [];
  let region = 'R';
  let maxF = K.z, minB = K.z; // depth envelopes of the knot so far
  const count = { P: 0, SL: 0, SR: 0, L: 0, R: 0, C: 0 };
  let tInfo = null;
  let lastSc = 1;
  // The last pass across the front before the final tuck becomes the front
  // band. Leave room behind it for the tuck (T) to slide through.
  let bandIdx = -1;
  {
    let r = 'R';
    moves.forEach((mv, j) => {
      if (mv === 'T') return;
      if (mv[1] === 'i' && axisBetween(r, mv[0]) === 'P' && moves.includes('T')) bandIdx = j;
      r = mv[0];
    });
  }

  for (let i = 0; i < k; i++) {
    const m = moves[i];
    // While tying, earlier wraps get snugged down as later ones go on, so
    // older passes sit closer to the hub and the newest one stays open.
    const sc = P.loose ? lerp(P.oldScale, 1, Math.pow(0.45, k - 1 - i)) : 1;
    lastSc = sc;
    if (m === 'T') {
      // Up out of the neck loop, over the top, and down through the front
      // band (the last pass across the front).
      const band = [...passes].reverse().find((q) => q.side > 0 && q.axis === 'P');
      const prevFrontZ = passes.filter((q) => q.side > 0 && q !== band).reduce((a, q) => Math.max(a, q.p.z), K.z);
      const zT = (band.p.z + prevFrontZ) / 2;
      const last = passes[passes.length - 1];
      wps.push(risePoint(K, P, sc, last.p.x * 0.3));
      const apex = apexPoint(K, P, sc, 0, (P.apexT - P.apex) * sc);
      // snug knot: the blade rolls over the top instead of folding back flat
      if (!P.loose) apex.p.z = Math.max(apex.p.z, zT - 0.55);
      wps.push(apex);
      wps.push({ p: V(0, band.p.y + 1.3 + P.bandDrop, Math.max(zT + 0.1, apex.p.z + 0.4)), n: V(0, 0.2, 1) });
      wps.push({ p: V(0, band.p.y - 1.3, zT - 0.02), n: V(0, 0, 1) });
      wps.push({ p: V(0, band.p.y - 3.3, zT - 0.1), n: V(0, -0.05, 1) });
      tInfo = { zT, band, apex: apex.p.clone() };
      region = 'T';
      continue;
    }
    const to = m[0];
    const side = m[1] === 'i' ? 1 : -1; // i = over the front, o = underneath
    const axis = axisBetween(region, to);

    // crossing point on the axis being wrapped
    let X;
    if (axis === 'P') {
      X = V(0, K.y - P.dyP * count.P - (count.P > 0 ? P.bandDrop : 0), K.z);
    } else {
      const u = axis === 'SL' ? strandL : strandR;
      X = K.clone().addScaledVector(u, (P.ra + P.dra * count[axis]) * sc);
    }
    if (side > 0) { X.z = Math.max(X.z, maxF) + P.gf * (i === bandIdx ? 1.9 : 1); maxF = X.z; }
    else { X.z = Math.min(X.z, minB) - P.gb; minB = X.z; }
    // passes across the narrow blade lie flat over the face of the knot
    const flat = axis === 'P' && i > 0 ? Math.min(P.flat, P.Rt * sc * 0.55) * (region === 'R' ? 1 : -1) : 0;

    // how the blade gets from the previous crossing to this one
    if (i === 0) {
      // first crossing: straight down off the right strand
      wps.push({ p: CR.clone().lerp(X, 0.55).add(V(0.15, 0, 0.25)), n: V(0.05, 0.25, 1) });
    } else {
      const prev = passes[passes.length - 1];
      if (region === 'C') {
        const x = (prev.p.x + X.x) * 0.3;
        const dy = P.dApex * count.C * sc;
        if (prev.side < 0) {
          // came up behind the strands: out through the loop, fold over, down the front
          wps.push(risePoint(K, P, sc, prev.p.x * 0.4));
          wps.push(apexPoint(K, P, sc, x, dy));
        } else {
          // came up over the front: fold over the top and dive down behind the strands
          wps.push(apexPoint(K, P, sc, x, dy, Math.max(0, prev.p.z - K.z) * 0.4));
          wps.push(risePoint(K, P, sc, X.x * 0.4));
        }
      } else {
        const dir = REGION_DIR[region];
        const R = (P.Rt + P.dRt * count[region]) * sc;
        const y0 = (prev.p.y + X.y) / 2;
        // (a flat pass folds round the edge of the knot rather than looping wide)
        const y = P.loose ? lerp(K.y, y0, 0.6) + dir.y * R * 0.5 : y0;
        const p = V(dir.x * R, y, (prev.p.z + X.z) / 2);
        // when snug, tilt the folds so the knot tapers towards the bottom like a real one
        wps.push({ p, n: V(dir.x, P.loose ? dir.y * 0.5 : -0.3, 0) });
      }
      count[region]++;
    }

    const lean = i === bandIdx ? (P.bandLean || 0) * Math.sign(flat) : 0;
    if (flat) wps.push({ p: V(flat, X.y + lean, X.z), n: V(0, 0, side) });
    wps.push({ p: X, n: V(0, 0, side) });
    if (flat) wps.push({ p: V(-flat, X.y - lean, X.z), n: V(0, 0, side) });
    passes.push({ move: m, from: region, to, axis, side, p: X.clone(), flat });
    count[axis]++;
    region = to;
  }
  return { wps, passes, region, count, tInfo, strandL, strandR, sc: lastSc };
}

/** Where the free end leaves the knot when the state is displayed. */
function exitAndTail(state, P, knotSide) {
  const { passes, region, count, sc } = state;
  const K = P.K;
  const last = passes[passes.length - 1];
  if (region === 'T') {
    return { exit: [], tail: { d0: V(0, -1, 0.05), sign: 1, mode: 'hang', xTarget: 0, clear: P.loose ? 1.05 : 1.2, radius: 6 } };
  }
  if (region === 'C') {
    const dy = P.dApex * count.C * sc;
    const tail = { d0: V(0, 1, 0.45), sign: last.side, mode: 'up', lean: 0.32, clear: 0.6 };
    if (last.side < 0) {
      // up behind the strands and out through the loop, seam side towards you
      const apex = apexPoint(K, P, sc, 0, dy);
      apex.n = V(0, 0.15, -1);
      return { exit: [risePoint(K, P, sc, last.p.x * 0.4), apex], tail };
    }
    const apex = apexPoint(K, P, sc, last.p.x * 0.3, dy, Math.max(0, last.p.z - K.z) * 0.4);
    apex.n = V(0, 0.15, 1);
    return { exit: [apex], tail };
  }
  const dir = REGION_DIR[region];
  const R = P.Rt + P.dRt * count[region];
  const first = passes.length === 1;
  const y = first ? K.y - 2.4 : K.y + dir.y * R * 0.5 + (last.p.y - K.y) * 0.5;
  const exit = [{ p: V(dir.x * R * (first ? 0.8 : 1), y, last.p.z * 0.7 + K.z * 0.3), n: V(dir.x * 0.25, 0, last.side) }];
  return { exit, tail: { d0: V(dir.x, first ? -1.1 : -0.55, 0), sign: last.side, mode: 'hang', xTarget: dir.x * (R + 5.5), clear: 0.75 } };
}

// ---------------------------------------------------------------------------
// Pose assembly

function assemble(narrowLen, narrowStart, core, wideTailOpt, coreCup) {
  // 1. core polyline (narrow start -> ... -> last knot waypoint)
  const dc = densify(core);
  // length of core from its start up to the left collar exit CL (part of the narrow side)
  let iCL = 0, best = Infinity;
  for (let i = 0; i < dc.pts.length; i++) {
    const d = dc.pts[i].distanceTo(CL);
    if (d < best) { best = d; iCL = i; }
  }
  const coreToCL = polyLength(dc.pts.slice(0, iCL + 1));
  // 2. narrow tail (generated downwards from the start, then reversed)
  const nLen = Math.max(4, narrowLen - coreToCL);
  const nt = genTail(narrowStart.p, narrowStart.d0, 1, nLen, narrowStart.opt);
  const nPts = nt.pts.reverse(), nN = nt.nrm.reverse();
  // 3. wide tail with whatever length remains
  const coreLen = polyLength(dc.pts);
  const wLen = Math.max(2, TIE_LENGTH - nLen - coreLen);
  const lastP = dc.pts[dc.pts.length - 1];
  const wt = genTail(lastP, wideTailOpt.d0, wideTailOpt.sign, wLen, wideTailOpt);
  const pts = [...nPts, ...dc.pts, ...wt.pts];
  const nrm = [...nN, ...dc.nrm, ...wt.nrm];
  const cup = [...nPts.map(() => 0), ...dc.cup, ...wt.pts.map(() => 0)];
  return resample(pts, nrm, cup, coreCup);
}

function resample(pts, nrm, cup, coreCup) {
  const n = pts.length;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + pts[i].distanceTo(pts[i - 1]);
  const total = cum[n - 1];
  const P = new Float32Array(SAMPLES * 3), N = new Float32Array(SAMPLES * 3), C = new Float32Array(SAMPLES);
  let j = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const s = (i / (SAMPLES - 1)) * total;
    while (j < n - 2 && cum[j + 1] < s) j++;
    const t = clamp((s - cum[j]) / Math.max(cum[j + 1] - cum[j], 1e-9), 0, 1);
    const p = pts[j].clone().lerp(pts[j + 1], t);
    const q = nrm[j].clone().lerp(nrm[j + 1], t).normalize();
    P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
    N[i * 3] = q.x; N[i * 3 + 1] = q.y; N[i * 3 + 2] = q.z;
    C[i] = lerp(cup[j], cup[j + 1], t);
  }
  if (coreCup) coreCup(C, P);
  // anchor: the sample at the back of the neck, which never moves between steps
  const back = loopPoint(-Math.PI);
  let anchor = 0, best = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const d = Math.hypot(P[i * 3] - back.x, P[i * 3 + 1] - back.y, P[i * 3 + 2] - back.z);
    if (d < best) { best = d; anchor = i; }
  }
  return { P, N, C, length: total, anchor };
}

/**
 * Pose for one displayed state of a knot.
 * @param knot   knot definition (moves, size, narrowLen)
 * @param state  { kind: 'drape' } | { kind: 'moves', k } | { kind: 'tight' } | { kind: 'finish' }
 */
export function buildPose(knot, state, narrowLen = knot.narrowLen) {
  if (state.kind === 'drape') {
    const loop = neckLoop();
    const core = [
      ...loop,
      { p: CR.clone().add(V(0.25, -2.2, 0.35)), n: V(0.25, 0, 1) },
    ];
    // the narrow side hangs from the left exit; the core starts there
    const narrowStart = { p: CL.clone(), d0: V(-0.12, -1, 0.15), opt: { mode: 'hang', xTarget: CL.x - 1.2, clear: 0.42, radius: 3 } };
    const pose = assemble(narrowLen, narrowStart, core,
      { d0: V(0.1, -1, 0.15), sign: 1, mode: 'hang', xTarget: CR.x + 1.4, clear: 0.42, radius: 3 });
    pose.pinch = [0, -4, 0];
    return pose;
  }

  const tight = state.kind === 'tight' || state.kind === 'finish';
  const P = scaled(tight ? TIGHT : LOOSE, knot.size, knot);
  const k = tight ? knot.moves.length : state.k;
  const st = knotWaypoints(knot.moves, k, P);
  const { exit, tail } = exitAndTail(st, P, knot.flop?.[k] ?? 1);
  const K = P.K;

  // narrow blade: from just below the knot, up the left strand to the collar
  const below = V(0, K.y - (tight ? 1.6 : 2.6), K.z - (tight ? 0.35 : 0.15));
  const narrowSide = [
    { p: below, n: V(0, 0, 1) },
    { p: K.clone(), n: V(0, 0, 1) },
    { p: K.clone().lerp(CL, 0.5).add(V(-0.1, 0, tight ? 0 : -0.35)), n: V(-0.1, 0.1, 1) },
  ];
  const loop = neckLoop();
  const rightStrand = [];
  const core = [...narrowSide, ...loop, ...rightStrand, ...st.wps, ...exit];

  const narrowStart = { p: below, d0: V(0, -1, -0.3), opt: { mode: 'hang', xTarget: 0, clear: 0.4, radius: 4 } };
  let coreCup = null;
  if (state.kind === 'finish') {
    // the dimple: a soft crease in the wide blade just below the knot
    const yKnotBottom = K.y - 3.2;
    coreCup = (C, Parr) => {
      for (let i = Math.floor(SAMPLES * 0.6); i < SAMPLES; i++) {
        const y = Parr[i * 3 + 1];
        const d = yKnotBottom - y;
        if (d > -0.5 && d < 7.5) C[i] = 0.55 * Math.sin(clamp((d + 0.5) / 8, 0, 1) * Math.PI) * smooth((d + 0.5) / 1.2);
      }
    };
  }
  const pose = assemble(narrowLen, narrowStart, core, tail, coreCup);
  pose.meta = { st, P, k };
  // A snug knot is pulled into a tapered shape (wide under the collar, narrow
  // where the blade comes out). The renderer applies this as a gentle pinch.
  pose.pinch = tight ? [K.y + 2.4, K.y - 2.1, knot.pinch ?? 0.3] : [K.y + 2.4, K.y - 2.1, 0];
  return pose;
}

// ---------------------------------------------------------------------------
// Motion arrows: a short guide path showing how the wide end travels in a step.

export function arrowPath(knot, stepState) {
  if (stepState.kind === 'drape' || stepState.kind === 'finish') return null;
  if (stepState.kind === 'tight') {
    const L = scaled(LOOSE, knot.size).K, T = scaled(TIGHT, knot.size).K;
    return [V(4.6, L.y - 2.5, 3.2), V(4.9, (L.y + T.y) / 2, 3.0), V(4.6, T.y - 0.5, 2.4)];
  }
  const P = scaled(LOOSE, knot.size);
  const K = P.K;
  const k = stepState.k;
  const st = knotWaypoints(knot.moves, k, P);
  const m = knot.moves[k - 1];
  const anchor = (region, z, extra = 0) => {
    if (region === 'C') return V(0, K.y + P.apex + 3.4 + extra, z);
    const d = REGION_DIR[region];
    return V(d.x * (P.Rt + 3.2 + extra), K.y - 1.8, z);
  };
  if (m === 'T') {
    const { zT, band } = st.tInfo;
    return [
      V(0.2, K.y + P.apexT + 3.4, zT + 1.6),
      V(0, K.y + P.apexT + 0.9, zT + 1.5),
      V(0, band.p.y + 0.6, zT + 0.05),
      V(0, band.p.y - 4.2, zT + 0.6),
      V(0, band.p.y - 8.0, zT + 1.3),
    ];
  }
  const pass = st.passes[st.passes.length - 1];
  const from = pass.from, to = pass.to;
  const zOut = pass.side > 0 ? pass.p.z + 1.3 : pass.p.z - 0.35;
  const start = k === 1 ? V(CR.x + 3.2, K.y - 5, 2.2) : anchor(from, (st.passes[st.passes.length - 2]?.p.z ?? K.z) + 0.8);
  const mid = pass.p.clone(); mid.z = zOut;
  const end = anchor(to, zOut * 0.5 + (pass.side > 0 ? 0.9 : 0.4), 1.5);
  if (to === 'C' || from === 'C') {
    const lift = V((start.x + end.x) * 0.25, (start.y + end.y) / 2 + 1.2, zOut);
    return [start, lift.lerp(mid, 0.6), end];
  }
  return [start, mid, end];
}

// ---------------------------------------------------------------------------
// Length planning: choose where the narrow end starts so that the finished
// tip lands on the belt buckle.

export function wideTipY(pose) {
  const i = SAMPLES - 1;
  return pose.P[i * 3 + 1];
}
export function narrowTipY(pose) { return pose.P[1]; }

export function solveNarrowLength(knot, targetY) {
  let lo = 8, hi = 75;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    const y = wideTipY(buildPose(knot, { kind: 'finish' }, mid));
    // a longer narrow side leaves less for the wide blade -> tip sits higher
    if (y < targetY) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
