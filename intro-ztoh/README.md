# GuitarZero2Hero intro: Z to H

An 8.5-second kinetic-type intro (60 fps, stereo) in a flat Swiss poster style: three colors (brand red #B80016, paper #F2EEE6, ink #141113), huge Space Grotesk Bold, hard color blocks that wipe and cut on a 120 BPM grid. The idea is that ZERO and HERO differ by one letter. The Z turns 90° into an N, then the N's diagonal swings flat into the crossbar of an H, so ZERO becomes HERO with real letter geometry.

It comes in two cuts that share one engine and one soundtrack: 16:9 (1920×1080) and 9:16 (1080×1920). The vertical cut is recomposed rather than cropped. The Z gets a full-width square with its notes above and below, the four words stack in rows, and the bands, line, logo and lockup are refitted to the narrow frame.

## Scenes

| Start | Scene | What happens |
| --- | --- | --- |
| 0.00 s | Zero | A rule draws in over a riser. ZERO slams in on the first downbeat (0.25 s), a red block splits it on beat 2, marquee bands of ZERO wipe in on beat 3 and flip colors on beat 4. The O's pulse with the kick. |
| 2.25 s | Z to H | A red column takes the Z, E R O are knocked out on sixteenths and the camera pushes in. The Z rotates 90° into an N (2.75 s), and the diagonal falls flat and locks with a clack (3.00 s). HERO lands on the crash (3.25 s) as the red floods the frame. A dial and a Z / N / H column annotate the move. |
| 3.75 s | Zero2Hero | GUITAR, ZERO, 2 and HERO cut into a four-block grid on the eighths, close into one line (4.75 s), then zip shut into G Z 2 H (5.00 s). The initials slam into the traced logo (5.25 s), and its four hands pop on 5.50, 5.75, 6.00 and 6.25 s, each with a zero ring. |
| 6.50 s | Lockup | The hands drop out and the logo shrinks back to G Z 2 H. On 6.75 s the red rises, the wordmark (with the brand's looped 2) slides out of its capitals, and the URL follows at 7.00 s. During the hold the beat row ticks and a small corner Z turns into N, then H, on the last beats. |

## Files

| File | What it is |
| --- | --- |
| `gz2h-ztoh.mp4` | 16:9 video, 1920×1080, 60 fps, H.264 + AAC 256k, motion blur (4 sub-frames), about −14 LUFS |
| `gz2h-ztoh-vertical.mp4` | 9:16 video, 1080×1920, same soundtrack |
| `gz2h-ztoh.html` | Self-contained player (16:9 by default, with a 16:9 / 9:16 toggle). It streams the MP3. |
| `gz2h-ztoh.wav`, `.mp3` | The mastered soundtrack |
| `gz2h-ztoh-storyboard.png`, `gz2h-ztoh-vertical-storyboard.png` | Twelve key frames from each video |
| `src/` | `template.html` (engine, score, player), `build.js`, `render.js`, `tools/`, `assets/` |

## How it is built

- **The letter.** `ZNH` in the template describes the Z, N and H of Space Grotesk Bold as two rails, one link band and a small crotch step, all in font units. Their outlines match the font glyphs exactly, so the word can switch between glyphs and the construction at any time without a visible change. Rotating the N frame by −90° gives the Z. Interpolating the parameters while turning gives the N. Swinging the band's angle to 0 gives the H.
- **Type.** `tools/glyphs.js` extracts the Space Grotesk Bold outlines, kerning and the wordmark layout (ink width ÷ cap height = 11.27) into `assets/glyphs.json`. The brand's looped "2" comes from `wordmark-two.json`.
- **Blocks.** Every frame is a stack of flat blocks. Each block clips, fills and redraws the content in its own colors, so type inverts exactly at block edges.
- **Layout.** `makeLayout(W, H)` positions everything from the frame size. `?v` selects 1080×1920.
- **Motion blur.** `GZ.capture(t, n)` averages n sub-frames over a 180° shutter that opens at t. Every cut sits on a frame boundary, so cut frames stay clean.
- **Sound.** `buildAudio()` uses `assets/audio-kit.js`: a gallop riff of palm-muted E chugs, rising power-chord stabs on the four words (E5 G5 A5 B5), a panned swish for the rotation, a dry two-stage clack for the lock, a crash on HERO, an E minor arpeggio for the four hands, and a final chord where the clean guitars turn the E to major. `KICKS` drives both the kick drum and the pulsing zeros.

## Edit and re-render

```sh
cd intro-ztoh/src
NODE_PATH=<dir with opentype.js> node tools/glyphs.js   # only to regenerate assets/glyphs.json
node build.js                                          # → ../gz2h-ztoh.html
node render.js --stills 2.6,3.0 out/ [--v] [--q 0.5] [--mb]   # PNG stills (9:16, half size, motion blur)
node render.js                                         # → ../gz2h-ztoh.wav + ../gz2h-ztoh.mp4
bash tools/master.sh ../gz2h-ztoh.wav ../gz2h-ztoh.mp4 # −14 LUFS, writes the MP3, swaps audio into the MP4
node render.js --vertical                              # → ../gz2h-ztoh-vertical.mp4 with the mastered WAV
```

Timing lives in `T` at the top of the template script. Everything sits on `bt(k)`, which is beat k at 120 BPM with the first downbeat at 0.25 s. The score is at the bottom of `buildAudio()`.
