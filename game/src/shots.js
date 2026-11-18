// Screenshot scenes behind ?shot=start|play|end|street. Each one stages the
// real game state deterministically (no mocks, no composited frames) and the
// caller paints it twice, then sets window.__shotReady.
import { GAME } from './config.js';

export function stageShot(game, name) {
  const g = game;
  if (name === 'play') {
    // Cover: sunset chase — Dario driving the Solaris GT west down the
    // central avenue, VIPER-4 in pursuit, wanted 1 star, mission live.
    g.startDrivingAt(30, 0, -Math.PI / 2, 26);
    g.police.teleport(52, 3);
    g.setWanted(1);
    g.state.clockMinutes = 18 * 60 + 52;
    g.state.money = 38420;
    g.missions.state.stage = 0;
    g.missions.state.done = false;
    g.missions.state.hasPackage = false;
    g.missions.reset();
    g.hud.say(GAME.fixerName, 'Alarms are back! Lose them before you come near my garage!', 30);
    g.render.snapBehind(-Math.PI / 2, { x: 30, y: 0, z: 0 }, true);
    // Roll the world forward 1.5 s with the throttle held so traffic,
    // the wheel and the pursuit are mid-motion, not frozen at spawn.
    g.input.press('KeyW');
    for (let i = 0; i < 90; i += 1) g.step(1 / 60, true);
    g.input.release('KeyW');
    // Pull the pursuit into frame: VIPER-4 alongside the Solaris (beside and
    // slightly behind, so the chase cam sees it), heli ahead, traffic ahead.
    // Teleport LAST, after the staging steps, so nothing moves it out of frame.
    const t0 = g.traffic.cars[0];
    t0.x = g.car.state.x - 42;
    t0.z = 2.5;
    t0.heading = -Math.PI / 2;
    t0.speed = 10;
    const t1 = g.traffic.cars[1];
    t1.x = g.car.state.x - 68;
    t1.z = -2.5;
    t1.heading = -Math.PI / 2;
    t1.speed = 9;
    g.input.press('KeyW');
    for (let i = 0; i < 24; i += 1) g.step(1 / 60, true);
    g.input.release('KeyW');
    g.police.teleport(g.car.state.x - 2, g.car.state.z + 5);
    g.police.state.heading = -Math.PI / 2;
    g.police.state.speed = 30;
    return 'play';
  }
  if (name === 'end') {
    // Job complete: Dario on foot at Nadia's garage, package delivered.
    g.missions.state.stage = 2;
    g.missions.state.done = true;
    g.missions.state.hasPackage = true;
    g.state.money = 750;
    g.setWanted(0);
    g.state.clockMinutes = 19 * 60 + 24;
    g.player.place(-150, 122, -Math.PI / 2);
    g.state.driving = false;
    g.player.mesh.visible = true;
    g.hud.say(GAME.fixerName, `Clean run, Dario. $${GAME.missionReward} is yours. The city’s starting to notice you.`, 30);
    g.hud.banner('MISSION COMPLETE — FIRST NIGHT  +$500', 30);
    g.render.snapBehind(-Math.PI / 2, { x: -150, y: 0, z: 122 }, false);
    g.render.cam.yaw = Math.PI / 2;
    return 'play';
  }
  if (name === 'street') {
    // On foot on Neon Mile at dusk, palms and neon signs behind.
    g.player.place(-40, 122, -Math.PI / 2);
    g.state.driving = false;
    g.player.mesh.visible = true;
    g.setWanted(0);
    g.state.clockMinutes = 18 * 60 + 40;
    g.hud.say(GAME.fixerName, 'First night in San Vega, Dario. The package is at Palmera Pier — go get it.', 30);
    g.render.snapBehind(-Math.PI / 2, { x: -40, y: 0, z: 122 }, false);
    g.render.cam.yaw = Math.PI / 2;
    // Two walkers on the Neon Mile sidewalks, in frame, so the shot proves
    // pedestrians exist and walk.
    const w0 = g.pedestrians.walkers[0];
    w0.horizontal = true;
    w0.lane = 127.7;
    w0.pos = -58;
    w0.dir = 1;
    const w1 = g.pedestrians.walkers[1];
    w1.horizontal = true;
    w1.lane = 112.3;
    w1.pos = -22;
    w1.dir = -1;
    for (let i = 0; i < 30; i += 1) g.step(1 / 60, true);
    return 'play';
  }
  // Default: start — title screen over the city at sunset.
  g.player.place(-8, 24, -Math.PI / 2);
  g.state.driving = false;
  g.player.mesh.visible = true;
  g.setWanted(0);
  g.state.clockMinutes = 18 * 60 + 52;
  g.render.cam.yaw = 2.35;
  g.render.cam.pitch = 0.22;
  for (let i = 0; i < 30; i += 1) g.step(1 / 60, true);
  return 'title';
}
