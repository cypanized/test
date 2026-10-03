// Builds the "GuitarZero2Hero" wordmark as one SVG path per letter (Space Grotesk Bold, open tracking),
// with the brand's looped "2" traced from the original wordmark. Output is in screen px for a 1920×1080 frame:
// ink width INK_W centred on x = 960, baseline at y = BASE.
//   NODE_PATH=<dir with opentype.js> node tools/wordmark.js   → assets/wordmark.json
const fs = require('fs'), path = require('path');
const opentype = require('opentype.js');
const A = f => path.join(__dirname, '../assets', f);
const TEXT = 'GuitarZero2Hero', INK_W = 1320, BASE = 560, CX = 960;

const font = opentype.parse(fs.readFileSync(A('SpaceGrotesk-700.ttf')).buffer.slice(0));
const capH = font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm;
const size = (INK_W / 11.27) / capH;
const glyphs = font.stringToGlyphs(TEXT), sc = size / font.unitsPerEm;
const adv = glyphs.map((g, i) => g.advanceWidth * sc + (i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * sc : 0));
const inkOf = ls => { const first = glyphs[0].getBoundingBox(), last = glyphs[glyphs.length - 1].getBoundingBox(); let x = 0; for (let i = 0; i < glyphs.length - 1; i++) x += adv[i] + ls; return x + last.x2 * sc - first.x1 * sc; };
const ls = (INK_W - inkOf(0)) / (glyphs.length - 1);

// traced looped 2: parse M/L/C/Z and refit into the font's "2" box
const TWO_D = JSON.parse(fs.readFileSync(A('wordmark-two.json'), 'utf8')).d;
const tok = TWO_D.match(/[MLCZ]|-?\d*\.?\d+/g);
const nums = tok.filter(s => !/[MLCZ]/.test(s)).map(Number);
let tb = [1e9, 1e9, -1e9, -1e9];
for (let i = 0; i < nums.length; i += 2) { tb = [Math.min(tb[0], nums[i]), Math.min(tb[1], nums[i + 1]), Math.max(tb[2], nums[i]), Math.max(tb[3], nums[i + 1])]; }

const r1 = v => Math.round(v * 10) / 10;
let x = CX - INK_W / 2 - glyphs[0].getBoundingBox().x1 * sc;
const out = [];
glyphs.forEach((g, i) => {
  const p = g.getPath(x, BASE, size), bb = p.getBoundingBox();
  let d;
  if (TEXT[i] === '2') {
    const k = (bb.y2 - bb.y1) / (tb[3] - tb[1]), cx = (bb.x1 + bb.x2) / 2, tx = (tb[0] + tb[2]) / 2;
    let j = 0, s = '';
    for (const t of tok) {
      if (/[MLCZ]/.test(t)) { s += t; j = 0; continue; }
      const v = +t; s += (j % 2 === 0 ? r1(cx + (v - tx) * k) : r1(bb.y2 + (v - tb[3]) * k)) + ' '; j++;
    }
    d = s.replace(/ ([MLCZ])/g, '$1').trim();
  } else d = p.toPathData(1);
  out.push({ ch: TEXT[i], d, x1: r1(bb.x1), y1: r1(bb.y1), x2: r1(bb.x2), y2: r1(bb.y2) });
  x += adv[i] + ls;
});
fs.writeFileSync(A('wordmark.json'), JSON.stringify({ base: BASE, capH: Math.round(INK_W / 11.27), inkW: INK_W, glyphs: out }));
console.log('wordmark glyphs', out.length, 'ink', out[0].x1, '→', out[out.length - 1].x2, 'two box', out[10].x1, out[10].y1, out[10].x2, out[10].y2);
