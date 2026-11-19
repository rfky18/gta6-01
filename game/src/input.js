// Keyboard + mouse input. One job: turn raw events into a stable per-frame state.
// Mouse: pointer lock on canvas click; drag rotates when lock is unavailable.
// v2: left mouse = fire (held for auto weapons), right mouse = aim, keys
// 1-4 pick the four guns (0 = fists), R = reload. Radio moved to T so R is
// free for reload — the title screen lists the new keys.
// v4: no input change — the timer / PAR / XP HUD additions need no new keys.
export const ACTION_ENTER = 1;
export const ACTION_PAUSE = 2;
export const ACTION_JUMP = 4;
export const ACTION_INTERACT = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let firing = false;
  let aiming = false;
  let weaponSelect = -1;
  let reloadQueued = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter') actions |= ACTION_ENTER;
    if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    if (event.code === 'Space') actions |= ACTION_JUMP;
    if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    if (event.code === 'KeyR') reloadQueued = true;
    if (event.code.startsWith('Digit')) {
      const n = Number(event.code.slice(5));
      if (n >= 0 && n <= 4) weaponSelect = n;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    firing = false;
    aiming = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can be denied (headless, iframe): drag still works.
      }
    }
  });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) {
      lookDX += event.movementX;
      lookDY += event.movementY;
    } else if (dragging) {
      lookDX += event.clientX - lastX;
      lookDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 0) firing = true;
    if (event.button === 2) aiming = true;
  });
  window.addEventListener('mouseup', (event) => {
    dragging = false;
    if (event.button === 0) firing = false;
    if (event.button === 2) aiming = false;
  });

  return {
    // Held movement keys, camera-relative: x = strafe right, y = forward.
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, y };
    },
    sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    // Driving keys: y = throttle/brake, x = steer.
    drive() {
      let y = 0;
      let x = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, y, handbrake: keys.has('Space') };
    },
    radioToggle() {
      return keys.has('KeyT');
    },
    // HOTFIX: hold Q for the weapon wheel (GTA-style). Q was free.
    wheelHeld() {
      return keys.has('KeyQ');
    },
    firing() {
      return firing;
    },
    aiming() {
      return aiming;
    },
    // One-shot weapon pick (Digit0-4), consumed by the main loop.
    takeWeaponSelect() {
      const w = weaponSelect;
      weaponSelect = -1;
      return w;
    },
    takeReload() {
      const r = reloadQueued;
      reloadQueued = false;
      return r;
    },
    takeLook() {
      const dx = lookDX;
      const dy = lookDY;
      lookDX = 0;
      lookDY = 0;
      return { dx, dy };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Test / autopilot hook: pretend a key is held.
    press(code) {
      keys.add(code);
    },
    release(code) {
      keys.delete(code);
    },
    // v3 test hook: which keys are currently held (the cover-staging
    // playtest asserts KeyW was held while the chase rolled forward).
    held() {
      return [...keys];
    },
    // Test hook for the mouse buttons (0 = fire, 2 = aim).
    pressMouse(button) {
      if (button === 0) firing = true;
      if (button === 2) aiming = true;
    },
    releaseMouse(button) {
      if (button === 0) firing = false;
      if (button === 2) aiming = false;
    },
  };
}
