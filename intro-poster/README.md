# GuitarZero2Hero intro: Gig Poster cut

An 8-second intro (1920×1080, 60 fps, stereo) shot like stop-motion on a print-shop bench. A sheet of cream stock drops onto stained plywood and gets taped down. Two screen-print passes go on in riso red and warm black: a giant halftone 0 with sound-wave rings, then the type. ZERO is slashed out with a red brush stroke and HERO is rubber-stamped beside it. The GZ2H logo is slapped down in cut paper one letter per beat, the hands flick on, and a pick stamp thumps the corner. The wordmark goes on letterpress-style, a ticket stub carries the URL, and a push pin goes through it while the camera eases in.

Everything on the bench moves at 12 drawings a second (each drawing held for 5 frames), with a small per-drawing boil. Only the camera moves continuously. Each ink plate is printed 2 to 6 px out of register, and the offset changes with every drawing.

## Scenes

| Start | Scene | What happens |
| --- | --- | --- |
| 0.00 s | Paper & red ink | The sheet drops, tape rips across a corner and the squeegee pulls a giant halftone 0. |
| 1.00 s | Zero to hero | The black pass prints ZERO. A red marker slashes it and a rubber stamp thumps HERO. |
| 2.50 s | Cut & paste | G, Z, 2 and H slap down one per beat, the hands flick on and a pick stamp hits the corner. |
| 4.55 s | Lockup | Letterpress wordmark, a ticket stub with the URL, a pin through it and a slow push in. |

## Files

| File | What it is |
| --- | --- |
| `gz2h-poster.mp4` | Final video with sound and motion blur on the camera moves, about −14 LUFS |
| `gz2h-poster.html` | Self-contained interactive player (open it in a browser) |
| `gz2h-poster.wav`, `.mp3` | The soundtrack on its own (the player streams the MP3) |
| `gz2h-poster-storyboard.png` | Twelve key frames |
| `src/` | Source: `template.html` (print engine, timeline, score, player), fonts, logo and wordmark outlines, audio kit, build and render scripts, check tools |

## How it is made

- **Print look:** each ink is a plate rasterised once in poster space. Shapes are drawn soft, thresholded against noise for rough edges, screened with a Euclidean-dot halftone where they carry a tone (red at 15°), then given dropouts and mottle. Plates are composited with `multiply` over a procedural paper (fibres, tooth, flecks), so overprints darken the way real ink does.
- **Letterpress:** the wordmark ink is salty in the middle and denser at the stroke edges, over a light and dark relief offset that reads as a debossed bite.
- **Cut paper:** the traced logo pieces get a die-cut cream border, a card texture and pre-blurred contact and lifted shadows. The ticket, tape, squeegee, stamp blocks and platen are built the same way.
- **The "2":** the wordmark uses the brand's looped 2, traced from the original wordmark, instead of the font's plain one (`src/tools/wordmark.js`).
- **Sound:** a garage riff in E at 180 bpm on `gzMix`'s double-tracked rigs. A bit-crushed, band-passed bus plays the riff like a transistor radio in the intro, then runs in parallel with the band. There's a vinyl crackle bed and foley for every physical action: paper slaps, tape rip, squeegee and marker scrapes, stamp thumps with splatter ticks, the press and the pin. The final chord dies in a turntable stop, with every ringing source's `playbackRate` ramped down and the master low-passed. The boil of the drawings slows down and freezes with it.

## Edit and re-render

```sh
cd intro-poster/src
NODE_PATH=/path/to/node_modules node tools/wordmark.js   # wordmark outlines → assets/wordmark-paths.json (needs opentype.js)
node build.js                        # inlines assets → ../gz2h-poster.html
node render.js                       # → ../gz2h-poster.mp4 and .wav (needs Playwright + ffmpeg)
node render.js --stills 2.0,6.6 out/ # PNG stills
tools/master.sh ../gz2h-poster.wav ../gz2h-poster.mp4   # master to −14 LUFS, write the MP3, swap the audio into the MP4
```

Timing lives in the `D` object near the top of the script in `template.html`, in drawings at 12 per second. The beat is 4 drawings. The poster layout constants follow it, and the score is `buildAudio()`.
