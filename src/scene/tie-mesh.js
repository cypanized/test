// A thick, double-faced ribbon mesh driven by a tie pose.
//   group 0: silk front (patterned)   group 1: back (lining, seam, tipping)
//   group 2: the two folded edges
import * as THREE from 'three';
import { SAMPLES, TIE_LENGTH, tieWidth } from '../engine/tie-engine.js';

const ACROSS = 11; // vertices across the blade
const THICK = 0.3; // cm

export class TieMesh {
  constructor({ silk, lining, edge }) {
    const N = SAMPLES, M = ACROSS;
    this.N = N;
    const nFront = N * M, nBack = N * M, nEdge = N * 4;
    const total = nFront + nBack + nEdge;
    this.offBack = nFront;
    this.offEdge = nFront + nBack;

    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    const col = new Float32Array(total * 3).fill(1);
    this.glow = new Float32Array(total);
    this.widths = new Float32Array(N);

    // static attributes: uv + colours
    const L = TIE_LENGTH;
    const period = 9; // cm per texture tile
    for (let i = 0; i < N; i++) {
      const s = (i / (N - 1)) * L;
      const w = tieWidth(s);
      this.widths[i] = w;
      for (let j = 0; j < M; j++) {
        const u = j / (M - 1);
        const f = i * M + j, b = nFront + i * M + j;
        uv[f * 2] = ((u - 0.5) * w) / period; uv[f * 2 + 1] = s / period;
        uv[b * 2] = u; uv[b * 2 + 1] = s / 6;
        // back colours: contrasting tipping at both ends, a cream label near the wide end
        let c = [0.3, 0.34, 0.45];
        const tipping = s < 13 || s > L - 26;
        if (tipping) c = [0.38, 0.08, 0.12];
        if (s > L - 36 && s < L - 31.5 && u > 0.3 && u < 0.7) c = [0.86, 0.8, 0.68];
        if (s > L - 44 && s < L - 41.6) c = [0.18, 0.2, 0.28]; // keeper loop
        col[b * 3] = c[0]; col[b * 3 + 1] = c[1]; col[b * 3 + 2] = c[2];
      }
      for (let e = 0; e < 4; e++) {
        const v = nFront + nBack + i * 4 + e;
        uv[v * 2] = e < 2 ? 0 : 1; uv[v * 2 + 1] = s / period;
      }
    }

    // indices
    const idx = [];
    const quad = (a, b, c, d, flip) => {
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    };
    // front faces along +n (see engine: w = n x T, so (T, w) is right-handed with n)
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < M - 1; j++) {
        const a = i * M + j, b = (i + 1) * M + j, c = i * M + j + 1, d = (i + 1) * M + j + 1;
        quad(a, b, c, d, false);
      }
    }
    const frontCount = idx.length;
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < M - 1; j++) {
        const o = nFront;
        const a = o + i * M + j, b = o + (i + 1) * M + j, c = o + i * M + j + 1, d = o + (i + 1) * M + j + 1;
        quad(a, b, c, d, true);
      }
    }
    const backCount = idx.length - frontCount;
    for (let i = 0; i < N - 1; i++) {
      const o = nFront + nBack;
      // edge at u = 0 : verts 0 (front) 1 (back); edge at u = 1 : verts 2 (front) 3 (back)
      const f0 = o + i * 4, f1 = o + (i + 1) * 4;
      quad(f0 + 0, f1 + 0, f0 + 1, f1 + 1, true);
      quad(f0 + 2, f1 + 2, f0 + 3, f1 + 3, false);
    }
    const edgeCount = idx.length - frontCount - backCount;
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(this.glow, 1).setUsage(THREE.DynamicDrawUsage));
    geo.addGroup(0, frontCount, 0);
    geo.addGroup(frontCount, backCount, 1);
    geo.addGroup(frontCount + backCount, edgeCount, 2);
    this.geometry = geo;

    this.uniforms = { uGlow: { value: 0 }, uGlowColor: { value: new THREE.Color('#ffcf7a') } };
    for (const m of [silk, lining, edge]) addGlow(m, this.uniforms);
    this.mesh = new THREE.Mesh(geo, [silk, lining, edge]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    this._T = new THREE.Vector3(); this._n = new THREE.Vector3(); this._w = new THREE.Vector3();
  }

  /** P: positions, Nn: silk-face normals, C: dimple depth, G: glow per sample */
  update(P, Nn, C, G, pinch) {
    const N = this.N, M = ACROSS;
    const pos = this.pos;
    const T = this._T, n = this._n, w = this._w;
    let pw = null;
    for (let i = 0; i < N; i++) {
      const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, N - 1);
      T.set(P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]).normalize();
      n.set(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]);
      n.addScaledVector(T, -n.dot(T));
      if (n.lengthSq() < 1e-8) n.set(0, 0, 1);
      n.normalize();
      w.crossVectors(n, T).normalize();
      if (pw && w.dot(pw) < 0) w.negate(); // never flip across a sample
      pw = pw || new THREE.Vector3();
      pw.copy(w);

      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const wd = this.widths[i];
      const cup = C ? C[i] : 0;
      const g = G ? G[i] : 0;
      for (let j = 0; j < M; j++) {
        const u = j / (M - 1);
        const x = (u - 0.5) * wd;
        const q = 1 - (2 * u - 1) * (2 * u - 1);
        const bulge = 0.09 * Math.min(wd, 8) / 8 * Math.sqrt(q);
        const dip = cup * q;
        const f = (i * M + j) * 3;
        const fo = THICK / 2 + bulge - dip;
        pos[f] = px + w.x * x + n.x * fo;
        pos[f + 1] = py + w.y * x + n.y * fo;
        pos[f + 2] = pz + w.z * x + n.z * fo;
        const b = (this.offBack + i * M + j) * 3;
        const bo = -THICK / 2 - dip;
        pos[b] = px + w.x * x + n.x * bo;
        pos[b + 1] = py + w.y * x + n.y * bo;
        pos[b + 2] = pz + w.z * x + n.z * bo;
        this.glow[i * M + j] = g;
        this.glow[this.offBack + i * M + j] = g;
      }
      // edges duplicate the outermost front/back vertices
      const e = (this.offEdge + i * 4) * 3;
      const f0 = (i * M) * 3, b0 = (this.offBack + i * M) * 3;
      const f1 = (i * M + M - 1) * 3, b1 = (this.offBack + i * M + M - 1) * 3;
      for (let k = 0; k < 3; k++) {
        pos[e + k] = pos[f0 + k];
        pos[e + 3 + k] = pos[b0 + k];
        pos[e + 6 + k] = pos[f1 + k];
        pos[e + 9 + k] = pos[b1 + k];
      }
      for (let k = 0; k < 4; k++) this.glow[this.offEdge + i * 4 + k] = g;
    }
    if (pinch && pinch[2] > 1e-3) this._pinch(pinch);
    const geo = this.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aGlow.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
}

// Taper the knot: squeeze x towards the centre, more towards the bottom of
// the knot, then let the blade widen out again just below it.
TieMesh.prototype._pinch = function ([y0, y1, k]) {
  const pos = this.pos;
  const fade = 6;
  for (let v = 0; v < pos.length; v += 3) {
    const y = pos[v + 1];
    if (y > y0 || y < y1 - fade) continue;
    let t;
    if (y >= y1) { t = (y0 - y) / (y0 - y1); t = t * t * (3 - 2 * t); }
    else { t = 1 - (y1 - y) / fade; t = t * t; }
    pos[v] *= 1 - k * t;
  }
};

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
