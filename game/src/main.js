// NEON DISTRICT: CITY OF CRIME — boot + the one loop. Input is read every
// frame, the world advances in fixed 1/60 s steps, the renderer paints what
// is there. Screens: title, play, paused, busted.
// ?seed=N fixes the city layout. ?rain=1 turns on the rain. ?shot=start|play|end|street|combat stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
//
// v3: REP titles come from config.js (BAY HUSTLER at REP 4), the HUD gets a
// REP progress value, and the siren hears the wanted level.
// v4: the HUD also gets the XP numbers (REP_XP ladder) and the mission
// timer + PAR BONUS from missions.timer().
import { STEP, GAME, WORLD, CAR, REP_TITLES, REP_XP } from './config.js';
import { createRandom, formatXp } from './random.js';
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
import { createEffects } from './effects.js';
import { stageShot } from './shots.js';
import { warmPortraits } from './portraits.js';
import { loadGameAssets } from './assets.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const render = createRender(canvas);
// v5: preload the Pollinations assets (local files) before building the
// world, so the sky/asphalt/billboard textures exist on the first paint.
const assets = await loadGameAssets();
const world = createWorld(render.scene, seed, assets);
const player = createPlayer(render.scene, world);
const car = createDrivableCar(render.scene, world, { body: 0xc01616, sport: true, name: 'Solaris GT' });
const traffic = createTraffic(render.scene, world, seed, 12);
const pedestrians = createPedestrians(render.scene, seed, 32);
const police = createPolice(render.scene, world);
const hud = createHud();
const audio = createAudio();
// v7: tire dust + exhaust smoke, driven by the car's real speed/throttle.
const effects = createEffects(render.scene, render.camera);
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
  // HOTFIX: seconds since any cop last saw the player (drives the
  // "lose them" decay), and the weapon-wheel state (Q held).
  unseenTimer: 0,
  wheelOpen: false,
};

// v10: the vehicle Dario is driving right now — the hero Solaris, or any
// traffic car / bike he stole (traffic.drivableFor). Every driving read in
// the loop goes through `driven`, never the hero car directly, so a stolen
// car drives, steers, takes damage and shows its own name + condition.
let driven = car;

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
  // v10: hitting a pedestrian is a crime the street sees — the walkers
  // panic and SVPD gets a star, like stealing a car.
  onPedestrianHit(w, x, z) {
    pedestrians.panicAt(x, z);
    if (state.wanted === 0) {
      setWanted(1);
      hud.banner('Pedestrian down — SVPD alerted', 3);
    }
  },
});
combat.setPedestrians(pedestrians);

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
let policeInfo = { mode: 'PATROL', distance: 999, busted: false, units: [], roadblockHit: false, seen: false, searchZone: null };

function clockText() {
  const mins = Math.floor(state.clockMinutes);
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `Day 1  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function streetName(x, z) {
  if (Math.abs(x - 180) < 10) return 'Ocean Boulevard';
  if (Math.abs(z - 120) < 10) return 'Neon Mile';
  if (Math.abs(x) < 130 && Math.abs(z) < 130) return 'Crown Avenue';
  if (x < -120 && z < -120) return 'Harbour Road';
  return 'Palmera Drive';
}

// v5: REP titles are sentence case on screen ("Bay Hustler", not the
// tracked-caps label the old HUD used) — the data stays uppercase in config.
function titleCase(s) {
  return String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function repTitle() {
  for (const t of REP_TITLES) {
    if (state.rep >= t.min) return titleCase(t.title);
  }
  return 'Nobody';
}

// REP progress toward the next title (0..1): REP 4 of 5 reads 80% full.
function repProgress() {
  if (state.rep >= 5) return 1;
  return Math.max(0, Math.min(1, state.rep / 5));
}

// v4: REP XP text for the HUD — "1.960 / 2.400 XP" at REP 4: the XP needed
// to reach this level, over the XP needed for the next one (REP_XP ladder).
function repXpText() {
  const r = Math.max(0, Math.min(state.rep, REP_XP.length - 1));
  const current = REP_XP[r];
  const next = r + 1 < REP_XP.length ? REP_XP[r + 1] : current;
  return `${formatXp(current)}/${formatXp(next)} XP`; // v4: no spaces around '/' so it fits one line under the minimap
}

function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setWanted(n) {
  state.wanted = n;
  if (n > 0) state.crimeTimer = 30;
}

function startDrivingAt(x, z, heading, speed) {
  driven = car;
  car.place(x, z, heading);
  if (speed) car.state.speed = speed;
  state.driving = true;
  player.mesh.visible = false;
}

function exitCar() {
  const v = driven.state;
  const side = v.heading + Math.PI / 2;
  const px = v.x + Math.sin(side) * 2.4;
  const pz = v.z + Math.cos(side) * 2.4;
  player.place(px, pz, v.heading);
  player.mesh.visible = true;
  state.driving = false;
  // A stolen car stays where Dario left it — parked, still his to re-enter.
  driven = car;
  render.snapBehind(v.heading, { x: px, y: 0, z: pz }, false);
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
    driven = car;
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
    if (h1) h1.textContent = 'Wasted';
    if (p) p.textContent = 'Ferro’s crew left you in the gutter. A street doc patched you up for $100 — the night is young.';
  } else {
    if (h1) h1.textContent = 'Busted';
    if (p) p.textContent = 'SVPD caught up with you. They took $100 and dropped you at the garage. The night is young.';
  }
  screen.style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
  audio.busted();
  player.place(world.garage.x, world.garage.z, 0);
  player.mesh.visible = true;
  state.driving = false;
  driven = car;
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
  traffic.update(dt, state.driving ? driven.state : null, police.state);
  pedestrians.update(dt, state.driving ? driven.state : player.state);
  const target = state.driving ? driven.state : player.state;
  policeInfo = police.update(dt, target, state.wanted, state.time, !state.driving);
  // v9: ramming the roadblock costs condition, on top of the speed the
  // block itself already strips — going around stays the fast way through.
  if (policeInfo.roadblockHit && state.driving) driven.damage(1);
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
    // v7: dust/smoke age every step (emission needs real speed + throttle;
    // on foot the throttle is 0, so old puffs just fade out).
    let driveY = 0;
    if (state.driving) {
      const drive = input.drive();
      const res = driven.update(dt, drive);
      state.kmh = res.kmh;
      player.setArmed(false, false);
      driveY = drive.y;
    } else {
      const move = input.move();
      player.update(dt, move, input.sprint(), jumpQueued, render.cam.yaw);
      jumpQueued = false;
      state.kmh = 0;
      player.setArmed(combat.state.slot > 0, input.aiming());
      // Shooting: left mouse, on foot. Semi-auto guns fire once per click.
      // HOTFIX: not while the weapon wheel is open — the wheel owns the mouse.
      if (!silent && input.firing() && !state.wheelOpen) {
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
    effects.update(dt, state.driving ? driven.state : null, driveY);
    combat.update(dt, state.driving ? driven.state : player.state);
    // Mission marker proximity + combat-stage auto-advance.
    const mpos = state.driving ? driven.state : player.state;
    const m = missions.update(dt, state.time, mpos, combat.enemiesAlive());
    state.missionNear = m ? m.near : false;
    state.missionDistance = m ? m.distance : 999;
    if (m && m.combatCleared && m.line) {
      hud.say(m.line.speaker, m.line.text, 7);
      hud.banner('Area clear', 3);
      audio.missionDone();
    }
    // Wanted decay: lose the cops by staying far away for a while.
    // HOTFIX: the old rule (distance > 60 m only) could never fire on
    // foot — a 36 m/s cruiser closes 60 m on an 8 m/s sprint in seconds,
    // so the heat never dropped and the chase never ended (repro E2:
    // crimeTimer stuck at 30 for a full minute on foot). Now the heat
    // also cools while the trail is cold: no unit has seen the player
    // for 5 s (unseenTimer, fed by police.update). Stay out of sight
    // and the timer runs down; get spotted and it resets to 30.
    if (state.wanted > 0) {
      if (policeInfo.distance > 60 || state.unseenTimer > 5) state.crimeTimer -= dt;
      else state.crimeTimer = 30;
      if (state.crimeTimer <= 0) {
        setWanted(0);
        state.unseenTimer = 0;
        hud.banner('You lost the cops', 3);
      }
    }
    // HOTFIX: the unseen clock lives in state (police.js owns the sight
    // check, main.js owns the heat). Keep it in step with the live info.
    state.unseenTimer = policeInfo.unseenFor || 0;
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
      const speed01 = Math.min(1, Math.abs(driven.state.speed) / CAR.maxSpeed);
      audio.setEngine(state.driving ? speed01 : 0, state.driving);
      audio.setSiren(state.wanted > 0 && policeInfo.distance < 120, state.time, state.wanted);
      render.update(dt, look, { x: target.x, y: target.y || 0, z: target.z }, state.driving, speed01);
      pushHud(dt);
    }
  }
}

function pushHud(dt) {
  const pos = state.driving ? car.state : player.state;
  const mt = missions.timer();
  hud.update({
    dt,
    mission: missions.objective(),
    missionTimer: mt.parSeconds > 0 ? formatTimer(mt.remaining) : '',
    missionTimerLate: mt.remaining <= 30 && mt.parSeconds > 0,
    missionPar: mt.parBonus > 0 ? `Par bonus +$${mt.parBonus.toLocaleString('en-US')}` : '',
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
    repXpText: repXpText(),
    x: pos.x,
    z: pos.z,
    street: streetName(pos.x, pos.z),
    // Speedometer: metres/second x 3.6 = km/h. Max car speed 47 m/s reads
    // 169 km/h (v7: raised from 34 m/s / 122 km/h) — verified in the
    // ?shot=play staging, which drives to the real top speed. A stolen
    // bike tops out at 44 m/s (158 km/h), a traffic sedan at 38 (137).
    kmh: state.driving ? Math.abs(driven.state.speed) * 3.6 : Math.abs(player.state.speed) * 3.6,
    vehicle: state.driving ? driven.state.name : 'On foot',
    condition: driven.state.condition,
    policeDistance: Math.hypot(police.state.x - pos.x, police.state.z - pos.z),
    policeMode: policeInfo.mode,
    policeUnits: policeInfo.units || [],
    policeSeen: policeInfo.seen || false,
    // v9: live search zone (centre + radius) for the minimap circle.
    searchZone: policeInfo.searchZone || null,
    policeX: police.state.x,
    policeZ: police.state.z,
    traffic: traffic.cars,
    enemies: combat.enemyPositions(),
    missionSpot: missions.currentSpot(),
    heading: state.driving ? car.state.heading : player.state.heading,
    weapons: combat.weaponInfo(),
    showCrosshair: !state.driving && combat.state.slot > 0,
    showInteract: state.missionNear || (!state.driving && !!nearestVehicle()),
    // HOTFIX: when a vehicle is nearer than the mission beacon, the
    // prompt names the vehicle — the mission no longer swallows E.
    interactLabel: (() => {
      const v = state.driving ? null : nearestVehicle();
      if (v && (!state.missionNear || v.dist < state.missionDistance)) {
        if (v.isBike) return v.stolen ? 'Ride bike' : 'Steal bike';
        return v.stolen ? 'Enter car' : 'Steal car';
      }
      if (state.missionNear) return 'Do the job';
      return 'Enter vehicle';
    })(),
    // HOTFIX: the "lose them" read-out — real numbers, never staged:
    // 0..1 progress toward losing the heat (crimeTimer 30 -> 0) and
    // whether any unit can still see the player.
    losingProgress: state.wanted > 0 ? Math.max(0, Math.min(1, 1 - state.crimeTimer / 30)) : 0,
    escapeState: state.wanted > 0 ? (policeInfo.seen ? 'pursuit' : (policeInfo.allSearching ? 'searching' : 'hiding')) : 'clear',
    unseenFor: state.unseenTimer,
    wheelOpen: state.wheelOpen,
  });
}

// v10 — the P0 fix. E used to work on exactly one car: the hero Solaris
// within 4 m. Now the nearest enterable vehicle in a loose radius wins —
// hero car, any parked car, any moving traffic car, any bike.
// `stolen` is per vehicle: the first theft of each one raises the heat.
// HOTFIX: radius 5.5 -> 7 m (a steal prompt the player can walk past
// without seeing is a prompt that does not exist), and the result carries
// its distance so the mission-vs-vehicle priority is decided on numbers.
function nearestVehicle() {
  if (state.driving) return null;
  let best = null;
  let bestD = 7;
  const dHero = Math.hypot(player.state.x - car.state.x, player.state.z - car.state.z);
  if (dHero < bestD) {
    best = { kind: 'hero', name: car.state.name, stolen: state.stoleCar, isBike: false, dist: dHero };
    bestD = dHero;
  }
  for (const t of traffic.cars) {
    const d = Math.hypot(player.state.x - t.x, player.state.z - t.z);
    if (d < bestD) {
      best = { kind: 'traffic', t, name: t.name, stolen: t.stolen, isBike: t.kind === 'bike', dist: d };
      bestD = d;
    }
  }
  return best;
}

function enterVehicle(v) {
  if (v.kind === 'hero') {
    driven = car;
  } else {
    const t = v.t;
    // The driver bails (convertible driver hides), the car leaves the AI
    // loop and stays parked wherever Dario leaves it.
    t.stolen = true;
    t.parked = true;
    t.speed = 0;
    if (t.mesh.userData.driver) t.mesh.userData.driver.visible = false;
    driven = traffic.drivableFor(t);
  }
  state.driving = true;
  player.mesh.visible = false;
  render.snapBehind(driven.state.heading, { x: driven.state.x, y: 0, z: driven.state.z }, true);
  if (!v.stolen) {
    if (!state.stoleCar) {
      state.stoleCar = true;
      hud.say(GAME.fixerName, v.kind === 'hero'
        ? 'That Solaris isn’t yours, Dario — drive it like it is. SVPD is coming.'
        : 'That one isn’t yours either, Dario — drive it like it is. SVPD is coming.', 6);
    }
    setWanted(Math.max(state.wanted, 1));
    hud.banner(v.isBike ? 'Bike stolen, wanted ★' : 'Vehicle stolen, wanted ★', 3);
  } else {
    hud.banner(v.isBike ? 'Back on the bike' : 'Back in the car', 2);
  }
}

// Staging hook (shots.js 'bike'): enter whatever vehicle is nearest,
// without a keypress.
function enterNearestVehicle() {
  const v = nearestVehicle();
  if (v) enterVehicle(v);
  return !!v;
}

function handleInteract() {
  if (state.driving) {
    exitCar();
    return;
  }
  // HOTFIX: a vehicle nearer than the mission beacon wins E — the old
  // code checked missionNear first, so standing by a job spot with a car
  // next to it stole the keypress for the mission instead of the car.
  const v = nearestVehicle();
  if (v && (!state.missionNear || v.dist < state.missionDistance)) {
    enterVehicle(v);
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
        hud.banner(`Mission complete: ${titleCase(line.title)}, +$${line.reward}`, 4);
        doSave();
        if (line.nextIntro) {
          window.setTimeout(() => hud.say(line.nextIntro.speaker, line.nextIntro.text, 8), 4500);
        }
        if (line.allDone) {
          hud.banner('San Vega Legend: all 8 jobs done', 6);
        }
      }
    }
    return;
  }
  if (v) enterVehicle(v);
}

// HOTFIX — the weapon wheel (hold Q, GTA-style): the game slows to 15%
// while it is open, it lists every owned weapon (all five — fists + the
// four guns are owned from the start, nothing is locked), and it closes
// with the selected weapon on Q release, Esc, or a click on a segment.
function openWheel() {
  if (state.wheelOpen || state.driving || state.screen !== 'play') return;
  state.wheelOpen = true;
  hud.showWheel(combat.weaponInfo());
}

function closeWheel() {
  if (!state.wheelOpen) return;
  state.wheelOpen = false;
  hud.hideWheel();
}

// HOTFIX: a segment click picks the weapon AND closes the wheel — but Q
// is still held, so without this latch the next frame would reopen it.
// The latch suppresses reopening until Q is released.
let wheelClickClosed = false;

function selectWheelSlot(i) {
  if (combat.switchWeapon(i)) player.setArmed(i > 0, input.aiming());
  hud.showWheel(combat.weaponInfo());
}

function handleActions() {
  // Weapon wheel: hold Q to open (on foot only), release Q to close with
  // the selected weapon. Esc / P while open closes the wheel, not the game.
  if (!input.wheelHeld()) wheelClickClosed = false;
  if (state.screen === 'play' && !state.driving && input.wheelHeld() && !wheelClickClosed) openWheel();
  else if (state.wheelOpen && !input.wheelHeld()) closeWheel();
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
    if (state.wheelOpen) {
      closeWheel();
    } else if (state.screen === 'play') {
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
    hud.banner(on ? 'Radio on: Neon FM 101.3' : 'Radio off', 2);
  }
  prevRadio = radio;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - frame.last;
  frame.last = now;
  // HOTFIX: the weapon wheel slows the world to 15% — GTA's beat to pick
  // a gun without getting shot while you browse.
  const dt = Math.min(dtMs / 1000, MAX_FRAME) * (state.wheelOpen ? 0.15 : 1);
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
    render.update(1 / 60, { dx: 0, dy: 0 }, state.driving ? { x: driven.state.x, y: 0, z: driven.state.z } : { x: player.state.x, y: 0, z: player.state.z }, state.driving, state.driving ? 0.6 : 0);
    // v7: re-face the dust/smoke puffs at the paint camera — the staging
    // steps billboarded them to the pre-snap camera, which is edge-on
    // from the final framing (see effects.js billboard()).
    effects.billboard();
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
  enterNearestVehicle,
  nearestVehicle,
  openWheel,
  closeWheel,
  selectWheelSlot,
  get wheelOpen() {
    return state.wheelOpen;
  },
  get driven() {
    return driven;
  },
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
// HOTFIX: weapon-wheel segments are real buttons — a click picks that
// weapon and closes the wheel with it selected.
document.querySelectorAll('#weapon-wheel .wheel-seg').forEach((seg) => {
  seg.addEventListener('click', () => {
    selectWheelSlot(Number(seg.dataset.slot));
    closeWheel();
    wheelClickClosed = true;
  });
});
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
