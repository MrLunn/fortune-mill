# Deploying Fortune Mill so friends can play (free, always-on)

This puts your game on a permanent public URL using **Render's free tier** — no need to
keep your own PC running. Render deploys from a GitHub repo, so the flow is:
**put the code on GitHub → point Render at it → share the link.**

You do NOT need to be a programmer for this. Two accounts (GitHub + Render), both free.

---

## Step 1 — Put the project on GitHub

1. Make a free account at https://github.com if you don't have one.
2. Click the **+** (top-right) → **New repository**.
   - Name it `fortune-mill`
   - Set it to **Public**
   - Don't add a README (you already have one)
   - Click **Create repository**
3. On the new empty repo page, click **uploading an existing file** (the link in the
   "Quick setup" box). Then drag in **everything inside your `fortune-mill` folder**:
   - `server.js`
   - `package.json`
   - `render.yaml`
   - `.gitignore`
   - `README.md`
   - the entire `public` folder (`index.html` and `game.js`)

   > Do NOT upload `data.json` (it's local save data) or `node_modules` if present.
4. Click **Commit changes**.

---

## Step 2 — Deploy on Render

1. Make a free account at https://render.com (sign in with GitHub — it's easiest).
2. Click **New +** → **Blueprint**.
3. Choose your `fortune-mill` repo. Render finds the `render.yaml` and shows a
   service called **fortune-mill** on the **Free** plan.
4. Click **Apply** / **Create**. Render installs and starts it (takes 1–3 minutes).
5. When it's live, Render gives you a URL like
   **https://fortune-mill.onrender.com** — that's your public game link. Share it!

(If you'd rather not use the Blueprint: **New + → Web Service → pick the repo →**
Runtime **Node**, Build command `npm install`, Start command `node server.js`,
Instance type **Free**. Same result.)

---

## Updating the game later

Edit a file on GitHub (or re-upload it) and commit. Because `autoDeploy` is on,
Render rebuilds and redeploys automatically within a minute or two.

---

## Free-tier things to know

- **It sleeps when idle.** After ~15 minutes with no visitors, the free service spins
  down. The next person to open the link triggers a **10–30 second cold start**, then
  it's fast again. Tell friends "give it a few seconds if it's slow to load."
- **Saves can reset.** Free Render has no persistent disk, so `data.json` lives in
  temporary storage. A redeploy or a long sleep can wipe accounts/progress. That's fine
  for casual testing. If you want progress to truly persist, the next step is swapping
  `data.json` for a free hosted database (e.g. Render's free Postgres, or a service like
  Neon/Supabase) — I can wire that up when you're ready.
- **Anyone with the link can register.** There are no passwords yet. Keep the link to
  friends, or ask me to add a shared "room password" before you share it wider.

---

## TL;DR

GitHub upload → Render Blueprint → share the `onrender.com` link. Free, always-on,
WebSockets (guild chat + duels) work automatically over HTTPS.
