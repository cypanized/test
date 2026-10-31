// Renders the simulated tie: the cloth grid is smoothed (Catmull-Rom, 2x
// along and across), given real thickness, slightly domed across the blade
// like a lined silk tie, and split into three material groups:
//   0: silk front (patterned)   1: back (lining, seam, tipping)   2: edges
import * as THREE from 'three';
import { TIE_LENGTH, tieWidth, SAMPLES } from '../engine/tie-engine.js';
import { ROWS, COLS } from '../sim/cloth.js';

const R2 = ROWS * 2 - 1;
const C2 = COLS * 2 - 1;
const THICK = 0.3;

export class TieMesh {
  constructor({ silk, lining, edge }) {
    const nFront = R2 * C2, nBack = R2 * C2, nEdge = R2 * 4;
    const total = nFront + nBack + nEdge;
    this.offBack = nFront;
    this.offEdge = nFront + nBack;
    this.pos = new Float32Array(total * 3);
    this.nor = new Float32Array(total * 3);
    this.glow = new Float32Array(total);
    this.grid = new Float32Array(R2 * C2 * 3); // smoothed mid-surface
    this.gridN = new Float32Array(R2 * C2 * 3);
    this.rowS = new Float32Array(R2);
    this.rowW = new Float32Array(R2);
    const uv = new Float32Array(total * 2);
    const col = new Float32Array(total * 3).fill(1);

    const L = TIE_LENGTH, period = 9;
    for (let i = 0; i < R2; i++) {
      const s = (i / (R2 - 1)) * L;
      const w = tieWidth(Math.min(L - 0.01, Math.max(0.01, s)));
      this.rowS[i] = s; this.rowW[i] = w;
      for (let j = 0; j < C2; j++) {
        const u = j / (C2 - 1);
        const f = i * C2 + j, b = nFront + f;
        uv[f * 2] = ((u - 0.5) * w) / period; uv[f * 2 + 1] = s / period;
        uv[b * 2] = u; uv[b * 2 + 1] = s / 6;
        let c = [0.26, 0.3, 0.4];
        if (s < 13 || s > L - 26) c = [0.19, 0.075, 0.1]; // tipping (deep wine)
        if (s > L - 36 && s < L - 31.5 && u > 0.3 && u < 0.7) c = [0.86, 0.8, 0.68]; // label
        if (s > L - 44 && s < L - 41.6) c = [0.18, 0.2, 0.28]; // keeper loop
        col[b * 3] = c[0]; col[b * 3 + 1] = c[1]; col[b * 3 + 2] = c[2];
      }
      for (let e = 0; e < 4; e++) {
        const v = nFront + nBack + i * 4 + e;
        uv[v * 2] = e < 2 ? 0 : 1; uv[v * 2 + 1] = s / period;
      }
    }

    const idx = [];
    const quad = (a, b, c, d, flip) => (flip ? idx.push(a, c, b, b, c, d) : idx.push(a, b, c, b, d, c));
    for (let i = 0; i < R2 - 1; i++) for (let j = 0; j < C2 - 1; j++) {
      const a = i * C2 + j;
      quad(a, a + C2, a + 1, a + C2 + 1, false);
    }
    const frontCount = idx.length;
    for (let i = 0; i < R2 - 1; i++) for (let j = 0; j < C2 - 1; j++) {
      const a = nFront + i * C2 + j;
      quad(a, a + C2, a + 1, a + C2 + 1, true);
    }
    const backCount = idx.length - frontCount;
    for (let i = 0; i < R2 - 1; i++) {
      const f0 = this.offEdge + i * 4, f1 = f0 + 4;
      quad(f0, f1, f0 + 1, f1 + 1, true);
      quad(f0 + 2, f1 + 2, f0 + 3, f1 + 3, false);
    }
    const edgeCount = idx.length - frontCount - backCount;

    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(this.glow, 1).setUsage(THREE.DynamicDrawUsage));
    geo.addGroup(0, frontCount, 0);
    geo.addGroup(frontCount, backCount, 1);
    geo.addGroup(frontCount + backCount, edgeCount, 2);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -30, 0), 120);
    this.geometry = geo;

    this.uniforms = { uGlow: { value: 0 }, uGlowColor: { value: new THREE.Color('#ffcf7a') } };
    for (const m of [silk, lining, edge]) addGlow(m, this.uniforms);
    this.mesh = new THREE.Mesh(geo, [silk, lining, edge]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /**
   * x: cloth particles (ROWS x COLS); C / G: dimple depth and glow per pose
   * sample (SAMPLES long); pinch: [yTop, yBottom, amount] knot taper.
   */
  update(x, C, G, pinch) {
    const g = this.grid;
    // 1. smooth along each column (Catmull-Rom midpoint: (-p0 + 9p1 + 9p2 - p3) / 16)
    const tmp = this._tmp || (this._tmp = new Float32Array(R2 * COLS * 3));
    for (let j = 0; j < COLS; j++) {
      for (let i = 0; i < ROWS; i++) {
        const src = (i * COLS + j) * 3, dst = (2 * i * COLS + j) * 3;
        tmp[dst] = x[src]; tmp[dst + 1] = x[src + 1]; tmp[dst + 2] = x[src + 2];
        if (i < ROWS - 1) {
          const i0 = Math.max(0, i - 1), i3 = Math.min(ROWS - 1, i + 2);
          const a = (i0 * COLS + j) * 3, b = src, c = ((i + 1) * COLS + j) * 3, d = (i3 * COLS + j) * 3;
          const o = ((2 * i + 1) * COLS + j) * 3;
          for (let k = 0; k < 3; k++) tmp[o + k] = (-x[a + k] + 9 * x[b + k] + 9 * x[c + k] - x[d + k]) / 16;
        }
      }
    }
    // 2. smooth across each row
    for (let i = 0; i < R2; i++) {
      for (let j = 0; j < COLS; j++) {
        const src = (i * COLS + j) * 3, dst = (i * C2 + 2 * j) * 3;
        g[dst] = tmp[src]; g[dst + 1] = tmp[src + 1]; g[dst + 2] = tmp[src + 2];
        if (j < COLS - 1) {
          const j0 = Math.max(0, j - 1), j3 = Math.min(COLS - 1, j + 2);
          const a = (i * COLS + j0) * 3, b = src, c = (i * COLS + j + 1) * 3, d = (i * COLS + j3) * 3;
          const o = (i * C2 + 2 * j + 1) * 3;
          for (let k = 0; k < 3; k++) g[o + k] = (-tmp[a + k] + 9 * tmp[b + k] + 9 * tmp[c + k] - tmp[d + k]) / 16;
        }
      }
    }
    // 3. knot taper
    if (pinch && pinch[2] > 1e-3) {
      const [y0, y1, k] = pinch, fade = 6;
      for (let v = 0; v < g.length; v += 3) {
        const y = g[v + 1];
        if (y > y0 || y < y1 - fade) continue;
        let t;
        if (y >= y1) { t = (y0 - y) / (y0 - y1); t = t * t * (3 - 2 * t); } else { t = 1 - (y1 - y) / fade; t *= t; }
        g[v] *= 1 - k * t;
      }
    }
    // 4. surface normals on the silk side: along x across
    const gn = this.gridN;
    for (let i = 0; i < R2; i++) {
      const ia = Math.max(0, i - 1), ib = Math.min(R2 - 1, i + 1);
      for (let j = 0; j < C2; j++) {
        const ja = Math.max(0, j - 1), jb = Math.min(C2 - 1, j + 1);
        const A = (ib * C2 + j) * 3, B = (ia * C2 + j) * 3, Cc = (i * C2 + jb) * 3, D = (i * C2 + ja) * 3;
        const tx = g[A] - g[B], ty = g[A + 1] - g[B + 1], tz = g[A + 2] - g[B + 2];
        const wx = g[Cc] - g[D], wy = g[Cc + 1] - g[D + 1], wz = g[Cc + 2] - g[D + 2];
        const nx = ty * wz - tz * wy, ny = tz * wx - tx * wz, nz = tx * wy - ty * wx;
        const l = Math.hypot(nx, ny, nz);
        const o = (i * C2 + j) * 3;
        if (l < 1e-9) {
          if (i > 0) { gn[o] = gn[o - C2 * 3]; gn[o + 1] = gn[o - C2 * 3 + 1]; gn[o + 2] = gn[o - C2 * 3 + 2]; }
          else { gn[o] = 0; gn[o + 1] = 0; gn[o + 2] = 1; }
          continue;
        }
        gn[o] = nx / l; gn[o + 1] = ny / l; gn[o + 2] = nz / l;
      }
    }
    // 5. thick, softly domed ribbon
    const pos = this.pos, nor = this.nor, glow = this.glow, oB = this.offBack, oE = this.offEdge;
    for (let i = 0; i < R2; i++) {
      const si = Math.min(SAMPLES - 1, Math.round((this.rowS[i] / TIE_LENGTH) * (SAMPLES - 1)));
      const cup = C ? C[si] : 0;
      const gl = G ? G[si] : 0;
      const w = Math.min(this.rowW[i], 8) / 8;
      for (let j = 0; j < C2; j++) {
        const u = j / (C2 - 1), q = 1 - (2 * u - 1) * (2 * u - 1);
        const o = (i * C2 + j) * 3;
        const nx = gn[o], ny = gn[o + 1], nz = gn[o + 2];
        const lift = THICK / 2 + 0.1 * w * Math.sqrt(q) - cup * q;
        const back = -THICK / 2 - cup * q;
        const b = (oB + i * C2 + j) * 3;
        pos[o] = g[o] + nx * lift; pos[o + 1] = g[o + 1] + ny * lift; pos[o + 2] = g[o + 2] + nz * lift;
        pos[b] = g[o] + nx * back; pos[b + 1] = g[o + 1] + ny * back; pos[b + 2] = g[o + 2] + nz * back;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
        nor[b] = -nx; nor[b + 1] = -ny; nor[b + 2] = -nz;
        glow[i * C2 + j] = gl; glow[oB + i * C2 + j] = gl;
      }
      // edges: copies of the outermost front/back vertices, facing outwards
      const e = (oE + i * 4) * 3;
      const f0 = (i * C2) * 3, b0 = (oB + i * C2) * 3, f1 = (i * C2 + C2 - 1) * 3, b1 = (oB + i * C2 + C2 - 1) * 3;
      const g0 = (i * C2) * 3, g1 = (i * C2 + 1) * 3, g8 = (i * C2 + C2 - 1) * 3, g7 = (i * C2 + C2 - 2) * 3;
      let ax = g[g0] - g[g1], ay = g[g0 + 1] - g[g1 + 1], az = g[g0 + 2] - g[g1 + 2];
      const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      let bx = g[g8] - g[g7], by = g[g8 + 1] - g[g7 + 1], bz = g[g8 + 2] - g[g7 + 2];
      const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      for (let k = 0; k < 3; k++) {
        pos[e + k] = pos[f0 + k]; pos[e + 3 + k] = pos[b0 + k];
        pos[e + 6 + k] = pos[f1 + k]; pos[e + 9 + k] = pos[b1 + k];
      }
      nor[e] = nor[e + 3] = ax; nor[e + 1] = nor[e + 4] = ay; nor[e + 2] = nor[e + 5] = az;
      nor[e + 6] = nor[e + 9] = bx; nor[e + 7] = nor[e + 10] = by; nor[e + 8] = nor[e + 11] = bz;
      for (let k = 0; k < 4; k++) glow[oE + i * 4 + k] = gl;
    }
    const geo = this.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.aGlow.needsUpdate = true;
  }
}

// Adds a per-vertex emissive "glow" (used to highlight the part that moved).
function addGlow(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = uniforms.uGlow;
    shader.uniforms.uGlowColor = uniforms.uGlowColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nuniform vec3 uGlowColor;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * (vGlow * uGlow);');
  };
  material.customProgramCacheKey = () => 'tie-glow';
}
