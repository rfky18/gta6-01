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
  // v2 fix: half the road width (5.5). world.js and pedestrians.js both read
  // WORLD.roadHalf; it was missing in v1, so ground roads and sidewalk lanes
  // computed NaN and were silently skipped by the canvas / walker placement.
  roadHalf: 5.5,
  // Roads sit on this grid (both axes).
  roads: [-180, -120, -60, 0, 60, 120, 180],
};

export function districtAt(x, z) {
  if (x >= 180) return 'Palmera Beach';
  if (z >= 120 && z <= 180) return 'Neon Mile';
  if (x >= -120 && x <= 120 && z >= -120 && z <= 120) return 'Crown District';
  if (x < -120 && z < -120) return 'Old Harbour';
  if (x < -120) return 'West Docks';
  return 'San Vega City';
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
  // v7: top speed 34 -> 47 m/s (122 -> 169 km/h). The cover chases at the
  // old cap read 122 km/h against rank 3's 167 — a real top speed, driven
  // to in the staging rolls, not a HUD override. A sports car outrunning
  // the SVPD cruisers (30 m/s) is the genre, not a balance break.
  maxSpeed: 47,
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
  radioStation: 'Neon FM 101.3',
  radioTrack: 'Sunset Static, Coral Ghosts',
  playerName: 'Dario Cole',
  fixerName: 'Nadia Cruz',
  pdName: 'SVPD',
};

// v10 — tuning for vehicles Dario can steal, not just the hero Solaris:
// traffic cars are slower family sedans, bikes are quicker, twitchier and
// lean into corners (two wheels, less grip, more steer).
export const TRAFFIC_CAR = {
  accel: 14,
  brake: 28,
  reverseAccel: 8,
  maxSpeed: 38,
  maxReverse: 8,
  steer: 1.7,
  grip: 6,
  handbrakeGrip: 1.2,
  wheelRadius: 0.4,
};

export const BIKE = {
  accel: 20,
  brake: 32,
  reverseAccel: 8,
  maxSpeed: 44,
  maxReverse: 8,
  steer: 2.6,
  grip: 4,
  handbrakeGrip: 1.0,
  wheelRadius: 0.34,
  lean: true,
};

// v4 cover staging (shots.js stages exactly this state for ?shot=play):
// late story (mission 7/8), REP 4 with its title, 3-star heat, a full
// 5-unit SVPD response, and the sun low over the water at 19:12.
export const COVER = {
  missionIndex: 6, // SUNSET GETAWAY — MISSION 7/8 (v4: one job deeper than v3)
  missionStage: 1, // stage 2/3 — beach stop done, pier run left (Rico Vane)
  rep: 4,
  wanted: 3,
  money: 34750,
  clockMinutes: 19 * 60 + 12,
};

// v4 — REP XP ladder (cumulative XP needed to REACH each REP level). The HUD
// shows "current / next XP": REP 4 reads 1.960 / 2.400 XP toward REP 5
// (SAN VEGA LEGEND), matching the 80% REP bar.
export const REP_XP = [0, 400, 900, 1500, 1960, 2400];

// v3 — REP titles: BAY HUSTLER now starts at REP 4 (was 5), so the cover's
// REP 4 reads as a made name, like the top-10 covers (REP 3–4 + title).
export const REP_TITLES = [
  { min: 5, title: 'SAN VEGA LEGEND' },
  { min: 4, title: 'BAY HUSTLER' },
  { min: 2, title: 'STREET RUNNER' },
  { min: 0, title: 'NOBODY' },
];

// v3 — the SVPD response grows with heat: VIPER-4 always, VIPER-7 at 2
// stars, VIPER-9 + VIPER-12 at 3 stars, HAWK-1 in the air above them.
export const POLICE_CALLSIGNS = ['VIPER-4', 'VIPER-7', 'VIPER-9', 'VIPER-12'];

// Sunset palette: golden hour over the coast.
export const PALETTE = {
  sky: 0xff9e64,
  fog: 0xf2a06b,
  sun: 0xff8a3e, // v4: warm orange sun (was pale yellow-white 0xffc27a)
  sunLight: 0xffb36b,
  hemiSky: 0xffc2a0, // v8: warmer sky fill (was pink 0xffb8c6) — golden hour, not magenta hour
  hemiGround: 0x6a4a5a,
  ocean: 0x2e6f8e,
  sand: 0xe8c98f,
  asphalt: 0x23262e,
};

// v2 — four original guns (+ fists). Slot 0 is fists, keys 1-4 pick the guns.
// damage = per bullet (shotgun fires `pellets` of them), rate = seconds
// between shots, range = metres, spread = radians of random cone.
export const WEAPONS = [
  { key: 'Digit0', name: 'FISTS', short: 'FISTS', damage: 12, rate: 0.45, mag: Infinity, reserve: Infinity, range: 3.2, spread: 0, pellets: 1, auto: false, kick: 0, sound: 300 },
  { key: 'Digit1', name: 'VK-9 PISTOL', short: 'VK-9', damage: 24, rate: 0.3, mag: 12, reserve: 72, range: 70, spread: 0.012, pellets: 1, auto: false, kick: 0.02, sound: 880 },
  { key: 'Digit2', name: 'WASP SMG', short: 'WASP', damage: 13, rate: 0.085, mag: 32, reserve: 160, range: 55, spread: 0.03, pellets: 1, auto: true, kick: 0.012, sound: 1100 },
  { key: 'Digit3', name: 'BREAKER-12 SHOTGUN', short: 'BRKR-12', damage: 15, rate: 0.9, mag: 6, reserve: 30, range: 28, spread: 0.06, pellets: 6, auto: false, kick: 0.06, sound: 420 },
  { key: 'Digit4', name: 'LONGSHOT RIFLE', short: 'LONGSHOT', damage: 55, rate: 0.8, mag: 8, reserve: 40, range: 120, spread: 0.004, pellets: 1, auto: false, kick: 0.05, sound: 1400 },
];

// v2 — story cast. Portraits are drawn procedurally (portraits.js), one look
// per character: hue + hair + accessory, no remote assets.
export const CHARACTERS = {
  'Nadia Cruz': { hue: 320, hair: 'bob', accessory: 'shades', skin: '#c98d64', jacket: '#ff2e88', initials: 'NC' },
  'Rico Vane': { hue: 200, hair: 'cap', accessory: 'chain', skin: '#8a5a3a', jacket: '#37b6ff', initials: 'RV' },
  'Selma Ortiz': { hue: 150, hair: 'bun', accessory: 'earring', skin: '#e8b88a', jacket: '#37ff8a', initials: 'SO' },
  'Marco Ferro': { hue: 0, hair: 'slick', accessory: 'scar', skin: '#c98d64', jacket: '#ff3e3e', initials: 'MF' },
  'Dario Cole': { hue: 170, hair: 'short', accessory: 'none', skin: '#c98d64', jacket: '#1f8a70', initials: 'DC' },
};

// v2 — enemy tuning for the combat missions (DOCKSIDE TROUBLE, THE FINAL DEAL).
export const ENEMY = {
  health: 60,
  speed: 4.2,
  attackRange: 26,
  attackRate: 1.1,
  damage: 6,
  accuracy: 0.55,
  aggroRange: 42,
  coverHealth: 40,
};
