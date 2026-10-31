// The 3D stage: renderer, lights, camera moves, the tie and the guide arrows.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SAMPLES } from '../engine/tie-engine.js';
import { buildMannequin } from './mannequin.js';
import { TieMesh } from './tie-mesh.js';
import { stripeTexture, liningTexture, dashTexture } from './textures.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Spherical interpolation between two unit vectors stored at a[o], b[o].
// Opposite vectors turn through "towards you" (+z), like fabric folding over.
function slerp(a, b, o, k, out) {
  const ax = a[o], ay = a[o + 1], az = a[o + 2], bx = b[o], by = b[o + 1], bz = b[o + 2];
  let dot = ax * bx + ay * by + az * bz;
  if (dot > 0.9995) {
    const x = ax + (bx - ax) * k, y = ay + (by - ay) * k, z = az + (bz - az) * k;
    const l = Math.hypot(x, y, z) || 1;
    out[0] = x / l; out[1] = y / l; out[2] = z / l;
    return;
  }
  if (dot < -0.995) {
    // rotate a about an axis perpendicular to it, through +z where possible
    let ux = ay * 1 - az * 0, uy = az * 0 - ax * 1, uz = 0; // a x z
    let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = 1; uy = 0; uz = 0; ul = 1; }
    ux /= ul; uy /= ul; uz /= ul;
    const ang = Math.PI * k, c = Math.cos(ang), s = Math.sin(ang);
    // Rodrigues
    const cx = uy * az - uz * ay, cy = uz * ax - ux * az, cz = ux * ay - uy * ax;
    const d2 = ux * ax + uy * ay + uz * az;
    out[0] = ax * c + cx * s + ux * d2 * (1 - c);
    out[1] = ay * c + cy * s + uy * d2 * (1 - c);
    out[2] = az * c + cz * s + uz * d2 * (1 - c);
    return;
  }
  dot = Math.min(1, Math.max(-1, dot));
  const th = Math.acos(dot), st = Math.sin(th);
  const wa = Math.sin((1 - k) * th) / st, wb = Math.sin(k * th) / st;
  out[0] = ax * wa + bx * wb; out[1] = ay * wa + by * wb; out[2] = az * wa + bz * wb;
}

export const VIEWS = {
  full: { target: [0, -31, 0], dist: 190, elev: 5 },
  knot: { target: [0, -8.5, 0.5], dist: 92, elev: 10 },
  collar: { target: [0, -6, 0], dist: 70, elev: 8 },
  finish: { target: [0, -20, 0], dist: 150, elev: 6 },
  hero: { target: [-27, -17, 0], dist: 132, elev: 8, az: 24 },
  heroTall: { target: [0, -24, 0], dist: 120, elev: 8, az: 20 },
};

export class Stage {
  constructor(canvas, { onFrame } = {}) {
    this.canvas = canvas;
    this.onFrame = onFrame;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;

    // everything that flips for "front view" lives in root
    this.root = new THREE.Group();
    scene.add(this.root);

    const hemi = new THREE.HemisphereLight(0xe3e9f6, 0x2a2420, 0.5);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff0dd, 2.4);
    key.position.set(-38, 62, 78);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -70; sc.near = 20; sc.far = 260;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 4;
    key.target.position.set(0, -30, 0);
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xa9bfff, 1.6);
    rim.position.set(55, 30, -70);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(60, -10, 60);
    scene.add(fill);

    const { group } = buildMannequin();
    this.root.add(group);

    // tie
    const stripes = stripeTexture();
    stripes.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const silk = new THREE.MeshPhysicalMaterial({
      map: stripes, roughness: 0.56, metalness: 0, sheen: 0.65, sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x8ea3d8), specularIntensity: 0.3, envMapIntensity: 0.35,
    });
    const lining = new THREE.MeshStandardMaterial({ map: liningTexture(), vertexColors: true, roughness: 0.62 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x1a2747, roughness: 0.5 });
    this.tie = new TieMesh({ silk, lining, edge });
    this.root.add(this.tie.mesh);

    // guide arrows (a visible pass + an x-ray pass for parts hidden behind the tie)
    this.dash = dashTexture();
    this.dash.repeat.set(10, 1);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, alphaMap: this.dash, depthWrite: false });
    this.arrowXray = new THREE.MeshBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0, alphaMap: this.dash, depthWrite: false, depthFunc: THREE.GreaterDepth });
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, depthWrite: false });
    this.headXray = new THREE.MeshBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0, depthWrite: false, depthFunc: THREE.GreaterDepth });
    this.arrowGroup = new THREE.Group();
    this.arrowGroup.renderOrder = 10;
    this.root.add(this.arrowGroup);
    this.arrowOpacity = 0;

    // camera
    const camera = new THREE.PerspectiveCamera(26, 1, 1, 2000);
    this.camera = camera;
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 32;
    controls.maxDistance = 300;
    controls.minPolarAngle = THREE.MathUtils.degToRad(48);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(118);
    controls.minAzimuthAngle = THREE.MathUtils.degToRad(-80);
    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(80);
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    this.controls = controls;
    controls.addEventListener('start', () => { this.camTween = null; this.userMoved = true; });

    // pose state
    const n = SAMPLES * 3;
    this.cur = { P: new Float32Array(n), N: new Float32Array(n), C: new Float32Array(SAMPLES), pinch: [0, -4, 0] };
    this.from = null; this.to = null; this.swing = null;
    this.glow = new Float32Array(SAMPLES);
    this.glowTarget = new Float32Array(SAMPLES);
    this.t = 1; this.dur = 1.6;
    this.highlight = true;
    this.mirror = true;
    this.clock = new THREE.Timer();
    this.time = 0;

    this.setView('knot', false);
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the framing readable on tall/narrow screens
    this.fovScale = clamp(1 / Math.min(1, (w / h) / 0.75), 1, 1.9);
    this.camera.updateProjectionMatrix();
  }

  setMirror(mirror) {
    this.mirror = mirror;
    this.root.scale.x = mirror ? 1 : -1;
  }

  /** Jump or glide the camera to one of the named framings. */
  setView(name, animate = true) {
    if (name === 'hero' && this.camera.aspect < 0.9) name = 'heroTall';
    const v = VIEWS[name] || VIEWS.knot;
    const target = new THREE.Vector3(...v.target);
    const dist = v.dist * (this.fovScale || 1);
    const az = THREE.MathUtils.degToRad((v.az ?? 14) * (this.mirror ? -1 : 1));
    const el = THREE.MathUtils.degToRad(v.elev);
    const pos = new THREE.Vector3(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az));
    this.viewName = name;
    if (!animate) {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.camTween = null;
      this.controls.update();
      return;
    }
    this.camTween = {
      t: 0, dur: 1.5,
      fromT: this.controls.target.clone(), toT: target,
      fromP: this.camera.position.clone(), toP: pos,
    };
  }

  /**
   * Show a pose, either instantly or as an animated move from the current one.
   * `swing`: 'front' lifts the moving blade towards you as it goes round,
   * 'back' eases the knot forward so the blade can pass behind it.
   */
  showPose(pose, { animate = true, swing = null, glow = true, duration = 1.6 } = {}) {
    if (!this.to || !animate) {
      this.cur.P.set(pose.P); this.cur.N.set(pose.N); this.cur.C.set(pose.C);
      this.cur.pinch = pose.pinch.slice();
      this.from = null; this.to = pose; this.t = 1;
      this.glowTarget.fill(0);
      this.glow.fill(0);
      this._apply();
      return;
    }
    this.from = { P: this.cur.P.slice(), N: this.cur.N.slice(), C: this.cur.C.slice(), pinch: this.cur.pinch.slice() };
    this.to = pose;
    this.swing = swing;
    this._prepSwing(this.from, pose);
    this.t = 0;
    this.dur = duration;
    // glow follows whatever part of the tie moves the most
    let maxD = 0;
    const d = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const dx = pose.P[i * 3] - this.from.P[i * 3], dy = pose.P[i * 3 + 1] - this.from.P[i * 3 + 1], dz = pose.P[i * 3 + 2] - this.from.P[i * 3 + 2];
      d[i] = Math.hypot(dx, dy, dz);
      maxD = Math.max(maxD, d[i]);
    }
    for (let i = 0; i < SAMPLES; i++) this.glowTarget[i] = glow && maxD > 0.5 ? clamp((d[i] / maxD - 0.18) * 1.6, 0, 1) : 0;
    this.moveW = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) this.moveW[i] = maxD > 0 ? clamp(d[i] / (maxD * 0.6), 0, 1) : 0;
  }

  // Precompute segment directions/lengths for both poses. During a move we
  // rotate each little segment from its old direction to its new one and
  // re-chain them from the back of the neck, so the tie swings like real
  // fabric and keeps its length instead of cutting straight through itself.
  _prepSwing(A, B) {
    const n = SAMPLES;
    const seg = (P) => {
      const d = new Float32Array(n * 3), l = new Float32Array(n);
      for (let i = 0; i < n - 1; i++) {
        const x = P[i * 3 + 3] - P[i * 3], y = P[i * 3 + 4] - P[i * 3 + 1], z = P[i * 3 + 5] - P[i * 3 + 2];
        const len = Math.hypot(x, y, z) || 1e-6;
        d[i * 3] = x / len; d[i * 3 + 1] = y / len; d[i * 3 + 2] = z / len; l[i] = len;
      }
      return { d, l };
    };
    this.sA = seg(A.P); this.sB = seg(B.P);
    this.anchor = B.anchor ?? Math.floor(n / 2);
  }

  _swingPositions(k) {
    const n = SAMPLES, P = this.cur.P, A = this.from, B = this.to;
    const { d: dA, l: lA } = this.sA, { d: dB, l: lB } = this.sB;
    const dir = this._dir || (this._dir = new Float32Array(n * 3));
    const tmp = [0, 0, 0];
    for (let i = 0; i < n - 1; i++) {
      slerp(dA, dB, i * 3, k, tmp);
      dir[i * 3] = tmp[0]; dir[i * 3 + 1] = tmp[1]; dir[i * 3 + 2] = tmp[2];
    }
    const a = this.anchor;
    for (let c = 0; c < 3; c++) P[a * 3 + c] = A.P[a * 3 + c] + (B.P[a * 3 + c] - A.P[a * 3 + c]) * k;
    for (let i = a; i < n - 1; i++) {
      const l = lA[i] + (lB[i] - lA[i]) * k;
      for (let c = 0; c < 3; c++) P[(i + 1) * 3 + c] = P[i * 3 + c] + dir[i * 3 + c] * l;
    }
    for (let i = a - 1; i >= 0; i--) {
      const l = lA[i] + (lB[i] - lA[i]) * k;
      for (let c = 0; c < 3; c++) P[i * 3 + c] = P[(i + 1) * 3 + c] - dir[i * 3 + c] * l;
    }
    // re-chaining drifts a little; blend it out so we land exactly on both ends
    const e = Math.sin(Math.PI * k);
    for (let i = 0; i < n * 3; i++) {
      const lin = A.P[i] + (B.P[i] - A.P[i]) * k;
      P[i] = lin + (P[i] - lin) * e;
    }
    // swing the moving blade clear of the knot
    if (this.swing) {
      const ky = this.to.meta?.P?.K?.y ?? -8;
      for (let i = 0; i < n; i++) {
        const w = this.moveW[i];
        let dz;
        if (this.swing === 'front') dz = 4.2 * w * e;
        else {
          const near = Math.max(0, 1 - Math.abs(P[i * 3 + 1] - ky) / 14);
          dz = (2.6 * (1 - w) * near - 0.6 * w) * e;
        }
        P[i * 3 + 2] += dz;
      }
    }
  }

  setArrow(points) {
    for (const c of [...this.arrowGroup.children]) { this.arrowGroup.remove(c); c.geometry.dispose(); }
    this.arrowPoints = points;
    if (!points) return;
    const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()), false, 'centripetal');
    const len = curve.getLength();
    const tube = new THREE.TubeGeometry(curve, Math.max(24, Math.round(len * 3)), 0.24, 10, false);
    this.dash.repeat.set(Math.max(2, Math.round(len / 1.6)), 1);
    const a = new THREE.Mesh(tube, this.arrowMat);
    const b = new THREE.Mesh(tube, this.arrowXray);
    a.renderOrder = 10; b.renderOrder = 9;
    // arrow head
    const end = curve.getPointAt(1), dir = curve.getTangentAt(1);
    const headGeo = new THREE.ConeGeometry(0.85, 2.0, 20);
    headGeo.translate(0, -1.0, 0);
    const h1 = new THREE.Mesh(headGeo, this.headMat);
    const h2 = new THREE.Mesh(headGeo, this.headXray);
    for (const h of [h1, h2]) {
      h.position.copy(end).addScaledVector(dir, 1.6);
      h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      h.renderOrder = 10;
    }
    this.arrowGroup.add(b, a, h2, h1);
    this.arrowOpacity = 0;
  }

  _apply() {
    this.tie.update(this.cur.P, this.cur.N, this.cur.C, this.glow, this.cur.pinch);
  }

  _loop() {
    requestAnimationFrame(this._loop);
    if (this.paused) { this.clock.update(); return; }
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    // pose transition
    if (this.from && this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const k = ease(this.t);
      const A = this.from, B = this.to;
      const N = this.cur.N, C = this.cur.C;
      this._swingPositions(k);
      const tmp = [0, 0, 0];
      for (let i = 0; i < SAMPLES; i++) {
        slerp(A.N, B.N, i * 3, k, tmp);
        N[i * 3] = tmp[0]; N[i * 3 + 1] = tmp[1]; N[i * 3 + 2] = tmp[2];
      }
      for (let i = 0; i < SAMPLES; i++) C[i] = A.C[i] + (B.C[i] - A.C[i]) * k;
      for (let i = 0; i < 3; i++) this.cur.pinch[i] = A.pinch[i] + (B.pinch[i] - A.pinch[i]) * k;
      if (this.t >= 1) this.from = null;
    }
    // glow: rise during the move, then breathe softly
    const moving = !!this.from;
    const pulse = moving ? 1 : 0.5 + 0.3 * Math.sin(this.time * 2.4);
    let glowChanged = false;
    for (let i = 0; i < SAMPLES; i++) {
      const target = this.highlight ? this.glowTarget[i] : 0;
      const g = this.glow[i] + (target - this.glow[i]) * Math.min(1, dt * 4);
      if (Math.abs(g - this.glow[i]) > 1e-4) glowChanged = true;
      this.glow[i] = g;
    }
    this.tie.uniforms.uGlow.value = 0.09 * pulse;
    if (moving || glowChanged) this._apply();

    // arrows: fade in after the move starts, dashes flow along the path
    const want = this.arrowPoints && this.showArrows !== false ? 1 : 0;
    this.arrowOpacity += (want - this.arrowOpacity) * Math.min(1, dt * 3);
    this.dash.offset.x -= dt * 1.2;
    this.arrowMat.opacity = 0.95 * this.arrowOpacity;
    this.headMat.opacity = 0.95 * this.arrowOpacity;
    this.arrowXray.opacity = 0.4 * this.arrowOpacity;
    this.headXray.opacity = 0.4 * this.arrowOpacity;

    // camera glide
    if (this.camTween) {
      const tw = this.camTween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      this.controls.target.lerpVectors(tw.fromT, tw.toT, k);
      this.camera.position.lerpVectors(tw.fromP, tw.toP, k);
      if (tw.t >= 1) this.camTween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onFrame) this.onFrame(dt);
  }

  get isAnimating() { return !!this.from || !!this.camTween; }

  /** Jump to the end of any running move or camera glide. */
  finishAnimations() {
    if (this.from) { this.t = 0.9999; }
    if (this.camTween) this.camTween.t = 0.9999;
  }
}
