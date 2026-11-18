// San Vega City: procedural low-poly coastal city. One job: build the whole
// static world (ground, buildings, palms, beach, ferris wheel, neon signs,
// sky) and hand back its colliders and animated bits.
import { WORLD, PALETTE } from './config.js';
import { createRandom, pick, range, rangeInt } from './random.js';

const THREE = window.THREE;
const TEX_SIZE = 2048;
const MAP_HALF = 280; // ground texture covers [-280, 280] on both axes
const MAP_SCALE = TEX_SIZE / (MAP_HALF * 2);

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

// Lit-window texture shared by every building (emissive map).
function makeWindowTexture() {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#101018';
    g.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 248; y += 16) {
      for (let x = 8; x < 120; x += 14) {
        const lit = Math.random() < 0.42;
        g.fillStyle = lit ? (Math.random() < 0.75 ? '#ffd27a' : '#9be8ff') : '#1d2030';
        g.fillRect(x, y, 8, 10);
      }
    }
  });
}

function makeSignTexture(text, bg, fg) {
  return canvasTexture(256, 96, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = fg;
    g.font = 'bold 44px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = fg;
    g.shadowBlur = 18;
    g.fillText(text, 128, 50);
  });
}

function makePalm() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.2, 6), trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), frondMat);
    frond.scale.set(1, 1, 0.22);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 5.3, Math.sin(a) * 1.1);
    frond.rotation.set(Math.sin(a) * 1.35, 0, -Math.cos(a) * 1.35);
    frond.castShadow = true;
    group.add(frond);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a22 }));
  nuts.position.y = 5.0;
  group.add(nuts);
  return group;
}

export function createWorld(scene, seed) {
  const rng = createRandom(seed);
  const colliders = [];
  const animated = { wheel: null, clouds: [], sunSprite: null };

  // Sky, fog, sun.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 520);
  const sun = new THREE.DirectionalLight(PALETTE.sunLight, 1.25);
  sun.position.set(-180, 95, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.75));
  scene.add(new THREE.AmbientLight(0x604a6a, 0.35));

  // Sun disc sprite low over the western horizon.
  const sunTex = canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.4, 'rgba(255,190,110,0.9)');
    grad.addColorStop(1, 'rgba(255,150,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false }));
  sunSprite.position.set(-330, 58, 0);
  sunSprite.scale.set(220, 220, 1);
  scene.add(sunSprite);
  animated.sunSprite = sunSprite;

  // Clouds: soft pink ellipsoids drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    cloud.scale.set(range(rng, 18, 34), range(rng, 3, 5), range(rng, 8, 12));
    cloud.position.set(range(rng, -260, 260), range(rng, 55, 90), range(rng, -260, 260));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Buildings.
  const windowTex = makeWindowTexture();
  const palette = [0xd96a5f, 0xe8a34c, 0x7fb3d5, 0x9b7fb8, 0xe86a92, 0x5fb8a6, 0xd9c25f, 0x8a9bb0, 0xc97b4a, 0x6a8fbf];
  const materials = palette.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, emissive: 0xccaa77, emissiveMap: windowTex, emissiveIntensity: 1.5 }),
  );
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const centres = [-150, -90, -30, 30, 90, 150];
  for (const cx of centres) {
    for (const cz of centres) {
      if (cx === -30 && cz === -150) continue; // park block
      const downtown = Math.abs(cx) <= 90 && Math.abs(cz) <= 90;
      const beach = cx === 150;
      const count = downtown ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = downtown ? range(rng, 26, 34) : range(rng, 16, 26);
        const d = downtown ? range(rng, 26, 34) : range(rng, 16, 26);
        const h = downtown ? range(rng, 26, 62) : beach ? range(rng, 8, 16) : range(rng, 10, 24);
        const ox = count === 1 ? 0 : b === 0 ? -13 : 13;
        const oz = count === 1 ? 0 : b === 0 ? -11 : 11;
        const x = cx + ox;
        const z = cz + oz;
        const mat = materials[Math.floor(rng() * materials.length)];
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.scale.set(w * 0.7, 1.2, d * 0.7);
        roof.position.set(x, h + 0.6, z);
        scene.add(roof);
        // Rooftop AC box on taller towers.
        if (h > 30) {
          const ac = new THREE.Mesh(roofGeo, roofMat);
          ac.scale.set(4, 2.4, 4);
          ac.position.set(x + w * 0.2, h + 1.2, z - d * 0.2);
          scene.add(ac);
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
  ];
  for (const s of signs) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.w * 0.375),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(s.text, s.bg, s.fg) }),
    );
    sign.position.set(s.x, s.y, s.z);
    if (s.ry) sign.rotation.y = s.ry;
    scene.add(sign);
  }

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

  // Traffic lights at main intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
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

  function update(dt, time) {
    if (animated.wheel) {
      animated.wheel.rim.rotation.z += dt * 0.12;
      for (let i = 0; i < animated.wheel.cabins.length; i += 1) {
        const a = (i / 8) * Math.PI * 2 + time * 0.12;
        animated.wheel.cabins[i].position.set(Math.cos(a) * 16, 20 + Math.sin(a) * 16, 0);
      }
      // Spokes rotate with the rim: they are children positioned around hub.
      animated.wheel.group.children.forEach((child, idx) => {
        if (idx >= 1 && idx <= 8) child.rotation.z = (idx - 1) * Math.PI / 8 + time * 0.12;
      });
    }
    for (const cloud of animated.clouds) {
      cloud.position.x += dt * 0.6;
      if (cloud.position.x > 280) cloud.position.x = -280;
    }
    if (animated.ocean) animated.ocean.material.opacity = 0.92 + Math.sin(time * 0.5) * 0.02;
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
          // Centre inside the box: push out along the smallest penetration axis.
          const px = Math.min(x - c.minX, c.maxX - x);
          const pz = Math.min(z - c.minZ, c.maxZ - z);
          if (px < pz) x = x - c.minX < c.maxX - x ? c.minX - radius : c.maxX + radius;
          else z = z - c.minZ < c.maxZ - z ? c.minZ - radius : c.maxZ + radius;
        }
      }
    }
    return { x, z };
  }

  return {
    colliders,
    resolveCollision,
    update,
    // Landmarks the mission + shots use.
    garage: { x: -150, z: 132 },
    pier: { x: 222, z: -60 },
    playerSpawn: { x: -8, z: 24 },
    carSpawn: { x: 4, z: 0 },
  };
}
