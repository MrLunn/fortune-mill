# Fortune Mill — Text Edition

A text-based, browser-played incremental game inspired by the Steam game **Fortune Mill**,
with online **PvP duels** and **guilds**. Runs on Node with **zero dependencies** — no `npm install`.

## What it is

Grind each "room" to **$1,000,000** through quick text minigames, spend your gold on
upgrades and automation, then take your build online to fight other players and team up in guilds.

This MVP ships with **2 of the 5 rooms**:

- **🎯 Dart Room** — throw darts (or hit space) for gold. Time-and-luck based payouts, crits, and
  a "Machine-Gun Mouse" that auto-throws for you.
- **🎟 Scratcher Room** — buy tickets across 5 unlockable tiers (Penny → Mythic), chase jackpots,
  hire the Toad Accountant for better odds, and a robot to auto-scratch.

**Cross-room synergy:** clearing the Scratcher room boosts dart gold +50%; clearing the Dart room
adds +20% scratcher luck. (The same hook is how the full 5-room version would chain together.)

## Online features

- **⚔ PvP Duels** — your duel power is derived from your build (ATK from dart value, crit% from
  luck, HP from net worth). Duels are resolved **on the server** from each player's saved stats,
  so you can challenge people whether they're online or not. Offline opponents get a ping next time
  they connect.
- **🛡 Guilds** — found or join a guild, see a combined "treasure" leaderboard (sum of members'
  lifetime earnings), and chat live with your guild over WebSocket.
- **🏆 Leaderboard** — global ranking by lifetime earnings.

## Run it

You need **Node.js 16+**. Then:

```
cd fortune-mill
node server.js
```

Open **http://localhost:3000** in your browser. Pick a username and start grinding.

> To run on a different port: `PORT=8080 node server.js`

### Try PvP and guilds locally

Open a second browser tab (or window) at the same URL and register a *different* username.
Now each tab is a separate player — you can duel each other, found a guild in one tab, and join it
from the other. Guild chat updates live across tabs.

## How it's built

- **`server.js`** — a self-contained Node server using only built-ins (`http`, `fs`, `crypto`).
  Serves the static front-end, exposes a small JSON API, persists everything to `data.json`,
  and includes a hand-rolled WebSocket server (RFC 6455) for chat and duel pings.
- **`public/index.html`** — the terminal-style UI shell and styling.
- **`public/game.js`** — the incremental engine (rooms, upgrades, automation, synergy),
  plus all the networking for save/load, PvP, guilds, and chat.
- **`data.json`** — created on first run; holds players and guilds. Delete it to wipe all progress.

## Notes / caveats (it's an MVP)

- **No passwords.** Players are identified by a token issued at registration and held in the page.
  Fine for playing with friends; not meant for the public internet as-is.
- Game simulation runs client-side, so a determined player could edit their own numbers. The
  server clamps obviously-bad values but doesn't fully validate progress. For a competitive launch
  you'd move more of the simulation server-side.
- Single-file JSON storage is great for a small group; swap in SQLite/Postgres if it grows.

## Where to take it next

- Add the remaining 3 rooms (Pachinko, Sushi Match-2, Gacha pets) — each is just a new minigame
  function + an upgrades list, wired to the same earn/clear/synergy hooks.
- Guild challenges / co-op goals (shared treasure targets that unlock buffs).
- Prestige / reset layer for long-term progression.
- Server-authoritative earning to harden PvP fairness.

Have fun in the Mill.
