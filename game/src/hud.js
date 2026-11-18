// HUD: every DOM overlay — mission panel, wanted stars, money, police
// response list, health/armour, dialog box, speedometer, radio — plus the
// circular minimap canvas drawn from live world positions.
import { GAME, WORLD, districtAt } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const missionTitle = el('mission-title');
  const missionObjective = el('mission-objective');
  const missionStage = el('mission-stage-label');
  const missionNext = el('mission-next');
  const moneyEl = el('hud-money');
  const wantedEl = el('hud-wanted');
  const clockEl = el('hud-clock');
  const healthBar = el('health-fill');
  const armourBar = el('armour-fill');
  const repEl = el('hud-rep');
  const districtEl = el('hud-district');
  const streetEl = el('hud-street');
  const speedEl = el('hud-speed-num');
  const vehicleEl = el('hud-vehicle');
  const conditionEl = el('hud-condition');
  const radioEl = el('hud-radio');
  const policeList = el('police-list');
  const policePanel = el('police-panel');
  const dialogBox = el('dialog-box');
  const dialogName = el('dialog-name');
  const dialogText = el('dialog-text');
  const bannerEl = el('hud-banner');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const interactEl = el('hud-interact');
  let dialogTimer = 0;
  let bannerTimer = 0;

  function stars(n) {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < n ? '★' : '☆';
    return out;
  }

  function update(info) {
    const m = info.mission;
    missionTitle.textContent = `MISSION 1/1 — ${m.title}`;
    missionObjective.textContent = m.objective;
    missionStage.textContent = info.missionDone ? 'COMPLETE' : `STAGE ${Math.min(info.missionStage + 1, 2)}/2`;
    missionNext.textContent = `NEXT  ${m.next}`;
    moneyEl.textContent = `$${info.money.toLocaleString('en-US')}`;
    wantedEl.textContent = stars(info.wanted);
    wantedEl.className = info.wanted > 0 ? 'wanted hot' : 'wanted';
    clockEl.textContent = info.clock;
    healthBar.style.width = `${Math.max(0, info.health)}%`;
    armourBar.style.width = `${Math.max(0, info.armour)}%`;
    repEl.textContent = `REP ${info.rep}  ·  ${info.repTitle}`;
    districtEl.textContent = districtAt(info.x, info.z);
    streetEl.textContent = info.street;
    speedEl.textContent = String(Math.round(info.kmh));
    vehicleEl.textContent = info.vehicle;
    conditionEl.style.width = `${Math.max(0, info.condition)}%`;
    radioEl.textContent = `${GAME.radioStation} — ${GAME.radioTrack}`;
    if (info.wanted > 0) {
      policePanel.style.display = 'block';
      policeList.innerHTML =
        `<div class="police-row"><span class="callsign">VIPER-4</span><span>${Math.round(info.policeDistance)} m</span><span class="state">${info.policeMode}</span></div>` +
        `<div class="police-row dim"><span class="callsign">HAWK-1 · AIR</span><span>—</span><span class="state">SPOTLIGHT</span></div>`;
    } else {
      policePanel.style.display = 'none';
    }
    interactEl.style.display = info.showInteract ? 'block' : 'none';
    if (dialogTimer > 0) {
      dialogTimer -= info.dt;
      if (dialogTimer <= 0) dialogBox.style.display = 'none';
    }
    if (bannerTimer > 0) {
      bannerTimer -= info.dt;
      if (bannerTimer <= 0) bannerEl.style.display = 'none';
    }
    drawMinimap(info);
  }

  function drawMinimap(info) {
    const S = 200;
    const scale = S / (WORLD.half * 2 + 40);
    const cx = S / 2;
    const cy = S / 2;
    mctx.clearRect(0, 0, S, S);
    // Sea + sand on the east edge.
    mctx.fillStyle = '#1d4a63';
    mctx.fillRect(cx + 180 * scale, 0, S, S);
    mctx.fillStyle = '#e8c98f';
    mctx.fillRect(cx + 168 * scale, 0, 12 * scale, S);
    // City base.
    mctx.fillStyle = '#14161d';
    mctx.fillRect(0, 0, cx + 168 * scale, S);
    // Roads.
    mctx.strokeStyle = '#878d9c';
    mctx.lineWidth = 4;
    for (const r of WORLD.roads) {
      mctx.beginPath();
      mctx.moveTo(cx + r * scale, 0);
      mctx.lineTo(cx + r * scale, S);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(0, cy + r * scale);
      mctx.lineTo(cx + 168 * scale, cy + r * scale);
      mctx.stroke();
    }
    // Blocks.
    mctx.fillStyle = '#4a505e';
    for (const bx of [-150, -90, -30, 30, 90, 150]) {
      for (const bz of [-150, -90, -30, 30, 90, 150]) {
        mctx.fillRect(cx + (bx - 22) * scale, cy + (bz - 22) * scale, 44 * scale, 44 * scale);
      }
    }
    const dot = (x, z, color, size) => {
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.arc(cx + x * scale, cy + z * scale, size, 0, Math.PI * 2);
      mctx.fill();
    };
    // Mission marker (yellow diamond).
    if (info.missionSpot) {
      mctx.fillStyle = '#ffd23e';
      mctx.save();
      mctx.translate(cx + info.missionSpot.x * scale, cy + info.missionSpot.z * scale);
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-5, -5, 10, 10);
      mctx.restore();
    }
    // Police (red/blue), traffic (grey), player (white arrow).
    dot(info.policeX, info.policeZ, '#ff3e3e', 4);
    for (const t of info.traffic) dot(t.x, t.z, '#9aa0ad', 2.5);
    mctx.save();
    mctx.translate(cx + info.x * scale, cy + info.z * scale);
    mctx.rotate(info.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(5, 5);
    mctx.lineTo(-5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North tick.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px system-ui, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('N', cx, 12);
  }

  function say(speaker, text, seconds) {
    dialogName.textContent = speaker;
    dialogText.textContent = text;
    dialogBox.style.display = 'flex';
    dialogTimer = seconds || 6;
  }

  function banner(text, seconds) {
    bannerEl.textContent = text;
    bannerEl.style.display = 'block';
    bannerTimer = seconds || 3;
  }

  return { update, say, banner };
}
