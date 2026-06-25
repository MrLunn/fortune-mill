/* Fortune Mill — text edition (client engine)
 * Five rooms (Darts, Scratchers, Pachinko, Sushi, Gacha) with upgrades,
 * automation, cross-room synergy, prestige, daily rewards, PvP duels and guilds.
 */
(() => {
  'use strict';

  const ROOM_GOAL = 1_000_000;
  const ALL_ROOMS = ['darts', 'scratch', 'pachinko', 'sushi', 'gacha'];
  const ROOM_NAMES = { darts: 'Dart', scratch: 'Scratcher', pachinko: 'Pachinko', sushi: 'Sushi', gacha: 'Gacha' };

  // ---- Game state (the bit we persist) ----
  const state = {
    gold: 0,
    lifetime: 0,
    darts: { cleared: false, best: 0, upgrades: {} },
    scratch: { cleared: false, best: 0, upgrades: {} },
    pachinko: { cleared: false, best: 0, upgrades: {} },
    sushi: { cleared: false, best: 0, upgrades: {} },
    gacha: { cleared: false, best: 0, upgrades: {} },
  };

  let auth = { username: null, token: null, prestige: 0, dailyStreak: 0, lastClaim: 0 };
  let passwordRequired = false;

  // ---- Upgrade definitions ----
  const DART_UPGRADES = [
    { id: 'value', name: 'Sharper Tips', desc: '+1 base gold per throw', base: 15, growth: 1.55, max: 9999 },
    { id: 'mult', name: 'Bullseye Training', desc: '+25% dart gold multiplier', base: 120, growth: 1.7, max: 9999 },
    { id: 'auto', name: 'Machine-Gun Mouse', desc: '+1 auto-throw per second', base: 250, growth: 1.85, max: 200 },
    { id: 'crit', name: 'Lucky Fletching', desc: '+3% chance of a 10x throw', base: 600, growth: 2.0, max: 20 },
  ];
  const SCRATCH_UPGRADES = [
    { id: 'luck', name: 'Toad Accountant', desc: '+5% win chance & payout', base: 40, growth: 1.6, max: 60 },
    { id: 'tier', name: 'Premium Printer', desc: 'Unlock the next, pricier ticket tier', base: 300, growth: 2.4, max: 5 },
    { id: 'auto', name: 'Scratch Robot', desc: 'Auto-scratch a ticket each second', base: 500, growth: 1.9, max: 100 },
    { id: 'jackpot', name: 'Loaded Dice', desc: '+50% jackpot size', base: 1500, growth: 2.1, max: 30 },
  ];
  const PACHINKO_UPGRADES = [
    { id: 'value', name: 'Heavier Balls', desc: '+1 base payout per drop', base: 200, growth: 1.55, max: 9999 },
    { id: 'mult', name: 'Golden Board', desc: '+25% pachinko multiplier', base: 900, growth: 1.7, max: 9999 },
    { id: 'pegs', name: 'Jackpot Pins', desc: '+4% chance of the 25x slot', base: 1200, growth: 2.0, max: 20 },
    { id: 'auto', name: 'Auto-Dropper', desc: '+1 auto-drop per second', base: 1500, growth: 1.85, max: 200 },
  ];
  const SUSHI_UPGRADES = [
    { id: 'value', name: 'Premium Fish', desc: '+1 base payout per plate', base: 500, growth: 1.55, max: 9999 },
    { id: 'combo', name: 'Master Chef', desc: '+30% combo size', base: 1500, growth: 1.7, max: 9999 },
    { id: 'fresh', name: 'Fresh Ingredients', desc: '+5% match chance', base: 800, growth: 1.6, max: 60 },
    { id: 'auto', name: 'Conveyor Belt', desc: '+1 auto-cook per second', base: 2000, growth: 1.9, max: 100 },
  ];
  const GACHA_UPGRADES = [
    { id: 'value', name: 'Bigger Pet Sales', desc: '+1 base pull value', base: 1000, growth: 1.55, max: 9999 },
    { id: 'mult', name: 'Shiny Charm', desc: '+25% pull value', base: 3000, growth: 1.7, max: 9999 },
    { id: 'luck', name: 'Rare Bait', desc: '+5% rare/epic/legendary odds', base: 2000, growth: 1.8, max: 40 },
    { id: 'auto', name: 'Auto-Puller', desc: '+1 auto-pull per second', base: 3000, growth: 1.9, max: 100 },
  ];
  const UPGRADE_SETS = {
    darts: DART_UPGRADES, scratch: SCRATCH_UPGRADES, pachinko: PACHINKO_UPGRADES, sushi: SUSHI_UPGRADES, gacha: GACHA_UPGRADES,
  };

  const TICKETS = [
    { name: 'Penny',   cost: 5,      maxWin: 25 },
    { name: 'Silver',  cost: 50,     maxWin: 300 },
    { name: 'Gold',    cost: 500,    maxWin: 4000 },
    { name: 'Diamond', cost: 5000,   maxWin: 60000 },
    { name: 'Mythic',  cost: 50000,  maxWin: 900000 },
  ];

  const GACHA_RARITIES = [
    { name: 'Common',    mult: 1,   cls: '' },
    { name: 'Rare',      mult: 6,   cls: 'good' },
    { name: 'Epic',      mult: 30,  cls: 'good' },
    { name: 'Legendary', mult: 150, cls: 'gold' },
  ];

  function prestigeMultiplier() { return 1 + 0.5 * auth.prestige; }
  function lvl(room, id) { return state[room].upgrades[id] || 0; }
  function costOf(def, level) { return Math.floor(def.base * Math.pow(def.growth, level)); }

  // ---- Synergy: every OTHER cleared room boosts a room's payouts by +20% ----
  function clearedCount() { return ALL_ROOMS.reduce((n, r) => n + (state[r].cleared ? 1 : 0), 0); }
  function synergyMult(room) {
    const others = clearedCount() - (state[room].cleared ? 1 : 0);
    return 1 + 0.2 * others;
  }

  // ---- Darts ----
  function dartValue() { return (1 + lvl('darts', 'value')) * (1 + 0.25 * lvl('darts', 'mult')) * synergyMult('darts'); }
  function dartCrit() { return 0.03 * lvl('darts', 'crit'); }
  function dartAuto() { return lvl('darts', 'auto'); }

  // ---- Scratchers ----
  function scratchLuck() { return 0.05 * lvl('scratch', 'luck'); }
  function unlockedTiers() { return Math.min(TICKETS.length, 1 + lvl('scratch', 'tier')); }
  function scratchAuto() { return lvl('scratch', 'auto'); }
  function jackpotMult() { return 1 + 0.5 * lvl('scratch', 'jackpot'); }

  // ---- Pachinko ----
  function pachinkoValue() { return (1 + lvl('pachinko', 'value')) * (1 + 0.25 * lvl('pachinko', 'mult')) * synergyMult('pachinko'); }
  function pachinkoLuck() { return 0.04 * lvl('pachinko', 'pegs'); }
  function pachinkoAuto() { return lvl('pachinko', 'auto'); }

  // ---- Sushi ----
  function sushiValue() { return (1 + lvl('sushi', 'value')) * (1 + 0.3 * lvl('sushi', 'combo')) * synergyMult('sushi'); }
  function sushiLuck() { return 0.05 * lvl('sushi', 'fresh'); }
  function sushiAuto() { return lvl('sushi', 'auto'); }

  // ---- Gacha ----
  function gachaValue() { return (1 + lvl('gacha', 'value')) * (1 + 0.25 * lvl('gacha', 'mult')) * synergyMult('gacha'); }
  function gachaLuck() { return 0.05 * lvl('gacha', 'luck'); }
  function gachaAuto() { return lvl('gacha', 'auto'); }

  function perSecond() {
    let s = 0;
    s += dartAuto() * dartValue() * (1 + dartCrit() * 9);
    const t = TICKETS[unlockedTiers() - 1];
    s += Math.max(0, scratchAuto() * (t.maxWin * (0.25 + scratchLuck()) * 0.5 * jackpotMult() - t.cost));
    s += pachinkoAuto() * pachinkoValue() * (2 + pachinkoLuck() * 25);
    s += sushiAuto() * sushiValue() * ((0.35 + sushiLuck()) * 2);
    s += gachaAuto() * gachaValue() * (1.5 + gachaLuck() * 30);
    return Math.max(0, s) * prestigeMultiplier();
  }

  // Combat stats reported to the server for PvP.
  function combat() {
    return {
      atk: Math.max(1, Math.round(dartValue() + 0.5 * pachinkoValue() + 0.4 * sushiValue())),
      luck: Math.round(dartCrit() * 100 + scratchLuck() * 50 + pachinkoLuck() * 60 + sushiLuck() * 50 + gachaLuck() * 60),
      hp: Math.max(100, Math.round(100 + Math.sqrt(state.lifetime) + 20 * clearedCount())),
    };
  }

  // ---- Formatting ----
  function money(n) {
    n = Math.floor(n);
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString();
  }

  const $ = (id) => document.getElementById(id);
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  function logTo(elId, text, cls) {
    const el = $(elId);
    if (!el) return;
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    el.appendChild(d);
    while (el.children.length > 60) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  function earn(amount) {
    const boosted = amount * prestigeMultiplier();
    state.gold += boosted;
    state.lifetime += boosted;
  }

  function checkClear(room) {
    const best = state[room].best;
    const pct = Math.min(100, (best / ROOM_GOAL) * 100);
    const bar = $(room + 'Goal');
    const txt = $(room + 'GoalText');
    if (bar) bar.style.width = pct.toFixed(1) + '%';
    if (txt) txt.textContent = state[room].cleared
      ? `CLEARED ✓  (best single payout: ${money(best)})`
      : `Best single payout: ${money(best)} / ${money(ROOM_GOAL)} to clear the room`;
    if (!state[room].cleared && best >= ROOM_GOAL) {
      state[room].cleared = true;
      toast(`🎉 ${ROOM_NAMES[room]} room CLEARED! Synergy boosts every room.`);
      updatePrestigeBtn();
    }
  }
  function checkAllClears() { ALL_ROOMS.forEach(checkClear); }

  // ---- Room actions ----
  function throwDart() {
    const crit = Math.random() < dartCrit();
    const accuracy = 0.4 + Math.random() * 0.6;
    let payout = Math.max(1, dartValue() * accuracy * (crit ? 10 : 1));
    earn(payout);
    state.darts.best = Math.max(state.darts.best, payout * prestigeMultiplier());
    logTo('dartsLog', `🎯 ${crit ? 'CRIT! ' : ''}Hit for ${money(payout * prestigeMultiplier())} (${Math.round(accuracy * 100)}% accuracy)`, crit ? 'good' : '');
    refreshTop(); checkClear('darts');
  }

  function scratchTicket() {
    const tierIdx = parseInt($('ticketTier').value, 10) || 0;
    const t = TICKETS[tierIdx];
    if (state.gold < t.cost) { toast(`Not enough gold for a ${t.name} ticket (${money(t.cost)}).`); return; }
    state.gold -= t.cost;
    const winChance = 0.25 + scratchLuck();
    if (Math.random() < winChance) {
      const jackpot = Math.random() < 0.04;
      let win = t.maxWin * (0.2 + Math.random() * 0.8);
      if (jackpot) win = t.maxWin * jackpotMult();
      win = Math.max(t.cost, Math.floor(win * synergyMult('scratch')));
      earn(win);
      state.scratch.best = Math.max(state.scratch.best, win * prestigeMultiplier());
      logTo('scratchLog', `🎟 ${jackpot ? '💰 JACKPOT! ' : ''}${t.name} won ${money(win * prestigeMultiplier())}`, jackpot ? 'good' : '');
    } else {
      logTo('scratchLog', `🎟 ${t.name} ticket — no win. (-${money(t.cost)})`, 'muted');
    }
    refreshTop(); checkClear('scratch');
  }

  function dropBall() {
    const jackpot = Math.random() < (0.02 + pachinkoLuck());
    let slot;
    if (jackpot) slot = 25;
    else slot = [0.3, 0.5, 1, 1, 2, 3, 5][Math.floor(Math.random() * 7)];
    let payout = Math.max(1, pachinkoValue() * slot);
    earn(payout);
    state.pachinko.best = Math.max(state.pachinko.best, payout * prestigeMultiplier());
    logTo('pachinkoLog', `🪙 ${jackpot ? '💥 25x JACKPOT SLOT! ' : ''}Ball landed ${slot}x → ${money(payout * prestigeMultiplier())}`, jackpot ? 'good' : '');
    refreshTop(); checkClear('pachinko');
  }

  function cookSushi() {
    const winChance = 0.35 + sushiLuck();
    if (Math.random() < winChance) {
      const perfect = Math.random() < 0.04;
      let payout = perfect ? sushiValue() * 15 : sushiValue() * (1 + Math.random() * 2);
      payout = Math.max(1, payout);
      earn(payout);
      state.sushi.best = Math.max(state.sushi.best, payout * prestigeMultiplier());
      logTo('sushiLog', `🍣 ${perfect ? '🌟 PERFECT COMBO! ' : 'Match! '}${money(payout * prestigeMultiplier())}`, perfect ? 'good' : '');
    } else {
      logTo('sushiLog', `🍣 No match this time…`, 'muted');
    }
    refreshTop(); checkClear('sushi');
  }

  function pullGacha() {
    const L = gachaLuck();
    const r = Math.random();
    let rarity;
    if (r < 0.005 + 0.15 * L) rarity = GACHA_RARITIES[3];
    else if (r < 0.03 + 0.30 * L) rarity = GACHA_RARITIES[2];
    else if (r < 0.15 + 0.30 * L) rarity = GACHA_RARITIES[1];
    else rarity = GACHA_RARITIES[0];
    let payout = Math.max(1, gachaValue() * rarity.mult * (1 + Math.random()));
    earn(payout);
    state.gacha.best = Math.max(state.gacha.best, payout * prestigeMultiplier());
    const big = rarity.mult >= 30;
    logTo('gachaLog', `🐾 Pulled a ${rarity.name} pet! +${money(payout * prestigeMultiplier())}`, rarity.cls);
    refreshTop(); checkClear('gacha');
  }

  // ---- Buying upgrades ----
  function buyUpgrade(room, def) {
    const level = lvl(room, def.id);
    if (level >= def.max) { toast('Maxed out.'); return; }
    const cost = costOf(def, level);
    if (state.gold < cost) { toast(`Need ${money(cost)} for ${def.name}.`); return; }
    state.gold -= cost;
    state[room].upgrades[def.id] = level + 1;
    renderUpgrades(); refreshTop();
  }

  function renderUpgrades() {
    ALL_ROOMS.forEach((room) => {
      const c = $(room + 'Upgrades');
      if (!c) return;
      c.innerHTML = '';
      UPGRADE_SETS[room].forEach((def) => {
        const level = lvl(room, def.id);
        const cost = costOf(def, level);
        const maxed = level >= def.max;
        const row = document.createElement('div');
        row.className = 'upgrade';
        row.innerHTML = `
          <div class="info">
            <div class="name">${def.name} <span class="pill">Lv ${level}</span></div>
            <div class="desc">${def.desc}</div>
          </div>
          <button class="act" ${maxed || state.gold < cost ? 'disabled' : ''}>
            ${maxed ? 'MAX' : money(cost)}
          </button>`;
        row.querySelector('button').addEventListener('click', () => buyUpgrade(room, def));
        c.appendChild(row);
      });
    });

    const sel = $('ticketTier');
    const prev = sel.value;
    sel.innerHTML = '';
    for (let i = 0; i < unlockedTiers(); i++) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${TICKETS[i].name} — cost ${money(TICKETS[i].cost)}, up to ${money(TICKETS[i].maxWin)}`;
      sel.appendChild(o);
    }
    if (prev && prev < unlockedTiers()) sel.value = prev;
  }

  function setText(id, v) { const el = $(id); if (el) el.textContent = v; }

  function refreshTop() {
    setText('netWorth', money(state.gold));
    setText('lifetime', money(state.lifetime));
    setText('perSec', money(perSecond()) + '/s');
    const c = combat();
    setText('power', Math.round(c.atk * 10 + c.luck * 5 + c.hp));

    setText('dartValue', money(dartValue() * prestigeMultiplier()));
    setText('dartAuto', dartAuto() + '/s');
    setText('scratchLuck', '+' + Math.round(scratchLuck() * 100) + '%');
    setText('scratchAuto', scratchAuto() + '/s');
    setText('pachinkoValue', money(pachinkoValue() * prestigeMultiplier()));
    setText('pachinkoAuto', pachinkoAuto() + '/s');
    setText('sushiValue', money(sushiValue() * prestigeMultiplier()));
    setText('sushiAuto', sushiAuto() + '/s');
    setText('gachaValue', money(gachaValue() * prestigeMultiplier()));
    setText('gachaAuto', gachaAuto() + '/s');

    setText('myAtk', c.atk);
    setText('myLuck', c.luck);
    setText('myHp', c.hp);

    renderUpgradesAffordability();
  }

  function renderUpgradesAffordability() {
    qsa('.upgrade').forEach((row) => {
      const btn = row.querySelector('button');
      if (!btn || btn.textContent.trim() === 'MAX') return;
      const cost = parseMoney(btn.textContent.trim());
      btn.disabled = state.gold < cost;
    });
  }
  function parseMoney(s) {
    s = s.replace('$', '');
    const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    const u = s.slice(-1);
    if (mult[u]) return parseFloat(s) * mult[u];
    return parseFloat(s.replace(/,/g, '')) || Infinity;
  }

  // ---- Game loop (automation) ----
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    let active = false;

    if (dartAuto() > 0) {
      const per = dartValue() * (1 + dartCrit() * 9);
      earn(dartAuto() * per * dt);
      state.darts.best = Math.max(state.darts.best, per * prestigeMultiplier());
      active = true;
    }
    if (scratchAuto() > 0) {
      const t = TICKETS[unlockedTiers() - 1];
      const ev = (t.maxWin * (0.25 + scratchLuck()) * 0.5 * jackpotMult() - t.cost) * synergyMult('scratch');
      earn(Math.max(0, scratchAuto() * ev * dt));
      state.scratch.best = Math.max(state.scratch.best, Math.max(0, ev) * prestigeMultiplier());
      active = true;
    }
    if (pachinkoAuto() > 0) {
      const per = pachinkoValue() * (2 + pachinkoLuck() * 25);
      earn(pachinkoAuto() * per * dt);
      state.pachinko.best = Math.max(state.pachinko.best, per * prestigeMultiplier());
      active = true;
    }
    if (sushiAuto() > 0) {
      const per = sushiValue() * ((0.35 + sushiLuck()) * 2);
      earn(sushiAuto() * per * dt);
      state.sushi.best = Math.max(state.sushi.best, per * prestigeMultiplier());
      active = true;
    }
    if (gachaAuto() > 0) {
      const per = gachaValue() * (1.5 + gachaLuck() * 30);
      earn(gachaAuto() * per * dt);
      state.gacha.best = Math.max(state.gacha.best, per * prestigeMultiplier());
      active = true;
    }
    if (active) { refreshTop(); checkAllClears(); }
  }

  // ---- Networking ----
  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function saveGame() {
    if (!auth.token) return;
    try {
      await api('/api/save', { token: auth.token, state, netWorth: state.gold, lifetime: state.lifetime, combat: combat() });
    } catch (e) { /* ignore transient save errors */ }
  }

  // ---- WebSocket (guild chat + duel pings) ----
  let ws = null;
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: auth.token }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'guild_chat') {
        logTo('guildChatLog', `[${new Date(m.ts).toLocaleTimeString()}] ${m.user}: ${m.text}`);
      } else if (m.type === 'duel') {
        toast(`⚔ ${m.from} dueled you — you ${m.won ? 'WON' : 'lost'}!`);
        m.log.forEach((l) => logTo('duelLog', l, m.won ? 'good' : 'bad'));
      }
    };
    ws.onclose = () => setTimeout(connectWS, 3000);
  }
  function sendChat(text) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'guild_chat', text })); }

  // ---- Prestige ----
  function canPrestige() { return ALL_ROOMS.every((r) => state[r].cleared); }
  function updatePrestigeBtn() {
    const btn = $('prestigeBtn');
    if (!btn) return;
    btn.disabled = !canPrestige();
    const left = ALL_ROOMS.filter((r) => !state[r].cleared).length;
    btn.title = canPrestige() ? 'Reset progress for a permanent +50% earnings multiplier' : `Clear all rooms first (${left} left)`;
  }
  async function doPrestige() {
    if (!canPrestige()) { toast('Clear all five rooms first!'); return; }
    if (!confirm(`Prestige #${auth.prestige + 1}? Your gold and upgrades reset, but you keep lifetime earnings, wins, and guilds. All future earnings get a +50% permanent boost (stacks).`)) return;
    await saveGame();
    try {
      const r = await api('/api/prestige', { token: auth.token, state });
      auth.prestige = r.prestige;
      state.gold = 0;
      ALL_ROOMS.forEach((room) => { state[room] = { cleared: false, best: 0, upgrades: {} }; });
      renderUpgrades(); refreshTop(); checkAllClears(); updatePrestigeBtn();
      setText('prestigeCount', auth.prestige);
      setText('prestigeMult', (prestigeMultiplier() * 100).toFixed(0) + '%');
      toast(`✨ Prestige #${auth.prestige}! Earnings multiplier is now ${(prestigeMultiplier() * 100).toFixed(0)}%.`);
    } catch (e) { toast(e.message); }
  }

  // ---- Daily reward ----
  function updateDailyBtn() {
    const btn = $('dailyBtn');
    if (!btn) return;
    const hoursSinceLast = (Date.now() - auth.lastClaim) / 3600000;
    if (hoursSinceLast >= 24) { btn.disabled = false; btn.textContent = '🎁 Claim Daily Reward'; }
    else { btn.disabled = true; btn.textContent = `🎁 Next reward in ~${Math.ceil(24 - hoursSinceLast)}h`; }
  }
  async function claimDaily() {
    try {
      const r = await api('/api/daily/claim', { token: auth.token });
      auth.lastClaim = Date.now();
      auth.dailyStreak = r.streak;
      earn(r.reward);
      refreshTop(); updateDailyBtn();
      setText('dailyStreak', r.streak);
      toast(`🎁 Day ${r.streak} reward: ${money(r.reward * prestigeMultiplier())}! (streak ×${(1 + (r.streak - 1) * 0.2).toFixed(1)})`);
    } catch (e) { toast(e.message); }
  }

  // ---- PvP UI ----
  async function loadOpponents() {
    try {
      const { players } = await api('/api/players');
      const tb = $('opponentList');
      tb.innerHTML = '';
      players.filter((p) => p.username !== auth.username).forEach((p) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.username}</td><td>${p.power}</td><td>${p.guild || '—'}</td>
          <td><button class="act">Duel</button></td>`;
        tr.querySelector('button').addEventListener('click', () => duel(p.username));
        tb.appendChild(tr);
      });
      if (tb.children.length === 0) tb.innerHTML = '<tr><td colspan="4" class="muted">No other players yet. Open a second tab and register another name to test duels.</td></tr>';
    } catch (e) { toast(e.message); }
  }
  async function duel(opponent) {
    await saveGame();
    try {
      const r = await api('/api/pvp/challenge', { token: auth.token, opponent });
      logTo('duelLog', `— Duel vs ${opponent} —`, '');
      r.log.forEach((l) => logTo('duelLog', l, ''));
      logTo('duelLog', r.youWon ? '✅ You won!' : '❌ You lost.', r.youWon ? 'good' : 'bad');
      toast(r.youWon ? `You beat ${opponent}!` : `You lost to ${opponent}.`);
      updateRecord();
    } catch (e) { toast(e.message); }
  }
  async function updateRecord() {
    try {
      const { players } = await api('/api/players');
      const me = players.find((p) => p.username === auth.username);
      if (me) setText('myRecord', `${me.wins || 0}W / ${me.losses || 0}L`);
    } catch {}
  }

  // ---- Guild UI ----
  async function loadGuilds() {
    try {
      const { guilds } = await api('/api/guilds');
      const tb = $('guildList');
      tb.innerHTML = '';
      guilds.forEach((g) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${g.name}</td><td>${g.members}</td><td class="gold">${money(g.treasure)}</td>
          <td><button class="act">Join</button></td>`;
        tr.querySelector('button').addEventListener('click', () => joinGuild(g.name));
        tb.appendChild(tr);
      });
      if (tb.children.length === 0) tb.innerHTML = '<tr><td colspan="4" class="muted">No guilds yet — found one!</td></tr>';
    } catch (e) { toast(e.message); }
  }
  async function createGuild() {
    const name = $('guildNameInput').value.trim();
    try { const { guild } = await api('/api/guild/create', { token: auth.token, name }); showGuild(guild); }
    catch (e) { $('guildMsg').textContent = e.message; }
  }
  async function joinGuild(name) {
    try { const { guild } = await api('/api/guild/join', { token: auth.token, name }); showGuild(guild); }
    catch (e) { toast(e.message); }
  }
  async function leaveGuild() {
    try { await api('/api/guild/leave', { token: auth.token }); $('inGuild').classList.add('hidden'); $('noGuild').classList.remove('hidden'); loadGuilds(); }
    catch (e) { toast(e.message); }
  }
  function showGuild(guild) {
    $('noGuild').classList.add('hidden');
    $('inGuild').classList.remove('hidden');
    setText('guildTitle', '🛡 ' + guild.name);
    setText('guildLeader', guild.leader);
    setText('guildTreasure', money(guild.treasure));
    const tb = $('guildMembers');
    tb.innerHTML = '';
    guild.members.forEach((m) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${m.username}</td><td>${money(m.lifetime)}</td><td>${m.power}</td>`;
      tb.appendChild(tr);
    });
    $('guildChatLog').innerHTML = '';
    (guild.chat || []).forEach((c) => logTo('guildChatLog', `[${new Date(c.ts).toLocaleTimeString()}] ${c.user}: ${c.text}`));
  }
  async function refreshGuildIfMember() {
    try {
      const me = await api('/api/login', { username: auth.username, password: '' });
      if (me.guild) { const { guild } = await api('/api/guild/' + encodeURIComponent(me.guild)); showGuild(guild); }
    } catch {}
  }

  // ---- Leaderboard ----
  async function loadBoard() {
    try {
      const { players } = await api('/api/leaderboard');
      const tb = $('boardList');
      tb.innerHTML = '';
      players.forEach((p, i) => {
        const tr = document.createElement('tr');
        const star = '✨'.repeat(p.prestige || 0).slice(0, 14) || '—';
        tr.innerHTML = `<td>${i + 1}</td><td>${p.username}</td><td class="gold">${money(p.lifetime)}</td>
          <td>${money(p.netWorth)}</td><td>${p.guild || '—'}</td><td>${p.wins || 0}W/${p.losses || 0}L</td><td title="${p.prestige || 0} prestige(s)">${star}</td>`;
        tb.appendChild(tr);
      });
    } catch (e) { toast(e.message); }
  }

  // ---- Tabs ----
  function setupTabs() {
    qsa('nav.tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        qsa('nav.tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        qsa('section[data-view]').forEach((s) => s.classList.toggle('hidden', s.dataset.view !== tab));
        if (tab === 'pvp') { loadOpponents(); updateRecord(); }
        if (tab === 'guild') { loadGuilds(); refreshGuildIfMember(); }
        if (tab === 'board') loadBoard();
      });
    });
  }

  // ---- Boot ----
  function startGame() {
    $('loginView').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('who').innerHTML = `Playing as <b>${auth.username}</b>`;
    setText('prestigeCount', auth.prestige);
    setText('prestigeMult', (prestigeMultiplier() * 100).toFixed(0) + '%');
    setText('dailyStreak', auth.dailyStreak);
    renderUpgrades(); refreshTop(); checkAllClears();
    updatePrestigeBtn(); updateDailyBtn();
    setInterval(updateDailyBtn, 60000);
    connectWS();
    setInterval(tick, 200);
    setInterval(saveGame, 5000);
    window.addEventListener('beforeunload', saveGame);
  }

  function loadState(blob) {
    if (!blob) return;
    try {
      const s = typeof blob === 'string' ? JSON.parse(blob) : blob;
      if (typeof s.gold === 'number') state.gold = s.gold;
      if (typeof s.lifetime === 'number') state.lifetime = s.lifetime;
      ALL_ROOMS.forEach((room) => {
        state[room] = Object.assign({ cleared: false, best: 0, upgrades: {} }, s[room]);
      });
    } catch {}
  }

  async function register() {
    const username = $('usernameInput').value.trim();
    const password = $('passwordInput') ? $('passwordInput').value : '';
    try {
      const r = await api('/api/register', { username, password });
      auth = { username: r.username, token: r.token, prestige: r.prestige || 0, dailyStreak: r.dailyStreak || 0, lastClaim: r.lastClaim || 0 };
      loadState(r.state);
      startGame();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }
  async function login() {
    const username = $('usernameInput').value.trim();
    const password = $('passwordInput') ? $('passwordInput').value : '';
    try {
      const r = await api('/api/login', { username, password });
      auth = { username: r.username, token: r.token, prestige: r.prestige || 0, dailyStreak: r.dailyStreak || 0, lastClaim: r.lastClaim || 0 };
      loadState(r.state);
      startGame();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  async function loadConfig() {
    try {
      const cfg = await api('/api/config');
      passwordRequired = !!cfg.passwordRequired;
      const field = $('passwordField');
      if (field) field.style.display = passwordRequired ? 'block' : 'none';
    } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadConfig();
    $('registerBtn').addEventListener('click', register);
    $('loginBtn').addEventListener('click', login);
    $('usernameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') register(); });

    $('throwBtn').addEventListener('click', throwDart);
    $('scratchBtn').addEventListener('click', scratchTicket);
    $('dropBtn').addEventListener('click', dropBall);
    $('cookBtn').addEventListener('click', cookSushi);
    $('pullBtn').addEventListener('click', pullGacha);
    $('prestigeBtn').addEventListener('click', doPrestige);
    $('dailyBtn').addEventListener('click', claimDaily);
    $('refreshPlayers').addEventListener('click', loadOpponents);
    $('refreshGuilds').addEventListener('click', loadGuilds);
    $('refreshBoard').addEventListener('click', loadBoard);
    $('createGuildBtn').addEventListener('click', createGuild);
    $('leaveGuildBtn').addEventListener('click', leaveGuild);
    $('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) { sendChat(e.target.value.trim()); e.target.value = ''; }
    });

    // Spacebar acts on whichever click-room tab is active.
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || $('app').classList.contains('hidden')) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const map = { darts: throwDart, pachinko: dropBall, sushi: cookSushi, gacha: pullGacha };
      for (const room of Object.keys(map)) {
        const sec = qs(`section[data-view="${room}"]`);
        if (sec && !sec.classList.contains('hidden')) { e.preventDefault(); map[room](); return; }
      }
    });
  });
})();
