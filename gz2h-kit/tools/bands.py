# Per-section loudness and spectral balance of a WAV.
#   python3 bands.py file.wav "intro:0-0.9" "STRUM:1.6-2.0" ...
# Watch for hits where 20-120 Hz (kick/boom) dwarfs 500-6000 Hz (guitar): the guitar must carry the big moments.
import numpy as np, wave, sys
w = wave.open(sys.argv[1]); sr = w.getframerate(); n = w.getnframes()
x = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, w.getnchannels()).astype(float) / 32768
mono = x.mean(1)
bands = [(20, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 16000)]
print(f"{'section':12s} {'rms dB':>7s}  " + '  '.join(f'{a}-{b}' for a, b in bands))
segs = sys.argv[2:] or [f'{t:.1f}s:{t}-{t+1}' for t in range(int(n / sr))]
for sg in segs:
    label, rng = sg.rsplit(':', 1); a, b = map(float, rng.split('-'))
    s = mono[int(a * sr):int(b * sr)]
    rms = 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
    F = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2; f = np.fft.rfftfreq(len(s), 1 / sr); tot = F.sum() + 1e-12
    print(f'{label:12s} {rms:7.1f}  ' + '  '.join(f'{100 * F[(f >= lo) & (f < hi)].sum() / tot:7.0f}%' for lo, hi in bands))
