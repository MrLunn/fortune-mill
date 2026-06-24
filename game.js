/* Fortune Mill — text edition (client engine)
 * Two rooms (Darts, Scratchers), upgrades, automation, cross-room synergy,
 * plus PvP duels and guild networking against the Node server.
 */
(() => {
  'use strict';

  const ROOM_GOAL = 1_000_000;

  // ---- Game state (the bit we persist) ----
  const state = {
    gold: 0,            // current spendable net worth
    lifetime: 0,        // total ever earned (for leaderboard)
    darts: { cleared: false, best: 0, upgrades: {} },
    scratch: { cleared: false, best: 0, upgrades: {} },
  };

  let auth = { username: null, token: null };

  // ---- Upgrade definitions ----
  // cost grows geometrically per level. effect() returns derived numbers.
  const DART_UPGRADES = [
    { id: 'value', name: 'Sharper Tips', desc: '+1 base gold per throw (×1.6/lvl)', base: 15, growth: 1.55, max: 9999 },
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

  const TICKETS = [
    { name: 'Penny',   cost: 5,      maxWin: 25 },
    { name: 'Silver',  cost: 50,     maxWin: 300 },
    { name: 'Gold',    cost: 500,    maxWin: 4000 },
    { name: 'Diamond', cost: 5000,   maxWin: 60000 },
    { name: 'Mythic',  cost: 50000,  maxWin: 900000 },
  ];

  function lvl(room, id) { return state[room].upgrades[id] || 0; }
  function costOf(def, level) { return Math.floor(def.base * Math.pow(def.growth, level)); }

  // ---- Derived stats (with cross-room synergy) ----
  function dartBase() { return 1 + lvl('darts', 'value'); }
  function dartMult() {
    const own = 1 + 0.25 * lvl('darts', 'mult');
    // Synergy: clearing the scratch room boosts dart gold by 50%.
    const synergy = state.scratch.cleared ? 1.5 : 1;
    return own * synergy;
  }
  function dartValue() { return dartBase() * dartMult(); }
  function dartCrit() { return 0.03 * lvl('darts', 'crit'); }
  function dartAuto() { return lvl('darts', 'auto'); }

  function scratchLuck() {
    // each level = +5%, synergy: cleared darts adds +20%.
    return 0.05 * lvl('scratch', 'luck') + (state.darts.cleared ? 0.2 : 0);
  }
  function unlockedTiers() { return Math.min(TICKETS.length, 1 + lvl('scratch', 'tier')); }
  function scratchAuto() { return lvl('scratch', 'auto'); }
  function jackpotMult() { return 1 + 0.5 * lvl('scratch', 'jackpot'); }

  function perSecond() {
    const fromDarts = dartAuto() * dartValue() * (1 + dartCrit() * 9);
    // approximate auto-scratch EV on the best unlocked tier
    const t = TICKETS[unlockedTiers() - 1];
    const ev = scratchAuto() * (t.maxWin * (0.25 + scratchLuck()) * 0.5 * jackpotMult() - t.cost);
    return Math.max(0, fromDarts + ev);
  }

  // Combat stats reported to the server for PvP.
  function combat() {
    return {
      atk: Math.max(1, Math.round(dartValue())),
      luck: Math.round((dartCrit() * 100) + (scratchLuck() * 50)),
      hp: Math.max(100, Math.round(100 + Math.sqrt(state.lifetime))),
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

  // ---- DOM helpers ----
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

  // ---- Earning ----
  function earn(amount) {
    state.gold += amount;
    state.lifetime += amount;
  }

  function checkClear(room, goalDivId, goalTextId) {
    const best = state[room].best;
    const pct = Math.min(100, (best / ROOM_GOAL) * 100);
    $(goalDivId).style.width = pct.toFixed(1) + '%';
    $(goalTextId).textContent = state[room].cleared
      ? `CLEARED ✓  (best single payout: ${money(best)})`
      : `Best single payout: ${money(best)} / ${money(ROOM_GOAL)} to clear the room`;
    if (!state[room].cleared && best >= ROOM_GOAL) {
      state[room].cleared = true;
      toast(`🎉 ${room === 'darts' ? 'Dart' : 'Scratcher'} room CLEARED! Synergy bonus unlocked.`);
    }
  }

  // ---- Darts actions ----
  function throwDart() {
    const crit = Math.random() < dartCrit();
    const accuracy = 0.4 + Math.random() * 0.6; // 40%-100%
    let payout = dartValue() * accuracy * (crit ? 10 : 1);
    payout = Math.max(1, payout);
    earn(payout);
    state.darts.best = Math.max(state.darts.best, payout);
    logTo('dartsLog', `🎯 ${crit ? 'CRIT! ' : ''}Hit for ${money(payout)} (${Math.round(accuracy * 100)}% accuracy)`, crit ? 'good' : '');
    refreshTop();
    checkClear('darts', 'dartsGoal', 'dartsGoalText');
  }

  // ---- Scratch actions ----
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
      win = Math.max(t.cost, Math.floor(win));
      earn(win);
      state.scratch.best = Math.max(state.scratch.best, win);
      logTo('scratchLog', `🎟 ${jackpot ? '💰 JACKPOT! ' : ''}${t.name} ticket won ${money(win)}`, jackpot ? 'good' : '');
    } else {
      logTo('scratchLog', `🎟 ${t.name} ticket — no win. (-${money(t.cost)})`, 'muted');
    }
    refreshTop();
    checkClear('scratch', 'scratchGoal', 'scratchGoalText');
  }

  // ---- Buying upgrades ----
  function buyUpgrade(room, def) {
    const level = lvl(room, def.id);
    if (level >= def.max) { toast('Maxed out.'); return; }
    const cost = costOf(def, level);
    if (state.gold < cost) { toast(`Need ${money(cost)} for ${def.name}.`); return; }
    state.gold -= cost;
    state[room].upgrades[def.id] = level + 1;
    renderUpgrades();
    refreshTop();
  }

  function renderUpgrades() {
    const render = (room, defs, containerId) => {
      const c = $(containerId);
      c.innerHTML = '';
      defs.forEach((def) => {
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
    };
    render('darts', DART_UPGRADES, 'dartsUpgrades');
    render('scratch', SCRATCH_UPGRADES, 'scratchUpgrades');

    // ticket tier dropdown
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

  // ---- Top bar / per-room readouts ----
  function refreshTop() {
    $('netWorth').textContent = money(state.gold);
    $('lifetime').textContent = money(state.lifetime);
    $('perSec').textContent = money(perSecond()) + '/s';
    const c = combat();
    $('power').textContent = Math.round(c.atk * 10 + c.luck * 5 + c.hp);

    $('dartValue').textContent = money(dartValue());
    $('dartAuto').textContent = dartAuto() + '/s';
    $('scratchLuck').textContent = '+' + Math.round(scratchLuck() * 100) + '%';
    $('scratchAuto').textContent = scratchAuto() + '/s';

    // pvp readout
    $('myAtk').textContent = c.atk;
    $('myLuck').textContent = c.luck;
    $('myHp').textContent = c.hp;

    renderUpgradesAffordability();
  }

  // light refresh of just the disabled state on upgrade buttons
  function renderUpgradesAffordability() {
    qsa('#dartsUpgrades .upgrade, #scratchUpgrades .upgrade').forEach((row) => {
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

    // auto darts
    const a = dartAuto();
    if (a > 0) {
      const gain = a * dartValue() * (1 + dartCrit() * 9) * dt;
      earn(gain);
      state.darts.best = Math.max(state.darts.best, dartValue() * (1 + dartCrit() * 9));
    }
    // auto scratch
    const s = scratchAuto();
    if (s > 0) {
      const t = TICKETS[unlockedTiers() - 1];
      const ev = (t.maxWin * (0.25 + scratchLuck()) * 0.5 * jackpotMult() - t.cost);
      earn(Math.max(0, s * ev * dt));
    }
    if (a > 0 || s > 0) {
      refreshTop();
      checkClear('darts', 'dartsGoal', 'dartsGoalText');
      checkClear('scratch', 'scratchGoal', 'scratchGoalText');
    }
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
      await api('/api/save', {
        token: auth.token,
        state,
        netWorth: state.gold,
        lifetime: state.lifetime,
        combat: combat(),
      });
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
    ws.onclose = () => setTimeout(connectWS, 3000); // auto-reconnect
  }

  function sendChat(text) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'guild_chat', text }));
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
      if (tb.children.length === 0) tb.innerHTML = '<tr><td colspan="4" class="muted">No other players yet. Open a second browser tab and register another name to test duels.</td></tr>';
    } catch (e) { toast(e.message); }
  }

  async function duel(opponent) {
    await saveGame(); // make sure our stats are fresh on the server
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
      if (me) $('myRecord').textContent = `${me.wins || 0}W / ${me.losses || 0}L`;
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
    try {
      const { guild } = await api('/api/guild/create', { token: auth.token, name });
      showGuild(guild);
    } catch (e) { $('guildMsg').textContent = e.message; }
  }

  async function joinGuild(name) {
    try {
      const { guild } = await api('/api/guild/join', { token: auth.token, name });
      showGuild(guild);
    } catch (e) { toast(e.message); }
  }

  async function leaveGuild() {
    try {
      await api('/api/guild/leave', { token: auth.token });
      $('inGuild').classList.add('hidden');
      $('noGuild').classList.remove('hidden');
      loadGuilds();
    } catch (e) { toast(e.message); }
  }

  function showGuild(guild) {
    $('noGuild').classList.add('hidden');
    $('inGuild').classList.remove('hidden');
    $('guildTitle').textContent = '🛡 ' + guild.name;
    $('guildLeader').textContent = guild.leader;
    $('guildTreasure').textContent = money(guild.treasure);
    const tb = $('guildMembers');
    tb.innerHTML = '';
    guild.members.forEach((m) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${m.username}</td><td>${money(m.lifetime)}</td><td>${m.power}</td>`;
      tb.appendChild(tr);
    });
    const log = $('guildChatLog');
    log.innerHTML = '';
    (guild.chat || []).forEach((c) => logTo('guildChatLog', `[${new Date(c.ts).toLocaleTimeString()}] ${c.user}: ${c.text}`));
  }

  async function refreshGuildIfMember() {
    try {
      const me = await api('/api/login', { username: auth.username });
      if (me.guild) {
        const { guild } = await api('/api/guild/' + encodeURIComponent(me.guild));
        showGuild(guild);
      }
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
        tr.innerHTML = `<td>${i + 1}</td><td>${p.username}</td><td class="gold">${money(p.lifetime)}</td>
          <td>${money(p.netWorth)}</td><td>${p.guild || '—'}</td><td>${p.wins || 0}W/${p.losses || 0}L</td>`;
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
    renderUpgrades();
    refreshTop();
    checkClear('darts', 'dartsGoal', 'dartsGoalText');
    checkClear('scratch', 'scratchGoal', 'scratchGoalText');
    connectWS();
    setInterval(tick, 200);
    setInterval(saveGame, 5000);
    window.addEventListener('beforeunload', saveGame);
  }

  function loadState(blob) {
    if (!blob) return;
    try {
      const s = typeof blob === 'string' ? JSON.parse(blob) : blob;
      Object.assign(state, s);
      state.darts = Object.assign({ cleared: false, best: 0, upgrades: {} }, s.darts);
      state.scratch = Object.assign({ cleared: false, best: 0, upgrades: {} }, s.scratch);
    } catch {}
  }

  async function register() {
    const username = $('usernameInput').value.trim();
    try {
      const r = await api('/api/register', { username });
      auth = { username: r.username, token: r.token };
      loadState(r.state);
      startGame();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  async function login() {
    const username = $('usernameInput').value.trim();
    try {
      const r = await api('/api/login', { username });
      auth = { username: r.username, token: r.token };
      loadState(r.state);
      startGame();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  // ---- Wire up events ----
  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    $('registerBtn').addEventListener('click', register);
    $('loginBtn').addEventListener('click', login);
    $('usernameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') register(); });

    $('throwBtn').addEventListener('click', throwDart);
    $('scratchBtn').addEventListener('click', scratchTicket);
    $('refreshPlayers').addEventListener('click', loadOpponents);
    $('refreshGuilds').addEventListener('click', loadGuilds);
    $('refreshBoard').addEventListener('click', loadBoard);
    $('createGuildBtn').addEventListener('click', createGuild);
    $('leaveGuildBtn').addEventListener('click', leaveGuild);
    $('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) { sendChat(e.target.value.trim()); e.target.value = ''; }
    });

    // Spacebar throws a dart when the darts tab is active.
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !$('app').classList.contains('hidden')) {
        const dartsActive = !qs('section[data-view="darts"]').classList.contains('hidden');
        const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (dartsActive && !typing) { e.preventDefault(); throwDart(); }
      }
    });
  });
})();
