// Mission FIRST NIGHT: one story job in three stages — ride to Palmera Pier,
// pick up the package, bring it back to Nadia's garage. The beacon marker,
// objective text, dialog lines and rewards all live here.
import { GAME } from './config.js';

const THREE = window.THREE;

export const MISSION_STAGES = [
  { title: 'FIRST NIGHT', objective: 'Ride to Palmera Pier — Nadia left a package there.', next: 'Pick up the package' },
  { title: 'FIRST NIGHT', objective: 'Package secured. Bring it back to Nadia’s garage.', next: 'Return to the garage' },
  { title: 'FIRST NIGHT', objective: 'Job done. The city is yours tonight, Dario.', next: '—' },
];

export function createMissions(scene, world) {
  const state = { stage: 0, done: false, hasPackage: false };
  // Beacon: glowing cylinder + light beam + spinning diamond.
  const beacon = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.25, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.75 }),
  );
  ring.position.y = 0.15;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  gem.position.y = 3.2;
  beacon.add(ring, beam, gem);
  scene.add(beacon);

  const spots = [world.pier, world.garage];
  function currentSpot() {
    return state.done ? null : spots[Math.min(state.stage, 1)];
  }
  function placeBeacon() {
    const spot = currentSpot();
    if (!spot) {
      beacon.visible = false;
      return;
    }
    beacon.visible = true;
    beacon.position.set(spot.x, 0, spot.z);
  }
  placeBeacon();

  function update(dt, time, playerPos) {
    gem.rotation.y += dt * 2;
    gem.position.y = 3.2 + Math.sin(time * 2) * 0.4;
    beam.material.opacity = 0.18 + Math.sin(time * 3) * 0.06;
    if (state.done) return null;
    const spot = currentSpot();
    const d = Math.hypot(playerPos.x - spot.x, playerPos.z - spot.z);
    return { distance: d, near: d < 4 };
  }

  // E pressed near the marker: advance the mission. Returns a dialog line.
  function interact() {
    if (state.done) return null;
    if (state.stage === 0) {
      state.stage = 1;
      state.hasPackage = true;
      placeBeacon();
      return { speaker: GAME.fixerName, text: 'That’s the package. Don’t open it, don’t stop for anyone — garage, now.' };
    }
    if (state.stage === 1) {
      state.stage = 2;
      state.done = true;
      placeBeacon();
      return { speaker: GAME.fixerName, text: `Clean run, Dario. $${GAME.missionReward} is yours. The city’s starting to notice you.` };
    }
    return null;
  }

  function objective() {
    return MISSION_STAGES[Math.min(state.stage, 2)];
  }

  function reset() {
    state.stage = 0;
    state.done = false;
    state.hasPackage = false;
    placeBeacon();
  }

  return { state, update, interact, objective, reset, currentSpot };
}
