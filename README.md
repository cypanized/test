# How to Tie a Tie: an interactive 3D guide

A step-by-step guide to the three classic tie knots (**Four-in-Hand**, **Half Windsor** and **Windsor**), rendered live in 3D.

**Open [`dist/index.html`](dist/index.html) in any modern browser.** It's a single self-contained file that works offline.

## What makes it different

- **Physically tied, never self-intersecting.** Every move is performed the way a person ties a tie. One hand holds the knot. The other grips the wide blade and carries it along a real path: in front of the narrow blade, behind it, up through the neck loop, down through the front band. The cloth follows on its own. The solver gives a hard guarantee that fabric never passes through fabric (or the collar). Between distance checks, every point may move at most 45% of its distance to the nearest other piece of cloth, measured point-to-face and edge-to-edge. That's the idea behind recent penetration-free cloth solvers, such as Offset Geometric Contact. Layers also never come closer than 0.8 mm, which leaves room for the compressed storage. The animation is baked offline (`tools/bake.mjs`). Before it's written, the baker decodes every frame exactly as the browser will and checks it with an exact segment–triangle intersection test. It also checks the in-between blends the player draws on high-refresh screens; where a blend would touch, the player steps to the next frame instead.
- **Real cloth behaviour.** 264 × 5 particles cut to a real tie's width profile: silk that hardly stretches (extra lengthwise solver passes keep a hanging blade from sagging longer than it is), soft bending along the length, stiffer across the width, real thickness, gravity and air drag, the shirt, neck and collar as solid bodies.
- **Three points of view.** *Mirror*, the default, is how you see yourself while tying. *Your view* is first person, looking down at your own chest: drag to glance around, scroll to lean in. *Facing you* is for tying someone else's tie.
- **Lengths that add up.** For each knot, the guide works out where the narrow end has to start so that the finished tip lands on the belt buckle. That's why the Windsor's drape step starts so much higher than the Four-in-Hand's.
- **The path of the wide end.** A live map traces each move through the three regions (Left, Centre, Right), solid for over the front and dashed for underneath. It uses the notation from Fink & Mao's *The 85 Ways to Tie a Tie*.
- **Guides.** The part that moved glows briefly, and gold arrows show the motion. Any part of an arrow hidden behind the tie still shows faintly.
- **Controls:** ← / → for steps, Space to play, V to cycle points of view, M to flip between mirror and facing views.
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
node tools/bake.mjs   # re-simulate and verify the cloth (several minutes)
npm run build   # -> dist/index.html (three.js + app + baked cloth, all inlined)
npm run dev     # rebuild on change, serve on http://localhost:8080
```

| Path | Contents |
| --- | --- |
| `src/engine/tie-engine.js` | Turns a move sequence into a tie pose (the shape each step aims for): knot geometry, free ends, length solving, guide arrows |
| `src/sim/cloth.js` | Penetration-free cloth solver: stretch/shear/bending, contact offset, conservative motion bounds (point–face, edge–edge, collar) |
| `src/sim/choreo.js` | The hands: for each move, a grip and a path round the correct side of the knot, then the step's pose to settle into |
| `src/sim/verify.js` | Exact intersection check used on every baked frame |
| `tools/bake.mjs` | Runs the simulation offline, verifies it, and writes compressed playback data to `src/baked/` |
| `src/sim/player.js` | Decodes and plays the baked frames in the browser |
| `src/engine/body.js` | Shared measurements for the dress form (torso, collar, belt) |
| `src/scene/` | three.js stage and cameras (mirror / your view / facing you), dress form, the smoothed thick-silk mesh, fabric textures |
| `src/ui/knotmap.js` | The "path of the wide end" diagram |
| `src/knots.js` | Knot definitions and all step copy |

## Sources

- Thomas Fink & Yong Mao, *The 85 Ways to Tie a Tie* (1999)
- Wikipedia: [Four-in-hand knot](https://en.wikipedia.org/wiki/Four-in-hand_knot), [Half-Windsor knot](https://en.wikipedia.org/wiki/Half-Windsor_knot), [Windsor knot](https://en.wikipedia.org/wiki/Windsor_knot)
- Hirsch et al., "More ties than we thought" (2015)

three.js is MIT-licensed; its licence notice is kept in the built bundle.
