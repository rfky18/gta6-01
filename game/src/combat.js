// Combat: four original guns + fists, raycast shooting, and rival AI.
// One job: everything about fighting on foot — weapon state and ammo,
// muzzle flash / tracer / impact effects, and enemies that chase, shoot
// back, and duck for cover when hurt. The player never shoots from a car.
// v4: no combat change — the combat shot is now staged at REP 4 (shots.js)
// so the contact sheet stays consistent with the cover.
import { WEAPONS, ENEMY } from './config.js';
import { createRandom, shuffle, clamp } from './random.js';

const THREE = window.THREE;

function buildEnemyMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a1f2e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), pants);
  legL.position.set(-0.16, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.4), jacket);
  torso.position.y = 1.18;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
  armL.position.set(-0.48, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.48;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.78;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.46), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  band.position.y = 1.92;
  // Health bar floating over the head: green -> red as it empties.
  const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0x11131a }));
  barBg.position.y = 2.3;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: 0x37ff8a }));
  bar.position.y = 2.3;
  group.add(legL, legR, torso, armL, armR, head, band, barBg, bar);
  group.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.userData.enemyRoot = group;
    }
  });
  return { group, legL, legR, armL, armR, bar };
}

export function createCombat(scene, world, hooks) {
  const rng = createRandom(4242);
  const raycaster = new THREE.Raycaster();
  // v10: pedestrians are valid targets too — a punch or a bullet can knock
  // one down, and they get up and run (pedestrians.knockDown). Wired by
  // main.js after the walkers exist.
  let pedestriansRef = null;
  function setPedestrians(p) {
    pedestriansRef = p;
  }
  const state = {
    slot: 0,
    mags: WEAPONS.map((w) => w.mag),
    reserves: WEAPONS.map((w) => w.reserve),
    cooldown: 0,
    reloading: false,
    reloadTimer: 0,
    shotsFired: 0,
    hits: 0,
    kills: 0,
  };
  const enemies = [];
  const effects = []; // transient {mesh|line, ttl, maxTtl, grow}

  function weapon() {
    return WEAPONS[state.slot];
  }

  // --- effects -------------------------------------------------------------
  function addEffect(obj, ttl, grow) {
    obj.userData.ttl = ttl;
    obj.userData.maxTtl = ttl;
    obj.userData.grow = grow || 0;
    scene.add(obj);
    effects.push(obj);
  }

  function muzzleFlash(origin, dir) {
    const pos = {
      x: origin.x + dir.x * 0.9,
      y: (origin.y || 0) + 1.35,
      z: origin.z + dir.z * 0.9,
    };
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    );
    flash.position.set(pos.x, pos.y, pos.z);
    flash.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
    addEffect(flash, 0.06, 0);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.95 }),
    );
    core.position.set(pos.x, pos.y, pos.z);
    addEffect(core, 0.05, 0);
  }

  function tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, (from.y || 0) + 1.35, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    addEffect(line, 0.09, 0);
  }

  function impact(point) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.95 }),
    );
    spark.position.set(point.x, point.y, point.z);
    addEffect(spark, 0.22, 2.2);
  }

  // --- shooting ------------------------------------------------------------
  function shootTargets() {
    const list = [];
    for (const e of enemies) {
      if (e.hp > 0) list.push(e.mesh.group);
    }
    // v10: walkers are shootable — GTA lets a bullet hit a pedestrian, and
    // the raycast needs their meshes in the list to ever find them.
    if (pedestriansRef) {
      for (const w of pedestriansRef.walkers) list.push(w.mesh.group);
    }
    for (const m of world.buildingMeshes || []) list.push(m);
    if (world.groundMesh) list.push(world.groundMesh);
    return list;
  }

  // v10: a walker takes a hit — falls flat, then gets up and runs. The
  // hook lets main.js panic the street and raise the wanted level.
  function hitWalker(w, origin) {
    const fell = pedestriansRef.knockDown(w, origin.x, origin.z);
    if (fell && hooks.onPedestrianHit) hooks.onPedestrianHit(w, origin.x, origin.z);
    state.hits += 1;
    return fell;
  }

  function fireOne(origin, dir, w) {
    const spread = w.spread;
    const d = {
      x: dir.x + (rng() - 0.5) * 2 * spread,
      y: dir.y + (rng() - 0.5) * 2 * spread,
      z: dir.z + (rng() - 0.5) * 2 * spread,
    };
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    d.x /= len;
    d.y /= len;
    d.z /= len;
    raycaster.set(new THREE.Vector3(origin.x, (origin.y || 0) + 1.4, origin.z), new THREE.Vector3(d.x, d.y, d.z));
    raycaster.far = w.range;
    const hits = raycaster.intersectObjects(shootTargets(), true);
    let end = { x: origin.x + d.x * w.range, y: (origin.y || 0) + 1.4 + d.y * w.range, z: origin.z + d.z * w.range };
    let hitEnemy = null;
    let hitW = null;
    if (hits.length > 0) {
      const h = hits[0];
      end = { x: h.point.x, y: h.point.y, z: h.point.z };
      let node = h.object;
      while (node && !node.userData.enemyRoot && !node.userData.walkerRoot) node = node.parent;
      if (node && node.userData.enemyRoot) {
        const e = enemies.find((en) => en.mesh.group === node.userData.enemyRoot);
        if (e && e.hp > 0) hitEnemy = e;
      } else if (node && node.userData.walkerRoot && pedestriansRef) {
        const w2 = pedestriansRef.walkers.find((wk) => wk.mesh.group === node.userData.walkerRoot);
        if (w2) hitW = w2;
      }
    }
    tracer(origin, end);
    if (hitW) {
      hitWalker(hitW, origin);
      impact(end);
      return { hit: true, walker: hitW, point: end };
    }
    if (hitEnemy) {
      hitEnemy.hp -= w.damage;
      hitEnemy.lastHit = 1;
      state.hits += 1;
      impact(end);
      if (hooks.audio) hooks.audio.hit();
      if (hitEnemy.hp <= 0) {
        hitEnemy.hp = 0;
        hitEnemy.deadTimer = 4;
        hitEnemy.mesh.group.rotation.x = -Math.PI / 2;
        hitEnemy.mesh.group.position.y = 0.4;
        state.kills += 1;
        if (hooks.audio) hooks.audio.enemyDown();
        if (hooks.onEnemyDown) hooks.onEnemyDown(hitEnemy.x, hitEnemy.z);
      }
      return { hit: true, enemy: hitEnemy, point: end };
    }
    impact(end);
    return { hit: false, point: end };
  }

  // v10: fists do not raycast — a punch is a short forward cone (3.4 m,
  // ~35 deg), forgiving enough to land on a walker Dario is facing, GTA
  // style. Nearest target in the cone takes the hit: a walker falls flat
  // and runs, an enemy takes the fists damage.
  function meleeAttack(origin, dir) {
    const hLen = Math.hypot(dir.x, dir.z) || 1;
    const hx = dir.x / hLen;
    const hz = dir.z / hLen;
    let best = null;
    let bestD = 3.4;
    const consider = (x, z, ref) => {
      const dx = x - origin.x;
      const dz = z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < 0.01) return;
      if ((dx * hx + dz * hz) / d < 0.8) return;
      bestD = d;
      best = { ref, x, z };
    };
    if (pedestriansRef) {
      for (const w of pedestriansRef.walkers) {
        if (w.down > 0) continue;
        const wx = w.horizontal ? w.pos : w.lane;
        const wz = w.horizontal ? w.lane : w.pos;
        consider(wx, wz, { walker: w });
      }
    }
    for (const e of enemies) {
      if (e.hp > 0) consider(e.x, e.z, { enemy: e });
    }
    if (!best) return { hit: false };
    const point = { x: best.x, y: (origin.y || 0) + 1.2, z: best.z };
    impact(point);
    if (best.ref.walker) {
      hitWalker(best.ref.walker, origin);
      return { hit: true, walker: best.ref.walker, point };
    }
    const e = best.ref.enemy;
    e.hp -= WEAPONS[0].damage;
    e.lastHit = 1;
    state.hits += 1;
    if (hooks.audio) hooks.audio.hit();
    if (e.hp <= 0) {
      e.hp = 0;
      e.deadTimer = 4;
      e.mesh.group.rotation.x = -Math.PI / 2;
      e.mesh.group.position.y = 0.4;
      state.kills += 1;
      if (hooks.audio) hooks.audio.enemyDown();
      if (hooks.onEnemyDown) hooks.onEnemyDown(e.x, e.z);
    }
    return { hit: true, enemy: e, point };
  }

  // origin: player {x, y, z}; dir: unit aim vector from the camera.
  function tryFire(origin, dir) {
    const w = weapon();
    if (state.cooldown > 0 || state.reloading) return null;
    if (state.mags[state.slot] <= 0) {
      reload();
      return null;
    }
    state.cooldown = w.rate;
    state.mags[state.slot] -= 1;
    state.shotsFired += 1;
    // Fists swing, they do not fire: no muzzle flash, no tracer, no
    // bullet — the cone in meleeAttack decides the hit.
    if (w.name === 'FISTS') {
      if (hooks.onPanic) hooks.onPanic(origin.x, origin.z);
      const res = meleeAttack(origin, dir);
      if (hooks.audio && res.hit) hooks.audio.hit();
      return res;
    }
    muzzleFlash(origin, dir);
    if (hooks.audio) hooks.audio.shot(w.sound);
    if (hooks.onPanic) hooks.onPanic(origin.x, origin.z);
    let result = null;
    for (let p = 0; p < w.pellets; p += 1) {
      const r = fireOne(origin, dir, w);
      if (r && r.hit) result = r;
    }
    if (state.mags[state.slot] <= 0) reload();
    return result || { hit: false };
  }

  function reload() {
    const w = weapon();
    if (state.reloading || !Number.isFinite(w.mag)) return false;
    if (state.mags[state.slot] >= w.mag || state.reserves[state.slot] <= 0) return false;
    state.reloading = true;
    state.reloadTimer = w.name.includes('SHOTGUN') ? 1.5 : 1.1;
    if (hooks.audio) hooks.audio.reload();
    return true;
  }

  function switchWeapon(i) {
    if (i < 0 || i >= WEAPONS.length || i === state.slot) return false;
    state.slot = i;
    state.reloading = false;
    state.reloadTimer = 0;
    if (hooks.audio) hooks.audio.click();
    return true;
  }

  // --- enemies -------------------------------------------------------------
  function nearestCover(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const c of world.colliders || []) {
      const nx = clamp(x, c.minX, c.maxX);
      const nz = clamp(z, c.minZ, c.maxZ);
      const d = Math.hypot(nx - x, nz - z);
      if (d < bestD) {
        bestD = d;
        best = { x: nx, z: nz };
      }
    }
    return best;
  }

  function spawnEnemies(spot, count, opts) {
    const o = opts || {};
    const spots = shuffle(rng, [
      { dx: 6, dz: 4 }, { dx: -7, dz: 5 }, { dx: 4, dz: -8 }, { dx: -5, dz: -6 },
      { dx: 10, dz: -2 }, { dx: -10, dz: 0 }, { dx: 0, dz: 10 }, { dx: 2, dz: 12 },
    ]);
    for (let i = 0; i < count; i += 1) {
      const s = spots[i % spots.length];
      const mesh = buildEnemyMesh();
      scene.add(mesh.group);
      const x = spot.x + s.dx;
      const z = spot.z + s.dz;
      mesh.group.position.set(x, 0, z);
      // v3: rivals spawn facing the spot (the player), so the combat shot
      // shows them as a threat advancing on Dario, not staring at a wall.
      mesh.group.rotation.y = Math.atan2(spot.x - x, spot.z - z);
      // Raycast reads matrixWorld, which the renderer only refreshes on the
      // next frame — without this, an enemy spawned and shot in the same
      // frame is tested at the origin (and, starting inside its own box, a
      // front-face ray never registers). Update it now so combat works the
      // same frame a combat stage spawns.
      mesh.group.updateMatrixWorld(true);
      enemies.push({
        mesh,
        x,
        z,
        heading: 0,
        hp: o.health || ENEMY.health,
        maxHp: o.health || ENEMY.health,
        shootTimer: 0.5 + rng(),
        strafeDir: rng() < 0.5 ? -1 : 1,
        strafeTimer: 0,
        cover: null,
        walkPhase: rng() * 6,
        deadTimer: 0,
        lastHit: 0,
      });
    }
    return enemies.filter((e) => e.hp > 0).length;
  }

  function updateEnemy(e, dt, playerPos) {
    if (e.hp <= 0) {
      if (e.deadTimer > 0) {
        e.deadTimer -= dt;
        if (e.deadTimer <= 0) {
          scene.remove(e.mesh.group);
          enemies.splice(enemies.indexOf(e), 1);
        }
      }
      return;
    }
    if (e.lastHit > 0) e.lastHit -= dt;
    const dx = playerPos.x - e.x;
    const dz = playerPos.z - e.z;
    const dist = Math.hypot(dx, dz) || 1;
    const aware = dist < ENEMY.aggroRange || e.lastHit > 0;
    let moveX = 0;
    let moveZ = 0;
    if (aware) {
      // Hurt rivals duck for cover: run to the nearest building edge, then
      // shoot from behind it. Healthy ones close in and strafe while firing.
      if (e.hp <= ENEMY.coverHealth && !e.cover) {
        e.cover = nearestCover(e.x, e.z);
      }
      if (e.cover) {
        const cdx = e.cover.x - e.x;
        const cdz = e.cover.z - e.z;
        const cd = Math.hypot(cdx, cdz);
        if (cd > 2.5) {
          moveX = cdx / cd;
          moveZ = cdz / cd;
        }
      } else if (dist > ENEMY.attackRange) {
        moveX = dx / dist;
        moveZ = dz / dist;
      } else {
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeTimer = 1.2 + rng();
          e.strafeDir *= -1;
        }
        moveX = (-dz / dist) * e.strafeDir;
        moveZ = (dx / dist) * e.strafeDir;
      }
      e.heading = Math.atan2(dx, dz);
      // Shoot back: accuracy roll per shot, damage through the hook so the
      // main loop owns health / armour / busted.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < ENEMY.attackRange + 6) {
        e.shootTimer = ENEMY.attackRate + rng() * 0.5;
        if (rng() < ENEMY.accuracy) {
          if (hooks.audio) hooks.audio.enemyShot();
          if (hooks.onPlayerDamage) hooks.onPlayerDamage(ENEMY.damage, e.x, e.z);
        }
        // Tracer from the rival toward the player, even on a miss.
        tracer({ x: e.x, y: 0, z: e.z }, { x: playerPos.x, y: 1.2, z: playerPos.z });
      }
    }
    if (moveX !== 0 || moveZ !== 0) {
      const speed = e.cover ? ENEMY.speed * 1.15 : ENEMY.speed;
      e.x += moveX * speed * dt;
      e.z += moveZ * speed * dt;
      const fixed = world.resolveCollision(e.x, e.z, 0.6);
      e.x = fixed.x;
      e.z = fixed.z;
      e.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(e.walkPhase) * 0.5;
      e.mesh.legL.rotation.x = swing;
      e.mesh.legR.rotation.x = -swing;
    }
    e.mesh.group.position.set(e.x, 0, e.z);
    e.mesh.group.rotation.y = e.heading;
    const frac = clamp(e.hp / e.maxHp, 0, 1);
    e.mesh.bar.scale.x = Math.max(0.02, frac);
    e.mesh.bar.material.color.setHex(frac > 0.5 ? 0x37ff8a : frac > 0.25 ? 0xffd23e : 0xff3e3e);
  }

  function update(dt, playerPos) {
    if (state.cooldown > 0) state.cooldown -= dt;
    if (state.reloading) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        state.reloading = false;
        const w = weapon();
        const need = w.mag - state.mags[state.slot];
        const take = Math.min(need, state.reserves[state.slot]);
        state.mags[state.slot] += take;
        state.reserves[state.slot] -= take;
      }
    }
    for (const fx of [...effects]) {
      fx.userData.ttl -= dt;
      if (fx.userData.grow) {
        const s = 1 + (1 - fx.userData.ttl / fx.userData.maxTtl) * fx.userData.grow;
        fx.scale.set(s, s, s);
      }
      if (fx.material && fx.material.transparent) {
        fx.material.opacity = Math.max(0, fx.userData.ttl / fx.userData.maxTtl) * 0.95;
      }
      if (fx.userData.ttl <= 0) {
        scene.remove(fx);
        effects.splice(effects.indexOf(fx), 1);
        if (fx.geometry) fx.geometry.dispose();
      }
    }
    for (const e of [...enemies]) updateEnemy(e, dt, playerPos);
  }

  function enemiesAlive() {
    return enemies.filter((e) => e.hp > 0).length;
  }

  function enemyPositions() {
    return enemies.filter((e) => e.hp > 0).map((e) => ({ x: e.x, z: e.z }));
  }

  function clearEnemies() {
    for (const e of [...enemies]) scene.remove(e.mesh.group);
    enemies.length = 0;
  }

  function weaponInfo() {
    return WEAPONS.map((w, i) => ({
      name: w.name,
      short: w.short,
      mag: state.mags[i],
      reserve: state.reserves[i],
      active: i === state.slot,
      reloading: i === state.slot && state.reloading,
    }));
  }

  function setAmmo(slot, mag, reserve) {
    if (slot < 0 || slot >= WEAPONS.length) return;
    state.mags[slot] = mag;
    state.reserves[slot] = reserve;
  }

  // Staging hook for the combat screenshot: a visible muzzle flash + tracer
  // toward a fixed point, without spending ammo.
  function stageFlash(origin, dir, target) {
    muzzleFlash(origin, dir);
    tracer(origin, target || { x: origin.x + dir.x * 30, y: 1.2, z: origin.z + dir.z * 30 });
  }

  return {
    state,
    tryFire,
    reload,
    switchWeapon,
    spawnEnemies,
    update,
    enemiesAlive,
    enemyPositions,
    clearEnemies,
    weaponInfo,
    setAmmo,
    setPedestrians,
    stageFlash,
    weapon,
  };
}
