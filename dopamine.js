/* dopamine.js — achievements, combos, XP/levels, milestones, lucky hour, spin wheel, screen shake */
const Dopamine = (() => {
  'use strict';

  let _state = null, _auth = null, _getPS = null, _prize = null;

  function money(n) {
    n = Math.floor(n);
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6)  return '$' + (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3)  return '$' + (n/1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString();
  }

  // ── Achievements ──────────────────────────────────────────────────────────
  const ACH = [
    { id:'dart1',    i:'🎯', n:'First Throw',    d:'Throw your first dart',              bonus:'+0.5% earnings', bv:0.005, c:(s)=>s.lifetime>0 },
    { id:'crit1',    i:'💥', n:'Bullseye!',       d:'Land your first critical throw',     bonus:'+0.5% earnings', bv:0.005, c:(s)=>(s.crits||0)>=1 },
    { id:'crit50',   i:'🔥', n:'On Fire',         d:'Land 50 critical throws',            bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.crits||0)>=50 },
    { id:'win1',     i:'🎟', n:'Lucky Draw',      d:'Win a scratch ticket',               bonus:'+0.5% earnings', bv:0.005, c:(s)=>(s.scratchWins||0)>=1 },
    { id:'jackpot1', i:'💰', n:'Jackpot!',        d:'Hit a scratch jackpot',              bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.jackpots||0)>=1 },
    { id:'jackpot5', i:'🤑', n:'Money Machine',   d:'Hit 5 scratch jackpots',             bonus:'+2% earnings',   bv:0.02,  c:(s)=>(s.jackpots||0)>=5 },
    { id:'slot1',    i:'🎰', n:'Slot Rookie',     d:'Win your first slot spin',           bonus:'+0.5% earnings', bv:0.005, c:(s)=>(s.slotWins||0)>=1 },
    { id:'slot20',   i:'🎲', n:'Slot Veteran',    d:'Win 20 slot spins',                  bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.slotWins||0)>=20 },
    { id:'g1k',      i:'💵', n:'Grand',           d:'Earn $1,000 lifetime',               bonus:'+0.5% earnings', bv:0.005, c:(s)=>s.lifetime>=1e3 },
    { id:'g100k',    i:'💶', n:'High Roller',     d:'Earn $100,000 lifetime',             bonus:'+1% earnings',   bv:0.01,  c:(s)=>s.lifetime>=1e5 },
    { id:'g1m',      i:'💷', n:'Millionaire',     d:'Earn $1,000,000 lifetime',           bonus:'+2% earnings',   bv:0.02,  c:(s)=>s.lifetime>=1e6 },
    { id:'g1b',      i:'🏦', n:'Billionaire',     d:'Earn $1,000,000,000 lifetime',       bonus:'+3% earnings',   bv:0.03,  c:(s)=>s.lifetime>=1e9 },
    { id:'g1t',      i:'🌐', n:'World Economy',   d:'Earn $1T lifetime',                  bonus:'+5% earnings',   bv:0.05,  c:(s)=>s.lifetime>=1e12 },
    { id:'combo5',   i:'⚡', n:'Combo ×5',        d:'Build a 5x throw combo',             bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.maxCombo||0)>=5 },
    { id:'combo10',  i:'🌪', n:'Combo ×10',       d:'Build a 10x throw combo',            bonus:'+2% earnings',   bv:0.02,  c:(s)=>(s.maxCombo||0)>=10 },
    { id:'combo20',  i:'🌀', n:'Combo ×20',       d:'Build a 20x throw combo',            bonus:'+3% earnings',   bv:0.03,  c:(s)=>(s.maxCombo||0)>=20 },
    { id:'pres1',    i:'✨', n:'Reborn',          d:'Prestige for the first time',        bonus:'+2% earnings',   bv:0.02,  c:(_,a)=>(a.prestige||0)>=1 },
    { id:'pres5',    i:'🌟', n:'Phoenix',         d:'Prestige 5 times',                   bonus:'+5% earnings',   bv:0.05,  c:(_,a)=>(a.prestige||0)>=5 },
    { id:'lvl5',     i:'⬆️', n:'Rising Star',     d:'Reach level 5',                      bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.level||1)>=5 },
    { id:'lvl10',    i:'🎖', n:'Veteran',         d:'Reach level 10',                     bonus:'+2% earnings',   bv:0.02,  c:(s)=>(s.level||1)>=10 },
    { id:'lvl25',    i:'👑', n:'Legend',          d:'Reach level 25',                     bonus:'+5% earnings',   bv:0.05,  c:(s)=>(s.level||1)>=25 },
    { id:'lucky1',   i:'🍀', n:'Lucky Break',     d:'Experience a Lucky Hour',            bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.luckyHours||0)>=1 },
    { id:'spin1',    i:'🎡', n:'Spin Doctor',     d:'Spin the fortune wheel',             bonus:'+1% earnings',   bv:0.01,  c:(s)=>(s.spins||0)>=1 },
    { id:'streak7',  i:'🗓', n:'Devoted',         d:'7-day login streak',                 bonus:'+3% earnings',   bv:0.03,  c:(_,a)=>(a.dailyStreak||0)>=7 },
    { id:'rooms',    i:'🏆', n:'Full House',      d:'Clear both Darts and Scratchers',    bonus:'+5% earnings',   bv:0.05,  c:(s)=>!!(s.darts?.cleared&&s.scratch?.cleared) },
  ];

  function checkAchievements() {
    if (!_state) return;
    if (!_state.achievements) _state.achievements = [];
    const got = new Set(_state.achievements);
    for (const a of ACH) {
      if (got.has(a.id)) continue;
      try { if (a.c(_state, _auth || {})) { _state.achievements.push(a.id); _showAchievement(a); } } catch(e) {}
    }
  }

  function getAchievementBonus() {
    if (!_state || !_state.achievements) return 1;
    const got = new Set(_state.achievements);
    const total = ACH.filter(a => got.has(a.id)).reduce((sum, a) => sum + (a.bv || 0), 0);
    return 1 + total;
  }

  function _showAchievement(a) {
    const stack = document.getElementById('achStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.innerHTML = `<span class="ach-icon">${a.i}</span><div><div class="ach-name">${a.n}</div>${a.bonus ? `<div class="ach-bonus">${a.bonus}</div>` : ''}<div class="ach-desc">${a.d}</div></div>`;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 500); }, 4500);
    if (typeof Music !== 'undefined') Music.sfxAchievement();
  }

  // ── XP / Level ────────────────────────────────────────────────────────────
  function xpToNext(level) { return Math.floor(120 * Math.pow(1.45, level - 1)); }
  function getLevelBonus()  { return 1 + ((_state ? (_state.level || 1) - 1 : 0) * 0.01); }

  function addXP(gold) {
    if (!_state) return;
    _state.xp = (_state.xp || 0) + gold / 50;
    const lvl = _state.level || 1;
    if (_state.xp >= xpToNext(lvl)) {
      _state.xp -= xpToNext(lvl);
      _state.level = lvl + 1;
      _onLevelUp(_state.level);
    }
    _updateXPBar();
  }

  function _onLevelUp(level) {
    showBanner(`⬆️ LEVEL UP!  Now Level ${level}`, '#76b3ff');
    shake('light');
    if (typeof Music !== 'undefined') Music.sfxLevelUp();
    checkAchievements();
  }

  function _updateXPBar() {
    if (!_state) return;
    const lvl  = _state.level || 1;
    const xp   = _state.xp   || 0;
    const need = xpToNext(lvl);
    const pct  = Math.min(100, (xp / need) * 100).toFixed(1);
    const fill = document.getElementById('xpBarFill');
    const txt  = document.getElementById('xpText');
    if (fill) fill.style.width = pct + '%';
    if (txt)  txt.textContent = `Lv ${lvl}  ·  ${Math.floor(xp)} / ${need} XP  (+${((getLevelBonus()-1)*100).toFixed(0)}% earnings)`;
  }

  // ── Combo ─────────────────────────────────────────────────────────────────
  let combo = 0, comboTimer = null;

  function onThrow() {
    clearTimeout(comboTimer);
    combo++;
    if (_state) _state.maxCombo = Math.max(_state.maxCombo || 0, combo);
    _updateCombo();
    checkAchievements();
    comboTimer = setTimeout(() => { combo = 0; _updateCombo(); }, 1800);
  }

  function getComboMult() {
    if (combo < 3)  return 1;
    if (combo < 7)  return 1.5;
    if (combo < 15) return 2;
    if (combo < 30) return 3;
    return 4;
  }

  function _updateCombo() {
    const el = document.getElementById('comboDisplay');
    if (!el) return;
    if (combo < 2) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('.combo-count').textContent = `×${combo} COMBO`;
    const m = getComboMult();
    el.querySelector('.combo-mult').textContent = m > 1 ? `${m}× gold` : '';
    el.className = 'combo-display' + (combo >= 15 ? ' hot' : combo >= 7 ? ' warm' : '');
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  const M_VALS  = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e12];
  const M_NAMES = ['$1K','$10K','$100K','$1M','$10M','$100M','$1B','$1T'];

  function checkMilestones(lifetime) {
    if (!_state) return;
    if (!_state.milestones) _state.milestones = [];
    for (let i = 0; i < M_VALS.length; i++) {
      if (lifetime >= M_VALS[i] && !_state.milestones.includes(i)) {
        _state.milestones.push(i);
        showBanner(`💸 ${M_NAMES[i]} LIFETIME EARNED!`, '#ffd166');
        shake(i >= 5 ? 'heavy' : i >= 3 ? 'medium' : 'light');
        if (typeof Music !== 'undefined') Music.sfxMilestone();
      }
    }
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  function showBanner(text, color) {
    const el = document.getElementById('milestoneBanner');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '#ffd166';
    el.classList.remove('hidden', 'banner-exit');
    el.classList.add('banner-enter');
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.classList.remove('banner-enter');
      el.classList.add('banner-exit');
      setTimeout(() => el.classList.add('hidden'), 500);
    }, 2000);
  }

  // ── Lucky Hour ────────────────────────────────────────────────────────────
  let luckyActive = false, luckyRemain = 0, luckyIv = null;

  function isLucky() { return luckyActive; }

  function tryLucky() {
    if (luckyActive) return;
    if (Math.random() < 0.04) startLucky();
  }

  function startLucky() {
    if (luckyActive) return;
    luckyActive = true; luckyRemain = 60;
    if (_state) _state.luckyHours = (_state.luckyHours || 0) + 1;
    document.getElementById('luckyBar')?.classList.remove('hidden');
    _updateLuckyBar();
    showBanner('🍀 LUCKY HOUR!  All earnings ×2 for 60 seconds!', '#6ee7a0');
    shake('light');
    if (typeof Music !== 'undefined') Music.sfxLucky();
    clearInterval(luckyIv);
    luckyIv = setInterval(() => {
      luckyRemain--;
      _updateLuckyBar();
      if (luckyRemain <= 0) {
        clearInterval(luckyIv);
        luckyActive = false;
        document.getElementById('luckyBar')?.classList.add('hidden');
        checkAchievements();
      }
    }, 1000);
  }

  function _updateLuckyBar() {
    const el = document.getElementById('luckyBarText');
    if (el) el.textContent = `🍀 LUCKY HOUR  —  ×2 all earnings  —  ${luckyRemain}s remaining`;
  }

  // ── Screen shake ──────────────────────────────────────────────────────────
  function shake(strength) {
    const wrap = document.querySelector('.wrap');
    if (!wrap) return;
    const cls = 'shake-' + (strength || 'light');
    wrap.classList.remove('shake-light', 'shake-medium', 'shake-heavy');
    void wrap.offsetWidth;
    wrap.classList.add(cls);
    wrap.addEventListener('animationend', () => wrap.classList.remove(cls), { once: true });
  }

  // ── Spin Wheel ────────────────────────────────────────────────────────────
  const SEGS = [
    { label:'2 min\nincome',  color:'#1a6e1a', text:'#fff', type:'income', mult:120 },
    { label:'5 min\nincome',  color:'#9a7010', text:'#fff', type:'income', mult:300 },
    { label:'LUCKY\nHOUR!',  color:'#992222', text:'#fff', type:'lucky' },
    { label:'10 min\nincome', color:'#1a4499', text:'#fff', type:'income', mult:600 },
    { label:'2 min\nincome',  color:'#1a6e1a', text:'#fff', type:'income', mult:120 },
    { label:'30 min\nincome', color:'#9a7010', text:'#fff', type:'income', mult:1800 },
    { label:'5 min\nincome',  color:'#165c30', text:'#fff', type:'income', mult:300 },
    { label:'💰\nJACKPOT',   color:'#994400', text:'#fff', type:'jackpot' },
  ];

  let wc = null, wx = null, wAngle = 0, wVel = 0, wAF = null, wSpinning = false;

  function _drawWheel() {
    if (!wx) return;
    const CX = 200, CY = 200, R = 172;
    wx.clearRect(0, 0, 400, 400);

    const segSize = (Math.PI * 2) / SEGS.length;
    for (let i = 0; i < SEGS.length; i++) {
      const a1 = wAngle + i * segSize, a2 = wAngle + (i+1) * segSize;
      wx.beginPath(); wx.moveTo(CX, CY); wx.arc(CX, CY, R, a1, a2); wx.closePath();
      wx.fillStyle = SEGS[i].color; wx.fill();
      wx.strokeStyle = '#000'; wx.lineWidth = 2; wx.stroke();

      const mid = a1 + segSize / 2;
      wx.save();
      wx.translate(CX + Math.cos(mid) * R * 0.63, CY + Math.sin(mid) * R * 0.63);
      wx.rotate(mid + Math.PI / 2);
      wx.font = 'bold 11px monospace'; wx.textAlign = 'center'; wx.fillStyle = SEGS[i].text;
      SEGS[i].label.split('\n').forEach((ln, li, arr) => wx.fillText(ln, 0, li * 14 - (arr.length-1)*7));
      wx.restore();
    }

    // outer ring
    wx.beginPath(); wx.arc(CX, CY, R+3, 0, Math.PI*2);
    wx.strokeStyle = '#ffd166'; wx.lineWidth = 4; wx.stroke();

    // hub
    const hub = wx.createRadialGradient(CX-4, CY-4, 2, CX, CY, 22);
    hub.addColorStop(0, '#aaa'); hub.addColorStop(1, '#333');
    wx.beginPath(); wx.arc(CX, CY, 22, 0, Math.PI*2);
    wx.fillStyle = hub; wx.fill(); wx.strokeStyle = '#555'; wx.lineWidth = 2; wx.stroke();

    // pointer (top)
    wx.beginPath();
    wx.moveTo(CX, CY - R + 4); wx.lineTo(CX - 14, CY - R - 26); wx.lineTo(CX + 14, CY - R - 26);
    wx.closePath(); wx.fillStyle = '#ff6b6b'; wx.fill();
    wx.strokeStyle = '#cc0000'; wx.lineWidth = 1.5; wx.stroke();
  }

  function _wheelLoop() {
    wAngle += wVel; wVel *= 0.985; _drawWheel();
    if (wVel > 0.003) { wAF = requestAnimationFrame(_wheelLoop); return; }
    wSpinning = false;
    const segSize = (Math.PI * 2) / SEGS.length;
    const norm = ((-Math.PI/2 - wAngle) % (Math.PI*2) + Math.PI*2) % (Math.PI*2);
    const idx  = Math.floor(norm / segSize) % SEGS.length;
    setTimeout(() => _awardPrize(SEGS[idx]), 500);
  }

  function _awardPrize(seg) {
    const ps = _getPS ? _getPS() : 0;
    if (seg.type === 'lucky') {
      startLucky();
      showBanner('🍀 Wheel landed: LUCKY HOUR!', '#6ee7a0');
    } else if (seg.type === 'jackpot') {
      const amt = Math.max(1000, ps * 600);
      if (_prize) _prize(amt);
      showBanner(`🎰 JACKPOT WHEEL! +${money(amt)}`, '#ffd166');
      shake('heavy');
      if (typeof Music !== 'undefined') Music.sfxWin(true);
    } else {
      const amt = Math.max(50, ps * seg.mult);
      if (_prize) _prize(amt);
      showBanner(`🎡 Wheel: +${money(amt)}`, '#6ee7a0');
      shake('light');
      if (typeof Music !== 'undefined') Music.sfxWin(false);
    }
    document.getElementById('wheelSpinBtn').textContent = 'SPIN!';
    document.getElementById('wheelSpinBtn').disabled = false;
    _updateSpinBtn();
  }

  function _spinWheel() {
    if (wSpinning) return;
    if (!_state) return;
    const now = Date.now(), last = _state.lastSpin || 0;
    if (now - last < 3600000) {
      const m = Math.ceil((3600000 - (now - last)) / 60000);
      document.getElementById('wheelSpinBtn').textContent = `Wait ${m}m`;
      return;
    }
    _state.lastSpin = now;
    _state.spins = (_state.spins || 0) + 1;
    document.getElementById('wheelSpinBtn').disabled = true;
    document.getElementById('wheelSpinBtn').textContent = 'Spinning…';
    checkAchievements();
    if (typeof Music !== 'undefined') Music.sfxSpin();
    wVel = 0.35 + Math.random() * 0.18;
    wSpinning = true;
    _wheelLoop();
  }

  function _updateSpinBtn() {
    const btn = document.getElementById('spinBtn');
    if (!btn || !_state) return;
    const diff = Date.now() - (_state.lastSpin || 0);
    btn.disabled = diff < 3600000;
    btn.textContent = diff >= 3600000 ? '🎡 Spin Wheel' : `🎡 ${Math.ceil((3600000-diff)/60000)}m`;
  }

  // ── Offline earnings ───────────────────────────────────────────────────────
  function calcOffline() {
    if (!_state || !_state.lastSaveTime || !_getPS) return 0;
    const elapsed = Math.min((Date.now() - _state.lastSaveTime) / 1000, 8 * 3600);
    if (elapsed < 300) return 0;
    return Math.floor(_getPS() * elapsed * 0.5);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(stateRef, authRef, getPS, prizeCallback) {
    _state = stateRef; _auth = authRef; _getPS = getPS; _prize = prizeCallback;

    // Spin wheel
    document.getElementById('spinBtn')?.addEventListener('click', () => {
      document.getElementById('wheelModal')?.classList.remove('hidden');
      if (!wx) {
        wc = document.getElementById('wheelCanvas');
        wx = wc.getContext('2d');
      }
      _drawWheel();
    });
    document.getElementById('wheelSpinBtn')?.addEventListener('click', _spinWheel);
    document.getElementById('wheelClose')?.addEventListener('click', () =>
      document.getElementById('wheelModal')?.classList.add('hidden'));

    // Lucky hour check every 30s
    setInterval(tryLucky, 30000);
    // Spin btn cooldown refresh every minute
    setInterval(_updateSpinBtn, 60000);

    _updateSpinBtn();
    _updateXPBar();
    checkAchievements();
  }

  return {
    init,
    checkAchievements,
    onThrow,
    getComboMult,
    isLucky,
    getLevelBonus,
    getAchievementBonus,
    addXP,
    checkMilestones,
    shake,
    showBanner,
    calcOffline,
    startLucky,
    refreshXP: _updateXPBar,
    ACH_LIST: ACH,
  };
})();
