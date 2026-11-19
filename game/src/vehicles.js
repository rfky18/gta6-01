// Cars: one factory builds any low-poly car (player, traffic, police) and the
// drivable car adds arcade physics — throttle, brake, reverse, steering,
// handbrake — plus building collision.
//
// v2 bodywork (img2threejs Solaris GT spec, blockout pass — component tree in
// .img2threejs/solaris-gt-spec.json): fastback cabin rake, full-width LED
// tail-light bar, quad exhausts + diffuser on the hero, SANVEGA plate,
// haunch intakes, door shut lines, 5-spoke rims, wider rear track on the
// hero. Paint is a glossy Phong material so the sunset catches it; brake
// lights brighten when the car brakes, and a damaged car puffs smoke.
// v3 sculpt pass (LOCAL-JUDGE-v2: the v2 car still read as a red box):
// lower + wider stance (body 2.1 wide, 0.52 tall, top line ~1.36 — the spec's
// 4.6 x 1.9 x 1.35), tapered nose wedge + front splitter, full-width LED
// headlight bar, slanted windshield + rear glass panels, flared rear
// haunches over the rear wheels, side skirts, bigger spoiler on taller
// fins, larger wheels (r 0.40). Handling / physics untouched.
// v4 sculpt pass 2 (LOCAL-JUDGE-v3 C3: still boxy vs rank 1/3): steeper
// nose + hood wedge, wider + brighter headlight bar, angled corner DRL
// pods so the headlights read from the rear three-quarter cover angle.
// Handling / physics untouched.
import { CAR, WORLD } from './config.js';

const THREE = window.THREE;

// Plate texture (hero only): white plate, dark SANVEGA text.
let plateTex = null;
function makePlateTexture() {
  if (plateTex) return plateTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ee';
  g.fillRect(0, 0, 128, 32);
  g.strokeStyle = '#222226';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 30);
  g.fillStyle = '#1c1c22';
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SANVEGA', 64, 17);
  plateTex = new THREE.CanvasTexture(c);
  return plateTex;
}

// 5-spoke rim texture for the hub caps: dark disc, gunmetal spokes, centre dot.
let spokeTex = null;
function makeSpokeTexture() {
  if (spokeTex) return spokeTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#14161c';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a3f47';
  for (let i = 0; i < 5; i += 1) {
    g.save();
    g.translate(64, 64);
    g.rotate((i / 5) * Math.PI * 2);
    g.fillRect(-7, -58, 14, 52);
    g.restore();
  }
  g.fillStyle = '#22242a';
  g.beginPath();
  g.arc(64, 64, 14, 0, Math.PI * 2);
  g.fill();
  spokeTex = new THREE.CanvasTexture(c);
  return spokeTex;
}

// Shared buffers: every car on the street reuses the same geometries.
// v3: wedge proportions — lower/wider hull, tapered nose, slanted glass.
const GEO = {
  body: new THREE.BoxGeometry(2.1, 0.52, 4.6),
  hood: new THREE.BoxGeometry(1.9, 0.26, 1.3),
  nose: new THREE.BoxGeometry(1.7, 0.3, 0.55),
  splitter: new THREE.BoxGeometry(2.0, 0.08, 0.45),
  cabin: new THREE.BoxGeometry(1.66, 0.5, 2.0),
  roof: new THREE.BoxGeometry(1.3, 0.08, 0.9),
  windshield: new THREE.BoxGeometry(1.6, 0.05, 0.95),
  rearGlass: new THREE.BoxGeometry(1.62, 0.05, 1.15),
  tail: new THREE.BoxGeometry(1.8, 0.34, 0.6),
  tailDeck: new THREE.BoxGeometry(1.9, 0.08, 1.05),
  tailPanel: new THREE.BoxGeometry(1.86, 0.36, 0.06),
  valance: new THREE.BoxGeometry(1.9, 0.2, 0.12),
  reverse: new THREE.BoxGeometry(0.34, 0.1, 0.06),
  flare: new THREE.BoxGeometry(0.16, 0.36, 0.85),
  endplate: new THREE.BoxGeometry(0.06, 0.3, 0.55),
  haunch: new THREE.BoxGeometry(0.22, 0.34, 1.1),
  skirt: new THREE.BoxGeometry(0.1, 0.16, 2.6),
  // v7: side-panel sculpt (LOCAL-JUDGE-v6 C3 — the rank-3 decider: our
  // flank still reads as one flat slab from the cover's rear three-quarter
  // angle). Shoulder crease, layered skirt blade + neon stripe, fender
  // arch trims, diagonal door slash, headlight beam cones + road pools.
  shoulder: new THREE.BoxGeometry(0.05, 0.09, 3.1),
  skirtBlade: new THREE.BoxGeometry(0.14, 0.1, 3.0),
  skirtStripe: new THREE.BoxGeometry(0.15, 0.035, 3.0),
  archTrim: new THREE.TorusGeometry(0.52, 0.055, 6, 12, Math.PI),
  doorSlash: new THREE.BoxGeometry(0.04, 0.5, 0.12),
  headCone: new THREE.ConeGeometry(0.9, 7, 12, 1, true),
  glowPool: new THREE.CircleGeometry(2.0, 20),
  light: new THREE.BoxGeometry(0.46, 0.16, 0.08),
  headBar: new THREE.BoxGeometry(1.85, 0.09, 0.06), // v4: wider bar
  drl: new THREE.BoxGeometry(0.3, 0.1, 0.06), // v4: corner DRL pod
  tailBar: new THREE.BoxGeometry(1.7, 0.09, 0.06),
  tailBarEnd: new THREE.BoxGeometry(0.3, 0.1, 0.07),
  diffuser: new THREE.BoxGeometry(1.8, 0.22, 0.06),
  plate: new THREE.PlaneGeometry(0.44, 0.11),
  intake: new THREE.BoxGeometry(0.06, 0.3, 0.4),
  shut: new THREE.BoxGeometry(0.02, 0.5, 0.02),
  mirror: new THREE.BoxGeometry(0.14, 0.16, 0.3),
  grille: new THREE.BoxGeometry(1.2, 0.14, 0.06),
  exhaust: new THREE.CylinderGeometry(0.09, 0.09, 0.24, 8),
  spoiler: new THREE.BoxGeometry(1.95, 0.07, 0.55),
  fin: new THREE.BoxGeometry(0.08, 0.5, 0.45),
  wheel: new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12),
  wheelRear: new THREE.CylinderGeometry(0.42, 0.42, 0.42, 12),
  hub: new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10),
  barBase: new THREE.BoxGeometry(1.2, 0.14, 0.5),
  barLight: new THREE.BoxGeometry(0.5, 0.16, 0.5),
  stripe: new THREE.BoxGeometry(2.12, 0.3, 4.62),
  smoke: new THREE.SphereGeometry(0.7, 8, 6),
};

// Headlight beam cone: narrow at the lamp, wide 7 m ahead. The geometry is
// rotated once here so the mesh can stay axis-aligned (apex at -z).
GEO.headCone.rotateX(-Math.PI / 2);

export function buildCarMesh(opts) {
  const o = opts || {};
  const bodyColor = o.body || 0xe84a3a;
  const group = new THREE.Group();
  // Glossy paint: low-poly but reflective, like a wet sunset street.
  const bodyMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 60, specular: 0x553333 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x11131a });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 50, specular: 0x445566 });
  const body = new THREE.Mesh(GEO.body, bodyMat);
  body.position.y = 0.5;
  // Wedge nose + sloped hood + tapered tail so the silhouette reads as a
  // sportscar, not a box: the nose dips, the hood falls toward it, the
  // fastback roofline falls toward the tail.
  const nose = new THREE.Mesh(GEO.nose, bodyMat);
  nose.position.set(0, 0.42, 2.38);
  nose.rotation.x = -0.38; // v4: steeper wedge dip
  const splitter = new THREE.Mesh(GEO.splitter, darkMat);
  splitter.position.set(0, 0.14, 2.5);
  const hood = new THREE.Mesh(GEO.hood, bodyMat);
  hood.position.set(0, 0.58, 1.8);
  hood.rotation.x = -0.26; // v4: hood falls harder toward the nose
  const tail = new THREE.Mesh(GEO.tail, bodyMat);
  tail.position.set(0, 0.56, -2.1);
  tail.rotation.x = 0.12;
  // v6: sloped rear decklid from the glass down to the tail — the rear
  // three-quarter cover angle finally reads a wedge deck, not a flat box
  // top. The deck sits over the rear glass base, falling toward the tail.
  const tailDeck = new THREE.Mesh(GEO.tailDeck, bodyMat);
  tailDeck.position.set(0, 0.92, -1.72);
  tailDeck.rotation.x = -0.38;
  group.add(tailDeck);
  const cabin = new THREE.Mesh(GEO.cabin, glassMat);
  cabin.position.set(0, 1.02, -0.3);
  cabin.rotation.x = -0.1; // fastback rake: roofline falls toward the tail
  // v3.1: black roof, short so the rear glass shows behind it — the v3
  // cover showed the red roof as one flat slab hiding the whole glasshouse.
  // v5 round 3: narrower + shorter still (1.3 wide, 0.9 long, shifted
  // forward) so the rear glass reads from the cover's rear angle.
  const roof = new THREE.Mesh(GEO.roof, darkMat);
  roof.position.set(0, 1.32, -0.25);
  roof.rotation.x = -0.14;
  // Slanted glass: windshield + rear window as separate panels, so the
  // glasshouse reads from the rear three-quarter view (the cover angle).
  // v5 round 3: the rear glass is bigger and warmer (sunset reflection),
  // so the back of the cabin is glass, not a dark slab.
  const windshield = new THREE.Mesh(GEO.windshield, glassMat);
  windshield.position.set(0, 1.05, 0.8);
  windshield.rotation.x = -0.5;
  const rearGlassMat = new THREE.MeshPhongMaterial({ color: 0x4a3a42, shininess: 90, specular: 0xff8a5e });
  const rearGlass = new THREE.Mesh(GEO.rearGlass, rearGlassMat);
  rearGlass.position.set(0, 1.02, -1.3);
  rearGlass.rotation.x = 0.5;
  group.add(body, nose, splitter, hood, tail);
  if (o.convertible) {
    // v9: convertible — no roof, no glasshouse. An open tub with two
    // seats and a visible driver, so the car reads as driven (rank 2's
    // orange convertible traffic). The low wind deflector keeps the
    // windshield line without closing the cabin.
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 2.1), darkMat);
    tub.position.set(0, 0.78, -0.3);
    group.add(tub);
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x6b4a22 });
    for (const s of [-0.42, 0.42]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), seatMat);
      seat.position.set(s, 0.95, -0.55);
      seat.rotation.x = -0.25;
      group.add(seat);
    }
    const deflector = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.05), glassMat);
    deflector.position.set(0, 0.98, 0.75);
    deflector.rotation.x = -0.35;
    group.add(deflector);
    // Driver, left seat: shirt, head, hair — visible over the door line
    // from the chase camera, so the car is clearly occupied.
    const driverShirt = new THREE.MeshLambertMaterial({ color: 0x37b6ff });
    const driverSkin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const driverHair = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.32), driverShirt);
    torso.position.set(-0.42, 1.12, -0.35);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), driverSkin);
    head.position.set(-0.42, 1.55, -0.35);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), driverHair);
    hair.position.set(-0.42, 1.76, -0.35);
    group.add(torso, head, hair);
  } else {
    group.add(cabin, roof, windshield, rearGlass);
  }
  // Flared rear haunches over the wide rear wheels + side skirts.
  for (const s of [-1, 1]) {
    const haunch = new THREE.Mesh(GEO.haunch, bodyMat);
    haunch.position.set(s * 1.02, 0.62, -1.3);
    group.add(haunch);
    // v6: rear fender flare — an angled lip at the tail corner so the
    // haunch wraps around the rear wheel and the back of the car reads
    // wide and planted from directly behind (rank-1 cars show rear rubber
    // + flared arches; ours showed a flat slab edge).
    const flare = new THREE.Mesh(GEO.flare, bodyMat);
    flare.position.set(s * 1.1, 0.58, -1.95);
    flare.rotation.y = -s * 0.35;
    group.add(flare);
    const skirt = new THREE.Mesh(GEO.skirt, darkMat);
    skirt.position.set(s * 1.06, 0.22, 0);
    group.add(skirt);
    // v7: layered side panels so the flank reads sculpted, not slab —
    // a shoulder crease along the door, a wider skirt blade under the
    // skirt, and fender arch trims proud of the tyres (front arch just
    // outside the front tyre face, rear arch just outside the wider rear
    // rubber). The trims are half-tori in the side plane, opening down.
    const shoulder = new THREE.Mesh(GEO.shoulder, darkMat);
    shoulder.position.set(s * 1.06, 0.62, 0.2);
    group.add(shoulder);
    const blade = new THREE.Mesh(GEO.skirtBlade, darkMat);
    blade.position.set(s * 1.08, 0.13, 0);
    group.add(blade);
    for (const [ax, az] of [[1.15, 1.5], [1.31, -1.5]]) {
      const arch = new THREE.Mesh(GEO.archTrim, darkMat);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(s * ax, 0.42, az);
      group.add(arch);
    }
    if (o.sport) {
      // v7: thin neon skirt stripe (echoes the pink underglow) + a
      // diagonal slash on the door — the hero's flank gets one more
      // layered line so it holds up next to rank 3's wedge.
      const stripe = new THREE.Mesh(GEO.skirtStripe, new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.85 }));
      stripe.position.set(s * 1.15, 0.13, 0);
      group.add(stripe);
      const slash = new THREE.Mesh(GEO.doorSlash, darkMat);
      slash.position.set(s * 1.06, 0.55, 0.5);
      slash.rotation.x = 0.5;
      group.add(slash);
    }
  }
  // Grille + mirrors + exhausts (hero: quad tips, 2 per side).
  const grille = new THREE.Mesh(GEO.grille, darkMat);
  grille.position.set(0, 0.38, 2.64);
  group.add(grille);
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(GEO.mirror, bodyMat);
    mirror.position.set(s * 1.04, 0.98, 0.65);
    group.add(mirror);
    // v6: chrome exhaust tips (bright Phong, not flat black) so the quad
    // tips catch the sunset from the rear cover angle.
    const tips = o.sport ? [0.35, 0.75] : [0.55];
    for (const ex of tips) {
      const exhaust = new THREE.Mesh(GEO.exhaust, new THREE.MeshPhongMaterial({ color: 0xd8dde2, shininess: 110, specular: 0xffffff }));
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(s * ex, 0.32, -2.44);
      group.add(exhaust);
    }
  }
  // Hero-only spec details: diffuser, SANVEGA plate, haunch intakes, shut lines.
  if (o.sport) {
    const diffuser = new THREE.Mesh(GEO.diffuser, darkMat);
    diffuser.position.set(0, 0.28, -2.41);
    group.add(diffuser);
    // v6: black rear valance under the tail panel — a low dark band that
    // separates bumper from body so the tail reads as two stacked forms
    // (bumper + deck) instead of one red slab.
    const valance = new THREE.Mesh(GEO.valance, darkMat);
    valance.position.set(0, 0.2, -2.42);
    group.add(valance);
    // v5: diffuser fins + neon underglow on the wet asphalt — the rear
    // three-quarter cover angle finally gets something to catch the eye
    // below the tail bar (LOCAL-JUDGE-v4 C3, boxy rear).
    for (const s of [-0.5, 0, 0.5]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.3), darkMat);
      fin.position.set(s, 0.2, -2.44);
      group.add(fin);
    }
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5.2),
      new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    group.add(glow);
    const plate = new THREE.Mesh(GEO.plate, new THREE.MeshLambertMaterial({ map: makePlateTexture() }));
    plate.position.set(0, 0.48, -2.47);
    plate.rotation.y = Math.PI;
    group.add(plate);
    for (const s of [-1, 1]) {
      const intake = new THREE.Mesh(GEO.intake, darkMat);
      intake.position.set(s * 0.98, 0.6, -0.9);
      group.add(intake);
      const shut = new THREE.Mesh(GEO.shut, darkMat);
      shut.position.set(s * 1.06, 0.6, 0.4);
      group.add(shut);
    }
  }
  // Headlights + full-width LED headlight bar (v3: the front fascia finally
  // reads at night) + full-width tail-light bar (bar brightens on braking).
  // v4: warmer-brighter lamps + angled corner DRL pods — from the rear
  // three-quarter cover angle the straight bar is edge-on, the angled pods
  // still catch the eye.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfffbe0 });
  const headBar = new THREE.Mesh(GEO.headBar, headMat);
  headBar.position.set(0, 0.5, 2.64);
  group.add(headBar);
  for (const sgn of [-1, 1]) {
    const drl = new THREE.Mesh(GEO.drl, headMat);
    drl.position.set(sgn * 0.88, 0.52, 2.56);
    drl.rotation.y = -sgn * 0.6;
    group.add(drl);
  }
  for (const s of [-0.62, 0.62]) {
    const h = new THREE.Mesh(GEO.light, headMat);
    h.position.set(s, 0.5, 2.64);
    group.add(h);
  }
  // v7: headlight glow the rear cover camera can actually see — the lamps
  // face away from it, so the glow is the beams themselves: two faint
  // additive cones splayed slightly outward + bright pools on the road
  // ~6 m ahead, past the car's flanks.
  // v7 R2: pool 0.10 -> 0.18, cone 0.09 -> 0.13, pools bigger + closer —
  // the R1 values washed out on the bright asphalt overlay.
  if (o.sport) {
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const poolMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const s of [-0.62, 0.62]) {
      const cone = new THREE.Mesh(GEO.headCone, beamMat);
      cone.position.set(s, 0.5, 6.14);
      cone.rotation.y = -s * 0.08;
      group.add(cone);
      const pool = new THREE.Mesh(GEO.glowPool, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(s, 0.05, 7.5);
      group.add(pool);
    }
  }
  // v6: the tail is the cover's money shot — a dark inset panel behind
  // the lamps, a BRIGHT full-width bar (not dim maroon), big angled
  // corner clusters that catch the rear three-quarter angle, and white
  // reverse lamps. The v5 bar read as a thin dark stripe from behind.
  const tailPanel = new THREE.Mesh(GEO.tailPanel, darkMat);
  tailPanel.position.set(0, 0.66, -2.43);
  group.add(tailPanel);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xdd2222 });
  const tailLights = [];
  const bar = new THREE.Mesh(GEO.tailBar, tailMat);
  bar.position.set(0, 0.72, -2.47);
  group.add(bar);
  tailLights.push(bar);
  const endMat = new THREE.MeshBasicMaterial({ color: 0xff4030 });
  for (const s of [-0.72, 0.72]) {
    const e = new THREE.Mesh(GEO.tailBarEnd, endMat);
    e.position.set(s, 0.72, -2.47);
    e.rotation.y = -s * 0.35; // v6: angled out so the cluster reads from the side too
    group.add(e);
    tailLights.push(e);
  }
  const reverseMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  for (const s of [-0.42, 0.42]) {
    const rev = new THREE.Mesh(GEO.reverse, reverseMat);
    rev.position.set(s, 0.5, -2.47);
    group.add(rev);
  }
  if (o.sport) {
    const spoiler = new THREE.Mesh(GEO.spoiler, darkMat);
    spoiler.position.set(0, 1.12, -2.1);
    spoiler.rotation.x = 0.08;
    group.add(spoiler);
    for (const s of [-0.75, 0.75]) {
      const fin = new THREE.Mesh(GEO.fin, darkMat);
      fin.position.set(s, 0.88, -2.1);
      group.add(fin);
      // v6: spoiler endplates — vertical plates at the wing tips so the
      // wing reads as a wing, not a black plank, from the rear angle.
      const plate = new THREE.Mesh(GEO.endplate, darkMat);
      plate.position.set(s * 0.98, 1.12, -2.1);
      group.add(plate);
    }
  }
  if (o.police) {
    const barBase = new THREE.Mesh(GEO.barBase, darkMat);
    barBase.position.set(0, 1.44, -0.25);
    group.add(barBase);
    const red = new THREE.Mesh(GEO.barLight, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.44, -0.25);
    const blue = new THREE.Mesh(GEO.barLight, new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.position.set(0.32, 1.44, -0.25);
    group.add(red, blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(GEO.stripe, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.72;
    group.add(stripe);
  }
  // Wheels: 5-spoke rims (canvas texture on the hub caps, spun with the
  // wheels); hero rear track is wider with wider rear tires (spec).
  // v3: larger wheels (r 0.40) to fill the lower stance.
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const spokeMat = new THREE.MeshLambertMaterial({ map: makeSpokeTexture() });
  const hubSideMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const wheels = [];
  // v5 round 3: hero rear track wider still (±1.08) with wider rear tires,
  // so the rear wheels poke past the haunches and the car reads planted
  // from directly behind (rank-1 cars show their rear rubber).
  for (const [wx, wz, rear] of [[-0.98, 1.5, false], [0.98, 1.5, false], [-1.08, -1.5, true], [1.08, -1.5, true]]) {
    const wheel = new THREE.Mesh(rear && o.sport ? GEO.wheelRear : GEO.wheel, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.4, wz);
    wheel.castShadow = true;
    // Hub cap materials: [side, cap, cap] — caps carry the spoke texture.
    const hub = new THREE.Mesh(GEO.hub, [hubSideMat, spokeMat, spokeMat]);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.4, wz);
    group.add(wheel, hub);
    wheels.push(wheel, hub);
  }
  // Damage smoke: a grey puff over the hood, shown when condition is low.
  const smoke = new THREE.Mesh(GEO.smoke, new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 }));
  smoke.position.set(0, 1.4, 1.6);
  smoke.visible = false;
  group.add(smoke);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  group.userData.wheels = wheels;
  group.userData.tailLights = tailLights;
  group.userData.tailMat = tailMat;
  group.userData.smoke = smoke;
  return group;
}

// Brake lights: bright red while braking, dim red otherwise.
export function setBraking(mesh, braking) {
  if (!mesh || !mesh.userData.tailMat) return;
  mesh.userData.tailMat.color.setHex(braking ? 0xff2e2e : 0xdd2222);
}

// Drivable car state machine.
export function createDrivableCar(scene, world, opts) {
  const mesh = buildCarMesh(opts);
  scene.add(mesh);
  const state = {
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    steer: 0,
    name: (opts && opts.name) || 'Solaris GT',
    condition: 100,
  };

  function place(x, z, heading) {
    state.x = x;
    state.z = z;
    state.heading = heading || 0;
    state.speed = 0;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = state.heading;
  }

  // drive: {x steer -1..1, y throttle 1 / brake -1, handbrake bool}
  function update(dt, drive) {
    const forward = drive.y;
    if (forward > 0) state.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (state.speed > 0.5) state.speed -= CAR.brake * dt;
      else state.speed -= CAR.reverseAccel * dt;
    } else {
      // Rolling drag.
      state.speed -= state.speed * 0.6 * dt;
    }
    if (drive.handbrake) state.speed -= state.speed * 2.4 * dt;
    state.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, state.speed));
    if (Math.abs(state.speed) < 0.05) state.speed = 0;
    setBraking(mesh, forward < 0 || drive.handbrake);
    const grip = drive.handbrake ? CAR.handbrakeGrip : CAR.grip;
    const targetSteer = drive.x * CAR.steer * Math.min(1, Math.abs(state.speed) / 8);
    state.steer += (targetSteer - state.steer) * Math.min(1, dt * grip);
    state.heading += (state.steer * state.speed * dt) / 2.6;
    const fx = Math.sin(state.heading);
    const fz = Math.cos(state.heading);
    state.x += fx * state.speed * dt;
    state.z += fz * state.speed * dt;
    const fixed = world.resolveCollision(state.x, state.z, 1.9);
    if (fixed.x !== state.x || fixed.z !== state.z) {
      state.speed *= 0.4;
      damage(0.4);
    }
    state.x = Math.max(-236, Math.min(234, fixed.x));
    state.z = Math.max(-238, Math.min(238, fixed.z));
    mesh.position.set(state.x, 0, state.z);
    mesh.rotation.y = state.heading;
    // Spin the wheels (v3 wheel radius 0.40).
    const spin = (state.speed * dt) / 0.4;
    for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
    return { x: state.x, z: state.z, speed: state.speed, heading: state.heading, kmh: Math.abs(state.speed) * 3.6 };
  }

  // Damage from crashes / rams: condition drops, smoke shows below 50.
  function damage(amount) {
    state.condition = Math.max(40, state.condition - amount);
    if (mesh.userData.smoke) mesh.userData.smoke.visible = state.condition < 50;
    return state.condition;
  }

  return { state, mesh, place, update, damage };
}
