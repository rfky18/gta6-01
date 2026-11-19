// Traffic: simple AI cars that loop around city blocks on the road grid.
// They brake for the player's car ahead of them and keep the streets alive.
// v2: 12 cars (was 8) with varied speeds, and they also brake for a
// pursuing police car so chases do not plough through a frozen street.
// v10: any of them can be stolen — parked or moving, car or bike. A stolen
// vehicle leaves the AI loop (parked where Dario leaves it) and drives on
// the same shared stepVehicle physics as the hero car, with its own tune
// (family sedan / two-wheel bike). Bikes ride in traffic too, leaning into
// corners; two bikes + two cars also sit parked near the spawn so the steal
// works from a fresh start without chasing a moving car.
import { WORLD, TRAFFIC_CAR, BIKE } from './config.js';
import { buildCarMesh, buildBikeMesh, stepVehicle, damageVehicle } from './vehicles.js';
import { createRandom, pick, range } from './random.js';

const THREE = window.THREE;
const COLORS = [0xf2c94c, 0x7fb3d5, 0x9b7fb8, 0x5fb8a6, 0xd9d9d9, 0x3a7d5e, 0xc96a3a, 0x8a9bb0, 0x2e6f8e, 0xe86a92, 0xff8a3e]; // v4: + sunset-orange car
const CAR_NAMES = ['Solano Sedan', 'Crown Coupe', 'Marina Hatchback', 'Palmera Wagon', 'Coral Sedan', 'Neon Coupe', 'Bay Runner', 'Sunset Taxi', 'Harbour Van', 'Dune Coupe', 'Vice Sedan'];
const BIKE_NAMES = ['Vortex 900', 'Neon Rider', 'Street Hawk', 'Coral Cruiser'];
const BIKE_COLORS = [0xff2e88, 0x37e0ff, 0xff8a3e, 0x37ff8a];

export function createTraffic(scene, world, seed, count) {
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

  function addCar(mesh, loop, start, opts) {
    const o = opts || {};
    const car = {
      mesh,
      loop,
      wp: 0,
      x: start.x + range(rng, -2, 2),
      z: start.z + range(rng, -2, 2),
      speed: o.parked ? 0 : range(rng, 7, 12),
      baseSpeed: 0,
      heading: o.heading === undefined ? 0 : o.heading,
      steer: 0,
      kind: o.kind || 'car',
      name: o.name || 'Street Car',
      condition: 100,
      stolen: false,
      parked: !!o.parked,
    };
    car.baseSpeed = car.speed;
    cars.push(car);
    return car;
  }

  for (let i = 0; i < count; i += 1) {
    // v9: cars[0] is the orange convertible — open top, visible driver —
    // so the cover's traffic includes rank 2's driven-convertible beat.
    // placeAhead() parks cars[0] first, so it lands in the cover frame.
    // v9 R2: burnt orange, not pale orange — the R1 paint bleached to
    // beige under the low sun.
    const mesh = i === 0
      ? buildCarMesh({ body: 0xe85d04, convertible: true })
      : buildCarMesh({ body: pick(rng, COLORS) });
    scene.add(mesh);
    const loop = randomLoop();
    const start = loop[Math.floor(rng() * 4)];
    addCar(mesh, loop, start, { name: i === 0 ? 'Solano Convertible' : CAR_NAMES[i % CAR_NAMES.length] });
  }

  // v10: three bikes ride the same loops, a touch faster than the cars.
  for (let i = 0; i < 3; i += 1) {
    const mesh = buildBikeMesh({ body: BIKE_COLORS[i % BIKE_COLORS.length] });
    scene.add(mesh);
    const loop = randomLoop();
    const start = loop[Math.floor(rng() * 4)];
    const bike = addCar(mesh, loop, start, { kind: 'bike', name: BIKE_NAMES[i % BIKE_NAMES.length] });
    bike.speed = range(rng, 9, 13);
    bike.baseSpeed = bike.speed;
  }

  // v10: parked, stealable vehicles near the fresh spawn (player starts at
  // (-8, 24), hero Solaris at (4, 0)) and one bike on Ocean Boulevard for
  // the bike shot — real parked cars, not props: E works on them from a
  // fresh start, no chase needed.
  const parkedSpots = [
    { kind: 'car', x: 8.5, z: 30, heading: Math.PI, name: 'Palmera Wagon', body: 0x5fb8a6 },
    { kind: 'car', x: -8.5, z: 8, heading: 0, name: 'Coral Sedan', body: 0xd96a5f },
    { kind: 'bike', x: 187, z: 55, heading: Math.PI, name: 'Vortex 900', body: 0xff2e88 },
    { kind: 'bike', x: 10.5, z: 18, heading: Math.PI / 2, name: 'Neon Rider', body: 0x37e0ff },
  ];
  for (const spot of parkedSpots) {
    const mesh = spot.kind === 'bike' ? buildBikeMesh({ body: spot.body }) : buildCarMesh({ body: spot.body });
    scene.add(mesh);
    const car = addCar(mesh, null, { x: spot.x, z: spot.z }, { kind: spot.kind, name: spot.name, parked: true, heading: spot.heading });
    car.x = spot.x;
    car.z = spot.z;
    car.heading = spot.heading;
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
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
  // Stolen / parked vehicles sit out the AI loop — they only move when
  // Dario drives them (main.js, via drivableFor).
  function update(dt, playerCarPos, policePos) {
    for (const car of cars) {
      if (car.parked || car.stolen || !car.loop) continue;
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
      const prevHeading = car.heading;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      // Brake if the player's car (or a police car) is right ahead.
      let speed = car.baseSpeed;
      if (brakingFor(car, playerCarPos) || brakingFor(car, policePos)) speed = 0;
      car.speed += (speed - car.speed) * Math.min(1, dt * 2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = (car.speed * dt) / (car.kind === 'bike' ? 0.34 : 0.4);
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
      // Bikes lean into the corner they are actually turning through.
      if (car.kind === 'bike' && car.mesh.userData.visual) {
        const turnRate = (car.heading - prevHeading) / dt;
        car.mesh.userData.visual.rotation.z = Math.max(-0.3, Math.min(0.3, -turnRate * 0.12));
      }
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

  // v10: the drivable handle for one traffic vehicle — the same interface
  // as createDrivableCar ({state, mesh, update, damage}), so main.js can
  // drive a stolen car or bike without caring which factory built it.
  function drivableFor(t) {
    const tune = t.kind === 'bike' ? BIKE : TRAFFIC_CAR;
    return {
      state: t,
      mesh: t.mesh,
      update(dt, drive) {
        const res = stepVehicle(t, t.mesh, world, dt, drive, tune);
        if (res.collided) damageVehicle(t, t.mesh, 0.4);
        return res;
      },
      damage(amount) {
        return damageVehicle(t, t.mesh, amount);
      },
    };
  }

  return { cars, update, placeAhead, drivableFor };
}
