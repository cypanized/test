// GZ2H audio kit: synthesized guitar, amp rigs, drums and FX on Web Audio.
// Paste or inline into an intro page (it defines globals). Works in AudioContext and OfflineAudioContext.
//
//   const mix = gzMix(ac, t0, from, { fadeAt: 7.6, dur: 8 });
//   mix.cleanNote(0.95, mix.F.E2, 0.9, -0.2);                     // clean electric pluck
//   mix.strum([1.60, 1.61, 1.62], ['E2', 'B2', 'E3'], 3.4, 0.55);  // distorted power chord, double-tracked L/R
//   mix.kick(1.62, 0.75); mix.snare(2.0, 0.6); mix.crash(1.62, 0.8);
//
// Times are seconds on the intro's timeline. `from` lets playback start mid-timeline (events before it are skipped).
// Mix lessons from earlier intros: keep kick ≤ 0.75 and boom ≤ 0.55 or the sub-bass swamps the guitars;
// the clean bus at 0.24 sits under distorted hits; master them to about -14 LUFS.

const gzMulberry = a => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Karplus-Strong plucked string → AudioBuffer
function gzKS(ac, f, dur, o = {}) {
  const sr = ac.sampleRate, n = Math.floor(sr * dur), out = new Float32Array(n);
  const t60 = o.t60 || 3, bright = o.bright ?? 0.55, pick = o.pick ?? 0.13, damp = o.damp ?? 0.5;
  const N = Math.max(2, Math.round(sr / f - damp)), buf = new Float32Array(N), r = gzMulberry(o.seed || 1);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += bright * ((r() * 2 - 1) - lp); buf[i] = lp; }
  const D = Math.max(1, Math.round(pick * N)), ex = buf.slice();
  for (let i = 0; i < N; i++) buf[i] = ex[i] - 0.9 * ex[(i - D + N) % N];
  let mean = 0; for (let i = 0; i < N; i++) mean += buf[i]; mean /= N;
  let pk = 0; for (let i = 0; i < N; i++) { buf[i] -= mean; pk = Math.max(pk, Math.abs(buf[i])); }
  for (let i = 0; i < N; i++) buf[i] /= pk || 1;
  const g = Math.pow(0.001, 1 / (f * t60));
  let idx = 0;
  for (let i = 0; i < n; i++) { const a = buf[idx], b = buf[(idx + 1) % N]; out[i] = a; buf[idx] = g * ((1 - damp) * a + damp * b); idx = (idx + 1) % N; }
  for (let i = 0; i < Math.min(60, n); i++) out[i] *= i / 60;
  const ab = ac.createBuffer(1, n, sr); ab.copyToChannel(out, 0); return ab;
}
function gzNoise(ac, dur, seed, ch = 1) {
  const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(ch, n, ac.sampleRate);
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c), r = gzMulberry(seed + c * 17); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1; }
  return b;
}
function gzIR(ac, dur, decay) {
  const sr = ac.sampleRate, n = Math.floor(sr * dur), b = ac.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c), r = gzMulberry(400 + c); let lp = 0;
    for (let i = 0; i < n; i++) { const cut = 0.9 + (0.08 - 0.9) * Math.min(1, (i / sr) / dur); lp += cut * ((r() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - i / n, decay) * (i < sr * 0.012 ? i / (sr * 0.012) : 1); }
  }
  return b;
}
function gzShaper(ac, drive, asym = 0) {
  const n = 4096, c = new Float32Array(n), off = Math.tanh(drive * asym);
  let mx = 0;
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(drive * (x + asym)) - off; mx = Math.max(mx, Math.abs(c[i])); }
  for (let i = 0; i < n; i++) c[i] /= mx;
  const ws = ac.createWaveShaper(); ws.curve = c; ws.oversample = '4x'; return ws;
}

function gzMix(ac, t0, from = 0, opt = {}) {
  const dur = opt.dur || 8, fadeAt = opt.fadeAt ?? dur - 0.4;
  const at = x => t0 + x - from;
  const live = x => x >= from - 0.001;
  const bq = (type, f, q = 0.707, gain = 0) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
  const G = v => { const g = ac.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const master = G(0.85), comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
  chain(master, comp, ac.destination);
  if (from < fadeAt) { master.gain.setValueAtTime(0.85, at(fadeAt)); master.gain.linearRampToValueAtTime(0.0001, at(dur)); }
  const rev = ac.createConvolver(); rev.buffer = gzIR(ac, 2.6, 2.6);
  chain(rev, G(0.5), master);
  const send = (node, amt) => { node.connect(G(amt)).connect(rev); };
  // clean electric bus
  const clean = G(opt.cleanGain ?? 0.24), cOut = chain(clean, gzShaper(ac, 1.8), bq('highpass', 75), bq('peaking', 2600, 1, 3), bq('lowpass', 5600, 0.6));
  cOut.connect(master); send(cOut, 0.5);
  // two distorted rigs, hard left and right (double-tracked)
  const rig = pan => {
    const inp = G(0.32);
    const o = chain(inp, bq('highpass', 120), bq('peaking', 750, 0.9, 5), gzShaper(ac, opt.drive ?? 16, 0.08), bq('highpass', 90), bq('peaking', 380, 1, -4), bq('peaking', 1800, 1.1, 4), bq('lowpass', 4300, 0.8), bq('lowpass', 5600, 0.6), G(0.85));
    const p = ac.createStereoPanner(); p.pan.value = pan; o.connect(p); p.connect(master); send(p, 0.18);
    return inp;
  };
  const L = rig(-0.85), R = rig(0.85);
  const NB = gzNoise(ac, 3, 9, 2);
  const src = (buf, time, dest, gain = 1, rate = 1, stopAt) => {
    if (!live(time)) return null;
    const s = ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = G(gain); s.connect(g); if (dest) g.connect(dest); s.start(at(time));
    if (stopAt) { g.gain.setValueAtTime(gain, at(stopAt)); g.gain.exponentialRampToValueAtTime(0.0001, at(stopAt + 0.09)); s.stop(at(stopAt + 0.12)); }
    return { s, g };
  };
  const panTo = (v, dest) => { const p = ac.createStereoPanner(); p.pan.value = v; p.connect(dest); return p; };
  const F = { E1: 41.2, A1: 55, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, Gs4: 415.3, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880, B5: 987.77, E6: 1318.5 };
  let seed = opt.seed || 1;
  const cleanNote = (time, f, gain = 0.8, pan = 0, t60 = 3.2, bright = 0.62) => src(gzKS(ac, f, t60 * 1.1, { t60, bright, pick: 0.14, seed: seed++ }), time, panTo(pan, clean), gain);
  // distorted chord: times[i] per note (stagger them a few ms for a real strum); mute=true for palm mutes
  const strum = (times, notes, t60 = 3.4, gain = 0.55, stopAt, mute) => notes.forEach((n, i) => {
    const f = typeof n === 'number' ? n : F[n], o = { t60, bright: mute ? 0.3 : 0.7, pick: 0.12, damp: mute ? 0.62 : 0.5 };
    src(gzKS(ac, f, Math.min(t60 * 1.1, 4.5), { ...o, seed: seed++ }), times[i], L, gain, 1, stopAt);
    src(gzKS(ac, f, Math.min(t60 * 1.1, 4.5), { ...o, seed: seed++ }), times[i] + 0.011, R, gain, 1.0023, stopAt);
  });
  const chug = (time, notes, gain = 1.0) => strum(notes.map((_, i) => time + i * 0.006), notes, 0.3, gain, null, true);
  const env = (node, time, peak, d, att = 0.003) => { node.gain.setValueAtTime(0.0001, at(time)); node.gain.exponentialRampToValueAtTime(peak, at(time + att)); node.gain.exponentialRampToValueAtTime(0.0001, at(time + d)); };
  const osc = (type, f0, f1, time, d, gain, dest = master, att = 0.003) => {
    if (!live(time)) return null; const o = ac.createOscillator(), a = G(0); o.type = type; o.frequency.setValueAtTime(f0, at(time)); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at(time + d * 0.5));
    env(a, time, gain, d, att); o.connect(a); a.connect(dest); o.start(at(time)); o.stop(at(time + d + 0.02)); return a;
  };
  const noise = (time, d, gain, filters = [], dest = master, att = 0.003) => {
    if (!live(time)) return null; const n = src(NB, time, null, 1); if (!n) return null; n.g.disconnect();
    const a = G(0); let node = n.g; for (const f of filters) { node.connect(f); node = f; } node.connect(a); a.connect(dest); env(a, time, gain, d, att); n.s.stop(at(time + d + 0.02)); return a;
  };
  const kick = (time, g = 0.75) => { osc('sine', 155, 45, time, 0.5, g, master, 0.004); noise(time, 0.02, 0.3 * g, [bq('highpass', 1800)]); };
  const snare = (time, g = 0.6) => { const a = noise(time, 0.22, 0.55 * g, [bq('highpass', 900), bq('peaking', 2000, 0.8, 4)]); if (a) send(a, 0.35); osc('triangle', 200, 160, time, 0.12, 0.4 * g); };
  const hat = (time, g = 0.3, open = false) => noise(time, open ? 0.35 : 0.05, 0.3 * g, [bq('highpass', 7000)]);
  const crash = (time, g = 0.8, d = 2.6) => { const a = noise(time, d, 0.42 * g, [bq('highpass', 4200), bq('peaking', 7600, 1.2, 5)]); if (a) send(a, 0.3); };
  const boom = (time, g = 0.5) => osc('sine', 62, 31, time, 1.7, 0.9 * g, master, 0.01);
  const tom = (time, f, g = 0.3) => { const a = osc('sine', f * 1.7, f, time, 0.38, 0.75 * g, master, 0.004); if (a) send(a, 0.3); };
  const click = (time, g = 0.5) => { noise(time, 0.012, 0.5 * g, [bq('highpass', 2500)], master, 0.0005); osc('square', 2200, 2200, time, 0.008, 0.05 * g, master, 0.0005); };
  // filtered noise riser / reverse cymbal that peaks at t2
  const swell = (t1, t2, g, f1, f2, q = 1, type = 'bandpass') => {
    if (!live(t2)) return;
    const s = ac.createBufferSource(); s.buffer = NB; const flt = bq(type, f1, q), a = G(0);
    s.connect(flt).connect(a); a.connect(master); send(a, 0.25);
    const st = Math.max(t1, from), u = Math.min(1, Math.max(0, (st - t1) / (t2 - t1)));
    flt.frequency.setValueAtTime(f1 + (f2 - f1) * u, at(st)); flt.frequency.exponentialRampToValueAtTime(f2, at(t2));
    a.gain.setValueAtTime(Math.max(0.0001, g * u ** 3), at(st)); a.gain.exponentialRampToValueAtTime(g, at(t2)); a.gain.exponentialRampToValueAtTime(0.0001, at(t2 + 0.03));
    s.start(at(st)); s.stop(at(t2 + 0.05));
  };
  const whoosh = (time, d, g, f1 = 2600, f2 = 320) => {
    if (!live(time)) return;
    const s = ac.createBufferSource(); s.buffer = NB; const flt = bq('bandpass', f1, 1.4), a = G(0);
    s.connect(flt).connect(a); a.connect(master); send(a, 0.3);
    flt.frequency.setValueAtTime(f1, at(time)); flt.frequency.exponentialRampToValueAtTime(f2, at(time + d));
    env(a, time, g, d, d * 0.35); s.start(at(time)); s.stop(at(time + d + 0.02));
  };
  return { ac, at, live, bq, G, chain, master, rev, send, clean, L, R, src, panTo, F, NB, cleanNote, strum, chug, env, osc, noise, kick, snare, hat, crash, boom, tom, click, swell, whoosh };
}

// Peak-normalize an AudioBuffer to `target` and encode 16-bit PCM WAV as base64
function gzWavB64(buf, target = 0.84) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  let pk = 0; for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); }
  const gain = target / (pk || 1), bytes = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); bytes.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, ch, true);
  bytes.setUint32(24, sr, true); bytes.setUint32(28, sr * ch * 2, true); bytes.setUint16(32, ch * 2, true); bytes.setUint16(34, 16, true); w(36, 'data'); bytes.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i] * gain)); bytes.setInt16(o, v * 32767, true); o += 2; }
  let s = ''; const u8 = new Uint8Array(bytes.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { b64: btoa(s), peak: pk };
}
