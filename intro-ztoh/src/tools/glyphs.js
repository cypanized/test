// Extracts the Space Grotesk Bold outlines the intro sets by hand → assets/glyphs.json
//   NODE_PATH=<dir with opentype.js> node tools/glyphs.js
// Every glyph is a y-down SVG path in font units (1000 upm, cap height 700, baseline at y=0).
// The brand's "2" (with the loop the font lacks) replaces the font's "2", fitted to its box.
// Also stores the wordmark layout: "GuitarZero2Hero" tracked open so ink width ÷ cap height = 11.27.
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const A = f => path.join(__dirname, '../assets', f);
const font = opentype.parse(fs.readFileSync(A('SpaceGrotesk-700.ttf')).buffer.slice(0));
const CHARS = 'ZNHEROGUITA2guitarzeoh.cm ';
const r1 = v => Math.round(v * 10) / 10;

// the looped 2 from the original wordmark: parse M/L/C/Z, fit to the font 2's box
function parseSvg(d) {
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g), out = []; let i = 0, cmd = null;
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { out.push(['M', num(), num()]); cmd = 'L'; }
    else if (cmd === 'L') out.push(['L', num(), num()]);
    else if (cmd === 'C') out.push(['C', num(), num(), num(), num(), num(), num()]);
    else if (cmd === 'Z') { out.push(['Z']); cmd = null; }
  }
  return out;
}
const two = parseSvg(JSON.parse(fs.readFileSync(A('wordmark-two.json'), 'utf8')).d);
const tb = [1e9, 1e9, -1e9, -1e9];
for (const c of two) for (let j = 1; j < c.length; j += 2) { tb[0] = Math.min(tb[0], c[j]); tb[2] = Math.max(tb[2], c[j]); tb[1] = Math.min(tb[1], c[j + 1]); tb[3] = Math.max(tb[3], c[j + 1]); }

const G = {};
for (const ch of CHARS) {
  const g = font.charToGlyph(ch), p = g.getPath(0, 0, 1000), bb = p.getBoundingBox();
  G[ch] = { adv: g.advanceWidth, d: p.toPathData(1), bb: [r1(bb.x1), r1(bb.y1), r1(bb.x2), r1(bb.y2)] };
  if (ch === ' ') G[ch].bb = [0, 0, 0, 0];
}
{
  const f2 = G['2'], [x1, y1, x2, y2] = f2.bb, k = (y2 - y1) / (tb[3] - tb[1]), cx = (x1 + x2) / 2, tx = (tb[0] + tb[2]) / 2;
  const tf = (a, b) => [r1(cx + (a - tx) * k), r1(y2 + (b - tb[3]) * k)];
  let d = '', nb = [1e9, 1e9, -1e9, -1e9];
  for (const c of two) {
    if (c[0] === 'Z') { d += 'Z'; continue; }
    d += c[0];
    for (let j = 1; j < c.length; j += 2) { const [a, b] = tf(c[j], c[j + 1]); d += `${a} ${b} `; nb = [Math.min(nb[0], a), Math.min(nb[1], b), Math.max(nb[2], a), Math.max(nb[3], b)]; }
  }
  G['2'] = { adv: f2.adv, d: d.trim(), bb: nb };
}
// kerning for every pair we set
const KERN = {};
for (const a of CHARS) for (const b of CHARS) { const v = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b)); if (v) KERN[a + b] = v; }

// wordmark: open tracking so that ink width / cap height = 11.27 (cap = 700)
const WM = 'GuitarZero2Hero', CAP = 700, INK = 11.27 * CAP;
const adv = [...WM].map((c, i) => G[c].adv + (i < WM.length - 1 ? (KERN[c + WM[i + 1]] || 0) : 0));
const inkOf = ls => { let x = 0; for (let i = 0; i < WM.length - 1; i++) x += adv[i] + ls; return x + G[WM[WM.length - 1]].bb[2] - G[WM[0]].bb[0]; };
const ls = (INK - inkOf(0)) / (WM.length - 1);
const xs = []; let x = -G[WM[0]].bb[0];
for (let i = 0; i < WM.length; i++) { xs.push(r1(x)); x += adv[i] + ls; }

fs.writeFileSync(A('glyphs.json'), JSON.stringify({ cap: CAP, glyphs: G, kern: KERN, wordmark: { text: WM, xs, ink: INK, ls: r1(ls) } }));
console.log('glyphs', Object.keys(G).join(''), 'kern pairs', Object.keys(KERN).length, 'wordmark tracking', ls.toFixed(1), 'two box', G['2'].bb);
