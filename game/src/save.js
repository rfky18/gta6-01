// Save / load through localStorage. One job: persist the player's progress.
// v2: also stores which story mission the player is on, the weapon the
// player had out, and the ammo in every gun — so a reload resumes mid-story,
// not back at FIRST NIGHT.
import { GAME } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(GAME.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.health,
      armour: state.armour,
      rep: state.rep,
      missionIndex: state.missionIndex || 0,
      missionStage: state.missionStage,
      missionDone: state.missionDone,
      missionAllDone: !!state.missionAllDone,
      weaponSlot: state.weaponSlot || 0,
      mags: state.mags || null,
      reserves: state.reserves || null,
      player: { x: state.playerX, z: state.playerZ },
      car: { x: state.carX, z: state.carZ, heading: state.carHeading },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(GAME.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(GAME.saveKey);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
