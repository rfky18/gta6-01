// Rendering only: WebGL renderer, golden-hour tone mapping, and the
// third-person camera (orbit on foot, chase cam while driving).
//
// v2 camera: the yaw the player asks for is smoothed toward the actual
// camera yaw (no jitter on small mouse moves), speed widens the FOV a touch
// like a chase cam should, and shooting / rams add a short shake.
// v4: speed FOV kick 6 -> 7 (the cover chase reads a touch wider at speed);
// coverFraming yaw offset is now 0.46 (shots.js) so the hero's headlights
// read from the rear three-quarter angle.
import { PALETTE } from './config.js';
import { clamp, lerp } from './random.js';

const THREE = window.THREE;

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  const cam = {
    yaw: 0.6,
    targetYaw: 0.6,
    pitch: 0.24,
    distance: 8,
    targetDistance: 8,
    trauma: 0,
    baseFov: 62,
  };

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Short camera shake (gunfire, rams): trauma 0..1, decays each frame.
  function shake(amount) {
    cam.trauma = clamp(cam.trauma + amount, 0, 1);
  }

  // look: {dx, dy} mouse deltas. target: {x, y, z} to follow. driving: chase cam.
  function update(dt, look, target, driving, speed01) {
    cam.targetYaw -= look.dx * 0.0032;
    cam.pitch = clamp(cam.pitch + look.dy * 0.0022, 0.06, 0.9);
    // Smooth the yaw toward what the player asked for: fast enough to feel
    // responsive, slow enough that small mouse jitter never shows.
    let diff = cam.targetYaw - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cam.yaw += diff * Math.min(1, dt * 14);
    cam.targetDistance = driving ? 6.5 + speed01 * 0.8 : 8;
    cam.distance += (cam.targetDistance - cam.distance) * Math.min(1, dt * 4);
    // Speed widens the chase-cam FOV slightly; on foot it stays put.
    const wantFov = cam.baseFov + (driving ? speed01 * 7 : 0); // v4: 6 -> 7
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov = lerp(camera.fov, wantFov, Math.min(1, dt * 5));
      camera.updateProjectionMatrix();
    }
    cam.trauma = Math.max(0, cam.trauma - dt * 1.8);
    const sh = cam.trauma * cam.trauma * 0.35;
    const shX = (Math.random() - 0.5) * sh;
    const shY = (Math.random() - 0.5) * sh;
    const eye = {
      x: target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.distance + shX,
      y: target.y + 1.6 + Math.sin(cam.pitch) * cam.distance + shY,
      z: target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.distance,
    };
    camera.position.set(eye.x, eye.y, eye.z);
    // Driving: look more level so the sky, sun and helicopter stay in frame.
    camera.lookAt(target.x, target.y + (driving ? 2.0 : 1.3), target.z);
  }

  // Snap the camera behind a heading (used when entering a car / staging shots).
  function snapBehind(heading, target, driving) {
    cam.yaw = heading + Math.PI;
    cam.targetYaw = cam.yaw;
    cam.pitch = driving ? 0.22 : 0.3;
    cam.distance = driving ? 6.5 : 8;
    update(1, { dx: 0, dy: 0 }, target, driving, 0);
  }

  // Aim direction: the unit vector the camera is looking along, used by the
  // combat raycast so shots go where the crosshair points.
  function aimDirection() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return { x: dir.x, y: dir.y, z: dir.z };
  }

  // v3 cover framing: three-quarter rear view with a wide FOV, applied
  // immediately (the shot paints only twice, so the normal FOV lerp in
  // update() would not get there in time). yawOffset swings the chase cam
  // slightly to the side so the hero car reads as a car, not a flat box.
  function coverFraming(yawOffset, fov) {
    cam.yaw += yawOffset;
    cam.targetYaw = cam.yaw;
    cam.baseFov = fov;
    camera.fov = fov + 3;
    camera.updateProjectionMatrix();
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, cam, update, snapBehind, render, resize, shake, aimDirection, coverFraming };
}
