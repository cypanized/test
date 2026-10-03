// Builds the GuitarZero2Hero wordmark as SVG path data per glyph (Space Grotesk Bold, open tracking,
// the brand's looped "2" swapped in from the traced outline) → assets/wordmark.json
// Units: cap height = 100, baseline at y = 0, ink spans x 0 … 1127 (ink width ÷ cap height ≈ 11.27).
//   NODE_PATH=/home/user/test/gz2h-kit/node_modules node tools/wordmark.js
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const A = f => path.join(__dirname, '../assets', f);

const font = opentype.parse(fs.readFileSync(A('SpaceGrotesk-700.ttf')).buffer.slice(0));
const TEXT = 'GuitarZero2Hero', CAP = 100, INK_W = CAP * 11.27;
const capH = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
const size = CAP / capH, sc = size / font.unitsPerEm;
const glyphs = font.stringToGlyphs(TEXT);
const adv = glyphs.map((g, i) => g.advanceWidth * sc + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * sc : 0));
const inkOf = ls => { const first = glyphs[0].getBoundingBox(), last = glyphs[glyphs.length - 1].getBoundingBox(); let x = 0; for (let i = 0; i < glyphs.length - 1; i++) x += adv[i] + ls; return x + last.x2 * sc - first.x1 * sc; };
const ls = (INK_W - inkOf(0)) / (glyphs.length - 1);

// traced looped 2: parse M/C/L/Z absolute commands
function parseSvg(d) {
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g), cmds = []; let i = 0, cmd = null; const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { cmds.push(['M', num(), num()]); cmd = 'L'; }
    else if (cmd === 'L') cmds.push(['L', num(), num()]);
    else if (cmd === 'C') cmds.push(['C', num(), num(), num(), num(), num(), num()]);
    else if (cmd === 'Z') { cmds.push(['Z']); cmd = null; }
  }
  return cmds;
}
const TWO = parseSvg(JSON.parse(fs.readFileSync(A('wordmark-two.json'), 'utf8')).d);
const tb = [1e9, 1e9, -1e9, -1e9];
for (const c of TWO) for (let j = 1; j < c.length; j += 2) { tb[0] = Math.min(tb[0], c[j]); tb[2] = Math.max(tb[2], c[j]); tb[1] = Math.min(tb[1], c[j + 1]); tb[3] = Math.max(tb[3], c[j + 1]); }

const r = v => Math.round(v * 100) / 100;
let x = -glyphs[0].getBoundingBox().x1 * sc;
const out = [];
glyphs.forEach((g, i) => {
  const p = g.getPath(x, 0, size), bb = p.getBoundingBox();
  let d = p.commands.map(c => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}` : c.type === 'C' ? `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}` : `${c.type}${r(c.x)} ${r(c.y)}`).join(''), rule = 'nonzero';
  if (TEXT[i] === '2') {
    const k = (bb.y2 - bb.y1) / (tb[3] - tb[1]), cx = (bb.x1 + bb.x2) / 2, tx = (tb[0] + tb[2]) / 2;
    const T = (a, b) => `${r(cx + (a - tx) * k)} ${r(bb.y2 + (b - tb[3]) * k)}`;
    d = TWO.map(c => c[0] === 'Z' ? 'Z' : c[0] + (c[0] === 'C' ? `${T(c[1], c[2])} ${T(c[3], c[4])} ${T(c[5], c[6])}` : T(c[1], c[2]))).join('');
    rule = 'evenodd';
  }
  out.push({ ch: TEXT[i], d, rule, x1: r(bb.x1), x2: r(bb.x2), y1: r(bb.y1), y2: r(bb.y2) });
  x += adv[i] + ls;
});
const ink = [Math.min(...out.map(o => o.x1)), Math.min(...out.map(o => o.y1)), Math.max(...out.map(o => o.x2)), Math.max(...out.map(o => o.y2))];
fs.writeFileSync(A('wordmark.json'), JSON.stringify({ cap: CAP, ink, glyphs: out }));
console.log('wordmark ink box', ink, 'ratio', ((ink[2] - ink[0]) / CAP).toFixed(2));
