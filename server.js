// Fortune Mill (text edition) — zero-dependency Node server.
// Uses only Node built-ins: http, fs, crypto. No `npm install` needed.
// Run with:  node server.js   then open http://localhost:3000
// All files (server + client) live in one flat folder — no subfolders.

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(__dirname, 'data.json');

// Only these files are ever served to the browser. Everything else
// (server.js, data.json, package.json, etc.) stays private.
const STATIC_WHITELIST = new Set(['index.html', 'game.js', 'animations.js', 'music.js', 'dopamine.js']);

let db = { players: {}, guilds: {} };
try {
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db.players = db.players || {};
    db.guilds = db.guilds || {};
  }
} catch (e) {
  console.error('Could not read data.json, starting fresh:', e.message);
}

const TEMP_FILE = DATA_FILE + '.tmp';
let saveTimer = null;
function saveDB() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const payload = JSON.stringify(db);
    // Write to temp file then atomically rename — prevents corrupt data.json on crash
    fs.writeFile(TEMP_FILE, payload, (err) => {
      if (err) { console.error('Save (write) failed:', err.message); return; }
      fs.rename(TEMP_FILE, DATA_FILE, (err2) => {
        if (err2) console.error('Save (rename) failed:', err2.message);
      });
    });
  }, 500);
}

const token = () => crypto.randomBytes(16).toString('hex');

function combatPower(p) {
  const s = p.combat || {};
  return Math.round((s.atk || 1) * 10 + (s.luck || 0) * 5 + (s.hp || 100));
}

function publicPlayer(p) {
  return {
    username: p.username,
    netWorth: p.netWorth || 0,
    lifetime: p.lifetime || 0,
    power: combatPower(p),
    guild: p.guild || null,
    wins: p.wins || 0,
    losses: p.losses || 0,
    prestige: p.prestige || 0,
  };
}

const findPlayerByToken = (tok) =>
  tok ? Object.values(db.players).find((p) => p.token === tok) || null : null;

function guildTreasure(g) {
  const memberSum = g.members.reduce((sum, m) => {
    const p = db.players[m.toLowerCase()];
    return sum + (p ? p.lifetime || 0 : 0);
  }, 0);
  return memberSum + (g.bonusTreasure || 0);
}

function guildView(key) {
  const g = db.guilds[key];
  if (!g) return null;
  const members = g.members
    .map((m) => {
      const p = db.players[m.toLowerCase()];
      return p ? publicPlayer(p) : { username: m, lifetime: 0, power: 0 };
    })
    .sort((a, b) => b.lifetime - a.lifetime);
  return { name: g.name, leader: g.leader, treasure: guildTreasure(g), members, chat: (g.chat || []).slice(-50) };
}

function resolveDuel(a, b) {
  const mk = (p) => {
    const s = p.combat || {};
    return {
      name: p.username,
      hp: Math.max(20, s.hp || 100),
      atk: Math.max(1, s.atk || 1),
      luck: Math.min(0.75, (s.luck || 0) / 100),
    };
  };
  const A = mk(a), B = mk(b), log = [];
  log.push(`${A.name} (${A.hp} HP / ${A.atk} ATK) vs ${B.name} (${B.hp} HP / ${B.atk} ATK)`);
  const swing = (att, def) => {
    const crit = Math.random() < att.luck;
    let dmg = Math.max(1, Math.round(att.atk * (0.7 + Math.random() * 0.6) * (crit ? 2 : 1)));
    def.hp -= dmg;
    log.push(`${att.name} hits ${def.name} for ${dmg}${crit ? ' (CRIT!)' : ''}. ${def.name} at ${Math.max(0, def.hp)} HP.`);
  };
  let turn = A.atk + A.luck * 100 >= B.atk + B.luck * 100 ? 0 : 1;
  let rounds = 0;
  while (A.hp > 0 && B.hp > 0 && rounds < 200) {
    if (turn === 0) swing(A, B); else swing(B, A);
    turn = 1 - turn; rounds++;
  }
  const winner = A.hp > 0 ? A.name : B.name;
  log.push(`Winner: ${winner}!`);
  return { winner, log };
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon' };

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const name = path.basename(urlPath);
  if (!STATIC_WHITELIST.has(name)) { res.writeHead(404); return res.end('Not found'); }
  const filePath = path.join(ROOT_DIR, name);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 262144) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function handleApi(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;
  const body = method === 'POST' ? await readBody(req) : {};

  if (url === '/api/register' && method === 'POST') {
    const username = String(body.username || '').trim().slice(0, 20);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return sendJSON(res, 400, { error: 'Username must be 3-20 letters, numbers, or underscores.' });
    if (db.players[username.toLowerCase()]) return sendJSON(res, 409, { error: 'That name is taken. Try logging in.' });
    const p = { username, token: token(), state: null, netWorth: 0, lifetime: 0, combat: { atk: 1, luck: 0, hp: 100 }, guild: null, wins: 0, losses: 0, prestige: 0, dailyStreak: 0, lastClaim: 0, created: Date.now() };
    db.players[username.toLowerCase()] = p;
    saveDB();
    return sendJSON(res, 200, { username: p.username, token: p.token, state: null, prestige: 0, dailyStreak: 0, lastClaim: 0 });
  }

  if (url === '/api/login' && method === 'POST') {
    const p = db.players[String(body.username || '').trim().toLowerCase()];
    if (!p) return sendJSON(res, 404, { error: 'No such player. Register first.' });
    return sendJSON(res, 200, { username: p.username, token: p.token, state: p.state, guild: p.guild, prestige: p.prestige || 0, dailyStreak: p.dailyStreak || 0, lastClaim: p.lastClaim || 0 });
  }

  if (url === '/api/save' && method === 'POST') {
    const p = findPlayerByToken(body.token);
    if (!p) return sendJSON(res, 401, { error: 'Bad token.' });
    p.state = body.state || p.state;
    if (typeof body.netWorth === 'number') p.netWorth = body.netWorth;
    if (typeof body.lifetime === 'number') p.lifetime = Math.max(p.lifetime || 0, body.lifetime);
    if (body.combat && typeof body.combat === 'object') {
      p.combat = {
        atk: Math.max(1, Number(body.combat.atk) || 1),
        luck: Math.max(0, Number(body.combat.luck) || 0),
        hp: Math.max(100, Number(body.combat.hp) || 100),
      };
    }
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  if (url === '/api/prestige' && method === 'POST') {
    const p = findPlayerByToken(body.token);
    if (!p) return sendJSON(res, 401, { error: 'Bad token.' });
    const s = body.state || {};
    const dartsCleared = s.darts && s.darts.cleared;
    const scratchCleared = s.scratch && s.scratch.cleared;
    if (!dartsCleared || !scratchCleared) return sendJSON(res, 400, { error: 'Clear both rooms first.' });
    p.prestige = (p.prestige || 0) + 1;
    // Reset progress state but preserve lifetime, wins/losses, guild
    p.state = null;
    p.netWorth = 0;
    saveDB();
    return sendJSON(res, 200, { prestige: p.prestige });
  }

  if (url === '/api/daily/claim' && method === 'POST') {
    const p = findPlayerByToken(body.token);
    if (!p) return sendJSON(res, 401, { error: 'Bad token.' });
    const now = Date.now();
    const last = p.lastClaim || 0;
    const hoursSinceLast = (now - last) / 3600000;
    if (hoursSinceLast < 24) {
      const nextIn = Math.ceil(24 - hoursSinceLast);
      return sendJSON(res, 400, { error: `Already claimed today. Next reward in ~${nextIn}h.` });
    }
    // Streak: resets if more than 48h since last claim
    const streak = hoursSinceLast < 48 ? (p.dailyStreak || 0) + 1 : 1;
    const cappedStreak = Math.min(streak, 7);
    const prestige = p.prestige || 0;
    const baseReward = Math.round(500 * Math.pow(3, prestige));
    const reward = Math.round(baseReward * (1 + (cappedStreak - 1) * 0.2));
    p.lastClaim = now;
    p.dailyStreak = streak;
    saveDB();
    return sendJSON(res, 200, { reward, streak: cappedStreak, prestige });
  }

  if (url === '/api/leaderboard' && method === 'GET') {
    const players = Object.values(db.players).map(publicPlayer).sort((a, b) => b.lifetime - a.lifetime).slice(0, 25);
    return sendJSON(res, 200, { players });
  }
  if (url === '/api/players' && method === 'GET') {
    const players = Object.values(db.players).map(publicPlayer).sort((a, b) => b.power - a.power).slice(0, 50);
    return sendJSON(res, 200, { players });
  }

  if (url === '/api/pvp/challenge' && method === 'POST') {
    const me = findPlayerByToken(body.token);
    if (!me) return sendJSON(res, 401, { error: 'Bad token.' });
    const target = db.players[String(body.opponent || '').toLowerCase()];
    if (!target) return sendJSON(res, 404, { error: 'Opponent not found.' });
    if (target.username === me.username) return sendJSON(res, 400, { error: 'You cannot duel yourself.' });
    const { winner, log } = resolveDuel(me, target);
    if (winner === me.username) { me.wins = (me.wins || 0) + 1; target.losses = (target.losses || 0) + 1; }
    else { me.losses = (me.losses || 0) + 1; target.wins = (target.wins || 0) + 1; }
    saveDB();
    wsBroadcastToUser(target.username, { type: 'duel', from: me.username, won: winner === target.username, log });
    return sendJSON(res, 200, { winner, log, youWon: winner === me.username });
  }

  if (url === '/api/guild/create' && method === 'POST') {
    const me = findPlayerByToken(body.token);
    if (!me) return sendJSON(res, 401, { error: 'Bad token.' });
    const name = String(body.name || '').trim().slice(0, 24);
    if (!/^[A-Za-z0-9 _-]{3,24}$/.test(name)) return sendJSON(res, 400, { error: 'Guild name must be 3-24 characters.' });
    const key = name.toLowerCase();
    if (db.guilds[key]) return sendJSON(res, 409, { error: 'A guild with that name exists.' });
    if (me.guild) return sendJSON(res, 400, { error: 'Leave your current guild first.' });
    db.guilds[key] = { name, leader: me.username, members: [me.username], created: Date.now(), chat: [] };
    me.guild = name;
    saveDB();
    return sendJSON(res, 200, { guild: guildView(key) });
  }
  if (url === '/api/guild/join' && method === 'POST') {
    const me = findPlayerByToken(body.token);
    if (!me) return sendJSON(res, 401, { error: 'Bad token.' });
    if (me.guild) return sendJSON(res, 400, { error: 'Leave your current guild first.' });
    const key = String(body.name || '').trim().toLowerCase();
    const g = db.guilds[key];
    if (!g) return sendJSON(res, 404, { error: 'No such guild.' });
    if (!g.members.includes(me.username)) g.members.push(me.username);
    me.guild = g.name;
    saveDB();
    return sendJSON(res, 200, { guild: guildView(key) });
  }
  if (url === '/api/guild/leave' && method === 'POST') {
    const me = findPlayerByToken(body.token);
    if (!me) return sendJSON(res, 401, { error: 'Bad token.' });
    if (!me.guild) return sendJSON(res, 400, { error: 'You are not in a guild.' });
    const key = me.guild.toLowerCase();
    const g = db.guilds[key];
    if (g) {
      g.members = g.members.filter((m) => m !== me.username);
      if (g.leader === me.username) g.leader = g.members[0] || null;
      if (g.members.length === 0) delete db.guilds[key];
    }
    me.guild = null;
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }
  if (url === '/api/guild/donate' && method === 'POST') {
    const me = findPlayerByToken(body.token);
    if (!me) return sendJSON(res, 401, { error: 'Bad token.' });
    if (!me.guild) return sendJSON(res, 400, { error: 'You are not in a guild.' });
    const amount = Math.max(0, Math.floor(Number(body.amount) || 0));
    if (amount < 1) return sendJSON(res, 400, { error: 'Amount must be at least $1.' });
    // Donation is purely symbolic server-side (treasure is sum of member lifetime)
    // We record it as bonus treasure on the guild itself
    const key = me.guild.toLowerCase();
    const g   = db.guilds[key];
    if (!g) return sendJSON(res, 404, { error: 'Guild not found.' });
    g.bonusTreasure = (g.bonusTreasure || 0) + amount;
    const treasure = guildTreasure(g);
    saveDB();
    // Broadcast treasury update to guild members
    wsBroadcastToGuild(me.guild, { type: 'guild_update', treasure });
    return sendJSON(res, 200, { ok: true, treasure });
  }

  if (url === '/api/guilds' && method === 'GET') {
    const guilds = Object.keys(db.guilds).map((k) => {
      const g = db.guilds[k];
      return { name: g.name, members: g.members.length, leader: g.leader, treasure: guildTreasure(g) };
    }).sort((a, b) => b.treasure - a.treasure);
    return sendJSON(res, 200, { guilds });
  }
  if (url.startsWith('/api/guild/') && method === 'GET') {
    const key = decodeURIComponent(url.slice('/api/guild/'.length)).toLowerCase();
    const g = db.guilds[key];
    if (!g) return sendJSON(res, 404, { error: 'No such guild.' });
    return sendJSON(res, 200, { guild: guildView(key) });
  }

  return sendJSON(res, 404, { error: 'Unknown endpoint.' });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res).catch((e) => sendJSON(res, 500, { error: e.message }));
  } else {
    serveStatic(req, res);
  }
});

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const sockets = new Map();

function wsBroadcastToUser(username, obj) {
  const set = sockets.get(username);
  if (!set) return;
  const frame = encodeFrame(JSON.stringify(obj));
  for (const sock of set) { try { sock.write(frame); } catch (_) {} }
}
function wsBroadcastToGuild(guildName, obj) {
  if (!guildName) return;
  const g = db.guilds[guildName.toLowerCase()];
  if (!g) return;
  for (const m of g.members) wsBroadcastToUser(m, obj);
}

function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.user = null;
  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f;
      const masked = buffer[1] & 0x80;
      let len = buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (buffer.length < 10) return; len = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + len) return;
      const mask = masked ? buffer.slice(offset, offset + 4) : null;
      const dataStart = offset + maskLen;
      const payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) {
        payload[i] = masked ? buffer[dataStart + i] ^ mask[i % 4] : buffer[dataStart + i];
      }
      buffer = buffer.slice(dataStart + len);

      if (opcode === 0x8) { socket.end(); return; }
      if (opcode === 0x9) { socket.write(Buffer.from([0x8a, 0x00])); continue; }
      if (opcode !== 0x1) continue;
      handleWsMessage(socket, payload.toString('utf8'));
    }
  });

  const cleanup = () => {
    if (socket.user && sockets.has(socket.user)) {
      sockets.get(socket.user).delete(socket);
      if (sockets.get(socket.user).size === 0) sockets.delete(socket.user);
    }
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

function handleWsMessage(socket, raw) {
  let m; try { m = JSON.parse(raw); } catch { return; }

  if (m.type === 'auth') {
    const p = findPlayerByToken(m.token);
    if (!p) { socket.write(encodeFrame(JSON.stringify({ type: 'error', error: 'bad token' }))); return; }
    socket.user = p.username;
    if (!sockets.has(p.username)) sockets.set(p.username, new Set());
    sockets.get(p.username).add(socket);
    socket.write(encodeFrame(JSON.stringify({ type: 'auth_ok', username: p.username })));
    return;
  }
  if (!socket.user) return;

  if (m.type === 'guild_chat') {
    const p = db.players[socket.user.toLowerCase()];
    if (!p || !p.guild) return;
    const g = db.guilds[p.guild.toLowerCase()];
    if (!g) return;
    const entry = { user: p.username, text: String(m.text || '').slice(0, 280), ts: Date.now() };
    g.chat = g.chat || [];
    g.chat.push(entry);
    if (g.chat.length > 200) g.chat = g.chat.slice(-200);
    saveDB();
    wsBroadcastToGuild(p.guild, { type: 'guild_chat', ...entry });
  }
}

server.listen(PORT, () => {
  console.log(`Fortune Mill (text) running at http://localhost:${PORT}`);
});
