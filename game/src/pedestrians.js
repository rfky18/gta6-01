// Pedestrians: low-poly walkers on the sidewalks. They stroll along the
// sidewalk lines, bob as they walk, and step aside when a car gets close.
// v2: gunfire panics them — walkers near a shot turn and run away from it
// for a few seconds, so a firefight visibly empties the street.
import { WORLD } from './config.js';
import { createRandom, pick, range } from './random.js';

const THREE = window.THREE;
const SHIRTS = [0xe86a92, 0x7fb3d5, 0xf2c94c, 0x5fb8a6, 0xd96a5f, 0x9b7fb8, 0xe8e8e8, 0x3a7d5e, 0xff8a3e]; // v4: + sunset-orange shirt

const SKIN_TONES = [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6b4423];
let skinCursor = 0;
function pickSkin() {
  skinCursor = (skinCursor + 1) % SKIN_TONES.length;
  return SKIN_TONES[skinCursor];
}

function buildWalkerMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const skin = new THREE.MeshLambertMaterial({ color: pickSkin() });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), pants);
  legL.position.set(-0.15, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.7, 0.38), shirt);
  torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.7;
  group.add(legL, legR, torso, head);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR };
}

export function createPedestrians(scene, seed, count) {
  const rng = createRandom(seed + 31);
  const walkers = [];
  const roads = WORLD.roads;
  for (let i = 0; i < count; i += 1) {
    const mesh = buildWalkerMesh(pick(rng, SHIRTS));
    scene.add(mesh.group);
    // Walk along a sidewalk: pick a road and an offset lane beside it.
    // Central avenue + Neon Mile get extra walkers so the streets feel alive.
    const road = pick(rng, [...roads, 0, 0, 120, 120]);
    const horizontal = rng() < 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    const lane = road + side * (WORLD.roadHalf + 2.2);
    walkers.push({
      mesh,
      horizontal,
      lane,
      pos: range(rng, -200, 200),
      dir: rng() < 0.5 ? -1 : 1,
      speed: range(rng, 1.1, 2.1),
      baseSpeed: 0,
      phase: rng() * 6,
      dodge: 0,
      panic: 0,
    });
    walkers[i].baseSpeed = walkers[i].speed;
  }

  // Gunfire at (x, z): walkers within 26 m run away from it.
  function panicAt(x, z) {
    for (const w of walkers) {
      const wx = w.horizontal ? w.pos : w.lane;
      const wz = w.horizontal ? w.lane : w.pos;
      const d = Math.hypot(wx - x, wz - z);
      if (d < 26) {
        w.panic = 3;
        // Run away along the sidewalk: flip direction if it points at the shot.
        const away = w.horizontal ? Math.sign(wx - x) || 1 : Math.sign(wz - z) || 1;
        w.dir = away;
      }
    }
  }

  // v3 staging hook for the cover: put the first N walkers on the two
  // sidewalks of a north-south road (roadX), at `spots` of {side, ahead}
  // relative to (roadX, z) — so the chase frame shows pedestrians on both
  // sidewalks. Walkers stroll south/north along the sidewalk after this.
  function placeSidewalk(roadX, z, spots) {
    const half = WORLD.roadHalf + 2.2;
    spots.forEach((spot, i) => {
      if (i >= walkers.length) return;
      const w = walkers[i];
      w.horizontal = false;
      w.lane = roadX + spot.side * half;
      w.pos = z + spot.ahead;
      w.dir = spot.dir === undefined ? (i % 2 === 0 ? -1 : 1) : spot.dir;
      w.mesh.group.position.set(w.lane, 0, w.pos);
    });
  }

  function update(dt, threat) {
    for (const w of walkers) {
      const speed = w.panic > 0 ? w.baseSpeed * 2.6 : w.baseSpeed;
      if (w.panic > 0) w.panic -= dt;
      w.pos += w.dir * speed * dt;
      if (w.pos > 205) {
        w.pos = 205;
        w.dir = -1;
      } else if (w.pos < -205) {
        w.pos = -205;
        w.dir = 1;
      }
      let x = w.horizontal ? w.pos : w.lane;
      let z = w.horizontal ? w.lane : w.pos;
      // Step aside when a car (or the player) rushes at them.
      if (threat) {
        const d = Math.hypot(threat.x - x, threat.z - z);
        if (d < 6 && w.dodge <= 0) {
          w.dodge = 1.2;
          w.dir *= -1;
        }
      }
      if (w.dodge > 0) w.dodge -= dt;
      w.phase += dt * speed * 4;
      const swing = Math.sin(w.phase) * 0.45;
      w.mesh.legL.rotation.x = swing;
      w.mesh.legR.rotation.x = -swing;
      w.mesh.group.position.set(x, Math.abs(Math.sin(w.phase)) * 0.03, z);
      w.mesh.group.rotation.y = w.horizontal ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : w.dir > 0 ? 0 : Math.PI;
    }
  }

  return { walkers, update, panicAt, placeSidewalk };
}
