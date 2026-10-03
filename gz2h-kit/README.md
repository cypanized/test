# GZ2H intro kit

Shared starting point for GuitarZero2Hero intro animations. Two finished intros live in `reference/` and set the quality bar:

- `reference/cinematic/`: crimson, cinematic. Close-up guitar neck, pluck, strum shockwave reveals the logo, hands pop on beats, morph to wordmark. 2D canvas plus bloom. See `storyboard.png`.
- `reference/phosphor/`: oscilloscope / CRT. Waveforms, Lissajous intervals, beam-traced logo and wordmark, WebGL CRT shader. See `storyboard.png`.

Read both `template.html` files before starting. They show the page structure, the deterministic `render(t)`, the audio score, the player UI and the render pipeline. Reuse freely.

## Brand facts

- **Brand:** GuitarZero2Hero (GZ2H), online guitar lessons. URL `guitarzero2hero.com` (always lowercase).
- **Colors from the original intro:** brand red `#B80016` (184,0,22), dark crimson `#4B0011` (75,0,17). Each intro picks its own palette around these.
- **Logo (`assets/logo-paths.json`):** traced from the original hand-drawn logo into SVG path strings. Fill them with `ctx.fill(new Path2D(d), 'evenodd')`. Coordinates are "logo units" on a 3220×1320 canvas.
  - Logo bbox: x 58–3165, y 51–1274, centre (1611, 662).
  - At scale 0.38 it is about 1180 px wide.
  - Pieces and their bboxes, as [x0, y0, x1, y1]:
    - `G` [58,251,778,922]
    - `horns` (rock-horns hand on the G) [313,65,536,271], wrist about (392,262)
    - `Z` [821,207,1442,913]
    - `thumb` (thumbs-up on the Z) [868,104,1080,347], wrist about (985,336)
    - `two` [1465,208,1992,922]
    - `wave` (waving hand on the 2) [1527,51,1761,282], wrist about (1700,270)
    - `H` [2042,207,3165,1274]. A U-shaped H whose crossbar continues into a guitar neck and headstock with 3+3 tuning pegs. The letter part is x < 2705; the neck runs y 503–627 from x≈2200 to the nut at x≈2790; the headstock runs to x 3165; peg centres are at top y≈432 (x 2885, 2960, 3046) and bottom y≈697.
    - `ok` (OK hand sitting on the H/neck junction) [2427,317,2704,611], wrist about (2650,600)
  - The letters' shared baseline is y≈922; the H's U dips to 1274.
- **Wordmark:** "GuitarZero2Hero" set in **Space Grotesk Bold** with open tracking. Ink width ÷ cap height ≈ 11.27, all one word with no spaces.
  - The brand's **"2" has a loop at its bottom-left that the font lacks**. Use the traced outline in `assets/wordmark-two.json` (fit it to the font's "2" box; see `reference/phosphor/tools/shapes.js`). Alternatively, draw the wordmark from `assets/shapes.json`.
- **`assets/shapes.json`:** logo and wordmark outlines as 4096-point polylines in 1920×1080 screen coordinates.
  - Format: `logo` and `wm` are flat arrays of [x, y, jumpFlag]. A jumpFlag of 1 starts a new contour.
  - Placement: the logo is centred at (960, 515), 1102 px wide; the wordmark is 1400 px wide with its baseline at y=590.
  - Includes the looped 2. Great for draw-on and outline effects.
- **Fonts:**
  - `SpaceGrotesk-VF.woff2` (variable 300–700), `SpaceMono-400.woff2`, `SpaceMono-700.woff2`: inline these as base64 and load them with `FontFace`, as the references do.
  - `SpaceGrotesk-700.ttf` is for opentype.js glyph outlines. It is installed in `gz2h-kit/node_modules`; use `NODE_PATH=/home/user/test/gz2h-kit/node_modules`.

## Deliverables (in your own folder `/home/user/test/intro-<slug>/`)

| File | Spec |
| --- | --- |
| `gz2h-<slug>.html` | Self-contained interactive player, built by `src/build.js` from `src/template.html` with everything inlined. Page contract below. |
| `gz2h-<slug>.mp4` | 1920×1080, 60 fps, H.264 yuv420p (crf 16–18, no `-tune grain`), AAC 256k 48 kHz stereo. 6–9 s. Under 40 MB. Motion blur through sub-frame averaging (see `capture()` in the phosphor reference) where motion is fast. |
| `gz2h-<slug>.wav` / `.mp3` | The soundtrack, mastered with `tools/master.sh` (about −14 LUFS, true peak ≤ −1 dBTP). The MP3 is what the player streams. |
| `gz2h-<slug>-storyboard.png` | 8–12 labelled key frames from the final MP4, via `tools/storyboard.sh`. |
| `README.md` | What it is, a scene list, files, and how to re-render (mirror `/home/user/test/intro-phosphor/README.md`). |
| `src/` | `template.html`, `build.js`, `render.js`, any tools and copied assets. The folder must be self-contained (copy assets in; don't reference `gz2h-kit` paths at runtime). |

## Engine contract

- **Deterministic:** `render(t)` must be a pure function of time. Use seeded randomness (mulberry32 or a hash), closed-form particles and no stateful simulations, so any frame renders in any order. Draw at a 1920×1080 logical size, scaled by a quality factor `Q` for live playback.
- `window.GZ = { DUR, ready, frame(t), capture(t, n) → base64 PNG (n = motion-blur sub-frames), audio() → { b64, peak } }`. `audio()` renders the score in an `OfflineAudioContext` and returns a WAV (use `gzWavB64` from `lib/audio-kit.js`).
- **`?render` query:** hide the UI and show only the 1920×1080 canvas (see the references' `body.render` CSS and `render.js`).
- **Sound:** synthesize the score with `lib/audio-kit.js` (`gzMix()`: Karplus-Strong guitar, distorted double-tracked rigs, drums, risers, whooshes), or write your own synthesis on top of it, such as chiptune oscillators. Mix lessons from earlier intros:
  - The guitar must carry the big hits. Check with `tools/bands.py`: on a hit, 500–6000 Hz should clearly outweigh 20–120 Hz.
  - Keep kick ≤ 0.75 and boom ≤ 0.55.
  - FX like CRT thumps and hums must sit well below the music.
  - Nobody can listen during the build, so measure.

## Player page contract (it will be published as a claude.ai Artifact)

- **No `<!doctype>`, `<html>`, `<head>` or `<body>` tags.** Start the file with `<title>` (a 2–4 word name, such as "GZ2H Gig Poster"), then `<style>`.
- Colors are tokens on `:root`. Commit to one deliberate look and set `color-scheme` accordingly. `html, body` get an explicit background.
- No external resources: fonts are inlined, and no network fetches except the sibling MP3 file. If you need a library, only cdnjs.cloudflare.com is allowed; prefer none.
- **Layout:** works at 400 px wide with **no horizontal scroll**, and has 16 px+ side gutters. Use visible `:focus-visible` styles, respect `prefers-reduced-motion`, and no `alert`/`prompt`.
- **Behaviour:** copy it from `reference/phosphor/template.html`, adapting the styling:
  - Poster frame at rest: pick a strong frame and set `POSTER`.
  - A big "Play with sound" overlay button.
  - A transport with play/pause, a sound toggle, a scrubber with scene ticks and a timecode.
  - Scene chips (about 4, each with timestamp, name and a one-line description) that jump and play.
- **iPhone-safe audio is mandatory:** copy the `SOUND_FILE` / `<audio>` playback block from the phosphor reference verbatim. The soundtrack MP3 plays through an `<audio>` element, which the silent switch doesn't mute; there is a Web Audio fallback and a "No sound" label. Keep the `GZ.player` debug hook for tests.
- **Style the player chrome to belong to your intro's world:** paper and ink for a print look, pixel UI for 8-bit, and so on. Keep the same controls and behaviour.
- **On-screen copy:** brand name, URL, short functional labels (note names, levels, scene names). No invented slogans or claims about the business. Don't use em dashes in copy.

## Required verification before you report

1. **Stills:** `node src/render.js --stills t1,t2,... dir` across the whole timeline. **Look at them** with the Read tool and fix what's off. Iterate.
2. **Final video:** after the full render, run `tools/filmstrip.sh` and look at every strip for glitches, popping, unreadable text or broken transitions.
3. **Audio:**
   - Run `python3 tools/bands.py gz2h-<slug>.wav "label:a-b" ...` on your key sections.
   - Run `tools/master.sh gz2h-<slug>.wav gz2h-<slug>.mp4`.
   - Confirm with `ffmpeg -i gz2h-<slug>.mp4 -af ebur128=peak=true -f null -` that it's about −14 LUFS with a peak ≤ −1.
4. **Player:**
   - `node tools/playtest.js /abs/path/gz2h-<slug>.html` must show `mode: "file"`, an advancing `audioT` and no errors. Then move the MP3 away and confirm `mode: "synth"`, and put it back.
   - `node tools/ui.js /abs/path/gz2h-<slug>.html /some/dir` must show no OVERFLOW and no errors. Look at both screenshots.
5. **Storyboard:** `tools/storyboard.sh gz2h-<slug>.mp4 gz2h-<slug>-storyboard.png 4 "t|LABEL" ...`

## House rules

- **The CPU is shared with other builders running in parallel (4 cores).** Iterate on stills. Do at most two full MP4 renders, and use 2–4 motion-blur sub-frames.
- Work only inside your own folder. **Do not run git**, do not publish artifacts, do not touch other `intro-*` folders or this kit.
- Put scratch files in a `scratch/` subfolder of your folder, and delete it before reporting.
