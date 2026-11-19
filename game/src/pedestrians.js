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
    if (m.isMesh) {
      m.castShadow = true;
      // v10: raycast tag, like combat's enemyRoot — so a punch or a bullet
      // can find the walker it hit instead of only the building behind.
      m.userData.walkerRoot = group;
    }
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
      down: 0, // v10: seconds left lying flat after being hit — GTA-style.
      fleeFrom: null,
    });
    walkers[i].baseSpeed = walkers[i].speed;
    mesh.group.userData.walker = walkers[i];
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

  // v9 staging hook for the beach: put walkers on the sand/boardwalk edge
  // (a fixed x line, strolling along z) so the cover's beach has people
  // in it, not just umbrellas. `start` skips the walkers placeSidewalk
  // already claimed, so the two hooks never fight over the same walker.
  function placeBeach(x, z, spots, start) {
    const first = start === undefined ? 0 : start;
    spots.forEach((spot, i) => {
      const w = walkers[first + i];
      if (!w) return;
      w.horizontal = false;
      w.lane = x + (spot.dx || 0);
      w.pos = z + spot.ahead;
      w.dir = spot.dir === undefined ? (i % 2 === 0 ? -1 : 1) : spot.dir;
      w.mesh.group.position.set(w.lane, 0, w.pos);
    });
  }

  function update(dt, threat) {
    for (const w of walkers) {
      // v10: knocked down — lie flat, skip the walk cycle, then get up and
      // run. The panic set by knockDown survives the fall (it is not
      // ticked down while down), so they flee the moment they stand.
      if (w.down > 0) {
        w.down -= dt;
        if (w.down <= 0) {
          w.mesh.group.rotation.x = 0;
          w.mesh.group.position.y = 0;
          w.panic = 4;
          if (w.fleeFrom) panicAt(w.fleeFrom.x, w.fleeFrom.z);
        }
        continue;
      }
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
      // Step aside when a car (or the player) rushes at them — but never
      // while panicking: a fleeing walker already runs from the threat,
      // and flipping it would send it back toward the punch.
      if (threat && w.panic <= 0) {
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

  // v10: hit by Dario (fists or a bullet) — fall flat for 2.5 s, then get
  // up and run from the spot it happened. Returns false if already down.
  function knockDown(w, fromX, fromZ) {
    if (w.down > 0) return false;
    w.down = 2.5;
    w.fleeFrom = { x: fromX, z: fromZ };
    w.mesh.group.rotation.x = -Math.PI / 2;
    w.mesh.group.position.y = 0.4;
    return true;
  }

  return { walkers, update, panicAt, knockDown, placeSidewalk, placeBeach };
}
