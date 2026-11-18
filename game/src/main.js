// NEON DISTRICT: CITY OF CRIME — boot + the one loop. Input is read every
// frame, the world advances in fixed 1/60 s steps, the renderer paints what
// is there. Screens: title, play, paused, busted.
// ?seed=N fixes the city layout. ?rain=1 turns on the rain. ?shot=start|play|end|street|combat stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
//
// v3: REP titles come from config.js (BAY HUSTLER at REP 4), the HUD gets a
// REP progress value, and the siren hears the wanted level.
import { STEP, GAME, WORLD, REP_TITLES } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_ENTER, ACTION_PAUSE, ACTION_JUMP, ACTION_INTERACT } from './input.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createDrivableCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { createRender } from './render.js';
import { stageShot } from './shots.js';
import { warmPortraits } from './portraits.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const render = createRender(canvas);
const world = createWorld(render.scene, seed);
const player = createPlayer(render.scene, world);
const car = createDrivableCar(render.scene, world, { body: 0xc01616, sport: true, name: 'Solaris GT' });
const traffic = createTraffic(render.scene, seed, 12);
const pedestrians = createPedestrians(render.scene, seed, 32);
const police = createPolice(render.scene, world);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
warmPortraits();
if (params.get('rain') === '1') world.setRain(true);

const state = {
  screen: 'title',
  money: GAME.startMoney,
  health: 100,
  armour: 50,
  rep: 0,
  wanted: 0,
  crimeTimer: 0,
  driving: false,
  clockMinutes: 18 * 60 + 52,
  time: 0,
  saveTimer: 0,
  stoleCar: false,
  bustedCount: 0,
  kmh: 0,
};

// Combat owns guns + rivals; its hooks feed back into this state.
const combat = createCombat(render.scene, world, {
  audio,
  onPlayerDamage(amount) {
    // Armour absorbs first, the rest hits health.
    let rest = amount;
    if (state.armour > 0) {
      const absorbed = Math.min(state.armour, rest);
      state.armour -= absorbed;
      rest -= absorbed;
    }
    if (rest > 0) state.health -= rest;
    player.flinch();
    if (state.health <= 0) wasted();
  },
  onEnemyDown() {
    state.rep += 0; // kills do not pay REP on their own; missions do.
  },
  onPanic(x, z) {
    pedestrians.panicAt(x, z);
  },
});

const missions = createMissions(render.scene, world, {
  spawnEnemies(spot, count) {
    combat.spawnEnemies(spot, count);
  },
  setWanted(n) {
    setWanted(n);
  },
  clearWanted() {
    setWanted(0);
  },
});

let jumpQueued = false;
let prevRadio = false;
let prevFiring = false;
let policeInfo = { mode: 'PATROL', distance: 999, busted: false, units: [] };

function clockText() {
  const mins = Math.floor(state.clockMinutes);
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `DAY 1  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function streetName(x, z) {
  if (Math.abs(x - 180) < 10) return 'Ocean Boulevard';
  if (Math.abs(z - 120) < 10) return 'Neon Mile';
  if (Math.abs(x) < 130 && Math.abs(z) < 130) return 'Crown Avenue';
  if (x < -120 && z < -120) return 'Harbour Road';
  return 'Palmera Drive';
}

function repTitle() {
  for (const t of REP_TITLES) {
    if (state.rep >= t.min) return t.title;
  }
  return 'NOBODY';
}

// REP progress toward the next title (0..1): REP 4 of 5 reads 80% full.
function repProgress() {
  if (state.rep >= 5) return 1;
  return Math.max(0, Math.min(1, state.rep / 5));
}

function setWanted(n) {
  state.wanted = n;
  if (n > 0) state.crimeTimer = 30;
}

function startDrivingAt(x, z, heading, speed) {
  car.place(x, z, heading);
  if (speed) car.state.speed = speed;
  state.driving = true;
  player.mesh.visible = false;
}

function exitCar() {
  const side = car.state.heading + Math.PI / 2;
  const px = car.state.x + Math.sin(side) * 2.4;
  const pz = car.state.z + Math.cos(side) * 2.4;
  player.place(px, pz, car.state.heading);
  player.mesh.visible = true;
  state.driving = false;
  render.snapBehind(car.state.heading, { x: px, y: 0, z: pz }, false);
}

function doSave() {
  saveGame({
    money: state.money,
    health: state.health,
    armour: state.armour,
    rep: state.rep,
    missionIndex: missions.state.index,
    missionStage: missions.state.stage,
    missionDone: missions.state.done,
    missionAllDone: missions.state.allDone,
    weaponSlot: combat.state.slot,
    mags: combat.state.mags,
    reserves: combat.state.reserves,
    playerX: player.state.x,
    playerZ: player.state.z,
    carX: car.state.x,
    carZ: car.state.z,
    carHeading: car.state.heading,
  });
}

function applySave(data) {
  state.money = data.money ?? GAME.startMoney;
  state.health = data.health ?? 100;
  state.armour = data.armour ?? 50;
  state.rep = data.rep ?? 0;
  missions.setState(data.missionIndex || 0, data.missionStage || 0, !!data.missionAllDone);
  if (typeof data.weaponSlot === 'number') combat.switchWeapon(data.weaponSlot);
  if (Array.isArray(data.mags)) {
    for (let i = 0; i < data.mags.length; i += 1) {
      combat.setAmmo(i, data.mags[i], Array.isArray(data.reserves) ? data.reserves[i] : combat.state.reserves[i]);
    }
  }
  if (data.player) player.place(data.player.x, data.player.z, 0);
  if (data.car) car.place(data.car.x, data.car.z, data.car.heading || 0);
}

function startGame(fresh) {
  audio.unlock();
  if (fresh) {
    missions.reset();
    combat.clearEnemies();
    state.money = GAME.startMoney;
    state.health = 100;
    state.armour = 50;
    state.rep = 0;
    state.wanted = 0;
    state.driving = false;
    player.place(world.playerSpawn.x, world.playerSpawn.z, -Math.PI / 2);
    player.mesh.visible = true;
    car.place(world.carSpawn.x, world.carSpawn.z, -Math.PI / 2);
    police.teleport(-60, 60);
    state.clockMinutes = 18 * 60 + 52;
  }
  state.screen = 'play';
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('busted-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  hud.say(GAME.fixerName, 'First night in San Vega, Dario. The package is at Palmera Pier — go get it.', 8);
  status.textContent = 'Playing Neon District.';
}

function showTitle() {
  state.screen = 'title';
  document.getElementById('title-screen').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
  const saved = loadSave();
  document.getElementById('btn-continue').style.display = saved ? 'block' : 'none';
}

// Busted (pinned by police) and wasted (shot down) share the screen; the
// heading and text say which one happened.
function showEndScreen(kind) {
  state.screen = 'busted';
  const screen = document.getElementById('busted-screen');
  const h1 = screen.querySelector('h1');
  const p = screen.querySelector('p');
  if (kind === 'wasted') {
    if (h1) h1.textContent = 'WASTED';
    if (p) p.textContent = 'Ferro’s crew left you in the gutter. A street doc patched you up for $100 — the night is young.';
  } else {
    if (h1) h1.textContent = 'BUSTED';
    if (p) p.textContent = 'SVPD caught up with you. They took $100 and dropped you at the garage. The night is young.';
  }
  screen.style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
  audio.busted();
  player.place(world.garage.x, world.garage.z, 0);
  player.mesh.visible = true;
  state.driving = false;
  combat.clearEnemies();
  police.teleport(120, -120);
  doSave();
}

function busted() {
  state.bustedCount += 1;
  state.money = Math.max(0, state.money - 100);
  setWanted(0);
  showEndScreen('busted');
}

function wasted() {
  state.money = Math.max(0, state.money - 100);
  setWanted(0);
  state.health = 100;
  state.armour = 50;
  showEndScreen('wasted');
}

// One fixed step of the whole simulation.
function step(dt, silent) {
  state.time += dt;
  world.update(dt, state.time);
  world.applyTimeOfDay(state.clockMinutes);
  traffic.update(dt, state.driving ? car.state : null, police.state);
  pedestrians.update(dt, state.driving ? car.state : player.state);
  const target = state.driving ? car.state : player.state;
  policeInfo = police.update(dt, target, state.wanted, state.time);
  if (state.screen !== 'play' && !silent) return;
  if (state.screen === 'play' || silent) {
    const look = silent ? { dx: 0, dy: 0 } : input.takeLook();
    // Weapon select / reload (on foot only; the wheel is no place for a gun).
    if (!silent) {
      const ws = input.takeWeaponSelect();
      if (ws >= 0 && !state.driving) {
        if (combat.switchWeapon(ws)) player.setArmed(ws > 0, input.aiming());
      }
      if (input.takeReload() && !state.driving) combat.reload();
    }
    if (state.driving) {
      const drive = input.drive();
      const res = car.update(dt, drive);
      state.kmh = res.kmh;
      player.setArmed(false, false);
    } else {
      const move = input.move();
      player.update(dt, move, input.sprint(), jumpQueued, render.cam.yaw);
      jumpQueued = false;
      state.kmh = 0;
      player.setArmed(combat.state.slot > 0, input.aiming());
      // Shooting: left mouse, on foot. Semi-auto guns fire once per click.
      if (!silent && input.firing()) {
        const w = combat.weapon();
        const freshClick = !prevFiring;
        if (w.auto || freshClick) {
          const dir = render.aimDirection();
          const res = combat.tryFire({ x: player.state.x, y: player.state.y, z: player.state.z }, dir);
          if (res) {
            if (res.hit) hud.hitmark();
            render.shake(w.kick || 0.02);
          }
        }
      }
      prevFiring = input.firing();
    }
    combat.update(dt, state.driving ? car.state : player.state);
    // Mission marker proximity + combat-stage auto-advance.
    const mpos = state.driving ? car.state : player.state;
    const m = missions.update(dt, state.time, mpos, combat.enemiesAlive());
    state.missionNear = m ? m.near : false;
    state.missionDistance = m ? m.distance : 999;
    if (m && m.combatCleared && m.line) {
      hud.say(m.line.speaker, m.line.text, 7);
      hud.banner('AREA CLEAR', 3);
      audio.missionDone();
    }
    // Wanted decay: lose the cops by staying far away for a while.
    if (state.wanted > 0) {
      if (policeInfo.distance > 60) state.crimeTimer -= dt;
      else state.crimeTimer = 30;
      if (state.crimeTimer <= 0) {
        setWanted(0);
        hud.banner('YOU LOST THE COPS', 3);
      }
    }
    if (policeInfo.busted && !silent) {
      busted();
      return;
    }
    // Clock + autosave.
    state.clockMinutes += dt * 0.5;
    state.saveTimer += dt;
    if (state.saveTimer > 30) {
      state.saveTimer = 0;
      doSave();
    }
    if (!silent) {
      const speed01 = Math.min(1, Math.abs(car.state.speed) / 34);
      audio.setEngine(state.driving ? speed01 : 0, state.driving);
      audio.setSiren(state.wanted > 0 && policeInfo.distance < 120, state.time, state.wanted);
      render.update(dt, look, { x: target.x, y: target.y || 0, z: target.z }, state.driving, speed01);
      pushHud(dt);
    }
  }
}

function pushHud(dt) {
  const pos = state.driving ? car.state : player.state;
  hud.update({
    dt,
    mission: missions.objective(),
    missionStage: missions.state.stage,
    missionDone: missions.state.done,
    money: state.money,
    wanted: state.wanted,
    clock: clockText(),
    health: state.health,
    armour: state.armour,
    rep: state.rep,
    repTitle: repTitle(),
    repProgress: repProgress(),
    x: pos.x,
    z: pos.z,
    street: streetName(pos.x, pos.z),
    // Speedometer: metres/second x 3.6 = km/h. Max car speed 34 m/s reads
    // 122 km/h — verified in the ?shot=play staging (v1 artifact of 1-8
    // km/h was the llvmpipe software renderer at ~0.3 fps, not the math).
    kmh: state.driving ? Math.abs(car.state.speed) * 3.6 : Math.abs(player.state.speed) * 3.6,
    vehicle: state.driving ? car.state.name : 'ON FOOT',
    condition: car.state.condition,
    policeDistance: Math.hypot(police.state.x - pos.x, police.state.z - pos.z),
    policeMode: policeInfo.mode,
    policeUnits: policeInfo.units || [],
    policeX: police.state.x,
    policeZ: police.state.z,
    traffic: traffic.cars,
    enemies: combat.enemyPositions(),
    missionSpot: missions.currentSpot(),
    heading: state.driving ? car.state.heading : player.state.heading,
    weapons: combat.weaponInfo(),
    showCrosshair: !state.driving && combat.state.slot > 0,
    showInteract: state.missionNear || (!state.driving && Math.hypot(player.state.x - car.state.x, player.state.z - car.state.z) < 4),
  });
}

function handleInteract() {
  if (state.driving) {
    exitCar();
    return;
  }
  if (state.missionNear) {
    const line = missions.interact();
    if (line) {
      hud.say(line.speaker, line.text, 7);
      audio.pickup();
      if (line.completed) {
        state.money += line.reward;
        state.rep += 1;
        audio.missionDone();
        hud.banner(`MISSION COMPLETE — ${line.title}  +$${line.reward}`, 4);
        doSave();
        if (line.nextIntro) {
          window.setTimeout(() => hud.say(line.nextIntro.speaker, line.nextIntro.text, 8), 4500);
        }
        if (line.allDone) {
          hud.banner('SAN VEGA LEGEND — ALL 8 JOBS DONE', 6);
        }
      }
    }
    return;
  }
  const dCar = Math.hypot(player.state.x - car.state.x, player.state.z - car.state.z);
  if (dCar < 4) {
    state.driving = true;
    player.mesh.visible = false;
    render.snapBehind(car.state.heading, { x: car.state.x, y: 0, z: car.state.z }, true);
    if (!state.stoleCar) {
      state.stoleCar = true;
      setWanted(1);
      hud.say(GAME.fixerName, 'That Solaris isn’t yours, Dario — drive it like it is. SVPD is coming.', 6);
      hud.banner('VEHICLE STOLEN — WANTED ★', 3);
    }
  }
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_ENTER) {
    if (state.screen === 'title') startGame(true);
    else if (state.screen === 'busted') {
      document.getElementById('busted-screen').style.display = 'none';
      document.getElementById('hud').style.display = 'block';
      state.screen = 'play';
    }
  }
  if (actions & ACTION_PAUSE) {
    if (state.screen === 'play') {
      state.screen = 'paused';
      document.getElementById('pause-screen').style.display = 'flex';
      doSave();
    } else if (state.screen === 'paused') {
      state.screen = 'play';
      document.getElementById('pause-screen').style.display = 'none';
    }
  }
  if (actions & ACTION_JUMP && state.screen === 'play' && !state.driving) jumpQueued = true;
  if (actions & ACTION_INTERACT && state.screen === 'play') handleInteract();
  const radio = input.radioToggle();
  if (radio && !prevRadio) {
    const on = audio.toggleRadio();
    hud.banner(on ? 'RADIO ON — NEON FM 101.3' : 'RADIO OFF', 2);
  }
  prevRadio = radio;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - frame.last;
  frame.last = now;
  const dt = Math.min(dtMs / 1000, MAX_FRAME);
  handleActions();
  if (state.screen === 'play' || state.screen === 'title') {
    let acc = (frame.acc || 0) + dt;
    while (acc >= STEP && (state.screen === 'play' || state.screen === 'title')) {
      step(STEP, false);
      acc -= STEP;
    }
    frame.acc = acc;
  } else {
    frame.acc = 0;
  }
  if (state.screen === 'title') {
    // Slow orbit over the city behind the title screen.
    render.cam.yaw += dt * 0.02;
    render.cam.targetYaw = render.cam.yaw;
    render.update(dt, { dx: 0, dy: 0 }, { x: -8, y: 0, z: 24 }, false, 0);
  }
  render.render();
}
frame.last = performance.now();

function runShot(name) {
  state.screen = name === 'start' ? 'title' : 'play';
  if (state.screen === 'play') {
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
  }
  const screen = stageShot(game, name);
  // Paint the staged frame twice, then signal the screenshot tool.
  let painted = 0;
  function paint() {
    pushHud(1 / 60);
    render.update(1 / 60, { dx: 0, dy: 0 }, state.driving ? { x: car.state.x, y: 0, z: car.state.z } : { x: player.state.x, y: 0, z: player.state.z }, state.driving, state.driving ? 0.6 : 0);
    render.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return screen;
}

const game = {
  state,
  player,
  car,
  traffic,
  pedestrians,
  police,
  missions,
  combat,
  hud,
  render,
  world,
  input,
  audio,
  setWanted,
  startDrivingAt,
  step,
  get screen() {
    return state.screen;
  },
  set screen(v) {
    state.screen = v;
  },
};
window.__game = game;

// Buttons on the title / pause / busted screens.
document.getElementById('btn-start').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => {
  const saved = loadSave();
  if (saved) applySave(saved);
  startGame(false);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  state.screen = 'play';
  document.getElementById('pause-screen').style.display = 'none';
});
document.getElementById('btn-busted').addEventListener('click', () => {
  document.getElementById('busted-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  state.screen = 'play';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'play') {
    state.screen = 'paused';
    document.getElementById('pause-screen').style.display = 'flex';
  }
});

if (shot) {
  showTitle();
  runShot(shot);
} else {
  player.place(world.playerSpawn.x, world.playerSpawn.z, -Math.PI / 2);
  car.place(world.carSpawn.x, world.carSpawn.z, -Math.PI / 2);
  showTitle();
  requestAnimationFrame(frame);
}
