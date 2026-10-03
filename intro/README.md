# GuitarZero2Hero intro

An 8-second intro (1920×1080, 60 fps, stereo) built from the real GZ2H logo, traced to vectors from the original intro.

| File | What it is |
| --- | --- |
| `gz2h-intro.mp4` | Final video with sound and motion blur, about −15 LUFS |
| `gz2h-intro.html` | Self-contained interactive player (open it in a browser) |
| `gz2h-intro.wav`, `.mp3` | The soundtrack on its own (the player streams the MP3) |
| `gz2h-intro-storyboard.png` | Eight key frames |
| `src/` | Source: `template.html` (animation and sound), traced logo paths, brand fonts, build and render scripts |

## Edit and re-render

```sh
cd intro/src
node build.js                 # inlines assets → ../gz2h-intro.html
node render.js                # → ../gz2h-intro.mp4 (needs Playwright + ffmpeg)
node render.js --stills 1.62,4.7 out/   # PNG stills for checking frames
```

Timing lives in the `T` object at the top of the script in `template.html`. The score is at the bottom of `buildAudio()`.
