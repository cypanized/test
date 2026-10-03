# Rebuilding the GZ2H intro

`../gz2h-intro.html` is the whole animation: a single self-contained page (the Outfit
typeface is embedded) driven by one deterministic `render(t)` timeline. Open it in a
browser to play it; tap the frame for sound. Every timing lives in the constants at the
top of its script (`STRUM_T0`, `LETTER_T`, `MORPH_T0`, and so on).

To re-export the video after editing the page:

```sh
python3 synth.py strum.wav                 # plucked-string soundtrack, same timings
node export.js --full 60 7.2 frames        # renders every frame with headless Chromium
ffmpeg -framerate 60 -i frames/f_%04d.png -i strum.wav -c:v libx264 -preset slow -crf 17 \
  -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ../gz2h-intro.mp4
```

`export.js` needs the `playwright` npm package and a Chromium it can launch; it loads the
page with `?export=1`, which disables the live playback loop and exposes `window.__seek(t)`.
`node export.js --preview 1.2,2.5,4.5` renders single frames into `preview/` for a quick look.
