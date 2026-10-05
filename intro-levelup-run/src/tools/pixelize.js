// Rasterizes the traced GZ2H logo pieces and the wordmark outline (with the brand's looped 2) to 1-bit pixel masks
// at the intro's native 320×180 resolution, so the logo blocks and the title wordmark are true pixel art.
//   node tools/pixelize.js            → assets/pixels.json
//   node tools/pixelize.js --preview  → also prints ASCII previews
const fs = require('fs'), path = require('path');
const A = f => path.join(__dirname, '../assets', f);

// ── SVG path → polygons ──
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
  const out = []; let cur = null, px = 0, py = 0;
  for (const c of cmds) {
    if (c.type === 'M') { if (cur && cur.length > 2) out.push(cur); cur = [[c.x, c.y]]; px = c.x; py = c.y; }
    else if (c.type === 'L') { cur.push([c.x, c.y]); px = c.x; py = c.y; }
    else if (c.type === 'C') {
      for (let s = 1; s <= 12; s++) {
        const t = s / 12, u = 1 - t;
        cur.push([u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') { if (cur && cur.length > 2) out.push(cur); cur = null; }
  }
  if (cur && cur.length > 2) out.push(cur);
  return out;
}

// ── even-odd scanline rasterizer with k×k supersampling; a pixel is ink when coverage ≥ thr ──
function raster(contours, w, h, k = 4, thr = 0.5) {
  const cov = new Float32Array(w * h);
  const edges = [];
  for (const c of contours) for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]); }
  for (let sy = 0; sy < h * k; sy++) {
    const y = (sy + 0.5) / k, xs = [];
    for (const [x0, y0, x1, y1] of edges) if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0));
    xs.sort((p, q) => p - q);
    const row = Math.floor(sy / k);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      for (let sx = Math.max(0, Math.ceil(xs[j] * k - 0.5)); sx < w * k && (sx + 0.5) / k < xs[j + 1]; sx++) cov[row * w + Math.floor(sx / k)] += 1 / (k * k);
    }
  }
  const bits = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bits[i] = cov[i] >= thr ? 1 : 0;
  return bits;
}
const crop = (bits, w, h) => {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bits[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, rows = [];
  for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) s += bits[y * w + x] ? '#' : '.'; rows.push(s); }
  return { x: x0, y: y0, w: cw, h: ch, rows };
};

// ── logo pieces at LOGO_W px wide, in a shared frame (x, y relative to the logo's top-left) ──
const LOGO = JSON.parse(fs.readFileSync(A('logo-paths.json'), 'utf8'));
const LOGO_W = 204, BB = [58, 51, 3165, 1274];
const S = LOGO_W / (BB[2] - BB[0]);
const LW = Math.ceil((BB[2] - BB[0]) * S) + 2, LH = Math.ceil((BB[3] - BB[1]) * S) + 2;
const tf = cs => cs.map(c => c.map(([x, y]) => [(x - BB[0]) * S + 1, (y - BB[1]) * S + 1]));
const logo = { w: LW, h: LH, pieces: {} };
for (const k of ['G', 'horns', 'Z', 'thumb', 'two', 'wave', 'H', 'ok']) {
  logo.pieces[k] = crop(raster(tf(flatten(parseSvg(LOGO[k]))), LW, LH, 6, 0.5), LW, LH);
}

// ── wordmark from the 4096-point outline (screen space, 1400 px wide), scaled to WM_W px ──
const SH = JSON.parse(fs.readFileSync(A('shapes.json'), 'utf8'));
const WM_W = 262, wb = SH.wmBox, ws = WM_W / (wb[2] - wb[0]);
const cont = []; let cur = null;
for (let i = 0; i < SH.wm.length; i += 3) { if (SH.wm[i + 2] === 1) { cur = []; cont.push(cur); } cur.push([(SH.wm[i] - wb[0]) * ws + 1, (SH.wm[i + 1] - wb[1]) * ws + 1]); }
const WW = Math.ceil((wb[2] - wb[0]) * ws) + 3, WH = Math.ceil((wb[3] - wb[1]) * ws) + 3;
const wm = crop(raster(cont, WW, WH, 6, 0.46), WW, WH);
wm.letters = SH.letters.map(l => ({ ch: l.ch, x1: Math.round((l.x1 - wb[0]) * ws + 1 - wm.x), x2: Math.round((l.x2 - wb[0]) * ws + 1 - wm.x) }));

fs.writeFileSync(A('pixels.json'), JSON.stringify({ logo, wm }));
if (process.argv.includes('--preview')) {
  const show = (p, name) => { console.log(name, p.x, p.y, p.w + '×' + p.h); };
  for (const [k, p] of Object.entries(logo.pieces)) show(p, k);
  console.log(wm.rows.join('\n'));
  show(wm, 'wordmark');
}
console.log('logo', LW + '×' + LH, 'wordmark', wm.w + '×' + wm.h);
