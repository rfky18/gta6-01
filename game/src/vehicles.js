// Cars: one factory builds any low-poly car (player, traffic, police) and the
// drivable car adds arcade physics — throttle, brake, reverse, steering,
// handbrake — plus building collision.
//
// v2 bodywork (img2threejs Solaris GT spec, blockout pass — component tree in
// .img2threejs/solaris-gt-spec.json): fastback cabin rake, full-width LED
// tail-light bar, quad exhausts + diffuser on the hero, SANVEGA plate,
// haunch intakes, door shut lines, 5-spoke rims, wider rear track on the
// hero. Paint is a glossy Phong material so the sunset catches it; brake
// lights brighten when the car brakes, and a damaged car puffs smoke.
import { CAR, WORLD } from './config.js';

const THREE = window.THREE;

// Plate texture (hero only): white plate, dark SANVEGA text.
let plateTex = null;
function makePlateTexture() {
  if (plateTex) return plateTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ee';
  g.fillRect(0, 0, 128, 32);
  g.strokeStyle = '#222226';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 30);
  g.fillStyle = '#1c1c22';
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SANVEGA', 64, 17);
  plateTex = new THREE.CanvasTexture(c);
  return plateTex;
}

// 5-spoke rim texture for the hub caps: dark disc, gunmetal spokes, centre dot.
let spokeTex = null;
function makeSpokeTexture() {
  if (spokeTex) return spokeTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#14161c';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a3f47';
  for (let i = 0; i < 5; i += 1) {
    g.save();
    g.translate(64, 64);
    g.rotate((i / 5) * Math.PI * 2);
    g.fillRect(-7, -58, 14, 52);
    g.restore();
  }
  g.fillStyle = '#22242a';
  g.beginPath();
  g.arc(64, 64, 14, 0, Math.PI * 2);
  g.fill();
  spokeTex = new THREE.CanvasTexture(c);
  return spokeTex;
}

// Shared buffers: every car on the street reuses the same geometries.
const GEO = {
  body: new THREE.BoxGeometry(2, 0.62, 4.4),
  hood: new THREE.BoxGeometry(1.86, 0.34, 1.1),
  cabin: new THREE.BoxGeometry(1.7, 0.6, 2.1),
  roof: new THREE.BoxGeometry(1.72, 0.1, 2.0),
  tail: new THREE.BoxGeometry(1.9, 0.4, 0.7),
  light: new THREE.BoxGeometry(0.42, 0.16, 0.08),
  tailBar: new THREE.BoxGeometry(1.7, 0.09, 0.06),
  tailBarEnd: new THREE.BoxGeometry(0.3, 0.1, 0.07),
  diffuser: new THREE.BoxGeometry(1.8, 0.22, 0.06),
  plate: new THREE.PlaneGeometry(0.44, 0.11),
  intake: new THREE.BoxGeometry(0.06, 0.3, 0.4),
  shut: new THREE.BoxGeometry(0.02, 0.5, 0.02),
  mirror: new THREE.BoxGeometry(0.14, 0.16, 0.3),
  grille: new THREE.BoxGeometry(1.2, 0.14, 0.06),
  exhaust: new THREE.CylinderGeometry(0.09, 0.09, 0.24, 8),
  spoiler: new THREE.BoxGeometry(1.8, 0.08, 0.5),
  fin: new THREE.BoxGeometry(0.08, 0.4, 0.4),
  wheel: new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12),
  wheelRear: new THREE.CylinderGeometry(0.38, 0.38, 0.36, 12),
  hub: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10),
  barBase: new THREE.BoxGeometry(1.2, 0.14, 0.5),
  barLight: new THREE.BoxGeometry(0.5, 0.16, 0.5),
  stripe: new THREE.BoxGeometry(2.02, 0.3, 4.42),
  smoke: new THREE.SphereGeometry(0.7, 8, 6),
};

export function buildCarMesh(opts) {
  const o = opts || {};
  const bodyColor = o.body || 0xe84a3a;
  const group = new THREE.Group();
  // Glossy paint: low-poly but reflective, like a wet sunset street.
  const bodyMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 60, specular: 0x553333 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x11131a });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 50, specular: 0x445566 });
  const body = new THREE.Mesh(GEO.body, bodyMat);
  body.position.y = 0.55;
  // Sloped hood + tapered tail so the silhouette reads as a car, not a box.
  const hood = new THREE.Mesh(GEO.hood, bodyMat);
  hood.position.set(0, 0.62, 1.9);
  hood.rotation.x = -0.14;
  const tail = new THREE.Mesh(GEO.tail, bodyMat);
  tail.position.set(0, 0.6, -2.05);
  tail.rotation.x = 0.1;
  const cabin = new THREE.Mesh(GEO.cabin, glassMat);
  cabin.position.set(0, 1.12, -0.25);
  cabin.rotation.x = -0.08; // fastback rake: roofline falls toward the tail
  const roof = new THREE.Mesh(GEO.roof, bodyMat);
  roof.position.set(0, 1.45, -0.35);
  roof.rotation.x = -0.12;
  group.add(body, hood, tail, cabin, roof);
  // Grille + mirrors + exhausts (hero: quad tips, 2 per side).
  const grille = new THREE.Mesh(GEO.grille, darkMat);
  grille.position.set(0, 0.5, 2.56);
  group.add(grille);
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(GEO.mirror, bodyMat);
    mirror.position.set(s * 1.02, 1.05, 0.7);
    group.add(mirror);
    const tips = o.sport ? [0.35, 0.75] : [0.55];
    for (const ex of tips) {
      const exhaust = new THREE.Mesh(GEO.exhaust, darkMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(s * ex, 0.32, -2.42);
      group.add(exhaust);
    }
  }
  // Hero-only spec details: diffuser, SANVEGA plate, haunch intakes, shut lines.
  if (o.sport) {
    const diffuser = new THREE.Mesh(GEO.diffuser, darkMat);
    diffuser.position.set(0, 0.28, -2.41);
    group.add(diffuser);
    const plate = new THREE.Mesh(GEO.plate, new THREE.MeshLambertMaterial({ map: makePlateTexture() }));
    plate.position.set(0, 0.48, -2.43);
    plate.rotation.y = Math.PI;
    group.add(plate);
    for (const s of [-1, 1]) {
      const intake = new THREE.Mesh(GEO.intake, darkMat);
      intake.position.set(s * 0.98, 0.6, -0.9);
      group.add(intake);
      const shut = new THREE.Mesh(GEO.shut, darkMat);
      shut.position.set(s * 1.01, 0.6, 0.4);
      group.add(shut);
    }
  }
  // Headlights + full-width tail-light bar (bar brightens on braking, see setBraking).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.65, 0.65]) {
    const h = new THREE.Mesh(GEO.light, headMat);
    h.position.set(s, 0.55, 2.56);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x992222 });
  const tailLights = [];
  const bar = new THREE.Mesh(GEO.tailBar, tailMat);
  bar.position.set(0, 0.72, -2.42);
  group.add(bar);
  tailLights.push(bar);
  const endMat = new THREE.MeshBasicMaterial({ color: 0xff3524 });
  for (const s of [-0.72, 0.72]) {
    const e = new THREE.Mesh(GEO.tailBarEnd, endMat);
    e.position.set(s, 0.72, -2.42);
    group.add(e);
    tailLights.push(e);
  }
  if (o.sport) {
    const spoiler = new THREE.Mesh(GEO.spoiler, darkMat);
    spoiler.position.set(0, 1.05, -2.05);
    group.add(spoiler);
    for (const s of [-0.7, 0.7]) {
      const fin = new THREE.Mesh(GEO.fin, darkMat);
      fin.position.set(s, 0.85, -2.05);
      group.add(fin);
    }
  }
  if (o.police) {
    const barBase = new THREE.Mesh(GEO.barBase, darkMat);
    barBase.position.set(0, 1.56, -0.25);
    group.add(barBase);
    const red = new THREE.Mesh(GEO.barLight, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.56, -0.25);
    const blue = new THREE.Mesh(GEO.barLight, new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.32, 1.56, -0.25);
    group.add(red, blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(GEO.stripe, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.72;
    group.add(stripe);
  }
  // Wheels: 5-spoke rims (canvas texture on the hub caps, spun with the
  // wheels); hero rear track is wider with wider rear tires (spec).
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const spokeMat = new THREE.MeshLambertMaterial({ map: makeSpokeTexture() });
  const hubSideMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const wheels = [];
  for (const [wx, wz, rear] of [[-0.95, 1.45, false], [0.95, 1.45, false], [-1.0, -1.45, true], [1.0, -1.45, true]]) {
    const wheel = new THREE.Mesh(rear && o.sport ? GEO.wheelRear : GEO.wheel, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    // Hub cap materials: [side, cap, cap] — caps carry the spoke texture.
    const hub = new THREE.Mesh(GEO.hub, [hubSideMat, spokeMat, spokeMat]);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.38, wz);
    group.add(wheel, hub);
    wheels.push(wheel, hub);
  }
  // Damage smoke: a grey puff over the hood, shown when condition is low.
  const smoke = new THREE.Mesh(GEO.smoke, new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 }));
  smoke.position.set(0, 1.4, 1.6);
  smoke.visible = false;
  group.add(smoke);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  group.userData.wheels = wheels;
  group.userData.tailLights = tailLights;
  group.userData.tailMat = tailMat;
  group.userData.smoke = smoke;
  return group;
}

// Brake lights: bright red while braking, dim red otherwise.
export function setBraking(mesh, braking) {
  if (!mesh || !mesh.userData.tailMat) return;
  mesh.userData.tailMat.color.setHex(braking ? 0xff2e2e : 0x992222);
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
    setBraking(mesh, forward < 0 || drive.handbrake);
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
      damage(0.4);
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

  // Damage from crashes / rams: condition drops, smoke shows below 50.
  function damage(amount) {
    state.condition = Math.max(40, state.condition - amount);
    if (mesh.userData.smoke) mesh.userData.smoke.visible = state.condition < 50;
    return state.condition;
  }

  return { state, mesh, place, update, damage };
}
