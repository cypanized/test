// Builds the outlines the notebook intro draws on: every logo piece and every wordmark letter as
// closed polylines resampled by arc length, so a pen can trace them at an even speed.
//   NODE_PATH=/home/user/test/gz2h-kit/node_modules node tools/shapes.js   → assets/notebook-shapes.json
// Logo pieces stay in logo units (3220×1320 canvas). Wordmark letters are in "wordmark units":
// ink width 1000, baseline y = 0, y pointing down. The brand's looped "2" replaces the font's 2.
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const A = f => path.join(__dirname, '../assets', f);

function parseSvg(d) {
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g), cmds = [];
  let i = 0, cmd = null;
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { cmds.push({ type: 'M', x: num(), y: num() }); cmd = 'L'; }
    else if (cmd === 'L') cmds.push({ type: 'L', x: num(), y: num() });
    else if (cmd === 'C') cmds.push({ type: 'C', x1: num(), y1: num(), x2: num(), y2: num(), x: num(), y: num() });
    else if (cmd === 'Z') { cmds.push({ type: 'Z' }); cmd = null; }
  }
  return cmds;
}
function flatten(cmds) {
  const contours = []; let cur = null, px = 0, py = 0;
  for (const c of cmds) {
    if (c.type === 'M') { if (cur && cur.length > 2) contours.push(cur); cur = [[c.x, c.y]]; px = c.x; py = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); px = c.x; py = c.y; }
    else if (c.type === 'C' || c.type === 'Q') {
      for (let s = 1; s <= 24; s++) {
        const t = s / 24, u = 1 - t; let x, y;
        if (c.type === 'C') { x = u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x; y = u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y; }
        else { x = u * u * px + 2 * u * t * c.x1 + t * t * c.x; y = u * u * py + 2 * u * t * c.y1 + t * t * c.y; }
        cur.push([x, y]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') { if (cur && cur.length > 2) contours.push(cur); cur = null; }
  }
  if (cur && cur.length > 2) contours.push(cur);
  return contours;
}
// closed contour → points every `step` units (last point == first point)
function resampleClosed(c, step) {
  const pts = c.concat([c[0]]), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1], n = Math.max(8, Math.round(L / step)), out = [];
  let seg = 0;
  for (let j = 0; j <= n; j++) {
    const s = (j / n) * L;
    while (seg < pts.length - 2 && cum[seg + 1] < s) seg++;
    const a = pts[seg], b = pts[seg + 1], f = (s - cum[seg]) / ((cum[seg + 1] - cum[seg]) || 1);
    out.push(Math.round((a[0] + (b[0] - a[0]) * f) * 10) / 10, Math.round((a[1] + (b[1] - a[1]) * f) * 10) / 10);
  }
  return out;
}
const area = c => { let s = 0; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
// start each contour at its top-left-most point and run it clockwise on screen (y down), like a pen would
function orient(c) {
  if (area(c) < 0) c = c.slice().reverse();
  let k = 0, best = 1e9;
  c.forEach((p, i) => { const v = p[0] + p[1] * 0.6; if (v < best) { best = v; k = i; } });
  return c.slice(k).concat(c.slice(0, k));
}

// ── logo ──
const LOGO = JSON.parse(fs.readFileSync(A('logo-paths.json'), 'utf8'));
const logo = {};
for (const k of Object.keys(LOGO)) logo[k] = flatten(parseSvg(LOGO[k])).map(c => resampleClosed(orient(c), 5));

// ── wordmark ──
const font = opentype.parse(fs.readFileSync(A('SpaceGrotesk-700.ttf')).buffer.slice(0));
const TEXT = 'GuitarZero2Hero', INK_W = 1000;
const capH = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
const size = (INK_W / 11.27) / capH;
const glyphs = font.stringToGlyphs(TEXT), sc = size / font.unitsPerEm;
const adv = glyphs.map((g, i) => g.advanceWidth * sc + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * sc : 0));
const inkOf = ls => { const first = glyphs[0].getBoundingBox(), last = glyphs[glyphs.length - 1].getBoundingBox(); let x = 0; for (let i = 0; i < glyphs.length - 1; i++) x += adv[i] + ls; return x + last.x2 * sc - first.x1 * sc; };
const ls = (INK_W - inkOf(0)) / (glyphs.length - 1);
let x = -INK_W / 2 - glyphs[0].getBoundingBox().x1 * sc;
const TWO = flatten(parseSvg(JSON.parse(fs.readFileSync(A('wordmark-two.json'), 'utf8')).d));
const tb = TWO.flat(1).reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
const letters = [];
glyphs.forEach((g, i) => {
  const p = g.getPath(x, 0, size);
  let cs = flatten(p.commands);
  if (TEXT[i] === '2') {
    const gb = p.getBoundingBox(), k = (gb.y2 - gb.y1) / (tb[3] - tb[1]), cx = (gb.x1 + gb.x2) / 2, tx = (tb[0] + tb[2]) / 2;
    cs = TWO.map(c => c.map(([a, b]) => [cx + (a - tx) * k, gb.y2 + (b - tb[3]) * k]));
  }
  cs = cs.map(orient).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const all = cs.flat(1), bb = all.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
  letters.push({ ch: TEXT[i], bb: bb.map(v => Math.round(v * 10) / 10), contours: cs.map(c => resampleClosed(c, 1.6)) });
  x += adv[i] + ls;
});

const out = { logo, wm: { inkW: INK_W, capH: INK_W / 11.27, letters } };
fs.writeFileSync(A('notebook-shapes.json'), JSON.stringify(out));
const count = o => JSON.stringify(o).length;
console.log('logo pieces', Object.fromEntries(Object.entries(logo).map(([k, v]) => [k, v.map(c => c.length / 2)])));
console.log('wordmark letters', letters.map(l => l.ch + ':' + l.contours.length).join(' '), 'bytes', count(out));
