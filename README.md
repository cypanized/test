# How to Tie a Tie

An interactive, fold-by-fold guide to tying a tie, rendered in 3D. Open `index.html` in a browser; it is a single file that loads three.js (r128) from cdnjs.

## What it does

- **A 3D stage.** The tie is a cloth ribbon on a dress form, lit with soft shadows. Drag to turn it, use Close-up to frame the knot, and switch between three views: Mirror, Facing, and Your eyes (looking down your own chest).
- **Real folds.** Each step is one fold of a single strip of cloth, so every over and under is correct by construction and the seam side shows exactly when it would on a real tie. Folds toward you flip through the air; folds that go behind are fed through the gap between tie and shirt, tip first; the cloth gathers where it passes through the neck loop.
- **Ten knots.** Four-in-Hand, Half Windsor, Full Windsor, Pratt, Kelvin and Oriental, plus Victoria, Nicky, St Andrew and Plattsburgh from Fink and Mao's 85.
- **Controls.** Play, step, drag the scrubber through a fold, slow speed, arrow keys.
- **Route map and knot code.** Each knot is also drawn as a walk around the three regions (left, right, centre) in Fink–Mao notation.
- **Reference sheet.** Tie anatomy, length and dimple, collar pairing, a comparison table and common fixes.
- **Flat mode.** The original 2D diagram is one click away, and is used automatically where WebGL is unavailable.

## How it is built

Nothing is drawn by hand per step.

- `layout()` places the fold points for a knot from its code (for example `Li Ro Li Co T`).
- `ribbon()` turns the chain of folds into tapered strips with correct creases.
- `buildScene3()` is the 3D choreography: which fold is in progress, whether it flips or feeds, and when the wide end lifts out through the neck loop.
- `ribbonRows()` turns the strips into one continuous cloth mesh with a layer depth per strip, rounded folds between layers, and texture coordinates fixed to the material so the stripes stay continuous across folds.
- `Stage3D` owns the three.js scene: dress form, collar, lights, camera, arrows and labels.
- `buildScene()` and `sceneSVG()` are the flat SVG renderer used for the thumbnails, the length figures and Flat mode.

Adding a knot is one line in `KNOT_DATA`.

Knot codes follow T. Fink and Y. Mao, "Designing tie knots by random walks", *Nature* 398 (1999).
