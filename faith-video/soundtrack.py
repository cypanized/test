"""Procedural ambient soundtrack synced to the video timeline (44.1 kHz stereo WAV)."""
import json, math, wave, sys
import numpy as np

V = sys.argv[1]
tl = json.load(open(f"{V}/timeline.json"))
SR = 44100
DUR = round(tl["duration"] * 30) / 30.0   # exact video length
N = int(round(DUR * SR))
T_TODAY = tl["tToday"]
rng = np.random.default_rng(11)

pad = np.zeros((2, N)); drone = np.zeros((2, N)); fx = np.zeros((2, N))

def pan_gains(p):            # p in [-1, 1]
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)

def add(bus, start, sig, p=0.0):
    i0 = int(start * SR)
    if i0 >= N: return
    sig = sig[: N - i0]
    gl, gr = pan_gains(p)
    bus[0, i0:i0 + len(sig)] += sig * gl
    bus[1, i0:i0 + len(sig)] += sig * gr

def hz(note):
    names = {"C":0,"C#":1,"D":2,"Eb":3,"E":4,"F":5,"F#":6,"G":7,"Ab":8,"A":9,"Bb":10,"B":11}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)

# ---------- drone bed ----------
t = np.arange(N) / SR
for f, a, det in [(hz("D2"), 0.050, 0.11), (hz("A2"), 0.028, 0.07), (hz("D3"), 0.014, 0.05)]:
    trem = 1 + 0.18 * np.sin(2 * np.pi * 0.07 * t + f)
    for ch, d in ((0, -det), (1, det)):
        s = np.sin(2 * np.pi * (f + d) * t) + 0.25 * np.sin(2 * np.pi * 2 * (f + d) * t) + 0.08 * np.sin(2 * np.pi * 3 * (f + d) * t)
        drone[ch] += a * trem * s
del t

# ---------- chord pads ----------
CH = {
    "Dm": ["D3", "A3", "D4", "F4"], "Bb": ["Bb2", "F3", "Bb3", "D4"], "F": ["F3", "A3", "C4", "F4"],
    "C": ["C3", "G3", "C4", "E4"], "Gm": ["G2", "D3", "G3", "Bb3"], "D": ["D3", "A3", "D4", "F#4"],
}
prog = ["Dm", "Bb", "F", "C"]
sched = [(0.0, "Dm")]
tc, k = 7.0, 1
while tc < T_TODAY + 0.7:
    sched.append((tc, prog[k % 4] if k % 8 != 7 else "Gm")); tc += 8.0; k += 1
sched = [s for s in sched if s[0] < T_TODAY + 0.7]
sched.append((T_TODAY + 0.7, "Bb"))
sched.append((T_TODAY + 3.6, "D"))
for idx, (st, name) in enumerate(sched):
    en = sched[idx + 1][0] if idx + 1 < len(sched) else DUR
    att, rel = 2.2, 3.0
    length = en - st + rel
    n = int(length * SR); tt = np.arange(n) / SR
    env = np.minimum(1, tt / att) * np.clip((length - tt) / rel, 0, 1)
    env = env ** 1.5
    gain = 0.034 if name != "D" else 0.046
    for j, note in enumerate(CH[name]):
        f = hz(note)
        for ch in (0, 1):
            sig = np.zeros(n)
            for cents in (-4, 0, 4):
                ff = f * 2 ** ((cents + (3 if ch else -3) * 0.5) / 1200)
                ph = rng.uniform(0, 2 * np.pi)
                sig += np.sin(2 * np.pi * ff * tt + ph) + 0.30 * np.sin(4 * np.pi * ff * tt + ph) + 0.10 * np.sin(6 * np.pi * ff * tt + ph)
            sig *= gain / 3 * env * (1.0 if j < 3 else 0.8)
            i0 = int(st * SR); seg = sig[: N - i0]
            pad[ch, i0:i0 + len(seg)] += seg

# ---------- singing-bowl chimes on each chapter ----------
FAM_NOTE = {"anc": "A4", "isl": "G4", "jud": "F4", "chr": "D5", "afr": "A4", "ind": "C5", "bud": "D4", "eas": "F5"}
FAM_PAN = {"anc": -0.55, "isl": -0.25, "jud": 0.25, "chr": 0.6, "afr": 0.4, "ind": 0.0, "bud": -0.45, "eas": -0.7}
def bowl(f, amp, dur=7.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    sig = np.zeros(n)
    for ratio, a, dec in [(1, 1.0, 4.8), (2.76, 0.45, 2.9), (5.40, 0.22, 1.7), (8.93, 0.10, 0.9)]:
        beat = 1 + 0.25 * np.sin(2 * np.pi * (0.9 * ratio ** 0.5) * tt)
        sig += a * np.exp(-tt / dec) * beat * np.sin(2 * np.pi * f * ratio * tt)
    sig *= np.minimum(1, tt / 0.004)
    return amp * sig
for c in tl["caps"]:
    fam = c["fam"]
    if fam is None:
        add(fx, c["t"], bowl(hz("D5"), 0.10), 0.0); add(fx, c["t"] + 0.12, bowl(hz("A4"), 0.07), 0.0)
        continue
    add(fx, c["t"], bowl(hz(FAM_NOTE[fam]), 0.11), FAM_PAN[fam])

# ---------- glassy pings for other births ----------
PENTA = ["D6", "F6", "G6", "A6", "C7"]
cap_times = [c["t"] for c in tl["caps"]]
for i, b in enumerate(tl["births"]):
    if b["cap"] and any(abs(b["t"] - ct) < 0.2 for ct in cap_times):
        continue
    f = hz(PENTA[(i * 7) % 5])
    n = int(1.2 * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2.01 * f * tt)) * np.exp(-tt / 0.28) * np.minimum(1, tt / 0.003)
    add(fx, b["t"], 0.030 * s, FAM_PAN[b["fam"]] * 0.9)

# ---------- extinction: a soft falling tone ----------
for e in tl["ends"]:
    n = int(1.6 * SR); tt = np.arange(n) / SR
    f = hz("D3") * (1 - 0.12 * (tt / 1.6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt / 0.55) * np.minimum(1, tt / 0.03)
    add(fx, e["t"], 0.05 * s, FAM_PAN[e["fam"]] * 0.6)

# ---------- cinematic low swells ----------
def boom(amp):
    n = int(3.0 * SR); tt = np.arange(n) / SR
    f = 44 + 26 * np.exp(-tt / 0.35)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return amp * np.sin(ph) * np.exp(-tt / 1.1) * np.minimum(1, tt / 0.02)
add(fx, 0.55, boom(0.22)); add(fx, T_TODAY + 3.6, boom(0.24))

# ---------- reverb (stereo convolution with synthetic hall) ----------
def reverb(x, rt60=3.4, pre=0.025, seed=0):
    r = np.random.default_rng(seed)
    n = int((rt60 + 0.2) * SR); tt = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.standard_normal(n) * np.exp(-6.91 * tt / rt60)
        ir[: int(pre * SR)] = 0
        # darken the tail
        k = np.exp(-np.arange(64) / 10.0); ir = np.convolve(ir, k / k.sum(), mode="same")
        ir /= np.sqrt(np.sum(ir ** 2))
        L = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
        y = np.fft.irfft(np.fft.rfft(x[ch], L) * np.fft.rfft(ir, L), L)[: x.shape[1]]
        out[ch] = y
    return out
wet_fx = reverb(fx, 3.6, seed=1)
wet_pad = reverb(pad, 2.8, seed=2)
mix = drone * 0.9 + pad * 0.75 + wet_pad * 0.35 + fx * 0.85 + wet_fx * 0.55

# ---------- master ----------
tt = np.arange(N) / SR
fade = np.minimum(1, tt / 1.2) * np.clip((DUR - tt) / 2.2, 0, 1)
mix *= fade
mix = np.tanh(mix * 1.6) / 1.6
peak = np.max(np.abs(mix)); mix *= 10 ** (-1.0 / 20) / peak
rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)) + 1e-12)
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(f"{V}/soundtrack.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.T.copy().tobytes())
print(f"duration {DUR:.3f}s  chords {len(sched)}  rms {rms:.1f} dBFS  peak -1.0 dBFS")
