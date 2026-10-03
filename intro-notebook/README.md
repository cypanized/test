# GuitarZero2Hero intro: Notebook cut

An 8.2-second intro (1920×1080, 60 fps, stereo). It's set on a page of 5 mm grid paper seen from above, under soft overhead light. A pencil rules a guitar tab and fine-liner numbers are written in. The open strings ring out (zero), then a riff climbs the staff to the octave at fret 12 (hero), with each note circled in red marker as it plays. After that, the six tab lines peel off the paper and sweep into the GZ2H logo, which gets filled with marker hatching. The pencil-sketched hands drop onto it. Finally the wordmark is hand-lettered, the URL is penciled in and a gold star sticker lands on the page.

| Scene | Starts | What happens |
| --- | --- | --- |
| The staff | 0.00 s | A page turns and a pencil rules six lines, then writes TAB and the string names e B G D A E. |
| Zero to twelve | 0.86 s | A column of open-string zeros is strummed. Then 0, 3, 5, 7, 10, 12 climb the staff from low E to high e, each circled as it sounds, with a red playhead underline. |
| Tab to logo | 2.84 s | Doodles appear in the margins and the four hands are sketched in pencil. The six lines lift off, each string zipping up an octave, and land as the red marker outlines of G, Z, 2 and H. Marker hatching fills them and the hands drop into place. |
| Lesson complete | 4.86 s | GuitarZero2Hero is outlined in crimson fine-liner and filled with red marker, letter by letter. When it completes, an open E major chord is strummed. The URL is penciled underneath with a red swoosh, and a gold star sticker slaps on. The final frame holds from 6.95 s. |

| File | What it is |
| --- | --- |
| `gz2h-notebook.mp4` | Final video with sound and motion blur, about −14 LUFS |
| `gz2h-notebook.html` | Self-contained interactive player (open it in a browser) |
| `gz2h-notebook.wav`, `.mp3` | The soundtrack on its own (the player streams the MP3) |
| `gz2h-notebook-storyboard.png` | Twelve key frames |
| `src/` | Source: `template.html` (pen engine, page, score, player), outlines, fonts, the audio kit, build and render scripts |

## How it works

- **Pen dynamics.** Every mark is a stroke: a polyline with a baked-in wobble, drawn on along its length on a minimum-jerk speed curve. Each stroke is filled as a variable-width ribbon, slightly thinner where the pen moves fastest, with round caps.
- **Inks.** Every ink is multiplied onto the paper, so the grid shows through and overlaps darken:
  - Red marker is translucent brand red, with ink pooling where a stroke starts and ends.
  - Pencil is a grainy graphite texture that stays fixed to the paper.
  - Numbers are black fine-liner and the wordmark outline is crimson fine-liner.
- **Marker fills.** Fills are real back-and-forth hatch strokes, clipped to each letter. The darker stripes are where neighbouring strokes overlap.
- **The six lines.** Each tab line is resampled to the same number of points as its target outline, so it can morph point by point. The left end of a line leaves first, so the string seems to peel off the page, and its shadow shows while it is lifted. Mid-flight it changes from graphite to red marker. The numbers written on a line ride along with it and fade.
- **Sound follows the picture.** The scratch sounds are computed from the same strokes the picture draws, with loudness following pen speed:
  - pencil: crackly filtered noise
  - marker: felt noise plus a speed-dependent squeak
  - fine-liner: a thin hiss

  The guitar is the kit's Karplus-Strong clean voice through a slightly warmer front end and a roomy reverb. A very quiet room tone sits under everything, so the gaps between strokes sound like a room rather than digital silence.
- **The wordmark's "2".** It is traced from the original brand wordmark, because Space Grotesk's own "2" has no loop.

## Edit and re-render

```sh
cd intro-notebook/src
NODE_PATH=/path/to/node_modules node tools/shapes.js   # outlines → assets/notebook-shapes.json (needs opentype.js)
node build.js                                          # inlines assets → ../gz2h-notebook.html
node render.js --stills 1.8,4.2,7.7 out/               # PNG stills
node render.js                                         # → ../gz2h-notebook.mp4 + .wav (needs Playwright + ffmpeg)
tools/master.sh ../gz2h-notebook.wav ../gz2h-notebook.mp4   # −14 LUFS master, writes the MP3, swaps audio into the MP4
```

- **Timing:** the `T` object near the top of the script in `template.html`.
- **Layout:** the page geometry block (staff lines, riff, logo and wordmark placement).
- **Score:** the end of `buildAudio()`.
