// Choreography: how each knot gets tied.
//
// A move is drawn out the way a hand feeds the wide blade round the knot:
// the next step's knot shape grows from the knot outwards along its own
// path (in front of the narrow blade, behind it, up through the neck loop,
// down through the front band), and the free end trails behind the leading
// point under gravity. Every in-between shape is a valid, non-overlapping
// configuration of the tie, so the cloth is never asked to go through
// itself, and the cloth solver guarantees it doesn't.
//
// After a move the knot is drawn snugly into the step's designed shape
// while the free end settles on its own.

import { Vector3, CatmullRomCurve3 } from 'three';
import { buildPose, SAMPLES, TIE_LENGTH } from '../engine/tie-engine.js';
import { ROWS, COLS, poseTargets } from './cloth.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const PULL = { knot: 0.1, lead: 0.02, free: 0.0008, narrow: 0.0015, hand: 0.3, held: 0.25, follow: 0.04 };

export function rowOf(s) { return clamp(Math.round((s / TIE_LENGTH) * (ROWS - 1)), 0, ROWS - 1); }

/**
 * Build the list of chapters for a knot. Chapter k takes the tie from the
 * settled state of step k-1 to the settled state of step k.
 */
export function planKnot(knot, statesFor, rowW) {
  const states = statesFor(knot);
  const poses = states.map((s) => buildPose(knot, s));
  const targets = poses.map((p) => poseTargets(p.P, p.N, SAMPLES, rowW, new Float32Array(ROWS * COLS * 3)));
  const chapters = [];
  for (let k = 1; k < states.length; k++) {
    const A = poses[k - 1], B = poses[k], st = states[k];
    // the front band the tuck goes under: the wrap made two moves before it
    const band = k >= 3 ? [poses[k - 3].roles.coreEnd, poses[k - 2].roles.coreEnd] : null;
    if (st.kind === 'moves') chapters.push(moveChapter(knot, st, A, B, targets[k - 1], targets[k], band));
    else if (st.kind === 'tight') {
      // the knot is slid up and snugged through a series of part-tightened
      // knots, so the fabric slides through it a little at a time
      const N = 12, mid = [];
      for (let i = 1; i < N; i++) {
        const pose = buildPose(knot, { kind: 'tight', w: i / N });
        mid.push({ roles: pose.roles, T: poseTargets(pose.P, pose.N, SAMPLES, rowW, new Float32Array(ROWS * COLS * 3)) });
      }
      chapters.push(slideChapter([{ roles: A.roles, T: targets[k - 1] }, ...mid, { roles: B.roles, T: targets[k] }]));
    }
    else chapters.push(holdChapter(B, targets[k]));
  }
  return { states, poses, targets, chapters };
}

// Material position -> point / silk normal on a pose's centre-line.
function along(pose, sMat) {
  const P = pose.P, n = SAMPLES;
  const f = clamp(sMat / TIE_LENGTH, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(f)), a = f - i;
  return new Vector3(P[i * 3] + (P[i * 3 + 3] - P[i * 3]) * a, P[i * 3 + 1] + (P[i * 3 + 4] - P[i * 3 + 1]) * a, P[i * 3 + 2] + (P[i * 3 + 5] - P[i * 3 + 2]) * a);
}
function normalAt(pose, sMat) {
  const N = pose.N, n = SAMPLES, i = Math.round(clamp(sMat / TIE_LENGTH, 0, 1) * (n - 1));
  return new Vector3(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).normalize();
}

/**
 * One move, tip first, the way it's really done: a hand picks up the end of
 * the wide blade, brings it to the knot and feeds it along the exact path
 * the blade will take (over the front, behind the narrow blade, up through
 * the neck loop, down through the band), then on down to where it will
 * hang. The rest of the blade trails behind the tip like a rope. Meanwhile
 * the other hand holds the knot (the previous step's shape), easing it
 * forward when the blade has to pass behind it. Then the hand lets go and
 * the knot is drawn snug into this step's shape.
 */
function moveChapter(knot, st, A, B, TA, TB, band) {
  const move = knot.moves[st.k - 1];
  const front = move === 'T' || move[1] === 'i';
  const held = B.roles.free === 'up';
  const K = B.meta.P.K;
  const s0 = A.roles.coreEnd, s1 = B.roles.coreEnd, L = TIE_LENGTH;
  const gripS = L - 3.2, g0 = rowOf(L - 5.5), g1 = rowOf(L - 1.2);
  // the tip's path: B's new wrap (held a little off it on the side it
  // passes), then B's free end down to where the tip will hang
  const path = [], norms = [];
  // the wrap is followed a little to the side it passes: over the front, in
  // front of the route; behind, nearer the shirt; the tuck, a little
  // forward, into the gap the knot hand holds open under the front band
  const tuck = move === 'T';
  const off = new Vector3(0, 0, tuck ? 0.5 : front ? 1.3 : -0.6);
  for (let sm = s0 + 1.5; sm < s1; sm += 1.6) {
    const n = normalAt(B, sm);
    path.push(along(B, sm).add(off)); norms.push(n);
  }
  for (let sm = s1; sm < L - 3.2; sm += 5) {
    const n = normalAt(B, sm);
    path.push(along(B, sm).addScaledVector(n, 0.9)); norms.push(n);
  }
  path.push(along(B, L - 3.2).addScaledVector(normalAt(B, L - 3.2), 0.9)); norms.push(normalAt(B, L - 3.2));
  // guide arrow: just the new wrap, slightly lifted
  const routePoints = [];
  for (let i = 0; i <= 24; i++) {
    const sm = s0 + (s1 + 4 - s0) * (i / 24);
    routePoints.push(along(B, sm).addScaledVector(normalAt(B, sm), 0.9));
  }
  const tidyT = 1.6, restT = 1.4;
  const SPEED = 40; // cm/s, the hand's top speed along its path
  let curve = null, total = 0, nAt = null;
  return {
    move, routePoints, duration: 0, done: false,
    start(cloth) {
      // where the tip is now, and a point to bring it to before feeding it in
      const x = cloth.x, q = (rowOf(gripS) * COLS + 2) * 3;
      const tipNow = new Vector3(x[q], x[q + 1], x[q + 2]);
      // the tip is brought to the start of the wrap at the wrap's own depth,
      // so it arrives on the correct side of everything: from beside the
      // knot for a pass in front of or behind it, from above for the tuck
      const entry = path[0].clone();
      const dir0 = path[1].clone().sub(path[0]).normalize();
      const approach = tuck ? entry.clone().add(new Vector3(0, 5, 0))
        : Math.abs(dir0.x) > 0.3 ? entry.clone().add(new Vector3(-5 * Math.sign(dir0.x), -1.5, front ? 1.5 : 0))
        : entry.clone().addScaledVector(dir0, -5);
      const pts = [tipNow, tipNow.clone().lerp(approach, 0.5).add(new Vector3(0, 0, 3)), approach, ...path];
      const nrm = [norms[0], norms[0], norms[0], ...norms];
      curve = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
      // normals along the curve, by arc length of the control points
      const lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
      total = curve.getLength();
      // arc length at the approach point (control point 2): the route proper
      const al = curve.getLengths(400);
      this.aStart = al[Math.round((2 / (pts.length - 1)) * 400)];
      const ctl = lens[lens.length - 1];
      nAt = (u) => {
        const d = u * ctl;
        let i = 0;
        while (i < lens.length - 2 && lens[i + 1] < d) i++;
        const a = clamp((d - lens[i]) / Math.max(1e-6, lens[i + 1] - lens[i]), 0, 1);
        return nrm[i].clone().lerp(nrm[i + 1], a);
      };
      this.gripStart = x.slice(g0 * COLS * 3, (g1 + 1) * COLS * 3);
      // first the blade is swung out to the side of the knot, clear of the
      // narrow blade, at the depth the wrap starts at: the stretch next to
      // the knot is moved by the offset from where it leaves the knot to
      // the approach point
      this.swing = tuck ? null : approach.clone().sub(along(A, s0 + 1));
      this.dist = 0; this.last = 0; this.driveEnd = null; this.done = false;
      this.duration = total / SPEED + tidyT + restT; // nominal; the hand waits for the cloth
    },
    apply(cloth, time) {
      const dt = time - this.last;
      this.last = time;
      if (this.driveEnd === null) {
        // The hand moves along its path only as fast as the cloth can follow
        // (the solver limits how far anything moves per step) and waits if
        // the tip falls behind, so the tip traces the path exactly instead
        // of cutting corners.
        const x = cloth.x, q = (rowOf(gripS) * COLS + 2) * 3;
        const hp = curve.getPointAt(this.dist / total);
        const lag = Math.hypot(x[q] - hp.x, x[q + 1] - hp.y, x[q + 2] - hp.z);
        const ramp = Math.min(1, time / 0.6) * Math.min(1, 0.25 + (total - this.dist) / 8);
        // (if it's held up for a while, it keeps going slowly: the cloth
        // finds its way round whatever is in the way)
        this.wait = lag < 1 ? 0 : (this.wait || 0) + dt;
        const go = lag < 1 ? 1 : this.wait > 0.6 ? 0.3 : 0;
        this.dist = Math.min(total, this.dist + SPEED * ramp * go * dt);
        const u = this.dist / total;
        // one hand holds the knot, easing it forward when the blade passes behind
        const ease1 = Math.sin(Math.PI * Math.min(1, u * 1.05));
        // (for the tuck: pressing the knot back against the chest while a
        // finger holds the front band open)
        const shift = tuck ? -0.8 * ease1 : front ? 0 : 2.4 * ease1;
        setRows(cloth, TA, A.roles, { free: true, shift, K, band: tuck && band ? [band[0], band[1], 3 * ease1] : null });
        // the other hand carries the tip
        holdTip(cloth, curve, u, nAt(u), g0, g1, gripS, this.gripStart, clamp(time / 0.4, 0, 1));
        if (this.swing) swingOut(cloth, TA, s0, this.swing, Math.min(1, time / 0.8) * (1 - clamp((u - 0.55) / 0.3, 0, 1)));
        // the rest of the blade follows the tip's route, like a rope pulled
        // through a tube: each part goes where the tip was when it was that
        // much fabric further back
        followRoute(cloth, curve, total, nAt, this.dist, this.aStart, gripS, s0, g0);
        this.hand = rowOf(gripS);
        if ((this.dist >= total && lag < 0.5) || time > 20) this.driveEnd = time;
        return;
      }
      const v = clamp((time - this.driveEnd) / tidyT, 0, 1);
      setRows(cloth, TB, B.roles, { ramp: v, held });
      // a step that holds the blade up: the hand keeps hold of the end until
      // the next move (let go, it would slide off the chest under the knot)
      if (held) holdTip(cloth, curve, 1, nAt(1), g0, g1, gripS, this.gripStart, 1);
      this.hand = held ? rowOf(gripS) : -1;
      if (time >= this.driveEnd + tidyT + restT) this.done = true;
    },
  };
}

/**
 * The stretch of blade just past the knot (12 cm from where it leaves it),
 * moved bodily by `off`, so it hangs beside the knot instead of over the
 * narrow blade. Strength k (0..1) fades it in and, once the tip is pulling
 * the blade round, out again.
 */
function swingOut(cloth, TA, s0, off, k) {
  if (k <= 0) return;
  const { t, pull, rowS } = cloth;
  for (let i = rowOf(s0 + 0.5); i <= rowOf(s0 + 12); i++) {
    const w = k * Math.min(1, (rowS[i] - s0) / 2);
    for (let j = 0; j < COLS; j++) {
      const p = i * COLS + j, q = p * 3;
      t[q] = TA[q] + off.x; t[q + 1] = TA[q + 1] + off.y; t[q + 2] = TA[q + 2] + off.z;
      pull[p] = Math.max(pull[p], PULL.lead * 2 * w);
    }
  }
}

/**
 * Rows between the knot and the hand get targets along the hand's route:
 * row s goes to arc length a = dist - (gripS - s), once that is past the
 * approach point. Lying flat, across the route like the held part.
 */
function followRoute(cloth, curve, total, nAt, dist, aStart, gripS, s0, g0) {
  const { t, pull, rowS, rowW } = cloth;
  const C = COLS;
  for (let i = g0 - 1; i >= rowOf(s0 + 1); i--) {
    const a = dist - (gripS - rowS[i]);
    if (a < aStart) break;
    const u = a / total;
    const pos = curve.getPointAt(u), dir = curve.getTangentAt(u), normal = nAt(u);
    const n = normal.addScaledVector(dir, -normal.dot(dir)).normalize();
    const across = new Vector3().crossVectors(n, dir).normalize();
    for (let j = 0; j < C; j++) {
      const o = (j / (C - 1) - 0.5) * rowW[i];
      const p = i * C + j, q = p * 3;
      t[q] = pos.x + across.x * o; t[q + 1] = pos.y + across.y * o; t[q + 2] = pos.z + across.z * o;
      pull[p] = Math.max(pull[p], PULL.follow);
    }
  }
}

/** A hand pinching the tip of the wide blade flat at curve parameter u. */
function holdTip(cloth, curve, u, normal, g0, g1, gripS, from, blend) {
  const { t, pull, rowS, rowW } = cloth;
  const C = COLS;
  const pos = curve.getPointAt(u);
  const dir = curve.getTangentAt(u);
  const n = normal.clone().addScaledVector(dir, -normal.dot(dir)).normalize();
  const across = new Vector3().crossVectors(n, dir).normalize();
  const b = ease(blend);
  for (let i = g0; i <= g1; i++) {
    const ds = rowS[i] - gripS;
    for (let j = 0; j < C; j++) {
      const o = (j / (C - 1) - 0.5) * rowW[i];
      const p = i * C + j, q = p * 3, r = ((i - g0) * C + j) * 3;
      const tx = pos.x + dir.x * ds + across.x * o, ty = pos.y + dir.y * ds + across.y * o, tz = pos.z + dir.z * ds + across.z * o;
      t[q] = from[r] + (tx - from[r]) * b; t[q + 1] = from[r + 1] + (ty - from[r + 1]) * b; t[q + 2] = from[r + 2] + (tz - from[r + 2]) * b;
      pull[p] = PULL.hand;
    }
  }
}

function slideChapter(stages) {
  const slideT = 7, restT = 1.6;
  const mix = new Float32Array(stages[0].T.length);
  const n = stages.length - 1;
  return {
    move: 'tighten',
    duration: slideT + restT,
    start() {},
    apply(cloth, time) {
      const f = ease(clamp(time / slideT, 0, 1)) * n;
      const i = Math.min(n - 1, Math.floor(f)), a = f - i;
      const S0 = stages[i], S1 = stages[i + 1];
      for (let q = 0; q < mix.length; q++) mix[q] = S0.T[q] + (S1.T[q] - S0.T[q]) * a;
      const roles = {
        narrowEnd: Math.min(S0.roles.narrowEnd, S1.roles.narrowEnd), loopStart: S1.roles.loopStart, loopEnd: S1.roles.loopEnd,
        coreEnd: Math.max(S0.roles.coreEnd, S1.roles.coreEnd),
      };
      setRows(cloth, mix, roles, {});
      this.hand = -1;
    },
  };
}

function holdChapter(B, TB) {
  return {
    move: 'finish',
    duration: 0.8,
    start() {},
    apply(cloth) { setRows(cloth, TB, B.roles, {}); this.hand = -1; },
  };
}

/** Targets and pulls for every row from a pose's targets and roles. */
export function setRows(cloth, T, roles, { ramp = 1, held = false, lead = false, free = false, shift = 0, K = null, band = null }) {
  const { t, pull, invMass, rowS } = cloth;
  const C = COLS;
  for (let i = 0; i < ROWS; i++) {
    const s = rowS[i];
    let k, pinned = false;
    if (s >= roles.loopStart + 1.5 && s <= roles.loopEnd - 1.5) { k = 1; pinned = true; }
    else if (s < roles.narrowEnd) k = roles.narrowEnd - s < 3 ? PULL.knot : PULL.narrow;
    else if (s <= roles.coreEnd) k = PULL.knot * (0.3 + 0.7 * ramp);
    else {
      const d = s - roles.coreEnd;
      if (free) k = 0; // carried by the hand at its tip; otherwise just physics
      else if (held && roles.hold != null && s <= roles.hold + 2) k = PULL.held; // the hand holding it up
      else if (d < 4) k = lead ? PULL.lead : PULL.lead * ramp; // just past the knot
      else k = PULL.free;
    }
    for (let j = 0; j < C; j++) {
      const p = i * C + j, q = p * 3;
      pull[p] = k;
      invMass[p] = pinned ? 0 : 1;
      t[q] = T[q]; t[q + 1] = T[q + 1]; t[q + 2] = T[q + 2];
      // the knot hand eases the knot forward to make room behind it
      const inBand = band && s > band[0] && s < band[1];
      if (shift && K && s <= roles.coreEnd && !pinned && !inBand) t[q + 2] += shift * Math.max(0, 1 - Math.abs(T[q + 1] - K.y) / 9);
      // ...or holds the front band open with a finger for the tuck
      if (inBand) {
        const w = Math.min(1, (s - band[0]) / 2, (band[1] - s) / 2);
        t[q + 2] += band[2] * w; pull[p] = Math.max(pull[p], PULL.hand);
      }
    }
  }
}
