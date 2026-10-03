# GuitarZero2Hero intro: Phosphor cut

An 8-second intro (1920×1080, 60 fps, stereo) staged on an oscilloscope. The guitar's signal draws everything: a flat line at zero volts, the open strings as live waveforms, musical intervals as Lissajous figures in X-Y mode, then the GZ2H logo and the wordmark traced by one glowing beam on a curved CRT.

| File | What it is |
| --- | --- |
| `gz2h-phosphor.mp4` | Final video with sound and motion blur, about −14 LUFS |
| `gz2h-phosphor.html` | Self-contained interactive player (open it in a browser) |
| `gz2h-phosphor.wav`, `.mp3` | The soundtrack on its own (the player streams the MP3) |
| `gz2h-phosphor-storyboard.png` | Twelve key frames |
| `src/` | Source: `template.html` (beam renderer, CRT shader, score), beam shapes, fonts, build and render scripts |

The logo section's hum is the logo itself: the left channel is X and the right is Y, traced 41.2 times a second (an E1). On a real scope in X-Y mode that signal draws GZ2H. In the finished mix the guitar sits on top of it, so it reads best from the clean `logoHumBuffer()` in the source.

The "2" in the wordmark is traced from the original brand wordmark, because Space Grotesk's own "2" has no loop.

## Edit and re-render

```sh
cd intro-phosphor/src
npm i opentype.js                    # only needed to regenerate shapes
node tools/shapes.js                 # logo + wordmark → assets/shapes.json (4096-point beam paths)
node build.js                        # inlines assets → ../gz2h-phosphor.html
node render.js                       # → ../gz2h-phosphor.mp4 (needs Playwright + ffmpeg)
node render.js --stills 2.4,4.7 out/ # PNG stills
```

Timing lives in the `T` object at the top of the script in `template.html`. The intervals are in `XY`, and the score is at the bottom of `buildAudio()`.
