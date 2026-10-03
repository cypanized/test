# GuitarZero2Hero intro: Pedalboard cut

An 8-second intro (1920×1080, 60 fps, stereo) shot like a premium gear ad. A red GZ2H overdrive pedal and a tube amp sit in a dark studio under softbox key light, rim strips and a black acrylic floor. Everything is procedural: an orthographic "long lens" camera projects the pedal, knobs, footswitch, a lofted leather boot mesh, the VU meter, grille cloth and the chrome badge into 2D canvas, with depth of field, bloom, motion blur and a WebGL grade/grain pass on top.

| Scene | Starts | What happens |
| --- | --- | --- |
| Gain | 0.00 s | Amp hum in the dark. A slow macro push across the knob scale while the GAIN knob clicks from 0 to 10, one detent at a time. |
| Stomp | 1.62 s | A Chelsea boot drops onto the rubber footswitch. Camera jolt, the LED snaps on red and the amp answers with an E5 chord. |
| Peak | 2.30 s | Close on the backlit VU meter (real VU dB and % scales). After a pick scrape, a G5 chord slams the needle into the red and the PEAK lamp fires; tubes glow above. |
| Badge | 3.54 s | The amp front on an A5 chord: woven grille cloth and the GZ2H logo as a raised chrome badge with a reflection sweep. Feedback swells with slow vibrato. |
| Nameplate | 5.40 s | A whip tilt up to the brushed-metal nameplate on the final E chord: raised GuitarZero2Hero (looped 2) on a red anodized field, guitarzero2hero.com engraved below, slow light sweep, fade. |

| File | What it is |
| --- | --- |
| `gz2h-pedal.mp4` | Final video with sound and motion blur, about −14 LUFS |
| `gz2h-pedal.html` | Self-contained interactive player (open it in a browser; it streams the MP3 next to it) |
| `gz2h-pedal.wav`, `.mp3` | The soundtrack on its own |
| `gz2h-pedal-storyboard.png` | Labelled key frames |
| `src/` | `template.html` (renderer, score, player), `build.js`, `render.js`, `tools/wordmark.js`, and the copied assets |

The sound is synthesized with the kit's `gzMix` (Karplus-Strong strings into two driven amp rigs) plus custom layers: a 60 Hz hum and 120 Hz tube buzz bed that rises with the GAIN knob, detent clicks timed to the knob's notches, a two-part footswitch clack, a comb-filtered pick scrape, a sine feedback swell with slow vibrato, and the last chord ringing out through the cab filtering. The VU needle is driven by a second-order (overshooting) ballistics model integrated once at load from the same hit times, so it is still a pure function of time.

## Edit and re-render

```sh
cd intro-pedal/src
NODE_PATH=/path/to/node_modules/with/opentype.js node tools/wordmark.js   # only to regenerate assets/wordmark.json
node build.js                         # inlines logo, wordmark, fonts and audio kit → ../gz2h-pedal.html
node render.js --stills 1.84,6.6 out/ # PNG stills (SUB=3 for motion-blurred stills)
MB=3 node render.js                   # → ../gz2h-pedal.mp4 + ../gz2h-pedal.wav (needs Playwright + ffmpeg)
START=3.6 END=4.6 OUT=/tmp/seg.mp4 node render.js   # render just a segment (bitrate tests)
../../gz2h-kit/tools/master.sh ../gz2h-pedal.wav ../gz2h-pedal.mp4   # master to −14 LUFS, write the MP3
```

The video carries lighter film grain than live playback (`capture()` renders every sub-frame with one shared grain pattern at 0.4× strength); per-pixel grain that changes every frame is what H.264 spends its bits on.

Timing lives in the `T` object near the top of the script in `template.html`; each shot is a `shot*()` function with its own camera, and the score is `buildAudio()` at the bottom.
