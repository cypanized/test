# GuitarZero2Hero intro: Level Up cut

An 8-second intro (1920×1080, 60 fps, stereo) staged as an 8-bit game. A coin drops, an iris opens on a nervous LV 0 guitarist, and every note he plays earns XP. Level ups stack faster and faster, amps pile up, the crowd fills in, and at LV 99 he transforms into the hero. One jump strum is the boss hit: the GZ2H logo drops in block by block, the four hands pop on, and the title screen lands with a fanfare.

Everything is true pixel art. Each frame is drawn into a 320×180 indexed framebuffer (12 colours around brand red #B80016 and dark crimson #4B0011) and upscaled ×6 with nearest-neighbour, so every pixel is a crisp 6×6 block. Lighting, flashes and the closing fade are palette shifts, not blends, so nothing is ever anti-aliased.

| Scene | Starts | What happens |
| --- | --- | --- |
| Insert coin | 0.00 s | INSERT COIN blinks, the coin drops with the two-note chime, the iris opens on the stage |
| Zero to hero | 1.00 s | LV 0 plays the riff for +1 XP a note, the XP bar fills in steps, LEVEL UP flashes, LV 99 transforms him |
| Boss hit | 4.00 s | The jump strum flashes the screen, the logo stacks up from the bottom in 6×6 blocks, the four hands pop on |
| Title screen | 5.50 s | Pixel wordmark with the looped 2, PRESS START, the URL types itself in; palette fade at the end |

| File | What it is |
| --- | --- |
| `gz2h-levelup.mp4` | Final video with sound, about −14 LUFS |
| `gz2h-levelup.html` | Self-contained interactive player with pixel UI (open it in a browser) |
| `gz2h-levelup.wav`, `.mp3` | The soundtrack on its own (the player streams the MP3) |
| `gz2h-levelup-storyboard.png` | Key frames |
| `src/` | Source: `template.html` (framebuffer, scenes, chip score, player), `sprites.js` (pixel maps), assets, build and render scripts |

## How it is made

- **Sprites** are pixel maps written as strings in `src/sprites.js` (zero and hero with two strum frames each, a three-frame cape, flames, amps, coin, notes). The crowd is drawn procedurally from silhouettes.
- **Font:** a 5×7 bitmap font defined once in `src/tools/pixelfont.js`. The canvas HUD draws it pixel by pixel, and the same glyphs are compiled into a real webfont (`GZ2HPixel.otf`, each pixel a square) for the player chrome.
- **Logo and wordmark:** `src/tools/pixelize.js` rasterizes the traced logo paths and the wordmark outline (with the brand's looped 2) to 1-bit masks at the intro's own resolution. The engine adds the lit top edge, shaded bottom edge, outline and red extrusion.
- **Sound** is a 2A03-style chip in Web Audio: two pulse channels with 12.5 / 25 / 50 % duty (PeriodicWaves with equal peak-to-peak swing), the 4-bit stepped triangle for bass and kicks, and a 15-bit LFSR noise channel at the chip's clock rates. Volumes are 4-bit and step at 60 Hz. The riff is in E minor for LV 0 and comes back in E major for the hero; the hands land on C, C, D, D (bVI, bVII) and the title resolves to E. A dotted-eighth echo is the one modern touch.
- **Motion** is sampled at game rates (30 fps sprites, 10 fps cape and flames) and snapped to whole pixels. No motion blur: one sample per frame.

## Edit and re-render

```sh
cd intro-levelup/src
NODE_PATH=<dir with opentype.js> node tools/pixelfont.js   # font → assets/pixelfont.json + assets/GZ2HPixel.otf
node tools/pixelize.js               # logo pieces + wordmark → assets/pixels.json
node build.js                        # inlines everything → ../gz2h-levelup.html
node render.js                       # → ../gz2h-levelup.mp4 + .wav (needs Playwright + ffmpeg)
bash tools/master.sh ../gz2h-levelup.wav ../gz2h-levelup.mp4   # −14 LUFS, writes the MP3, swaps audio into the MP4
node render.js --stills 1.3,3.6 out/ # PNG stills
```

Timing lives in `T` and the riff in `RIFF` at the top of the script in `template.html`; the same data drives the visuals and the score at the bottom of `buildAudio()`.
