# GuitarZero2Hero intro: Note Highway

An 8.4-second intro (1920×1080, 60 fps, stereo) staged as a rhythm-game lane at a night show. The camera looks down a six-string fretboard highway. Guitar picks ride the strings and land on a bone strike bar exactly on the riff. Every hit adds to the combo, the multiplier and a ZERO to HERO meter. At HERO the lane catches fire. On the last chord the highway folds up into a guitar neck, which turns and flies into the neck of the logo's H. The letters burst like hit notes and land as the wordmark.

| Scene | Starts | What happens |
| --- | --- | --- |
| Count-in | 0.00 s | The lane powers up, two drumsticks click 1 2 3 4, and the meter sits at ZERO. |
| Zero to hero | 1.00 s | Twenty notes, all PERFECT. The multiplier steps ×2 (1.8 s) and ×4 (2.6 s). At HERO (3.4 s) the rails ignite, the camera rises and the crowd roars. |
| Neck to logo | 4.20 s | The six-lane final chord. The lanes converge and stand up into a neck, then turn into the H's neck (4.6 s) as GZ2H slams in. The hands pop on at 4.8, 5.0, 5.2 and 5.4 s. |
| Lockup | 5.80 s | On a tom fill each letter bursts and sends a spark to its capital in the wordmark. Final chord and crash at 6.2 s, URL at 6.36 s, held until the fade at 7.95 s. |

| File | What it is |
| --- | --- |
| `gz2h-highway.mp4` | Final video with sound and motion blur (4 sub-frames), about −14 LUFS |
| `gz2h-highway.html` | Self-contained interactive player (open it in a browser; it streams the MP3 next to it) |
| `gz2h-highway.wav`, `.mp3` | The soundtrack on its own |
| `gz2h-highway-storyboard.png` | Twelve labelled key frames |
| `src/` | Source: `template.html` (renderer, chart, score, player), assets, build and render scripts, tools |

## One chart drives everything

`CHART` at the top of the script in `template.html` is the only note list. Each row is a time on the 150 BPM eighth-note grid and the string:fret gems it holds. From it the page derives the picks on the highway (a pick's distance down the lane is `(note time − t) × SPEED`, so it reaches the strike bar at exactly its time), the hit sparks, the PERFECT calls, the combo, the score, the multiplier and the meter. The soundtrack reads the same rows: each row's pitches go to the distorted guitar rigs (or a palm-muted chug), each gem gets a soft high tick, and the drums sit on the same grid. Measured onsets in the music stem land within one video frame of the chart.

The picks run red to amber to cream across the strings, low E on the left, and the lane is a fretboard, not a set of buttons.

## Measured

8.40 s, 1920×1080 at 60 fps, H.264 yuv420p (crf 17) with AAC 256k 48 kHz stereo, 10.0 MB. Mastered to −14.2 LUFS integrated with a −1.5 dBTP peak. On the big hits the guitar band (500 to 6000 Hz) carries about 51 to 54% of the energy against 31 to 34% for 20 to 120 Hz.

## Edit and re-render

```sh
cd intro-highway/src
NODE_PATH=<dir with opentype.js> node tools/wordmark.js   # wordmark outlines (with the looped 2) → assets/wordmark.json
node build.js                         # inlines logo, wordmark, fonts and audio kit → ../gz2h-highway.html
node render.js --stills 1.5,4.4 out/  # PNG stills (STILL_MB=4 for motion blur)
node render.js --audio                # → ../gz2h-highway.wav only
MB=4 node render.js                   # → ../gz2h-highway.mp4 (needs Playwright + ffmpeg)
tools/master.sh ../gz2h-highway.wav ../gz2h-highway.mp4   # −14 LUFS, writes the MP3, swaps audio into the MP4
```

Timing lives in `T`. The camera is `camera()`, the fold is `laneXf()` and the score is at the bottom of `buildAudio()`.
