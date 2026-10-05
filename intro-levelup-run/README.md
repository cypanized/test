# GuitarZero2Hero intro: Level Up Run

A 32.5-second game run (1920×1080, 60 fps, stereo). It is the long cut of the 8-second Level Up intro, which stays as it was. A coin drops, PLAYER 1 meets NOBODY (LV 0, zero fans, empty gear), and the run climbs through five worlds on an overworld map: bedroom, open mic cafe, dive bar, arena and stadium. He goes from NOBODY to GUITAR GOD, and then the original finale plays: the jump strum boss hit, the GZ2H logo stacking in blocks, the four hands, and the title screen.

Everything is true pixel art. A 320×180 indexed framebuffer uses 12 colours around brand red #B80016 and dark crimson #4B0011. It is upscaled ×6 nearest-neighbour. Lighting, flashes and fades are palette shifts, never blends.

The persistent HUD makes the climb readable at a glance:
- **LV** and a rank title: NOBODY → BEDROOM PLAYER → OPEN MIC ROOKIE → BAR BAND REGULAR → ARENA HEADLINER → GUITAR GOD.
- **XP bar**.
- **FANS** counter: 0 → 1 → 500 → 25,000 → 100,000.
- **Gear row**: five slots that fill with ELECTRIC GUITAR, DISTORTION PEDAL, AMP STACK, STAGE OUTFIT and LEGENDARY AXE.

| Scene | Starts | What happens |
| --- | --- | --- |
| Insert coin | 0.00 s | INSERT COIN, the coin chime, the PLAYER 1 card |
| W1 Bedroom | 3.00 s | MISS, a sproing as a string snaps, BANG and KEEP IT DOWN!, then a DAY 1 → 365 montage with a metronome and an item get: ELECTRIC GUITAR |
| (map) | 9.00 s | STAGE CLEAR, hop to the cafe |
| W2 Open mic cafe | 10.50 s | Three listeners (one asleep), a cricket, one lick, one clap: FANS 1. Item: DISTORTION PEDAL, and the tone turns to crunch |
| (map) | 13.50 s | Hop to the dive bar |
| W3 Dive bar | 15.00 s | The drums kick in, mugs go up, the tip jar fills, the AMP STACK drops in on the beat |
| (map) | 18.00 s | Hop to the arena |
| W4 Arena | 19.50 s | BOSS: STAGE FRIGHT. A guitar duel knocks its HP 100 → 66 → 33 → 0; the STAGE OUTFIT turns him into the caped hero |
| (map) | 24.00 s | Hop to the stadium |
| W5 Stadium | 25.50 s | 100,000 fans and pyro. LV MAX and GUITAR GOD arrive with flame wings and lightning, then the LEGENDARY AXE and the hero riff |
| Title | 28.50 s | Boss hit, the logo in blocks, the four hands, the title screen with PRESS START and the URL |

| File | What it is |
| --- | --- |
| `gz2h-levelup-run.mp4` | Final video with sound, about −14 LUFS |
| `gz2h-levelup-run.html` | Self-contained interactive player with pixel UI |
| `gz2h-levelup-run.wav`, `.mp3` | The soundtrack (the player streams the MP3) |
| `gz2h-levelup-run-storyboard.png` | Key frames |
| `src/` | Source: `template.html` (framebuffer, scenes, HUD, chip score, player), `sprites.js` (pixel maps), assets, build and render scripts |

## The score grows with him

The score is a 2A03-style chip in Web Audio:
- **Pulse channels:** two, at 12.5 / 25 / 50 % duty, with equal peak-to-peak swing.
- **Triangle:** the 4-bit stepped triangle, for bass and kicks.
- **Noise:** a 15-bit LFSR noise channel at the chip's clock rates.
- **Volume:** 4-bit, stepping at 60 Hz.

It all runs on one 160 BPM grid, and the `LEAD` note list drives both the picture (strums, flying notes, +XP, the duel) and the sound. The arrangement grows world by world:
- **Bedroom:** a single thin 12.5 % pulse that plays a sour note and snaps a string.
- **Cafe:** the triangle bass arrives.
- **After the pedal:** the lead becomes a 50 % pulse with a detuned fifth and a sub-octave, a chip power chord.
- **Dive bar:** noise-channel drums come in.
- **Arena:** the full band. The boss growls in low 12.5 % chromatic lines and every hit lands with a crunch chord.
- **Stadium:** shred arpeggios, a power-up sweep, and the E major fanfare.

The classic jingles are original: item get, STAGE CLEAR and the level-up arpeggio.

## Edit and re-render

```sh
cd intro-levelup-run/src
NODE_PATH=<dir with opentype.js> node tools/pixelfont.js   # font → assets/pixelfont.json + assets/GZ2HPixel.otf
node tools/pixelize.js               # logo pieces + wordmark → assets/pixels.json
node build.js                        # inlines everything → ../gz2h-levelup-run.html
node render.js                       # → ../gz2h-levelup-run.mp4 + .wav (needs Playwright + ffmpeg)
bash tools/master.sh ../gz2h-levelup-run.wav ../gz2h-levelup-run.mp4   # −14 LUFS, writes the MP3, swaps audio into the MP4
node render.js --stills 12.2,21.2 out/                     # PNG stills
```

Timing lives in `T`, the worlds in `WORLDS`, the items in `ITEMS` and the player's notes in `LEAD`, all at the top of the script in `template.html`. The score is at the bottom of `buildAudio()`.
