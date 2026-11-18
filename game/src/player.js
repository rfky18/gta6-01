// Third-person pedestrian: Dario Cole on foot. One job: walk / sprint / jump
// with camera-relative movement, gravity, and building collision.
import { PLAYER } from './config.js';

const THREE = window.THREE;

function buildCharacterMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f8a70 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const cap = new THREE.MeshLambertMaterial({ color: 0xe8a34c });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), pants);
  legL.position.set(-0.16, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.4), jacket);
  torso.position.y = 1.18;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
  armL.position.set(-0.48, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.48;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.78;
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), cap);
  hat.position.y = 2.02;
  group.add(legL, legR, torso, armL, armR, head, hat);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR, armL, armR };
}

export function createPlayer(scene, world) {
  const mesh = buildCharacterMesh();
  scene.add(mesh.group);
  const state = {
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    heading: 0, // facing, radians; 0 = -z
    grounded: true,
    speed: 0,
    walkPhase: 0,
  };

  function place(x, z, heading) {
    state.x = x;
    state.z = z;
    state.y = 0;
    state.vy = 0;
    state.heading = heading || 0;
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = state.heading;
  }

  // move: {x strafe, y forward} camera-relative; camYaw = camera facing angle.
  function update(dt, move, sprint, jump, camYaw) {
    const targetSpeed = (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * (move.x !== 0 || move.y !== 0 ? 1 : 0);
    // Camera-relative: forward is -z rotated by camYaw, right is +x rotated.
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    const dirX = fx * move.y + rx * move.x;
    const dirZ = fz * move.y + rz * move.x;
    const len = Math.hypot(dirX, dirZ) || 1;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 10);
    if (state.speed > 0.1) {
      state.x += (dirX / len) * state.speed * dt;
      state.z += (dirZ / len) * state.speed * dt;
      state.heading = Math.atan2(dirX / len, dirZ / len);
    }
    if (jump && state.grounded) {
      state.vy = PLAYER.jumpSpeed;
      state.grounded = false;
    }
    state.vy += PLAYER.gravity * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
      state.grounded = true;
    }
    const fixed = world.resolveCollision(state.x, state.z, PLAYER.radius);
    state.x = Math.max(-238, Math.min(238, fixed.x));
    state.z = Math.max(-238, Math.min(238, fixed.z));
    // Walk-cycle swing.
    state.walkPhase += dt * state.speed * 1.6;
    const swing = Math.sin(state.walkPhase) * Math.min(0.6, state.speed / 10);
    mesh.legL.rotation.x = swing;
    mesh.legR.rotation.x = -swing;
    mesh.armL.rotation.x = -swing * 0.8;
    mesh.armR.rotation.x = swing * 0.8;
    mesh.group.position.set(state.x, state.y, state.z);
    mesh.group.rotation.y = state.heading;
    return { x: state.x, z: state.z, y: state.y, speed: state.speed, heading: state.heading };
  }

  return { state, place, update, mesh: mesh.group };
}
