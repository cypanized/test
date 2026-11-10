# How to Tie a Tie

An interactive, fold-by-fold guide to tying a tie. Open `index.html` in a browser; it is a single self-contained file.

## What it does

- **Six knots** (Four-in-Hand, Half Windsor, Full Windsor, Pratt, Kelvin, Oriental), plus four more from Fink and Mao's 85.
- **Animated folds.** The tie is modelled as one strip of cloth. Each step is a real flat fold about a crease, so every over and under is correct by construction, and the seam side shows exactly when it would on a real tie.
- **Mirror and facing views**, a scrubber that drags through the folds continuously, slow speed, and arrow-key stepping.
- **Route map and knot code.** Each knot is also drawn as a walk around the three regions (left, right, centre) in Fink–Mao notation.
- **Reference sheet**: tie anatomy, length and dimple, collar pairing, a comparison table and common fixes.

## How the diagrams are made

Nothing is hand-drawn per step. `layout()` places the fold points for a knot from its code (for example `Li Ro Li Co T`), `ribbon()` turns the chain of folds into tapered strips with correct creases, and `buildScene()` animates one fold at a time by rotating the free end about its crease. Adding a knot is one line in `KNOT_DATA`.

Knot codes follow T. Fink and Y. Mao, "Designing tie knots by random walks", *Nature* 398 (1999).
