// Emberline's entry point: wires the world, the painter, the input and the
// sound into a screen flow (title, play, over), runs the sim on a fixed step
// whatever the display's rate, and — behind ?shot=<scene>&seed=<n> — stages
// one deterministic scene instead, for the hand-in screenshots.

import { STEP, VIEW } from './config.js';
import { createInput } from './input.js';
import { createRender, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createSound } from './sound.js';
import { autopilot, stageShot } from './shots.js';
import { createWorld, EVENT_HEART, EVENT_HIT, EVENT_LANDED, EVENT_LEG, EVENT_OVER, EVENT_RING } from './world.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const render = createRender(canvas);
const input = createInput();
const sound = createSound();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const shotSeed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : 1;

let best = 0;

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/** Draw the world scaled to fill the window, letterboxed on the sky. */
function drawFrame(world, screen) {
  const ctx = canvas.getContext('2d');
  const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14101d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate((canvas.width - VIEW.width * scale) / 2, (canvas.height - VIEW.height * scale) / 2);
  ctx.scale(scale, scale);
  render.draw(world.state, screen, world, best);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

if (shotName !== null) {
  // A staged screenshot scene: build it, draw it once, say when it is ready.
  const world = createWorld(shotSeed);
  const { screen } = stageShot(shotName, world);
  drawFrame(world, screen);
  window.__shotReady = true;
} else {
  let screen = SCREEN_TITLE;
  let world = createWorld((Math.random() * 1e9) | 0);
  let demo = createWorld(20261126);
  demo.reset();
  let paused = false;
  let accumulator = 0;
  let last = performance.now();
  let statusTimer = 0;

  function announce(text) {
    if (status) status.textContent = text;
  }

  function startRun() {
    world = createWorld((Math.random() * 1e9) | 0);
    world.reset();
    screen = SCREEN_PLAY;
    paused = false;
    announce('Flying. Thread the dawn rings and land at Cinder Bay.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    accumulator += elapsed;

    if (input.takePause() && screen === SCREEN_PLAY) {
      paused = !paused;
      announce(paused ? 'Paused.' : 'Flying.');
    }
    const confirm = input.takeConfirm();
    if (confirm) {
      sound.unlock();
      if (screen === SCREEN_TITLE) startRun();
      else if (screen === SCREEN_OVER) startRun();
    }

    const view = { width: window.innerWidth, height: window.innerHeight };
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (screen === SCREEN_TITLE) {
        demo.step(STEP, autopilot(demo));
        if (demo.state.over) {
          demo = createWorld(20261126);
          demo.reset();
        }
      } else if (screen === SCREEN_PLAY && !paused) {
        const intent = input.read(view);
        const events = world.step(STEP, intent);
        if (events & EVENT_RING) sound.ring((events & EVENT_HEART) !== 0);
        if (events & EVENT_HIT) sound.hit();
        if (events & EVENT_LEG) sound.leg();
        if (events & EVENT_LANDED) sound.landed();
        else if (events & EVENT_OVER) sound.over();
        if (world.state.over) {
          best = Math.max(best, world.state.score);
          screen = SCREEN_OVER;
          announce(world.state.reason + ` Score ${world.state.score}.`);
        }
      }
    }
    sound.setEngine(world.state.speed, false, screen === SCREEN_PLAY && !paused);

    if (screen === SCREEN_TITLE) drawFrame(demo, SCREEN_TITLE);
    else if (screen === SCREEN_OVER) drawFrame(world, SCREEN_OVER);
    else drawFrame(world, SCREEN_PLAY);
    if (paused && screen === SCREEN_PLAY) {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(10,6,14,0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `700 ${Math.round(canvas.height * 0.05)}px "Arial Narrow", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd9a0';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }

    statusTimer += elapsed;
    if (statusTimer > 2 && screen === SCREEN_PLAY) {
      statusTimer = 0;
      announce(`Altitude ${Math.round(world.state.alt)} metres, speed ${Math.round(world.state.speed * 1.94)} knots, score ${world.state.score}.`);
    }
  }
  requestAnimationFrame(frame);
}
