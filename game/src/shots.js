// The screenshot scenes behind ?shot=cover|play|approach|end. Each one flies
// the real sim forward from a fresh world with a simple autopilot — steer at
// the next ring's heart; on the last leg, line up on the strip and settle
// onto it — so every frame is a frame the game itself produces, and the same
// seed always stages the same frame.

import { LEGS, RUNWAY, STEP } from './config.js';
import { EVENT_OVER, terrainHeight } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function clampUnit(v) {
  return Math.max(-1, Math.min(1, v));
}

/** Steer toward a point (x, altitude) with a gentle hand. */
function steer(state, tx, ty, gain = 42) {
  return {
    turn: clampUnit((tx - state.x) / gain),
    pitch: clampUnit((ty - state.alt) / 30),
    boost: false,
  };
}

/** The autopilot: chase rings, keeping clear of the ridge ahead; on the
 *  final leg, fly the vale down to the strip and land. */
export function autopilot(world) {
  const state = world.state;
  const target = world.nextTarget();
  if (!target) return { turn: 0, pitch: 0, boost: false };
  if (target.kind === 'runway') {
    const dz = target.z - state.legZ;
    const glideAlt = Math.max(21, Math.min(54, dz * 0.075 + 8));
    return steer(state, RUNWAY.x, glideAlt, 55);
  }
  const clearAlt = Math.max(
    terrainHeight(state.x, state.z + 130),
    terrainHeight((state.x + target.x) / 2, state.z + (target.z - state.legZ) / 2),
    terrainHeight(target.x, state.z + (target.z - state.legZ)),
  ) + 26;
  return steer(state, target.x, Math.max(target.y, clearAlt));
}

function fly(world, seconds, limit = seconds) {
  const steps = Math.floor(limit / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.step(STEP, autopilot(world)) & EVENT_OVER) break;
    if (i * STEP >= seconds && world.state.over) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any other name is the cover.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.startLeg(1);
    fly(world, 15);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'approach') {
    world.beginApproach();
    // Fly the leg's last rings, then settle onto the glide: stage the frame
    // on short final, the strip lit up ahead.
    for (let i = 0; i < 40 / STEP && !world.state.over; i += 1) {
      world.step(STEP, autopilot(world));
      if (world.state.z >= 7240) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    world.beginApproach();
    fly(world, 0, 75);
    return { screen: SCREEN_OVER };
  }
  // Cover: a calm opening minute over Ember Bay, title over the top.
  world.reset();
  fly(world, 5);
  return { screen: SCREEN_TITLE };
}

export { LEGS };
