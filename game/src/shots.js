// Screenshot scenes behind ?shot=start|play|end|street|combat. Each one
// stages the real game state deterministically (no mocks, no composited
// frames) and the caller paints it twice, then sets window.__shotReady.
//
// v2 cover (reference: wet coastal sunset avenue, red sportscar from
// behind): Dario drives the red Solaris GT south down Ocean Boulevard —
// the big sun ahead-left, the ferris wheel ahead-right, palms and the
// beach on the right, downtown towers and the SAN VEGA CITY billboard on
// the left, VIPER-4 big and close beside him, VIPER-7 ahead, HAWK-1 in
// the sky. Wanted 2, $34,750, mission live, full HUD.
import { GAME } from './config.js';

export function stageShot(game, name) {
  const g = game;
  if (name === 'play') {
    // Cover: sunset chase down Ocean Boulevard, heading south (-z): sun
    // ahead-left, ferris wheel ahead-right, beach palms on the right.
    g.startDrivingAt(180, 60, Math.PI, 23);
    g.police.teleport(177, 66);
    g.setWanted(2);
    g.state.clockMinutes = 18 * 60 + 52;
    g.state.money = 34750;
    g.missions.state.index = 0;
    g.missions.state.stage = 0;
    g.missions.state.done = false;
    g.missions.state.allDone = false;
    g.missions.reset();
    g.combat.switchWeapon(2);
    g.hud.say(GAME.fixerName, 'Alarms are back! Lose them before you come near my garage!', 30);
    g.render.snapBehind(Math.PI, { x: 180, y: 0, z: 60 }, true);
    // Roll the world forward 1.5 s with the throttle held so traffic,
    // the wheel and the pursuit are mid-motion, not frozen at spawn.
    g.input.press('KeyW');
    for (let i = 0; i < 90; i += 1) g.step(1 / 60, true);
    g.input.release('KeyW');
    // Traffic ahead on the boulevard, in frame.
    const t0 = g.traffic.cars[0];
    t0.x = g.car.state.x + 2;
    t0.z = g.car.state.z - 42;
    t0.heading = Math.PI;
    t0.speed = 10;
    const t1 = g.traffic.cars[1];
    t1.x = g.car.state.x - 3;
    t1.z = g.car.state.z - 68;
    t1.heading = Math.PI;
    t1.speed = 9;
    g.input.press('KeyW');
    for (let i = 0; i < 24; i += 1) g.step(1 / 60, true);
    g.input.release('KeyW');
    // Pull the pursuit into frame LAST, after the staging steps, so nothing
    // moves it out of frame: VIPER-4 big and close ahead-left of the Solaris,
    // VIPER-7 ahead-right on the road, HAWK-1 in the sky ahead-left.
    // (Ahead = -z here: the camera sits behind the car, so +z is behind it.)
    g.police.teleport(g.car.state.x - 5, g.car.state.z - 8);
    g.police.state.heading = Math.PI;
    g.police.state.speed = 30;
    g.police.placeUnit2(g.car.state.x + 4, g.car.state.z - 34, Math.PI, 28);
    g.police.placeHeli(g.car.state.x - 14, g.car.state.z - 52, 20);
    // Three-quarter rear view, like the reference: swing the chase cam
    // slightly to the side so the Solaris reads as a car, not a flat box.
    // Wide cover FOV so the sun (left) and the ferris wheel (right) both fit.
    g.render.cam.yaw += 0.32;
    g.render.cam.targetYaw = g.render.cam.yaw;
    g.render.cam.baseFov = 76;
    // Apply the wide FOV immediately: paint() only runs twice, and the
    // normal FOV lerp would not get there in time.
    g.render.camera.fov = 79;
    g.render.camera.updateProjectionMatrix();
    return 'play';
  }
  if (name === 'end') {
    // The Final Deal complete: Dario on foot at Nadia's garage, cash home.
    g.missions.setState(7, 2, true);
    g.state.money = 6950;
    g.setWanted(0);
    g.state.clockMinutes = 19 * 60 + 24;
    g.player.place(-150, 122, -Math.PI / 2);
    g.state.driving = false;
    g.player.mesh.visible = true;
    g.hud.say('Nadia Cruz', 'Two thousand, and the whole city saw you walk out of Ferro’s warehouse. San Vega is yours now, Dario.', 30);
    g.hud.banner('MISSION COMPLETE — THE FINAL DEAL  +$2000', 30);
    g.render.snapBehind(-Math.PI / 2, { x: -150, y: 0, z: 122 }, false);
    g.render.cam.yaw = Math.PI / 2;
    return 'play';
  }
  if (name === 'combat') {
    // Dockside firefight: Dario on foot on the harbour road, LONGSHOT rifle
    // out, three of Ferro's crew ahead at the docks, muzzle flash in frame.
    // (The player stands on the open road at (-180,-150): the old spot
    // (-158,-158) put the camera inside the (-150,-150) building block.)
    g.missions.setState(4, 1, false);
    g.state.money = 18450;
    g.setWanted(2);
    g.state.clockMinutes = 18 * 60 + 40;
    g.player.place(-180, -150, 0);
    g.state.driving = false;
    g.player.mesh.visible = true;
    g.combat.switchWeapon(4);
    // Silent steps let the combat stage spawn its three rivals at the docks.
    for (let i = 0; i < 30; i += 1) g.step(1 / 60, true);
    const heading = Math.atan2(-185 - -180, -178 - -150);
    g.player.place(-180, -150, heading);
    g.render.snapBehind(heading, { x: -180, y: 0, z: -150 }, false);
    const dir = g.render.aimDirection();
    const target = { x: -182, y: 1.2, z: -172 };
    g.combat.stageFlash({ x: -180, y: 0, z: -150 }, dir, target);
    g.hud.say('Selma Ortiz', 'Ferro’s boys are here to take my crate. You’ve got a gun — use it.', 30);
    g.hud.banner('DOCKSIDE TROUBLE — CLEAR THE DOCKS', 30);
    return 'play';
  }
  if (name === 'street') {
    // On foot on Neon Mile at dusk, palms and neon signs behind.
    g.player.place(-40, 122, -Math.PI / 2);
    g.state.driving = false;
    g.player.mesh.visible = true;
    g.combat.switchWeapon(1);
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
  g.render.cam.targetYaw = 2.35;
  g.render.cam.pitch = 0.22;
  for (let i = 0; i < 30; i += 1) g.step(1 / 60, true);
  return 'title';
}
