/* Fortune of Valhalla — real WebGL 3D scenes (Three.js r128).
 * One shared renderer shows a lit, rotating 3D centerpiece per room, mounted
 * into that room's stage. Every entry point is guarded; if THREE is missing or
 * WebGL fails, Scene3D silently disables and the CSS scenes remain as fallback.
 * Exposes: Scene3D.init(), Scene3D.setRoom(room), Scene3D.hit(room, big)
 */
window.Scene3D = (function () {
  'use strict';
  let ok = false, renderer, scene, camera, clock, current = 'darts', mountEl = null;
  const groups = {};
  const act = {}; // room -> { t, big }

  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, metalness: 0.45, roughness: 0.5 }, opts || {}));
  }

  // ── Room model builders ─────────────────────────────────────────────────────
  function buildDarts() {
    const g = new THREE.Group();
    const board = new THREE.Group();
    const rings = [[1.5, 0xb08a4c], [1.05, 0x6e1c1c], [0.62, 0xb08a4c], [0.26, 0xc0392b]];
    rings.forEach(function (rc, i) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rc[0], rc[0], 0.16 - i * 0.012, 44), mat(rc[1], { roughness: 0.75, metalness: 0.2 }));
      m.rotation.x = Math.PI / 2; m.position.z = -0.03 * i; board.add(m);
    });
    board.position.x = 0.85; g.add(board); g.userData.board = board;
    const axe = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.2, 14), mat(0x6b4a2a, { roughness: 0.85, metalness: 0.1 }));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.09), mat(0xcfd3d8, { metalness: 0.9, roughness: 0.25 }));
    blade.position.set(0.24, 0.52, 0);
    axe.add(handle, blade);
    axe.position.set(-1.5, 0, 0.5); axe.rotation.z = 0.4;
    g.add(axe); g.userData.axe = axe;
    return g;
  }
  function buildRune() {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.34), mat(0x2c2620, { roughness: 0.95, metalness: 0.05 }));
    g.add(slab);
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xa877e0, emissive: 0x6a3fb0, emissiveIntensity: 0.5, roughness: 0.4 }));
    rune.position.z = 0.19; g.add(rune); g.userData.rune = rune;
    return g;
  }
  function buildCoin() {
    const g = new THREE.Group();
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0xf0b429, metalness: 0.95, roughness: 0.25, emissive: 0x3a2a00, emissiveIntensity: 0.3 }));
    coin.rotation.x = Math.PI / 2; g.add(coin); g.userData.coin = coin;
    return g;
  }
  function buildBoulder() {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), mat(0x7c7a72, { roughness: 1, metalness: 0.05, flatShading: true }));
    g.add(rock); g.userData.rock = rock;
    return g;
  }
  function buildTankard() {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.62, 1.3, 28), mat(0xd9b66a, { metalness: 0.85, roughness: 0.3 }));
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.2, 28), mat(0xfff4e0, { roughness: 0.7, metalness: 0 }));
    foam.position.y = 0.72;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 12, 24), mat(0xb89248, { metalness: 0.85, roughness: 0.3 }));
    handle.position.set(0.78, 0, 0); handle.rotation.y = Math.PI / 2;
    g.add(cup, foam, handle);
    return g;
  }
  function buildCrystal() {
    const g = new THREE.Group();
    const cry = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), new THREE.MeshStandardMaterial({ color: 0x46c0e8, emissive: 0x1466aa, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.2, flatShading: true }));
    g.add(cry); g.userData.cry = cry;
    return g;
  }

  function buildAll() {
    groups.darts = buildDarts();
    groups.scratch = buildRune();
    groups.slots = buildCoin();
    groups.pachinko = buildBoulder();
    groups.sushi = buildTankard();
    groups.gacha = buildCrystal();
    Object.keys(groups).forEach(function (k) { groups[k].visible = false; scene.add(groups[k]); });
    if (groups[current]) groups[current].visible = true;
  }

  function init() {
    if (ok) return true;
    try {
      if (typeof THREE === 'undefined') return false;
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(300, 108, false);
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:8px;background:radial-gradient(ellipse at 50% 130%, rgba(255,255,255,0.05), transparent 62%), linear-gradient(180deg,#0e0a06,#050302);';
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 300 / 108, 0.1, 100);
      camera.position.set(0, 0.5, 5.2); camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0x99785a, 0.75));
      const key = new THREE.DirectionalLight(0xffe2b4, 1.15); key.position.set(3, 4, 5); scene.add(key);
      const rim = new THREE.PointLight(0x66ccff, 0.9, 40); rim.position.set(-4, 2, 3); scene.add(rim);
      buildAll();
      clock = new THREE.Clock();
      ok = true;
      loop();
      window.addEventListener('resize', resize);
      return true;
    } catch (e) { console.warn('Scene3D init failed; using CSS fallback.', e); ok = false; return false; }
  }

  function stageEl(room) { try { return document.querySelector('[data-stage="' + room + '"]'); } catch (e) { return null; } }

  function resize() {
    if (!ok || !mountEl) return;
    const w = mountEl.clientWidth || 300, h = mountEl.clientHeight || 108;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function setRoom(room) {
    if (!ok || !groups[room]) return;
    if (groups[current]) groups[current].visible = false;
    current = room; groups[current].visible = true;
    const el = stageEl(room);
    if (el) { mountEl = el; el.appendChild(renderer.domElement); resize(); }
  }

  function hit(room, big) { if (!ok) return; act[room] = { t: 0, big: !!big }; }

  function stepFx(dt, t) {
    // Idle motion
    const g = groups[current];
    if (g) {
      if (current === 'darts') { if (g.userData.board) g.userData.board.rotation.z += dt * 0.12; }
      else { g.rotation.y += dt * 0.6; }
      g.position.y = Math.sin(t * 1.3) * 0.05;
    }
    // Action flourishes
    const a = act[current];
    if (!a) return;
    a.t += dt;
    if (current === 'darts') {
      const axe = groups.darts.userData.axe, board = groups.darts.userData.board;
      const p = Math.min(1, a.t * 3.2);
      axe.position.x = -1.5 + 2.1 * p;
      axe.rotation.z = 0.4 + p * Math.PI * 4;
      if (p >= 1) {
        axe.position.x = 0.6;
        if (a.big && board) board.scale.setScalar(1 + 0.12 * Math.max(0, Math.sin((a.t - 0.31) * 22)));
        if (a.t > 0.9) { if (board) board.scale.setScalar(1); axe.position.set(-1.5, 0, 0.5); axe.rotation.z = 0.4; act.darts = null; }
      }
    } else if (current === 'scratch') {
      const r = groups.scratch.userData.rune;
      if (r) r.material.emissiveIntensity = 0.5 + Math.max(0, (a.big ? 2.2 : 1.2) * Math.sin(a.t * 10)) * Math.exp(-a.t * 3);
      if (a.t > 1) { if (r) r.material.emissiveIntensity = 0.5; act.scratch = null; }
    } else if (current === 'slots') {
      groups.slots.rotation.y += (a.big ? 30 : 16) * dt * Math.exp(-a.t * 2.5);
      if (a.t > 1.2) act.slots = null;
    } else if (current === 'pachinko') {
      groups.pachinko.position.y = Math.abs(Math.sin(a.t * 8)) * (a.big ? 0.6 : 0.3) * Math.exp(-a.t * 2);
      if (a.t > 1.1) { groups.pachinko.position.y = 0; act.pachinko = null; }
    } else if (current === 'sushi') {
      groups.sushi.rotation.z = Math.sin(a.t * 9) * (a.big ? 0.4 : 0.2) * Math.exp(-a.t * 3);
      if (a.t > 1) { groups.sushi.rotation.z = 0; act.sushi = null; }
    } else if (current === 'gacha') {
      const c = groups.gacha.userData.cry;
      const s = 1 + (a.big ? 0.35 : 0.18) * Math.max(0, Math.sin(a.t * 12)) * Math.exp(-a.t * 2.5);
      if (c) { c.scale.setScalar(s); c.material.emissiveIntensity = 0.6 + (a.big ? 1.4 : 0.7) * Math.exp(-a.t * 2.5); }
      if (a.t > 1.2) { if (c) { c.scale.setScalar(1); c.material.emissiveIntensity = 0.6; } act.gacha = null; }
    }
  }

  function loop() {
    if (!ok) return;
    requestAnimationFrame(loop);
    try {
      const dt = Math.min(0.05, clock.getDelta());
      stepFx(dt, clock.elapsedTime);
      renderer.render(scene, camera);
    } catch (e) { console.warn('Scene3D render error; disabling.', e); ok = false; try { renderer.domElement.remove(); } catch (_) {} }
  }

  return { init: init, setRoom: setRoom, hit: hit, isOn: function () { return ok; } };
})();
