/* animations.js — 3D canvas/CSS layer for Fortune Mill */
const Anim = (() => {
  'use strict';

  // ── Inject CSS for 3D scratch cards ───────────────────────────────────────
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      .scratch-cards {
        display: flex; gap: 16px; justify-content: center;
        padding: 14px 8px; perspective: 700px;
      }
      .scratch-card {
        width: 82px; height: 92px; position: relative;
        transform-style: preserve-3d;
        transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .scratch-card.flipped { transform: rotateY(180deg); }
      .sc-front, .sc-back {
        position: absolute; width: 100%; height: 100%;
        border-radius: 10px; display: flex; align-items: center;
        justify-content: center; font-size: 30px; font-weight: bold;
        font-family: "JetBrains Mono", Consolas, monospace;
        backface-visibility: hidden; -webkit-backface-visibility: hidden;
        border: 2px solid; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
      }
      .sc-front {
        background: linear-gradient(145deg, #b8922a, #e8c96a 50%, #9a7020);
        border-color: #7a5c18; color: #5a3c10;
        text-shadow: 0 1px 0 rgba(255,255,255,0.3);
      }
      .sc-back { transform: rotateY(180deg); border-color: #1e2a36; }
    `;
    document.head.appendChild(s);
  }

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

  // ── Dartboard (3D via CSS perspective + depth rim) ────────────────────────
  const BW = 280, BH = 300, CX = 140, CY = 148;
  let dc, dx;
  const darts = [];

  function drawBoard() {
    const ctx = dx;
    ctx.clearRect(0, 0, BW, BH);

    // depth shadow rim (gives 3D thickness illusion)
    ctx.beginPath();
    ctx.ellipse(CX, CY + 10, 146, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // wood surround
    ctx.beginPath();
    ctx.arc(CX, CY, 144, 0, Math.PI * 2);
    const wood = ctx.createRadialGradient(CX - 30, CY - 30, 10, CX, CY, 144);
    wood.addColorStop(0, '#5a3410');
    wood.addColorStop(0.6, '#3b2005');
    wood.addColorStop(1, '#1e0f00');
    ctx.fillStyle = wood;
    ctx.fill();

    const SEG = 20;
    const rings = [
      { outer: 130, inner: 118, alt: ['#cc2222', '#22aa22'] },
      { outer: 118, inner: 82,  alt: ['#1a1a1a', '#f0ead8'] },
      { outer: 82,  inner: 68,  alt: ['#cc2222', '#22aa22'] },
      { outer: 68,  inner: 22,  alt: ['#1a1a1a', '#f0ead8'] },
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
    ctx.beginPath(); ctx.arc(CX, CY, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#22aa22'; ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();

    // bullseye
    ctx.beginPath(); ctx.arc(CX, CY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#cc2222'; ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();

    // numbers
    const NUMS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8e0cc';
    for (let i = 0; i < SEG; i++) {
      const angle = (i / SEG) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(NUMS[i], CX + Math.cos(angle) * 137, CY + Math.sin(angle) * 137);
    }

    // wire highlights
    for (const r of [10, 22, 68, 82, 118, 130]) {
      ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,200,200,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // top specular highlight (sells the 3D depth)
    const shine = ctx.createLinearGradient(CX - 100, CY - 140, CX + 100, CY - 60);
    shine.addColorStop(0, 'rgba(255,255,255,0.0)');
    shine.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    shine.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.beginPath(); ctx.arc(CX, CY, 143, Math.PI, Math.PI * 2);
    ctx.fillStyle = shine; ctx.fill();
  }

  function initDartboard(containerId) {
    const slot = document.getElementById('dartboardSlot');
    if (!slot) return;
    dc = document.createElement('canvas');
    dc.width = BW; dc.height = BH;
    dc.style.cssText = [
      'display:inline-block',
      'border-radius:50%',
      'transform:perspective(700px) rotateX(22deg)',
      'transform-origin:center center',
      'box-shadow:0 16px 40px rgba(0,0,0,0.9), 0 0 0 4px #0d0700',
      'max-width:100%',
    ].join(';');
    slot.appendChild(dc);
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
    darts.push({ sx: tx + (Math.random() - 0.5) * 80, sy: -60, tx, ty, t: 0, settled: false, age: 0, isCrit, particles: [] });
    // trim oldest settled dart when board gets crowded
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
        if (d.t >= 1) { d.settled = true; impactParticles(d); }
      } else {
        d.age++;
        if (d.age > 180 && d.particles.length === 0) { darts.splice(i, 1); continue; }
      }

      for (let p = d.particles.length - 1; p >= 0; p--) {
        const pt = d.particles[p];
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--;
        if (pt.life <= 0) { d.particles.splice(p, 1); continue; }
        dx.beginPath(); dx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        dx.globalAlpha = pt.life / pt.maxLife;
        dx.fillStyle = pt.color; dx.fill(); dx.globalAlpha = 1;
      }

      drawDart(dx, d.settled ? d.tx : d.cx, d.settled ? d.ty : d.cy, d.isCrit);
    }
    requestAnimationFrame(dartLoop);
  }

  function impactParticles(d) {
    const n = d.isCrit ? 18 : 7;
    for (let i = 0; i < n; i++) {
      const speed = 1.2 + Math.random() * 3.5;
      const angle = Math.random() * Math.PI * 2;
      d.particles.push({ x: d.tx, y: d.ty, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, r: 1.5 + Math.random() * 2, life: 22 + Math.random() * 22, maxLife: 44, color: d.isCrit ? '#ffd166' : '#6ee7a0' });
    }
  }

  function drawDart(ctx, x, y, isCrit) {
    ctx.save();
    ctx.translate(x, y);
    // tip
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2.5, -13); ctx.lineTo(2.5, -13); ctx.closePath();
    ctx.fillStyle = isCrit ? '#ffd166' : '#d4d4d4'; ctx.fill();
    // barrel
    const bg = ctx.createLinearGradient(-3, -13, 3, -13);
    bg.addColorStop(0, '#666'); bg.addColorStop(0.5, '#ccc'); bg.addColorStop(1, '#666');
    ctx.fillStyle = bg; ctx.fillRect(-2.5, -30, 5, 17);
    // shaft
    ctx.fillStyle = '#aaa'; ctx.fillRect(-1, -40, 2, 10);
    // flights
    const fc2 = isCrit ? '#ff6b6b' : '#76b3ff';
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(-10, -58); ctx.lineTo(0, -46); ctx.closePath();
    ctx.fillStyle = fc2; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(10, -58); ctx.lineTo(0, -46); ctx.closePath();
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Scratch cards (CSS 3D flip) ───────────────────────────────────────────
  let cardEls = [];

  function initScratchCard(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'scratch-cards';
    cardEls = [];

    for (let i = 0; i < 3; i++) {
      const card = document.createElement('div');
      card.className = 'scratch-card';

      const front = document.createElement('div');
      front.className = 'sc-front';
      front.textContent = '?';

      const back = document.createElement('div');
      back.className = 'sc-back';

      card.appendChild(front);
      card.appendChild(back);
      wrapper.appendChild(card);
      cardEls.push({ card, back });
    }

    const ref = el.querySelector('#scratchBtn') || el.firstChild;
    el.insertBefore(wrapper, ref);
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
    if (!cardEls.length) return;
    let symbols;
    if (jackpot)      symbols = ['💰', '💰', '💰'];
    else if (won)     symbols = shuffle(['$', '$', '7']);
    else              symbols = shuffle(['X', '$', 'X']);

    for (let i = 0; i < 3; i++) {
      const { card, back } = cardEls[i];
      card.classList.remove('flipped');

      const sym = symbols[i];
      const isWin = sym !== 'X';
      const color = sym === '💰' || sym === '7' ? '#ffd166' : isWin ? '#6ee7a0' : '#ff6b6b';
      back.textContent = sym;
      back.style.cssText = `background:${isWin ? '#0e2016' : '#200e0e'};border-color:${color};color:${color};font-size:${sym === '💰' ? '26px' : '30px'};`;

      const delay = i * 230;
      setTimeout(() => card.classList.add('flipped'), delay);
      setTimeout(() => card.classList.remove('flipped'), delay + 2400);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    initFloater();
  }

  return { init, initDartboard, initScratchCard, throwDart: launchDart, revealScratch, float, floatFromEl };
})();
