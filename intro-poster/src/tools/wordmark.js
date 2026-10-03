// Builds the "GuitarZero2Hero" wordmark as filled outlines (SVG path strings) for the letterpress print.
// Space Grotesk Bold with the brand's open tracking (ink width / cap height = 11.27), and the brand's looped "2"
// (traced from the original wordmark) swapped in for the font's plain one.
// Units: cap height = 100, baseline at y = 0 (y grows downward), ink spans x = 0 .. 1127.
//   NODE_PATH=/home/user/test/gz2h-kit/node_modules node tools/wordmark.js   → assets/wordmark-paths.json
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const A = f => path.join(__dirname, '../assets', f);

const font = opentype.parse(fs.readFileSync(A('SpaceGrotesk-700.ttf')).buffer.slice(0));
const TEXT = 'GuitarZero2Hero', CAP = 100, INK_W = CAP * 11.27;
const capH = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
const size = CAP / capH, sc = size / font.unitsPerEm;
const glyphs = font.stringToGlyphs(TEXT);
const adv = glyphs.map((g, i) => g.advanceWidth * sc + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * sc : 0));
const inkOf = ls => { const f = glyphs[0].getBoundingBox(), l = glyphs[glyphs.length - 1].getBoundingBox(); let x = 0; for (let i = 0; i < glyphs.length - 1; i++) x += adv[i] + ls; return x + l.x2 * sc - f.x1 * sc; };
const ls = (INK_W - inkOf(0)) / (glyphs.length - 1);

// the traced "2": parse its M/L/C/Z path so it can be refitted
function parse(d) {
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g), out = []; let i = 0, cmd = null;
  const n = () => +tok[i++];
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { out.push(['M', n(), n()]); cmd = 'L'; }
    else if (cmd === 'L') out.push(['L', n(), n()]);
    else if (cmd === 'C') out.push(['C', n(), n(), n(), n(), n(), n()]);
    else if (cmd === 'Z') { out.push(['Z']); cmd = null; }
  }
  return out;
}
const TWO = parse(JSON.parse(fs.readFileSync(A('wordmark-two.json'), 'utf8')).d);
const tb = [1e9, 1e9, -1e9, -1e9];
for (const c of TWO) for (let k = 1; k < c.length; k += 2) { tb[0] = Math.min(tb[0], c[k]); tb[1] = Math.min(tb[1], c[k + 1]); tb[2] = Math.max(tb[2], c[k]); tb[3] = Math.max(tb[3], c[k + 1]); }

const r = v => Math.round(v * 100) / 100;
let x = -glyphs[0].getBoundingBox().x1 * sc;
const out = [];
glyphs.forEach((g, i) => {
  const p = g.getPath(x, 0, size);
  const bb = p.getBoundingBox();
  let d = p.commands.map(c => c.type === 'Z' ? 'Z' : c.type + (c.type === 'C' ? [c.x1, c.y1, c.x2, c.y2, c.x, c.y] : c.type === 'Q' ? [c.x1, c.y1, c.x, c.y] : [c.x, c.y]).map(r).join(' ')).join('');
  let box = [bb.x1, bb.y1, bb.x2, bb.y2];
  if (TEXT[i] === '2') {
    const k = (bb.y2 - bb.y1) / (tb[3] - tb[1]), cx = (bb.x1 + bb.x2) / 2, tx = (tb[0] + tb[2]) / 2;
    const f = (a, b) => [r(cx + (a - tx) * k), r(bb.y2 + (b - tb[3]) * k)];
    d = TWO.map(c => c[0] === 'Z' ? 'Z' : c[0] + (c.slice(1).reduce((s, v, j, arr) => (j % 2 ? s : s.concat(f(v, arr[j + 1]))), [])).join(' ')).join('');
    box = [cx - (tb[2] - tb[0]) * k / 2, bb.y1, cx + (tb[2] - tb[0]) * k / 2, bb.y2];
  }
  out.push({ ch: TEXT[i], d, box: box.map(r) });
  x += adv[i] + ls;
});
const all = out.reduce((b, g) => [Math.min(b[0], g.box[0]), Math.min(b[1], g.box[1]), Math.max(b[2], g.box[2]), Math.max(b[3], g.box[3])], [1e9, 1e9, -1e9, -1e9]);
fs.writeFileSync(A('wordmark-paths.json'), JSON.stringify({ cap: CAP, inkW: r(INK_W), box: all.map(r), glyphs: out }));
console.log('wordmark box', all.map(r), 'tracking', r(ls));
