/* Fortune Mill — client engine
 * Rooms: Darts, Scratchers, Slots, Pachinko, Sushi, Gacha.
 * Plus PvP, Guilds, Prestige, Challenges, XP, achievements, focus, music, animations.
 */
(() => {
  'use strict';

  const ROOM_GOAL = 1_000_000;
  const NEW_ROOMS = ['pachinko', 'sushi', 'gacha'];
  const ALL_ROOMS = ['darts', 'scratch', 'slots', 'pachinko', 'sushi', 'gacha'];
  const ROOM_LABEL = { darts:'Axe', scratch:'Rune', slots:'Reel', pachinko:'Boulder', sushi:'Feast', gacha:'Beast' };
  const BOSS = {
    darts:   { name:'Draugr Raider',   emoji:'🧟', hp: 120000 },
    scratch: { name:'Rune Wraith',     emoji:'👻', hp: 900000 },
    slots:   { name:'Fafnir the Wyrm', emoji:'🐲', hp: 7000000 },
    pachinko:{ name:'Stone Jötunn',    emoji:'🗿', hp: 45000000 },
    sushi:   { name:'Glutton Troll',   emoji:'👹', hp: 280000000 },
    gacha:   { name:'Warden of Hel',   emoji:'💀', hp: 1800000000 },
  };
  const FINAL_BOSS = { name:'Jörmungandr', emoji:'🐉', hp: 25000000000 };
  const MASTERY_BASE = { darts:50000, scratch:300000, slots:2000000, pachinko:10000000, sushi:50000000, gacha:200000000 };

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    gold: 0, lifetime: 0,
    darts:   { cleared: false, best: 0, upgrades: {} },
    scratch: { cleared: false, best: 0, upgrades: {} },
    slots:   { cleared: false, best: 0, upgrades: {} },
    pachinko:{ cleared: false, best: 0, upgrades: {} },
    sushi:   { cleared: false, best: 0, upgrades: {} },
    gacha:   { cleared: false, best: 0, upgrades: {} },
    crits: 0, scratchWins: 0, jackpots: 0,
    slotWins: 0, slotJackpots: 0,
    xp: 0, level: 1, maxCombo: 0,
    luckyHours: 0, spins: 0,
    achievements: [], milestones: [],
    lastSaveTime: 0, lastSpin: 0,
    focus: 0,
    challenges: null,
    challengeDate: '',
    challengeProgress: {},
    todayEarned: 0, todayDate: '',
    throwCount: 0,
    finalBossHp: 25000000000, finalBossDefeated: false,
  };
  ALL_ROOMS.forEach(r => { state[r].bossHp = BOSS[r].hp; state[r].coins = 0; });

  let auth = { username: null, token: null, prestige: 0, dailyStreak: 0, lastClaim: 0 };
  let passwordRequired = false;

  // ── Upgrade definitions ────────────────────────────────────────────────────
  const DART_UPGRADES = [
    { id:'value', name:'Sharper Tips',         desc:'+1 base gold/throw (×1.6/lvl)',    base:15,   growth:1.55, max:9999 },
    { id:'mult',  name:'Bullseye Training',    desc:'+25% dart gold multiplier',         base:120,  growth:1.7,  max:9999 },
    { id:'auto',  name:'Machine-Gun Mouse',    desc:'+1 auto-throw per second',          base:250,  growth:1.85, max:200  },
    { id:'crit',  name:'Lucky Fletching',      desc:'+3% crit chance (10× payout)',     base:600,  growth:2.0,  max:20   },
  ];
  const DART_ELITE = [
    { id:'elite_power',  name:'Tungsten Core',    desc:'+50% dart base value',           base:50000, growth:2.0,  max:10, prestige:2 },
    { id:'elite_combo',  name:'Flow State',        desc:'Combo decay slows by 20%/level', base:80000, growth:2.2,  max:5,  prestige:2 },
  ];

  const SCRATCH_UPGRADES = [
    { id:'luck',    name:'Toad Accountant',  desc:'+5% win chance & payout',     base:40,   growth:1.6,  max:60  },
    { id:'tier',    name:'Premium Printer',  desc:'Unlock the next ticket tier',  base:300,  growth:2.4,  max:5   },
    { id:'auto',    name:'Scratch Robot',    desc:'+1 auto-scratch per second',   base:500,  growth:1.9,  max:100 },
    { id:'jackpot', name:'Loaded Dice',      desc:'+50% jackpot payout size',     base:1500, growth:2.1,  max:30  },
  ];
  const SCRATCH_ELITE = [
    { id:'elite_luck', name:'Rabbit\'s Foot', desc:'+10% jackpot chance/level',   base:60000, growth:2.1,  max:10, prestige:2 },
  ];

  const SLOT_UPGRADES = [
    { id:'luck',    name:'Lucky Roller',    desc:'+4% reel-match chance/level',   base:100,   growth:1.65, max:40  },
    { id:'mult',    name:'Golden Reels',    desc:'+20% payout multiplier/level',  base:400,   growth:1.8,  max:20  },
    { id:'auto',    name:'Auto Spinner',    desc:'+1 auto-spin per second',       base:800,   growth:1.95, max:50  },
    { id:'jackpot', name:'Diamond Polish',  desc:'+100% jackpot size/level',      base:2000,  growth:2.2,  max:15  },
  ];

  const PACHINKO_UPGRADES = [
    { id:'value', name:'Heavier Balls',  desc:'+1 base payout per drop',       base:200,  growth:1.55, max:9999 },
    { id:'mult',  name:'Golden Board',   desc:'+25% pachinko multiplier',       base:900,  growth:1.7,  max:9999 },
    { id:'pegs',  name:'Jackpot Pins',   desc:'+4% chance of the 25× slot',     base:1200, growth:2.0,  max:20   },
    { id:'auto',  name:'Auto-Dropper',   desc:'+1 auto-drop per second',        base:1500, growth:1.85, max:200  },
  ];
  const SUSHI_UPGRADES = [
    { id:'value', name:'Premium Fish',   desc:'+1 base payout per plate',       base:500,  growth:1.55, max:9999 },
    { id:'combo', name:'Master Chef',    desc:'+30% combo size',                base:1500, growth:1.7,  max:9999 },
    { id:'fresh', name:'Fresh Catch',    desc:'+5% match chance',               base:800,  growth:1.6,  max:60   },
    { id:'auto',  name:'Conveyor Belt',  desc:'+1 auto-cook per second',        base:2000, growth:1.9,  max:100  },
  ];
  const GACHA_UPGRADES = [
    { id:'value', name:'Bigger Pet Sales', desc:'+1 base pull value',           base:1000, growth:1.55, max:9999 },
    { id:'mult',  name:'Shiny Charm',      desc:'+25% pull value',              base:3000, growth:1.7,  max:9999 },
    { id:'luck',  name:'Rare Bait',        desc:'+5% rare/epic/legendary odds', base:2000, growth:1.8,  max:40   },
    { id:'auto',  name:'Auto-Puller',      desc:'+1 auto-pull per second',      base:3000, growth:1.9,  max:100  },
  ];

  const TICKETS = [
    { name:'ᚠ Fehu',   cost:5,      maxWin:25      },
    { name:'ᚢ Uruz',   cost:50,     maxWin:300     },
    { name:'ᚦ Thurs',  cost:500,    maxWin:4000    },
    { name:'ᚨ Ansuz',  cost:5000,   maxWin:60000   },
    { name:'ᚱ Raido',  cost:50000,  maxWin:900000  },
  ];

  const SLOT_SYMBOLS  = ['🍒','🍋','🍇','⭐','🎯','💰','💎'];
  const SLOT_WEIGHTS  = [30,25,20,12,6,4,3];
  const SLOT_PAY3     = { '🍒':3,'🍋':4,'🍇':6,'⭐':12,'🎯':25,'💰':60,'💎':250 };
  const SLOT_BETS     = [
    { name:'Bronze',   cost:20      },
    { name:'Silver',   cost:200     },
    { name:'Gold',     cost:2000    },
    { name:'Platinum', cost:20000   },
    { name:'Diamond',  cost:200000  },
  ];

  const GACHA_RARITIES = [
    { name:'Wolf',   mult:1,   cls:''     },
    { name:'Raven',  mult:6,   cls:'good' },
    { name:'Bear',   mult:30,  cls:'good' },
    { name:'Dragon', mult:150, cls:'gold' },
  ];

  // ── Daily challenges ───────────────────────────────────────────────────────
  const CH_TYPES = [
    { id:'throw_count',  icon:'🎯', name:'Dart Marathon',    desc:n=>`Throw ${n} darts`,           targets:[50,150,400,1000], reward:n=>n*12,     xpReward:n=>n     },
    { id:'crits',        icon:'💥', name:'Critical Striker', desc:n=>`Land ${n} critical throws`,  targets:[5,20,40,75],     reward:n=>n*200,    xpReward:n=>n*3   },
    { id:'todayEarned',  icon:'💰', name:'Gold Rush',        desc:n=>`Earn ${money(n)} today`,     targets:[5e3,5e4,5e5,5e6],reward:n=>n*0.15,   xpReward:_=>50    },
    { id:'scratchWins',  icon:'🎟', name:'Lucky Scratcher',  desc:n=>`Win ${n} scratch tickets`,   targets:[5,15,35,70],     reward:n=>n*250,    xpReward:n=>n*4   },
    { id:'jackpots',     icon:'💎', name:'Jackpot Hunter',   desc:n=>`Hit ${n} jackpots`,          targets:[1,3,7,15],       reward:n=>n*12000,  xpReward:n=>n*25  },
    { id:'slotWins',     icon:'🎰', name:'Slot Star',        desc:n=>`Win ${n} slot spins`,        targets:[5,20,50,100],    reward:n=>n*400,    xpReward:n=>n*6   },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  function money(n) {
    n = Math.floor(n);
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return '$' + (n/1e9).toFixed(2)  + 'B';
    if (n >= 1e6)  return '$' + (n/1e6).toFixed(2)  + 'M';
    if (n >= 1e3)  return '$' + (n/1e3).toFixed(1)  + 'K';
    return '$' + n.toLocaleString();
  }

  const $   = id => document.getElementById(id);
  const qs  = s  => document.querySelector(s);
  const qsa = s  => Array.from(document.querySelectorAll(s));

  // Safe wrappers so the new rooms work even if a global isn't present.
  const AnimFloat = (txt, el, color) => { try { if (typeof Anim !== 'undefined' && Anim.floatFromEl && el) Anim.floatFromEl(txt, el, color); } catch {} };
  const SFX = (name, arg) => { try { if (typeof Music !== 'undefined' && Music[name]) Music[name](arg); } catch {} };

  function logTo(elId, text, cls) {
    const el = $(elId); if (!el) return;
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    el.appendChild(d);
    while (el.children.length > 80) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3800);
  }

  function weightedRandom(arr, weights) {
    const total = weights.reduce((a,b)=>a+b,0);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length-1];
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  function prestigeMultiplier() { return 1 + 0.5 * auth.prestige; }
  function lvl(room, id)       { return state[room]?.upgrades?.[id] || 0; }
  function costOf(def, lv)     { return Math.floor(def.base * Math.pow(def.growth, lv)); }

  function dartBase()  { return 1 + lvl('darts','value') + lvl('darts','elite_power') * 0.5 * (1 + lvl('darts','value')); }
  function dartMult()  {
    const own     = 1 + 0.25 * lvl('darts','mult');
    const synergy = state.scratch.cleared ? 1.5 : 1;
    return own * synergy;
  }
  function dartValue() { return dartBase() * dartMult(); }
  function dartCrit()  { return 0.03 * lvl('darts','crit'); }
  function dartAuto()  { return lvl('darts','auto'); }

  function scratchLuck()    { return 0.05 * lvl('scratch','luck') + (state.darts.cleared ? 0.2 : 0) + lvl('scratch','elite_luck') * 0.10; }
  function unlockedTiers()  { return Math.min(TICKETS.length, 1 + lvl('scratch','tier')); }
  function scratchAuto()    { return lvl('scratch','auto'); }
  function jackpotMult()    { return 1 + 0.5 * lvl('scratch','jackpot'); }

  function slotLuck()       { return 0.04 * lvl('slots','luck'); }
  function slotMult()       { return 1 + 0.20 * lvl('slots','mult'); }
  function slotAuto()       { return lvl('slots','auto'); }
  function slotJackpotMult(){ return 1 + 1.0  * lvl('slots','jackpot'); }
  function unlockedBets()   { return Math.min(SLOT_BETS.length, 1 + Math.floor(lvl('slots','mult') / 2)); }

  // New-room synergy: +15% per OTHER cleared room (any of the six).
  function clearedCount()   { return ALL_ROOMS.reduce((n,r)=> n + (state[r].cleared ? 1 : 0), 0); }
  function newSynergy(room) { return 1 + 0.15 * (clearedCount() - (state[room].cleared ? 1 : 0)); }

  function pachinkoValue()  { return (1 + lvl('pachinko','value')) * (1 + 0.25*lvl('pachinko','mult')) * newSynergy('pachinko'); }
  function pachinkoLuck()   { return 0.04 * lvl('pachinko','pegs'); }
  function pachinkoAuto()   { return lvl('pachinko','auto'); }

  function sushiValue()     { return (1 + lvl('sushi','value')) * (1 + 0.30*lvl('sushi','combo')) * newSynergy('sushi'); }
  function sushiLuck()      { return 0.05 * lvl('sushi','fresh'); }
  function sushiAuto()      { return lvl('sushi','auto'); }

  function gachaValue()     { return (1 + lvl('gacha','value')) * (1 + 0.25*lvl('gacha','mult')) * newSynergy('gacha'); }
  function gachaLuck()      { return 0.05 * lvl('gacha','luck'); }
  function gachaAuto()      { return lvl('gacha','auto'); }

  function focusBonus() {
    const f = state.focus || 0;
    if (f >= 75) return 0.60;
    if (f >= 50) return 0.30;
    if (f >= 25) return 0.15;
    return 0;
  }

  function getGuildBuff() {
    const t = auth._guildTreasure || 0;
    if (t >= 1e9)  return { label:'Guild Master Buff: +25% all earnings', mult:1.25 };
    if (t >= 1e6)  return { label:'Guild Buff: +10% all earnings', mult:1.10 };
    if (t >= 1e3)  return { label:'Fledgling Buff: +5% all earnings', mult:1.05 };
    return null;
  }

  function perSecond() {
    const fromDarts = dartAuto() * dartValue() * (1 + dartCrit() * 9);
    const t  = TICKETS[unlockedTiers()-1];
    const ev = scratchAuto() * (t.maxWin * (0.25 + scratchLuck()) * 0.5 * jackpotMult());
    const sb = SLOT_BETS[Math.max(0, unlockedBets()-1)];
    const slotEv = slotAuto() * (sb.cost * 0.64 * slotMult() * (1 + slotLuck()));
    const pac = pachinkoAuto() * pachinkoValue() * (2 + pachinkoLuck()*25);
    const sus = sushiAuto()    * sushiValue()    * ((0.35 + sushiLuck())*2);
    const gac = gachaAuto()    * gachaValue()    * (1.5 + gachaLuck()*30);
    return Math.max(0, fromDarts + ev + slotEv + pac + sus + gac);
  }

  function combat() {
    const pm = prestigeMultiplier();
    return {
      atk:  Math.max(1, Math.round((dartValue() + 0.5*pachinkoValue() + 0.4*sushiValue()) * pm)),
      luck: Math.round(dartCrit()*100 + scratchLuck()*50 + pachinkoLuck()*60 + sushiLuck()*50 + gachaLuck()*60) + auth.prestige*4,
      hp:   Math.max(100, Math.round((100 + Math.sqrt(state.lifetime) + 20*clearedCount()) * pm + auth.prestige*150)),
    };
  }

  // ── Earning ────────────────────────────────────────────────────────────────
  // ── Earning: each room keeps its OWN purse (coins). Rewards spread across
  // unlocked rooms. Multipliers (prestige/mastery/combo/etc) apply to all gains.
  function applyGain(amount) {
    const comboM = typeof Dopamine !== 'undefined' ? Dopamine.getComboMult()        : 1;
    const luckyM = typeof Dopamine !== 'undefined' && Dopamine.isLucky()            ? 2 : 1;
    const levelM = typeof Dopamine !== 'undefined' ? Dopamine.getLevelBonus()       : 1;
    const achM   = typeof Dopamine !== 'undefined' ? Dopamine.getAchievementBonus() : 1;
    const guildM = getGuildBuff()?.mult || 1;
    const focM   = 1 + focusBonus();
    const boosted = amount * prestigeMultiplier() * comboM * luckyM * levelM * achM * guildM * focM * masteryMult();
    state.lifetime += boosted;
    const today = new Date().toDateString();
    if (state.todayDate !== today) { state.todayDate = today; state.todayEarned = 0; }
    state.todayEarned += boosted;
    if (typeof Dopamine !== 'undefined') { Dopamine.addXP(boosted); Dopamine.checkMilestones(state.lifetime); }
    return boosted;
  }
  function earnTo(room, amount) {
    const b = applyGain(amount);
    state[room].coins = (state[room].coins || 0) + b;
    return b;
  }
  function earn(amount) {
    const rooms = ALL_ROOMS.filter(roomUnlocked);
    const share = amount / Math.max(1, rooms.length);
    let total = 0;
    for (const r of rooms) total += earnTo(r, share);
    return total;
  }
  function totalCoins() { return ALL_ROOMS.reduce((n, r) => n + (state[r].coins || 0), 0); }

  // ── Bosses: each room is cleared by slaying its boss; earnings = damage ──────
  function damageBoss(room, dmg) {
    if (state[room].cleared) return;
    if (state[room].bossHp == null) state[room].bossHp = BOSS[room].hp;
    state[room].bossHp = Math.max(0, state[room].bossHp - dmg);
  }
  function checkClear(room, goalId, textId) {
    const b = BOSS[room]; const max = b.hp;
    const _em = $(room + 'BossEmoji'); if (_em) { _em.textContent = b.emoji; _em.style.opacity = state[room].cleared ? '0.35' : '1'; }
    if (state[room].cleared) state[room].bossHp = 0;
    if (state[room].bossHp == null) state[room].bossHp = max;
    const hp = Math.max(0, state[room].bossHp);
    const bar = $(goalId); const txt = $(textId);
    if (bar) {
      bar.style.width = (hp / max * 100).toFixed(1) + '%';
      bar.style.background = state[room].cleared
        ? 'linear-gradient(90deg, var(--accent), #8fe0ff)'
        : 'linear-gradient(90deg, #d23b3b, #ff7a55)';
    }
    if (txt) txt.innerHTML = state[room].cleared
      ? `${b.emoji} ${b.name} — SLAIN ✓`
      : `${b.emoji} ${b.name} — ${money(hp)} / ${money(max)} HP`;
    if (!state[room].cleared && hp <= 0) {
      state[room].cleared = true;
      toast(`⚔ ${b.emoji} ${b.name} SLAIN! The next hall opens.`);
      SFX('sfxPrestige');
      updatePrestigeBtn(); updateRoomLocks(); updateFinalBoss();
      const _ni = ALL_ROOMS.indexOf(room); announceUnlock(ALL_ROOMS[_ni+1] || 'ragnarok');
      if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    }
  }
  function checkAllClears() {
    checkClear('darts','dartsGoal','dartsGoalText');
    checkClear('scratch','scratchGoal','scratchGoalText');
    checkClear('slots','slotsGoal','slotsGoalText');
    checkClear('pachinko','pachinkoGoal','pachinkoGoalText');
    checkClear('sushi','sushiGoal','sushiGoalText');
    checkClear('gacha','gachaGoal','gachaGoalText');
  }

  // ── Mastery: cleared rooms unlock a global earnings boost ───────────────────
  function masteryMult() { return 1 + 0.10 * ALL_ROOMS.reduce((n, r) => n + lvl(r, 'mastery'), 0); }
  function masteryDef(room) { return { id:'mastery', name: ROOM_LABEL[room] + ' Mastery', desc:'+10% to ALL earnings (global)', base: MASTERY_BASE[room], growth: 1.9, max: 50 }; }
  function renderMasteryFor(room) {
    const c = $(room + 'Mastery'); if (!c) return;
    c.innerHTML = '';
    if (!state[room].cleared) {
      const d = document.createElement('div'); d.className = 'plock';
      d.innerHTML = '🔒 <span>Slay the boss to unlock ' + ROOM_LABEL[room] + ' Mastery</span>';
      c.appendChild(d); return;
    }
    const def = masteryDef(room); const level = lvl(room, 'mastery'); const cost = costOf(def, level); const maxed = level >= def.max;
    const row = document.createElement('div'); row.className = 'upgrade'; row.dataset.room = room; row.dataset.cost = cost;
    row.innerHTML = `
      <div class="info">
        <div class="uname" style="color:var(--gold);">⚜ ${def.name} <span class="pill">Lv ${level}</span></div>
        <div class="udesc">${def.desc}</div>
      </div>
      <button class="act cost" style="border-color:var(--gold);color:var(--gold);" ${maxed || state[room].coins < cost ? 'disabled' : ''}>
        ${maxed ? 'MAX' : money(cost)}
      </button>`;
    row.querySelector('button').addEventListener('click', () => buyUpgrade(room, def));
    c.appendChild(row);
  }

  // ── Final boss (Ragnarök) ───────────────────────────────────────────────────
  function allRoomsClearedC() { return ALL_ROOMS.every(r => state[r].cleared); }
  function updateFinalBoss() {
    const ready = allRoomsClearedC();
    const lock = $('finalLock'); const fight = $('finalFight');
    if (lock) lock.style.display = ready ? 'none' : 'block';
    if (fight) fight.style.display = ready ? 'block' : 'none';
    const max = FINAL_BOSS.hp;
    const hp = state.finalBossDefeated ? 0 : Math.max(0, state.finalBossHp == null ? max : state.finalBossHp);
    const bar = $('finalBossBar'); const txt = $('finalBossText');
    if (bar) bar.style.width = (hp / max * 100).toFixed(1) + '%';
    if (txt) txt.innerHTML = state.finalBossDefeated
      ? `${FINAL_BOSS.emoji} ${FINAL_BOSS.name} — VANQUISHED ✓`
      : `${FINAL_BOSS.emoji} ${FINAL_BOSS.name} — ${money(hp)} / ${money(max)} HP`;
    const sb = $('strikeBtn'); if (sb) sb.disabled = !ready || state.finalBossDefeated;
  }
  function strikeFinalBoss() {
    if (!allRoomsClearedC()) { toast('Slay all six hall bosses first.'); return; }
    if (state.finalBossDefeated) { toast('Jörmungandr is already vanquished.'); return; }
    const dmg = Math.max(1, Math.round(combat().atk * 25 + perSecond()));
    state.finalBossHp = Math.max(0, (state.finalBossHp == null ? FINAL_BOSS.hp : state.finalBossHp) - dmg);
    logTo('finalLog', `⚔ You strike ${FINAL_BOSS.name} for ${money(dmg)}!`, '');
    SFX('sfxDart', true);
    if (state.finalBossHp <= 0 && !state.finalBossDefeated) {
      state.finalBossDefeated = true;
      toast(`🐉 ${FINAL_BOSS.name} VANQUISHED! Ascension to Valhalla awaits.`);
      SFX('sfxPrestige');
      updatePrestigeBtn();
    }
    updateFinalBoss();
  }


  // ── Focus meter ────────────────────────────────────────────────────────────
  function addFocus(amt) { state.focus = Math.min(100, (state.focus || 0) + amt); _renderFocus(); }
  function _renderFocus() {
    const f  = state.focus || 0;
    const el = $('focusFill'); if (el) el.style.width = f + '%';
    const color = f >= 75 ? 'var(--accent)' : f >= 50 ? 'var(--gold)' : f >= 25 ? 'var(--blue)' : 'var(--dim)';
    if (el) el.style.background = `linear-gradient(90deg, ${color}, ${color}aa)`;
    const pct = Math.round(focusBonus() * 100);
    const fb  = $('focusBonus'); if (fb) { fb.textContent = `+${pct}%`; fb.style.color = pct > 0 ? 'var(--blue)' : 'var(--dim)'; }
  }

  // ── Dart actions ───────────────────────────────────────────────────────────
  function throwDart() {
    const crit     = Math.random() < dartCrit();
    const accuracy = 0.4 + Math.random() * 0.6;
    let payout     = dartValue() * accuracy * (crit ? 10 : 1);
    payout         = Math.max(1, payout);
    const got = earnTo('darts', payout);

    state.darts.best    = Math.max(state.darts.best, got);
    state.crits         = (state.crits || 0) + (crit ? 1 : 0);
    state.throwCount    = (state.throwCount || 0) + 1;

    addFocus(8);
    updateChallengeProgress('throw_count', 1);
    if (crit) updateChallengeProgress('crits', 1);

    if (typeof Dopamine !== 'undefined') { Dopamine.onThrow(); Dopamine.checkAchievements(); }

    logTo('dartsLog', `🪓 ${crit?'CLEAVE! ':''}Axe struck for ${money(got)} (${Math.round(accuracy*100)}% aim)`, crit?'good':'');
    animAxe(crit);
    AnimFloat('+'+money(got), $('throwBtn'), crit?'#ffd166':'#00e87a');
    SFX('sfxDart', crit);
    damageBoss('darts', got);
    refreshTop();
    checkClear('darts','dartsGoal','dartsGoalText');
  }

  // ── Scratch actions ────────────────────────────────────────────────────────
  function scratchTicket() {
    if (!roomUnlocked('scratch')) { toast('🔒 Clear the ' + prevRoomLabel('scratch') + ' room first.'); return; }
    const tierIdx  = parseInt($('ticketTier').value,10) || 0;
    const t        = TICKETS[tierIdx];
    if (state.scratch.coins < t.cost) { toast(`Need ${money(t.cost)} Rune coin for a ${t.name} stone.`); return; }
    state.scratch.coins -= t.cost;

    const won    = Math.random() < (0.25 + scratchLuck());
    if (won) {
      const jackpot = Math.random() < (0.04 + lvl('scratch','elite_luck')*0.01);
      let   win     = t.maxWin * (0.2 + Math.random() * 0.8);
      if (jackpot)  win = t.maxWin * jackpotMult();
      win = Math.max(t.cost, Math.floor(win));
      animRunes(true, jackpot);
      const got = earnTo('scratch', win);
      state.scratch.best = Math.max(state.scratch.best, got);
      damageBoss('scratch', got);
      state.scratchWins  = (state.scratchWins||0) + 1;
      if (jackpot) { state.jackpots = (state.jackpots||0)+1; updateChallengeProgress('jackpots',1); }
      updateChallengeProgress('scratchWins',1);
      logTo('scratchLog', `${t.name} ${jackpot?'⚡ DIVINE BLESSING! ':'rune blessed '}${money(got)}`, jackpot?'good':'');
      if (typeof Anim !== 'undefined') { try { Anim.revealScratch(true, jackpot); } catch {} }
      AnimFloat('+'+money(got), $('scratchBtn'), jackpot?'#ffd166':'#00e87a');
      SFX('sfxWin', jackpot);
    } else {
      animRunes(false, false);
      logTo('scratchLog', `${t.name} rune fell silent. (-${money(t.cost)})`, 'muted');
      if (typeof Anim !== 'undefined') { try { Anim.revealScratch(false, false); } catch {} }
      SFX('sfxLoss');
    }

    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    checkClear('scratch','scratchGoal','scratchGoalText');
  }

  // ── Slot actions ───────────────────────────────────────────────────────────
  let _slotSpinning = false;

  function spinSlots() {
    if (_slotSpinning) return;
    if (!roomUnlocked('slots')) { toast('🔒 Clear the ' + prevRoomLabel('slots') + ' room first.'); return; }
    const betIdx = parseInt($('slotBet').value,10) || 0;
    const bet    = SLOT_BETS[Math.min(betIdx, unlockedBets()-1)];
    if (state.slots.coins < bet.cost) { toast(`Need ${money(bet.cost)} Reel coin to spin.`); return; }

    state.slots.coins -= bet.cost;
    _slotSpinning = true;
    $('slotBtn').disabled = true;

    const r0 = weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS);
    const r1  = Math.random() < slotLuck() ? r0 : weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS);
    const r2  = Math.random() < slotLuck() ? r0 : weightedRandom(SLOT_SYMBOLS, SLOT_WEIGHTS);
    const res = [r0,r1,r2];

    const done = () => { _slotSpinning = false; $('slotBtn').disabled = false; _resolveSlots(bet, res); };
    if (typeof Anim !== 'undefined' && Anim.spinReels) { try { Anim.spinReels(res, done); } catch { done(); } }
    else done();
  }

  function _resolveSlots(bet, res) {
    const [r0,r1,r2] = res;
    const three  = r0===r1 && r1===r2;
    const two    = !three && (r0===r1 || r1===r2 || r0===r2);
    const jackpot = three && r0==='💎';
    let win = 0, got = 0, logTxt = '', logCls = '';

    if (three) {
      const mult = SLOT_PAY3[r0] * slotMult() * (jackpot ? slotJackpotMult() : 1);
      win = Math.floor(bet.cost * mult);
      got = earnTo('slots', win);
      state.slotWins     = (state.slotWins||0)+1;
      if (jackpot) { state.slotJackpots=(state.slotJackpots||0)+1; updateChallengeProgress('jackpots',1); }
      updateChallengeProgress('slotWins',1);
      state.slots.best = Math.max(state.slots.best||0, got);
      damageBoss('slots', got);
      logTxt = `${res.join('')} — ${jackpot?'💎 JACKPOT! ':'3 OF A KIND! '}+${money(got)}`;
      logCls = jackpot ? 'good' : '';
      AnimFloat('+'+money(got), $('slotBtn'), jackpot?'#ffc820':'#00e87a');
      if (jackpot) { SFX('sfxWin', true); if(typeof Dopamine!=='undefined') Dopamine.shake('heavy'); }
      else         { SFX('sfxWin', false);if(typeof Dopamine!=='undefined') Dopamine.shake('light'); }
    } else if (two) {
      win = Math.floor(bet.cost * 1.5);
      got = earnTo('slots', win);
      updateChallengeProgress('slotWins',1);
      state.slotWins = (state.slotWins||0)+1;
      state.slots.best = Math.max(state.slots.best||0, got);
      damageBoss('slots', got);
      logTxt = `${res.join('')} — Pair! +${money(got)}`;
      AnimFloat('+'+money(got), $('slotBtn'), '#33aaff');
    } else {
      logTxt = `${res.join('')} — No match. -${money(bet.cost)}`;
      logCls = 'bad';
    }

    logTo('slotsLog', `🎰 ${logTxt}`, logCls);
    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    $('slotWins').textContent     = state.slotWins    || 0;
    $('slotJackpots').textContent = state.slotJackpots|| 0;
    checkClear('slots','slotsGoal','slotsGoalText');
  }

  // ── Room unlock gating ──────────────────────────────────────────────────────
  function roomUnlocked(room) {
    const i = ALL_ROOMS.indexOf(room);
    if (i <= 0) return true;
    return !!state[ALL_ROOMS[i-1]].cleared;
  }
  function prevRoomLabel(room) {
    const i = ALL_ROOMS.indexOf(room);
    return i > 0 ? (ROOM_LABEL[ALL_ROOMS[i-1]] || '') : '';
  }
  const _ROOM_BTN = { darts:'throwBtn', scratch:'scratchBtn', slots:'slotBtn', pachinko:'dropBtn', sushi:'cookBtn', gacha:'pullBtn' };
  function updateRoomLocks() {
    ALL_ROOMS.forEach(room => {
      const unlocked = roomUnlocked(room);
      const note = $(room + 'Lock');
      if (note) note.style.display = unlocked ? 'none' : 'block';
      const btn = $(_ROOM_BTN[room]);
      if (btn && !unlocked) btn.disabled = true;
      else if (btn && room !== 'slots') btn.disabled = false;
      const tab = qs('nav.tabs button[data-tab="' + room + '"]');
      if (tab) {
        const hasLock = tab.textContent.indexOf('🔒') === 0;
        if (!unlocked && !hasLock) tab.textContent = '🔒 ' + tab.textContent;
        if (unlocked && hasLock) tab.textContent = tab.textContent.replace('🔒 ', '');
      }
    });
  }

  const ROOM_TITLE = { darts:'Axe-Throwing Pit', scratch:'Rune Carving', slots:"Norn's Reels", pachinko:'Boulder Drop', sushi:'Feast Hall', gacha:'Beast Summon', ragnarok:'Ragnarök' };
  function announceUnlock(room) {
    const title = ROOM_TITLE[room] || room;
    const b = $('unlockBanner');
    if (b) {
      b.innerHTML = '⚔ NEW HALL UNLOCKED<br><span style="color:var(--gold);font-size:28px;">' + title + '</span>';
      b.classList.remove('hidden'); void b.offsetWidth; b.classList.add('show');
      setTimeout(() => { b.classList.remove('show'); b.classList.add('hidden'); }, 3400);
    }
    const tab = qs('nav.tabs button[data-tab="' + room + '"]');
    if (tab) { tab.classList.add('justunlocked'); setTimeout(() => tab.classList.remove('justunlocked'), 7000); }
    SFX('sfxPrestige');
  }

  // ── Animation helpers for the newer rooms (self-contained CSS toggles) ───────
  const SUSHI_EMOJI = ['🍖','🍺','🐟','🍗','🧀','🥩'];
  const GACHA_PETS  = { Wolf:'🐺', Raven:'🦅', Bear:'🐻', Dragon:'🐉' };
  const RUNES = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛞ','ᛟ'];
  function animRunes(won, jackpot) {
    const sym = RUNES[Math.floor(Math.random()*RUNES.length)];
    ['runeS0','runeS1','runeS2'].forEach((id,i) => { const e=$(id); if(!e)return; e.style.animation='none'; void e.offsetWidth; e.textContent = won ? sym : RUNES[(i*5+3)%RUNES.length]; e.style.animation='sflip 0.4s ease'; });
    const stage=$('runeStage'); if(stage){ stage.classList.toggle('match', !!won); stage.classList.toggle('perfect', !!jackpot); }
  }
  function animAxe(crit) {
    const axe = $('axeProj'); if (axe) { axe.style.animation='none'; void axe.offsetWidth; axe.style.animation = (crit?'axefly 0.4s ease, axecrit 0.4s ease':'axefly 0.45s ease'); }
    const tgt = $('axeTarget'); if (tgt && crit) { tgt.style.animation='none'; void tgt.offsetWidth; tgt.style.animation='axehit 0.3s ease'; }
  }
  function animPachinko(slot, jackpot) {
    const ball = $('pachinkoBall');
    if (ball) {
      ball.style.left = (15 + Math.random()*70) + '%';
      ball.style.animation = 'none'; void ball.offsetWidth;
      ball.style.animation = 'pdrop 0.7s cubic-bezier(.45,0,.7,1)';
    }
    const r = $('pachinkoResult');
    if (r) { r.textContent = jackpot ? '💥 25×' : slot + '×'; r.style.color = jackpot ? 'var(--gold)' : 'var(--accent)'; }
  }
  function animSushi(won, perfect) {
    const target = SUSHI_EMOJI[Math.floor(Math.random()*SUSHI_EMOJI.length)];
    ['sushiP0','sushiP1','sushiP2'].forEach((id,i) => {
      const p = $(id); if (!p) return;
      p.style.animation = 'none'; void p.offsetWidth;
      p.textContent = won ? target : SUSHI_EMOJI[(i*2+1) % SUSHI_EMOJI.length];
      p.style.animation = 'sflip 0.4s ease';
    });
    const stage = $('sushiStage');
    if (stage) { stage.classList.toggle('match', !!won); stage.classList.toggle('perfect', !!perfect); }
  }
  function animGacha(rarityName) {
    const cap = $('gachaCapsule'); if (!cap) return;
    cap.style.animation = 'none'; void cap.offsetWidth;
    cap.textContent = '🥚';
    cap.classList.add('shaking');
    setTimeout(() => {
      cap.classList.remove('shaking');
      cap.textContent = GACHA_PETS[rarityName] || '🐾';
      cap.style.animation = 'gpop 0.45s ease';
      cap.style.color = ({ Wolf:'var(--ink)', Raven:'var(--blue)', Bear:'var(--purple)', Dragon:'var(--gold)' })[rarityName] || 'var(--ink)';
    }, 360);
  }

  // ── Pachinko actions ───────────────────────────────────────────────────────
  function dropBall() {
    if (!roomUnlocked('pachinko')) { toast('🔒 Clear the ' + prevRoomLabel('pachinko') + ' room first.'); return; }
    const jackpot = Math.random() < (0.02 + pachinkoLuck());
    const slot = jackpot ? 25 : [0.3,0.5,1,1,2,3,5][Math.floor(Math.random()*7)];
    animPachinko(slot, jackpot);
    const payout = Math.max(1, pachinkoValue() * slot);
    const got = earnTo('pachinko', payout);
    state.pachinko.best = Math.max(state.pachinko.best, got);
    damageBoss('pachinko', got);
    if (jackpot) updateChallengeProgress('jackpots', 1);
    addFocus(6);
    logTo('pachinkoLog', `🪨 ${jackpot?'💥 25× RUNE STRIKE! ':''}Boulder hit ${slot}× → ${money(got)}`, jackpot?'good':'');
    AnimFloat('+'+money(got), $('dropBtn'), jackpot?'#ffc820':'#00e87a');
    SFX(jackpot ? 'sfxWin' : 'sfxDart', jackpot);
    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    checkClear('pachinko','pachinkoGoal','pachinkoGoalText');
  }

  // ── Sushi actions ──────────────────────────────────────────────────────────
  function cookSushi() {
    if (!roomUnlocked('sushi')) { toast('🔒 Clear the ' + prevRoomLabel('sushi') + ' room first.'); return; }
    const won = Math.random() < (0.35 + sushiLuck());
    const perfect = won && Math.random() < 0.04;
    animSushi(won, perfect);
    if (won) {
      const payout = Math.max(1, perfect ? sushiValue()*15 : sushiValue()*(1 + Math.random()*2));
      const got = earnTo('sushi', payout);
      state.sushi.best = Math.max(state.sushi.best, got);
      damageBoss('sushi', got);
      if (perfect) updateChallengeProgress('jackpots', 1);
      logTo('sushiLog', `🍖 ${perfect?'🌟 PERFECT FEAST! ':'Feast! '}${money(got)}`, perfect?'good':'');
      AnimFloat('+'+money(got), $('cookBtn'), perfect?'#ffc820':'#00e87a');
      SFX('sfxWin', perfect);
    } else {
      logTo('sushiLog', `🍖 The hall goes hungry…`, 'muted');
      SFX('sfxLoss');
    }
    addFocus(6);
    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    checkClear('sushi','sushiGoal','sushiGoalText');
  }

  // ── Gacha actions ──────────────────────────────────────────────────────────
  function pullGacha() {
    if (!roomUnlocked('gacha')) { toast('🔒 Clear the ' + prevRoomLabel('gacha') + ' room first.'); return; }
    const L = gachaLuck();
    const r = Math.random();
    let rarity;
    if (r < 0.005 + 0.15*L) rarity = GACHA_RARITIES[3];
    else if (r < 0.03 + 0.30*L) rarity = GACHA_RARITIES[2];
    else if (r < 0.15 + 0.30*L) rarity = GACHA_RARITIES[1];
    else rarity = GACHA_RARITIES[0];
    animGacha(rarity.name);
    const payout = Math.max(1, gachaValue() * rarity.mult * (1 + Math.random()));
    const got = earnTo('gacha', payout);
    state.gacha.best = Math.max(state.gacha.best, got);
    damageBoss('gacha', got);
    if (rarity.mult >= 150) updateChallengeProgress('jackpots', 1);
    addFocus(6);
    logTo('gachaLog', `🐺 Summoned a ${rarity.name}! +${money(got)}`, rarity.cls);
    AnimFloat('+'+money(got), $('pullBtn'), rarity.mult>=30?'#ffc820':'#00e87a');
    SFX('sfxWin', rarity.mult>=30);
    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    checkClear('gacha','gachaGoal','gachaGoalText');
  }

  // ── Challenge system ───────────────────────────────────────────────────────
  function todayKey() { return new Date().toDateString(); }
  function _seedRng(seed) { return (n) => { let x = Math.sin(seed * 9301 + n * 49297 + 233) * 1e5; return x - Math.floor(x); }; }

  function generateChallenges() {
    const seed = Math.floor(Date.now() / 86400000);
    const rng  = _seedRng(seed);
    const picks = [...CH_TYPES].sort((a,b) => rng(CH_TYPES.indexOf(a)) - rng(CH_TYPES.indexOf(b))).slice(0,3);
    return picks.map((type,i) => {
      const tier   = Math.floor(rng(i+100) * type.targets.length);
      const target = type.targets[tier];
      return {
        id: type.id, icon: type.icon, name: type.name,
        target, desc: type.desc(target),
        reward: Math.round(type.reward(target) * (1 + auth.prestige * 0.5)),
        xpReward: type.xpReward(target),
        done: false,
      };
    });
  }

  function ensureChallenges() {
    const today = todayKey();
    if (state.challengeDate !== today) {
      state.challengeDate = today;
      state.challenges    = generateChallenges();
      state.challengeProgress = {};
    }
    if (!state.challenges) state.challenges = generateChallenges();
  }

  function updateChallengeProgress(fieldId, delta) {
    ensureChallenges();
    state.challengeProgress = state.challengeProgress || {};
    for (const ch of state.challenges) {
      if (ch.done || ch.id !== fieldId) continue;
      const key    = ch.id + '_daily';
      const before = state.challengeProgress[key] || 0;
      const after  = before + delta;
      state.challengeProgress[key] = after;
      if (after >= ch.target) {
        ch.done = true;
        earn(ch.reward);
        if (typeof Dopamine !== 'undefined') Dopamine.addXP(ch.xpReward);
        toast(`⚡ Challenge complete: ${ch.name}! +${money(ch.reward)}`);
        SFX('sfxAchievement');
      }
    }
    renderChallenges();
  }

  function _challengeCurrentValue(ch) {
    if (ch.id === 'todayEarned') return state.todayEarned || 0;
    if (ch.id === 'throw_count') return state.challengeProgress?.['throw_count_daily'] || 0;
    if (ch.id === 'crits')       return state.challengeProgress?.['crits_daily']       || 0;
    if (ch.id === 'scratchWins') return state.challengeProgress?.['scratchWins_daily'] || 0;
    if (ch.id === 'jackpots')    return state.challengeProgress?.['jackpots_daily']    || 0;
    if (ch.id === 'slotWins')    return state.challengeProgress?.['slotWins_daily']    || 0;
    return 0;
  }

  function renderChallenges() {
    ensureChallenges();
    const el = $('challengeList'); if (!el) return;
    el.innerHTML = '';
    state.challenges.forEach(ch => {
      const cur = Math.min(ch.target, _challengeCurrentValue(ch));
      const pct = Math.min(100, (cur / ch.target)*100).toFixed(0);
      const div = document.createElement('div');
      div.className = 'challenge' + (ch.done ? ' done' : '');
      div.innerHTML = `
        <div class="ch-icon">${ch.icon}</div>
        <div class="ch-info">
          <div class="ch-name">${ch.name}${ch.done?' ✓':''}</div>
          <div class="ch-desc">${ch.desc}</div>
          <div class="ch-progwrap">
            <div class="ch-progbar"><div class="ch-progfill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div class="ch-reward">+${money(ch.reward)}<br><span style="color:var(--blue);font-size:10px;">+${ch.xpReward} XP</span></div>`;
      el.appendChild(div);
    });
    const t    = $('challengeTimer'); if (!t) return;
    const now  = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const ms   = next - now;
    const hh   = Math.floor(ms/3600000);
    const mm   = Math.floor((ms%3600000)/60000);
    t.textContent = `Refreshes in ${hh}h ${mm}m`;
  }

  function renderAchievementList() {
    const el = $('achList'); if (!el || typeof Dopamine === 'undefined') return;
    el.innerHTML = '';
    Dopamine.ACH_LIST.forEach(a => {
      const unlocked = (state.achievements||[]).includes(a.id);
      const row = document.createElement('div');
      row.className = 'ach-row' + (unlocked ? '' : ' locked');
      row.innerHTML = `
        <div class="ar-icon">${a.i}</div>
        <div style="flex:1">
          <div class="ar-name">${a.n}</div>
          <div class="ar-desc">${a.d}</div>
          ${a.bonus ? `<div class="ar-bonus">${a.bonus}</div>` : ''}
        </div>
        <div style="font-size:11px;color:${unlocked?'var(--accent)':'var(--dim)'};">${unlocked?'✓ Earned':'Locked'}</div>`;
      el.appendChild(row);
    });
  }

  // ── Upgrades UI ────────────────────────────────────────────────────────────
  function buyUpgrade(room, def) {
    if (!roomUnlocked(room)) { toast('🔒 Clear the ' + prevRoomLabel(room) + ' room first.'); return; }
    if (def.id === 'mastery' && !state[room].cleared) { toast('Slay the boss to unlock Mastery.'); return; }
    const level = lvl(room, def.id);
    if (level >= def.max) { toast('Maxed out.'); return; }
    const cost = costOf(def, level);
    if (state[room].coins < cost) { toast(`Need ${money(cost)} ${ROOM_LABEL[room]} coin for ${def.name}.`); return; }
    state[room].coins -= cost;
    state[room].upgrades[def.id] = level + 1;
    renderUpgrades();
    refreshTop();
  }

  function _synergyNote(room, id) {
    if (room === 'darts' && id === 'mult' && state.scratch.cleared) return '✦ Synergy active: scratch clear +50%';
    if (room === 'scratch' && id === 'luck' && state.darts.cleared) return '✦ Synergy active: dart clear +20% win';
    return null;
  }

  function _renderUpgradeList(room, defs, containerId) {
    const c = $(containerId); if (!c) return;
    c.innerHTML = '';
    defs.forEach(def => {
      const level   = lvl(room, def.id);
      const cost    = costOf(def, level);
      const maxed   = level >= def.max;
      const synergy = _synergyNote(room, def.id);
      const row     = document.createElement('div');
      row.className = 'upgrade'; row.dataset.room = room; row.dataset.cost = cost;
      row.innerHTML = `
        <div class="info">
          <div class="uname">${def.name} <span class="pill">Lv ${level}</span></div>
          <div class="udesc">${def.desc}</div>
          ${synergy ? `<div class="usynergy">${synergy}</div>` : ''}
        </div>
        <button class="act cost" ${maxed || state[room].coins < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : money(cost)}
        </button>`;
      row.querySelector('button').addEventListener('click', () => buyUpgrade(room, def));
      c.appendChild(row);
    });
  }

  function _renderPrestigeLocked(containerId, eliteList) {
    const c = $(containerId); if (!c) return;
    c.innerHTML = '';
    if (auth.prestige < 2) {
      const div = document.createElement('div');
      div.className = 'plock';
      div.innerHTML = `🔒 <span>Elite upgrades unlock at Prestige 2 (you have ${auth.prestige})</span>`;
      c.appendChild(div);
    } else {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:12px;color:var(--purple);letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px;';
      h.textContent = '✨ Elite Upgrades';
      c.appendChild(h);
      eliteList.forEach(def => {
        const room  = def.id.startsWith('elite_luck') ? 'scratch' : 'darts';
        const level = lvl(room, def.id);
        const cost  = costOf(def, level);
        const maxed = level >= def.max;
        const row   = document.createElement('div');
        row.className = 'upgrade'; row.dataset.room = room; row.dataset.cost = cost;
        row.innerHTML = `
          <div class="info">
            <div class="uname" style="color:var(--purple);">${def.name} <span class="pill">Lv ${level}</span></div>
            <div class="udesc">${def.desc}</div>
          </div>
          <button class="act cost" style="border-color:var(--purple);color:var(--purple);" ${maxed || state[room].coins < cost ? 'disabled' : ''}>
            ${maxed ? 'MAX' : money(cost)}
          </button>`;
        row.querySelector('button').addEventListener('click', () => buyUpgrade(room, def));
        c.appendChild(row);
      });
    }
  }

  function renderUpgrades() {
    _renderUpgradeList('darts',   DART_UPGRADES,    'dartsUpgrades');
    _renderPrestigeLocked('dartPrestigeLocked', DART_ELITE);
    _renderUpgradeList('scratch', SCRATCH_UPGRADES, 'scratchUpgrades');
    _renderPrestigeLocked('scratchPrestigeLocked', SCRATCH_ELITE);
    _renderUpgradeList('slots',   SLOT_UPGRADES,    'slotsUpgrades');
    _renderUpgradeList('pachinko',PACHINKO_UPGRADES,'pachinkoUpgrades');
    _renderUpgradeList('sushi',   SUSHI_UPGRADES,   'sushiUpgrades');
    _renderUpgradeList('gacha',   GACHA_UPGRADES,   'gachaUpgrades');
    ALL_ROOMS.forEach(renderMasteryFor);

    const sel  = $('ticketTier'); if (sel) {
      const prev = sel.value; sel.innerHTML = '';
      for (let i = 0; i < unlockedTiers(); i++) {
        const o = document.createElement('option');
        o.value = i; o.textContent = `${TICKETS[i].name} — ${money(TICKETS[i].cost)}, up to ${money(TICKETS[i].maxWin)}`;
        sel.appendChild(o);
      }
      if (prev && prev < unlockedTiers()) sel.value = prev;
    }

    const sb = $('slotBet'); if (sb) {
      const prev = sb.value; sb.innerHTML = '';
      for (let i = 0; i < unlockedBets(); i++) {
        const o = document.createElement('option');
        o.value = i; o.textContent = `${SLOT_BETS[i].name} — ${money(SLOT_BETS[i].cost)} per spin`;
        sb.appendChild(o);
      }
      if (prev && prev < unlockedBets()) sb.value = prev;
    }

    const pt = $('slotPayoutTable'); if (pt) {
      pt.innerHTML = '';
      SLOT_SYMBOLS.forEach(s => {
        const mult = SLOT_PAY3[s];
        const p1 = document.createElement('div'); p1.style.color = s==='💎'?'var(--gold)':'var(--ink)'; p1.textContent = `${s}${s}${s}`;
        const p2 = document.createElement('div'); p2.style.color = 'var(--gold)'; p2.textContent = `×${mult}`;
        pt.appendChild(p1); pt.appendChild(p2);
      });
      const p1 = document.createElement('div'); p1.style.color='var(--dim)'; p1.textContent='Any pair';
      const p2 = document.createElement('div'); p2.style.color='var(--dim)'; p2.textContent='×1.5';
      pt.appendChild(p1); pt.appendChild(p2);
    }

    renderAffordability();
  }

  function renderAffordability() {
    qsa('.upgrade').forEach(row => {
      const btn = row.querySelector('button');
      if (!btn || btn.textContent.trim() === 'MAX') return;
      const room = row.dataset.room; if (!room) return;
      const cost = Number(row.dataset.cost) || parseMoney(btn.textContent.trim());
      btn.disabled = (state[room].coins || 0) < cost;
    });
  }

  function parseMoney(s) {
    s = s.replace('$','');
    const m = {K:1e3,M:1e6,B:1e9,T:1e12};
    const u = s.slice(-1);
    if (m[u]) return parseFloat(s) * m[u];
    return parseFloat(s.replace(/,/g,'')) || Infinity;
  }

  function setText(id, v) { const el = $(id); if (el) el.textContent = v; }

  // ── Top bar refresh ────────────────────────────────────────────────────────
  function refreshTop() {
    setText('netWorth', money(totalCoins()));
    setText('lifetime', money(state.lifetime));
    setText('perSec',   money(perSecond()) + '/s');
    ALL_ROOMS.forEach(_r => setText(_r + 'Coins', money(state[_r].coins || 0)));
    const c = combat();
    setText('power', Math.round(c.atk*10 + c.luck*5 + c.hp));
    setText('dartValue', money(dartValue()));
    setText('dartAuto',  dartAuto() + '/s');
    setText('dartCrit',  (dartCrit()*100).toFixed(0) + '%');
    setText('scratchLuck', (25 + scratchLuck()*100).toFixed(0) + '%');
    setText('scratchAuto', scratchAuto() + '/s');
    setText('myAtk',  c.atk);
    setText('myLuck', c.luck);
    setText('myHp',   c.hp);
    setText('slotAutoDisplay', slotAuto() > 0 ? slotAuto() + '/s' : 'Off');
    setText('pachinkoValue', money(pachinkoValue()));
    setText('pachinkoAuto',  pachinkoAuto() + '/s');
    setText('sushiValue',    money(sushiValue()));
    setText('sushiAuto',     sushiAuto() + '/s');
    setText('gachaValue',    money(gachaValue()));
    setText('gachaAuto',     gachaAuto() + '/s');
    updateRoomLocks();
    updateFinalBoss();
    renderAffordability();
    _renderFocus();
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  let lastTick = Date.now();
  function tick() {
    const now = Date.now();
    const dt  = (now - lastTick) / 1000;
    lastTick  = now;

    state.focus = Math.max(0, (state.focus||0) - 0.25*dt*20);

    const a = dartAuto();
    if (a > 0) {
      const g = earnTo('darts', a * dartValue() * (1 + dartCrit()*9) * dt);
      state.darts.best = Math.max(state.darts.best, dartValue() * (1+dartCrit()*9));
      damageBoss('darts', g);
    }
    const s = scratchAuto();
    if (s > 0) {
      const t  = TICKETS[unlockedTiers()-1];
      const per = t.maxWin * (0.25+scratchLuck()) * 0.5 * jackpotMult();
      const g = earnTo('scratch', s * per * dt);
      state.scratch.best = Math.max(state.scratch.best, per);
      damageBoss('scratch', g);
    }
    const sa = slotAuto();
    if (sa > 0) {
      const sb  = SLOT_BETS[Math.max(0, unlockedBets()-1)];
      const per = sb.cost * 0.64 * slotMult() * (1+slotLuck());
      const g = earnTo('slots', sa * per * dt);
      state.slots.best = Math.max(state.slots.best, per);
      damageBoss('slots', g);
    }
    const pa = pachinkoAuto();
    if (pa > 0) { const per = pachinkoValue()*(2+pachinkoLuck()*25); const g = earnTo('pachinko', pa*per*dt); state.pachinko.best = Math.max(state.pachinko.best, per); damageBoss('pachinko', g); }
    const su = sushiAuto();
    if (su > 0) { const per = sushiValue()*((0.35+sushiLuck())*2); const g = earnTo('sushi', su*per*dt); state.sushi.best = Math.max(state.sushi.best, per); damageBoss('sushi', g); }
    const ga = gachaAuto();
    if (ga > 0) { const per = gachaValue()*(1.5+gachaLuck()*30); const g = earnTo('gacha', ga*per*dt); state.gacha.best = Math.max(state.gacha.best, per); damageBoss('gacha', g); }

    if (a>0 || s>0 || sa>0 || pa>0 || su>0 || ga>0) { refreshTop(); checkAllClears(); }
    if (ALL_ROOMS.every(r => state[r].cleared) && !state.finalBossDefeated) {
      const ps = perSecond();
      if (ps > 0) {
        state.finalBossHp = Math.max(0, (state.finalBossHp == null ? FINAL_BOSS.hp : state.finalBossHp) - ps * dt);
        if (state.finalBossHp <= 0) { state.finalBossDefeated = true; toast('🐉 Jörmungandr falls! Ascension awaits.'); updatePrestigeBtn(); }
        updateFinalBoss();
      }
    }
    _renderFocus();
  }

  // ── Networking ─────────────────────────────────────────────────────────────
  async function api(path, body) {
    const res  = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function saveGame() {
    if (!auth.token) return;
    state.lastSaveTime = Date.now();
    try { await api('/api/save', { token: auth.token, state, netWorth: totalCoins(), lifetime: state.lifetime, combat: combat() }); } catch {}
  }

  async function loadConfig() {
    try {
      const cfg = await api('/api/config');
      passwordRequired = !!cfg.passwordRequired;
      const field = $('passwordField');
      if (field) field.style.display = passwordRequired ? 'block' : 'none';
    } catch {}
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────
  let ws = null;
  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen    = () => ws.send(JSON.stringify({type:'auth',token:auth.token}));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type==='guild_chat') {
        logTo('guildChatLog', `[${new Date(m.ts).toLocaleTimeString()}] ${m.user}: ${m.text}`);
      } else if (m.type==='duel') {
        toast(`⚔ ${m.from} dueled you — you ${m.won?'WON':'lost'}!`);
        m.log.forEach(l => logTo('duelLog', l, m.won?'good':'bad'));
      } else if (m.type==='guild_update') {
        auth._guildTreasure = m.treasure;
        renderGuildBuff();
      }
    };
    ws.onclose = () => setTimeout(connectWS, 3000);
  }
  function sendChat(text) { if (ws && ws.readyState===1) ws.send(JSON.stringify({type:'guild_chat',text})); }

  // ── Prestige ───────────────────────────────────────────────────────────────
  function canPrestige() { return ALL_ROOMS.every(r => state[r].cleared) && state.finalBossDefeated; }

  function updatePrestigeBtn() {
    const btn = $('prestigeBtn'); if (!btn) return;
    const cleared = ALL_ROOMS.every(r => state[r].cleared);
    btn.disabled = !canPrestige();
    btn.title = canPrestige() ? 'Ascend to Valhalla: reset for +50% permanent earnings & stronger duels'
      : (!cleared ? 'Slay all 6 hall bosses first' : 'Defeat Jörmungandr in Ragnarök to Ascend');
  }

  async function doPrestige() {
    if (!canPrestige()) { toast('Slay all bosses, then Jörmungandr in Ragnarök, to Ascend.'); return; }
    if (!confirm(`Prestige #${auth.prestige+1}? Gold and upgrades reset. Permanent +50% earnings boost stacks. Lifetime, wins, guilds kept.`)) return;
    await saveGame();
    try {
      const r    = await api('/api/prestige', {token:auth.token, state});
      auth.prestige = r.prestige;
      state.gold  = 0;
      ALL_ROOMS.forEach(room => { state[room] = {cleared:false,best:0,upgrades:{},bossHp:BOSS[room].hp,coins:0}; });
      state.finalBossHp = FINAL_BOSS.hp; state.finalBossDefeated = false;
      renderUpgrades(); refreshTop(); checkAllClears(); updateFinalBoss();
      updatePrestigeBtn();
      setText('prestigeCount', auth.prestige);
      setText('prestigeMult', (prestigeMultiplier()*100).toFixed(0) + '%');
      toast(`✨ Prestige #${auth.prestige}! Earnings now ${(prestigeMultiplier()*100).toFixed(0)}%.`);
      SFX('sfxPrestige');
      if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    } catch (e) { toast(e.message); }
  }

  // ── Daily reward ───────────────────────────────────────────────────────────
  function updateDailyBtn() {
    const btn = $('dailyBtn'); if (!btn) return;
    const hrs = (Date.now()-auth.lastClaim)/3600000;
    btn.disabled  = hrs < 24;
    btn.textContent = hrs >= 24 ? '🎁 Daily' : `🎁 ${Math.ceil(24-hrs)}h`;
  }

  async function claimDaily() {
    try {
      const r = await api('/api/daily/claim', {token:auth.token});
      auth.lastClaim    = Date.now();
      auth.dailyStreak  = r.streak;
      earn(r.reward);
      refreshTop(); updateDailyBtn();
      setText('dailyStreak', r.streak);
      toast(`🎁 Day ${r.streak} reward: ${money(r.reward)}! (×${(1+(r.streak-1)*0.2).toFixed(1)} streak)`);
      SFX('sfxDaily');
      if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    } catch (e) { toast(e.message); }
  }

  // ── Guild treasury ─────────────────────────────────────────────────────────
  async function donateGold(fraction) {
    const _tot = totalCoins();
    const amount = Math.floor(_tot * fraction);
    if (amount < 1) { toast('Not enough coin to donate.'); return; }
    try {
      const r = await api('/api/guild/donate', {token:auth.token, amount});
      const _ratio = _tot > 0 ? amount / _tot : 0;
      ALL_ROOMS.forEach(rm => { state[rm].coins = Math.max(0, (state[rm].coins || 0) * (1 - _ratio)); });
      auth._guildTreasure = r.treasure;
      refreshTop();
      renderGuildBuff();
      toast(`💛 Donated ${money(amount)} to the guild treasury!`);
    } catch (e) { toast(e.message); }
  }

  function renderGuildBuff() {
    const el = $('guildBuffDisplay'); if (!el) return;
    const buff = getGuildBuff();
    el.innerHTML = buff ? `<div class="guildbuff">🛡 ${buff.label}</div>` : '';
    const tl = $('treasuryLabel');
    const tf = $('treasuryFill');
    const t  = auth._guildTreasure || 0;
    const TIERS = [1e3,1e6,1e9];
    const next  = TIERS.find(v=>t<v) || TIERS[TIERS.length-1];
    const prev  = TIERS[TIERS.indexOf(next)-1] || 0;
    const pct   = Math.min(100, ((t-prev)/(next-prev))*100);
    if (tl) tl.textContent = `Treasure: ${money(t)} — next buff at ${money(next)}`;
    if (tf) tf.style.width = pct + '%';
  }

  // ── PvP UI ─────────────────────────────────────────────────────────────────
  async function loadOpponents() {
    try {
      const {players} = await api('/api/players');
      const tb = $('opponentList'); tb.innerHTML = '';
      players.filter(p=>p.username!==auth.username).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.username}</td><td>${p.power}</td><td>${p.guild||'—'}</td>
          <td><button class="act">Duel</button></td>`;
        tr.querySelector('button').addEventListener('click', ()=>duel(p.username));
        tb.appendChild(tr);
      });
      if (!tb.children.length) tb.innerHTML = '<tr><td colspan="4" class="muted">No other players yet.</td></tr>';
    } catch (e) { toast(e.message); }
  }

  async function duel(opponent) {
    await saveGame();
    try {
      const r = await api('/api/pvp/challenge', {token:auth.token, opponent});
      logTo('duelLog', `— vs ${opponent} —`, '');
      r.log.forEach(l => logTo('duelLog', l, ''));
      logTo('duelLog', r.youWon?'✅ You won!':'❌ You lost.', r.youWon?'good':'bad');
      toast(r.youWon?`You beat ${opponent}!`:`You lost to ${opponent}.`);
      updateRecord();
    } catch (e) { toast(e.message); }
  }

  async function updateRecord() {
    try {
      const {players} = await api('/api/players');
      const me = players.find(p=>p.username===auth.username);
      if (me) setText('myRecord', `${me.wins||0}W / ${me.losses||0}L`);
    } catch {}
  }

  // ── Guild UI ───────────────────────────────────────────────────────────────
  async function loadGuilds() {
    try {
      const {guilds} = await api('/api/guilds');
      const tb = $('guildList'); tb.innerHTML = '';
      guilds.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${g.name}</td><td>${g.members}</td><td class="gold">${money(g.treasure)}</td>
          <td><button class="act">Join</button></td>`;
        tr.querySelector('button').addEventListener('click', ()=>joinGuild(g.name));
        tb.appendChild(tr);
      });
      if (!tb.children.length) tb.innerHTML = '<tr><td colspan="4" class="muted">No guilds — found one!</td></tr>';
    } catch (e) { toast(e.message); }
  }

  async function createGuild() {
    const name = $('guildNameInput').value.trim();
    try { const {guild} = await api('/api/guild/create', {token:auth.token, name}); showGuild(guild); }
    catch (e) { $('guildMsg').textContent = e.message; }
  }

  async function joinGuild(name) {
    try { const {guild} = await api('/api/guild/join', {token:auth.token, name}); showGuild(guild); }
    catch (e) { toast(e.message); }
  }

  async function leaveGuild() {
    try { await api('/api/guild/leave', {token:auth.token}); $('inGuild').classList.add('hidden'); $('noGuild').classList.remove('hidden'); loadGuilds(); }
    catch (e) { toast(e.message); }
  }

  function showGuild(guild) {
    $('noGuild').classList.add('hidden');
    $('inGuild').classList.remove('hidden');
    setText('guildTitle', '🛡 ' + guild.name);
    setText('guildLeader', guild.leader);
    setText('guildTreasure', money(guild.treasure));
    auth._guildTreasure = guild.treasure;
    const tb = $('guildMembers'); tb.innerHTML = '';
    guild.members.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${m.username}</td><td>${money(m.lifetime)}</td><td>${m.power}</td>`;
      tb.appendChild(tr);
    });
    const log = $('guildChatLog'); log.innerHTML = '';
    (guild.chat||[]).forEach(c=>logTo('guildChatLog', `[${new Date(c.ts).toLocaleTimeString()}] ${c.user}: ${c.text}`));
    renderGuildBuff();
  }

  async function refreshGuildIfMember() {
    try {
      const me = await api('/api/login', {username:auth.username, password:''});
      if (me.guild) { const {guild} = await api('/api/guild/' + encodeURIComponent(me.guild)); showGuild(guild); }
    } catch {}
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────
  async function loadBoard() {
    try {
      const {players} = await api('/api/leaderboard');
      const tb = $('boardList'); tb.innerHTML = '';
      players.forEach((p,i) => {
        const tr  = document.createElement('tr');
        const pr = p.prestige || 0;
        const badge = pr > 0 ? `<span title="${pr} prestige(s)" style="color:var(--gold);">👑 ${pr}</span>` : '—';
        const nameCell = pr > 0 ? `👑 ${p.username}` : p.username;
        tr.innerHTML = `<td>${i+1}</td><td>${nameCell}</td><td class="gold">${money(p.lifetime)}</td>
          <td>${money(p.netWorth)}</td><td>${p.guild||'—'}</td><td>${p.wins||0}W/${p.losses||0}L</td>
          <td>${badge}</td>`;
        tb.appendChild(tr);
      });
    } catch (e) { toast(e.message); }
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  function setupTabs() {
    qsa('nav.tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('nav.tabs button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        qsa('section[data-view]').forEach(s=>s.classList.toggle('hidden', s.dataset.view!==tab));
        if (tab==='pvp')        { loadOpponents(); updateRecord(); }
        if (tab==='guild')      { loadGuilds(); refreshGuildIfMember(); }
        if (tab==='board')      loadBoard();
        if (tab==='challenges') { renderChallenges(); renderAchievementList(); }
        if (tab==='ragnarok') updateFinalBoss();
      });
    });
  }

  // ── State loading ──────────────────────────────────────────────────────────
  function loadState(blob) {
    if (!blob) return;
    try {
      const s = typeof blob==='string' ? JSON.parse(blob) : blob;
      Object.assign(state, s);
      ALL_ROOMS.forEach(room => { state[room] = Object.assign({cleared:false,best:0,upgrades:{}}, s[room]); });
      ALL_ROOMS.forEach(room => { if (state[room].bossHp == null) state[room].bossHp = state[room].cleared ? 0 : BOSS[room].hp; if (typeof state[room].coins !== 'number') state[room].coins = 0; });
      state.finalBossHp = (typeof s.finalBossHp === 'number') ? s.finalBossHp : FINAL_BOSS.hp;
      state.finalBossDefeated = !!s.finalBossDefeated;
      state.achievements      = s.achievements      || [];
      state.milestones        = s.milestones        || [];
      state.crits             = s.crits             || 0;
      state.scratchWins       = s.scratchWins       || 0;
      state.jackpots          = s.jackpots          || 0;
      state.slotWins          = s.slotWins          || 0;
      state.slotJackpots      = s.slotJackpots      || 0;
      state.xp                = s.xp                || 0;
      state.level             = s.level             || 1;
      state.maxCombo          = s.maxCombo          || 0;
      state.luckyHours        = s.luckyHours        || 0;
      state.spins             = s.spins             || 0;
      state.lastSaveTime      = s.lastSaveTime      || 0;
      state.lastSpin          = s.lastSpin          || 0;
      state.focus             = 0;
      state.challenges        = s.challenges        || null;
      state.challengeDate     = s.challengeDate     || '';
      state.challengeProgress = s.challengeProgress || {};
      state.todayEarned       = s.todayDate===new Date().toDateString() ? (s.todayEarned||0) : 0;
      state.todayDate         = new Date().toDateString();
      state.throwCount        = s.throwCount        || 0;
    } catch {}
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  function startGame() {
    $('loginView').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('who').innerHTML = `Playing as <b>${auth.username}</b>`;
    setText('prestigeCount', auth.prestige);
    setText('prestigeMult', (prestigeMultiplier()*100).toFixed(0) + '%');
    setText('dailyStreak', auth.dailyStreak);
    setText('slotWins', state.slotWins || 0);
    setText('slotJackpots', state.slotJackpots || 0);

    renderUpgrades(); refreshTop(); checkAllClears(); updateFinalBoss();
    updatePrestigeBtn(); updateDailyBtn();
    setInterval(updateDailyBtn, 60000);

    if (typeof Anim !== 'undefined') {
      try { Anim.init(); Anim.initScratchCard('scratchRoomPanel'); } catch {}
    }
    if (typeof Music !== 'undefined') { try { Music.start(); } catch {} }

    if (typeof Dopamine !== 'undefined') {
      Dopamine.init(state, auth, perSecond, (amt)=>{ earn(amt); refreshTop(); });
      const offline = Dopamine.calcOffline();
      if (offline > 0) { earn(offline); refreshTop(); toast(`💤 Offline: +${money(offline)} earned while away (50% rate, 8h cap)`); }
    }

    ensureChallenges();
    connectWS();
    setInterval(tick, 100);
    setInterval(saveGame, 5000);
    setInterval(renderChallenges, 60000);
    window.addEventListener('beforeunload', saveGame);
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  async function register() {
    const username = $('usernameInput').value.trim();
    const password = $('passwordInput') ? $('passwordInput').value : '';
    try {
      const r = await api('/api/register', {username, password});
      auth = {username:r.username, token:r.token, prestige:r.prestige||0, dailyStreak:r.dailyStreak||0, lastClaim:r.lastClaim||0};
      loadState(r.state);
      startGame();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  async function login() {
    const username = $('usernameInput').value.trim();
    const password = $('passwordInput') ? $('passwordInput').value : '';
    try {
      const r = await api('/api/login', {username, password});
      auth = {username:r.username, token:r.token, prestige:r.prestige||0, dailyStreak:r.dailyStreak||0, lastClaim:r.lastClaim||0};
      loadState(r.state);
      startGame();
    } catch (e) { $('loginMsg').textContent = e.message; }
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadConfig();
    $('registerBtn').addEventListener('click', register);
    $('loginBtn').addEventListener('click', login);
    $('usernameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });

    $('throwBtn').addEventListener('click', throwDart);
    $('scratchBtn').addEventListener('click', scratchTicket);
    $('slotBtn').addEventListener('click', spinSlots);
    $('dropBtn').addEventListener('click', dropBall);
    $('cookBtn').addEventListener('click', cookSushi);
    $('pullBtn').addEventListener('click', pullGacha);
    var _sbtn = $('strikeBtn'); if (_sbtn) _sbtn.addEventListener('click', strikeFinalBoss);
    $('prestigeBtn').addEventListener('click', doPrestige);
    $('dailyBtn').addEventListener('click', claimDaily);
    const mute = $('muteBtn'); if (mute) mute.addEventListener('click', () => {
      const muted = (typeof Music!=='undefined' && Music.toggleMute) ? Music.toggleMute() : false;
      mute.textContent = muted ? '🔇' : '🔊';
    });
    $('refreshPlayers').addEventListener('click', loadOpponents);
    $('refreshGuilds').addEventListener('click', loadGuilds);
    $('refreshBoard').addEventListener('click', loadBoard);
    $('createGuildBtn').addEventListener('click', createGuild);
    $('leaveGuildBtn').addEventListener('click', leaveGuild);
    $('donate10Btn').addEventListener('click', ()=>donateGold(0.10));
    $('donate25Btn').addEventListener('click', ()=>donateGold(0.25));
    $('donate50Btn').addEventListener('click', ()=>donateGold(0.50));
    $('chatInput').addEventListener('keydown', e=>{
      if (e.key==='Enter' && e.target.value.trim()) { sendChat(e.target.value.trim()); e.target.value=''; }
    });

    // Spacebar acts on whichever click-room tab is active.
    const spaceMap = { darts: throwDart, pachinko: dropBall, sushi: cookSushi, gacha: pullGacha };
    document.addEventListener('keydown', e=>{
      if (e.code!=='Space' || $('app').classList.contains('hidden')) return;
      if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      for (const room of Object.keys(spaceMap)) {
        const sec = qs(`section[data-view="${room}"]`);
        if (sec && !sec.classList.contains('hidden')) { e.preventDefault(); spaceMap[room](); return; }
      }
    });
  });
})();
