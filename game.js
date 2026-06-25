/* Fortune Mill — client engine
 * Rooms: Darts, Scratchers, Slots, Pachinko, Sushi, Gacha.
 * Plus PvP, Guilds, Prestige, Challenges, XP, achievements, focus, music, animations.
 */
(() => {
  'use strict';

  const ROOM_GOAL = 1_000_000;
  const NEW_ROOMS = ['pachinko', 'sushi', 'gacha'];
  const ALL_ROOMS = ['darts', 'scratch', 'slots', 'pachinko', 'sushi', 'gacha'];
  const ROOM_LABEL = { darts:'Dart', scratch:'Scratcher', slots:'Slot', pachinko:'Pachinko', sushi:'Sushi', gacha:'Gacha' };

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
  };

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
    { name:'Penny',   cost:5,      maxWin:25      },
    { name:'Silver',  cost:50,     maxWin:300     },
    { name:'Gold',    cost:500,    maxWin:4000    },
    { name:'Diamond', cost:5000,   maxWin:60000   },
    { name:'Mythic',  cost:50000,  maxWin:900000  },
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
    { name:'Common',    mult:1,   cls:''     },
    { name:'Rare',      mult:6,   cls:'good' },
    { name:'Epic',      mult:30,  cls:'good' },
    { name:'Legendary', mult:150, cls:'gold' },
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
    const ev = scratchAuto() * (t.maxWin * (0.25 + scratchLuck()) * 0.5 * jackpotMult() - t.cost);
    const sb = SLOT_BETS[Math.max(0, unlockedBets()-1)];
    const slotEv = slotAuto() * (sb.cost * (0.64 * slotMult() * (1 + slotLuck()) - 1));
    const pac = pachinkoAuto() * pachinkoValue() * (2 + pachinkoLuck()*25);
    const sus = sushiAuto()    * sushiValue()    * ((0.35 + sushiLuck())*2);
    const gac = gachaAuto()    * gachaValue()    * (1.5 + gachaLuck()*30);
    return Math.max(0, fromDarts + Math.max(0,ev) + Math.max(0,slotEv) + pac + sus + gac);
  }

  function combat() {
    return {
      atk:  Math.max(1, Math.round(dartValue() + 0.5*pachinkoValue() + 0.4*sushiValue())),
      luck: Math.round(dartCrit()*100 + scratchLuck()*50 + pachinkoLuck()*60 + sushiLuck()*50 + gachaLuck()*60),
      hp:   Math.max(100, Math.round(100 + Math.sqrt(state.lifetime) + 20*clearedCount())),
    };
  }

  // ── Earning ────────────────────────────────────────────────────────────────
  function earn(amount) {
    const comboM = typeof Dopamine !== 'undefined' ? Dopamine.getComboMult()              : 1;
    const luckyM = typeof Dopamine !== 'undefined' && Dopamine.isLucky()                  ? 2 : 1;
    const levelM = typeof Dopamine !== 'undefined' ? Dopamine.getLevelBonus()             : 1;
    const achM   = typeof Dopamine !== 'undefined' ? Dopamine.getAchievementBonus()       : 1;
    const guildM = getGuildBuff()?.mult || 1;
    const focM   = 1 + focusBonus();

    const boosted = amount * prestigeMultiplier() * comboM * luckyM * levelM * achM * guildM * focM;
    state.gold     += boosted;
    state.lifetime += boosted;

    const today = new Date().toDateString();
    if (state.todayDate !== today) { state.todayDate = today; state.todayEarned = 0; }
    state.todayEarned += boosted;

    if (typeof Dopamine !== 'undefined') {
      Dopamine.addXP(boosted);
      Dopamine.checkMilestones(state.lifetime);
    }
  }

  // ── Room clear check ───────────────────────────────────────────────────────
  function checkClear(room, goalId, textId) {
    const best = state[room]?.best || 0;
    const pct  = Math.min(100, (best / ROOM_GOAL) * 100);
    if ($(goalId)) $(goalId).style.width = pct.toFixed(1) + '%';
    if ($(textId)) $(textId).textContent = state[room]?.cleared
      ? `CLEARED ✓  (best single payout: ${money(best)})`
      : `Best payout: ${money(best)} / ${money(ROOM_GOAL)} to clear`;
    if (!state[room]?.cleared && best >= ROOM_GOAL) {
      state[room].cleared = true;
      toast(`🎉 ${ROOM_LABEL[room]||room} room CLEARED! Synergy bonus unlocked.`);
      updatePrestigeBtn();
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
    earn(payout);

    state.darts.best    = Math.max(state.darts.best, payout);
    state.crits         = (state.crits || 0) + (crit ? 1 : 0);
    state.throwCount    = (state.throwCount || 0) + 1;

    addFocus(8);
    updateChallengeProgress('throw_count', 1);
    if (crit) updateChallengeProgress('crits', 1);

    if (typeof Dopamine !== 'undefined') { Dopamine.onThrow(); Dopamine.checkAchievements(); }

    logTo('dartsLog', `🎯 ${crit?'CRIT! ':''}Hit ${money(payout)} (${Math.round(accuracy*100)}% acc)`, crit?'good':'');
    if (typeof Anim !== 'undefined') { try { Anim.throwDart(accuracy, crit); } catch {} }
    AnimFloat('+'+money(payout), $('throwBtn'), crit?'#ffd166':'#00e87a');
    SFX('sfxDart', crit);
    refreshTop();
    checkClear('darts','dartsGoal','dartsGoalText');
  }

  // ── Scratch actions ────────────────────────────────────────────────────────
  function scratchTicket() {
    const tierIdx  = parseInt($('ticketTier').value,10) || 0;
    const t        = TICKETS[tierIdx];
    if (state.gold < t.cost) { toast(`Need ${money(t.cost)} for a ${t.name} ticket.`); return; }
    state.gold -= t.cost;

    const won    = Math.random() < (0.25 + scratchLuck());
    if (won) {
      const jackpot = Math.random() < (0.04 + lvl('scratch','elite_luck')*0.01);
      let   win     = t.maxWin * (0.2 + Math.random() * 0.8);
      if (jackpot)  win = t.maxWin * jackpotMult();
      win = Math.max(t.cost, Math.floor(win));
      earn(win);
      state.scratch.best = Math.max(state.scratch.best, win);
      state.scratchWins  = (state.scratchWins||0) + 1;
      if (jackpot) { state.jackpots = (state.jackpots||0)+1; updateChallengeProgress('jackpots',1); }
      updateChallengeProgress('scratchWins',1);
      logTo('scratchLog', `🎟 ${jackpot?'💰 JACKPOT! ':''}${t.name} won ${money(win)}`, jackpot?'good':'');
      if (typeof Anim !== 'undefined') { try { Anim.revealScratch(true, jackpot); } catch {} }
      AnimFloat('+'+money(win), $('scratchBtn'), jackpot?'#ffd166':'#00e87a');
      SFX('sfxWin', jackpot);
    } else {
      logTo('scratchLog', `🎟 ${t.name} — no win. (-${money(t.cost)})`, 'muted');
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
    const betIdx = parseInt($('slotBet').value,10) || 0;
    const bet    = SLOT_BETS[Math.min(betIdx, unlockedBets()-1)];
    if (state.gold < bet.cost) { toast(`Need ${money(bet.cost)} to spin.`); return; }

    state.gold -= bet.cost;
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
    let win = 0, logTxt = '', logCls = '';

    if (three) {
      const mult = SLOT_PAY3[r0] * slotMult() * (jackpot ? slotJackpotMult() : 1);
      win = Math.floor(bet.cost * mult);
      earn(win);
      state.slotWins     = (state.slotWins||0)+1;
      if (jackpot) { state.slotJackpots=(state.slotJackpots||0)+1; updateChallengeProgress('jackpots',1); }
      updateChallengeProgress('slotWins',1);
      state.slots.best = Math.max(state.slots.best||0, win);
      logTxt = `${res.join('')} — ${jackpot?'💎 JACKPOT! ':'3 OF A KIND! '}+${money(win)}`;
      logCls = jackpot ? 'good' : '';
      AnimFloat('+'+money(win), $('slotBtn'), jackpot?'#ffc820':'#00e87a');
      if (jackpot) { SFX('sfxWin', true); if(typeof Dopamine!=='undefined') Dopamine.shake('heavy'); }
      else         { SFX('sfxWin', false);if(typeof Dopamine!=='undefined') Dopamine.shake('light'); }
    } else if (two) {
      win = Math.floor(bet.cost * 1.5);
      earn(win);
      updateChallengeProgress('slotWins',1);
      state.slotWins = (state.slotWins||0)+1;
      state.slots.best = Math.max(state.slots.best||0, win);
      logTxt = `${res.join('')} — Pair! +${money(win)}`;
      AnimFloat('+'+money(win), $('slotBtn'), '#33aaff');
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

  // ── Pachinko actions ───────────────────────────────────────────────────────
  function dropBall() {
    const jackpot = Math.random() < (0.02 + pachinkoLuck());
    const slot = jackpot ? 25 : [0.3,0.5,1,1,2,3,5][Math.floor(Math.random()*7)];
    const payout = Math.max(1, pachinkoValue() * slot);
    earn(payout);
    state.pachinko.best = Math.max(state.pachinko.best, payout);
    if (jackpot) updateChallengeProgress('jackpots', 1);
    addFocus(6);
    logTo('pachinkoLog', `🪙 ${jackpot?'💥 25× JACKPOT SLOT! ':''}Ball landed ${slot}× → ${money(payout)}`, jackpot?'good':'');
    AnimFloat('+'+money(payout), $('dropBtn'), jackpot?'#ffc820':'#00e87a');
    SFX(jackpot ? 'sfxWin' : 'sfxDart', jackpot);
    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    checkClear('pachinko','pachinkoGoal','pachinkoGoalText');
  }

  // ── Sushi actions ──────────────────────────────────────────────────────────
  function cookSushi() {
    const won = Math.random() < (0.35 + sushiLuck());
    if (won) {
      const perfect = Math.random() < 0.04;
      const payout = Math.max(1, perfect ? sushiValue()*15 : sushiValue()*(1 + Math.random()*2));
      earn(payout);
      state.sushi.best = Math.max(state.sushi.best, payout);
      if (perfect) updateChallengeProgress('jackpots', 1);
      logTo('sushiLog', `🍣 ${perfect?'🌟 PERFECT COMBO! ':'Match! '}${money(payout)}`, perfect?'good':'');
      AnimFloat('+'+money(payout), $('cookBtn'), perfect?'#ffc820':'#00e87a');
      SFX('sfxWin', perfect);
    } else {
      logTo('sushiLog', `🍣 No match this time…`, 'muted');
      SFX('sfxLoss');
    }
    addFocus(6);
    if (typeof Dopamine !== 'undefined') Dopamine.checkAchievements();
    refreshTop();
    checkClear('sushi','sushiGoal','sushiGoalText');
  }

  // ── Gacha actions ──────────────────────────────────────────────────────────
  function pullGacha() {
    const L = gachaLuck();
    const r = Math.random();
    let rarity;
    if (r < 0.005 + 0.15*L) rarity = GACHA_RARITIES[3];
    else if (r < 0.03 + 0.30*L) rarity = GACHA_RARITIES[2];
    else if (r < 0.15 + 0.30*L) rarity = GACHA_RARITIES[1];
    else rarity = GACHA_RARITIES[0];
    const payout = Math.max(1, gachaValue() * rarity.mult * (1 + Math.random()));
    earn(payout);
    state.gacha.best = Math.max(state.gacha.best, payout);
    if (rarity.mult >= 150) updateChallengeProgress('jackpots', 1);
    addFocus(6);
    logTo('gachaLog', `🐾 Pulled a ${rarity.name} pet! +${money(payout)}`, rarity.cls);
    AnimFloat('+'+money(payout), $('pullBtn'), rarity.mult>=30?'#ffc820':'#00e87a');
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
    const level = lvl(room, def.id);
    if (level >= def.max) { toast('Maxed out.'); return; }
    const cost = costOf(def, level);
    if (state.gold < cost) { toast(`Need ${money(cost)} for ${def.name}.`); return; }
    state.gold -= cost;
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
      row.className = 'upgrade';
      row.innerHTML = `
        <div class="info">
          <div class="uname">${def.name} <span class="pill">Lv ${level}</span></div>
          <div class="udesc">${def.desc}</div>
          ${synergy ? `<div class="usynergy">${synergy}</div>` : ''}
        </div>
        <button class="act cost" ${maxed || state.gold < cost ? 'disabled' : ''}>
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
        row.className = 'upgrade';
        row.innerHTML = `
          <div class="info">
            <div class="uname" style="color:var(--purple);">${def.name} <span class="pill">Lv ${level}</span></div>
            <div class="udesc">${def.desc}</div>
          </div>
          <button class="act cost" style="border-color:var(--purple);color:var(--purple);" ${maxed || state.gold < cost ? 'disabled' : ''}>
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
      const cost = parseMoney(btn.textContent.trim());
      btn.disabled = state.gold < cost;
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
    setText('netWorth', money(state.gold));
    setText('lifetime', money(state.lifetime));
    setText('perSec',   money(perSecond()) + '/s');
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
      earn(a * dartValue() * (1 + dartCrit()*9) * dt);
      state.darts.best = Math.max(state.darts.best, dartValue() * (1+dartCrit()*9));
    }
    const s = scratchAuto();
    if (s > 0) {
      const t  = TICKETS[unlockedTiers()-1];
      const ev = (t.maxWin * (0.25+scratchLuck()) * 0.5 * jackpotMult() - t.cost);
      earn(Math.max(0, s*ev*dt));
    }
    const sa = slotAuto();
    if (sa > 0) {
      const sb  = SLOT_BETS[Math.max(0, unlockedBets()-1)];
      const slotEv = sb.cost * (0.64 * slotMult() * (1+slotLuck()) - 1);
      earn(Math.max(0, sa * slotEv * dt));
    }
    const pa = pachinkoAuto();
    if (pa > 0) { const per = pachinkoValue()*(2+pachinkoLuck()*25); earn(pa*per*dt); state.pachinko.best = Math.max(state.pachinko.best, per); }
    const su = sushiAuto();
    if (su > 0) { const per = sushiValue()*((0.35+sushiLuck())*2); earn(su*per*dt); state.sushi.best = Math.max(state.sushi.best, per); }
    const ga = gachaAuto();
    if (ga > 0) { const per = gachaValue()*(1.5+gachaLuck()*30); earn(ga*per*dt); state.gacha.best = Math.max(state.gacha.best, per); }

    if (a>0 || s>0 || sa>0 || pa>0 || su>0 || ga>0) { refreshTop(); checkAllClears(); }
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
    try { await api('/api/save', { token: auth.token, state, netWorth: state.gold, lifetime: state.lifetime, combat: combat() }); } catch {}
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
  function canPrestige() { return state.darts.cleared && state.scratch.cleared; }

  function updatePrestigeBtn() {
    const btn = $('prestigeBtn'); if (!btn) return;
    btn.disabled = !canPrestige();
    btn.title    = canPrestige() ? 'Reset progress for +50% permanent earnings' : 'Clear Darts and Scratchers first';
  }

  async function doPrestige() {
    if (!canPrestige()) { toast('Clear Darts and Scratchers first!'); return; }
    if (!confirm(`Prestige #${auth.prestige+1}? Gold and upgrades reset. Permanent +50% earnings boost stacks. Lifetime, wins, guilds kept.`)) return;
    await saveGame();
    try {
      const r    = await api('/api/prestige', {token:auth.token, state});
      auth.prestige = r.prestige;
      state.gold  = 0;
      ALL_ROOMS.forEach(room => { state[room] = {cleared:false,best:0,upgrades:{}}; });
      renderUpgrades(); refreshTop(); checkAllClears();
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
    const amount = Math.floor(state.gold * fraction);
    if (amount < 1) { toast('Not enough gold to donate.'); return; }
    try {
      const r = await api('/api/guild/donate', {token:auth.token, amount});
      state.gold -= amount;
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
        const star = '✨'.repeat(p.prestige||0).slice(0,14)||'—';
        tr.innerHTML = `<td>${i+1}</td><td>${p.username}</td><td class="gold">${money(p.lifetime)}</td>
          <td>${money(p.netWorth)}</td><td>${p.guild||'—'}</td><td>${p.wins||0}W/${p.losses||0}L</td>
          <td title="${p.prestige||0} prestige(s)">${star}</td>`;
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

    renderUpgrades(); refreshTop(); checkAllClears();
    updatePrestigeBtn(); updateDailyBtn();
    setInterval(updateDailyBtn, 60000);

    if (typeof Anim !== 'undefined') {
      try { Anim.init(); Anim.initDartboard('dartRoomPanel'); Anim.initScratchCard('scratchRoomPanel'); } catch {}
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
