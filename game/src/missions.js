// Story missions: eight jobs in one chain, FIRST NIGHT through THE FINAL
// DEAL. One job: objective tracking, beacon marker, dialog lines, rewards.
// Each mission is data — stages of type 'goto' (reach the beacon, press E),
// 'combat' (clear the rivals the stage spawns, then it advances itself) or
// 'deliver' (same as goto, flavour only). The main loop owns money, wanted
// level and the save; this module only reports what happened.
import { GAME, COVER } from './config.js';

const THREE = window.THREE;

// spot = landmark key on the world (garage, pier, docks, plaza, beachfront,
// dealSpot, neonBar, hideout). wantedOnStart is applied by the main loop
// through the hooks when the mission begins.
export const MISSIONS = [
  {
    id: 'first-night', title: 'FIRST NIGHT', chapter: 'CH 1', giver: 'Nadia Cruz', reward: 500,
    stages: [
      { type: 'goto', spot: 'pier', objective: 'Ride to Palmera Pier — Nadia left a package there.', next: 'Pick up the package', line: { speaker: 'Nadia Cruz', text: 'That’s the package. Don’t open it, don’t stop for anyone — garage, now.' } },
      { type: 'deliver', spot: 'garage', objective: 'Package secured. Bring it back to Nadia’s garage.', next: '—', line: { speaker: 'Nadia Cruz', text: 'Clean run, Dario. $500 is yours. The city’s starting to notice you.' } },
    ],
  },
  {
    id: 'stolen-wheels', title: 'STOLEN WHEELS', chapter: 'CH 2', giver: 'Nadia Cruz', reward: 600,
    stages: [
      { type: 'goto', spot: 'plaza', objective: 'Lift the Comet keys from Crown Plaza — the valet leaves them on the counter.', next: 'Grab the keys', line: { speaker: 'Nadia Cruz', text: 'Keys in your pocket? Good. That Comet is worth more than my garage.' } },
      { type: 'deliver', spot: 'garage', objective: 'Keys in hand. Bring them home to the garage.', next: '—', line: { speaker: 'Nadia Cruz', text: 'Two jobs, two paydays. You’re getting good at this, Dario.' } },
    ],
  },
  {
    id: 'neon-runner', title: 'NEON RUNNER', chapter: 'CH 2', giver: 'Rico Vane', reward: 700,
    stages: [
      { type: 'goto', spot: 'neonBar', objective: 'Pick up Rico’s envelope at the Neon Mile bar.', next: 'Grab the envelope', line: { speaker: 'Rico Vane', text: 'That envelope pays my rent for a month. Don’t get it wet, don’t get it read.' } },
      { type: 'deliver', spot: 'beachfront', objective: 'Drop the envelope at the Palmera Beach lifeguard hut.', next: '—', line: { speaker: 'Rico Vane', text: 'Delivered clean. Rico Vane owes you one — and Rico always pays his debts.' } },
    ],
  },
  {
    id: 'police-pressure', title: 'POLICE PRESSURE', chapter: 'CH 3', giver: 'Nadia Cruz', reward: 800, wantedOnStart: 2,
    stages: [
      { type: 'goto', spot: 'plaza', objective: 'SVPD is on you — cut through Crown Plaza and shake them.', next: 'Reach Crown Plaza', line: { speaker: 'Nadia Cruz', text: 'They’re all over the radio, Dario. Keep moving, don’t let them box you in.' } },
      { type: 'deliver', spot: 'hideout', objective: 'Lose the heat at the West Docks hideout.', next: '—', line: { speaker: 'Nadia Cruz', text: 'You vanished like smoke. $800, and the SVPD can keep their paperwork.' } },
    ],
  },
  {
    id: 'dockside-trouble', title: 'DOCKSIDE TROUBLE', chapter: 'CH 3', giver: 'Selma Ortiz', reward: 1000,
    stages: [
      { type: 'goto', spot: 'docks', objective: 'Meet Selma’s crew at the Old Harbour docks.', next: 'Reach the docks', line: { speaker: 'Selma Ortiz', text: 'Ferro’s boys are here to take my crate. You’ve got a gun — use it.' } },
      { type: 'combat', spot: 'docks', count: 3, objective: 'Clear Ferro’s crew off the docks.', next: 'Take them down', line: { speaker: 'Selma Ortiz', text: 'Docks are clear. That’s how you handle Ferro’s boys — grab the crate.' } },
      { type: 'deliver', spot: 'garage', objective: 'Crate secured. Haul it back to the garage.', next: '—', line: { speaker: 'Selma Ortiz', text: 'The crate’s worth more than this whole street. $1,000 — spend it loud.' } },
    ],
  },
  {
    id: 'palm-court-pickup', title: 'PALM COURT PICKUP', chapter: 'CH 4', giver: 'Selma Ortiz', reward: 900,
    stages: [
      { type: 'goto', spot: 'beachfront', objective: 'Selma stashed a parcel by the beachfront palms.', next: 'Grab the parcel', line: { speaker: 'Selma Ortiz', text: 'Parcel’s yours. The bar on Neon Mile is expecting it — back room, no names.' } },
      { type: 'deliver', spot: 'neonBar', objective: 'Deliver it to the Neon Mile bar — ask for the back room.', next: '—', line: { speaker: 'Selma Ortiz', text: 'Done and quiet. That’s how Selma likes it. $900.' } },
    ],
  },
  {
    id: 'sunset-getaway', title: 'SUNSET GETAWAY', chapter: 'CH 4', giver: 'Rico Vane', reward: 1200,
    stages: [
      { type: 'goto', spot: 'plaza', objective: 'Rico’s getaway route: Crown Plaza first.', next: 'Reach Crown Plaza', line: { speaker: 'Rico Vane', text: 'One down, two to go. The sun’s setting — beautiful night for a getaway.' } },
      { type: 'goto', spot: 'beachfront', objective: 'Second stop — Palmera Beach.', next: 'Reach the beach', line: { speaker: 'Rico Vane', text: 'Beach stop done. Last one’s the pier — don’t stop for anyone.' } },
      { type: 'deliver', spot: 'pier', objective: 'Final stop — Palmera Pier. Don’t stop for anyone.', next: '—', line: { speaker: 'Rico Vane', text: 'Three stops, no cops, one sunset. $1,200. Rico Vane drives with legends.' } },
    ],
  },
  {
    id: 'the-final-deal', title: 'THE FINAL DEAL', chapter: 'CH 5', giver: 'Marco Ferro', reward: 2000,
    stages: [
      { type: 'goto', spot: 'dealSpot', objective: 'The deal is at the harbour warehouse. Ferro will be waiting.', next: 'Reach the warehouse', line: { speaker: 'Marco Ferro', text: 'Dario Cole. You made it. Shame about the welcoming party — they shoot first.' } },
      { type: 'combat', spot: 'dealSpot', count: 4, objective: 'Ambush! Ferro’s crew wants the cash. Clear them out.', next: 'Take them down', line: { speaker: 'Marco Ferro', text: 'Huh. You fight like someone who wants to live. The cash is yours — take it and go.' } },
      { type: 'deliver', spot: 'garage', objective: 'Cash secured. Bring it home — this is the last run.', next: '—', line: { speaker: 'Nadia Cruz', text: 'Two thousand, and the whole city saw you walk out of Ferro’s warehouse. San Vega is yours now, Dario.' } },
    ],
  },
];

export const MISSION_TOTAL = MISSIONS.length;

export function createMissions(scene, world, hooks) {
  const state = { index: 0, stage: 0, done: false, allDone: false, hasPackage: false, combatSpawned: false };
  const h = hooks || {};
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

  function current() {
    return MISSIONS[Math.min(state.index, MISSIONS.length - 1)];
  }
  function currentStage() {
    const m = current();
    return m.stages[Math.min(state.stage, m.stages.length - 1)];
  }
  function currentSpot() {
    if (state.allDone) return null;
    const spot = currentStage().spot;
    return world.landmarks[spot] || world.garage;
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

  function startMission() {
    state.stage = 0;
    state.done = false;
    state.hasPackage = false;
    state.combatSpawned = false;
    const m = current();
    if (m.wantedOnStart && h.setWanted) h.setWanted(m.wantedOnStart);
    placeBeacon();
    return { speaker: m.giver, text: m.stages[0].objective };
  }

  function update(dt, time, playerPos, enemiesAlive) {
    gem.rotation.y += dt * 2;
    gem.position.y = 3.2 + Math.sin(time * 2) * 0.4;
    beam.material.opacity = 0.18 + Math.sin(time * 3) * 0.06;
    if (state.allDone) return null;
    const stage = currentStage();
    const spot = currentSpot();
    const d = Math.hypot(playerPos.x - spot.x, playerPos.z - spot.z);
    // Combat stages spawn their rivals once, then advance themselves when
    // the last one goes down.
    if (stage.type === 'combat') {
      if (!state.combatSpawned) {
        state.combatSpawned = true;
        if (h.spawnEnemies) h.spawnEnemies(spot, stage.count || 3);
      } else if (enemiesAlive === 0) {
        const line = stage.line;
        state.stage += 1;
        state.combatSpawned = false;
        placeBeacon();
        return { distance: d, near: false, combatCleared: true, line };
      }
    }
    return { distance: d, near: d < 4 };
  }

  // E pressed near the marker: advance the mission. Returns a dialog line,
  // plus completion info on the final stage.
  function interact() {
    if (state.allDone) return null;
    const m = current();
    const stage = currentStage();
    if (stage.type === 'combat') return null;
    const line = stage.line;
    state.hasPackage = state.stage === 0;
    if (state.stage >= m.stages.length - 1) {
      state.done = true;
      const reward = m.reward;
      const title = m.title;
      if (h.clearWanted) h.clearWanted();
      if (state.index >= MISSIONS.length - 1) {
        state.allDone = true;
        placeBeacon();
        return { speaker: line.speaker, text: line.text, completed: true, reward, title, allDone: true };
      }
      state.index += 1;
      const intro = startMission();
      return { speaker: line.speaker, text: line.text, completed: true, reward, title, nextIntro: intro };
    }
    state.stage += 1;
    state.combatSpawned = false;
    placeBeacon();
    return { speaker: line.speaker, text: line.text };
  }

  function objective() {
    const m = current();
    const stage = currentStage();
    if (state.allDone) {
      return { title: 'SAN VEGA LEGEND', chapter: 'CH 5', giver: m.giver, objective: 'All 8 jobs done. The city is yours, Dario.', next: '—', index: MISSIONS.length - 1, total: MISSIONS.length, stage: 0, stages: 1, progress: 1 };
    }
    const doneStages = state.index;
    const progress = (doneStages + state.stage / m.stages.length) / MISSIONS.length;
    return {
      title: m.title, chapter: m.chapter, giver: m.giver, objective: stage.objective,
      next: stage.next, index: state.index, total: MISSIONS.length,
      stage: state.stage, stages: m.stages.length, progress,
    };
  }

  function reset() {
    state.index = 0;
    state.allDone = false;
    startMission();
  }

  function setState(index, stage, allDone) {
    state.index = Math.max(0, Math.min(index, MISSIONS.length - 1));
    state.stage = stage || 0;
    state.allDone = !!allDone;
    state.done = false;
    state.combatSpawned = false;
    placeBeacon();
  }

  // v3 staging hook for the cover: jump to the late story (MISSION 6/8,
  // PALM COURT PICKUP, second stage) so the cover shows progression, not
  // the first job. Returns the staged mission for the dialog line.
  function setLateGame() {
    setState(COVER.missionIndex, COVER.missionStage, false);
    return current();
  }

  return { state, update, interact, objective, reset, currentSpot, startMission, setState, setLateGame, current };
}
