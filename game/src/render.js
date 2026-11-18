// Rendering only: WebGL renderer, golden-hour tone mapping, and the
// third-person camera (orbit on foot, chase cam while driving).
import { PALETTE } from './config.js';

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
    pitch: 0.24,
    distance: 8,
    targetDistance: 8,
  };

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // look: {dx, dy} mouse deltas. target: {x, y, z} to follow. driving: chase cam.
  function update(dt, look, target, driving, speed01) {
    cam.yaw -= look.dx * 0.0032;
    cam.pitch = Math.max(0.06, Math.min(0.9, cam.pitch + look.dy * 0.0022));
    cam.targetDistance = driving ? 7.5 + speed01 * 1.5 : 8;
    cam.distance += (cam.targetDistance - cam.distance) * Math.min(1, dt * 4);
    const eye = {
      x: target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.distance,
      y: target.y + 1.6 + Math.sin(cam.pitch) * cam.distance,
      z: target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.distance,
    };
    camera.position.set(eye.x, eye.y, eye.z);
    // Driving: look more level so the sky, sun and helicopter stay in frame.
    camera.lookAt(target.x, target.y + (driving ? 2.0 : 1.3), target.z);
  }

  // Snap the camera behind a heading (used when entering a car / staging shots).
  function snapBehind(heading, target, driving) {
    cam.yaw = heading + Math.PI;
    cam.pitch = driving ? 0.22 : 0.3;
    cam.distance = driving ? 7.5 : 8;
    update(1, { dx: 0, dy: 0 }, target, driving, 0);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, cam, update, snapBehind, render, resize };
}
