/* music.js — procedural chiptune music + SFX for Fortune Mill
   Uses Web Audio API only — no files, no CDN, no npm. */
const Music = (() => {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;
  let started = false;

  // ── Scheduler state ────────────────────────────────────────────────────────
  const BPM        = 122;
  const STEP       = 60 / BPM / 2;   // 8th-note duration in seconds
  const LOOK_AHEAD = 0.12;            // schedule this far ahead
  const TICK_MS    = 50;              // how often to run the scheduler
  let stepIdx      = 0;
  let nextStepTime = 0;
  let tickTimer    = null;

  // ── Note table ─────────────────────────────────────────────────────────────
  const N = {
    C3:130.81, D3:146.83, E3:164.81, G3:196.00, A3:220.00,
    C4:261.63, D4:293.66, E4:329.63, G4:392.00, A4:440.00, B4:493.88,
    C5:523.25, D5:587.33, E5:659.25, G5:784.00, A5:880.00,
  };

  // ── Patterns (all in 8th-note steps) ──────────────────────────────────────
  // 4-bar melody loop (32 steps). 0 = rest.
  const MELODY = [
    // bar 1 — ascending cascade
    N.E4, N.G4, N.A4, N.G4,  N.E4,  0,    N.D4, 0,
    // bar 2 — answer phrase
    N.C4,  0,   N.E4, N.G4,  N.A4,  0,    N.A4, 0,
    // bar 3 — push higher
    N.E4, N.G4, N.A4, N.A4,  N.G4, N.E4,  N.D4, 0,
    // bar 4 — resolve
    N.C4, N.E4, N.G4,  0,    N.E4, N.D4,  N.C4, 0,
  ];

  // Bass: one note every half-bar (4 steps), 8 entries = 4 bars
  const BASS = [N.C3, N.G3,  N.C3, N.A3,  N.G3, N.C3,  N.A3, N.G3];

  // Kick on beats 1 & 3 of each bar (every 4 steps, first and third)
  const KICK = [1,0,0,0, 0,0,1,0];  // 8 steps, per-bar

  // Hi-hat every 8th note, accent on the downbeat
  const HAT  = [1,1,1,1, 1,1,1,1];

  // ── Lazy init ─────────────────────────────────────────────────────────────
  function ensureCtx() {
    if (ctx) return;
    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }

  // ── Low-level primitives ───────────────────────────────────────────────────
  function osc(type, freq, startT, dur, vol, target) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, startT);
    g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
    o.connect(g);
    g.connect(target || master);
    o.start(startT);
    o.stop(startT + dur + 0.02);
  }

  function noise(startT, dur, vol, hpFreq) {
    const samples = Math.ceil(ctx.sampleRate * dur);
    const buf  = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp  = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq || 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, startT);
    g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(startT);
    src.stop(startT + dur + 0.01);
  }

  function kick(startT) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, startT);
    o.frequency.exponentialRampToValueAtTime(40, startT + 0.18);
    g.gain.setValueAtTime(0.45, startT);
    g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.28);
    o.connect(g); g.connect(master);
    o.start(startT); o.stop(startT + 0.32);
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────
  function scheduleStep(step, t) {
    // Melody
    const freq = MELODY[step % MELODY.length];
    if (freq) osc('square', freq, t, STEP * 0.75, 0.10);

    // Bass (half-bar)
    if (step % 4 === 0) {
      const bassFreq = BASS[Math.floor(step / 4) % BASS.length];
      osc('triangle', bassFreq, t, STEP * 3.5, 0.18);
    }

    // Kick
    if (KICK[step % 8]) kick(t);

    // Hi-hat
    if (HAT[step % 8]) {
      const hatVol = step % 2 === 0 ? 0.06 : 0.03;
      noise(t, 0.04, hatVol, 8000);
    }
  }

  function tick() {
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + LOOK_AHEAD) {
      scheduleStep(stepIdx, nextStepTime);
      stepIdx      = (stepIdx + 1) % MELODY.length;
      nextStepTime += STEP;
    }
  }

  // ── Public: start / toggle ─────────────────────────────────────────────────
  function start() {
    if (started) return;
    started = true;
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    nextStepTime = ctx.currentTime + 0.05;
    stepIdx = 0;
    tickTimer = setInterval(tick, TICK_MS);
  }

  function toggleMute() {
    ensureCtx();
    muted = !muted;
    master.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.08);
    return muted;
  }

  function isMuted() { return muted; }

  // ── Sound effects ──────────────────────────────────────────────────────────
  function sfxDart(isCrit) {
    ensureCtx();
    const t = ctx.currentTime;
    // whoosh
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(isCrit ? 700 : 380, t);
    o.frequency.exponentialRampToValueAtTime(isCrit ? 1400 : 180, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.18);

    if (isCrit) {
      // rising chime arpeggio
      [N.C5, N.E5, N.G5, N.C5 * 2].forEach((f, i) => {
        osc('sine', f, t + i * 0.07, 0.28, 0.10);
      });
    }
  }

  function sfxWin(isJackpot) {
    ensureCtx();
    const t = ctx.currentTime;
    const notes = isJackpot
      ? [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C5 * 2]
      : [N.E4, N.G4, N.C5, N.E5];
    notes.forEach((f, i) => {
      osc(isJackpot ? 'square' : 'sine', f, t + i * 0.07, 0.32, isJackpot ? 0.12 : 0.09);
    });
    if (isJackpot) {
      // coin shower noise burst
      [0, 0.05, 0.12, 0.2].forEach(delay => noise(t + delay, 0.06, 0.08, 5000));
    }
  }

  function sfxLoss() {
    ensureCtx();
    const t = ctx.currentTime;
    osc('sawtooth', N.A3, t, 0.12, 0.08);
    osc('sawtooth', N.D3, t + 0.12, 0.2, 0.08);
  }

  function sfxPrestige() {
    ensureCtx();
    const t = ctx.currentTime;
    // triumphant fanfare
    const fanfare = [
      [N.C4, 0], [N.E4, 0.10], [N.G4, 0.20], [N.C5, 0.30],
      [N.E5, 0.50], [N.G5, 0.58], [N.C5, 0.66], [N.E5, 0.70], [N.G5, 0.74], [N.C5 * 2, 0.82],
    ];
    fanfare.forEach(([f, d]) => osc('square', f, t + d, 0.3, 0.12));
    [0.3, 0.4, 0.5, 0.82, 0.92].forEach(d => noise(t + d, 0.06, 0.07, 5000));
  }

  function sfxDaily() {
    ensureCtx();
    const t = ctx.currentTime;
    [N.G4, N.A4, N.C5].forEach((f, i) => osc('sine', f, t + i * 0.09, 0.28, 0.10));
  }

  function sfxBuy() {
    ensureCtx();
    const t = ctx.currentTime;
    osc('sine', N.G4, t, 0.08, 0.08);
    osc('sine', N.C5, t + 0.06, 0.12, 0.07);
  }

  function sfxAchievement() {
    ensureCtx();
    const t = ctx.currentTime;
    [N.E5, N.G5, N.A5].forEach((f, i) => osc('sine', f, t + i * 0.08, 0.22, 0.10));
    noise(t + 0.2, 0.08, 0.05, 6000);
  }

  function sfxLevelUp() {
    ensureCtx();
    const t = ctx.currentTime;
    [N.C4, N.E4, N.G4, N.C5, N.E5].forEach((f, i) => osc('square', f, t + i * 0.07, 0.25, 0.09));
    osc('sine', N.G5, t + 0.4, 0.4, 0.12);
  }

  function sfxMilestone() {
    ensureCtx();
    const t = ctx.currentTime;
    const seq = [N.C4,N.G4,N.C5,N.G5,N.C5*2];
    seq.forEach((f, i) => {
      osc('square', f, t + i * 0.06, 0.3, 0.11);
      if (i >= 2) noise(t + i * 0.06, 0.05, 0.06, 5000);
    });
  }

  function sfxLucky() {
    ensureCtx();
    const t = ctx.currentTime;
    // shimmering arpeggiated twinkle
    const lucky = [N.G4, N.A4, N.C5, N.E5, N.G5, N.A5, N.G5, N.E5];
    lucky.forEach((f, i) => osc('sine', f, t + i * 0.055, 0.2, 0.09));
    noise(t + 0.3, 0.1, 0.04, 7000);
  }

  function sfxSpin() {
    ensureCtx();
    const t = ctx.currentTime;
    // rising noise burst → tick ticks
    noise(t, 0.1, 0.07, 4000);
    for (let i = 0; i < 10; i++) {
      const delay = 0.1 + i * 0.05;
      osc('triangle', 800 + i * 60, t + delay, 0.04, 0.06);
    }
  }

  return { start, toggleMute, isMuted, sfxDart, sfxWin, sfxLoss, sfxPrestige, sfxDaily, sfxBuy, sfxAchievement, sfxLevelUp, sfxMilestone, sfxLucky, sfxSpin };
})();
