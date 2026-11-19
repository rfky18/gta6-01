// v5 asset preload: the four Pollinations assets live as local files in
// game/assets/ (no network at runtime). They are loaded BEFORE the world
// is built, so every texture is ready on the first paint — the ?shot
// runner paints twice and signals __shotReady, it never waits on us.
// Any file that is missing or slow resolves to null and the world falls
// back to its procedural texture for that surface. Nothing here touches
// Gemini or Tripo (both exhausted, 19 Nov).
const ASSETS = {
  sky: 'assets/sky-sunset.jpg',
  asphalt: 'assets/asphalt.jpg',
  billboard: 'assets/billboard.jpg',
};

export async function loadGameAssets(timeoutMs = 4000) {
  const out = {};
  await Promise.all(Object.entries(ASSETS).map(([key, src]) => new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { out[key] = null; resolve(); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); out[key] = img; resolve(); };
    img.onerror = () => { clearTimeout(timer); out[key] = null; resolve(); };
    img.src = src;
  })));
  return out;
}
