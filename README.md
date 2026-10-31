# How to Tie a Tie: an interactive 3D guide

A step-by-step guide to the three classic tie knots (**Four-in-Hand**, **Half Windsor** and **Windsor**), rendered live in 3D.

**Open [`dist/index.html`](dist/index.html) in any modern browser.** It's a single self-contained file that works offline.

## What makes it different

- **A real, continuous tie.** The tie is simulated as one 150 cm ribbon with a real width profile: a narrow blade, a 3 cm neck section and an 8.5 cm wide blade with pointed tips. Over-and-under crossings, the seam side showing after a pass underneath, and how much length each knot uses all come out of the geometry. They aren't drawn in by hand.
- **Lengths that add up.** For each knot, the guide works out where the narrow end has to start so that the finished tip lands on the belt buckle. That's why the Windsor's drape step starts so much higher than the Four-in-Hand's.
- **Mirror view by default.** Every step is shown the way you see yourself in a mirror. One click switches to *Facing you*, for tying someone else's tie.
- **The path of the wide end.** A live map traces each move through the three regions (Left, Centre, Right), solid for over the front and dashed for underneath. It uses the notation from Fink & Mao's *The 85 Ways to Tie a Tie*.
- **Animated moves.** The wide end swings into each new position and the part that moved glows briefly. Gold guide arrows show the motion; any part of an arrow hidden behind the tie still shows faintly.
- **Spin it round.** Drag to look behind the knot, scroll to zoom. Use ← / → for steps, Space to play, M to flip the view.
- Also on the page: a knot chooser, set-up tips, finishing touches (dimple, length, collar), troubleshooting, and a short section on the maths of tie knots.

## Knot sequences (Fink–Mao notation, mirror view)

| Knot | Sequence |
| --- | --- |
| Four-in-Hand (no. 2) | `Li Ro Li Co T` |
| Half Windsor (no. 7) | `Li Ro Ci Lo Ri Co T` |
| Windsor (no. 31) | `Li Co Ri Lo Ci Ro Li Co T` |

`L/C/R` = where the wide end goes (your left, the centre/neck loop, your right) · `i` = over the front · `o` = underneath · `T` = tuck through the front band.

## Development

```bash
npm install
npm run build   # -> dist/index.html (three.js + app bundled and inlined)
npm run dev     # rebuild on change, serve on http://localhost:8080
```

| Path | Contents |
| --- | --- |
| `src/engine/tie-engine.js` | Turns a move sequence into a tie pose: knot geometry, free ends that drape under gravity, length solving, guide arrows |
| `src/engine/body.js` | Shared measurements for the dress form (torso, collar, belt) |
| `src/scene/` | three.js stage, dress form, the ribbon mesh and fabric textures |
| `src/ui/knotmap.js` | The "path of the wide end" diagram |
| `src/knots.js` | Knot definitions and all step copy |

## Sources

- Thomas Fink & Yong Mao, *The 85 Ways to Tie a Tie* (1999)
- Wikipedia: [Four-in-hand knot](https://en.wikipedia.org/wiki/Four-in-hand_knot), [Half-Windsor knot](https://en.wikipedia.org/wiki/Half-Windsor_knot), [Windsor knot](https://en.wikipedia.org/wiki/Windsor_knot)
- Hirsch et al., "More ties than we thought" (2015)

three.js is MIT-licensed; its licence notice is kept in the built bundle.
