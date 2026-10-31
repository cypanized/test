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
import { BakedKnot, midPrediction } from '../src/sim/player.js';

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

// Quantise to 0.2 mm, predict, and store the small residuals as zig-zag
// varints, then gzip. Columns 0, 2 and 4 are predicted from the two previous
// frames (constant velocity). Columns 1 and 3 are predicted from their
// neighbours in the same frame (a smooth curve across the tie), and their
// residuals from the previous frame's. Decoding (player.js) is exact.
function encode(chapters) {
  const Q = 50; // units per cm
  const S = STORED_COLS, ns = S.length, nm = ns - 1;
  const parts = [];
  const index = [];
  let offset = 0;
  for (const full of chapters) {
    const bytes = [];
    const put = (d) => {
      let z = ((d << 1) ^ (d >> 31)) >>> 0;
      while (z >= 0x80) { bytes.push((z & 0x7f) | 0x80); z >>>= 7; }
      bytes.push(z);
    };
    const n = ROWS * ns * 3, m = ROWS * nm * 3;
    const p1 = new Int32Array(n), p2 = new Int32Array(n), r1 = new Int32Array(m);
    const st = new Int32Array(n);
    full.forEach((fr, f) => {
      for (let i = 0; i < ROWS; i++) for (let c = 0; c < ns; c++) for (let k = 0; k < 3; k++) {
        const a = (i * ns + c) * 3 + k;
        const v = Math.round(fr[(i * COLS + S[c]) * 3 + k] * Q);
        const pred = f === 0 ? 0 : f === 1 ? p1[a] : 2 * p1[a] - p2[a];
        put(v - pred);
        p2[a] = p1[a]; p1[a] = v; st[a] = v;
      }
      for (let i = 0; i < ROWS; i++) for (let c = 0; c < nm; c++) for (let k = 0; k < 3; k++) {
        const a = (i * nm + c) * 3 + k;
        const v = Math.round(fr[(i * COLS + (S[c] + S[c + 1]) / 2) * 3 + k] * Q);
        const r = v - midPrediction(st, i, c, k, ns);
        put(r - r1[a]);
        r1[a] = r;
      }
    });
    const raw = Uint8Array.from(bytes);
    parts.push(raw);
    index.push({ frames: full.length, offset, length: raw.length });
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
    const meta = { knot: knot.id, rows: ROWS, cols: COLS, storedCols: STORED_COLS, midResiduals: true, fps: FPS / REC_EVERY, Q, narrowLen, chapters: index, routes, grips, report };
    // check exactly what ships: decode it the way the browser does and test every frame
    if (!fast) {
      const shipped = new BakedKnot(meta, data.toString('base64'));
      // every frame, and the halfway blend between neighbouring frames that
      // the player shows when the display rate is higher than the bake's
      let bad = 0, frames = 0, badBlend = 0;
      const noBlend = {};
      const mid = new Float32Array(shipped.n);
      for (let c = 0; c < shipped.chapterCount; c++) {
        const fs = shipped.chapter(c);
        fs.forEach((fr, f) => {
          frames++;
          if (debug) { let e = 0; const raw = chapters[c][f]; for (let k = 0; k < fr.length; k++) e = Math.max(e, Math.abs(fr[k] - raw[k])); if (e > 0.011) console.log(`  decode error chapter ${c} frame ${f}: ${e.toFixed(4)} cm`); }
          const h = findIntersections(verifier, fr, { limit: 3 });
          if (h.length) { bad++; if (bad < 4) console.log(`  shipped chapter ${c} frame ${f}: intersection`, JSON.stringify(h[0])); }
          if (f > 0) {
            // blends at 1/4, 1/2 and 3/4; if any touches, the player steps
            // from one frame to the next there instead of blending
            const pr = fs[f - 1];
            for (const a of [0.5, 0.25, 0.75]) {
              for (let k = 0; k < mid.length; k++) mid[k] = pr[k] + (fr[k] - pr[k]) * a;
              const hm = findIntersections(verifier, mid, { limit: 1 });
              if (hm.length) {
                badBlend++;
                (noBlend[c] ||= []).push(f - 1);
                if (badBlend < 4) console.log(`  shipped chapter ${c} between ${f - 1} and ${f} (at ${a}): intersection, will step`, JSON.stringify(hm[0]));
                break;
              }
            }
          }
        });
      }
      meta.verified = { frames, framesWithIntersections: bad, blendsChecked: frames - shipped.chapterCount, steppedBlends: badBlend };
      meta.noBlend = noBlend;
      console.log(`${knot.id}: verified ${frames} shipped frames, ${bad} with intersections; ${badBlend} frame pairs step instead of blending`);
    }
    writeFileSync(`${outDir}/${knot.id}.js`,
      `// Generated by tools/bake.mjs. Do not edit.\nexport const meta = ${JSON.stringify(meta)};\nexport const data = "${data.toString('base64')}";\n`);
    console.log(`wrote ${outDir}/${knot.id}.js (${(data.length / 1024).toFixed(0)} KB gzip)`);
  }
}
console.log(JSON.stringify(summary, null, 1));
