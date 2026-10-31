import { Vector3 } from 'three';
import { Stage } from './scene/stage.js';
import { KNOTS, statesFor, viewFor } from './knots.js';
import { buildPose, arrowPath } from './engine/tie-engine.js';
import { KnotMap } from './ui/knotmap.js';
import { BakedKnot, playSeconds } from './sim/player.js';
import * as bakedFourInHand from './baked/four-in-hand.js';
import * as bakedHalfWindsor from './baked/half-windsor.js';
import * as bakedWindsor from './baked/windsor.js';

// Pre-simulated (and intersection-checked) cloth for every step of every knot.
const BAKED = { 'four-in-hand': bakedFourInHand, 'half-windsor': bakedHalfWindsor, windsor: bakedWindsor };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MOVE_TEXT = {
  L: 'to your left', R: 'to your right', C: 'up to the centre',
  i: 'over the front', o: 'underneath',
};

const app = {
  knot: 0,
  step: 0,
  mode: 'mirror', // 'mirror' | 'pov' (your own eyes) | 'front' (someone facing you)
  arrows: true,
  playing: false,
  started: false,
  stage: null,
  poses: new Map(),
};

// ---------------------------------------------------------------------------
// Poses (computed lazily, cached)

function knotObj(i = app.knot) { return KNOTS[i]; }
function states(i = app.knot) { return statesFor(KNOTS[i]); }

const bakedCache = new Map();
function baked(ki = app.knot) {
  const id = KNOTS[ki].id;
  if (!bakedCache.has(id)) bakedCache.set(id, new BakedKnot(BAKED[id].meta, BAKED[id].data));
  return bakedCache.get(id);
}

function ensureLength(knot) {
  if (!knot.narrowLen) knot.narrowLen = BAKED[knot.id].meta.narrowLen;
}

// The guide arrow is the path the hand actually took in the simulation.
function arrowFor(ki, step) {
  const route = BAKED[KNOTS[ki].id].meta.routes?.[step];
  if (route) return route.map(([x, y, z]) => new Vector3(x, y, z));
  const st = statesFor(KNOTS[ki])[step];
  return st.kind === 'tight' ? arrowPath(KNOTS[ki], st) : null;
}

function chapterSeconds(ki, step) {
  const m = BAKED[KNOTS[ki].id].meta;
  const c = m.chapters[step];
  return c ? playSeconds(c.frames, m.fps) : 0;
}

function pose(ki, si) {
  const key = ki + ':' + si;
  if (!app.poses.has(key)) {
    const knot = KNOTS[ki];
    ensureLength(knot);
    app.poses.set(key, buildPose(knot, statesFor(knot)[si]));
  }
  return app.poses.get(key);
}

// ---------------------------------------------------------------------------
// Rendering the step

function pad(n) { return String(n).padStart(2, '0'); }

function moveChip(knot, st) {
  if (st.kind === 'drape') return '<b>Start</b> drape';
  if (st.kind === 'tight') return '<b>Snug</b> slide up';
  if (st.kind === 'finish') return '<b>Finish</b> dimple &amp; length';
  const m = knot.moves[st.k - 1];
  if (m === 'T') return '<b>T</b> tuck through the front';
  return `<b>${m}</b> ${MOVE_TEXT[m[1]]} · ${MOVE_TEXT[m[0]]}`;
}

function renderTabs() {
  const tabs = $('#tabs');
  tabs.replaceChildren();
  KNOTS.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'knot-tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === app.knot));
    b.innerHTML = `<span class="tab-name">${k.name}</span><span class="pips" aria-label="Difficulty ${k.level} of 3">${[1, 2, 3].map((p) => `<i class="${p <= k.level ? 'on' : ''}"></i>`).join('')}</span>`;
    b.addEventListener('click', () => selectKnot(i));
    tabs.appendChild(b);
  });
}

function renderTimeline() {
  const knot = knotObj();
  const tl = $('#timeline');
  tl.replaceChildren();
  const track = document.createElement('div');
  track.className = 'tl-track';
  const fill = document.createElement('div');
  fill.className = 'tl-fill';
  fill.id = 'tlFill';
  track.appendChild(fill);
  tl.appendChild(track);
  const list = document.createElement('ol');
  list.className = 'tl-steps';
  knot.steps.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'tl-dot';
    b.dataset.step = i;
    b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
    b.innerHTML = `<span class="tl-n">${i + 1}</span><span class="tl-label">${s.title}</span>`;
    b.addEventListener('click', () => goTo(i, { user: true }));
    li.appendChild(b);
    list.appendChild(li);
  });
  tl.appendChild(list);
}

function renderNotation() {
  const knot = knotObj();
  const box = $('#notation');
  box.replaceChildren();
  knot.moves.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'nchip';
    b.textContent = m;
    b.title = m === 'T' ? 'Tuck through the front' : `${MOVE_TEXT[m[1]]}, ${MOVE_TEXT[m[0]]}`;
    b.addEventListener('click', () => goTo(i + 1, { user: true }));
    box.appendChild(b);
  });
}

function updateStepUI() {
  const knot = knotObj();
  const st = states()[app.step];
  const s = knot.steps[app.step];
  const total = knot.steps.length;
  $('#stepNum').textContent = pad(app.step + 1);
  $('#stepOf').textContent = '/ ' + pad(total);
  $('#moveChip').innerHTML = moveChip(knot, st);
  $('#stepTitle').textContent = s.title;
  $('#stepText').innerHTML = s.text;
  $('#stepTip').textContent = s.tip;
  const card = $('#stepCard');
  card.classList.remove('swap');
  void card.offsetWidth;
  card.classList.add('swap');

  $('#prevBtn').disabled = app.step === 0;
  $('#nextBtn').disabled = app.step === total - 1;
  $('#replayBtn').disabled = app.step === 0;

  $$('.tl-dot').forEach((d, i) => {
    d.classList.toggle('done', i < app.step);
    d.classList.toggle('current', i === app.step);
    d.setAttribute('aria-current', i === app.step ? 'step' : 'false');
  });
  const fill = $('#tlFill');
  if (fill) fill.style.transform = `scaleX(${total > 1 ? app.step / (total - 1) : 0})`;

  $$('.nchip').forEach((c, i) => {
    c.classList.toggle('done', i < app.step - 1 || (app.step > knot.moves.length));
    c.classList.toggle('current', i === app.step - 1);
  });
  app.map.render(knot, app.step, app.mode !== 'front');
  if (app.started) {
    try { history.replaceState(null, '', `#${knot.id}-${app.step + 1}`); } catch { /* sandboxed */ }
  }
}

// ---------------------------------------------------------------------------
// Navigation

function goTo(step, { user = false, animate = true, replay = false } = {}) {
  const knot = knotObj();
  const total = knot.steps.length;
  step = Math.max(0, Math.min(total - 1, step));
  if (user) stopPlay();
  const prev = app.step;
  app.step = step;
  updateStepUI();
  if (!app.stage) return;
  const st = states()[step];
  const target = pose(app.knot, step);
  const adjacent = Math.abs(step - prev) === 1 || replay;
  const glow = st.kind === 'moves';
  if (animate && adjacent && !reduceMotion && (replay || step !== prev)) {
    if (replay || step > prev) app.stage.showStep(step, { play: true, pose: target, glow }); // tie the move
    else app.stage.showStep(prev, { play: true, reverse: true, pose: target, glow: false }); // undo it
  } else {
    app.stage.showStep(step, { pose: target });
  }
  app.stage.setArrow(app.arrows ? arrowFor(app.knot, step) : null);
  app.stage.setView(viewFor(st), !reduceMotion);
}

function selectKnot(i, step = 0, { force = false } = {}) {
  if (i === app.knot && !force) return;
  stopPlay();
  app.knot = i;
  renderTabs();
  renderTimeline();
  renderNotation();
  app.step = step;
  updateStepUI();
  if (app.stage) {
    app.stage.setBaked(baked(i));
    app.stage.showStep(step, { pose: pose(i, step) });
    app.stage.setArrow(app.arrows ? arrowFor(i, step) : null);
    app.stage.setView(viewFor(states()[step]), !reduceMotion);
  }
}

let playTimer = null;
function play() {
  app.playing = true;
  document.body.classList.add('playing');
  $('#playBtn span').textContent = 'Pause';
  const tick = () => {
    if (!app.playing) return;
    const total = knotObj().steps.length;
    if (app.step >= total - 1) { stopPlay(); return; }
    goTo(app.step + 1);
    playTimer = setTimeout(tick, reduceMotion ? 3500 : chapterSeconds(app.knot, app.step) * 1000 + 1400);
  };
  if (app.step >= knotObj().steps.length - 1) { goTo(0); playTimer = setTimeout(tick, 2500); }
  else tick();
}
function stopPlay() {
  app.playing = false;
  clearTimeout(playTimer);
  document.body.classList.remove('playing');
  const s = $('#playBtn span');
  if (s) s.textContent = 'Play';
}

const MODES = ['mirror', 'pov', 'front'];
const HINTS = {
  mirror: 'Drag to look behind the knot · scroll to zoom',
  front: 'Drag to look behind the knot · scroll to zoom',
  pov: 'Drag to glance around · scroll to lean in',
};

function setMode(mode) {
  app.mode = mode;
  $$('.segmented button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === mode)));
  for (const m of MODES) document.body.classList.toggle('view-' + m, m === mode);
  $('#dragHintText').textContent = HINTS[mode];
  if (app.stage) {
    app.stage.viewName = viewFor(states()[app.step]);
    app.stage.setMode(mode);
  }
  app.map.render(knotObj(), app.step, mode !== 'front');
}

function start(knotIndex) {
  app.started = true;
  document.body.classList.add('started');
  selectKnot(knotIndex, 0, { force: true });
  $('#guide').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Content sections

function renderKnotCards() {
  const box = $('#knotCards');
  KNOTS.forEach((k, i) => {
    const card = document.createElement('article');
    card.className = 'knot-card';
    const s = k.stats;
    card.innerHTML = `
      <div class="kc-top">
        <svg class="kc-glyph" viewBox="0 0 100 120" aria-hidden="true">${knotGlyph(i)}</svg>
        <div>
          <p class="eyebrow">${k.tagline}</p>
          <h3>${k.name}</h3>
          <p class="pips" aria-label="Difficulty ${k.level} of 3">${[1, 2, 3].map((p) => `<i class="${p <= k.level ? 'on' : ''}"></i>`).join('')}<span>${['', 'Easy', 'Medium', 'Harder'][k.level]}</span></p>
        </div>
      </div>
      <p class="kc-blurb">${k.blurb}</p>
      <dl class="kc-stats">
        <div><dt>Size</dt><dd>${s.size}</dd></div>
        <div><dt>Shape</dt><dd>${s.shape}</dd></div>
        <div><dt>Wear it for</dt><dd>${s.formality}</dd></div>
        <div><dt>Best with</dt><dd>${s.collar}</dd></div>
        <div><dt>Moves</dt><dd>${k.moves.length - 1} + tuck</dd></div>
      </dl>
      <p class="kc-notation" aria-label="Fink–Mao notation">${k.moves.map((m) => `<span>${m}</span>`).join('')}</p>
      <button class="btn btn-gold kc-go" data-knot="${i}">Tie the ${k.name} <span aria-hidden="true">→</span></button>`;
    card.querySelector('.kc-go').addEventListener('click', () => start(i));
    box.appendChild(card);
  });
}

// Simple front-view silhouettes for the knot cards (relative sizes match the 3D knots).
function knotGlyph(i) {
  const w = [15, 19, 24][i];
  const lean = i === 0 ? 3 : 0;
  const top = 26, bot = 52;
  const bw = w * 0.55;
  return `
    <path class="g-collar" d="M8 10 L50 22 L92 10 L84 44 L58 34 L50 40 L42 34 L16 44 Z"/>
    <path class="g-blade" d="M${50 - bw + 1} ${bot - 2} L${50 + bw - 1} ${bot - 2} L${50 + bw + 9} 108 L50 118 L${50 - bw - 9} 108 Z"/>
    <path class="g-knot" d="M${50 - w} ${top + lean} L${50 + w} ${top - lean} L${50 + bw} ${bot} L${50 - bw} ${bot} Z"/>
    <path class="g-band" d="M${50 - w + 3} ${top + 9 + lean} L${50 + w - 3} ${top + 9 - lean}"/>`;
}

function renderMathsTable() {
  const box = $('#mathsTable');
  const rows = KNOTS.map((k) => `
    <div class="mt-row">
      <div class="mt-name"><b>${k.name}</b><span>Fink–Mao no. ${k.fm} · ${k.moves.length - 1} moves</span></div>
      <div class="mt-seq">${k.moves.map((m) => `<span class="mt-${m === 'T' ? 't' : m[1]}">${m}</span>`).join('')}</div>
    </div>`).join('');
  box.innerHTML = `
    <div class="mt-legend">
      <span><b>L C R</b> where the wide end goes</span>
      <span><b>i</b> over the front</span>
      <span><b>o</b> underneath</span>
      <span><b>T</b> tuck through</span>
    </div>${rows}`;
}

// ---------------------------------------------------------------------------
// Boot

function boot() {
  app.map = new KnotMap($('#knotMap'));
  document.body.classList.add('view-mirror');

  // deep link: #windsor-4
  const m = location.hash.match(/^#(four-in-hand|half-windsor|windsor)-(\d+)$/);
  if (m) {
    app.knot = KNOTS.findIndex((k) => k.id === m[1]);
    app.step = Math.max(0, Math.min(KNOTS[app.knot].steps.length - 1, +m[2] - 1));
    app.started = true;
    document.body.classList.add('started');
  }

  renderTabs();
  renderTimeline();
  renderNotation();
  renderKnotCards();
  renderMathsTable();

  try {
    app.stage = new Stage($('#scene'), {});
    window.__stage = app.stage;
  } catch (e) {
    console.warn('3D unavailable', e);
    $('#noWebgl').hidden = false;
    document.body.classList.add('no-3d');
  }

  if (app.stage) {
    if (app.started) {
      app.stage.setBaked(baked(app.knot));
      app.stage.showStep(app.step, { pose: pose(app.knot, app.step) });
      app.stage.setArrow(app.arrows ? arrowFor(app.knot, app.step) : null);
      app.stage.setView(viewFor(states()[app.step]), false);
    } else {
      // intro: the finished Four-in-Hand, seen whole
      const last = KNOTS[0].steps.length - 1;
      app.stage.setBaked(baked(0));
      app.stage.showStep(last, { pose: pose(0, last) });
      app.stage.setView('finish', false);
      app.stage.camera.position.add({ x: 30, y: 10, z: 40 });
      app.stage.setView('hero', !reduceMotion);
    }
    const ro = new ResizeObserver(() => app.stage.resize());
    ro.observe($('#scene'));
    // stop drawing while the stage is scrolled out of view
    new IntersectionObserver(([e]) => { app.stage.paused = !e.isIntersecting; }).observe($('#guide'));
  }
  updateStepUI();

  // controls
  $$('[data-start]').forEach((b) => b.addEventListener('click', () => start(+b.dataset.start)));
  $('#prevBtn').addEventListener('click', () => goTo(app.step - 1, { user: true }));
  $('#nextBtn').addEventListener('click', () => goTo(app.step + 1, { user: true }));
  $('#replayBtn').addEventListener('click', () => { stopPlay(); goTo(app.step, { replay: true }); });
  $('#playBtn').addEventListener('click', () => (app.playing ? stopPlay() : play()));
  $$('.segmented button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.view)));
  $('#arrowsBtn').addEventListener('click', (e) => {
    app.arrows = !app.arrows;
    e.currentTarget.setAttribute('aria-pressed', String(app.arrows));
    if (app.stage) app.stage.setArrow(app.arrows ? arrowFor(app.knot, app.step) : null);
  });
  $('#resetBtn').addEventListener('click', () => app.stage && app.stage.setView(viewFor(states()[app.step]), true));
  $('#mapInfo').addEventListener('click', () => $('#maths').scrollIntoView({ behavior: 'smooth' }));

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (!app.started && (e.key === 'ArrowRight' || e.key === 'Enter') && e.target === document.body) { start(app.knot); return; }
    if (e.key === 'ArrowRight') { goTo(app.step + 1, { user: true }); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { goTo(app.step - 1, { user: true }); e.preventDefault(); }
    else if (e.key === ' ' && e.target === document.body) { app.playing ? stopPlay() : play(); e.preventDefault(); }
    else if (e.key === 'v' || e.key === 'V') setMode(MODES[(MODES.indexOf(app.mode) + 1) % MODES.length]);
    else if (e.key === 'm' || e.key === 'M') setMode(app.mode === 'mirror' ? 'front' : 'mirror');
  });

  // fade the drag hint once someone has used it
  if (app.stage) app.stage.controls.addEventListener('start', () => $('#dragHint').classList.add('used'), { once: true });
}

boot();
