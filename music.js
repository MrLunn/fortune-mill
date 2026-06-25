/* Fortune of Valhalla — procedural Norse soundtrack + sound effects.
 * Pure Web Audio API, no assets. Exposes a global `Music` with a stable API:
 *   Music.start()  Music.toggleMute() -> bool muted
 *   Music.sfxDart(crit)  Music.sfxWin(big)  Music.sfxLoss()
 *   Music.sfxDaily()  Music.sfxPrestige()  Music.sfxAchievement()
 * Any other Music.xxx() call is a safe no-op (Proxy fallback), so other
 * modules (dopamine.js etc.) can call sounds we didn't define without error.
 */
(() => {
  'use strict';

  let ctx = null;
  let master = null;     // master gain (mute control)
  let musicGain = null;  // background music bus
  let started = false;
  let muted = false;
  let seqTimer = null;
  let step = 0;

  // Aeolian (natural minor) scale in A — a dark, Norse-sounding mode.
  const A2 = 110.00, A1 = 55.00;
  const LEAD = [220.00, 246.94, 261.63, 293.66, 329.63, 261.63, 246.94, 220.00,
                196.00, 220.00, 261.63, 246.94, 220.00, 196.00, 174.61, 164.81];
  const BASS = [A1, A1, A1, A1, 73.42, 73.42, 65.41, 65.41,
                A1, A1, 87.31, 87.31, 65.41, 65.41, 82.41, 82.41];

  function ensureCtx() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.28;
      musicGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  // ── Primitive voices ───────────────────────────────────────────────────────
  function tone(freq, t0, dur, type, gain, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(t0, dur, gain, freq, dest) {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 1200; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(bp); bp.connect(g); g.connect(dest || master);
    src.start(t0); src.stop(t0 + dur);
  }

  // War drum: deep pitch-dropping kick.
  function drum(t0, gain) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.16);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o.connect(g); g.connect(musicGain);
    o.start(t0); o.stop(t0 + 0.3);
  }

  // ── Step sequencer (background music) ───────────────────────────────────────
  function scheduleStep() {
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const s = step % 16;

    // War drums on the pulse
    if (s % 4 === 0) drum(t, 0.6);
    if (s % 8 === 4) drum(t, 0.35);

    // Bass drone
    tone(BASS[s], t, 0.5, 'sawtooth', 0.10, musicGain);
    // Low fifth for that horn/drone fullness
    tone(BASS[s] * 1.5, t, 0.5, 'triangle', 0.05, musicGain);

    // Lead melody every other step
    if (s % 2 === 0) tone(LEAD[s], t, 0.42, 'triangle', 0.09, musicGain);
    // sparse high harmony
    if (s === 6 || s === 14) tone(LEAD[s] * 2, t, 0.3, 'sine', 0.04, musicGain);

    step++;
  }

  // ── Public sound effects ────────────────────────────────────────────────────
  function sfxDart(crit) {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    noiseBurst(t, 0.09, crit ? 0.5 : 0.32, crit ? 2600 : 1700);  // axe thunk
    tone(crit ? 160 : 120, t, 0.14, 'square', 0.18);
    if (crit) tone(330, t + 0.02, 0.18, 'sawtooth', 0.12);
  }
  function sfxWin(big) {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    const notes = big ? [220, 277, 330, 440, 554] : [220, 330, 440];
    notes.forEach((f, i) => tone(f, t + i * 0.07, 0.3, 'triangle', 0.16));
    if (big) { noiseBurst(t, 0.5, 0.18, 600); tone(110, t, 0.6, 'sawtooth', 0.12); } // horn blast
  }
  function sfxLoss() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    tone(160, t, 0.18, 'sawtooth', 0.12);
    tone(120, t + 0.1, 0.26, 'sawtooth', 0.12);
  }
  function sfxDaily() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.08, 0.3, 'sine', 0.14));
  }
  function sfxPrestige() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    // Rising war-horn fanfare
    [110, 146, 220, 293, 440].forEach((f, i) => tone(f, t + i * 0.12, 0.6, 'sawtooth', 0.16));
    drum(t, 0.7); drum(t + 0.5, 0.7); drum(t + 0.9, 0.8);
    noiseBurst(t + 0.3, 0.7, 0.16, 500);
  }
  function sfxAchievement() {
    if (!ensureCtx()) return;
    const t = ctx.currentTime;
    [440, 587, 880].forEach((f, i) => tone(f, t + i * 0.06, 0.28, 'triangle', 0.15));
  }

  function start() {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    if (started) return;
    started = true;
    step = 0;
    seqTimer = setInterval(scheduleStep, 250); // ~ step every 250ms (~120 BPM feel)
  }

  function toggleMute() {
    if (!ensureCtx()) return muted;
    muted = !muted;
    master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  }

  const realMusic = { start, toggleMute, sfxDart, sfxWin, sfxLoss, sfxDaily, sfxPrestige, sfxAchievement,
    // Friendly aliases other modules might call:
    sfxClick: sfxDart, sfxSpin: () => sfxWin(false), sfxLevelUp: sfxAchievement, sfxCombo: sfxAchievement, sfxWheel: sfxPrestige };

  // Proxy: any undefined Music.xxx() becomes a harmless no-op.
  window.Music = new Proxy(realMusic, { get(target, key) { return key in target ? target[key] : () => {}; } });
})();
