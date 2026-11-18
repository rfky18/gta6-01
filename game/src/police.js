// SVPD police: patrol cars. They cruise their beat while the player is
// clean; at wanted level 1+ they pursue, ram, and flash their light bars.
// At wanted 2+ a second unit (VIPER-7) joins; at wanted 3+ two more
// (VIPER-9, VIPER-12) join, so a 3-star chase shows a 5-row response list
// (4 ground units + HAWK-1) in the HUD. If a unit pins the player down at
// low speed, the player gets busted. HAWK-1 shadows from the air.
//
// v2: the pursuit car is scaled up 1.25x so it reads BIG in the chase frame,
// and a second unit joins at wanted 2 — the response list in the HUD shows
// both units plus the helicopter.
// v3: units 3 + 4 join at wanted 3 (cover staging: 5 named units in frame).
import { buildCarMesh } from './vehicles.js';
import { POLICE_CALLSIGNS } from './config.js';

const THREE = window.THREE;
const POLICE_SCALE = 1.25;

function makeHeli() {
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0x22242e }));
  const heliGlass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 1.6), new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 90 }));
  heliGlass.position.set(0, 0.2, 2.4);
  const heliTail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), new THREE.MeshLambertMaterial({ color: 0x22242e }));
  heliTail.position.set(0, 0.3, -4.6);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x11131a }));
  rotor.position.y = 1.1;
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -11;
  heli.add(heliBody, heliGlass, heliTail, rotor, spot);
  heli.visible = false;
  return { heli, rotor, spot };
}

export function createPolice(scene, world) {
  const mesh = buildCarMesh({ body: 0x11131a, police: true });
  mesh.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  scene.add(mesh);
  const unit2 = buildCarMesh({ body: 0x11131a, police: true });
  unit2.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  unit2.visible = false;
  scene.add(unit2);
  // v3: two more pursuit units for 3-star heat (hidden until wanted 3).
  const unit3 = buildCarMesh({ body: 0x11131a, police: true });
  unit3.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  unit3.visible = false;
  scene.add(unit3);
  const unit4 = buildCarMesh({ body: 0x11131a, police: true });
  unit4.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  unit4.visible = false;
  scene.add(unit4);
  // HAWK-1 air unit: simple helicopter that shadows the player while wanted.
  const { heli, rotor, spot } = makeHeli();
  scene.add(heli);
  const state = {
    x: -60,
    z: 60,
    heading: 0,
    speed: 0,
    mode: 'PATROL', // PATROL | PURSUIT | RAMMING
    bustedTimer: 0,
    distance: 999,
    callsign: 'VIPER-4',
    x2: 120,
    z2: -120,
    heading2: 0,
    speed2: 0,
    mode2: 'PATROL',
    distance2: 999,
    x3: -120,
    z3: 120,
    heading3: 0,
    speed3: 0,
    mode3: 'PATROL',
    distance3: 999,
    x4: 120,
    z4: 120,
    heading4: 0,
    speed4: 0,
    mode4: 'PATROL',
    distance4: 999,
    heliX: 0,
    heliZ: 0,
  };
  // Patrol beat: a rectangle loop around downtown.
  const beat = [
    { x: -120, z: -120 },
    { x: 120, z: -120 },
    { x: 120, z: 120 },
    { x: -120, z: 120 },
  ];
  let wp = 0;
  let wp2 = 2;
  mesh.position.set(state.x, 0, state.z);

  function steerToward(unit, tx, tz, dt, maxSpeed) {
    const dx = tx - unit.x;
    const dz = tz - unit.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - unit.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    unit.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    unit.speed += (maxSpeed - unit.speed) * Math.min(1, dt * 1.2);
    unit.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.z += Math.cos(unit.heading) * unit.speed * dt;
    const fixed = world.resolveCollision(unit.x, unit.z, 1.9);
    unit.x = fixed.x;
    unit.z = fixed.z;
    return dist;
  }

  function update(dt, target, wanted, time) {
    const tx = target.x;
    const tz = target.z;
    state.distance = Math.hypot(tx - state.x, tz - state.z);
    if (wanted > 0) {
      state.mode = state.distance < 8 ? 'RAMMING' : 'PURSUIT';
      steerToward(state, tx, tz, dt, 36);
    } else {
      state.mode = 'PATROL';
      const t = beat[wp];
      const d = steerToward(state, t.x, t.z, dt, 10);
      if (d < 6) wp = (wp + 1) % beat.length;
    }
    // Second unit: patrols the far beat while clean, joins the pursuit at
    // wanted 2+ (slightly offset so it does not stack on VIPER-4).
    const u2 = { x: state.x2, z: state.z2, heading: state.heading2, speed: state.speed2 };
    if (wanted >= 2) {
      unit2.visible = true;
      state.mode2 = state.distance2 < 8 ? 'RAMMING' : 'PURSUIT';
      steerToward(u2, tx + 6, tz - 4, dt, 34);
    } else {
      unit2.visible = false;
      state.mode2 = 'PATROL';
      const t = beat[wp2];
      const d = steerToward(u2, t.x, t.z, dt, 10);
      if (d < 6) wp2 = (wp2 + 1) % beat.length;
    }
    state.x2 = u2.x;
    state.z2 = u2.z;
    state.heading2 = u2.heading;
    state.speed2 = u2.speed;
    state.distance2 = Math.hypot(tx - state.x2, tz - state.z2);
    // v3: third + fourth units join at wanted 3, flanking wide so they do
    // not stack on VIPER-4/7. They pursue and cut off (ROADBLOCK when
    // close) but never ram or bust — only the first two units do that, so
    // 3-star heat stays fair.
    const u3 = { x: state.x3, z: state.z3, heading: state.heading3, speed: state.speed3 };
    const u4 = { x: state.x4, z: state.z4, heading: state.heading4, speed: state.speed4 };
    if (wanted >= 3) {
      unit3.visible = true;
      unit4.visible = true;
      state.mode3 = state.distance3 < 10 ? 'ROADBLOCK' : 'PURSUIT';
      state.mode4 = state.distance4 < 8 ? 'RAMMING' : 'PURSUIT';
      steerToward(u3, tx - 6, tz + 8, dt, 33);
      steerToward(u4, tx + 8, tz + 10, dt, 32);
    } else {
      unit3.visible = false;
      unit4.visible = false;
      state.mode3 = 'PATROL';
      state.mode4 = 'PATROL';
      const t3 = beat[(wp2 + 1) % beat.length];
      const t4 = beat[(wp2 + 2) % beat.length];
      steerToward(u3, t3.x, t3.z, dt, 10);
      steerToward(u4, t4.x, t4.z, dt, 10);
    }
    state.x3 = u3.x;
    state.z3 = u3.z;
    state.heading3 = u3.heading;
    state.speed3 = u3.speed;
    state.distance3 = Math.hypot(tx - state.x3, tz - state.z3);
    state.x4 = u4.x;
    state.z4 = u4.z;
    state.heading4 = u4.heading;
    state.speed4 = u4.speed;
    state.distance4 = Math.hypot(tx - state.x4, tz - state.z4);
    // Ram: shove the target when we touch it.
    let rammed = false;
    if (state.distance < 3.4 && wanted > 0) {
      rammed = true;
      const push = 6 * dt;
      const dx = tx - state.x;
      const dz = tz - state.z;
      const d = Math.hypot(dx, dz) || 1;
      target.x += (dx / d) * push * 10;
      target.z += (dz / d) * push * 10;
    }
    if (state.distance2 < 3.4 && wanted >= 2) {
      rammed = true;
      const push = 6 * dt;
      const dx = tx - state.x2;
      const dz = tz - state.z2;
      const d = Math.hypot(dx, dz) || 1;
      target.x += (dx / d) * push * 10;
      target.z += (dz / d) * push * 10;
    }
    // Busted: pinned at low speed for 3 seconds.
    if (wanted > 0 && state.distance < 3.5 && Math.abs(target.speed || 0) < 2) {
      state.bustedTimer += dt;
    } else {
      state.bustedTimer = 0;
    }
    // Flash the light bars while pursuing.
    const flash = wanted > 0 && Math.floor(time * 4) % 2 === 0;
    if (mesh.userData.lightRed) mesh.userData.lightRed.visible = flash;
    if (mesh.userData.lightBlue) mesh.userData.lightBlue.visible = wanted > 0 && !flash;
    if (unit2.userData.lightRed) unit2.userData.lightRed.visible = wanted >= 2 && !flash;
    if (unit2.userData.lightBlue) unit2.userData.lightBlue.visible = wanted >= 2 && flash;
    if (unit3.userData.lightRed) unit3.userData.lightRed.visible = wanted >= 3 && flash;
    if (unit3.userData.lightBlue) unit3.userData.lightBlue.visible = wanted >= 3 && !flash;
    if (unit4.userData.lightRed) unit4.userData.lightRed.visible = wanted >= 3 && !flash;
    if (unit4.userData.lightBlue) unit4.userData.lightBlue.visible = wanted >= 3 && flash;
    // Helicopter shadows the player while wanted, hovering high behind.
    if (wanted > 0) {
      heli.visible = true;
      const hx = tx - 60;
      const hz = tz + 14;
      heli.position.set(hx, 20 + Math.sin(time * 0.8) * 1.2, hz);
      heli.rotation.y = Math.atan2(tx - hx, tz - hz);
      rotor.rotation.y += dt * 18;
      spot.visible = true;
      state.heliX = hx;
      state.heliZ = hz;
    } else {
      heli.visible = false;
    }
    mesh.position.set(state.x, 0, state.z);
    mesh.rotation.y = state.heading;
    unit2.position.set(state.x2, 0, state.z2);
    unit2.rotation.y = state.heading2;
    unit3.position.set(state.x3, 0, state.z3);
    unit3.rotation.y = state.heading3;
    unit4.position.set(state.x4, 0, state.z4);
    unit4.rotation.y = state.heading4;
    // v3 wheel radius 0.40 on every unit.
    const spin = (state.speed * dt) / 0.4;
    for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
    const spin2 = (state.speed2 * dt) / 0.4;
    for (const wheel of unit2.userData.wheels) wheel.rotation.x += spin2;
    const spin3 = (state.speed3 * dt) / 0.4;
    for (const wheel of unit3.userData.wheels) wheel.rotation.x += spin3;
    const spin4 = (state.speed4 * dt) / 0.4;
    for (const wheel of unit4.userData.wheels) wheel.rotation.x += spin4;
    const units = [{ callsign: POLICE_CALLSIGNS[0], distance: state.distance, mode: state.mode }];
    if (wanted >= 2) units.push({ callsign: POLICE_CALLSIGNS[1], distance: state.distance2, mode: state.mode2 });
    if (wanted >= 3) {
      units.push({ callsign: POLICE_CALLSIGNS[2], distance: state.distance3, mode: state.mode3 });
      units.push({ callsign: POLICE_CALLSIGNS[3], distance: state.distance4, mode: state.mode4 });
    }
    return { mode: state.mode, distance: state.distance, rammed, busted: state.bustedTimer > 3, units };
  }

  function teleport(x, z) {
    state.x = x;
    state.z = z;
    state.speed = 0;
    state.bustedTimer = 0;
    mesh.position.set(x, 0, z);
    // Second unit trails behind the first, on the road, not on the beach.
    state.x2 = x - 3;
    state.z2 = z + 16;
    state.speed2 = 0;
    unit2.position.set(state.x2, 0, state.z2);
    // v3: units 3 + 4 trail further back on the same road.
    state.x3 = x + 3;
    state.z3 = z + 30;
    state.speed3 = 0;
    unit3.position.set(state.x3, 0, state.z3);
    state.x4 = x - 3;
    state.z4 = z + 44;
    state.speed4 = 0;
    unit4.position.set(state.x4, 0, state.z4);
  }

  // Staging hook: put VIPER-7 exactly where the shot needs it (mesh + state).
  function placeUnit2(x, z, heading, speed) {
    state.x2 = x;
    state.z2 = z;
    state.heading2 = heading || 0;
    state.speed2 = speed || 0;
    unit2.position.set(x, 0, z);
    unit2.rotation.y = state.heading2;
  }

  // v3 staging hooks: put VIPER-9 / VIPER-12 exactly where the shot needs
  // them (mesh + state), like placeUnit2.
  function placeUnit3(x, z, heading, speed) {
    state.x3 = x;
    state.z3 = z;
    state.heading3 = heading || 0;
    state.speed3 = speed || 0;
    unit3.position.set(x, 0, z);
    unit3.rotation.y = state.heading3;
  }

  function placeUnit4(x, z, heading, speed) {
    state.x4 = x;
    state.z4 = z;
    state.heading4 = heading || 0;
    state.speed4 = speed || 0;
    unit4.position.set(x, 0, z);
    unit4.rotation.y = state.heading4;
  }

  // Staging hook: put HAWK-1 exactly where the shot needs it (ahead of the
  // player, in frame). The next update() re-aims it; shots place it last.
  function placeHeli(x, z, y) {
    heli.visible = true;
    heli.position.set(x, y || 26, z);
    heli.rotation.y = 0;
    spot.visible = true;
    state.heliX = x;
    state.heliZ = z;
  }

  return { state, mesh, update, teleport, placeHeli, placeUnit2, placeUnit3, placeUnit4 };
}
