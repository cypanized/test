// The knot map: a top-down "where does the wide end go" diagram.
//
// The wide end only ever moves between three regions around the knot:
// your Left, your Right, and the Centre (up into the neck loop). Each move
// wraps it round one of the three things between those regions: the narrow
// blade (between L and R) or one side of the neck loop. Over the front is
// drawn solid, underneath is dashed, and T is the final tuck.

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

const DEG = Math.PI / 180;
// region and axis angles (maths convention, y up)
const REGION = { L: 205, C: 90, R: 335 };
const AXIS = { SL: 113, SR: 67, P: 270 };

function sweep(from, to) {
  // angles (deg) going the short way round through the axis between regions
  let a = REGION[from], b = REGION[to];
  if (from === 'R' && to === 'C') b = 450; // 335 -> 450 (through 67)
  if (from === 'C' && to === 'R') b = -25; // 90 -> -25
  if (from === 'L' && to === 'R') { a = 205; b = 335; }
  if (from === 'R' && to === 'L') { a = 335; b = 205; }
  return [a, b];
}

function polar(r, deg, flip) {
  return [flip * r * Math.cos(deg * DEG), -r * Math.sin(deg * DEG)];
}

export class KnotMap {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', '-120 -116 240 228');
    this.flip = 1;
  }

  render(knot, stepIndex, mirror = true) {
    const svg = this.svg;
    this.flip = mirror ? 1 : -1;
    const f = this.flip;
    svg.replaceChildren();
    const defs = el('defs', {}, svg);
    const glow = el('filter', { id: 'km-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '2.4', result: 'b' }, glow);
    const merge = el('feMerge', {}, glow);
    el('feMergeNode', { in: 'b' }, merge);
    el('feMergeNode', { in: 'SourceGraphic' }, merge);
    for (const [id, color] of [['km-head', '#e9e1d2'], ['km-head-now', '#f3c46b'], ['km-head-dim', 'rgba(233,225,210,.25)']]) {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
    }

    // the tie itself: the two sides of the neck loop and the narrow blade
    const tie = el('g', { class: 'km-tie' }, svg);
    const [lx, ly] = polar(98, AXIS.SL, f), [rx, ry] = polar(98, AXIS.SR, f);
    el('path', { d: `M${lx},${ly} L0,0 L${rx},${ry}`, class: 'km-loop' }, tie);
    el('path', { d: 'M0,0 L0,104', class: 'km-narrow' }, tie);
    el('circle', { cx: 0, cy: 0, r: 5, class: 'km-hub' }, tie);
    // collar hint
    el('path', { d: `M${lx * 1.05},${ly * 1.02} Q0,${ly * 0.78} ${rx * 1.05},${ry * 1.02}`, class: 'km-collar' }, tie);

    // region labels
    const labels = el('g', { class: 'km-labels' }, svg);
    for (const [k, name] of [['L', 'Left'], ['C', 'Centre'], ['R', 'Right']]) {
      const [x, y] = polar(k === 'C' ? 100 : 92, REGION[k], f);
      const t = el('text', { x, y: y + (k === 'C' ? 2 : 30), 'text-anchor': 'middle', class: 'km-region' }, labels);
      t.textContent = k;
      const s = el('text', { x, y: y + (k === 'C' ? 11 : 41), 'text-anchor': 'middle', class: 'km-region-sub' }, labels);
      s.textContent = name;
    }

    // moves
    const moves = knot.moves;
    const doneCount = Math.max(0, Math.min(moves.length, stepIndex)); // moves completed at this step
    const allDone = stepIndex > moves.length;
    const paths = el('g', { class: 'km-moves' }, svg);
    let region = 'R';
    let startDot = polar(70, REGION.R, f);
    el('circle', { cx: startDot[0], cy: startDot[1] + 26, r: 3.5, class: 'km-start' }, paths);
    moves.forEach((m, i) => {
      const state = i < doneCount - 1 || (allDone && i < doneCount) ? 'done' : i === doneCount - 1 ? 'now' : 'todo';
      const r0 = 26 + i * 6.2, r1 = r0 + 6.2;
      let d;
      let labelAt;
      if (m === 'T') {
        // up and over the top, then straight down through the front band
        const [ax, ay] = polar(r0, 90, f);
        d = `M${ax},${ay} C${ax + 14 * f},${ay - 18} ${18 * f},${-6} ${3 * f},10 L${3 * f},62`;
        labelAt = [16 * f, 50];
      } else {
        const to = m[0];
        const [a, b] = sweep(region, to);
        const pts = [];
        const n = 28;
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const ang = a + (b - a) * t;
          const rr = r0 + (r1 - r0) * t;
          pts.push(polar(rr, ang, f));
        }
        d = 'M' + pts.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' L');
        const mid = pts[Math.round(n * 0.5)];
        labelAt = [mid[0] * 1.0, mid[1] * 1.0];
        region = to;
      }
      const under = m[1] === 'o';
      const path = el('path', {
        d,
        class: `km-move km-${state}${under ? ' km-under' : ''}`,
        'marker-end': `url(#${state === 'now' ? 'km-head-now' : state === 'done' ? 'km-head' : 'km-head-dim'})`,
      }, paths);
      if (state === 'now') {
        path.setAttribute('filter', 'url(#km-glow)');
        const len = path.getTotalLength ? path.getTotalLength() : 200;
        path.style.setProperty('--len', len);
        path.classList.add('km-draw');
      }
      // numbered badge
      if (state !== 'todo') {
        const g = el('g', { class: `km-badge km-badge-${state}`, transform: `translate(${labelAt[0]},${labelAt[1]})` }, paths);
        el('circle', { r: 7.5 }, g);
        const t = el('text', { y: 3, 'text-anchor': 'middle' }, g);
        t.textContent = String(i + 1);
      }
    });
  }
}
