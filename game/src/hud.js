// HUD: every DOM overlay — mission panel, wanted stars, money, police
// response list, health/armour, dialog box, speedometer, radio — plus the
// circular minimap canvas drawn from live world positions.
//
// v2: five weapon slots (fists + 4 guns, live mag/reserve), procedural
// character portraits in the dialog box, mission counter N/8 with a real
// stage progress bar, the full police response list (VIPER-4, VIPER-7,
// HAWK-1), a purple minimap route to the mission marker, and a crosshair
// with a hitmarker for on-foot combat.
// v3: the response list grows to 5 rows at 3 stars (VIPER-9, VIPER-12 +
// HAWK-1), REP gets a progress bar under its title, and dialog portraits
// render at 104 px (2x the 52 px display size) so the cover dialog is crisp.
import { GAME, WORLD, districtAt } from './config.js';
import { portraitDataURI } from './portraits.js';
import { clamp01 } from './random.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const chapterEl = el('mission-chapter');
  const missionTitle = el('mission-title');
  const missionObjective = el('mission-objective');
  const missionStage = el('mission-stage-label');
  const missionStageFill = el('mission-stage-fill');
  const missionNext = el('mission-next-text');
  const moneyEl = el('hud-money');
  const wantedEl = el('hud-wanted');
  const clockEl = el('hud-clock');
  const healthBar = el('health-fill');
  const armourBar = el('armour-fill');
  const repEl = el('hud-rep');
  const repFill = el('rep-fill');
  const districtEl = el('hud-district');
  const streetEl = el('hud-street');
  const speedEl = el('hud-speed-num');
  const vehicleEl = el('hud-vehicle');
  const conditionEl = el('hud-condition');
  const radioEl = el('hud-radio');
  const policeList = el('police-list');
  const policePanel = el('police-panel');
  const policeCount = el('police-count');
  const dialogBox = el('dialog-box');
  const dialogPortrait = el('dialog-portrait-img');
  const dialogName = el('dialog-name');
  const dialogText = el('dialog-text');
  const bannerEl = el('hud-banner');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const interactEl = el('hud-interact');
  const weaponSlotsEl = el('weapon-slots');
  const crosshairEl = el('crosshair');
  const hitmarkEl = el('hitmarker');
  let dialogTimer = 0;
  let bannerTimer = 0;
  let hitTimer = 0;

  function stars(n) {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < n ? '★' : '☆';
    return out;
  }

  function update(info) {
    const m = info.mission;
    chapterEl.textContent = `${m.chapter} · ${m.giver ? m.giver.toUpperCase() : ''}`;
    missionTitle.textContent = `MISSION ${m.index + 1}/${m.total} — ${m.title}`;
    missionObjective.textContent = m.objective;
    missionStage.textContent = m.total && m.index >= m.total ? 'COMPLETE' : `STAGE ${Math.min(m.stage + 1, m.stages)}/${m.stages}`;
    if (missionStageFill) missionStageFill.style.width = `${Math.round((m.progress || 0) * 100)}%`;
    missionNext.textContent = m.next;
    moneyEl.textContent = `$${info.money.toLocaleString('en-US')}`;
    wantedEl.textContent = stars(info.wanted);
    wantedEl.className = info.wanted > 0 ? 'wanted hot' : 'wanted';
    clockEl.textContent = info.clock;
    healthBar.style.width = `${Math.max(0, info.health)}%`;
    armourBar.style.width = `${Math.max(0, info.armour)}%`;
    repEl.textContent = `REP ${info.rep}  ·  ${info.repTitle}`;
    // v3: REP progress bar — fills toward the next title (REP 4/5 on the
    // cover reads as nearly maxed, not empty).
    if (repFill) repFill.style.width = `${Math.round(clamp01(info.repProgress === undefined ? info.rep / 5 : info.repProgress) * 100)}%`;
    districtEl.textContent = districtAt(info.x, info.z);
    streetEl.textContent = info.street;
    speedEl.textContent = String(Math.round(info.kmh));
    vehicleEl.textContent = info.vehicle;
    conditionEl.style.width = `${Math.max(0, info.condition)}%`;
    radioEl.textContent = `${GAME.radioStation} — ${GAME.radioTrack}`;
    // Weapon slots: 0 fists + 4 guns, live ammo, active slot highlighted.
    if (info.weapons && weaponSlotsEl) {
      let html = '';
      for (let i = 0; i < info.weapons.length; i += 1) {
        const w = info.weapons[i];
        const ammo = Number.isFinite(w.mag) ? `${w.mag}/${w.reserve}` : '∞';
        html += `<div class="weapon-slot${w.active ? ' active' : ''}"><span class="wkey">${i}</span><span class="wname">${w.short}</span><span class="wammo">${ammo}${w.reloading ? ' · RELOADING' : ''}</span></div>`;
      }
      weaponSlotsEl.innerHTML = html;
    }
    // Police response: every live unit + the helicopter.
    if (info.wanted > 0) {
      policePanel.style.display = 'block';
      const units = info.policeUnits && info.policeUnits.length ? info.policeUnits : [{ callsign: 'VIPER-4', distance: info.policeDistance, mode: info.policeMode }];
      if (policeCount) policeCount.textContent = `${units.length + 1} UNITS · CODE ${info.wanted}`;
      let html = '';
      for (const u of units) {
        html += `<div class="police-row"><span class="callsign">${u.callsign}</span><span>${Math.round(u.distance)} m</span><span class="state">${u.mode}</span></div>`;
      }
      html += '<div class="police-row dim"><span class="callsign">HAWK-1 · AIR</span><span>—</span><span class="state">SPOTLIGHT</span></div>';
      policeList.innerHTML = html;
    } else {
      policePanel.style.display = 'none';
    }
    interactEl.style.display = info.showInteract ? 'block' : 'none';
    if (crosshairEl) crosshairEl.style.display = info.showCrosshair ? 'block' : 'none';
    if (hitTimer > 0) {
      hitTimer -= info.dt;
      if (hitTimer <= 0 && hitmarkEl) hitmarkEl.style.display = 'none';
    }
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
    // Purple route line from the player to the mission marker.
    if (info.missionSpot) {
      mctx.strokeStyle = '#b45eff';
      mctx.lineWidth = 3;
      mctx.setLineDash([6, 4]);
      mctx.beginPath();
      mctx.moveTo(cx + info.x * scale, cy + info.z * scale);
      mctx.lineTo(cx + info.missionSpot.x * scale, cy + info.missionSpot.z * scale);
      mctx.stroke();
      mctx.setLineDash([]);
      mctx.fillStyle = '#ffd23e';
      mctx.save();
      mctx.translate(cx + info.missionSpot.x * scale, cy + info.missionSpot.z * scale);
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-5, -5, 10, 10);
      mctx.restore();
    }
    // Police (red/blue), enemies (orange), traffic (grey), player (white arrow).
    dot(info.policeX, info.policeZ, '#ff3e3e', 4);
    if (info.enemies) for (const e of info.enemies) dot(e.x, e.z, '#ff8a3e', 3.5);
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
    if (dialogPortrait) {
      dialogPortrait.src = portraitDataURI(speaker, 104);
      dialogPortrait.alt = `${speaker} portrait`;
    }
    dialogBox.style.display = 'flex';
    dialogTimer = seconds || 6;
  }

  function banner(text, seconds) {
    bannerEl.textContent = text;
    bannerEl.style.display = 'block';
    bannerTimer = seconds || 3;
  }

  function hitmark() {
    if (!hitmarkEl) return;
    hitmarkEl.style.display = 'block';
    hitTimer = 0.25;
  }

  return { update, say, banner, hitmark };
}
