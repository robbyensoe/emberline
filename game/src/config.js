// Emberline's tuning: one place for the numbers the sim, the renderer and the
// screenshot scenes all share, so a staged frame and a played frame agree.

/** Fixed simulation step, seconds. The world only ever advances by this. */
export const STEP = 1 / 60;

/** Playfield bounds, metres. x is lateral (sea is -x), y is altitude. */
export const WORLD = {
  minX: -190,
  maxX: 190,
  minAlt: 6,
  maxAlt: 230,
  groundClearance: 5,
};

/** The Kestrel, a little ember-orange mail plane. */
export const PLANE = {
  baseSpeed: 46, // m/s, throttle settles here
  boostSpeed: 78,
  slowSpeed: 34,
  turnRate: 62, // lateral m/s at full bank
  climbRate: 26, // vertical m/s at full pitch
  bankMax: 0.62, // radians of visual bank at full turn
  radius: 7, // collision half-width
};

/** A dawn ring: fly through its heart to score. */
export const RING = {
  radius: 15,
  heartRadius: 9.5, // inside this of the centre counts as a clean pass
  score: 100,
  heartBonus: 50,
};

/** The three legs of the mail run, in metres of course length. */
export const LEGS = [
  { name: 'Ember Bay', length: 2400, rings: 6, spires: 4, storms: 1 },
  { name: 'The Ash Reach', length: 2900, rings: 7, spires: 6, storms: 3 },
  { name: 'Cinder Bay Approach', length: 2600, rings: 5, spires: 4, storms: 2 },
];

/** The Cinder Bay strip: the run ends by landing on it. */
export const RUNWAY = {
  x: 62, // centreline, on the headland (land side)
  width: 26,
  length: 420,
  landAlt: 26, // touchdown window: at or below this over the strip
  landSpeed: 52, // and at or below this speed
};

/** Canvas logical size; the page scales it to the window. */
export const VIEW = { width: 1280, height: 720, horizon: 252 };
