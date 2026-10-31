// Procedural fabric textures, drawn once into canvases (no image downloads).
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function finish(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Regimental silk: diagonal stripes on a twill ground. One tile = 9 cm of tie.
 * Palette: [ground, wide stripe, fine stripe]
 */
export function stripeTexture(palette = ['#18264a', '#7c1f30', '#d6ab5e']) {
  const S = 512;
  const c = canvas(S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const [G, A, B] = palette.map(hex);
  const rnd = rng(7);
  const P = S / 2; // stripe period along the diagonal, tiles seamlessly
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = (x + y) % P;
      let col = G;
      // wide stripe flanked by two hairlines
      if (d >= 18 && d < 66) col = A;
      else if ((d >= 8 && d < 12) || (d >= 72 && d < 76)) col = B;
      // twill weave: fine diagonal ribs running the other way
      const rib = ((x - y + S * 4) % 6) < 3 ? 1.045 : 0.955;
      const n = 0.97 + rnd() * 0.06;
      const k = rib * n;
      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, col[0] * k);
      img.data[i + 1] = Math.min(255, col[1] * k);
      img.data[i + 2] = Math.min(255, col[2] * k);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c);
}

/** Back of the tie: a soft lining weave with the centre slip-stitch seam (u = 0.5). */
export function liningTexture() {
  const W = 256, H = 256;
  const c = canvas(W);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const rnd = rng(11);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const rib = ((x + y * 2) % 4) < 2 ? 1.04 : 0.96;
      let v = 0.86 * rib * (0.96 + rnd() * 0.08);
      // fold shadow near both edges (the silk is folded round the interlining)
      const e = Math.min(x, W - 1 - x) / W;
      if (e < 0.08) v *= 1.12 - (0.08 - e) * 2.2;
      // seam: a slightly raised ridge with stitches
      const dx = Math.abs(x - W / 2);
      if (dx < 5) v *= 0.82 + dx * 0.025;
      if (dx < 2 && (y % 16) < 9) v *= 1.35;
      const i = (y * W + x) * 4;
      const b = Math.min(255, v * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c);
}

/** Oxford shirting: tiny basket weave, used as both colour and bump. */
export function oxfordTexture() {
  const S = 256;
  const c = canvas(S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const rnd = rng(3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cell = ((x >> 1) + (y >> 1)) & 1;
      const v = (cell ? 0.93 : 1.0) * (0.95 + rnd() * 0.05);
      const i = (y * S + x) * 4;
      const b = v * 255;
      img.data[i] = b; img.data[i + 1] = b; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, { srgb: false });
}

/** Natural linen for the dress-form neck. */
export function linenTexture() {
  const S = 256;
  const c = canvas(S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const rnd = rng(5);
  const rows = Array.from({ length: S }, () => 0.9 + rnd() * 0.2);
  const cols = Array.from({ length: S }, () => 0.9 + rnd() * 0.2);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = ((x + y) & 1 ? rows[y] : cols[x]) * (0.94 + rnd() * 0.06);
      const i = (y * S + x) * 4;
      const b = Math.min(255, v * 220);
      img.data[i] = b; img.data[i + 1] = b; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, { srgb: false });
}

/** Moving dashes for the motion guide arrows (used as an alpha map). */
export function dashTexture() {
  const c = canvas(64);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 64);
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#000');
  grd.addColorStop(0.15, '#fff');
  grd.addColorStop(0.6, '#fff');
  grd.addColorStop(0.75, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = finish(c, { srgb: false, aniso: 4 });
  return t;
}
