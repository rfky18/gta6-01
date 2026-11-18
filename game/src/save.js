// Save / load through localStorage. One job: persist the player's progress.
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
      missionStage: state.missionStage,
      missionDone: state.missionDone,
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
