// Dress form wearing a shirt, collar, belt and trousers. Built from the same
// measurements the tie engine uses (engine/body.js), so the tie rests on it.
import * as THREE from 'three';
import { NECK, COLLAR, BELT, BUTTONS_Y, torsoSection, chestZ, SUPER_P, collarLeafSurface } from '../engine/body.js';
import { oxfordTexture, linenTexture } from './textures.js';

const TAU = Math.PI * 2;
const sgnPow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function torsoPoint(y, phi, grow = 0) {
  const { a, b, zc } = torsoSection(y);
  const e = 2 / SUPER_P;
  return new THREE.Vector3((a + grow) * sgnPow(Math.sin(phi), e), y, zc + (b + grow) * sgnPow(Math.cos(phi), e));
}

function torsoGeometry(y0, y1, grow, uvScale) {
  const ys = [];
  for (let y = y0; y > y1; y -= y > -14 ? 0.5 : 1.25) ys.push(y);
  ys.push(y1);
  const cols = 144;
  const pos = [], uv = [], idx = [];
  ys.forEach((y, r) => {
    for (let c = 0; c <= cols; c++) {
      const phi = (c / cols) * TAU;
      const p = torsoPoint(y, phi, grow);
      pos.push(p.x, p.y, p.z);
      uv.push((c / cols) * uvScale * 4, y / uvScale * 0.6);
    }
  });
  const W = cols + 1;
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * W + c, b = r * W + c + 1, d = (r + 1) * W + c, e = (r + 1) * W + c + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A strip lying on the shirt front between x0..x1 (used for the placket).
function frontStrip(x0, x1, y0, y1, lift) {
  const pos = [], idx = [], uv = [];
  const ys = [];
  for (let y = y0; y > y1; y -= 0.6) ys.push(y);
  ys.push(y1);
  const xs = [x0, (x0 + x1) / 2, x1];
  ys.forEach((y, r) => xs.forEach((x, c) => {
    pos.push(x, y, chestZ(x, y) + lift);
    uv.push(c / 2, y / 8);
  }));
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < 2; c++) {
      const a = r * 3 + c, b = a + 1, d = a + 3, e = a + 4;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Collar stand: a band around the neck, lower at the front.
function bandGeometry() {
  const pos = [], idx = [];
  const cols = 120, rows = 6;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const th = (c / cols) * TAU;
      const k = (1 - Math.cos(th)) / 2;
      const yb = -0.55 + 1.5 * k, yt = 3.45 + 1.6 * k;
      const y = lerp(yb, yt, r / rows);
      const rad = COLLAR.bandR + 0.05 * Math.sin((r / rows) * Math.PI);
      pos.push(rad * Math.sin(th), y, NECK.z + rad * Math.cos(th));
    }
  }
  const W = cols + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Collar leaf: folds over the top of the band, covers the tie, ends in two points.
function leafGeometry() {
  const { pos, uv, idx } = collarLeafSurface(150, 26);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

function buckleGeometry() {
  const s = new THREE.Shape();
  const w = 6.0, h = 4.3, r = 0.6;
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const hole = new THREE.Path();
  const hw = 4.3, hh = 2.6;
  hole.moveTo(-hw / 2, -hh / 2); hole.lineTo(hw / 2, -hh / 2); hole.lineTo(hw / 2, hh / 2); hole.lineTo(-hw / 2, hh / 2); hole.lineTo(-hw / 2, -hh / 2);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 6 });
}

export function buildMannequin() {
  const group = new THREE.Group();
  const weave = oxfordTexture();
  weave.repeat.set(1, 1);
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xd9e0ea, roughness: 0.9, metalness: 0, map: weave, bumpMap: weave, bumpScale: 0.6,
  });
  const collarMat = shirtMat.clone();
  collarMat.side = THREE.DoubleSide;
  collarMat.color = new THREE.Color(0xe4e9f0);

  const shirt = new THREE.Mesh(torsoGeometry(1.5, BELT.top + 0.6, 0, 3), shirtMat);
  shirt.receiveShadow = true; shirt.castShadow = true;
  group.add(shirt);

  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2b1a12, roughness: 0.55, metalness: 0.05 });
  const belt = new THREE.Mesh(torsoGeometry(BELT.top, BELT.bottom, 0.35, 3), beltMat);
  belt.receiveShadow = true;
  group.add(belt);

  const trouserMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.95, map: linenTexture(), bumpMap: weave, bumpScale: 0.3 });
  trouserMat.map.repeat.set(3, 3);
  const trousers = new THREE.Mesh(torsoGeometry(BELT.top + 0.4, -104, 0.15, 3), trouserMat);
  trousers.receiveShadow = true;
  group.add(trousers);

  const metal = new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.28, metalness: 1 });
  const buckle = new THREE.Mesh(buckleGeometry(), metal);
  const by = (BELT.top + BELT.bottom) / 2;
  buckle.position.set(0, by, chestZ(0, by) + 0.4);
  buckle.castShadow = true;
  group.add(buckle);
  const prong = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.5), metal);
  prong.position.set(0, by, chestZ(0, by) + 0.65);
  group.add(prong);

  // placket and buttons
  const placketMat = shirtMat.clone();
  placketMat.color = new THREE.Color(0xe0e6ee);
  const placket = new THREE.Mesh(frontStrip(-1.75, 1.75, -0.4, BELT.top + 0.6, 0.06), placketMat);
  placket.receiveShadow = true;
  group.add(placket);
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.25, metalness: 0 });
  const buttonGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.22, 24);
  buttonGeo.rotateX(Math.PI / 2);
  for (const y of BUTTONS_Y) {
    const b = new THREE.Mesh(buttonGeo, buttonMat);
    b.position.set(0, y, chestZ(0, y) + 0.2);
    b.castShadow = true;
    group.add(b);
  }
  const collarButton = new THREE.Mesh(buttonGeo, buttonMat);
  collarButton.position.set(0, 1.45, NECK.z + COLLAR.bandR + 0.12);
  group.add(collarButton);

  // neck of the dress form, with a walnut cap
  const linen = new THREE.MeshStandardMaterial({ color: 0xc9b694, roughness: 0.95, map: linenTexture(), bumpMap: linenTexture(), bumpScale: 0.4 });
  linen.map.repeat.set(3, 2);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(5.55, NECK.r, NECK.top + 1, 64, 1, true), linen);
  neck.position.set(0, (NECK.top - 1) / 2, NECK.z);
  neck.castShadow = true; neck.receiveShadow = true;
  group.add(neck);
  const walnut = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.38, metalness: 0.05 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.75, 1.4, 64), walnut);
  cap.position.set(0, NECK.top + 0.2, NECK.z);
  cap.castShadow = true;
  group.add(cap);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.45, 32, 16), walnut);
  knob.position.set(0, NECK.top + 2.2, NECK.z);
  group.add(knob);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 1.4, 24), walnut);
  stem.position.set(0, NECK.top + 1.2, NECK.z);
  group.add(stem);

  // collar
  const band = new THREE.Mesh(bandGeometry(), collarMat);
  band.castShadow = true; band.receiveShadow = true;
  group.add(band);
  const leaf = new THREE.Mesh(leafGeometry(), collarMat);
  leaf.castShadow = true; leaf.receiveShadow = true;
  group.add(leaf);

  // floor far below: only really seen in "your view", when you look down
  const fc = document.createElement('canvas');
  fc.width = fc.height = 256;
  const fg = fc.getContext('2d');
  const grad = fg.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(58,46,38,1)');
  grad.addColorStop(0.55, 'rgba(34,28,26,0.9)');
  grad.addColorStop(1, 'rgba(11,13,18,0)');
  fg.fillStyle = grad;
  fg.fillRect(0, 0, 256, 256);
  const floorTex = new THREE.CanvasTexture(fc);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(150, 64), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -125, 10);
  group.add(floor);

  return { group, leaf, band };
}
