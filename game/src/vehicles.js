// Cars: one factory builds any low-poly car (player, traffic, police) and the
// drivable car adds arcade physics — throttle, brake, reverse, steering,
// handbrake — plus building collision.
import { CAR, WORLD } from './config.js';

const THREE = window.THREE;

export function buildCarMesh(opts) {
  const o = opts || {};
  const bodyColor = o.body || 0xe84a3a;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x11131a });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 90 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.9), bodyMat);
  nose.position.set(0, 0.42, 2.1);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.1), glassMat);
  cabin.position.set(0, 1.12, -0.25);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 2.0), bodyMat);
  roof.position.set(0, 1.45, -0.25);
  group.add(body, nose, cabin, roof);
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headMat);
    h.position.set(s, 0.55, 2.56);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const s of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    t.position.set(s, 0.62, -2.22);
    group.add(t);
  }
  if (o.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), darkMat);
    spoiler.position.set(0, 1.05, -2.05);
    group.add(spoiler);
    for (const s of [-0.7, 0.7]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.4), darkMat);
      fin.position.set(s, 0.85, -2.05);
      group.add(fin);
    }
  }
  if (o.police) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.5), darkMat);
    barBase.position.set(0, 1.56, -0.25);
    group.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.56, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.32, 1.56, -0.25);
    group.add(red, blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.72;
    group.add(stripe);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  group.userData.wheels = wheels;
  return group;
}

// Drivable car state machine.
export function createDrivableCar(scene, world, opts) {
  const mesh = buildCarMesh(opts);
  scene.add(mesh);
  const state = {
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    steer: 0,
    name: (opts && opts.name) || 'Solaris GT',
    condition: 100,
  };

  function place(x, z, heading) {
    state.x = x;
    state.z = z;
    state.heading = heading || 0;
    state.speed = 0;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = state.heading;
  }

  // drive: {x steer -1..1, y throttle 1 / brake -1, handbrake bool}
  function update(dt, drive) {
    const forward = drive.y;
    if (forward > 0) state.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (state.speed > 0.5) state.speed -= CAR.brake * dt;
      else state.speed -= CAR.reverseAccel * dt;
    } else {
      // Rolling drag.
      state.speed -= state.speed * 0.6 * dt;
    }
    if (drive.handbrake) state.speed -= state.speed * 2.4 * dt;
    state.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, state.speed));
    if (Math.abs(state.speed) < 0.05) state.speed = 0;
    const grip = drive.handbrake ? CAR.handbrakeGrip : CAR.grip;
    const targetSteer = drive.x * CAR.steer * Math.min(1, Math.abs(state.speed) / 8);
    state.steer += (targetSteer - state.steer) * Math.min(1, dt * grip);
    state.heading += (state.steer * state.speed * dt) / 2.6;
    const fx = Math.sin(state.heading);
    const fz = Math.cos(state.heading);
    state.x += fx * state.speed * dt;
    state.z += fz * state.speed * dt;
    const fixed = world.resolveCollision(state.x, state.z, 1.9);
    if (fixed.x !== state.x || fixed.z !== state.z) {
      state.speed *= 0.4;
      state.condition = Math.max(40, state.condition - 0.4);
    }
    state.x = Math.max(-236, Math.min(234, fixed.x));
    state.z = Math.max(-238, Math.min(238, fixed.z));
    mesh.position.set(state.x, 0, state.z);
    mesh.rotation.y = state.heading;
    // Spin the wheels.
    const spin = (state.speed * dt) / 0.38;
    for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
    return { x: state.x, z: state.z, speed: state.speed, heading: state.heading, kmh: Math.abs(state.speed) * 3.6 };
  }

  return { state, mesh, place, update };
}
