// NEON DISTRICT: CITY OF CRIME — shared constants for San Vega City.
// One job: every tunable number in one place so the other modules agree.
export const STEP = 1 / 60;

export const WORLD = {
  // Playable city spans x,z in [-240, 240]; the beach + ocean run east of x = 210.
  half: 240,
  beachX: 210,
  oceanX: 236,
  roadSpacing: 60,
  roadWidth: 11,
  // Roads sit on this grid (both axes).
  roads: [-180, -120, -60, 0, 60, 120, 180],
};

export function districtAt(x, z) {
  if (x >= 180) return 'PALMERA BEACH';
  if (z >= 120 && z <= 180) return 'NEON MILE';
  if (x >= -120 && x <= 120 && z >= -120 && z <= 120) return 'CROWN DISTRICT';
  if (x < -120 && z < -120) return 'OLD HARBOUR';
  return 'SAN VEGA CITY';
}

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  accel: 40,
  jumpSpeed: 8.5,
  gravity: -24,
  radius: 0.6,
  height: 1.8,
  health: 100,
  armour: 50,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 6,
  handbrakeGrip: 1.2,
};

export const GAME = {
  title: 'NEON DISTRICT: CITY OF CRIME',
  city: 'San Vega City',
  saveKey: 'neon-district-save-v1',
  startMoney: 250,
  missionReward: 500,
  radioStation: 'NEON FM 101.3',
  radioTrack: 'Sunset Static — Coral Ghosts',
  playerName: 'Dario Cole',
  fixerName: 'Nadia Cruz',
  pdName: 'SVPD',
};

// Sunset palette: golden hour over the coast.
export const PALETTE = {
  sky: 0xff9e64,
  fog: 0xf2a06b,
  sun: 0xffc27a,
  sunLight: 0xffb36b,
  hemiSky: 0xffb8c6,
  hemiGround: 0x5a4a7a,
  ocean: 0x2e6f8e,
  sand: 0xe8c98f,
  asphalt: 0x23262e,
};
