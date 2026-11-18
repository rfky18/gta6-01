// Traffic: simple AI cars that loop around city blocks on the road grid.
// They brake for the player's car ahead of them and keep the streets alive.
// v2: 12 cars (was 8) with varied speeds, and they also brake for a
// pursuing police car so chases do not plough through a frozen street.
import { WORLD } from './config.js';
import { buildCarMesh } from './vehicles.js';
import { createRandom, pick, range } from './random.js';

const THREE = window.THREE;
const COLORS = [0xf2c94c, 0x7fb3d5, 0x9b7fb8, 0x5fb8a6, 0xd9d9d9, 0x3a7d5e, 0xc96a3a, 0x8a9bb0, 0x2e6f8e, 0xe86a92, 0xff8a3e]; // v4: + sunset-orange car

export function createTraffic(scene, seed, count) {
  const rng = createRandom(seed + 77);
  const cars = [];
  const roads = WORLD.roads;

  function randomLoop() {
    // A rectangle loop around one block: pick a block centre, loop its 4 roads.
    const bx = pick(rng, [-150, -90, -30, 30, 90, 150]);
    const bz = pick(rng, [-150, -90, -30, 30, 90, 150]);
    const half = WORLD.roadSpacing / 2;
    return [
      { x: bx - half, z: bz - half },
      { x: bx + half, z: bz - half },
      { x: bx + half, z: bz + half },
      { x: bx - half, z: bz + half },
    ];
  }

  for (let i = 0; i < count; i += 1) {
    const mesh = buildCarMesh({ body: pick(rng, COLORS) });
    scene.add(mesh);
    const loop = randomLoop();
    const start = loop[Math.floor(rng() * 4)];
    cars.push({
      mesh,
      loop,
      wp: 0,
      x: start.x + range(rng, -2, 2),
      z: start.z + range(rng, -2, 2),
      speed: range(rng, 7, 12),
      baseSpeed: 0,
      heading: 0,
    });
    cars[i].baseSpeed = cars[i].speed;
  }

  function brakingFor(car, threat) {
    if (!threat) return false;
    const pdx = threat.x - car.x;
    const pdz = threat.z - car.z;
    const pd = Math.hypot(pdx, pdz);
    const ahead = (Math.sin(car.heading) * pdx + Math.cos(car.heading) * pdz) / (pd || 1);
    return pd < 9 && ahead > 0.5;
  }

  // update(dt, playerCarPos, policePos): policePos is optional; traffic
  // brakes for whichever threat is right ahead of it.
  function update(dt, playerCarPos, policePos) {
    for (const car of cars) {
      const target = car.loop[car.wp];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        car.wp = (car.wp + 1) % car.loop.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      // Brake if the player's car (or a police car) is right ahead.
      let speed = car.baseSpeed;
      if (brakingFor(car, playerCarPos) || brakingFor(car, policePos)) speed = 0;
      car.speed += (speed - car.speed) * Math.min(1, dt * 2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.4;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
    }
  }

  // v3 staging hook for the cover: park the first N traffic cars in the
  // two lanes ahead of (x, z), heading the same way, so the chase frame
  // reads as a busy boulevard instead of an empty road. `slots` is a list
  // of {lane, ahead} offsets; heading defaults to Math.PI (south).
  function placeAhead(x, z, heading, slots) {
    const h = heading === undefined ? Math.PI : heading;
    slots.forEach((slot, i) => {
      if (i >= cars.length) return;
      const car = cars[i];
      car.x = x + slot.lane;
      car.z = z + slot.ahead;
      car.heading = h;
      car.speed = slot.speed === undefined ? 9 : slot.speed;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = h;
    });
  }

  return { cars, update, placeAhead };
}
