// Keyboard and mouse, folded into one intent: turn and pitch in [-1, 1], a
// boost flag, and edge-triggered confirm/pause. The mouse steers by where it
// sits against the screen centre; keys override it while held.

export function createInput() {
  const keys = new Set();
  const mouse = { x: 0, y: 0, seen: false, down: false };
  let confirmEdge = false;
  let pauseEdge = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') confirmEdge = true;
    if (event.code === 'KeyP' || event.code === 'Escape') pauseEdge = true;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.seen = true;
  }
  function onMouseDown() {
    mouse.down = true;
    confirmEdge = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Current steering intent for one step. view is the canvas size in CSS px. */
    read(view) {
      let turn = 0;
      let pitch = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) turn -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) turn += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
      if (turn === 0 && pitch === 0 && mouse.seen) {
        const dx = (mouse.x / Math.max(1, view.width)) * 2 - 1;
        const dy = (mouse.y / Math.max(1, view.height)) * 2 - 1;
        turn = clampUnit(dx * 1.6);
        pitch = clampUnit(-dy * 1.4);
      }
      return {
        turn,
        pitch,
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight') || mouse.down,
      };
    },
    /** True once per press of Space/Enter/click since the last read. */
    takeConfirm() {
      const was = confirmEdge;
      confirmEdge = false;
      return was;
    },
    takePause() {
      const was = pauseEdge;
      pauseEdge = false;
      return was;
    },
  };
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}
