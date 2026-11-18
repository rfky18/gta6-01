// San Vega City: procedural low-poly coastal city. One job: build the whole
// static world (ground, buildings, palms, beach, ferris wheel, neon signs,
// sky) and hand back its colliders and animated bits.
//
// v2 visual direction (reference: wet coastal sunset avenue): a gradient
// sunset sky dome instead of a flat colour, taller glass towers downtown
// with setbacks and individually lit windows, a big neon SAN VEGA CITY
// billboard, wet asphalt with glossy puddles and neon reflection streaks,
// street lamps, benches, parked cars, a yacht offshore, a highway overpass,
// a distant skyline for atmospheric depth, and a real time-of-day cycle
// (day / golden hour / sunset / night) that re-lights the whole scene.
import { WORLD, PALETTE } from './config.js';
import { createRandom, pick, range, rangeInt, clamp } from './random.js';
import { buildCarMesh } from './vehicles.js';

const THREE = window.THREE;
const TEX_SIZE = 2048;
const MAP_HALF = 280; // ground texture covers [-280, 280] on both axes
const MAP_SCALE = TEX_SIZE / (MAP_HALF * 2);

// ---- shared palm geometry (one set of buffers for every palm) ---------------
const PALM_TRUNK_GEO = new THREE.CylinderGeometry(0.18, 0.3, 5.2, 6);
const PALM_FROND_GEO = new THREE.ConeGeometry(0.9, 3.4, 4);
const PALM_NUT_GEO = new THREE.SphereGeometry(0.28, 6, 5);
const PALM_TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
const PALM_FROND_MAT = new THREE.MeshLambertMaterial({ color: 0x2f8f4e, side: THREE.DoubleSide });
const PALM_NUT_MAT = new THREE.MeshLambertMaterial({ color: 0x6b4a22 });

// ---- canvas helpers -------------------------------------------------------
function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function toPx(v) {
  return (v + MAP_HALF) * MAP_SCALE;
}

// Ground: one 2048 canvas painted with roads, sidewalks, crosswalks, beach,
// boardwalk and ocean — a single draw call for the whole city floor.
// v2: asphalt noise + patches, neon reflection streaks on the wet avenues.
function makeGroundTexture(rng) {
  return canvasTexture(TEX_SIZE, TEX_SIZE, (g) => {
    g.fillStyle = '#2b2e38';
    g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    // City blocks: slightly varied concrete slabs.
    const centres = [-150, -90, -30, 30, 90, 150];
    for (const cx of centres) {
      for (const cz of centres) {
        const shade = 46 + Math.floor(rng() * 14);
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 12})`;
        const half = WORLD.roadSpacing / 2 - 4;
        g.fillRect(toPx(cx - half), toPx(cz - half), half * 2 * MAP_SCALE, half * 2 * MAP_SCALE);
      }
    }
    // Park block (south-west of downtown).
    g.fillStyle = '#3d6b46';
    g.fillRect(toPx(-60), toPx(-180), 52 * MAP_SCALE, 52 * MAP_SCALE);
    g.fillStyle = '#35603d';
    for (let i = 0; i < 26; i += 1) {
      g.beginPath();
      g.arc(toPx(-60 + rng() * 52), toPx(-180 + rng() * 52), 3 * MAP_SCALE, 0, Math.PI * 2);
      g.fill();
    }
    // Roads.
    g.fillStyle = '#17181d';
    for (const r of WORLD.roads) {
      g.fillRect(toPx(r - WORLD.roadHalf), 0, WORLD.roadWidth * MAP_SCALE, TEX_SIZE);
      g.fillRect(0, toPx(r - WORLD.roadHalf), TEX_SIZE, WORLD.roadWidth * MAP_SCALE);
    }
    // Asphalt noise + darker repair patches on the roads.
    for (let i = 0; i < 2600; i += 1) {
      const r = pick(rng, WORLD.roads);
      const along = -MAP_HALF + rng() * MAP_HALF * 2;
      const across = r + (rng() - 0.5) * WORLD.roadWidth;
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(toPx(across), toPx(along), 1.6, 1.6);
    }
    for (let i = 0; i < 26; i += 1) {
      const r = pick(rng, WORLD.roads);
      const along = -MAP_HALF + rng() * MAP_HALF * 2;
      const horizontal = rng() < 0.5;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      if (horizontal) g.fillRect(toPx(r - 4), toPx(along - 3), 8 * MAP_SCALE, 6 * MAP_SCALE);
      else g.fillRect(toPx(along - 3), toPx(r - 4), 6 * MAP_SCALE, 8 * MAP_SCALE);
    }
    // Wet-road neon reflections: soft pink / cyan / sunset-orange streaks
    // along Neon Mile (z = 120) and Ocean Boulevard (x = 180), fading with
    // distance. Stronger now: the reference road is a mirror of neon + sun.
    for (let i = 0; i < 44; i += 1) {
      const pickC = rng();
      g.fillStyle = pickC < 0.4 ? 'rgba(255,46,136,0.2)' : pickC < 0.75 ? 'rgba(55,224,255,0.17)' : 'rgba(255,140,60,0.2)';
      const along = -200 + rng() * 400;
      const w = 1.5 + rng() * 3;
      if (rng() < 0.5) g.fillRect(toPx(120 + (rng() - 0.5) * 8), toPx(along), w * MAP_SCALE, (14 + rng() * 26) * MAP_SCALE);
      else g.fillRect(toPx(along), toPx(120 + (rng() - 0.5) * 8), (14 + rng() * 26) * MAP_SCALE, w * MAP_SCALE);
    }
    // Same wet streaks down Ocean Boulevard (x = 180), the cover's road.
    for (let i = 0; i < 44; i += 1) {
      const pickC = rng();
      g.fillStyle = pickC < 0.4 ? 'rgba(255,46,136,0.22)' : pickC < 0.75 ? 'rgba(55,224,255,0.18)' : 'rgba(255,140,60,0.22)';
      const along = -200 + rng() * 400;
      const w = 1.5 + rng() * 3;
      if (rng() < 0.5) g.fillRect(toPx(180 + (rng() - 0.5) * 8), toPx(along), w * MAP_SCALE, (14 + rng() * 26) * MAP_SCALE);
      else g.fillRect(toPx(along), toPx(180 + (rng() - 0.5) * 8), (14 + rng() * 26) * MAP_SCALE, w * MAP_SCALE);
    }
    // Long orange sun-glare streaks down the middle of Ocean Boulevard —
    // the low sun reflecting on the wet road toward the camera (reference).
    for (let i = 0; i < 7; i += 1) {
      g.fillStyle = 'rgba(255,150,60,0.13)';
      const along = -200 + rng() * 400;
      g.fillRect(toPx(180 + (rng() - 0.5) * 6), toPx(along), (2 + rng() * 2) * MAP_SCALE, (60 + rng() * 40) * MAP_SCALE);
    }
    // Lane markings: yellow centre dashes, white edges.
    g.fillStyle = '#c9a227';
    for (const r of WORLD.roads) {
      for (let v = -MAP_HALF; v < MAP_HALF; v += 12) {
        g.fillRect(toPx(r - 0.3), toPx(v), 0.6 * MAP_SCALE, 5 * MAP_SCALE);
        g.fillRect(toPx(v), toPx(r - 0.3), 5 * MAP_SCALE, 0.6 * MAP_SCALE);
      }
    }
    g.fillStyle = '#c8ccd4';
    for (const r of WORLD.roads) {
      g.fillRect(toPx(r - WORLD.roadHalf + 0.4), 0, 0.35 * MAP_SCALE, TEX_SIZE);
      g.fillRect(toPx(r + WORLD.roadHalf - 0.75), 0, 0.35 * MAP_SCALE, TEX_SIZE);
      g.fillRect(0, toPx(r - WORLD.roadHalf + 0.4), TEX_SIZE, 0.35 * MAP_SCALE);
      g.fillRect(0, toPx(r + WORLD.roadHalf - 0.75), TEX_SIZE, 0.35 * MAP_SCALE);
    }
    // Crosswalks at every intersection.
    g.fillStyle = '#dfe3ea';
    for (const rx of WORLD.roads) {
      for (const rz of WORLD.roads) {
        for (let i = -4; i <= 4; i += 2) {
          g.fillRect(toPx(rx + i - 0.7), toPx(rz - WORLD.roadHalf - 1.5), 1.4 * MAP_SCALE, 3 * MAP_SCALE);
          g.fillRect(toPx(rx - WORLD.roadHalf - 1.5), toPx(rz + i - 0.7), 3 * MAP_SCALE, 1.4 * MAP_SCALE);
        }
      }
    }
    // Sidewalks: lighter curb strips beside every road.
    g.fillStyle = 'rgba(210,214,224,0.16)';
    for (const r of WORLD.roads) {
      g.fillRect(toPx(r - WORLD.roadHalf - 2.2), 0, 1.6 * MAP_SCALE, TEX_SIZE);
      g.fillRect(toPx(r + WORLD.roadHalf + 0.6), 0, 1.6 * MAP_SCALE, TEX_SIZE);
      g.fillRect(0, toPx(r - WORLD.roadHalf - 2.2), TEX_SIZE, 1.6 * MAP_SCALE);
      g.fillRect(0, toPx(r + WORLD.roadHalf + 0.6), TEX_SIZE, 1.6 * MAP_SCALE);
    }
    // Boardwalk strip, then sand, then ocean (east edge).
    g.fillStyle = '#8a6a4a';
    g.fillRect(toPx(202), 0, 10 * MAP_SCALE, TEX_SIZE);
    g.strokeStyle = '#6d5238';
    g.lineWidth = 1;
    for (let z = -MAP_HALF; z < MAP_HALF; z += 4) {
      g.beginPath();
      g.moveTo(toPx(202), toPx(z));
      g.lineTo(toPx(212), toPx(z));
      g.stroke();
    }
    g.fillStyle = '#e8c98f';
    g.fillRect(toPx(212), 0, 24 * MAP_SCALE, TEX_SIZE);
    g.fillStyle = '#d9b878';
    for (let i = 0; i < 400; i += 1) {
      g.fillRect(toPx(212 + rng() * 22), toPx(-MAP_HALF + rng() * MAP_HALF * 2), 2, 2);
    }
    const ocean = g.createLinearGradient(toPx(236), 0, TEX_SIZE, 0);
    ocean.addColorStop(0, '#3d84a6');
    ocean.addColorStop(1, '#1d4a63');
    g.fillStyle = ocean;
    g.fillRect(toPx(236), 0, TEX_SIZE - toPx(236), TEX_SIZE);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    for (let z = -MAP_HALF; z < MAP_HALF; z += 18) {
      g.beginPath();
      g.moveTo(toPx(240 + rng() * 8), toPx(z));
      g.quadraticCurveTo(toPx(255), toPx(z + 4), toPx(268), toPx(z));
      g.stroke();
    }
  });
}

// Lit-window texture shared by every building (emissive map): individual
// windows, some warm, some cool, some dark — v2 lights more of them.
function makeWindowTexture(litRatio, coolRatio) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#101018';
    g.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 248; y += 16) {
      for (let x = 8; x < 120; x += 14) {
        const lit = Math.random() < litRatio;
        g.fillStyle = lit ? (Math.random() < coolRatio ? '#9be8ff' : '#ffd27a') : '#1d2030';
        g.fillRect(x, y, 8, 10);
      }
    }
  });
}

function makeSignTexture(text, bg, fg, sub) {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = fg;
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = fg;
    g.shadowBlur = 18;
    g.fillText(text, 128, sub ? 46 : 64);
    if (sub) {
      g.font = 'bold 26px system-ui, sans-serif';
      g.fillText(sub, 128, 92);
    }
  });
}

// Big neon billboard texture: palm glyph + SAN VEGA CITY, magenta on dark.
function makeBillboardTexture() {
  return canvasTexture(512, 512, (g) => {
    g.fillStyle = '#160a24';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#ff2e88';
    g.lineWidth = 5;
    g.shadowColor = '#ff2e88';
    g.shadowBlur = 26;
    g.strokeRect(10, 10, 492, 492);
    // Palm glyph: trunk + fronds.
    g.strokeStyle = '#ff7ad2';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(256, 300);
    g.quadraticCurveTo(246, 220, 256, 170);
    g.stroke();
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI * (0.15 + i * 0.14);
      g.beginPath();
      g.moveTo(256, 175);
      g.quadraticCurveTo(256 + Math.cos(a) * 70, 175 + Math.sin(a) * 40, 256 + Math.cos(a) * 120, 175 + Math.sin(a) * 90);
      g.stroke();
    }
    g.fillStyle = '#ff7ad2';
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('SAN VEGA', 256, 360);
    g.fillText('CITY', 256, 430);
  });
}

// Sunset sky dome gradient: top purple -> mid pink -> horizon orange.
function makeSkyTexture(top, mid, horizon) {
  return canvasTexture(4, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, mid);
    grad.addColorStop(1, horizon);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
  });
}

function makePalm() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(PALM_TRUNK_GEO, PALM_TRUNK_MAT);
  trunk.position.y = 2.6;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(PALM_FROND_GEO, PALM_FROND_MAT);
    frond.scale.set(1, 1, 0.22);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 5.3, Math.sin(a) * 1.1);
    frond.rotation.set(Math.sin(a) * 1.35, 0, -Math.cos(a) * 1.35);
    frond.castShadow = true;
    group.add(frond);
  }
  const nuts = new THREE.Mesh(PALM_NUT_GEO, PALM_NUT_MAT);
  nuts.position.y = 5.0;
  group.add(nuts);
  return group;
}

// Time-of-day presets: what the sun, sky, fog and lamps look like at each
// phase. The clock in main.js drives applyTimeOfDay() every step.
const TOD = {
  day: { sun: 0xfff2d0, sunI: 1.5, hemiI: 0.95, ambI: 0.45, fog: 0xcfe0ea, sky: ['#7fb3e8', '#a8c8e8', '#f2d8a0'], lamp: 0.25 },
  golden: { sun: 0xffb36b, sunI: 1.25, hemiI: 0.85, ambI: 0.42, fog: 0xf2a06b, sky: ['#4a2a7e', '#d64a7a', '#ff8a3e'], lamp: 0.6 },
  sunset: { sun: 0xff8a4a, sunI: 1.1, hemiI: 0.55, ambI: 0.28, fog: 0xe87a8a, sky: ['#5a3a8a', '#e86a92', '#ff9e3e'], lamp: 1.0 },
  night: { sun: 0x8aa0c8, sunI: 0.25, hemiI: 0.3, ambI: 0.18, fog: 0x1a2038, sky: ['#0a0e22', '#1a2040', '#2a2a4a'], lamp: 1.6 },
};
function todPhase(minutes) {
  const h = (minutes / 60) % 24;
  if (h >= 11 && h < 16.5) return 'day';
  if (h >= 16.5 && h < 18.5) return 'golden';
  if (h >= 18.5 && h < 19.75) return 'sunset';
  return 'night';
}

export function createWorld(scene, seed) {
  const rng = createRandom(seed);
  const colliders = [];
  const buildingMeshes = [];
  const animated = { wheel: null, clouds: [], sunSprite: null, rain: null };
  const lampMats = [];

  // --- sky dome (gradient, replaces the flat solid colour) -----------------
  const skyTex = makeSkyTexture('#8a5a9e', '#ff9e64', '#ffc27a');
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(760, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(skyDome);
  const skyTextures = {};
  for (const key of Object.keys(TOD)) {
    skyTextures[key] = makeSkyTexture(TOD[key].sky[0], TOD[key].sky[1], TOD[key].sky[2]);
  }

  // Sun, fog, lights. The sun sits south-west so a southbound chase down
  // Ocean Boulevard sees it ahead-left, with the ferris wheel ahead-right.
  // v3: the sun hangs LOWER (light y 95 -> 55) for a late-sunset cover —
  // longer shadows, more sky glow over the water.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 700);
  const sun = new THREE.DirectionalLight(PALETTE.sunLight, 1.25);
  sun.position.set(60, 55, -330);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.75);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x604a6a, 0.35);
  scene.add(amb);

  // Sun disc sprite, big over the southern horizon + wide halo. Hard-edged
  // core so the disc reads as a disc against the pink sky, not a soft wash.
  // v3.1: a SHARP core edge (solid to 0.55, gone by 0.72) — the v3 gradient
  // faded too gently and ACES washed the disc into a glow blob.
  const sunTex = canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,243,200,1)');
    grad.addColorStop(0.45, 'rgba(255,179,71,1)');
    grad.addColorStop(0.55, 'rgba(255,150,60,1)');
    grad.addColorStop(0.62, 'rgba(255,122,60,0.85)');
    grad.addColorStop(0.72, 'rgba(255,150,80,0)');
    grad.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  // Sun disc + halo as MESHES, not sprites: sprites did not render in the
  // screenshot stack (verified by aiming the camera straight at one — empty
  // sky), while meshes always do. The disc faces the boulevard.
  // v3: disc lowered (y 130 -> 92) so it sits just over the horizon water
  // in the cover frame instead of high in the sky.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(80, 32),
    new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }),
  );
  sunDisc.position.set(60, 92, -330);
  sunDisc.lookAt(180, 10, 60);
  scene.add(sunDisc);
  // v3.1: smaller, dimmer halo so the sun reads as a crisp disc, not a
  // washed-out pale ellipse (v3 cover: the 150-radius halo drowned the core).
  const haloDisc = new THREE.Mesh(
    new THREE.CircleGeometry(110, 32),
    new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, opacity: 0.25, depthWrite: false, fog: false }),
  );
  haloDisc.position.set(60, 92, -330);
  haloDisc.lookAt(180, 10, 60);
  scene.add(haloDisc);
  animated.sunSprite = sunDisc;

  // Clouds: flattened mesh puffs (same reason as the sun — meshes render,
  // sprites did not in the screenshot stack), drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffc9a0, transparent: true, opacity: 0.65, fog: false });
  for (let i = 0; i < 12; i += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    cloud.scale.set(range(rng, 45, 95), range(rng, 6, 12), range(rng, 16, 26));
    cloud.position.set(range(rng, -320, 320), range(rng, 60, 110), range(rng, -320, 320));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // Distant skyline: dark tower silhouettes beyond the playable city, for
  // atmospheric depth in the sunset haze.
  const skylineMat = new THREE.MeshLambertMaterial({ color: 0x4a3a5e, emissive: 0x1a1226, emissiveIntensity: 0.6 });
  const skylineGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2;
    const radius = range(rng, 300, 420);
    const w = range(rng, 18, 34);
    const h = range(rng, 40, 130);
    const tower = new THREE.Mesh(skylineGeo, skylineMat);
    tower.scale.set(w, h, w);
    tower.position.set(Math.cos(angle) * radius, h / 2 - 2, Math.sin(angle) * radius);
    scene.add(tower);
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Wet-road puddles: glossy Phong patches that catch the sunset + neon.
  const puddleMat = new THREE.MeshPhongMaterial({ color: 0x4a5a70, shininess: 220, specular: 0xff9e64, transparent: true, opacity: 0.65 });
  const puddleGeo = new THREE.CircleGeometry(1, 20);
  for (let i = 0; i < 26; i += 1) {
    const puddle = new THREE.Mesh(puddleGeo, puddleMat);
    const road = pick(rng, WORLD.roads);
    const along = range(rng, -210, 210);
    if (rng() < 0.5) puddle.position.set(road + range(rng, -4, 4), 0.06, along);
    else puddle.position.set(along, 0.06, road + range(rng, -4, 4));
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(range(rng, 2.5, 6), range(rng, 1.5, 3), 1);
    scene.add(puddle);
  }

  // Buildings: downtown glass towers with setbacks, beach low-rises, and
  // mid blocks. Each tower is base + setback crown + rooftop plant, so the
  // skyline is not a row of identical cubes.
  const windowTexWarm = makeWindowTexture(0.55, 0.25);
  const windowTexGlass = makeWindowTexture(0.62, 0.6);
  const palette = [0xd96a5f, 0xe8a34c, 0x7fb3d5, 0x9b7fb8, 0xe86a92, 0x5fb8a6, 0xd9c25f, 0x8a9bb0, 0xc97b4a, 0x6a8fbf];
  const materials = palette.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, emissive: 0xccaa77, emissiveMap: windowTexWarm, emissiveIntensity: 1.5 }),
  );
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x5a7fa8, shininess: 90, specular: 0xffb36b, emissive: 0x334455, emissiveMap: windowTexGlass, emissiveIntensity: 2.0 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const centres = [-150, -90, -30, 30, 90, 150];
  for (const cx of centres) {
    for (const cz of centres) {
      if (cx === -30 && cz === -150) continue; // park block
      const downtown = Math.abs(cx) <= 90 && Math.abs(cz) <= 90;
      const beach = cx === 150;
      const count = downtown ? 1 : beach ? 2 : 3;
      for (let b = 0; b < count; b += 1) {
        const w = downtown ? range(rng, 26, 34) : range(rng, 14, 24);
        const d = downtown ? range(rng, 26, 34) : range(rng, 14, 24);
        const h = downtown ? range(rng, 34, 78) : beach ? range(rng, 8, 16) : range(rng, 10, 26);
        const ox = count === 1 ? 0 : (b - (count - 1) / 2) * 15;
        const oz = count === 1 ? 0 : (b % 2 === 0 ? -11 : 11);
        const x = cx + ox;
        const z = cz + oz;
        const mat = downtown && rng() < 0.45 ? glassMat : materials[Math.floor(rng() * materials.length)];
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        buildingMeshes.push(building);
        // Setback crown on tall towers.
        if (h > 30) {
          const crown = new THREE.Mesh(boxGeo, mat);
          crown.scale.set(w * 0.55, range(rng, 6, 14), d * 0.55);
          crown.position.set(x, h + crown.scale.y / 2, z);
          crown.castShadow = true;
          scene.add(crown);
          buildingMeshes.push(crown);
          const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xff3e3e }));
          beacon.position.set(x, h + crown.scale.y + 1, z);
          scene.add(beacon);
        }
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w * 0.7, 1.2, d * 0.7);
        roof.position.set(x, h + 0.6, z);
        scene.add(roof);
        // Rooftop AC box on taller towers.
        if (h > 30) {
          const ac = new THREE.Mesh(boxGeo, roofMat);
          ac.scale.set(4, 2.4, 4);
          ac.position.set(x + w * 0.2, h + 1.2, z - d * 0.2);
          scene.add(ac);
        }
        // Balcony ledges on mid-rise blocks.
        if (h > 12 && h <= 30 && rng() < 0.7) {
          for (const fy of [0.35, 0.65]) {
            const ledge = new THREE.Mesh(boxGeo, roofMat);
            ledge.scale.set(w + 1.2, 0.5, 1.4);
            ledge.position.set(x, h * fy, z + d / 2 + 0.4);
            scene.add(ledge);
          }
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Neon signs along Neon Mile (buildings facing the z=120 road) + pier + hotel.
  const signs = [
    { text: 'NEON', bg: '#1a0b2e', fg: '#ff2e88', x: -90, y: 9, z: 136.5, w: 16, ry: Math.PI },
    { text: 'PIER 9', bg: '#06283a', fg: '#37e0ff', x: 150, y: 8, z: 136.5, w: 14, ry: Math.PI },
    { text: 'HOTEL', bg: '#2e0b1a', fg: '#ffd23e', x: 30, y: 12, z: 136.5, w: 14, ry: Math.PI },
    { text: 'BAR 24', bg: '#0b2e1a', fg: '#7dff5e', x: -30, y: 7, z: 136.5, w: 12, ry: Math.PI },
    { text: 'SAN VEGA', bg: '#1a0b2e', fg: '#ff9e3e', x: 222, y: 12, z: -40, w: 22, ry: -Math.PI / 2 },
    { text: 'TACOS', bg: '#2e1a0b', fg: '#ff5e3e', x: 90, y: 8, z: 136.5, w: 12, ry: Math.PI },
    { text: 'DOCK 9', bg: '#0b1a2e', fg: '#37e0ff', x: -180, y: 8, z: -168, w: 14, ry: 0 },
    { text: 'CASINO', bg: '#2e0b2e', fg: '#ff2e88', x: -150, y: 10, z: 136.5, w: 16, ry: Math.PI },
    { text: 'MOTEL', bg: '#1a2e0b', fg: '#7dff5e', x: 120, y: 9, z: -136.5, w: 14, ry: 0 },
  ];
  for (const s of signs) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.w * 0.5),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(s.text, s.bg, s.fg) }),
    );
    sign.position.set(s.x, s.y, s.z);
    if (s.ry) sign.rotation.y = s.ry;
    scene.add(sign);
  }
  // Big SAN VEGA CITY billboard on the tallest downtown tower face (east side
  // of the tower at x=90, z=-30), visible from Ocean Boulevard.
  const billboard = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: makeBillboardTexture() }),
  );
  billboard.position.set(107.5, 30, -30);
  billboard.rotation.y = Math.PI / 2;
  scene.add(billboard);
  // Vertical HOTEL neon on the beachfront tower.
  const hotelSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 22),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('HOTEL', '#1a0b2e', '#ff2e88') }),
  );
  hotelSign.position.set(168, 14, 90);
  hotelSign.rotation.y = -Math.PI / 2;
  scene.add(hotelSign);

  // Highway overpass across the north edge (z = -210): deck + pillars.
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const deck = new THREE.Mesh(boxGeo, deckMat);
  deck.scale.set(480, 1.6, 10);
  deck.position.set(0, 9, -210);
  deck.castShadow = true;
  scene.add(deck);
  for (let x = -220; x <= 220; x += 44) {
    const pillar = new THREE.Mesh(boxGeo, deckMat);
    pillar.scale.set(2.4, 9, 2.4);
    pillar.position.set(x, 4.5, -210);
    scene.add(pillar);
  }

  // Docks: shipping containers + a crane at Old Harbour.
  const containerColors = [0xc96a3a, 0x3a7d5e, 0x2e6f8e, 0xd9c25f, 0x8a2a2a];
  for (let i = 0; i < 10; i += 1) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, containerColors) }));
    const cx = -195 + (i % 5) * 9;
    const cz = -195 + Math.floor(i / 5) * 9;
    c.scale.set(8, 2.6, 2.6);
    c.position.set(cx, i >= 5 ? 3.9 : 1.3, cz);
    c.castShadow = true;
    scene.add(c);
    colliders.push({ minX: cx - 4, maxX: cx + 4, minZ: cz - 1.3, maxZ: cz + 1.3 });
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd9c25f });
  const craneLeg = new THREE.Mesh(boxGeo, craneMat);
  craneLeg.scale.set(2, 22, 2);
  craneLeg.position.set(-170, 11, -200);
  scene.add(craneLeg);
  const craneArm = new THREE.Mesh(boxGeo, craneMat);
  craneArm.scale.set(26, 1.6, 1.6);
  craneArm.position.set(-158, 21, -200);
  scene.add(craneArm);

  // Palm trees: beachfront row, boardwalk, and scattered along avenues.
  const palmSpots = [];
  for (let z = -220; z <= 220; z += 36) {
    palmSpots.push([206, z]);
    palmSpots.push([196, z + 18]);
  }
  for (const r of [-120, 0, 120]) {
    for (let v = -150; v <= 150; v += 60) {
      palmSpots.push([r + 8, v]);
      palmSpots.push([v, r - 8]);
    }
  }
  for (const [x, z] of palmSpots) {
    if (Math.abs(x) > 235 || Math.abs(z) > 235) continue;
    const palm = makePalm();
    palm.position.set(x + range(rng, -2, 2), 0, z + range(rng, -2, 2));
    palm.rotation.y = rng() * Math.PI * 2;
    const s = range(rng, 0.85, 1.25);
    palm.scale.set(s, s, s);
    scene.add(palm);
  }

  // Street lamps along the main avenues: pole + glowing head (emissive
  // brightens at night via applyTimeOfDay).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const r of [-120, 0, 120]) {
    for (let v = -180; v <= 180; v += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(r + 7.5, 3, v);
      scene.add(pole);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(r + 7.5, 6.2, v);
      scene.add(lamp);
      lampMats.push(lampMat);
    }
  }

  // Street furniture: benches + bins on Neon Mile, umbrellas on the beach.
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a22 });
  const binMat = new THREE.MeshLambertMaterial({ color: 0x2a4a3a });
  for (let x = -150; x <= 150; x += 60) {
    const bench = new THREE.Mesh(boxGeo, benchMat);
    bench.scale.set(2.4, 0.5, 0.8);
    bench.position.set(x, 0.5, 127);
    scene.add(bench);
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1, 8), binMat);
    bin.position.set(x + 4, 0.5, 127);
    scene.add(bin);
  }
  const umbrellaMat = new THREE.MeshLambertMaterial({ color: 0xff5e8a, side: THREE.DoubleSide });
  for (let z = -180; z <= 180; z += 45) {
    const umb = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 8), umbrellaMat);
    umb.position.set(222, 2.4, z);
    scene.add(umb);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), poleMat);
    stick.position.set(222, 1.2, z);
    scene.add(stick);
  }

  // Parked cars along Ocean Boulevard + Neon Mile (static, same factory).
  const parkedColors = [0x2e6f8e, 0xd9d9d9, 0x3a3f4a, 0x7fb3d5, 0xc96a3a];
  for (let i = 0; i < 10; i += 1) {
    const parked = buildCarMesh({ body: pick(rng, parkedColors) });
    const onBoulevard = i % 2 === 0;
    parked.position.set(onBoulevard ? 191 : -150 + i * 30, 0, onBoulevard ? -150 + i * 32 : 127.5);
    parked.rotation.y = onBoulevard ? 0 : Math.PI / 2;
    scene.add(parked);
  }

  // Ferris wheel on the pier (beachfront, x = 228, z = -60).
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(228, 0, -60);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xff5e8a });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.5, 8, 40), rimMat);
  rim.position.y = 20;
  wheelGroup.add(rim);
  const spokeMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (let i = 0; i < 8; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 32, 0.4), spokeMat);
    spoke.position.y = 20;
    spoke.rotation.z = (i / 8) * Math.PI;
    wheelGroup.add(spoke);
  }
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x37e0ff, emissive: 0x0a3a4a });
  const cabins = [];
  for (let i = 0; i < 8; i += 1) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2), cabinMat);
    const a = (i / 8) * Math.PI * 2;
    cabin.position.set(Math.cos(a) * 16, 20 + Math.sin(a) * 16, 0);
    wheelGroup.add(cabin);
    cabins.push(cabin);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 10), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
  hub.rotation.x = Math.PI / 2;
  hub.position.y = 20;
  wheelGroup.add(hub);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 24, 1), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    leg.position.set(side * 6, 10, 0);
    leg.rotation.z = -side * 0.28;
    wheelGroup.add(leg);
  }
  scene.add(wheelGroup);
  animated.wheel = { group: wheelGroup, cabins, rim };

  // Yacht offshore: white hull + cabin + mast, bobbing gently.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 12), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hull.position.y = 0.8;
  const yachtCabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  yachtCabin.position.set(0, 2.2, -1);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), poleMat);
  mast.position.set(0, 5, 1);
  yacht.add(hull, yachtCabin, mast);
  yacht.position.set(268, 0.1, -120);
  yacht.rotation.y = 0.5;
  scene.add(yacht);
  animated.yacht = yacht;

  // Traffic lights at main intersections.
  const lightMats = [new THREE.MeshBasicMaterial({ color: 0x37ff5e }), new THREE.MeshBasicMaterial({ color: 0xffd23e }), new THREE.MeshBasicMaterial({ color: 0xff3e3e })];
  for (const [ix, iz] of [[0, 0], [0, 120], [-120, 0], [120, -60], [-60, 60]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 6), poleMat);
    pole.position.set(ix + 7, 2.75, iz + 7);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), poleMat);
    head.position.set(ix + 7, 5.4, iz + 7);
    scene.add(head);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), pick(rng, lightMats));
    lamp.position.set(ix + 7, 5.9, iz + 7);
    scene.add(lamp);
  }

  // Ocean plane (animated shimmer via opacity pulse in update).
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 560),
    new THREE.MeshPhongMaterial({ color: PALETTE.ocean, shininess: 120, specular: 0xffb36b, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(300, 0.05, 0);
  scene.add(ocean);
  animated.ocean = ocean;

  // Rain: one Points cloud, recycled in update. Off by default; enable with
  // ?rain=1 or setRain(true). Kept light (400 drops) so gameplay never pays.
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i += 1) {
    rainPos[i * 3] = range(rng, -120, 120);
    rainPos[i * 3 + 1] = range(rng, 0, 40);
    rainPos[i * 3 + 2] = range(rng, -120, 120);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9be8ff, size: 0.35, transparent: true, opacity: 0.6 }));
  rain.visible = false;
  scene.add(rain);
  animated.rain = rain;

  let currentPhase = null;
  function applyTimeOfDay(minutes) {
    const phase = todPhase(minutes);
    if (phase === currentPhase) return phase;
    currentPhase = phase;
    const p = TOD[phase];
    sun.color.setHex(p.sun);
    sun.intensity = p.sunI;
    hemi.intensity = p.hemiI;
    amb.intensity = p.ambI;
    scene.fog.color.setHex(p.fog);
    skyDome.material.map = skyTextures[phase];
    skyDome.material.needsUpdate = true;
    const lampScale = p.lamp;
    for (const lm of lampMats) lm.color.setHex(0xffe9a0).multiplyScalar(Math.min(1.6, lampScale));
    sunDisc.material.opacity = phase === 'night' ? 0.15 : 1;
    haloDisc.material.opacity = phase === 'night' ? 0.05 : 0.25;
    return phase;
  }
  applyTimeOfDay(18 * 60 + 52);

  function setRain(on) {
    rain.visible = !!on;
    return rain.visible;
  }

  function update(dt, time) {
    if (animated.wheel) {
      animated.wheel.rim.rotation.z += dt * 0.12;
      for (let i = 0; i < animated.wheel.cabins.length; i += 1) {
        const a = (i / 8) * Math.PI * 2 + time * 0.12;
        animated.wheel.cabins[i].position.set(Math.cos(a) * 16, 20 + Math.sin(a) * 16, 0);
      }
      animated.wheel.group.children.forEach((child, idx) => {
        if (idx >= 1 && idx <= 8) child.rotation.z = (idx - 1) * Math.PI / 8 + time * 0.12;
      });
    }
    for (const cloud of animated.clouds) {
      cloud.position.x += dt * 0.6;
      if (cloud.position.x > 340) cloud.position.x = -340;
    }
    if (animated.ocean) animated.ocean.material.opacity = 0.92 + Math.sin(time * 0.5) * 0.02;
    if (animated.yacht) {
      animated.yacht.position.y = 0.1 + Math.sin(time * 0.7) * 0.15;
      animated.yacht.rotation.z = Math.sin(time * 0.5) * 0.02;
    }
    if (animated.rain && animated.rain.visible) {
      const pos = animated.rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        let y = pos.getY(i) - dt * 26;
        if (y < 0) y = 40;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }

  // Circle (x,z,r) vs building AABBs: push the circle out. Returns corrected x,z.
  function resolveCollision(x, z, radius) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * radius;
          z = nz + (dz / d) * radius;
        } else {
          const px = Math.min(x - c.minX, c.maxX - x);
          const pz = Math.min(z - c.minZ, c.maxZ - z);
          if (px < pz) x = x - c.minX < c.maxX - x ? c.minX - radius : c.maxX + radius;
          else z = z - c.minZ < c.maxZ - z ? c.minZ - radius : c.maxZ + radius;
        }
      }
    }
    return { x, z };
  }

  const landmarks = {
    garage: { x: -150, z: 132 },
    pier: { x: 222, z: -60 },
    docks: { x: -185, z: -178 },
    plaza: { x: 60, z: -60 },
    beachfront: { x: 200, z: 60 },
    dealSpot: { x: -60, z: -185 },
    neonBar: { x: -90, z: 120 },
    hideout: { x: -180, z: 60 },
  };

  return {
    colliders,
    buildingMeshes,
    groundMesh: ground,
    resolveCollision,
    update,
    applyTimeOfDay,
    setRain,
    landmarks,
    // Landmarks the mission + shots use.
    garage: landmarks.garage,
    pier: landmarks.pier,
    playerSpawn: { x: -8, z: 24 },
    carSpawn: { x: 4, z: 0 },
  };
}
