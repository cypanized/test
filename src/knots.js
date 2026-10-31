// Knot definitions and step-by-step copy.
//
// Move notation follows Thomas Fink & Yong Mao, "The 85 Ways to Tie a Tie"
// (1999). Diagrams in that book are drawn as you'd see the tie in a mirror,
// which is also how this guide is drawn by default.
//   L / C / R  where the wide end goes: your left, the centre (up into the
//              neck loop) or your right
//   i          it passes over the front of the knot
//   o          it passes underneath, behind the knot
//   T          tuck it down through the front loop you just made
//
// Each knot's steps line up with its states:
//   [drape, after move 1, ..., after the final T, tightened, finished]

export const KNOTS = [
  {
    id: 'four-in-hand',
    name: 'Four-in-Hand',
    short: '4-in-Hand',
    tagline: 'The everyday classic',
    moves: ['Li', 'Ro', 'Li', 'Co', 'T'],
    fm: 2,
    size: 1.0,
    bandLean: 0.3, // the Four-in-Hand is famously a little lopsided
    pinch: 0.3,
    flop: { 4: 1 },
    level: 1,
    stats: { size: 'Small', shape: 'Slim, slightly asymmetric', formality: 'Everyday to business', collar: 'Point & narrow-spread collars', unties: 'Yes, slides apart' },
    blurb: 'Quick, narrow and slightly off-centre, with a lot of character. Learn this one first; it suits almost every tie and occasion.',
    steps: [
      {
        title: 'Drape the tie',
        text: 'Turn your collar up and hang the tie around your neck, <b>seam facing in</b>. Put the <b>wide end on your right</b> and let the narrow end hang to about your <b>third shirt button</b>.',
        tip: 'Starting length is the only thing that decides where the tip ends up. If it finishes too long or too short, move the narrow end up or down next time.',
      },
      {
        title: 'Cross over',
        text: 'Cross the <b>wide end over</b> the narrow end, to your <b>left</b>.',
        tip: 'Pinch the crossing between finger and thumb. It becomes the centre of the knot.',
      },
      {
        title: 'Wrap behind',
        text: 'Bring the wide end <b>underneath</b> the narrow end and back to your <b>right</b>.',
        tip: 'You are now looking at the back (seam side) of the wide end. That is correct.',
      },
      {
        title: 'Across the front',
        text: 'Bring the wide end <b>across the front</b> again, to your <b>left</b>. This horizontal band will be the face of your knot.',
        tip: 'Slip a finger under the band to keep it open. You will tuck through it in two steps.',
      },
      {
        title: 'Up through the neck loop',
        text: 'Bring the wide end <b>up behind</b> the knot and <b>out through the neck loop</b>, beside your collar.',
        tip: 'Push up from underneath, between the knot and your shirt.',
      },
      {
        title: 'Tuck through the front',
        text: 'Feed the wide end <b>down through the front band</b> you made in step 3, then pull it through.',
        tip: 'Keep a finger in the band and guide the tip down past it.',
      },
      {
        title: 'Slide it up',
        text: 'Hold the <b>narrow end</b> and gently <b>slide the knot up</b> to your collar until it is snug.',
        tip: 'Snug, not choking. The knot should cover your top button and fill the gap in the collar.',
      },
      {
        title: 'Dimple, length, collar',
        text: 'Pinch a <b>dimple</b> just under the knot as you give a final tug. The tip should just reach your <b>belt buckle</b>. Fold your collar down.',
        tip: 'Tuck the narrow end through the keeper loop on the back of the wide blade.',
      },
    ],
  },
  {
    id: 'half-windsor',
    name: 'Half Windsor',
    short: 'Half Windsor',
    tagline: 'The balanced all-rounder',
    moves: ['Li', 'Ro', 'Ci', 'Lo', 'Ri', 'Co', 'T'],
    fm: 7,
    size: 1.12,
    pinch: 0.36,
    flop: { 3: -1, 6: -1 },
    level: 2,
    stats: { size: 'Medium', shape: 'Neat, symmetrical triangle', formality: 'Business & interviews', collar: 'Most collars, incl. semi-spread', unties: 'No, needs untying' },
    blurb: 'A tidy, symmetrical triangle, a little fuller than the Four-in-Hand. It only wraps one side of the neck loop, which is why it is called a <i>half</i> Windsor.',
    steps: [
      {
        title: 'Drape the tie',
        text: 'Collar up, tie around your neck, <b>seam facing in</b>. <b>Wide end on your right</b>, narrow end hanging to just below your <b>second shirt button</b>.',
        tip: 'This knot uses more length than a Four-in-Hand, so start with the narrow end higher.',
      },
      {
        title: 'Cross over',
        text: 'Cross the <b>wide end over</b> the narrow end, to your <b>left</b>.',
        tip: 'Hold the crossing point; everything wraps around it.',
      },
      {
        title: 'Wrap behind',
        text: 'Bring the wide end <b>underneath</b> the narrow end, back to your <b>right</b>.',
        tip: 'The seam side of the wide end now faces you.',
      },
      {
        title: 'Up to the centre',
        text: 'Bring the wide end <b>up over the front</b> of the neck loop, towards the centre.',
        tip: 'It goes over the right-hand side of the loop and points up at your chin.',
      },
      {
        title: 'Down through the loop',
        text: 'Pass it <b>down through the neck loop</b> and pull it out to your <b>left</b>.',
        tip: 'This single wrap around the loop is the “half” in Half Windsor, and it is what centres the knot.',
      },
      {
        title: 'Across the front',
        text: 'Bring the wide end <b>across the front</b>, from your left to your <b>right</b>, to make the front band.',
        tip: 'Note the direction: left to right, the opposite of the Four-in-Hand.',
      },
      {
        title: 'Up through the neck loop',
        text: 'Bring the wide end <b>up behind</b> the knot and <b>out through the neck loop</b>.',
        tip: 'Push it up from underneath, between the knot and your shirt.',
      },
      {
        title: 'Tuck through the front',
        text: 'Feed the wide end <b>down through the front band</b> and pull it through.',
        tip: 'Hold the band open with a finger while you thread the tip down.',
      },
      {
        title: 'Slide it up',
        text: 'Hold the <b>narrow end</b> and <b>slide the knot up</b> to your collar.',
        tip: 'Shape the knot as you go. Press its sides in to keep the triangle crisp.',
      },
      {
        title: 'Dimple, length, collar',
        text: 'Pinch a <b>dimple</b> under the knot, check that the tip meets your <b>belt buckle</b>, and fold your collar down.',
        tip: 'Tuck the narrow end through the keeper loop on the back of the wide blade.',
      },
    ],
  },
  {
    id: 'windsor',
    name: 'Windsor',
    short: 'Windsor',
    tagline: 'The formal statement',
    moves: ['Li', 'Co', 'Ri', 'Lo', 'Ci', 'Ro', 'Li', 'Co', 'T'],
    fm: 31,
    size: 1.22,
    pinch: 0.42,
    flop: { 2: 1, 5: 1, 8: 1 },
    level: 3,
    stats: { size: 'Large', shape: 'Wide, full triangle', formality: 'Formal & ceremonial', collar: 'Spread & cutaway collars', unties: 'Yes, slides apart' },
    blurb: 'Big, bold and symmetrical, made by wrapping both sides of the neck loop. It needs a lot of tie, so tall wearers may want an extra-long one.',
    steps: [
      {
        title: 'Drape the tie',
        text: 'Collar up, tie around your neck, <b>seam facing in</b>. <b>Wide end on your right</b>, and let the narrow end hang only a little below your <b>collar points</b>.',
        tip: 'The Windsor uses the most length of any common knot. If you are tall, an extra-long tie makes this much easier.',
      },
      {
        title: 'Cross over',
        text: 'Cross the <b>wide end over</b> the narrow end, to your <b>left</b>.',
        tip: 'Pinch the crossing. It is the hub of the knot.',
      },
      {
        title: 'Up through the neck loop',
        text: 'Bring the wide end <b>up behind</b> the crossing and <b>out through the neck loop</b>.',
        tip: 'You will see its seam side as it comes out at the top.',
      },
      {
        title: 'Down to the right',
        text: 'Bring the wide end <b>down over the front</b>, to your <b>right</b>.',
        tip: 'It wraps over the right-hand side of the neck loop.',
      },
      {
        title: 'Behind the knot',
        text: 'Pass the wide end <b>behind the knot</b>, to your <b>left</b>.',
        tip: 'Keep everything snug. Loose wraps make a lumpy Windsor.',
      },
      {
        title: 'Up to the centre',
        text: 'Bring the wide end <b>up over the front</b> of the neck loop, towards the centre.',
        tip: 'This time it goes over the left-hand side of the loop.',
      },
      {
        title: 'Down through the loop',
        text: 'Pass it <b>down through the neck loop</b> and out to your <b>right</b>.',
        tip: 'Both sides of the loop are now wrapped. That double wrap gives the Windsor its full, symmetrical shape.',
      },
      {
        title: 'Across the front',
        text: 'Bring the wide end <b>across the front</b>, from right to <b>left</b>, to make the front band.',
        tip: 'Leave a finger under the band; you will tuck through it next.',
      },
      {
        title: 'Up through the neck loop',
        text: 'Bring the wide end <b>up behind</b> the knot and <b>out through the neck loop</b> once more.',
        tip: 'From underneath, between the knot and your shirt.',
      },
      {
        title: 'Tuck through the front',
        text: 'Feed the wide end <b>down through the front band</b> and pull it through.',
        tip: 'Pull slowly so the band stays smooth over the face of the knot.',
      },
      {
        title: 'Slide it up',
        text: 'Hold the <b>narrow end</b> and <b>slide the knot up</b> until it sits firmly in your collar.',
        tip: 'A Windsor looks best snug and centred, filling a spread collar.',
      },
      {
        title: 'Dimple, length, collar',
        text: 'Pinch a <b>dimple</b> under the knot, check that the tip meets your <b>belt buckle</b>, and fold your collar down.',
        tip: 'Tuck the narrow end through the keeper loop on the back of the wide blade.',
      },
    ],
  },
];

/** Displayed states for a knot, aligned with its steps. */
export function statesFor(knot) {
  const s = [{ kind: 'drape' }];
  for (let k = 1; k <= knot.moves.length; k++) s.push({ kind: 'moves', k });
  s.push({ kind: 'tight' }, { kind: 'finish' });
  return s;
}

/** Camera framing for each state. */
export function viewFor(state) {
  if (state.kind === 'drape') return 'full';
  if (state.kind === 'finish') return 'finish';
  if (state.kind === 'tight') return 'collar';
  return 'knot';
}
