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

const PULL = { knot: 0.1, lead: 0.02, free: 0.0008, narrow: 0.0015, hand: 0.15, held: 0.25 };

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
    if (st.kind === 'moves') chapters.push(moveChapter(knot, st, A, B, targets[k - 1], targets[k]));
    else if (st.kind === 'tight') chapters.push(slideChapter(A, B, targets[k - 1], targets[k]));
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
function moveChapter(knot, st, A, B, TA, TB) {
  const move = knot.moves[st.k - 1];
  const front = move === 'T' || move[1] === 'i';
  const held = B.roles.free === 'up';
  const K = B.meta.P.K;
  const s0 = A.roles.coreEnd, s1 = B.roles.coreEnd, L = TIE_LENGTH;
  const gripS = L - 3.2, g0 = rowOf(L - 5.5), g1 = rowOf(L - 1.2);
  // the tip's path: B's new wrap (held a little off it on the side it
  // passes), then B's free end down to where the tip will hang
  const path = [], norms = [];
  const off = front ? 1.3 : 0.25;
  for (let sm = s0 + 1.5; sm < s1; sm += 1.6) {
    const n = normalAt(B, sm);
    path.push(along(B, sm).addScaledVector(n, off)); norms.push(n);
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
  let curve = null, driveT = 0, nAt = null;
  return {
    move, routePoints, duration: 0,
    start(cloth) {
      // where the tip is now, and a point to bring it to before feeding it in
      const x = cloth.x, q = (rowOf(gripS) * COLS + 2) * 3;
      const tipNow = new Vector3(x[q], x[q + 1], x[q + 2]);
      const entry = path[0].clone();
      const approach = entry.clone().add(new Vector3(0, -3, front ? 5 : 3.5));
      const pts = [tipNow, tipNow.clone().lerp(approach, 0.5).add(new Vector3(0, 0, 3)), approach, ...path];
      const nrm = [norms[0], norms[0], norms[0], ...norms];
      curve = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
      // normals along the curve, by arc length of the control points
      const lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const total = lens[lens.length - 1];
      nAt = (u) => {
        const d = u * total;
        let i = 0;
        while (i < lens.length - 2 && lens[i + 1] < d) i++;
        const a = clamp((d - lens[i]) / Math.max(1e-6, lens[i + 1] - lens[i]), 0, 1);
        return nrm[i].clone().lerp(nrm[i + 1], a);
      };
      driveT = clamp(total / 30, 2.2, 4.5);
      this.duration = driveT + tidyT + restT;
      this.gripStart = x.slice(g0 * COLS * 3, (g1 + 1) * COLS * 3);
    },
    apply(cloth, time) {
      if (time <= driveT) {
        const u = clamp(time / driveT, 0, 1);
        // one hand holds the knot, easing it forward when the blade passes behind
        const shift = front ? 0 : 2.4 * Math.sin(Math.PI * Math.min(1, u * 1.05));
        setRows(cloth, TA, A.roles, { free: true, shift, K });
        // the other hand carries the tip
        holdTip(cloth, curve, ease(u), nAt(ease(u)), g0, g1, gripS, this.gripStart, clamp(time / 0.4, 0, 1));
        this.hand = rowOf(gripS);
        return;
      }
      const v = clamp((time - driveT) / tidyT, 0, 1);
      setRows(cloth, TB, B.roles, { ramp: v, held });
      this.hand = held ? rowOf(B.roles.hold) : -1;
    },
  };
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

function slideChapter(A, B, TA, TB) {
  const slideT = 2.6, restT = 1.6;
  const mix = new Float32Array(TA.length);
  return {
    move: 'tighten',
    duration: slideT + restT,
    start() {},
    apply(cloth, time) {
      const u = ease(clamp(time / slideT, 0, 1));
      for (let i = 0; i < mix.length; i++) mix[i] = TA[i] + (TB[i] - TA[i]) * u;
      const roles = {
        narrowEnd: Math.min(A.roles.narrowEnd, B.roles.narrowEnd), loopStart: B.roles.loopStart, loopEnd: B.roles.loopEnd,
        coreEnd: Math.max(A.roles.coreEnd, B.roles.coreEnd),
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
export function setRows(cloth, T, roles, { ramp = 1, held = false, lead = false, free = false, shift = 0, K = null }) {
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
      if (shift && K && s <= roles.coreEnd && !pinned) t[q + 2] += shift * Math.max(0, 1 - Math.abs(T[q + 1] - K.y) / 9);
    }
  }
}
