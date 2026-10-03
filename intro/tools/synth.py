#!/usr/bin/env python3
"""Pure-Python Karplus-Strong guitar strum + impact thumps for the GZ2H intro.
Writes a 16-bit mono WAV. Timings match the animation timeline in gz2h-intro.html."""
import math, random, struct, wave, sys

FS = 44100
DUR = 6.6
N = int(FS * DUR)
mix = [0.0] * N
random.seed(7)

def pluck(freq, t0, amp=0.5, decay=0.9965, brightness=0.5, dur=4.0):
    """Karplus-Strong string: noise burst through an averaging low-pass delay line."""
    L = int(round(FS / freq))
    buf = [random.uniform(-1, 1) for _ in range(L)]
    # soften the excitation (less harsh pick) by a one-pole low-pass on the noise
    for i in range(1, L):
        buf[i] = buf[i - 1] * (1 - brightness) + buf[i] * brightness
    start = int(t0 * FS)
    end = min(N, start + int(dur * FS))
    i = 0
    prev = 0.0
    for n in range(start, end):
        cur = buf[i]
        nxt = buf[(i + 1) % L]
        buf[i] = decay * 0.5 * (cur + nxt)
        s = cur
        # tiny attack ramp to avoid clicks
        env = min(1.0, (n - start) / (0.002 * FS))
        mix[n] += amp * env * s
        i = (i + 1) % L

def thump(t0, freq=58.0, amp=0.55, dur=0.28):
    start = int(t0 * FS)
    end = min(N, start + int(dur * FS))
    for n in range(start, end):
        t = (n - start) / FS
        env = math.exp(-t * 14.0) * min(1.0, t / 0.004)
        sweep = freq * (1 + 1.6 * math.exp(-t * 40.0))   # pitch drop at the hit
        mix[n] += amp * env * math.sin(2 * math.pi * sweep * t)
        # click layer
        mix[n] += amp * 0.25 * math.exp(-t * 180.0) * random.uniform(-1, 1)

def chord(notes, t0, spacing, amp, **kw):
    for k, f in enumerate(notes):
        pluck(f, t0 + k * spacing, amp=amp, **kw)

# --- the main strum: E minor, low to high, matching the pick crossing times ---
EM = [82.41, 123.47, 164.81, 196.00, 246.94, 329.63]
chord(EM, 1.10, 0.07, amp=0.42, decay=0.9972, brightness=0.55)
# --- letter impacts: G Z 2 H ---
for t in (1.50, 1.70, 1.90, 2.10):
    thump(t)
# headstock reveal: a short muted high pluck "tick" sequence (tuning pegs popping in)
for k in range(6):
    pluck(1318.5 * (1 + 0.02 * k), 2.30 + k * 0.045, amp=0.08, decay=0.985, brightness=0.9, dur=0.4)
# --- resolve strum: E major arpeggio, softer, at the wordmark transition ---
EMAJ = [82.41, 123.47, 164.81, 207.65, 246.94, 329.63]
chord(EMAJ, 3.30, 0.045, amp=0.30, decay=0.9975, brightness=0.45)
# final high harmonic shimmer at the URL reveal
pluck(659.26, 4.30, amp=0.12, decay=0.998, brightness=0.3, dur=2.0)
pluck(987.77, 4.36, amp=0.08, decay=0.998, brightness=0.3, dur=2.0)

# --- simple feedback delay for a bit of room ---
D = int(0.135 * FS)
fb = 0.28
out = mix[:]
for n in range(D, N):
    out[n] += fb * out[n - D]

# --- soft clip + normalise ---
peak = max(abs(v) for v in out) or 1.0
g = 0.89 / peak
out = [math.tanh(1.3 * v * g) for v in out]
peak = max(abs(v) for v in out)
out = [v * (0.89 / peak) for v in out]
# fade out over the final 0.5s
for n in range(N - int(0.5 * FS), N):
    out[n] *= (N - n) / (0.5 * FS)

with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'strum.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(FS)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in out))
print("wrote", N, "samples")
