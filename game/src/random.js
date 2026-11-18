// Seeded RNG (mulberry32) so the city layout is identical for a given seed.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function rangeInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// v2 — helpers the new systems use: shuffle a deck (enemy spawn order,
// traffic colours), clamp a value into a range (health, ammo, camera pitch),
// and a seeded yes/no roll (enemy cover-seeking, pedestrian panic).
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// v3: clamp into 0..1 (HUD bars: REP progress, condition) and linear
// interpolation (camera FOV smoothing in render.js).
export function clamp01(value) {
  return clamp(value, 0, 1);
}

export function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

export function chance(rng, probability) {
  return rng() < probability;
}
