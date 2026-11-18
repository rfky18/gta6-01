// SVPD police: one patrol car. It cruises its beat while the player is clean;
// at wanted level 1+ it pursues, rams, and flashes its light bar. If it pins
// the player down at low speed, the player gets busted.
import { buildCarMesh } from './vehicles.js';

const THREE = window.THREE;

export function createPolice(scene, world) {
  const mesh = buildCarMesh({ body: 0x11131a, police: true });
  scene.add(mesh);
  // HAWK-1 air unit: simple helicopter that shadows the player while wanted.
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
  };
  // Patrol beat: a rectangle loop around downtown.
  const beat = [
    { x: -120, z: -120 },
    { x: 120, z: -120 },
    { x: 120, z: 120 },
    { x: -120, z: 120 },
  ];
  let wp = 0;
  mesh.position.set(state.x, 0, state.z);

  function steerToward(tx, tz, dt, maxSpeed) {
    const dx = tx - state.x;
    const dz = tz - state.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - state.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    state.speed += (maxSpeed - state.speed) * Math.min(1, dt * 1.2);
    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;
    const fixed = world.resolveCollision(state.x, state.z, 1.9);
    state.x = fixed.x;
    state.z = fixed.z;
    return dist;
  }

  function update(dt, target, wanted, time) {
    const tx = target.x;
    const tz = target.z;
    state.distance = Math.hypot(tx - state.x, tz - state.z);
    if (wanted > 0) {
      state.mode = state.distance < 8 ? 'RAMMING' : 'PURSUIT';
      steerToward(tx, tz, dt, 36);
    } else {
      state.mode = 'PATROL';
      const t = beat[wp];
      const d = steerToward(t.x, t.z, dt, 10);
      if (d < 6) wp = (wp + 1) % beat.length;
    }
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
    // Busted: pinned at low speed for 3 seconds.
    if (wanted > 0 && state.distance < 3.5 && Math.abs(target.speed || 0) < 2) {
      state.bustedTimer += dt;
    } else {
      state.bustedTimer = 0;
    }
    // Flash the light bar while pursuing.
    const flash = wanted > 0 && Math.floor(time * 4) % 2 === 0;
    if (mesh.userData.lightRed) mesh.userData.lightRed.visible = flash;
    if (mesh.userData.lightBlue) mesh.userData.lightBlue.visible = wanted > 0 && !flash;
    // Helicopter shadows the player while wanted, hovering high behind.
    if (wanted > 0) {
      heli.visible = true;
      const hx = tx - 60;
      const hz = tz + 14;
      heli.position.set(hx, 20 + Math.sin(time * 0.8) * 1.2, hz);
      heli.rotation.y = Math.atan2(tx - hx, tz - hz);
      rotor.rotation.y += dt * 18;
      spot.visible = true;
    } else {
      heli.visible = false;
    }
    mesh.position.set(state.x, 0, state.z);
    mesh.rotation.y = state.heading;
    const spin = (state.speed * dt) / 0.38;
    for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
    return { mode: state.mode, distance: state.distance, rammed, busted: state.bustedTimer > 3 };
  }

  function teleport(x, z) {
    state.x = x;
    state.z = z;
    state.speed = 0;
    state.bustedTimer = 0;
    mesh.position.set(x, 0, z);
  }

  return { state, mesh, update, teleport };
}
