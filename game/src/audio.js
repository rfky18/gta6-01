// Procedural WebAudio: engine hum, police siren, UI blips and a tiny synthwave
// radio loop. No audio files — everything is synthesized, so it works offline.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let radioOn = true;
  let noteIndex = 0;
  // A minor-key bassline for NEON FM 101.3 (A minor, 100 BPM feel).
  const bassline = [55, 0, 55, 65.41, 0, 55, 49, 55, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 49];
  const arp = [220, 261.63, 329.63, 440, 329.63, 261.63];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Audio is best-effort.
    }
  }

  function radioStep() {
    if (!ctx || !radioOn) return;
    const bass = bassline[noteIndex % bassline.length];
    if (bass > 0) blip(bass, 0.22, 'triangle', 0.05);
    if (noteIndex % 2 === 0) blip(arp[(noteIndex / 2) | 0 % arp.length] || 220, 0.12, 'sine', 0.02);
    noteIndex += 1;
  }

  return {
    // Call from a user gesture (start button / first key).
    unlock() {
      if (!ensure() || !ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!radioTimer) radioTimer = window.setInterval(radioStep, 240);
    },
    setEngine(speed01, driving) {
      if (!ctx || !engineOsc || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.05 : 0.015;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.1);
    },
    setSiren(on, time) {
      if (!ctx || !sirenOsc || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(time % 1 < 0.5 ? 660 : 880, ctx.currentTime, 0.05);
    },
    pickup() {
      blip(880, 0.12, 'square', 0.08);
      window.setTimeout(() => blip(1318, 0.18, 'square', 0.08), 110);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.2, 'triangle', 0.09), i * 120));
    },
    busted() {
      blip(220, 0.4, 'sawtooth', 0.09);
      window.setTimeout(() => blip(165, 0.5, 'sawtooth', 0.09), 200);
    },
    toggleRadio() {
      radioOn = !radioOn;
      return radioOn;
    },
    radioOn() {
      return radioOn;
    },
  };
}
