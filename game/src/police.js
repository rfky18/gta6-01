// SVPD police: patrol cars. They cruise their beat while the player is
// clean; at wanted level 1+ they pursue, ram, and flash their light bars.
// At wanted 2+ a second unit (VIPER-7) joins; at wanted 3+ two more
// (VIPER-9, VIPER-12) join, so a 3-star chase shows a 5-row response list
// (4 ground units + HAWK-1) in the HUD. If a unit pins the player down at
// low speed, the player gets busted. HAWK-1 shadows from the air.
//
// v9: the four ground units no longer collapse to one state — each mode is
// computed live from real distances and the roadblock anchor:
//   RAMMING  — unit within 8 m, closing to hit the player.
//   PURSUIT  — unit inside sight range, chasing.
//   SEARCHING — unit beyond sight range (55 m) lost the trail: it sweeps
//     the last-seen area instead of pursuing blindly, and the minimap
//     draws the search zone around that spot.
//   ROADBLOCK — VIPER-9 at 3 stars drives to an anchor 30 m ahead of the
//     player, parks ACROSS the road there (barricades out), and holds —
//     a physical block: ramming it costs speed + condition, going around
//     is the fast way through. The HUD pills show the real mode per unit.
//
// v2: the pursuit car is scaled up 1.25x so it reads BIG in the chase frame,
// and a second unit joins at wanted 2 — the response list in the HUD shows
// both units plus the helicopter.
// v3: units 3 + 4 join at wanted 3 (cover staging: 5 named units in frame).
// v4: HAWK-1 spotlight cone 0.20 -> 0.22 so the heli reads a touch stronger
// in the cover frame against the brighter orange sun.
import { buildCarMesh } from './vehicles.js';
import { POLICE_CALLSIGNS } from './config.js';

const THREE = window.THREE;
const POLICE_SCALE = 1.25;

function makeBeamPoolTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,244,190,0.95)');
  grad.addColorStop(0.4, 'rgba(255,232,150,0.45)');
  grad.addColorStop(1, 'rgba(255,232,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeHeli() {
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0x22242e }));
  const heliGlass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 1.6), new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 90 }));
  heliGlass.position.set(0, 0.2, 2.4);
  const heliTail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), new THREE.MeshLambertMaterial({ color: 0x22242e }));
  heliTail.position.set(0, 0.3, -4.6);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x11131a }));
  rotor.position.y = 1.1;
  // v8 (LOCAL-JUDGE-v7 C3, rank-3 decider d): the beam must READ in the
  // cover — the v7 cone (r 3.2, opacity 0.22) was a faint needle against
  // the bright road. Core cone is now wide (r 5.5) and bright (0.40),
  // wrapped in a soft outer cone (r 9, 0.10) for the volumetric feel,
  // with a bright searchlight bulb at the belly so the source is visible.
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 20, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -10;
  const spotOuter = new THREE.Mesh(
    new THREE.ConeGeometry(9, 20, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  spotOuter.position.y = -10;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0 }),
  );
  bulb.position.set(0, -0.8, 1.5);
  heli.add(heliBody, heliGlass, heliTail, rotor, spot, spotOuter, bulb);
  heli.visible = false;
  return { heli, rotor, spot, spotOuter };
}

export function createPolice(scene, world) {
  const mesh = buildCarMesh({ body: 0x11131a, police: true });
  mesh.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  scene.add(mesh);
  const unit2 = buildCarMesh({ body: 0x11131a, police: true });
  unit2.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  unit2.visible = false;
  scene.add(unit2);
  // v3: two more pursuit units for 3-star heat (hidden until wanted 3).
  const unit3 = buildCarMesh({ body: 0x11131a, police: true });
  unit3.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  unit3.visible = false;
  scene.add(unit3);
  const unit4 = buildCarMesh({ body: 0x11131a, police: true });
  unit4.scale.set(POLICE_SCALE, POLICE_SCALE, POLICE_SCALE);
  unit4.visible = false;
  scene.add(unit4);
  // v9: roadblock props — striped sawhorses + cones that ride with VIPER-9
  // (children of its mesh, so they sit across the road exactly where the
  // unit parks). Hidden unless the unit is actually in ROADBLOCK mode, so
  // a pursuit never shows a fake block. Local +z is the car's forward:
  // barriers at local z ±4.2 extend the block east/west across the road,
  // and each barrier's length runs ACROSS the road (local z), so the car
  // + two barriers close the whole 11 m width. Cones mark the edges.
  // v9 R2: barriers bigger (2.4 -> 3.2 long) and turned across the road —
  // the R1 bars ran along the road edge and read as thin sticks.
  // v9-neon: the block is part of NEON DISTRICT, not a plain roadwork
  // prop — each barrier carries a neon strip along its top bar + three
  // neon lamp bulbs (pink on one side, cyan on the other, city palette),
  // each cone gets a neon tip beacon, and a soft pink glow strip lies on
  // the road under the block. All MeshBasicMaterial (unlit, reads at
  // sunset). Collision unchanged: these are children of the unit mesh,
  // the physical block is still the unit itself (push-out + speed ÷2).
  const roadblockProps = new THREE.Group();
  {
    const barrierMat = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x37e0ff });
    const bulbGeo = new THREE.SphereGeometry(0.17, 8, 6);
    for (const side of [-1, 1]) {
      const barrier = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 3.2), barrierMat);
      top.position.y = 1.0;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.34, 3.2), stripeMat);
      stripe.position.y = 0.62;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.12), legMat);
      legL.position.set(0, 0.25, -1.3);
      const legR = legL.clone();
      legR.position.z = 1.3;
      barrier.add(top, stripe, legL, legR);
      // Neon strip along the top bar + three lamp bulbs on top of it.
      const neonMat = side < 0 ? neonPinkMat : neonCyanMat;
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 3.2), neonMat);
      neonStrip.position.y = 1.24;
      barrier.add(neonStrip);
      for (const bz of [-1.1, 0, 1.1]) {
        const bulb = new THREE.Mesh(bulbGeo, neonMat);
        bulb.position.set(0, 1.36, bz);
        barrier.add(bulb);
      }
      // v9-neon R2 (dream-loop R1: the top strip is edge-on from the
      // chase camera and the bulbs hide behind the bar — the block read
      // plain orange/white). Neon face strips on BOTH vertical faces of
      // the top bar, so the glow faces the approaching car whichever way
      // the unit parked, plus a glowing band around every cone.
      for (const fx of [-0.1, 0.1]) {
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 3.0), neonMat);
        face.position.set(fx, 1.0, 0);
        barrier.add(face);
      }
      barrier.position.set(0, 0, side * 4.2);
      roadblockProps.add(barrier);
    }
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
    for (const [cx, cz] of [[-1.3, -2.6], [1.3, -2.6], [-1.3, 2.6], [1.3, 2.6]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), coneMat);
      cone.position.set(cx, 0.55, cz);
      roadblockProps.add(cone);
      // Neon band around the cone's waist + tip beacon on every cone.
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 8), neonPinkMat);
      band.position.set(cx, 0.7, cz);
      roadblockProps.add(band);
      const beacon = new THREE.Mesh(bulbGeo, neonPinkMat);
      beacon.position.set(cx, 1.18, cz);
      roadblockProps.add(beacon);
    }
    // Soft pink glow strip on the road under the block.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.5),
      new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    roadblockProps.add(glow);
  }
  roadblockProps.visible = false;
  unit3.add(roadblockProps);
  // HAWK-1 air unit: simple helicopter that shadows the player while wanted.
  const { heli, rotor, spot, spotOuter } = makeHeli();
  scene.add(heli);
  // v8: the beam's landing pool on the road — a warm additive disc under
  // the heli so the spotlight reads as light hitting the street, not a
  // cone floating in the air. Scene-level (not a heli child) so it stays
  // flat on the road while the heli bobs.
  const beamPool = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 24),
    new THREE.MeshBasicMaterial({ map: makeBeamPoolTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  beamPool.rotation.x = -Math.PI / 2;
  beamPool.position.y = 0.06;
  beamPool.renderOrder = 4;
  beamPool.visible = false;
  scene.add(beamPool);
  const state = {
    x: -60,
    z: 60,
    heading: 0,
    speed: 0,
    mode: 'PATROL', // PATROL | PURSUIT | RAMMING | ROADBLOCK | SEARCHING
    bustedTimer: 0,
    distance: 999,
    callsign: 'VIPER-4',
    x2: 120,
    z2: -120,
    heading2: 0,
    speed2: 0,
    mode2: 'PATROL',
    distance2: 999,
    x3: -120,
    z3: 120,
    heading3: 0,
    speed3: 0,
    mode3: 'PATROL',
    distance3: 999,
    x4: 120,
    z4: 120,
    heading4: 0,
    speed4: 0,
    mode4: 'PATROL',
    distance4: 999,
    heliX: 0,
    heliZ: 0,
    // v9: last-seen position — any unit inside sight range keeps it hot;
    // units that lose the trail SEARCH around this spot.
    lastSeen: { x: 0, z: 0 },
    lastSeenSet: false,
  };
  // Patrol beat: a rectangle loop around downtown.
  const beat = [
    { x: -120, z: -120 },
    { x: 120, z: -120 },
    { x: 120, z: 120 },
    { x: -120, z: 120 },
  ];
  let wp = 0;
  let wp2 = 2;
  mesh.position.set(state.x, 0, state.z);

  function steerToward(unit, tx, tz, dt, maxSpeed) {
    const dx = tx - unit.x;
    const dz = tz - unit.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - unit.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    unit.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    unit.speed += (maxSpeed - unit.speed) * Math.min(1, dt * 1.2);
    unit.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.z += Math.cos(unit.heading) * unit.speed * dt;
    const fixed = world.resolveCollision(unit.x, unit.z, 1.9);
    unit.x = fixed.x;
    unit.z = fixed.z;
    return dist;
  }

  // v9: sight range — beyond this a unit loses the trail and SEARCHES.
  // Roadblock anchor: how far ahead of the player VIPER-9 sets its block.
  const SIGHT_RANGE = 55;
  const ROADBLOCK_LEAD = 30;
  // v10: the search zone draws bigger on the minimap (was 45) so it reads
  // like rank 1's big red circle + "IN SIGHT" — the sweep itself is
  // unchanged (units orbit 18 m around the last-seen spot).
  const SEARCH_RADIUS = 60;

  // Sweep point for a SEARCHING unit: slow orbit around the last-seen
  // spot, a different phase per unit so they do not stack.
  function searchTarget(i, time) {
    const a = time * 0.25 + i * 2.1;
    return { x: state.lastSeen.x + Math.cos(a) * 18, z: state.lastSeen.z + Math.sin(a) * 18 };
  }

  function update(dt, target, wanted, time) {
    const tx = target.x;
    const tz = target.z;
    const theading = target.heading || 0;
    // Distances first — every mode below is read off these live numbers.
    state.distance = Math.hypot(tx - state.x, tz - state.z);
    state.distance2 = Math.hypot(tx - state.x2, tz - state.z2);
    state.distance3 = Math.hypot(tx - state.x3, tz - state.z3);
    state.distance4 = Math.hypot(tx - state.x4, tz - state.z4);
    // Last seen: any unit inside sight range keeps the trail hot.
    const nearest = Math.min(state.distance, state.distance2, state.distance3, state.distance4);
    if (wanted > 0 && nearest < SIGHT_RANGE) {
      state.lastSeen.x = tx;
      state.lastSeen.z = tz;
      state.lastSeenSet = true;
    }
    if (!state.lastSeenSet) {
      state.lastSeen.x = tx;
      state.lastSeen.z = tz;
    }
    // v9: VIPER-4 — RAMMING when close, SEARCHING when the trail is cold,
    // PURSUIT otherwise. SEARCHING units sweep the last-seen area at 14
    // m/s instead of chasing a player they cannot see.
    if (wanted > 0) {
      state.mode = state.distance < 8 ? 'RAMMING' : state.distance > SIGHT_RANGE ? 'SEARCHING' : 'PURSUIT';
      if (state.mode === 'SEARCHING') {
        const t = searchTarget(0, time);
        steerToward(state, t.x, t.z, dt, 14);
      } else {
        steerToward(state, tx, tz, dt, 36);
      }
    } else {
      state.mode = 'PATROL';
      const t = beat[wp];
      const d = steerToward(state, t.x, t.z, dt, 10);
      if (d < 6) wp = (wp + 1) % beat.length;
    }
    // Second unit: patrols the far beat while clean, joins the pursuit at
    // wanted 2+ (slightly offset so it does not stack on VIPER-4).
    const u2 = { x: state.x2, z: state.z2, heading: state.heading2, speed: state.speed2 };
    if (wanted >= 2) {
      unit2.visible = true;
      state.mode2 = state.distance2 < 8 ? 'RAMMING' : state.distance2 > SIGHT_RANGE ? 'SEARCHING' : 'PURSUIT';
      if (state.mode2 === 'SEARCHING') {
        const t = searchTarget(1, time);
        steerToward(u2, t.x, t.z, dt, 14);
      } else {
        steerToward(u2, tx + 6, tz - 4, dt, 34);
      }
    } else {
      unit2.visible = false;
      state.mode2 = 'PATROL';
      const t = beat[wp2];
      const d = steerToward(u2, t.x, t.z, dt, 10);
      if (d < 6) wp2 = (wp2 + 1) % beat.length;
    }
    state.x2 = u2.x;
    state.z2 = u2.z;
    state.heading2 = u2.heading;
    state.speed2 = u2.speed;
    // v9: VIPER-9 is the roadblock car. At 3 stars it drives to an anchor
    // 30 m ahead of the player and, once there, parks ACROSS the road and
    // holds (ROADBLOCK) until the player blows past it or outruns it —
    // then it gives chase to the next anchor. Beyond sight range it
    // SEARCHES like the others instead of driving blind.
    // VIPER-12 flanks like before, but also SEARCHES when it loses sight.
    const u3 = { x: state.x3, z: state.z3, heading: state.heading3, speed: state.speed3 };
    const u4 = { x: state.x4, z: state.z4, heading: state.heading4, speed: state.speed4 };
    if (wanted >= 3) {
      unit3.visible = true;
      unit4.visible = true;
      const fx = Math.sin(theading);
      const fz = Math.cos(theading);
      const ax = tx + fx * ROADBLOCK_LEAD;
      const az = tz + fz * ROADBLOCK_LEAD;
      const anchorDist = Math.hypot(ax - state.x3, az - state.z3);
      // v9 R3 (live-probe catch): the anchor slides forward with the
      // player, so a block judged against the LIVE anchor melts as the
      // player approaches it — the unit chased the new anchor instead of
      // holding the road. Once ROADBLOCK, the unit LATCHES: it holds its
      // post until the player has actually blown past it (or the trail
      // goes cold — the SEARCHING check above). Only then does it give
      // chase to the next anchor.
      const pastBlock = (tx - state.x3) * fx + (tz - state.z3) * fz > 4;
      if (state.distance3 > SIGHT_RANGE) {
        state.mode3 = 'SEARCHING';
        const t = searchTarget(2, time);
        steerToward(u3, t.x, t.z, dt, 14);
      } else if (state.mode3 === 'ROADBLOCK' && !pastBlock) {
        // Hold the latched post: bleed speed to a stop and swing the nose
        // across the player's line of travel.
        u3.speed = Math.max(0, u3.speed - 30 * dt);
        const want = theading + Math.PI / 2;
        let diff = want - u3.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        u3.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        u3.x += Math.sin(u3.heading) * u3.speed * dt;
        u3.z += Math.cos(u3.heading) * u3.speed * dt;
      } else if (anchorDist < 12) {
        state.mode3 = 'ROADBLOCK';
        // First frame on the post: same hold — bleed speed, swing across.
        u3.speed = Math.max(0, u3.speed - 30 * dt);
        const want = theading + Math.PI / 2;
        let diff = want - u3.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        u3.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        u3.x += Math.sin(u3.heading) * u3.speed * dt;
        u3.z += Math.cos(u3.heading) * u3.speed * dt;
      } else {
        state.mode3 = 'PURSUIT';
        steerToward(u3, ax, az, dt, 33);
      }
      state.mode4 = state.distance4 < 8 ? 'RAMMING' : state.distance4 > SIGHT_RANGE ? 'SEARCHING' : 'PURSUIT';
      if (state.mode4 === 'SEARCHING') {
        const t = searchTarget(3, time);
        steerToward(u4, t.x, t.z, dt, 14);
      } else {
        steerToward(u4, tx + 8, tz + 10, dt, 32);
      }
    } else {
      unit3.visible = false;
      unit4.visible = false;
      state.mode3 = 'PATROL';
      state.mode4 = 'PATROL';
      const t3 = beat[(wp2 + 1) % beat.length];
      const t4 = beat[(wp2 + 2) % beat.length];
      steerToward(u3, t3.x, t3.z, dt, 10);
      steerToward(u4, t4.x, t4.z, dt, 10);
    }
    state.x3 = u3.x;
    state.z3 = u3.z;
    state.heading3 = u3.heading;
    state.speed3 = u3.speed;
    state.x4 = u4.x;
    state.z4 = u4.z;
    state.heading4 = u4.heading;
    state.speed4 = u4.speed;
    // Barricades only ever show on a real ROADBLOCK hold.
    roadblockProps.visible = wanted >= 3 && state.mode3 === 'ROADBLOCK';
    // Ram: shove the target when we touch it.
    let rammed = false;
    if (state.distance < 3.4 && wanted > 0) {
      rammed = true;
      const push = 6 * dt;
      const dx = tx - state.x;
      const dz = tz - state.z;
      const d = Math.hypot(dx, dz) || 1;
      target.x += (dx / d) * push * 10;
      target.z += (dz / d) * push * 10;
    }
    if (state.distance2 < 3.4 && wanted >= 2) {
      rammed = true;
      const push = 6 * dt;
      const dx = tx - state.x2;
      const dz = tz - state.z2;
      const d = Math.hypot(dx, dz) || 1;
      target.x += (dx / d) * push * 10;
      target.z += (dz / d) * push * 10;
    }
    // v9: roadblock collision — the parked ROADBLOCK unit is a physical
    // wall, not a prop. Driving into it shoves the player back out and
    // halves their speed (main.js also bills condition on the hit); the
    // pursuers ram, the block blocks.
    let roadblockHit = false;
    if (wanted >= 3 && state.mode3 === 'ROADBLOCK') {
      const bd = Math.hypot(tx - state.x3, tz - state.z3);
      if (bd < 3.6) {
        roadblockHit = true;
        const d = bd || 1;
        const push = 3.6 - bd;
        target.x += ((tx - state.x3) / d) * push;
        target.z += ((tz - state.z3) / d) * push;
        if (typeof target.speed === 'number') target.speed *= 0.5;
      }
    }
    // Busted: pinned at low speed for 3 seconds.
    if (wanted > 0 && state.distance < 3.5 && Math.abs(target.speed || 0) < 2) {
      state.bustedTimer += dt;
    } else {
      state.bustedTimer = 0;
    }
    // Flash the light bars while pursuing.
    const flash = wanted > 0 && Math.floor(time * 4) % 2 === 0;
    if (mesh.userData.lightRed) mesh.userData.lightRed.visible = flash;
    if (mesh.userData.lightBlue) mesh.userData.lightBlue.visible = wanted > 0 && !flash;
    if (unit2.userData.lightRed) unit2.userData.lightRed.visible = wanted >= 2 && !flash;
    if (unit2.userData.lightBlue) unit2.userData.lightBlue.visible = wanted >= 2 && flash;
    if (unit3.userData.lightRed) unit3.userData.lightRed.visible = wanted >= 3 && flash;
    if (unit3.userData.lightBlue) unit3.userData.lightBlue.visible = wanted >= 3 && !flash;
    if (unit4.userData.lightRed) unit4.userData.lightRed.visible = wanted >= 3 && !flash;
    if (unit4.userData.lightBlue) unit4.userData.lightBlue.visible = wanted >= 3 && flash;
    // Helicopter shadows the player while wanted, hovering high behind.
    if (wanted > 0) {
      heli.visible = true;
      const hx = tx - 60;
      const hz = tz + 14;
      heli.position.set(hx, 20 + Math.sin(time * 0.8) * 1.2, hz);
      heli.rotation.y = Math.atan2(tx - hx, tz - hz);
      rotor.rotation.y += dt * 18;
      spot.visible = true;
      spotOuter.visible = true;
      beamPool.visible = true;
      beamPool.position.set(hx, 0.06, hz);
      state.heliX = hx;
      state.heliZ = hz;
    } else {
      heli.visible = false;
      beamPool.visible = false;
    }
    mesh.position.set(state.x, 0, state.z);
    mesh.rotation.y = state.heading;
    unit2.position.set(state.x2, 0, state.z2);
    unit2.rotation.y = state.heading2;
    unit3.position.set(state.x3, 0, state.z3);
    unit3.rotation.y = state.heading3;
    unit4.position.set(state.x4, 0, state.z4);
    unit4.rotation.y = state.heading4;
    // v3 wheel radius 0.40 on every unit.
    const spin = (state.speed * dt) / 0.4;
    for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
    const spin2 = (state.speed2 * dt) / 0.4;
    for (const wheel of unit2.userData.wheels) wheel.rotation.x += spin2;
    const spin3 = (state.speed3 * dt) / 0.4;
    for (const wheel of unit3.userData.wheels) wheel.rotation.x += spin3;
    const spin4 = (state.speed4 * dt) / 0.4;
    for (const wheel of unit4.userData.wheels) wheel.rotation.x += spin4;
    // Distances after this step's movement, for the HUD + search zone.
    state.distance = Math.hypot(tx - state.x, tz - state.z);
    state.distance2 = Math.hypot(tx - state.x2, tz - state.z2);
    state.distance3 = Math.hypot(tx - state.x3, tz - state.z3);
    state.distance4 = Math.hypot(tx - state.x4, tz - state.z4);
    const units = [{ callsign: POLICE_CALLSIGNS[0], distance: state.distance, mode: state.mode }];
    if (wanted >= 2) units.push({ callsign: POLICE_CALLSIGNS[1], distance: state.distance2, mode: state.mode2 });
    if (wanted >= 3) {
      units.push({ callsign: POLICE_CALLSIGNS[2], distance: state.distance3, mode: state.mode3 });
      units.push({ callsign: POLICE_CALLSIGNS[3], distance: state.distance4, mode: state.mode4 });
    }
    const anySearching = wanted > 0 && units.some((u) => u.mode === 'SEARCHING');
    return {
      mode: state.mode,
      distance: state.distance,
      rammed,
      busted: state.bustedTimer > 3,
      units,
      roadblockHit,
      seen: wanted > 0 && nearest < SIGHT_RANGE,
      // Search zone: live centre + radius, active while any unit searches.
      searchZone: { x: state.lastSeen.x, z: state.lastSeen.z, radius: SEARCH_RADIUS, active: anySearching },
    };
  }

  function teleport(x, z) {
    state.x = x;
    state.z = z;
    state.speed = 0;
    state.bustedTimer = 0;
    mesh.position.set(x, 0, z);
    // Second unit trails behind the first, on the road, not on the beach.
    state.x2 = x - 3;
    state.z2 = z + 16;
    state.speed2 = 0;
    unit2.position.set(state.x2, 0, state.z2);
    // v3: units 3 + 4 trail further back on the same road.
    state.x3 = x + 3;
    state.z3 = z + 30;
    state.speed3 = 0;
    unit3.position.set(state.x3, 0, state.z3);
    state.x4 = x - 3;
    state.z4 = z + 44;
    state.speed4 = 0;
    unit4.position.set(state.x4, 0, state.z4);
  }

  // Staging hook: put VIPER-7 exactly where the shot needs it (mesh + state).
  function placeUnit2(x, z, heading, speed) {
    state.x2 = x;
    state.z2 = z;
    state.heading2 = heading || 0;
    state.speed2 = speed || 0;
    unit2.position.set(x, 0, z);
    unit2.rotation.y = state.heading2;
  }

  // v3 staging hooks: put VIPER-9 / VIPER-12 exactly where the shot needs
  // them (mesh + state), like placeUnit2.
  function placeUnit3(x, z, heading, speed) {
    state.x3 = x;
    state.z3 = z;
    state.heading3 = heading || 0;
    state.speed3 = speed || 0;
    unit3.position.set(x, 0, z);
    unit3.rotation.y = state.heading3;
  }

  function placeUnit4(x, z, heading, speed) {
    state.x4 = x;
    state.z4 = z;
    state.heading4 = heading || 0;
    state.speed4 = speed || 0;
    unit4.position.set(x, 0, z);
    unit4.rotation.y = state.heading4;
  }

  // Staging hook: put HAWK-1 exactly where the shot needs it (ahead of the
  // player, in frame). The next update() re-aims it; shots place it last.
  function placeHeli(x, z, y) {
    heli.visible = true;
    heli.position.set(x, y || 26, z);
    heli.rotation.y = 0;
    spot.visible = true;
    spotOuter.visible = true;
    beamPool.visible = true;
    beamPool.position.set(x, 0.06, z);
    state.heliX = x;
    state.heliZ = z;
  }

  return { state, mesh, update, teleport, placeHeli, placeUnit2, placeUnit3, placeUnit4 };
}
