// Emberline's painter. One canvas, no images: the dawn sky, the coast, the
// plane and the cockpit are all drawn from the sim's own numbers each frame,
// so a screenshot is the game and nothing else. Projection is a simple
// chase-camera divide: the camera trails the plane, the world runs under it.

import { LEGS, RING, RUNWAY, VIEW } from './config.js';
import { RUNWAY_START_Z, TOTAL_LENGTH, coastX, terrainHeight } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

const W = VIEW.width;
const H = VIEW.height;
const FOCAL = 330;

/** Small deterministic hash for per-chunk scenery (villages, glitter). */
function hash(n) {
  let t = (n * 2654435761) >>> 0;
  t ^= t >>> 15;
  t = Math.imul(t, 2246822519);
  t ^= t >>> 13;
  return (t >>> 0) / 4294967296;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function css(c, a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

const SKY_TOP = [23, 30, 62];
const SKY_MID = [86, 47, 84];
const SKY_LOW = [196, 88, 62];
const HORIZON_GLOW = [246, 158, 91];
const SEA_FAR = [38, 74, 96];
const SEA_NEAR = [20, 52, 74];
const LAND_FAR = [112, 74, 74];
const LAND_NEAR = [52, 38, 46];
const LAND_ALT = [64, 44, 50];
const FOG = [232, 138, 92];

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');

  function horizonY(state) {
    return VIEW.horizon + (state.alt - 92) * 0.32;
  }
  function camX(state) {
    return state.x * 0.62;
  }
  function camY(state) {
    return state.alt * 0.72 + 30;
  }

  /** Project a world point (x, altitude, absolute z) to the screen. */
  function project(state, wx, wy, wz) {
    const dz = wz - state.z;
    if (dz < 5) return null;
    const s = FOCAL / dz;
    return {
      x: W / 2 + (wx - camX(state)) * s,
      y: horizonY(state) - (wy - camY(state)) * s,
      s,
      dz,
    };
  }

  function drawSky(state) {
    const hz = horizonY(state);
    const g = ctx.createLinearGradient(0, 0, 0, hz + 90);
    g.addColorStop(0, css(SKY_TOP));
    g.addColorStop(0.45, css(SKY_MID));
    g.addColorStop(0.8, css(SKY_LOW));
    g.addColorStop(1, css(HORIZON_GLOW));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hz + 90);

    // Stars, thinning toward the horizon, gone as the run warms up.
    ctx.fillStyle = '#ffeedd';
    for (let i = 0; i < 70; i += 1) {
      const sx = hash(i * 3 + 1) * W;
      const sy = hash(i * 7 + 2) * hz * 0.55;
      const a = 0.5 * (1 - sy / (hz * 0.6)) * (0.6 + 0.4 * Math.sin(state.time * 2 + i));
      if (a > 0.03) {
        ctx.globalAlpha = a;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    ctx.globalAlpha = 1;

    // The dawn sun, low over the sea to the left of the course.
    const sunX = W * 0.335;
    const sunY = hz - 64;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 300);
    glow.addColorStop(0, 'rgba(255,214,150,0.85)');
    glow.addColorStop(0.25, 'rgba(255,166,88,0.38)');
    glow.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 300, sunY - 300, 600, 600);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#ffedbe';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,190,110,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Drifting dawn clouds, two parallax layers.
    for (let layer = 0; layer < 2; layer += 1) {
      const par = layer === 0 ? 0.012 : 0.03;
      const baseY = layer === 0 ? 58 : 118;
      ctx.fillStyle = layer === 0 ? 'rgba(64,44,84,0.55)' : 'rgba(146,84,96,0.5)';
      for (let i = 0; i < 6; i += 1) {
        const span = 460;
        let cx = (hash(i * 13 + layer * 91) * (W + span) + state.z * par * 8 + state.time * (2 + layer)) % (W + span);
        if (cx < 0) cx += W + span;
        cx -= span / 2;
        const cy = baseY + hash(i * 29 + layer) * 44 + Math.sin(state.time * 0.11 + i * 2.1) * 3;
        const cw = 120 + hash(i * 7 + layer * 3) * 190;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw / 2, 11 + layer * 5, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + cw * 0.28, cy + 5, cw / 3, 8 + layer * 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Parallax silhouette ridges between sky and ground. */
  function drawRidges(state) {
    const hz = horizonY(state);
    const layers = [
      { par: 0.05, amp: 30, base: 6, color: 'rgba(88,52,80,0.85)', seed: 3 },
      { par: 0.13, amp: 44, base: 2, color: 'rgba(58,36,58,0.95)', seed: 11 },
    ];
    for (const L of layers) {
      ctx.beginPath();
      ctx.moveTo(0, hz + 2);
      for (let x = 0; x <= W; x += 16) {
        const wz = (x + state.z * L.par * 3) * 0.011;
        const y = hz - L.base - (Math.sin(wz + L.seed) * 0.5 + Math.sin(wz * 2.7 + L.seed * 2) * 0.3 + 0.62) * L.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, hz + 2);
      ctx.closePath();
      ctx.fillStyle = L.color;
      ctx.fill();
    }
    // Mount Cinder, the volcano, standing off the course to the right.
    const vp = project(state, 430, 0, 3050);
    if (vp && vp.x > -500 && vp.x < W + 500) {
      const hgt = 30000 / Math.max(60, vp.dz) * 3.4;
      const wid = hgt * 1.5;
      ctx.beginPath();
      ctx.moveTo(vp.x - wid / 2, horizonY(state) + 4);
      ctx.lineTo(vp.x - wid * 0.1, horizonY(state) - hgt);
      ctx.lineTo(vp.x + wid * 0.08, horizonY(state) - hgt * 0.94);
      ctx.lineTo(vp.x + wid / 2, horizonY(state) + 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(46,30,48,0.96)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(vp.x, horizonY(state) - hgt - 6, wid * 0.09, hgt * 0.1 + 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,150,80,0.75)';
      ctx.fill();
      ctx.fillStyle = 'rgba(220,190,200,0.35)';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(vp.x + Math.sin(state.time * 0.4 + i * 2) * 8 + i * 12, horizonY(state) - hgt - 22 - i * 17, 16 + i * 9, 6 + i * 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** The ground: perspective bands of sea and land under the plane. */
  function drawGround(state) {
    const hz = horizonY(state);
    const cy = camY(state);
    const bands = 62;
    for (let i = 0; i < bands; i += 1) {
      const t0 = i / bands;
      const t1 = (i + 1) / bands;
      const y0 = hz + Math.pow(t0, 1.9) * (H - hz);
      const y1 = hz + Math.pow(t1, 1.9) * (H - hz) + 1;
      const dz = (cy * FOCAL) / Math.max(6, (y0 + y1) / 2 - hz);
      const wz = state.z + dz;
      const fogT = Math.exp(-dz / 1050);
      const coast = project(state, coastX(wz), 0, wz);
      if (!coast) continue;
      const stripe = Math.floor(wz / 55) % 2 === 0;
      const sea = mix(SEA_FAR, SEA_NEAR, t0);
      let land = mix(LAND_FAR, stripe ? LAND_NEAR : LAND_ALT, t0);
      ctx.fillStyle = css(mix(FOG, sea, fogT));
      ctx.fillRect(0, y0, W, y1 - y0);
      ctx.fillStyle = css(mix(FOG, land, fogT));
      ctx.fillRect(coast.x, y0, W - coast.x, y1 - y0);
      // Foam along the waterline.
      ctx.fillStyle = `rgba(255,226,190,${0.28 * fogT})`;
      ctx.fillRect(coast.x - 1.5, y0, 3, y1 - y0);
      // The ember river, a lava-lit watercourse winding inland.
      const riverX = coastX(wz) + 108 + Math.sin(wz * 0.0021) * 24;
      const rp = project(state, riverX, 0, wz);
      if (rp && dz < 700) {
        ctx.fillStyle = `rgba(255,${120 + ((Math.sin(wz * 0.05) * 30) | 0)},44,${0.75 * fogT})`;
        ctx.fillRect(rp.x - Math.max(1, 5 * rp.s * 0.1), y0, Math.max(1.5, 10 * rp.s * 0.1), y1 - y0);
      }
      // Village lights on the land, harbour lights on the shore.
      const chunk = Math.floor(wz / 85);
      if (dz < 620 && hash(chunk * 5 + 1) > 0.45) {
        const n = 2 + Math.floor(hash(chunk * 9 + 2) * 4);
        for (let k = 0; k < n; k += 1) {
          const lx = coastX(wz) + 18 + hash(chunk * 31 + k * 7) * 120;
          const lp = project(state, lx, 2, wz);
          if (lp && lp.x > 0 && lp.x < W) {
            ctx.fillStyle = `rgba(255,196,110,${0.85 * fogT})`;
            ctx.fillRect(lp.x, (y0 + y1) / 2 - 1, 2.4, 2.4);
          }
        }
      }
      // Sun glitter on the sea.
      if (dz < 500 && hash(chunk * 17 + Math.floor(state.time * 2)) > 0.4) {
        const gx = W * 0.335 + (hash(chunk * 23) - 0.5) * 190 * (dz / 500 + 0.3);
        ctx.fillStyle = `rgba(255,178,102,${0.3 * fogT})`;
        ctx.fillRect(gx, y0, 14 + hash(chunk * 41) * 30, 1.6);
      }
    }
  }

  /** The Cinder Bay strip, drawn as a projected quad with lit edges. */
  function drawRunway(state) {
    if (state.z < RUNWAY_START_Z - 1500) return;
    const z0 = RUNWAY_START_Z;
    const z1 = RUNWAY_START_Z + 420;
    const hw = RUNWAY.width / 2;
    const corners = [
      project(state, RUNWAY.x - hw, 14, z0),
      project(state, RUNWAY.x + hw, 14, z0),
      project(state, RUNWAY.x + hw, 14, z1),
      project(state, RUNWAY.x - hw, 14, z1),
    ];
    if (!corners[0] || !corners[2]) return;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    if (corners[2]) ctx.lineTo(corners[2].x, corners[2].y);
    if (corners[3]) ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(38,34,40,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,150,0.8)';
    ctx.lineWidth = Math.max(1, 2 * corners[0].s * 0.06);
    ctx.stroke();
    // Centreline dashes and threshold lights.
    for (let i = 0; i < 7; i += 1) {
      const p = project(state, RUNWAY.x, 14, z0 + 30 + i * 55);
      if (p) {
        ctx.fillStyle = 'rgba(255,240,210,0.85)';
        ctx.fillRect(p.x - Math.max(0.6, p.s * 0.14), p.y, Math.max(1.2, p.s * 0.28), Math.max(1, p.s * 0.5));
      }
    }
    for (let i = 0; i <= 10; i += 1) {
      for (const side of [-1, 1]) {
        const p = project(state, RUNWAY.x + side * (hw + 2), 15, z0 + i * 42);
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.s * 0.22), 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? '#7dff9a' : '#ffc46b';
          ctx.fill();
        }
      }
    }
    // The windsock tower at the threshold.
    const sock = project(state, RUNWAY.x + hw + 16, 14, z0 + 10);
    if (sock) {
      ctx.strokeStyle = 'rgba(20,16,22,0.9)';
      ctx.lineWidth = Math.max(1, sock.s * 0.12);
      ctx.beginPath();
      ctx.moveTo(sock.x, sock.y);
      ctx.lineTo(sock.x, sock.y - 26 * sock.s * 0.14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sock.x, sock.y - 26 * sock.s * 0.14);
      ctx.lineTo(sock.x + 14 * sock.s * 0.14, sock.y - 22 * sock.s * 0.14);
      ctx.lineTo(sock.x, sock.y - 18 * sock.s * 0.14);
      ctx.closePath();
      ctx.fillStyle = '#ff8c3b';
      ctx.fill();
    }
  }

  function drawRing(state, ring, legStartZ) {
    const p = project(state, ring.x, ring.y, legStartZ + ring.z);
    if (!p || p.dz > 950) return;
    const r = RING.radius * p.s;
    if (r < 2 || p.x < -r * 2 || p.x > W + r * 2) return;
    const done = ring.hit;
    const missed = ring.missed;
    ctx.save();
    ctx.translate(p.x, p.y);
    const squash = 1 - Math.min(0.45, Math.abs(state.x - ring.x) / 320);
    ctx.scale(1, squash);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = done ? 'rgba(126,255,164,0.9)' : missed ? 'rgba(140,130,140,0.45)' : 'rgba(255,178,84,0.95)';
    ctx.lineWidth = Math.max(1.6, r * 0.13);
    ctx.shadowColor = done ? '#7effa4' : '#ff9a3c';
    ctx.shadowBlur = done || missed ? 0 : 16;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = done ? 'rgba(126,255,164,0.35)' : missed ? 'rgba(140,130,140,0.2)' : 'rgba(255,220,160,0.5)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }

  function drawSpire(state, spire, legStartZ) {
    const base = project(state, spire.x, spire.base, legStartZ + spire.z);
    const top = project(state, spire.x, spire.top, legStartZ + spire.z);
    if (!base || !top || base.dz > 950) return;
    const wHalf = Math.max(1.5, 11 * base.s);
    const fogT = Math.exp(-base.dz / 1050);
    ctx.beginPath();
    ctx.moveTo(base.x - wHalf, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.lineTo(base.x + wHalf, base.y);
    ctx.closePath();
    ctx.fillStyle = css(mix(FOG, [44, 32, 44], fogT));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(base.x + wHalf, base.y);
    ctx.lineTo(top.x + wHalf * 0.34, base.y);
    ctx.closePath();
    ctx.fillStyle = css(mix(FOG, [84, 48, 52], fogT), 0.8);
    ctx.fill();
    // Ember cracks near the tip.
    ctx.strokeStyle = `rgba(255,128,52,${0.7 * fogT})`;
    ctx.lineWidth = Math.max(0.8, base.s * 0.08);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y + (base.y - top.y) * 0.2);
    ctx.lineTo(top.x + wHalf * 0.2, top.y + (base.y - top.y) * 0.42);
    ctx.stroke();
  }

  function drawStorm(state, storm, legStartZ) {
    const p = project(state, storm.x, storm.y, legStartZ + storm.z);
    if (!p || p.dz > 950) return;
    const r = storm.r * p.s;
    if (r < 3) return;
    const fogT = Math.exp(-p.dz / 1050);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = css(mix(FOG, [38, 34, 52], fogT), 0.92);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + storm.z;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.24, r * 0.52, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.72, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(mix(FOG, [54, 48, 72], fogT), 0.95);
    ctx.fill();
    // Rain streaks and the odd flash.
    ctx.strokeStyle = `rgba(170,190,230,${0.4 * fogT})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const rx = (hash(storm.z * 3 + i * 11) - 0.5) * r * 1.1;
      ctx.moveTo(rx, r * 0.3);
      ctx.lineTo(rx - 3, r * 0.3 + r * 0.5);
    }
    ctx.stroke();
    if (hash(Math.floor(state.time * 1.4) + storm.z) > 0.93) {
      ctx.strokeStyle = 'rgba(255,244,180,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.2);
      ctx.lineTo(-r * 0.12, r * 0.55);
      ctx.lineTo(r * 0.04, r * 0.55);
      ctx.lineTo(-r * 0.08, r * 0.95);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The Kestrel herself: ember-orange, banking, prop a blur of dawn light. */
  function drawPlane(state) {
    if (state.invuln > 0 && Math.floor(state.time * 14) % 2 === 0 && state.started && !state.over) {
      // Hit flicker: the plane blinks while she is invulnerable.
      if (state.invuln > 1.4) return;
    }
    const shakeX = state.shake > 0 ? (hash(Math.floor(state.time * 40)) - 0.5) * 14 * state.shake : 0;
    const shakeY = state.shake > 0 ? (hash(Math.floor(state.time * 40) + 9) - 0.5) * 10 * state.shake : 0;
    const ax = W / 2 + state.x * 1.12 + shakeX;
    const ay = 452 + (92 - state.alt) * 0.5 + Math.sin(state.time * 1.7) * 3 + shakeY;

    // Her shadow on the ground below.
    const groundY = terrainHeight(state.x, state.z + 8);
    const sh = project(state, state.x, groundY, state.z + 10);
    if (sh) {
      const altAbove = Math.max(4, state.alt - groundY);
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, Math.max(6, 3400 / altAbove), Math.max(2, 900 / altAbove), 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(16,10,18,${Math.max(0.05, 0.34 - altAbove / 700)})`;
      ctx.fill();
    }

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(state.bank * 0.85);
    const S = 1.06;
    ctx.scale(S, S);
    // Wings.
    ctx.beginPath();
    ctx.moveTo(-86, 10);
    ctx.quadraticCurveTo(-40, -4, 0, -2);
    ctx.quadraticCurveTo(40, -4, 86, 10);
    ctx.quadraticCurveTo(88, 20, 78, 22);
    ctx.quadraticCurveTo(30, 14, 0, 14);
    ctx.quadraticCurveTo(-30, 14, -78, 22);
    ctx.quadraticCurveTo(-88, 20, -86, 10);
    ctx.closePath();
    const wingGrad = ctx.createLinearGradient(-86, 0, 86, 0);
    wingGrad.addColorStop(0, '#e86f2a');
    wingGrad.addColorStop(0.5, '#ff9a44');
    wingGrad.addColorStop(1, '#e86f2a');
    ctx.fillStyle = wingGrad;
    ctx.fill();
    ctx.fillStyle = '#ffe8c9';
    ctx.fillRect(-86, 8, 13, 12);
    ctx.fillRect(73, 8, 13, 12);
    // Fuselage, seen from behind: nose away and narrow, tail toward us.
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.quadraticCurveTo(8, -38, 10, -8);
    ctx.quadraticCurveTo(11, 14, 6, 27);
    ctx.lineTo(-6, 27);
    ctx.quadraticCurveTo(-11, 14, -10, -8);
    ctx.quadraticCurveTo(-8, -38, 0, -62);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(0, -62, 0, 27);
    bodyGrad.addColorStop(0, '#ffb066');
    bodyGrad.addColorStop(0.55, '#ff8c3b');
    bodyGrad.addColorStop(1, '#d9622a');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    // Fin, edge-on at the tail, rising toward the sky.
    ctx.beginPath();
    ctx.moveTo(-3.6, 27);
    ctx.lineTo(0, 2);
    ctx.lineTo(3.6, 27);
    ctx.closePath();
    ctx.fillStyle = '#c7511f';
    ctx.fill();
    // Tailplane across the tail.
    ctx.beginPath();
    ctx.moveTo(-27, 24);
    ctx.quadraticCurveTo(0, 19, 27, 24);
    ctx.lineTo(24, 30);
    ctx.quadraticCurveTo(0, 25, -24, 30);
    ctx.closePath();
    ctx.fillStyle = '#e86f2a';
    ctx.fill();
    // Canopy with a dawn glint.
    ctx.beginPath();
    ctx.ellipse(0, -26, 6.4, 12, 0, 0, Math.PI * 2);
    const canGrad = ctx.createLinearGradient(0, -38, 0, -14);
    canGrad.addColorStop(0, '#bfe6ff');
    canGrad.addColorStop(0.5, '#5f87b8');
    canGrad.addColorStop(1, '#2c3e63');
    ctx.fillStyle = canGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2, -31, 2.2, 5, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,246,220,0.85)';
    ctx.fill();
    // The prop, a bright blurred disc on the nose, away from us.
    ctx.save();
    ctx.translate(0, -60);
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 4.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,190,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,210,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const blade = (state.time * 43) % Math.PI;
    ctx.rotate(blade);
    ctx.fillStyle = 'rgba(70,44,34,0.35)';
    ctx.fillRect(-25, -1.1, 50, 2.2);
    ctx.restore();
    // Nav lights: port red, starboard green, tail strobe.
    ctx.beginPath();
    ctx.arc(-84, 14, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4b4b';
    ctx.shadowColor = '#ff4b4b';
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(84, 14, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#51ff7e';
    ctx.shadowColor = '#51ff7e';
    ctx.fill();
    ctx.shadowBlur = 0;
    if (Math.floor(state.time * 1.6) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(0, 4, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function gauge(x, y, r, drawFace) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#14100f';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3d2c22';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,170,80,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 4, 0, Math.PI * 2);
    ctx.clip();
    drawFace(x, y, r - 4);
    ctx.restore();
    ctx.restore();
  }

  function ticks(x, y, r, count, from, to, color = 'rgba(255,196,110,0.9)') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= count; i += 1) {
      const a = from + ((to - from) * i) / count;
      ctx.moveTo(x + Math.cos(a) * (r - 9), y + Math.sin(a) * (r - 9));
      ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
    }
    ctx.stroke();
  }

  function needle(x, y, r, angle, color = '#ffd9a0') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, 0);
    ctx.lineTo(r * 0.78, -2.4);
    ctx.lineTo(r * 0.86, 0);
    ctx.lineTo(r * 0.78, 2.4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = '#ff9a3c';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0a09';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,110,0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function label(x, y, text, size = 10, color = 'rgba(255,196,110,0.75)', align = 'center') {
    ctx.font = `600 ${size}px "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** The lit cockpit: a dashboard strip under the chase view. */
  function drawCockpit(state) {
    const top = 598;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#241a18');
    g.addColorStop(0.12, '#171110');
    g.addColorStop(1, '#0b0808');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
    ctx.fillStyle = 'rgba(255,170,80,0.35)';
    ctx.fillRect(0, top, W, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, top + 2, W, 3);
    for (const sx of [26, W - 26]) {
      ctx.beginPath();
      ctx.arc(sx, top + 16, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#050404';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,110,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const cy = 660;
    // Compass rose.
    gauge(120, cy, 40, (x, y, r) => {
      ticks(x, y, r, 12, 0, Math.PI * 2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((-state.heading * Math.PI) / 180);
      for (const [txt, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
        ctx.save();
        ctx.rotate((a * Math.PI) / 180);
        ctx.font = '700 11px "Arial Narrow", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = txt === 'N' ? '#ff9a44' : 'rgba(255,220,170,0.85)';
        ctx.fillText(txt, 0, -r + 17);
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x, y - r - 7);
      ctx.lineTo(x - 5, y - r - 14);
      ctx.lineTo(x + 5, y - r - 14);
      ctx.closePath();
      ctx.fillStyle = '#ffd9a0';
      ctx.fill();
      label(x, y + r + 12, 'HDG', 9);
    });
    // Attitude indicator: the heart of the panel, bank and pitch alive.
    gauge(330, cy, 52, (x, y, r) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-state.bank * 0.9);
      const pitchOff = Math.max(-14, Math.min(14, state.vspeed * 0.35));
      ctx.fillStyle = '#7a4a63';
      ctx.fillRect(-r, -r + pitchOff, r * 2, r * 2);
      ctx.fillStyle = '#33222e';
      ctx.fillRect(-r, pitchOff, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(255,230,190,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-r, pitchOff);
      ctx.lineTo(r, pitchOff);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x - 7, y);
      ctx.moveTo(x + 7, y);
      ctx.lineTo(x + 20, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd9a0';
      ctx.fill();
      ticks(x, y, r, 6, -Math.PI * 0.75, -Math.PI * 0.25);
      label(x, y + r + 12, 'ATTITUDE', 9);
    });
    // Altimeter.
    gauge(560, cy, 52, (x, y, r) => {
      ticks(x, y, r, 10, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5);
      const a = Math.PI * 0.75 + (Math.min(250, state.alt) / 250) * Math.PI * 1.5;
      needle(x, y, r, a);
      ctx.font = '700 15px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffc46b';
      ctx.fillText(`${Math.round(state.alt)}`, x, y + 30);
      label(x, y + r + 12, 'ALT · M', 9);
    });
    // Airspeed.
    gauge(790, cy, 52, (x, y, r) => {
      ticks(x, y, r, 9, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5);
      ctx.beginPath();
      ctx.arc(x, y, r - 6, Math.PI * 1.62, Math.PI * 2.22);
      ctx.strokeStyle = 'rgba(255,92,60,0.85)';
      ctx.lineWidth = 4;
      ctx.stroke();
      const a = Math.PI * 0.75 + (Math.min(90, state.speed) / 90) * Math.PI * 1.5;
      needle(x, y, r, a);
      ctx.font = '700 15px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffc46b';
      ctx.fillText(`${Math.round(state.speed * 1.94)}`, x, y + 30);
      label(x, y + r + 12, 'SPEED · KT', 9);
    });
    // Run status cluster: hull, rings, leg.
    gauge(1020, cy, 52, (x, y, r) => {
      label(x, y - 24, 'HULL', 10);
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        const hx = x - 22 + i * 22;
        ctx.moveTo(hx, y - 12);
        ctx.lineTo(hx + 7, y + 2);
        ctx.lineTo(hx, y + 9);
        ctx.lineTo(hx - 7, y + 2);
        ctx.closePath();
        ctx.fillStyle = i < state.hull ? '#ff8c3b' : 'rgba(120,90,80,0.3)';
        if (i < state.hull) {
          ctx.shadowColor = '#ff9a3c';
          ctx.shadowBlur = 7;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.font = '700 14px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffc46b';
      ctx.fillText(`RING ${state.ringsHit}/${state.ringsTotal}`, x, y + 30);
      label(x, y + r + 12, `LEG ${state.leg + 1} OF ${LEGS.length}`, 9);
    });
    // Score readout, right end of the panel (right-aligned: leg names are long).
    label(1256, cy - 26, 'SCORE', 10, 'rgba(255,196,110,0.75)', 'right');
    ctx.font = '700 27px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd9a0';
    ctx.shadowColor = '#ff9a3c';
    ctx.shadowBlur = 8;
    ctx.fillText(`${state.score}`, 1256, cy + 4);
    ctx.shadowBlur = 0;
    if (state.combo >= 2) {
      label(1256, cy + 28, `COMBO ×${Math.min(5, 1 + Math.floor(state.combo / 3))} · ${state.combo} RINGS`, 11, '#ffb46b', 'right');
    } else {
      label(1256, cy + 28, LEGS[state.leg].name.toUpperCase(), 11, 'rgba(255,196,110,0.6)', 'right');
    }
  }

  /** Top-of-screen flight HUD: heading tape and the target arrow. */
  function drawHud(state, world) {
    // Heading tape.
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - 190, 12, 380, 34);
    ctx.clip();
    ctx.fillStyle = 'rgba(12,10,18,0.55)';
    ctx.fillRect(W / 2 - 190, 12, 380, 34);
    const pxPerDeg = 3.4;
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((Math.round((state.heading + d) / 5) * 5) % 360 + 360) % 360;
      const x = W / 2 + (deg - state.heading + (deg - state.heading > 180 ? -360 : deg - state.heading < -180 ? 360 : 0)) * pxPerDeg;
      if (x < W / 2 - 185 || x > W / 2 + 185) continue;
      ctx.fillStyle = 'rgba(255,220,170,0.8)';
      ctx.fillRect(x, 34, 1.6, deg % 15 === 0 ? 10 : 6);
      if (deg % 45 === 0) {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        ctx.font = '700 12px "Arial Narrow", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(names[deg] ?? `${deg}`, x, 26);
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(W / 2, 52);
    ctx.lineTo(W / 2 - 6, 44);
    ctx.lineTo(W / 2 + 6, 44);
    ctx.closePath();
    ctx.fillStyle = '#ffb46b';
    ctx.fill();

    // Numeric readouts, top corners.
    ctx.font = '700 21px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe2b8';
    ctx.fillText(`ALT ${Math.round(state.alt)} M`, 28, 40);
    ctx.font = '600 13px ui-monospace, Menlo, monospace';
    ctx.fillStyle = state.vspeed >= 0 ? 'rgba(160,255,190,0.9)' : 'rgba(255,150,130,0.9)';
    ctx.fillText(`${state.vspeed >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(state.vspeed * 1.94))} KT`, 28, 62);
    ctx.font = '700 21px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe2b8';
    ctx.fillText(`SPD ${Math.round(state.speed * 1.94)} KT`, W - 28, 40);
    ctx.font = '600 13px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(255,220,170,0.85)';
    ctx.fillText(`HDG ${String(Math.round(((state.heading % 360) + 360) % 360)).padStart(3, '0')}°`, W - 28, 62);

    // Target arrow: point at the next ring or the strip.
    const target = world.nextTarget();
    if (target && !state.over) {
      const legStartZ = state.z - state.legZ;
      const p = project(state, target.x, target.y, legStartZ + target.z);
      ctx.save();
      if (p && p.x > 60 && p.x < W - 60 && p.y > 70 && p.y < 560) {
        ctx.strokeStyle = 'rgba(255,196,110,0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const ang = Math.atan2((target.y - state.alt) * -2.2, target.x - state.x);
        const ex = Math.max(46, Math.min(W - 46, W / 2 + Math.cos(ang) * 520));
        const ey = Math.max(96, Math.min(520, 300 + Math.sin(ang) * 190));
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -9);
        ctx.lineTo(-10, 9);
        ctx.closePath();
        ctx.fillStyle = '#ffc46b';
        ctx.shadowColor = '#ff9a3c';
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }

    // Leg banner.
    if (state.banner) {
      const a = Math.min(1, state.banner.t / 0.4, (3.2 - state.banner.t) / 0.6);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '700 30px "Arial Narrow", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe2b8';
      ctx.shadowColor = '#ff9a3c';
      ctx.shadowBlur = 16;
      ctx.fillText(state.banner.text, W / 2, 120);
      ctx.restore();
    }
  }

  function drawPopups(state) {
    const legStartZ = state.z - state.legZ;
    for (const p of state.popups) {
      const pr = project(state, p.x, p.y + p.t * 9, legStartZ + p.z);
      if (!pr) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.15);
      ctx.font = `700 ${Math.max(13, Math.min(30, pr.s * 0.9))}px "Arial Narrow", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.text.startsWith('+') ? '#ffe2b8' : '#ff9a86';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText(p.text, pr.x, pr.y);
      ctx.restore();
    }
  }

  function drawWorld(state, world) {
    drawSky(state);
    drawRidges(state);
    drawGround(state);
    drawRunway(state);
    const legStartZ = state.z - state.legZ;
    const features = [];
    for (const spire of state.course.spires) features.push({ dz: spire.z - state.legZ, draw: () => drawSpire(state, spire, legStartZ) });
    for (const storm of state.course.storms) features.push({ dz: storm.z - state.legZ, draw: () => drawStorm(state, storm, legStartZ) });
    for (const ring of state.course.rings) features.push({ dz: ring.z - state.legZ, draw: () => drawRing(state, ring, legStartZ) });
    features.sort((a, b) => b.dz - a.dz);
    for (const f of features) if (f.dz > -30 && f.dz < 980) f.draw();
    drawPlane(state);
    drawPopups(state);
  }

  function drawTitle(state, best) {
    const shade = ctx.createLinearGradient(0, 300, 0, H);
    shade.addColorStop(0, 'rgba(10,6,16,0)');
    shade.addColorStop(1, 'rgba(10,6,16,0.55)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 300, W, H - 300);
    ctx.textAlign = 'center';
    ctx.font = '700 21px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,214,160,0.92)';
    ctx.fillText('T H E   D A W N   M A I L   R U N', W / 2, 128);
    ctx.font = '900 118px Georgia, "Times New Roman", serif';
    const tg = ctx.createLinearGradient(0, 130, 0, 250);
    tg.addColorStop(0, '#ffe9bd');
    tg.addColorStop(0.55, '#ffb46b');
    tg.addColorStop(1, '#ff7a3c');
    ctx.fillStyle = tg;
    ctx.shadowColor = 'rgba(255,122,60,0.55)';
    ctx.shadowBlur = 34;
    ctx.fillText('EMBERLINE', W / 2, 238);
    ctx.shadowBlur = 0;
    ctx.font = '600 19px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,232,200,0.92)';
    ctx.fillText('Three legs over the Ember Coast · thread the dawn rings · bring her home to Cinder Bay', W / 2, 282);
    ctx.font = '700 23px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('SPACE OR CLICK TO FLY', W / 2, 560);
    ctx.font = '500 15px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,232,200,0.75)';
    ctx.fillText('Arrows / WASD or mouse to steer · SHIFT to boost · P pauses', W / 2, 588);
    if (best > 0) {
      ctx.font = '600 15px ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(255,196,110,0.85)';
      ctx.fillText(`BEST ${best}`, W / 2, 616);
    }
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(10,6,14,0.52)';
    ctx.fillRect(0, 0, W, H);
    const pw = 520;
    const ph = 330;
    const px = (W - pw) / 2;
    const py = 150;
    ctx.fillStyle = 'rgba(18,12,20,0.92)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,80,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '800 40px Georgia, "Times New Roman", serif';
    ctx.fillStyle = state.landed ? '#a8ffc0' : '#ffb46b';
    ctx.fillText(state.landed ? 'MAIL DELIVERED' : 'END OF THE RUN', W / 2, py + 62);
    ctx.font = '500 16px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,232,200,0.9)';
    ctx.fillText(state.reason, W / 2, py + 94);
    const rows = [
      ['SCORE', `${state.score}`],
      ['DAWN RINGS', `${state.ringsHit} / ${state.ringsTotal}`],
      ['BEST COMBO', `${state.bestCombo}`],
      ['HULL LEFT', `${Math.max(0, state.hull)} / 3`],
      ['BEST SCORE', `${Math.max(best, state.score)}`],
    ];
    ctx.font = '600 17px "Arial Narrow", Arial, sans-serif';
    rows.forEach(([k, v], i) => {
      const y = py + 138 + i * 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,196,110,0.8)';
      ctx.fillText(k, px + 70, y);
      ctx.textAlign = 'right';
      ctx.font = '700 17px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#ffe2b8';
      ctx.fillText(v, px + pw - 70, y);
      ctx.font = '600 17px "Arial Narrow", Arial, sans-serif';
    });
    ctx.textAlign = 'center';
    ctx.font = '700 19px "Arial Narrow", Arial, sans-serif';
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('SPACE OR CLICK TO FLY AGAIN', W / 2, py + ph - 22);
  }

  return {
    /** Draw one frame. screen is SCREEN_*; world is passed for the target arrow. */
    draw(state, screen, world, best) {
      ctx.clearRect(0, 0, W, H);
      drawWorld(state, world);
      if (screen === SCREEN_PLAY) {
        drawHud(state, world);
        drawCockpit(state);
      } else if (screen === SCREEN_TITLE) {
        drawTitle(state, best);
      } else if (screen === SCREEN_OVER) {
        drawHud(state, world);
        drawCockpit(state);
        drawOver(state, best);
      }
    },
    project,
  };
}
