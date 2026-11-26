// A tiny seeded random source (mulberry32). The whole course — rings, spires,
// storms, villages, the coast itself — is drawn from one seed, so a played run
// and a screenshot staged from the same seed are the same run.

export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random in [min, max). */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** Random integer in [min, max]. */
export function intRange(next, min, max) {
  return Math.floor(range(next, min, max + 1));
}
