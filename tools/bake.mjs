// Bakes the tie-tying animations offline with the penetration-free cloth
// solver, verifies every frame, and writes compact playback data.
//
//   node tools/bake.mjs                 -> all knots, writes src/baked/*.js
//   node tools/bake.mjs four-in-hand    -> one knot
//   node tools/bake.mjs four-in-hand --dry   (no output, just the report)
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { solveNarrowLength, SAMPLES } from '../src/engine/tie-engine.js';
import { TIP_TARGET_Y } from '../src/engine/body.js';
import { KNOTS, statesFor } from '../src/knots.js';
import { TieCloth, ROWS, COLS } from '../src/sim/cloth.js';
import { planKnot, setRows } from '../src/sim/choreo.js';
import { findIntersections } from '../src/sim/verify.js';
import { BakedKnot } from '../src/sim/player.js';

const verifier = new TieCloth(); // only used for its mesh layout in findIntersections

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.filter((a) => !a.startsWith('--'));
const outDir = args.find((a) => a.startsWith('--out='))?.split('=')[1] || 'src/baked';
const maxCh = +(args.find((a) => a.startsWith('--chapters='))?.split('=')[1] || 99);
const fast = args.includes('--fast');
const debug = args.includes('--debug'); // verify raw frames as they are simulated // quick preview: fewer sub-steps, no per-frame verification
const FPS = 60, SUB = fast ? 4 : 8, REC_EVERY = 3; // simulate at 60 Hz x 8 sub-steps, record 20 fps
const STORED_COLS = [0, 2, 4]; // the middle columns are rebuilt on playback (see player.js)

function bakeKnot(knot) {
  knot.narrowLen = solveNarrowLength(knot, TIP_TARGET_Y);
  const cloth = new TieCloth();
  const plan = planKnot(knot, statesFor, cloth.rowW);
  // start: draped and settled
  setRows(cloth, plan.targets[0], plan.poses[0].roles, { upto: plan.poses[0].roles.coreEnd, freeAfter: false });
  cloth.place(plan.targets[0]);
  for (let f = 0; f < 90; f++) cloth.step(1 / FPS, SUB);
  const chapters = [[cloth.x.slice()]];
  const report = [];
  const routes = [null], grips = [null];
  plan.chapters.forEach((ch, ci) => {
    if (ci >= maxCh) return;
    const t0 = Date.now();
    ch.start(cloth);
    const frames = [];
    const nF = Math.ceil(ch.duration * FPS);
    let maxClamp = 0, hits = 0, firstHit = null;
    const hands = [];
    for (let f = 1; f <= nF; f++) {
      ch.apply(cloth, f / FPS);
      cloth.step(1 / FPS, SUB);
      maxClamp = Math.max(maxClamp, cloth.stats.clamped);
      if (f % REC_EVERY === 0 || f === nF) {
        const fr = cloth.x.slice();
        frames.push(fr);
        hands.push(ch.hand ?? -1);
        const h = (debug || f === nF) ? findIntersections(cloth, fr, { limit: 5 }) : [];
        if (h.length) { hits += h.length; if (!firstHit) firstHit = { frame: frames.length - 1, ...h[0] }; }
      }
    }
    // how close did the knot get to the step's designed shape?
    const B = plan.targets[ci + 1], roles = plan.poses[ci + 1].roles;
    let err = 0, errAt = 0;
    for (let i = 0; i < ROWS; i++) {
      const s = cloth.rowS[i];
      if (s < roles.narrowEnd || s > roles.coreEnd) continue;
      const q = (i * COLS + 2) * 3;
      const e = Math.hypot(cloth.x[q] - B[q], cloth.x[q + 1] - B[q + 1], cloth.x[q + 2] - B[q + 2]);
      if (e > err) { err = e; errAt = s; }
    }
    err = err.toFixed(2) + ' @s=' + errAt.toFixed(0) + ' (core ' + roles.narrowEnd.toFixed(0) + '..' + roles.coreEnd.toFixed(0) + ')';
    chapters.push(frames);
    grips.push(hands);
    routes.push(ch.routePoints ? ch.routePoints.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]) : null);
    report.push({ chapter: ci + 1, move: ch.move, frames: frames.length, secs: ((Date.now() - t0) / 1000).toFixed(1), knotErr: err, intersections: hits, firstHit, maxClamped: maxClamp });
    console.log(knot.id, JSON.stringify(report[report.length - 1]));
  });
  return { chapters, report, routes, grips, narrowLen: knot.narrowLen };
}

// Quantise to 0.02 mm steps... (0.002 cm), delta-encode frame to frame, gzip.
function encode(chapters) {
  const Q = 50; // units per cm (0.2 mm)
  const parts = [];
  const index = [];
  let offset = 0;
  for (const full of chapters) {
    const frames = full.map((fr) => {
      const o = new Float32Array(ROWS * STORED_COLS.length * 3);
      for (let i = 0; i < ROWS; i++) STORED_COLS.forEach((j, c) => {
        for (let k = 0; k < 3; k++) o[(i * STORED_COLS.length + c) * 3 + k] = fr[(i * COLS + j) * 3 + k];
      });
      return o;
    });
    const n = frames[0].length;
    // residual against a constant-velocity prediction from the two previous frames
    const buf = new Int32Array(frames.length * n);
    const p1 = new Int32Array(n), p2 = new Int32Array(n);
    frames.forEach((fr, f) => {
      for (let i = 0; i < n; i++) {
        const v = Math.round(fr[i] * Q);
        const pred = f === 0 ? 0 : f === 1 ? p1[i] : 2 * p1[i] - p2[i];
        buf[f * n + i] = v - pred;
        p2[i] = p1[i]; p1[i] = v;
      }
    });
    // zig-zag varint bytes
    const bytes = [];
    for (let i = 0; i < buf.length; i++) {
      let z = (buf[i] << 1) ^ (buf[i] >> 31);
      z >>>= 0;
      while (z >= 0x80) { bytes.push((z & 0x7f) | 0x80); z >>>= 7; }
      bytes.push(z);
    }
    const raw = Uint8Array.from(bytes);
    parts.push(raw);
    index.push({ frames: frames.length, offset, length: raw.length });
    offset += raw.length;
  }
  const all = new Uint8Array(offset);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return { data: gzipSync(all, { level: 9 }), index, Q };
}

const knots = KNOTS.filter((k) => !only.length || only.includes(k.id));
const summary = [];
for (const knot of knots) {
  const t0 = Date.now();
  const { chapters, report, routes, grips, narrowLen } = bakeKnot(knot);
  const totalHits = report.reduce((a, r) => a + r.intersections, 0);
  summary.push({ knot: knot.id, intersections: totalHits, minutes: ((Date.now() - t0) / 60000).toFixed(1) });
  if (!dry) {
    const { data, index, Q } = encode(chapters);
    mkdirSync(outDir, { recursive: true });
    const meta = { knot: knot.id, rows: ROWS, cols: COLS, storedCols: STORED_COLS, fps: FPS / REC_EVERY, Q, narrowLen, chapters: index, routes, grips, report };
    // check exactly what ships: decode it the way the browser does and test every frame
    if (!fast) {
      const shipped = new BakedKnot(meta, data.toString('base64'));
      let bad = 0, frames = 0;
      for (let c = 0; c < shipped.chapterCount; c++) {
        for (const fr of shipped.chapter(c)) {
          frames++;
          const h = findIntersections(verifier, fr, { limit: 3 });
          if (h.length) { bad++; if (bad < 4) console.log(`  shipped chapter ${c}: intersection`, JSON.stringify(h[0])); }
        }
      }
      meta.verified = { frames, framesWithIntersections: bad };
      console.log(`${knot.id}: verified ${frames} shipped frames, ${bad} with intersections`);
    }
    writeFileSync(`${outDir}/${knot.id}.js`,
      `// Generated by tools/bake.mjs. Do not edit.\nexport const meta = ${JSON.stringify(meta)};\nexport const data = "${data.toString('base64')}";\n`);
    console.log(`wrote ${outDir}/${knot.id}.js (${(data.length / 1024).toFixed(0)} KB gzip)`);
  }
}
console.log(JSON.stringify(summary, null, 1));
