// Character portraits: procedural canvas faces for the dialog box, one look
// per character (hue + hair + accessory from config.js). No remote assets —
// each portrait is drawn once, cached as a data URI, and set on the <img> in
// the dialog box by hud.js. Unknown speakers fall back to initials.
import { CHARACTERS } from './config.js';

const cache = new Map();

function drawPortrait(g, c, size) {
  // Backdrop: sunset gradient in the character's hue.
  const bg = g.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, `hsl(${c.hue}, 75%, 58%)`);
  bg.addColorStop(1, `hsl(${(c.hue + 40) % 360}, 70%, 26%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);
  // Neon rim light.
  g.strokeStyle = 'rgba(255,210,62,0.9)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, size - 3, size - 3);
  const cx = size / 2;
  // Shoulders / jacket.
  g.fillStyle = c.jacket;
  g.beginPath();
  g.moveTo(cx - 34, size);
  g.quadraticCurveTo(cx - 32, size - 26, cx - 14, size - 30);
  g.lineTo(cx + 14, size - 30);
  g.quadraticCurveTo(cx + 32, size - 26, cx + 34, size);
  g.closePath();
  g.fill();
  // Neck + head.
  g.fillStyle = c.skin;
  g.fillRect(cx - 6, size - 38, 12, 12);
  g.beginPath();
  g.arc(cx, size - 50, 17, 0, Math.PI * 2);
  g.fill();
  // Hair.
  g.fillStyle = c.hair === 'cap' ? '#f2c94c' : '#1a1216';
  if (c.hair === 'bob') {
    g.beginPath();
    g.arc(cx, size - 54, 18, Math.PI, 0);
    g.fill();
    g.fillRect(cx - 18, size - 56, 7, 18);
    g.fillRect(cx + 11, size - 56, 7, 18);
  } else if (c.hair === 'bun') {
    g.beginPath();
    g.arc(cx, size - 54, 17, Math.PI, 0);
    g.fill();
    g.beginPath();
    g.arc(cx, size - 72, 7, 0, Math.PI * 2);
    g.fill();
  } else if (c.hair === 'cap') {
    g.beginPath();
    g.arc(cx, size - 56, 17, Math.PI, 0);
    g.fill();
    g.fillRect(cx - 18, size - 58, 36, 5);
  } else if (c.hair === 'slick') {
    g.beginPath();
    g.ellipse(cx, size - 60, 16, 9, 0, Math.PI, 0);
    g.fill();
  } else {
    g.beginPath();
    g.arc(cx, size - 55, 16, Math.PI * 1.05, Math.PI * 1.95);
    g.fill();
  }
  // Eyes.
  g.fillStyle = '#14101a';
  g.beginPath();
  g.arc(cx - 6, size - 50, 1.8, 0, Math.PI * 2);
  g.arc(cx + 6, size - 50, 1.8, 0, Math.PI * 2);
  g.fill();
  // Accessory.
  if (c.accessory === 'shades') {
    g.fillStyle = '#101018';
    g.fillRect(cx - 12, size - 54, 10, 6);
    g.fillRect(cx + 2, size - 54, 10, 6);
    g.fillRect(cx - 2, size - 52, 4, 2);
  } else if (c.accessory === 'chain') {
    g.strokeStyle = '#ffd23e';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, size - 26, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  } else if (c.accessory === 'earring') {
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.arc(cx + 16, size - 48, 2.4, 0, Math.PI * 2);
    g.fill();
  } else if (c.accessory === 'scar') {
    g.strokeStyle = '#8a2a2a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 12, size - 60);
    g.lineTo(cx - 4, size - 44);
    g.stroke();
  }
  // Initials tag, bottom corner.
  g.fillStyle = 'rgba(12,10,26,0.85)';
  g.fillRect(size - 24, size - 16, 24, 16);
  g.fillStyle = '#ffd23e';
  g.font = 'bold 10px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(c.initials, size - 12, size - 8);
}

export function portraitDataURI(name, size) {
  const key = `${name}:${size || 96}`;
  if (cache.has(key)) return cache.get(key);
  const c = CHARACTERS[name] || { hue: 260, hair: 'short', accessory: 'none', skin: '#c98d64', jacket: '#5a4a7a', initials: (name || '?').slice(0, 2).toUpperCase() };
  const s = size || 96;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  drawPortrait(canvas.getContext('2d'), c, s);
  const uri = canvas.toDataURL('image/png');
  cache.set(key, uri);
  return uri;
}

// Pre-draw every named portrait once so the first dialog shows instantly.
// v3: also warm the 104 px size hud.js actually displays (2x the 52 px
// dialog image), so the cover dialog portrait is crisp, not upscaled.
export function warmPortraits() {
  for (const name of Object.keys(CHARACTERS)) {
    portraitDataURI(name);
    portraitDataURI(name, 104);
  }
}
