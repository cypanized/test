// Shared body measurements for the dress form (all units are centimetres).
//
// Coordinate system (the "mirror" view, as you see yourself while tying):
//   +x  wearer's right (appears on the right in a mirror)
//   +y  up            (y = 0 is roughly the top shirt button)
//   +z  out of the shirt, towards the mirror
//
// The tie engine and the mannequin both read from here, so the tie always
// rests on the same surfaces that are drawn.

export const NECK = { z: -10.5, r: 6.0, top: 11.5 };

// Collar stand (band) and the folded collar leaf that sits over the tie.
export const COLLAR = {
  bandR: 6.55,
  tieR: 7.05, // centre-line radius of the tie running around the collar band
  leafR: 7.45,
  frontAngle: 9 * Math.PI / 180, // half-gap between the two collar fronts
  pointX: 6.3,
  pointY: -5.4,
};

export const BELT = { top: -45.4, bottom: -49.4 };
// Where the finished tip should land: just touching the top of the buckle.
export const TIP_TARGET_Y = -46.4;
export const BUTTONS_Y = [-7.5, -16, -24.5, -33, -41.5];

// Torso cross-sections from the neck down to the hips: [y, halfWidth, frontZ, halfDepth]
const PROFILE = [
  [1.5, 6.3, -4.5, 6.0],
  [0.0, 6.9, -4.3, 6.2],
  [-1.0, 8.6, -4.05, 6.8],
  [-2.0, 11.6, -3.8, 7.6],
  [-3.2, 15.6, -3.45, 8.6],
  [-4.6, 19.1, -3.0, 9.6],
  [-6.5, 21.6, -2.35, 10.6],
  [-9, 22.3, -1.6, 11.4],
  [-12, 21.9, -0.85, 11.9],
  [-16, 20.6, -0.1, 12.2],
  [-21, 19.6, 0.35, 12.3],
  [-28, 18.6, 0.45, 12.0],
  [-35, 17.5, 0.2, 11.5],
  [-42, 17.0, 0.0, 11.1],
  [-48, 17.3, 0.1, 11.2],
  [-56, 18.2, 0.35, 11.5],
  [-68, 18.6, 0.5, 11.7],
  [-100, 18.6, 0.45, 11.6],
];

export const SUPER_P = 2.6; // superellipse exponent: rounder than a box, flatter than an oval

function hermite(y) {
  const P = PROFILE;
  if (y >= P[0][0]) return P[0].slice(1);
  if (y <= P[P.length - 1][0]) return P[P.length - 1].slice(1);
  let i = 0;
  while (i < P.length - 2 && y < P[i + 1][0]) i++;
  const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, P.length - 1)];
  const t = (p1[0] - y) / (p1[0] - p2[0]);
  const out = [];
  for (let k = 1; k < 4; k++) {
    const d1 = (p2[k] - p0[k]) / Math.max(p0[0] - p2[0], 1e-6) * (p1[0] - p2[0]);
    const d2 = (p3[k] - p1[k]) / Math.max(p1[0] - p3[0], 1e-6) * (p1[0] - p2[0]);
    const t2 = t * t, t3 = t2 * t;
    out.push((2 * t3 - 3 * t2 + 1) * p1[k] + (t3 - 2 * t2 + t) * d1 + (-2 * t3 + 3 * t2) * p2[k] + (t3 - t2) * d2);
  }
  return out;
}

export function torsoSection(y) {
  const [a, zf, b] = hermite(y);
  return { a, b, zc: zf - b, zf };
}

// Front surface of the shirt at (x, y); -Infinity outside the silhouette.
export function chestZ(x, y) {
  const { a, b, zc } = torsoSection(y);
  const r = Math.abs(x) / a;
  if (r >= 1) return -Infinity;
  return zc + b * Math.pow(1 - Math.pow(r, SUPER_P), 1 / SUPER_P);
}

// Fast table lookup of chestZ for the cloth simulation (bilinear, 0.25 cm grid).
const GX0 = -26, GX1 = 26, GY0 = -104, GY1 = 1.5, GS = 0.25;
const GW = Math.round((GX1 - GX0) / GS) + 1, GH = Math.round((GY1 - GY0) / GS) + 1;
let grid = null;
export function chestZFast(x, y) {
  if (x <= GX0 || x >= GX1 || y <= GY0 || y >= GY1) return chestZ(x, y);
  if (!grid) {
    grid = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const z = chestZ(GX0 + i * GS, GY0 + j * GS);
      grid[j * GW + i] = Number.isFinite(z) ? z : -1e4;
    }
  }
  const fx = (x - GX0) / GS, fy = (y - GY0) / GS;
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const a = grid[j * GW + i], b = grid[j * GW + i + 1], c = grid[(j + 1) * GW + i], d = grid[(j + 1) * GW + i + 1];
  if (a < -1e3 || b < -1e3 || c < -1e3 || d < -1e3) return chestZ(x, y);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// "Don't go behind this" surface used to keep hanging tie ends resting on
// the shirt and neck. (Near the collar they lie on the shirt, under the
// collar points, like a real tie.)
export function bodyClearZ(x, y) {
  let z = chestZ(x, y);
  // neck
  if (y > -1 && Math.abs(x) < NECK.r) {
    z = Math.max(z, NECK.z + Math.sqrt(NECK.r * NECK.r - x * x));
  }
  return z;
}

// Approximate outward normal of the shirt surface (used to lay the tie flat on it).
export function chestNormal(x, y) {
  const e = 0.6;
  const zx1 = chestZ(x + e, y), zx0 = chestZ(x - e, y);
  const zy1 = chestZ(x, y + e), zy0 = chestZ(x, y - e);
  if (![zx1, zx0, zy1, zy0].every(Number.isFinite)) return [0, 0, 1];
  const dx = (zx1 - zx0) / (2 * e), dy = (zy1 - zy0) / (2 * e);
  const l = Math.hypot(dx, dy, 1);
  return [-dx / l, -dy / l, 1 / l];
}

// The folded collar leaf as a plain triangle surface (cols around the neck,
// rows from the fold down to the edge/points). The mannequin draws it and
// the cloth simulation uses a coarse copy as a solid obstacle.
export function collarLeafSurface(cols = 150, rows = 26) {
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const th0 = COLLAR.frontAngle;
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
  const bandTop = (th) => 3.45 + 1.6 * (1 - Math.cos(th)) / 2;
  let o = 0, u = 0;
  for (let c = 0; c <= cols; c++) {
    const th = lerp(th0, TAU - th0, c / cols);
    const side = th < Math.PI ? 1 : -1; // +1 = wearer's right half
    const d = Math.min(th - th0, TAU - th0 - th);
    const f = smooth(1 - d / 1.05);
    const sn = Math.sin(th), cs = Math.cos(th);
    const yT = bandTop(th) + 0.05;
    // lower edge: around the back, sweeping down into the collar point at the front
    const rB = 8.7;
    const bx = rB * sn, by = -0.25 + 1.5 * (1 - cs) / 2, bz = NECK.z + rB * cs;
    const px = side * COLLAR.pointX, py = COLLAR.pointY, pz = chestZ(px, py) + 0.95;
    const ex = lerp(bx, px, f), ey = lerp(by, py, f), ez = lerp(bz, pz, f);
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      let x, y, z;
      if (v < 0.14) {
        // the rolled fold over the band
        const a = (v / 0.14) * Math.PI * 0.62;
        const rad = COLLAR.bandR + 0.42 * Math.sin(a) + 0.08;
        x = rad * sn; y = yT + 0.32 * Math.sin(a * 0.9); z = NECK.z + rad * cs;
      } else {
        const t = (v - 0.14) / 0.86;
        const sr = COLLAR.bandR + 0.5;
        x = lerp(sr * sn, ex, t); y = lerp(yT + 0.1, ey, t); z = lerp(NECK.z + sr * cs, ez, t);
        // billow outwards so the leaf clears the tie running beneath it
        const out = 0.75 * Math.sin(t * Math.PI) * (1 - 0.5 * f);
        x += sn * out; z += cs * out;
        z += 0.55 * Math.sin(t * Math.PI) * f;
        const zMin = chestZ(x, y) + 0.85;
        if (Number.isFinite(zMin) && y < 0.5 && z < zMin) z = zMin;
        // stay clear of the tie running round the collar band beneath
        if (y > -2.5) {
          const rx = x, rz = z - NECK.z, rr = Math.hypot(rx, rz);
          const rMin = COLLAR.tieR + 0.75;
          if (rr < rMin) { x = rx * rMin / rr; z = NECK.z + rz * rMin / rr; }
        }
      }
      pos[o++] = x; pos[o++] = y; pos[o++] = z;
      uv[u++] = (c / cols) * 12; uv[u++] = v;
    }
  }
  const H = rows + 1;
  const idx = new Uint32Array(cols * rows * 6);
  let k = 0;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const a = c * H + r, b = a + 1, d = a + H, e = d + 1;
    idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = b; idx[k++] = e; idx[k++] = d;
  }
  return { pos, uv, idx };
}
