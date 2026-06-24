/* animations.js — 2D canvas layer for Fortune Mill */
const Anim = (() => {
  'use strict';

  // ── Floating text overlay ─────────────────────────────────────────────────
  const floaters = [];
  let fc, fx;

  function initFloater() {
    fc = document.createElement('canvas');
    fc.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(fc);
    onResize();
    window.addEventListener('resize', onResize);
    floatLoop();
  }

  function onResize() {
    fc.width = window.innerWidth;
    fc.height = window.innerHeight;
    fx = fc.getContext('2d');
  }

  function float(text, x, y, color) {
    floaters.push({ text, x, y, vy: -2, alpha: 1, ttl: 75, color: color || '#ffd166' });
  }

  function floatFromEl(text, el, color) {
    const r = el.getBoundingClientRect();
    float(text, r.left + r.width / 2, r.top + 8, color);
  }

  function floatLoop() {
    fx.clearRect(0, 0, fc.width, fc.height);
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y += f.vy;
      f.vy *= 0.96;
      f.alpha = f.ttl / 75;
      f.ttl--;
      if (f.ttl <= 0) { floaters.splice(i, 1); continue; }
      fx.save();
      fx.globalAlpha = f.alpha;
      fx.font = 'bold 15px monospace';
      fx.strokeStyle = '#000';
      fx.lineWidth = 3;
      fx.textAlign = 'center';
      fx.strokeText(f.text, f.x, f.y);
      fx.fillStyle = f.color;
      fx.fillText(f.text, f.x, f.y);
      fx.restore();
    }
    requestAnimationFrame(floatLoop);
  }

  // ── Dartboard ─────────────────────────────────────────────────────────────
  const BW = 280, BH = 300, CX = 140, CY = 148;
  let dc, dx;
  const darts = [];

  function drawBoard() {
    const ctx = dx;
    ctx.clearRect(0, 0, BW, BH);

    // wood surround
    ctx.beginPath();
    ctx.arc(CX, CY, 144, 0, Math.PI * 2);
    const wood = ctx.createRadialGradient(CX, CY, 100, CX, CY, 144);
    wood.addColorStop(0, '#4a2c0a');
    wood.addColorStop(1, '#2b1605');
    ctx.fillStyle = wood;
    ctx.fill();

    const SEG = 20;
    const rings = [
      { outer: 130, inner: 118, alt: ['#cc2222', '#22aa22'] }, // double
      { outer: 118, inner: 82,  alt: ['#1a1a1a', '#f0ead8'] }, // outer field
      { outer: 82,  inner: 68,  alt: ['#cc2222', '#22aa22'] }, // triple
      { outer: 68,  inner: 22,  alt: ['#1a1a1a', '#f0ead8'] }, // inner field
    ];

    for (const ring of rings) {
      for (let i = 0; i < SEG; i++) {
        const a1 = (i / SEG) * Math.PI * 2 - Math.PI / 2 - Math.PI / SEG;
        const a2 = a1 + (Math.PI * 2) / SEG;
        ctx.beginPath();
        ctx.arc(CX, CY, ring.outer, a1, a2);
        ctx.arc(CX, CY, ring.inner, a2, a1, true);
        ctx.closePath();
        ctx.fillStyle = ring.alt[i % 2];
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    }

    // bull
    ctx.beginPath();
    ctx.arc(CX, CY, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#22aa22';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();

    // bullseye
    ctx.beginPath();
    ctx.arc(CX, CY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#cc2222';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();

    // numbers
    const NUMS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8e0cc';
    for (let i = 0; i < SEG; i++) {
      const angle = (i / SEG) * Math.PI * 2 - Math.PI / 2;
      const r = 138;
      ctx.fillText(NUMS[i], CX + Math.cos(angle) * r, CY + Math.sin(angle) * r);
    }

    // wire ring highlights
    for (const r of [10, 22, 68, 82, 118, 130]) {
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180,180,180,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function initDartboard(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    dc = document.createElement('canvas');
    dc.width = BW;
    dc.height = BH;
    dc.style.cssText = 'display:block;margin:8px auto;border-radius:50%;box-shadow:0 0 18px rgba(0,0,0,0.8);';
    const ref = el.querySelector('#throwBtn') || el.firstChild;
    el.insertBefore(dc, ref);
    dx = dc.getContext('2d');
    drawBoard();
    dartLoop();
  }

  function launchDart(accuracy, isCrit) {
    const maxR = isCrit ? 7 : Math.max(4, (1 - accuracy) * 112);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * maxR;
    const tx = CX + Math.cos(angle) * r;
    const ty = CY + Math.sin(angle) * r;
    darts.push({
      sx: tx + (Math.random() - 0.5) * 80,
      sy: -60,
      tx, ty,
      t: 0,
      settled: false,
      age: 0,
      isCrit,
      particles: [],
    });
    // trim old settled darts so board doesn't get cluttered
    if (darts.filter(d => d.settled).length > 5) {
      const idx = darts.findIndex(d => d.settled && d.particles.length === 0);
      if (idx !== -1) darts.splice(idx, 1);
    }
  }

  function dartLoop() {
    if (!dx) { requestAnimationFrame(dartLoop); return; }
    drawBoard();

    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];

      if (!d.settled) {
        d.t = Math.min(1, d.t + 0.065);
        const e = 1 - Math.pow(1 - d.t, 3);
        d.cx = d.sx + (d.tx - d.sx) * e;
        d.cy = d.sy + (d.ty - d.sy) * e;
        if (d.t >= 1) {
          d.settled = true;
          impactParticles(d);
        }
      } else {
        d.age++;
        if (d.age > 180 && d.particles.length === 0) {
          darts.splice(i, 1);
          continue;
        }
      }

      for (let p = d.particles.length - 1; p >= 0; p--) {
        const pt = d.particles[p];
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--;
        if (pt.life <= 0) { d.particles.splice(p, 1); continue; }
        dx.beginPath();
        dx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        dx.globalAlpha = pt.life / pt.maxLife;
        dx.fillStyle = pt.color;
        dx.fill();
        dx.globalAlpha = 1;
      }

      const drawX = d.settled ? d.tx : d.cx;
      const drawY = d.settled ? d.ty : d.cy;
      drawDart(dx, drawX, drawY, d.isCrit);
    }
    requestAnimationFrame(dartLoop);
  }

  function impactParticles(d) {
    const count = d.isCrit ? 18 : 7;
    for (let i = 0; i < count; i++) {
      const speed = 1.2 + Math.random() * 3.5;
      const angle = Math.random() * Math.PI * 2;
      d.particles.push({
        x: d.tx, y: d.ty,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        r: 1.5 + Math.random() * 2,
        life: 22 + Math.random() * 22,
        maxLife: 44,
        color: d.isCrit ? '#ffd166' : '#6ee7a0',
      });
    }
  }

  function drawDart(ctx, x, y, isCrit) {
    ctx.save();
    ctx.translate(x, y);
    // tip
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-2.5, -13);
    ctx.lineTo(2.5, -13);
    ctx.closePath();
    ctx.fillStyle = isCrit ? '#ffd166' : '#d4d4d4';
    ctx.fill();
    // barrel
    const bgrad = ctx.createLinearGradient(-3, -13, 3, -13);
    bgrad.addColorStop(0, '#888');
    bgrad.addColorStop(0.5, '#ccc');
    bgrad.addColorStop(1, '#888');
    ctx.fillStyle = bgrad;
    ctx.fillRect(-2.5, -30, 5, 17);
    // shaft
    ctx.fillStyle = '#aaa';
    ctx.fillRect(-1, -40, 2, 10);
    // flights
    const fc = isCrit ? '#ff6b6b' : '#76b3ff';
    ctx.beginPath();
    ctx.moveTo(0, -40); ctx.lineTo(-10, -58); ctx.lineTo(0, -46);
    ctx.closePath();
    ctx.fillStyle = fc;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -40); ctx.lineTo(10, -58); ctx.lineTo(0, -46);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Scratch card ──────────────────────────────────────────────────────────
  const SW = 300, SH = 130;
  let sc, sx;
  let scratchAnim = null;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawIdleScratch() {
    if (!sx) return;
    const ctx = sx;
    ctx.clearRect(0, 0, SW, SH);
    for (let i = 0; i < 3; i++) {
      const px = 15 + i * 95;
      const grad = ctx.createLinearGradient(px, 20, px, 105);
      grad.addColorStop(0, '#c8a84b');
      grad.addColorStop(0.5, '#e8c96a');
      grad.addColorStop(1, '#a07830');
      ctx.fillStyle = grad;
      roundRect(ctx, px, 20, 80, 85, 8);
      ctx.fill();
      ctx.strokeStyle = '#7a5c20';
      ctx.lineWidth = 2;
      roundRect(ctx, px, 20, 80, 85, 8);
      ctx.stroke();
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#6a4c18';
      ctx.fillText('?', px + 40, 62);
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function revealScratch(won, jackpot) {
    let symbols;
    if (jackpot)     symbols = ['💰', '💰', '💰'];
    else if (won)    symbols = shuffle(['$', '$', '7']);
    else             symbols = shuffle(['X', '$', 'X']);

    scratchAnim = {
      symbols,
      won,
      jackpot,
      panels: [
        { t: 0, delay: 0 },
        { t: 0, delay: 14 },
        { t: 0, delay: 28 },
      ],
      finished: false,
    };
  }

  function initScratchCard(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    sc = document.createElement('canvas');
    sc.width = SW;
    sc.height = SH;
    sc.style.cssText = 'display:block;margin:8px auto;border-radius:8px;box-shadow:0 0 12px rgba(0,0,0,0.6);';
    const ref = el.querySelector('#scratchBtn') || el.firstChild;
    el.insertBefore(sc, ref);
    sx = sc.getContext('2d');
    drawIdleScratch();
    scratchLoop();
  }

  function scratchLoop() {
    if (!sx) { requestAnimationFrame(scratchLoop); return; }
    if (!scratchAnim) { requestAnimationFrame(scratchLoop); return; }

    const ctx = sx;
    const a = scratchAnim;
    ctx.clearRect(0, 0, SW, SH);

    let allDone = true;
    for (let i = 0; i < 3; i++) {
      const panel = a.panels[i];
      if (panel.delay > 0) { panel.delay--; allDone = false; }
      else if (panel.t < 1) { panel.t = Math.min(1, panel.t + 0.055); allDone = false; }

      const t = panel.t;
      const px = 15 + i * 95;
      const sym = a.symbols[i];
      const isWinSym = sym !== 'X';
      const symColor = isWinSym ? (sym === '💰' || sym === '7' ? '#ffd166' : '#6ee7a0') : '#ff6b6b';
      const bgColor  = isWinSym ? '#0e2016' : '#200e0e';

      ctx.save();
      ctx.translate(px + 40, 62);

      if (t < 0.5) {
        // fold away: cover shrinks horizontally
        const scaleX = 1 - t * 2;
        ctx.scale(scaleX, 1);
        const grad = ctx.createLinearGradient(-40, -42, 40, -42);
        grad.addColorStop(0, '#a07830');
        grad.addColorStop(0.5, '#e8c96a');
        grad.addColorStop(1, '#a07830');
        ctx.fillStyle = grad;
        roundRect(ctx, -40, -42, 80, 85, 8);
        ctx.fill();
        ctx.strokeStyle = '#7a5c20';
        ctx.lineWidth = 2;
        roundRect(ctx, -40, -42, 80, 85, 8);
        ctx.stroke();
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#6a4c18';
        ctx.fillText('?', 0, 0);
      } else {
        // reveal: result panel unfolds
        const scaleX = (t - 0.5) * 2;
        ctx.scale(scaleX, 1);
        ctx.fillStyle = bgColor;
        roundRect(ctx, -40, -42, 80, 85, 8);
        ctx.fill();
        ctx.strokeStyle = symColor;
        ctx.lineWidth = 2;
        roundRect(ctx, -40, -42, 80, 85, 8);
        ctx.stroke();
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = symColor;
        ctx.fillText(sym, 0, 0);
      }

      ctx.restore();
    }

    if (allDone && !a.finished) {
      a.finished = true;
      setTimeout(() => { scratchAnim = null; drawIdleScratch(); }, 2200);
    }

    requestAnimationFrame(scratchLoop);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init: initFloater,
    initDartboard,
    initScratchCard,
    throwDart: launchDart,
    revealScratch,
    float,
    floatFromEl,
  };
})();
