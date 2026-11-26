// Emberline's world: a mail plane on a three-leg dawn run along a volcanic
// coast. The sim is fixed-step and fully seeded, so a run — and every staged
// screenshot — is reproducible. The coast and the terrain height are analytic
// functions of distance flown, shared with the renderer, so what you see is
// exactly what you can hit.

import { LEGS, PLANE, RING, RUNWAY, WORLD } from './config.js';
import { makeRandom, range } from './random.js';

export const EVENT_RING = 1;
export const EVENT_HEART = 2;
export const EVENT_HIT = 4;
export const EVENT_LEG = 8;
export const EVENT_LANDED = 16;
export const EVENT_OVER = 32;

export const TOTAL_LENGTH = LEGS.reduce((sum, leg) => sum + leg.length, 0);
export const RUNWAY_START_Z = TOTAL_LENGTH - RUNWAY.length - 80;

/** The coastline's lateral position at course distance z: sea is x < coast. */
export function coastX(z) {
  return -28 + Math.sin(z * 0.0016) * 55 + Math.sin(z * 0.00043 + 1.7) * 38;
}

/** Ground height at (x, z): sea is 0, the land climbs inland, the last stretch
 *  is the Cinder Vale — a descending corridor cut to the runway plateau. */
export function terrainHeight(x, z) {
  const inland = x - coastX(z);
  if (inland <= 0) return 0;
  let h = Math.min(96, inland * 0.52);
  h += Math.max(0, Math.sin(z * 0.004 + x * 0.021)) * 9 * Math.min(1, inland / 60);
  if (z > RUNWAY_START_Z - 1600) {
    const floor = 10 + Math.max(0, RUNWAY_START_Z - z) * 0.022;
    h = Math.min(h, floor);
  }
  const onPlateau =
    z > RUNWAY_START_Z - 300 && Math.abs(x - RUNWAY.x) < 58 ? 1 : 0;
  if (onPlateau) {
    const blend = Math.min(1, (z - (RUNWAY_START_Z - 300)) / 220);
    h = h * (1 - blend) + 14 * blend;
  }
  return h;
}

/** Build the rings, spires and storm cells of one leg from the run's seed. */
function buildLeg(seed, legIndex, zBase) {
  const leg = LEGS[legIndex];
  const next = makeRandom(seed * 7919 + legIndex * 104729 + 17);
  const rings = [];
  for (let i = 0; i < leg.rings; i += 1) {
    // On the last leg the rings stop early: the final approach stays clean.
    const span = legIndex === LEGS.length - 1 ? 0.62 : 1;
    const z = ((leg.length * (i + 0.55)) / leg.rings) * span + range(next, -60, 60);
    const x = range(next, -120, 130);
    // A ring is only fair if the ground under it leaves room to fly through.
    const floor = terrainHeight(x, zBase + z) + 30;
    rings.push({
      z,
      x,
      y: Math.max(range(next, 48, 168), Math.min(196, floor)),
      hit: false,
      missed: false,
    });
  }
  const spires = [];
  for (let i = 0; i < leg.spires; i += 1) {
    const z = range(next, 200, leg.length - 160);
    const seaStack = next() < 0.3;
    const x = seaStack ? range(next, -165, -55) : range(next, 5, 172);
    const base = seaStack ? 0 : terrainHeight(x, zBase + z);
    spires.push({ z, x, base, top: base + range(next, 26, 72) });
  }
  const storms = [];
  for (let i = 0; i < leg.storms; i += 1) {
    const z = range(next, 300, leg.length - 200);
    const x = range(next, -140, 140);
    const r = range(next, 15, 22);
    storms.push({
      z,
      x,
      y: Math.max(range(next, 74, 178), terrainHeight(x, zBase + z) + r + 16),
      r,
    });
  }
  return { rings, spires, storms };
}

export function createWorld(seed) {
  const state = {
    time: 0,
    started: false,
    over: false,
    landed: false,
    reason: '',
    leg: 0,
    legZ: 0,
    z: 0,
    x: 0,
    alt: 92,
    speed: PLANE.baseSpeed,
    bank: 0,
    vspeed: 0,
    heading: 40,
    score: 0,
    combo: 0,
    bestCombo: 0,
    ringsHit: 0,
    ringsTotal: LEGS.reduce((sum, leg) => sum + leg.rings, 0),
    hull: 3,
    invuln: 0,
    shake: 0,
    banner: null,
    popups: [],
    course: null,
  };
  let zBase = 0;

  function loadLeg(legIndex) {
    zBase = LEGS.slice(0, legIndex).reduce((sum, leg) => sum + leg.length, 0);
    state.course = buildLeg(seed, legIndex, zBase);
  }

  function popup(text, x, y, z) {
    state.popups.push({ text, x, y, z, t: 0 });
    if (state.popups.length > 6) state.popups.shift();
  }

  function hitObstacle(events, what) {
    if (state.invuln > 0) return events;
    state.hull -= 1;
    state.combo = 0;
    state.invuln = 2.2;
    state.shake = 0.55;
    popup(what, state.x, state.alt + 12, state.legZ);
    events |= EVENT_HIT;
    if (state.hull <= 0) {
      state.over = true;
      state.reason = 'The Kestrel came down over the coast.';
      events |= EVENT_OVER;
    }
    return events;
  }

  const world = {
    state,

    reset() {
      Object.assign(state, {
        time: 0,
        started: false,
        over: false,
        landed: false,
        reason: '',
        leg: 0,
        legZ: 0,
        z: 0,
        x: 0,
        alt: 92,
        speed: PLANE.baseSpeed,
        bank: 0,
        vspeed: 0,
        heading: 40,
        score: 0,
        combo: 0,
        bestCombo: 0,
        ringsHit: 0,
        hull: 3,
        invuln: 0,
        shake: 0,
        banner: null,
        popups: [],
      });
      loadLeg(0);
    },

    /** Jump straight to a leg's start (used by the screenshot scenes). */
    startLeg(legIndex) {
      world.reset();
      state.leg = legIndex;
      state.legZ = 0;
      state.z = LEGS.slice(0, legIndex).reduce((sum, leg) => sum + leg.length, 0);
      state.started = true;
      loadLeg(legIndex);
    },

    /** Stage the final approach: last leg, lined up on the Cinder Bay strip. */
    beginApproach() {
      world.startLeg(LEGS.length - 1);
      const legStart = TOTAL_LENGTH - LEGS[LEGS.length - 1].length;
      state.legZ = RUNWAY_START_Z - legStart - 620;
      state.z = RUNWAY_START_Z - 620;
      state.x = RUNWAY.x - 14;
      state.alt = 44;
      state.speed = 47;
      for (const ring of state.course.rings) {
        if (ring.z < state.legZ) ring.missed = true;
      }
    },

    /** The next ring still to fly, or the runway on the last leg. */
    nextTarget() {
      for (const ring of state.course.rings) {
        if (!ring.hit && !ring.missed) return { kind: 'ring', x: ring.x, y: ring.y, z: ring.z };
      }
      if (state.leg === LEGS.length - 1) {
        return { kind: 'runway', x: RUNWAY.x, y: 20, z: RUNWAY_START_Z - (TOTAL_LENGTH - LEGS[2].length) + 120 };
      }
      return null;
    },

    /**
     * Advance one fixed step. input: { turn, pitch, boost } in [-1, 1].
     * Returns the event bitmask for sound and effects.
     */
    step(dt, input) {
      let events = 0;
      if (state.over) return events;
      state.started = true;
      state.time += dt;
      const prevLegZ = state.legZ;

      const targetSpeed = input.boost ? PLANE.boostSpeed : PLANE.baseSpeed;
      state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.7);
      const speedFactor = 0.55 + 0.45 * (state.speed / PLANE.baseSpeed);
      state.x += input.turn * PLANE.turnRate * speedFactor * dt;
      state.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, state.x));
      const prevAlt = state.alt;
      state.alt += input.pitch * PLANE.climbRate * dt;
      state.alt = Math.max(WORLD.minAlt, Math.min(WORLD.maxAlt, state.alt));
      state.vspeed = (state.alt - prevAlt) / dt;
      state.bank += (input.turn * PLANE.bankMax - state.bank) * Math.min(1, dt * 7);
      state.heading = 40 + state.bank * 42;

      state.legZ += state.speed * dt;
      state.z += state.speed * dt;
      if (state.invuln > 0) state.invuln -= dt;
      if (state.shake > 0) state.shake -= dt;
      for (const p of state.popups) p.t += dt;
      state.popups = state.popups.filter((p) => p.t < 1.15);
      if (state.banner) {
        state.banner.t += dt;
        if (state.banner.t > 3.2) state.banner = null;
      }

      // Rings: crossing a ring's plane settles it, one way or the other.
      for (const ring of state.course.rings) {
        if (ring.hit || ring.missed || prevLegZ >= ring.z || state.legZ < ring.z) continue;
        const d = Math.hypot(state.x - ring.x, state.alt - ring.y);
        if (d <= RING.radius) {
          ring.hit = true;
          state.ringsHit += 1;
          state.combo += 1;
          state.bestCombo = Math.max(state.bestCombo, state.combo);
          const mult = Math.min(5, 1 + Math.floor(state.combo / 3));
          const heart = d <= RING.heartRadius;
          const gained = (RING.score + (heart ? RING.heartBonus : 0)) * mult;
          state.score += gained;
          popup(`+${gained}`, ring.x, ring.y + 14, ring.z);
          events |= EVENT_RING | (heart ? EVENT_HEART : 0);
        } else {
          ring.missed = true;
          state.combo = 0;
        }
      }

      // Hazards.
      for (const spire of state.course.spires) {
        if (Math.abs(state.legZ - spire.z) < 6 && Math.abs(state.x - spire.x) < PLANE.radius + 5 && state.alt < spire.top + 3) {
          events = hitObstacle(events, 'SPIRE!');
        }
      }
      for (const storm of state.course.storms) {
        if (Math.abs(state.legZ - storm.z) < 11 && Math.hypot(state.x - storm.x, state.alt - storm.y) < storm.r + PLANE.radius) {
          events = hitObstacle(events, 'STORM CELL!');
        }
      }
      if (!state.over && state.alt <= terrainHeight(state.x, state.z) + WORLD.groundClearance) {
        state.hull = 0;
        state.over = true;
        state.reason = 'The Kestrel met the ridge.';
        events |= EVENT_OVER;
      }

      // The strip: touch down on it, or sail past and the run is done.
      if (!state.over && state.leg === LEGS.length - 1) {
        const onStrip =
          state.z >= RUNWAY_START_Z && state.z <= RUNWAY_START_Z + RUNWAY.length &&
          Math.abs(state.x - RUNWAY.x) <= RUNWAY.width / 2 + 5 &&
          state.alt <= RUNWAY.landAlt && state.speed <= RUNWAY.landSpeed;
        if (onStrip) {
          state.landed = true;
          state.over = true;
          state.score += 500 + state.hull * 100;
          state.reason = 'Touchdown at Cinder Bay. The mail is through.';
          events |= EVENT_LANDED | EVENT_OVER;
        } else if (state.z > RUNWAY_START_Z + RUNWAY.length + 60) {
          state.over = true;
          state.reason = 'You sailed past the Cinder Bay strip.';
          events |= EVENT_OVER;
        }
      }

      // Legs roll over into the next.
      if (!state.over && state.legZ >= LEGS[state.leg].length && state.leg < LEGS.length - 1) {
        state.leg += 1;
        state.legZ -= LEGS[state.leg - 1].length;
        loadLeg(state.leg);
        state.banner = { text: `LEG ${state.leg + 1} — ${LEGS[state.leg].name.toUpperCase()}`, t: 0 };
        events |= EVENT_LEG;
      }
      return events;
    },
  };

  loadLeg(0);
  return world;
}
