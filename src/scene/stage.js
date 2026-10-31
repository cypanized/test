// The 3D stage: renderer, lights, cameras, the tie and the guide arrows.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMannequin } from './mannequin.js';
import { TieMesh } from './tie-mesh.js';
import { Player } from '../sim/player.js';
import { SAMPLES } from '../engine/tie-engine.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
import { stripeTexture, liningTexture, dashTexture } from './textures.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const DEG = Math.PI / 180;

// Orbit framings, used for the mirror and facing-you views.
export const VIEWS = {
  full: { target: [0, -31, 0], dist: 190, elev: 5 },
  knot: { target: [0, -8.5, 0.5], dist: 92, elev: 10 },
  collar: { target: [0, -6, 0], dist: 70, elev: 8 },
  finish: { target: [0, -20, 0], dist: 150, elev: 6 },
  hero: { target: [-27, -17, 0], dist: 132, elev: 8, az: 24 },
  heroTall: { target: [0, -24, 0], dist: 120, elev: 8, az: 20 },
};

// "Your view": looking down at your own chest. The eye is where a wearer's
// eyes would be, a little in front of the throat; only the gaze moves.
export const POV_EYE = [0, 14, 10.5];
export const POV_LOOK = {
  full: [0, -14, 1.5],
  knot: [0, -6.5, 2],
  collar: [0, -3.5, 1],
  finish: [0, -12, 1.5],
  hero: [0, -6.5, 2],
  heroTall: [0, -6.5, 2],
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

    // everything that flips for the facing-you view lives in root
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
    this.player = new Player();
    // per-pose extras the cloth doesn't simulate: knot taper and dimple
    this.look2 = { C: new Float32Array(SAMPLES), pinch: [0, -4, 0] };
    this.glow = new Float32Array(SAMPLES);
    this.glowTarget = new Float32Array(SAMPLES);
    this.highlight = true;

    // guide arrows (a visible pass + an x-ray pass for parts hidden behind the tie)
    this.dash = dashTexture();
    this.dash.repeat.set(10, 1);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, alphaMap: this.dash, depthWrite: false });
    this.arrowXray = new THREE.MeshBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0, alphaMap: this.dash, depthWrite: false, depthFunc: THREE.GreaterDepth });
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0, depthWrite: false });
    this.headXray = new THREE.MeshBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0, depthWrite: false, depthFunc: THREE.GreaterDepth });
    // a soft ring showing where the (invisible) hand is feeding the blade
    this.hand = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.45, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.hand.renderOrder = 20;
    this.root.add(this.hand);
    this.handOpacity = 0;
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
    controls.minPolarAngle = 48 * DEG;
    controls.maxPolarAngle = 118 * DEG;
    controls.minAzimuthAngle = -80 * DEG;
    controls.maxAzimuthAngle = 80 * DEG;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    this.controls = controls;
    controls.addEventListener('start', () => { this.camTween = null; this.userMoved = true; });
    this._povInput();

    this.mode = 'mirror';
    this.fov = 26;
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

  /** 'mirror' (default), 'front' (as someone facing you sees it) or 'pov' (your own eyes). */
  setMode(mode) {
    this.mode = mode;
    this.root.scale.x = mode === 'front' ? -1 : 1;
    this.controls.enabled = mode !== 'pov';
    this.setView(this.viewName || 'knot', true);
  }

  get mirror() { return this.mode !== 'front'; }
  setMirror(m) { this.setMode(m ? 'mirror' : 'front'); }

  /** Glide (or jump) the camera to a named framing in the current mode. */
  setView(name, animate = true) {
    this.viewName = name;
    let target, pos, fov;
    if (this.mode === 'pov') {
      pos = new THREE.Vector3(...POV_EYE);
      target = new THREE.Vector3(...(POV_LOOK[name] || POV_LOOK.knot));
      fov = this.camera.aspect < 0.8 ? 64 : 52;
      this.look = { yaw: 0, pitch: 0, base: target.clone() };
    } else {
      if (name === 'hero' && this.camera.aspect < 0.9) name = 'heroTall';
      const v = VIEWS[name] || VIEWS.knot;
      target = new THREE.Vector3(...v.target);
      const dist = v.dist * (this.fovScale || 1);
      const az = (v.az ?? 14) * (this.mode === 'front' ? 1 : -1) * DEG;
      const el = v.elev * DEG;
      pos = new THREE.Vector3(
        target.x + dist * Math.cos(el) * Math.sin(az),
        target.y + dist * Math.sin(el),
        target.z + dist * Math.cos(el) * Math.cos(az));
      fov = 26;
    }
    if (!animate) {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this._setFov(fov);
      this.camTween = null;
      if (this.mode === 'pov') this.camera.lookAt(target);
      else this.controls.update();
      return;
    }
    this.camTween = {
      t: 0, dur: 1.5,
      fromT: this.controls.target.clone(), toT: target,
      fromP: this.camera.position.clone(), toP: pos,
      fromF: this.fov, toF: fov,
    };
  }

  _setFov(f) {
    this.fov = f;
    this.camera.fov = f;
    this.camera.updateProjectionMatrix();
  }

  // In "your view" you can glance around (drag) and lean in (scroll), but the
  // eye stays put: that's where your head is.
  _povInput() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'pov') return;
      drag = { x: e.clientX, y: e.clientY, yaw: this.look?.yaw || 0, pitch: this.look?.pitch || 0 };
      c.setPointerCapture(e.pointerId);
      this.camTween = null;
      this.userMoved = true;
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag || this.mode !== 'pov' || !this.look) return;
      const k = 0.18;
      this.look.yaw = clamp(drag.yaw - (e.clientX - drag.x) * k, -35, 35);
      this.look.pitch = clamp(drag.pitch + (e.clientY - drag.y) * k, -25, 30);
      this._applyLook();
    });
    const end = () => { drag = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      if (this.mode !== 'pov') return;
      e.preventDefault();
      this._setFov(clamp(this.fov + e.deltaY * 0.03, 30, 70));
    }, { passive: false });
  }

  _applyLook() {
    const eye = new THREE.Vector3(...POV_EYE);
    const dir = this.look.base.clone().sub(eye);
    const len = dir.length();
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    dir.applyAxisAngle(right, this.look.pitch * DEG).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.look.yaw * DEG);
    this.controls.target.copy(eye).addScaledVector(dir, len);
  }

  /** Use a knot's baked cloth animation (BakedKnot). */
  setBaked(baked) {
    this.player.setKnot(baked);
  }

  /**
   * Show the tie at a step: jump there, or play the baked move into it
   * (reverse = play the move into `chapter` backwards, i.e. undo it).
   * `pose` supplies the knot taper and dimple for the destination.
   */
  showStep(chapter, { play = false, reverse = false, pose = null, glow = true } = {}) {
    const p = this.player;
    if (play) p.play(chapter, { reverse }); else p.show(chapter);
    this._fromLook = { C: this.look2.C.slice(), pinch: this.look2.pinch.slice() };
    this._toLook = pose ? { C: pose.C, pinch: pose.pinch } : this._fromLook;
    if (!play) this._setLook(1);
    // glow on whatever moved during this chapter
    this.glowTarget.fill(0);
    if (play && glow) {
      const f = p.knot.chapter(chapter), A = f[0], B = f[f.length - 1];
      const rows = p.knot.meta.rows, cols = p.knot.meta.cols;
      let maxD = 0;
      const d = new Float32Array(rows);
      for (let i = 0; i < rows; i++) {
        const q = (i * cols + 2) * 3;
        d[i] = Math.hypot(B[q] - A[q], B[q + 1] - A[q + 1], B[q + 2] - A[q + 2]);
        maxD = Math.max(maxD, d[i]);
      }
      for (let s = 0; s < SAMPLES; s++) {
        const i = Math.round((s / (SAMPLES - 1)) * (rows - 1));
        this.glowTarget[s] = maxD > 0.5 ? clamp((d[i] / maxD - 0.15) * 1.6, 0, 1) : 0;
      }
    } else this.glow.fill(0);
    this._apply();
  }

  _setLook(k) {
    const A = this._fromLook, B = this._toLook, L = this.look2;
    for (let i = 0; i < SAMPLES; i++) L.C[i] = A.C[i] + (B.C[i] - A.C[i]) * k;
    for (let i = 0; i < 3; i++) L.pinch[i] = A.pinch[i] + (B.pinch[i] - A.pinch[i]) * k;
  }

  /** Fast-forward the current move (used for screenshots and tests). */
  settleNow() {
    this.player.finish();
    this._setLook(1);
    this._apply();
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
    if (!this.player.out) return;
    this.tie.update(this.player.out, this.look2.C, this.glow, this.look2.pinch);
  }

  _loop() {
    requestAnimationFrame(this._loop);
    this.clock.update();
    if (this.paused) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    let changed = this.player.update(dt);
    if (changed && this._toLook) this._setLook(ease(this.player.progress));
    for (let i = 0; i < SAMPLES; i++) {
      const target = this.highlight ? this.glowTarget[i] : 0;
      const g = this.glow[i] + (target - this.glow[i]) * Math.min(1, dt * 4);
      if (Math.abs(g - this.glow[i]) > 1e-4) changed = true;
      this.glow[i] = g;
    }
    if (changed) this._apply();
    // the hand marker follows the gripped row while a move plays
    const row = this.player.handRow;
    const wantHand = row >= 0 && this.highlight ? 0.75 : 0;
    this.handOpacity += (wantHand - this.handOpacity) * Math.min(1, dt * 6);
    this.hand.material.opacity = this.handOpacity * (0.75 + 0.25 * Math.sin(this.time * 6));
    this.hand.visible = this.handOpacity > 0.02;
    if (row >= 0 && this.player.out) {
      const cols = this.player.knot.meta.cols, q = (row * cols + Math.floor(cols / 2)) * 3, o = this.player.out;
      this.hand.position.set(o[q], o[q + 1], o[q + 2]);
      this.hand.quaternion.copy(this.camera.quaternion);
      if (this.root.scale.x < 0) this.hand.scale.set(-1, 1, 1); else this.hand.scale.set(1, 1, 1);
    }
    // the part that just moved breathes softly
    this.tie.uniforms.uGlow.value = 0.09 * (this.player.playing ? 1 : 0.5 + 0.3 * Math.sin(this.time * 2.4));

    // arrows: fade in, dashes flow along the path
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
      if (tw.fromF !== tw.toF) this._setFov(tw.fromF + (tw.toF - tw.fromF) * k);
      if (tw.t >= 1) this.camTween = null;
    }
    // (orbit limits don't apply to your own eyes, so steer the camera directly)
    if (this.mode === 'pov') this.camera.lookAt(this.controls.target);
    else this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onFrame) this.onFrame(dt);
  }

  get isAnimating() { return this.player.playing || !!this.camTween; }

  /** Jump to the end of any running move or camera glide. */
  finishAnimations() {
    this.settleNow();
    if (this.camTween) this.camTween.t = 0.9999;
  }
}
