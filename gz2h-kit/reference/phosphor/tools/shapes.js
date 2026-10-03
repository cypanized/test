// Turns the traced GZ2H logo and the Space Grotesk wordmark into beam paths:
// N points each, resampled by arc length, with a "blank" flag where the beam jumps between contours.
// Every shape has the same N, so any shape can morph point-for-point into any other.
//   NODE_PATH=<dir with opentype.js> node tools/shapes.js   → assets/shapes.json
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const A = f => path.join(__dirname, '../assets', f);
const N = 4096;

// ── path parsing / flattening ──
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
function flatten(cmds, tf) {
  const contours = []; let cur = null, px = 0, py = 0;
  const push = (x, y) => { const p = tf(x, y); cur.push(p); };
  for (const c of cmds) {
    if (c.type === 'M') { if (cur && cur.length > 2) contours.push(cur); cur = []; push(c.x, c.y); px = c.x; py = c.y; }
    else if (c.type === 'L') { push(c.x, c.y); px = c.x; py = c.y; }
    else if (c.type === 'C' || c.type === 'Q') {
      for (let s = 1; s <= 16; s++) {
        const t = s / 16, u = 1 - t;
        let x, y;
        if (c.type === 'C') { x = u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x; y = u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y; }
        else { x = u * u * px + 2 * u * t * c.x1 + t * t * c.x; y = u * u * py + 2 * u * t * c.y1 + t * t * c.y; }
        push(x, y);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') { if (cur && cur.length > 2) contours.push(cur); cur = null; }
  }
  if (cur && cur.length > 2) contours.push(cur);
  return contours;
}
const len = c => { let L = 0; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L; };
function resample(contours, n) {
  contours = contours.filter(c => len(c) > 24);
  const lens = contours.map(len), total = lens.reduce((a, b) => a + b, 0);
  const alloc = lens.map(L => Math.max(12, Math.floor((n - contours.length) * L / total)));
  let diff = n - contours.length - alloc.reduce((a, b) => a + b, 0);
  for (let k = 0; diff !== 0; k = (k + 1) % alloc.length) { const s = Math.sign(diff); if (alloc[k] + s >= 12) { alloc[k] += s; diff -= s; } }
  const out = [];
  contours.forEach((c, ci) => {
    const k = alloc[ci], L = lens[ci];
    const cum = [0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    let seg = 0;
    for (let j = 0; j <= k; j++) {
      const s = (j / k) * L;
      while (seg < c.length - 1 && cum[seg + 1] < s) seg++;
      const a = c[seg], b = c[(seg + 1) % c.length], f = (s - cum[seg]) / ((cum[seg + 1] - cum[seg]) || 1);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, j === 0 ? 1 : 0]);
    }
  });
  if (out.length !== n) throw new Error('resample produced ' + out.length);
  return out;
}
const pack = pts => pts.flatMap(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, p[2]]);
const bbox = pts => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);

// ── logo: traced pieces, left to right, centred on screen ──
const LOGO = JSON.parse(fs.readFileSync(A('logo-paths.json'), 'utf8'));
const S = 0.355, CX = 960, CY = 515;
const tfLogo = (x, y) => [CX + (x - 1611.5) * S, CY + (y - 662.5) * S];
const logoContours = ['G', 'horns', 'Z', 'thumb', 'two', 'wave', 'H', 'ok'].flatMap(k => flatten(parseSvg(LOGO[k]), tfLogo));
const logo = resample(logoContours, N);

// ── wordmark: Space Grotesk Bold glyph outlines with the brand's open tracking ──
const font = opentype.parse(fs.readFileSync(A('SpaceGrotesk-700.ttf')).buffer.slice(0));
const TEXT = 'GuitarZero2Hero', INK_W = 1400, BASE = 590;
const capH = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;   // cap height per 1px of size
const size = (INK_W / 11.27) / capH;
const glyphs = font.stringToGlyphs(TEXT), sc = size / font.unitsPerEm;
const adv = glyphs.map((g, i) => g.advanceWidth * sc + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * sc : 0));
const inkOf = ls => { const first = glyphs[0].getBoundingBox(), last = glyphs[glyphs.length - 1].getBoundingBox(); let x = 0; for (let i = 0; i < glyphs.length - 1; i++) x += adv[i] + ls; return x + last.x2 * sc - first.x1 * sc; };
const ls = (INK_W - inkOf(0)) / (glyphs.length - 1);
let x = CX - INK_W / 2 - glyphs[0].getBoundingBox().x1 * sc;
const wmContours = [], letters = [];
// the brand's "2" has a loop the font lacks: use the one traced from the original wordmark
const TWO = flatten(parseSvg(JSON.parse(fs.readFileSync(A('wordmark-two.json'), 'utf8')).d), (a, b) => [a, b]);
const twoBox = TWO.flat(2).reduce((b, v, i) => (i % 2 ? [b[0], Math.min(b[1], v), b[2], Math.max(b[3], v)] : [Math.min(b[0], v), b[1], Math.max(b[2], v), b[3]]), [1e9, 1e9, -1e9, -1e9]);
glyphs.forEach((g, i) => {
  const p = g.getPath(x, BASE, size);
  let cs = flatten(p.commands, (a, b) => [a, b]);
  if (TEXT[i] === '2') {
    const gb = p.getBoundingBox(), k = (gb.y2 - gb.y1) / (twoBox[3] - twoBox[1]), cx = (gb.x1 + gb.x2) / 2, tx = (twoBox[0] + twoBox[2]) / 2;
    cs = TWO.map(c => c.map(([a, b]) => [cx + (a - tx) * k, gb.y2 + (b - twoBox[3]) * k]));
  }
  wmContours.push(...cs);
  const bb = p.getBoundingBox(); letters.push({ ch: TEXT[i], x1: Math.round(bb.x1), x2: Math.round(bb.x2) });
  x += adv[i] + ls;
});
const wm = resample(wmContours, N);

fs.writeFileSync(A('shapes.json'), JSON.stringify({ N, logo: pack(logo), wm: pack(wm), logoBox: bbox(logo).map(Math.round), wmBox: bbox(wm).map(Math.round), base: BASE, capH: Math.round(INK_W / 11.27), letters }));
console.log('logo contours', logoContours.length, 'wordmark contours', wmContours.length, 'logo box', bbox(logo).map(Math.round), 'wm box', bbox(wm).map(Math.round));
