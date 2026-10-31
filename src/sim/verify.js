// Exact check for interpenetration: does any edge of the tie's mid-surface
// pass through a non-neighbouring triangle of the tie (or of the collar)?
// Used by the baker on every recorded frame.
import { ROWS, COLS } from './cloth.js';

export function findIntersections(cloth, x = cloth.x, { limit = 50 } = {}) {
  const C = COLS, R = ROWS, tri = cloth.tri, nT = cloth.nTri, op = cloth.obsPos, ot = cloth.obsTri, nO = cloth.nObs;
  // edges of the grid (along, across and the triangle diagonals)
  const edges = cloth._edges || (cloth._edges = buildEdges());
  const cs = 1.5, inv = 1 / cs;
  const cells = new Map();
  const key = (i, j, k) => (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
  const addTri = (id, ax, ay, az, bx, by, bz, cx, cy, cz) => {
    for (let i = Math.floor(Math.min(ax, bx, cx) * inv); i <= Math.floor(Math.max(ax, bx, cx) * inv); i++)
      for (let j = Math.floor(Math.min(ay, by, cy) * inv); j <= Math.floor(Math.max(ay, by, cy) * inv); j++)
        for (let k = Math.floor(Math.min(az, bz, cz) * inv); k <= Math.floor(Math.max(az, bz, cz) * inv); k++) {
          const h = key(i, j, k);
          let l = cells.get(h); if (!l) cells.set(h, (l = []));
          l.push(id);
        }
  };
  const P = (v) => [x[v * 3], x[v * 3 + 1], x[v * 3 + 2]];
  const O = (v) => [op[v * 3], op[v * 3 + 1], op[v * 3 + 2]];
  for (let k = 0; k < nT; k++) addTri(k, ...P(tri[k * 3]), ...P(tri[k * 3 + 1]), ...P(tri[k * 3 + 2]));
  for (let k = 0; k < nO; k++) addTri(nT + k, ...O(ot[k * 3]), ...O(ot[k * 3 + 1]), ...O(ot[k * 3 + 2]));

  const hits = [];
  for (let e = 0; e < edges.length; e += 2) {
    const u = edges[e], v = edges[e + 1];
    const ru = Math.floor(u / C), rv = Math.floor(v / C);
    const [ux, uy, uz] = P(u), [vx, vy, vz] = P(v);
    const seen = new Set();
    for (let i = Math.floor(Math.min(ux, vx) * inv); i <= Math.floor(Math.max(ux, vx) * inv); i++)
      for (let j = Math.floor(Math.min(uy, vy) * inv); j <= Math.floor(Math.max(uy, vy) * inv); j++)
        for (let k = Math.floor(Math.min(uz, vz) * inv); k <= Math.floor(Math.max(uz, vz) * inv); k++) {
          const l = cells.get(key(i, j, k));
          if (!l) continue;
          for (const id of l) {
            if (seen.has(id)) continue;
            seen.add(id);
            let a, b, c;
            if (id < nT) {
              // same patch of fabric (the triangle's rows within one row of the edge's)
              const r0 = cloth.triRow[id], eMin = Math.min(ru, rv), eMax = Math.max(ru, rv);
              if (r0 <= eMax + 1 && eMin <= r0 + 2) continue;
              a = P(tri[id * 3]); b = P(tri[id * 3 + 1]); c = P(tri[id * 3 + 2]);
            } else {
              const o = id - nT;
              a = O(ot[o * 3]); b = O(ot[o * 3 + 1]); c = O(ot[o * 3 + 2]);
            }
            if (segTri(ux, uy, uz, vx, vy, vz, a, b, c)) {
              hits.push({ edge: [u, v], rowEdge: ru, tri: id, rowTri: id < nT ? Math.floor(tri[id * 3] / C) : 'collar' });
              if (hits.length >= limit) return hits;
            }
          }
        }
  }
  return hits;

  function buildEdges() {
    const list = [];
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const p = i * C + j;
      if (i + 1 < R) list.push(p, p + C);
      if (j + 1 < C) list.push(p, p + 1);
      if (i + 1 < R && j + 1 < C) list.push(p + 1, p + C);
    }
    return Int32Array.from(list);
  }
}

// Segment p->q against triangle (a, b, c), Moller-Trumbore.
function segTri(px, py, pz, qx, qy, qz, a, b, c) {
  const dx = qx - px, dy = qy - py, dz = qz - pz;
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-12) return false;
  const f = 1 / det;
  const sx = px - a[0], sy = py - a[1], sz = pz - a[2];
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return false;
  const qx2 = sy * e1z - sz * e1y, qy2 = sz * e1x - sx * e1z, qz2 = sx * e1y - sy * e1x;
  const v = f * (dx * qx2 + dy * qy2 + dz * qz2);
  if (v < 0 || u + v > 1) return false;
  const t = f * (e2x * qx2 + e2y * qy2 + e2z * qz2);
  return t > 0 && t < 1;
}
