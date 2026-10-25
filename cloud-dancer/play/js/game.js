// Game: states (title, hangar, play, market, paused, over), the fixed-step loop with interpolated
// drawing, HUD, menus (keys and taps), music and sound cues, saving, and the ?god test hook.
(() => {
  const CD = window.CD;
  const art = CD.art;
  const DT = 1 / 60;
  const GOD = new URLSearchParams(location.search).has('god');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let scale = 1;

  // The whole 384x216 view always shows. On an upright phone it sits at the top, full width, and
  // the controls get the space below it (index.html pads the top).
  // `quality` scales the canvas below the screen's own resolution when frames run slow (a TV stick
  // driving a 1080p screen, an old phone); see frame().
  let quality = 1;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const top = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    // The view always fills the screen (`fit`, in CSS pixels); the canvas behind it has at most
    // 1080p's pixels (plenty, even on a 4K TV; 720p on a TV), times `quality`, and is stretched to fit.
    const fit = Math.min(window.innerWidth / CD.VIEW_W, (window.innerHeight - top) / CD.VIEW_H);
    const most = document.documentElement.classList.contains('tv') ? 1280 : 1920;   // a TV's graphics chip is slow
    scale = Math.min(fit * dpr, most / CD.VIEW_W) * quality;
    canvas.width = Math.round(CD.VIEW_W * scale);
    canvas.height = Math.round(CD.VIEW_H * scale);
    canvas.style.width = Math.round(CD.VIEW_W * fit) + 'px';
    canvas.style.height = Math.round(CD.VIEW_H * fit) + 'px';
  }
  let wasUpright = window.innerHeight > window.innerWidth;
  window.addEventListener('resize', () => {
    // Turning the phone mid-run can leave a touch hanging: let go and pause.
    const upright = window.innerHeight > window.innerWidth;
    if (upright !== wasUpright && touchMode()) { touch.release(); if (state === 'play') setState('paused'); }
    wasUpright = upright;
    resize();
  });

  let store = null;
  try { store = window.localStorage; } catch (e) { /* private window */ }
  const STORE = store || { getItem: () => null, setItem() {} };
  const profile = CD.loadProfile(STORE);
  const saveProfile = () => CD.saveProfile(STORE, profile);

  const input = CD.newInput();
  let state = 'title', t = 0, overT = 0, marketIn = 0, banked = null, beatenSeen = 0;
  let world, ship, touch = null, banner = null, areaShown = -1, market = null, hangar = null;
  const prev = new Map();          // object -> {x, y} at the start of the last step, for smooth drawing
  const statusEl = document.getElementById('status');
  const announce = msg => { statusEl.textContent = ''; setTimeout(() => { statusEl.textContent = msg; }, 50); };

  function setState(s) {
    state = s;
    document.documentElement.dataset.state = s;
    if (s !== 'play' && touch) touch.release();
  }

  // A fresh sky (behind the title, or for a new run).
  function freshWorld() {
    world = CD.makeWorld(Math.floor(Math.random() * 1e9));
    ship = CD.applyLoadout(CD.makeShip(), profile.equip);
    prev.clear();
    overT = 0; banner = null; areaShown = -1; market = null; marketIn = 0; banked = null; beatenSeen = 0;
  }
  function start() {
    freshWorld();
    setState('play');
    document.documentElement.classList.add('hint'); setTimeout(() => document.documentElement.classList.remove('hint'), 3500);
    announce('Cast off! Drag to steer, the cannons fire on their own.');
  }
  freshWorld(); setState('title');

  // ---------- the Hangar (between runs, banked gold) ----------
  CD.HLAYOUT = { top: 46, step: 13, labelX: 150, valueX: 268, priceX: 372, buy: { x: 150, y: 194, w: 70, h: 14 }, done: { x: 260, y: 194, w: 70, h: 14 } };
  function openHangar() {
    hangar = { row: 0, view: { ...profile.equip }, msg: '', msgT: 0 };
    setState('hangar');
    announce('The Hangar. Up and down to choose, left and right to change, space to buy.');
  }
  const hRow = () => CD.CATALOG[hangar.row];
  const hOption = () => hRow().options.find(o => o.id === hangar.view[hRow().key]);
  function hCycle(d) {
    const r = hRow(), i = r.options.findIndex(o => o.id === hangar.view[r.key]);
    hangar.view[r.key] = r.options[(i + d + r.options.length) % r.options.length].id;
    if (CD.owns(profile, r.key, hangar.view[r.key])) { CD.equip(profile, r.key, hangar.view[r.key]); saveProfile(); }
    CD.sfx && CD.sfx.play('hit');
  }
  function hBuy() {
    const r = hRow(), o = hOption();
    if (CD.owns(profile, r.key, o.id)) { hangar.msg = 'ALREADY YOURS'; hangar.msgT = 1; return; }
    const prev = r.options[r.options.indexOf(o) - 1];
    if (r.tiers && prev && prev.price && !CD.owns(profile, r.key, prev.id)) { hangar.msg = `FIT ${prev.name} FIRST`; hangar.msgT = 1.4; CD.sfx && CD.sfx.play('hurt'); return; }
    if (!CD.buy(profile, r.key, o.id)) { hangar.msg = 'NOT ENOUGH GOLD'; hangar.msgT = 1.2; CD.sfx && CD.sfx.play('hurt'); return; }
    CD.equip(profile, r.key, o.id); saveProfile();
    hangar.msg = 'FITTED!'; hangar.msgT = 1.2; CD.sfx && CD.sfx.play('pickup');
  }
  function closeHangar() {
    hangar = null; freshWorld(); setState('title');            // a clean sky behind the title, not the last run
  }

  // ---------- the Sky Market (after each boss, run gold) ----------
  // The Sky Market lists in two columns of `per` rows; `col` is where the second column starts.
  CD.MLAYOUT = { top: 54, step: 13, per: 8, col: 198, buy: { x: 150, y: 194, w: 70, h: 14 }, sail: { x: 260, y: 194, w: 70, h: 14 } };
  function openMarket() { market = CD.makeMarket(world, ship); setState('market'); announce('The Sky Market. Spend this run\'s gold.'); }
  function marketBuy() {
    const r = market.buy();
    if (r === 'leave') return leaveMarket();
    CD.sfx && CD.sfx.play(r === 'bought' ? 'pickup' : 'hurt');
  }
  function leaveMarket() { market = null; CD.castOff(world, ship); setState('play'); announce('Back to the skies.'); }

  const togglePause = () => { if (state === 'play') setState('paused'); else if (state === 'paused') setState('play'); };
  const canRestart = () => state === 'title' || (state === 'over' && overT > 0.8);
  CD.bindKeys(input, code => {
    CD.sfx && CD.sfx.unlock();
    if (code === 'KeyM') return CD.sfx && CD.sfx.toggleMute();
    if (state === 'hangar') {
      if (code === 'ArrowUp' || code === 'KeyW') hangar.row = (hangar.row + CD.CATALOG.length - 1) % CD.CATALOG.length;
      else if (code === 'ArrowDown' || code === 'KeyS') hangar.row = (hangar.row + 1) % CD.CATALOG.length;
      else if (code === 'ArrowLeft' || code === 'KeyA') hCycle(-1);
      else if (code === 'ArrowRight' || code === 'KeyD') hCycle(1);
      else if (code === 'Space' || code === 'KeyX') hBuy();
      else if (code === 'Enter' || code === 'Escape' || code === 'KeyH') closeHangar();
      input.dashPressed = false; return;
    }
    if (state === 'market') {
      if (code === 'ArrowUp' || code === 'KeyW') market.move(-1);
      else if (code === 'ArrowDown' || code === 'KeyS') market.move(1);
      else if ((code === 'ArrowLeft' || code === 'KeyA') && market.current().id === 'gun') market.cycle(-1);
      else if ((code === 'ArrowRight' || code === 'KeyD') && market.current().id === 'gun') market.cycle(1);
      else if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD') {   // across the columns
        const per = CD.MLAYOUT.per, n = market.rows().length, to = market.row + (market.row < per ? per : -per);
        market.row = Math.max(0, Math.min(n - 1, to));
      }
      else if (code === 'Space' || code === 'KeyX') marketBuy();
      else if (code === 'Enter' || code === 'Escape') leaveMarket();
      input.dashPressed = false; return;
    }
    if (code === 'KeyP' || code === 'Escape') return togglePause();
    if (code === 'KeyH' && canRestart()) return openHangar();
    if (canRestart() && (code === 'Enter' || code === 'Space')) { start(); input.dashPressed = false; }
  });
  // Controllers and TV remotes (js/pad.js). A (OK on a remote) starts, dashes and buys; B backs
  // out of a menu and dashes in the air; Back pauses or backs out, and leaves the app from the
  // title; X, Play/Pause and the right trigger dash; Y or Fast-forward opens the Hangar; Menu
  // starts or pauses.
  window.PAD = {
    code: name => {
      const menu = state === 'hangar' || state === 'market';
      switch (name) {
        case 'up': return 'ArrowUp';
        case 'down': return 'ArrowDown';
        case 'left': return 'ArrowLeft';
        case 'right': return 'ArrowRight';
        case 'a': return 'Space';
        case 'b': return state === 'play' ? 'KeyZ' : 'Escape';
        case 'back': return 'Escape';
        case 'x': case 'rt': return menu ? 'Space' : 'KeyZ';
        case 'y': case 'rb': return canRestart() ? 'KeyH' : null;
        case 'start': return canRestart() ? 'Enter' : menu ? 'Escape' : 'KeyP';
        default: return null;
      }
    },
    canExit: () => state === 'title',
    sideways: () => state === 'play',
  };
  touch = CD.initTouch(input, {
    canvas, ship: () => ship,
    onPause: () => { CD.sfx && CD.sfx.unlock(); togglePause(); },
    onMute: () => { CD.sfx && CD.sfx.unlock(); CD.sfx && CD.sfx.toggleMute(); },
  });
  const hit = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y - 3 && y <= b.y + b.h + 3;
  function tap(x, y) {
    if (state === 'title' || (state === 'over' && overT > 0.8)) {
      if (Math.abs(y - (state === 'title' ? 146 : 168)) < 9) openHangar(); else start();
    } else if (state === 'paused') setState('play');
    else if (state === 'hangar') {
      const L = CD.HLAYOUT;
      if (hit(L.buy, x, y)) return hBuy();
      if (hit(L.done, x, y)) return closeHangar();
      const i = Math.round((y - L.top) / L.step);
      if (i < 0 || i >= CD.CATALOG.length || x < L.labelX - 10) return;
      if (i !== hangar.row) { hangar.row = i; return; }
      if (x > L.priceX - 30) hBuy(); else hCycle(x < L.valueX ? -1 : 1);
    } else if (state === 'market') {
      const L = CD.MLAYOUT;
      if (hit(L.buy, x, y)) return marketBuy();
      if (hit(L.sail, x, y)) return leaveMarket();
      const col = x >= L.col - 4 ? 1 : 0, r = Math.round((y - L.top) / L.step), rows = market.rows(), i = col * L.per + r;
      if (r < 0 || r >= L.per || i >= rows.length) return;
      if (i !== market.row) { market.row = i; return; }
      const x0 = col ? L.col : 54;
      if (rows[i].id === 'gun' && x < x0 + 100) market.cycle(x < x0 + 40 ? -1 : 1); else marketBuy();
    }
  }
  canvas.addEventListener('pointerdown', e => {
    CD.sfx && CD.sfx.unlock();
    const r = canvas.getBoundingClientRect();
    tap((e.clientX - r.left) / r.width * CD.VIEW_W, (e.clientY - r.top) / r.height * CD.VIEW_H);
  });
  // On an upright phone the game sits at the top: a tap anywhere below it still starts or carries on.
  document.addEventListener('pointerdown', e => {
    if (e.target === canvas || e.target.closest('button')) return;
    CD.sfx && CD.sfx.unlock();
    if (state === 'title' || (state === 'over' && overT > 0.8)) start();
    else if (state === 'paused') setState('play');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('paused'); });

  function remember() {
    prev.clear();
    for (const o of [ship, ...world.wings, ...world.enemies, ...world.shots, ...world.pickups]) prev.set(o, { x: o.x, y: o.y });
    if (world.boss) prev.set(world.boss, { x: world.boss.x, y: world.boss.y });
  }

  function step() {
    t += DT;
    if (hangar) hangar.msgT -= DT;
    if (market) market.msgT -= DT;
    if (state === 'over') overT += DT;
    if (state !== 'play') { input.dashPressed = false; return; }
    remember();
    CD.updateWorld(world, ship, input, DT);
    const area = CD.areaAt(world.distance), n = Math.floor(world.distance / CD.AREA_LEN);
    if (n !== areaShown) {
      areaShown = n; banner = { a: area.name, b: area.loop ? `LOOP ${area.loop + 1}` : 'THE KING\'S AERIAL NAVY', t: 2.6 };
      announce(area.name.toLowerCase() + '.');
    }
    if (banner) banner.t -= DT;
    for (const ev of world.events) {
      if (CD.sfx) CD.sfx.play(ev.name);
      if (ev.name === 'bossIn') { banner = { a: world.boss.name, b: 'BLOCKS YER COURSE!', t: 2.6 }; announce(world.boss.name.toLowerCase() + ' blocks your course!'); }
      if (ev.name === 'lifeLost' && !ship.dead) announce(`Hull breached! ${ship.lives} lives left.`);
      if (ev.name === 'extraLife') { banner = { a: 'EXTRA LIFE!', b: '200 GOLD THIS RUN', t: 2 }; announce('Extra life for 200 gold.'); }
    }
    if ((world.bossesBeaten || 0) > beatenSeen) {          // a boss went down: victory, then the Sky Market
      beatenSeen = world.bossesBeaten;
      banner = { a: 'VICTORY!', b: '+1 LIFE   +500', t: 2.8 }; marketIn = 2.6;
      announce(`${world.lastBoss.toLowerCase()} is down! An extra life.`);
    }
    if (marketIn > 0 && (marketIn -= DT) <= 0 && !ship.dead) openMarket();
    if (ship.dead) {
      setState('over');
      banked = CD.bankRun(profile, world); saveProfile();
      announce(`Shot down. Score ${world.score}. ${banked.banked} gold to your chest.`);
    }
  }

  // Music: the area's tune, the boss theme, or the hangar tune.
  function music() {
    if (!CD.music) return;
    if (state === 'over' || state === 'paused') CD.music.stop();
    else if (state === 'title' || state === 'hangar' || state === 'market') CD.music.play('harbour');
    else if (world.boss) CD.music.play('boss');
    else CD.music.play(CD.areaAt(world.distance).id);
    CD.music.update();
  }

  let alpha = 1;
  const at = o => {
    const p = prev.get(o);
    return p ? { x: p.x + (o.x - p.x) * alpha, y: p.y + (o.y - p.y) * alpha } : { x: o.x, y: o.y };
  };

  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const W = CD.VIEW_W, H = CD.VIEW_H;
    const say = (s, y, size, color) => art.text(ctx, s, W / 2, y, { size, color, align: 'center' });
    if (state === 'hangar') return art.drawHangar(ctx, hangar, profile, t);
    const dist = world.distance + (state === 'play' ? alpha : 0);
    const areaId = CD.areaAt(world.distance).id;
    art.drawSky(ctx, dist, t, areaId);
    for (const k of world.pickups) { const p = at(k); art.drawPickup(ctx, { ...k, ...p }, t); }
    for (const e of world.enemies) { const p = at(e); art.drawEnemy(ctx, e, p.x, p.y, t); }
    if (state !== 'title' && (!ship.dead || state !== 'over')) { const p = at(ship); art.drawShip(ctx, ship, p.x, p.y, t); }
    if (state !== 'title') for (const wg of world.wings) { const p = at(wg); art.drawWingman(ctx, wg, p.x, p.y, t); }
    for (const b of world.shots) art.drawShot(ctx, { ...b, ...at(b) });
    art.drawCloudBanks(ctx, world.clouds, t, areaId);   // over the ship: hiding looks like hiding
    if (world.boss) { const p = at(world.boss); art.drawBoss(ctx, world.boss, p.x, p.y, t); }   // ...but a boss never hides
    if (state === 'play' && world.clouds.some(c => CD.overlap(c, ship))) {   // ...but you can still see where you are
      const p = at(ship); ctx.globalAlpha = 0.35; art.drawShip(ctx, ship, p.x, p.y, t); ctx.globalAlpha = 1;
    }
    for (const e of world.enemies) if (e.type === 'lurker' && e.hidden) { const p = at(e); art.drawLurkerEyes(ctx, p.x, p.y, t); }
    for (const b of world.bolts) art.drawBolt(ctx, b, t);
    for (const h of world.hazards) art.drawHazard(ctx, h, t);
    for (const f of world.fx) art.drawFx(ctx, f);
    art.drawNearClouds(ctx, dist, areaId, t);

    if (state === 'title') {
      ctx.fillStyle = 'rgba(16,24,48,.35)'; ctx.fillRect(0, 0, W, H);
      art.drawShip(ctx, CD.applyLoadout({ ...CD.makeShip(), tilt: Math.sin(t) * 0.05 }, profile.equip), 40, 100 + Math.sin(t * 1.3) * 6, t);
      const logo = art.sprite('logo');
      if (logo) ctx.drawImage(logo, W / 2 - 50, 4, 100, 100 * logo.height / logo.width);
      else { say('CLOUD DANCER', 52, 28, '#ffd34e'); say('BEYOND THE REEF', 76, 11, '#ffffff'); }
      if (Math.floor(t * 2) % 2 === 0) say(touchMode() ? 'TAP TO CAST OFF' : padMode() ? 'PRESS A / OK TO CAST OFF' : 'PRESS SPACE TO CAST OFF', 118, 10);
      say(touchMode() ? 'TAP HERE: THE HANGAR' : padMode() ? 'Y OR FAST-FORWARD: THE HANGAR' : 'H: THE HANGAR', 146, 8, '#ffd34e');
      say(`${profile.gold} GOLD IN YER CHEST` + (profile.best ? `   ·   BEST ${profile.best}` : ''), 164, 7, '#cfe8ff');
      say(touchMode() ? 'DRAG TO STEER · CANNONS FIRE ON THEIR OWN · STEAM = DASH'
        : remoteMode() ? 'HOLD THE REMOTE SIDEWAYS · RING STEERS · OK = FULL STEAM'
        : padMode() ? 'STICK OR D-PAD STEERS · CANNONS FIRE ON THEIR OWN · A = FULL STEAM'
        : 'ARROWS/WASD STEER · CANNONS FIRE ON THEIR OWN · SPACE = FULL STEAM', 200, 6.5, '#e8f4ff');
      return;
    }
    art.drawHud(ctx, ship, world, profile.best, hudInset());
    if (world.boss && world.boss.state !== 'enter') art.drawBossBar(ctx, world.boss);
    if (banner && banner.t > 0 && state === 'play' && (banner.t > 0.5 || Math.floor(t * 12) % 2)) {
      say(banner.a, 70, 15, '#ffd34e'); say(banner.b, 88, 8, '#ffffff');
    }
    if (state === 'play' && !world.boss && CD.inCloud(world, ship)) art.text(ctx, 'HIDDEN IN THE CLOUDS', W / 2, H - 10, { size: 7, color: '#e8f4ff', align: 'center' });
    if (state === 'market') art.drawMarket(ctx, market, world, ship, t, touchMode());
    else if (state === 'paused') {
      ctx.fillStyle = 'rgba(16,24,48,.5)'; ctx.fillRect(0, 0, W, H);
      say('PAUSED', H / 2 - 8, 22);
      say(touchMode() ? 'TAP TO CARRY ON' : padMode() ? 'BACK OR MENU TO CARRY ON' : 'P OR ESC TO CARRY ON', H / 2 + 16, 8);
    } else if (state === 'over') {
      ctx.fillStyle = `rgba(16,24,48,${Math.min(0.6, overT)})`; ctx.fillRect(0, 0, W, H);
      say('SHOT DOWN!', 62, 24, '#ff9a3c');
      say(`SCORE ${world.score}   BOSSES ${world.bossesBeaten || 0}`, 92, 9);
      say(banked && banked.newBest ? 'NEW BEST!' : `BEST ${profile.best}`, 108, 8, '#ffd34e');
      if (banked) say(`+${banked.banked} GOLD TO YER CHEST   (${profile.gold} IN ALL)`, 124, 8, '#ffd34e');
      if (overT > 0.8 && Math.floor(t * 2) % 2 === 0) say(touchMode() ? 'TAP TO FLY AGAIN' : padMode() ? 'PRESS A / OK TO FLY AGAIN' : 'PRESS SPACE TO FLY AGAIN', 150, 10);
      if (overT > 0.8) say(touchMode() ? 'TAP HERE: THE HANGAR' : padMode() ? 'Y OR FAST-FORWARD: THE HANGAR' : 'H: THE HANGAR', 168, 8, '#cfe8ff');
    }
  }

  const touchMode = () => document.documentElement.classList.contains('touch');
  const padMode = () => document.documentElement.classList.contains('pad');   // a controller or TV remote (js/pad.js)
  const remoteMode = () => document.documentElement.classList.contains('remote');   // a TV remote alone
  // Keep the HUD clear of the phone's corner buttons.
  function hudInset() {
    if (!touchMode()) return { l: 0, r: 0 };
    const c = canvas.getBoundingClientRect(), k = CD.VIEW_W / c.width;
    const p = document.getElementById('btn-pause').getBoundingClientRect(), m = document.getElementById('btn-mute').getBoundingClientRect();
    const l = p.width && p.right > c.left && p.top < c.top + 40 ? Math.max(0, Math.ceil((p.right - c.left) * k) + 2) : 0;
    const r = m.width && m.left < c.right && m.top < c.top + 40 ? Math.max(0, Math.ceil((c.right - m.left) * k) + 2) : 0;
    return { l, r };
  }

  resize();
  let last = performance.now(), acc = 0;
  // Frame pacing: if frames average slower than about 40 a second over two seconds of play, draw at
  // three quarters the resolution (down to 0.4 of 1080p), and measure again.
  let slowT = 0, slowN = 0;
  function pace(ms) {
    if (state !== 'play' || ms > 250 || quality <= 0.4) return;
    slowT += ms; slowN++;
    if (slowT < 2000) return;
    if (slowT / slowN > 25) { quality = Math.max(0.4, quality * 0.75); resize(); }
    slowT = slowN = 0;
  }
  function frame(now) {
    pace(now - last);
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) { step(); acc -= DT; }
    alpha = acc / DT;
    music();
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // The logo shows for a moment over the title, then fades.
  const splash = document.getElementById('splash');
  if (splash) setTimeout(() => { splash.classList.add('gone'); setTimeout(() => splash.remove(), 550); }, GOD ? 0 : 1400);

  if (GOD) {
    window.cd = {
      get state() { return state; }, get ship() { return ship; }, get world() { return world; }, get market() { return market; },
      get hangar() { return hangar; }, profile, input, start, openHangar, openMarket, tap,
      step(n = 1) { for (let i = 0; i < n; i++) step(); alpha = 1; render(); },
      key: code => window.dispatchEvent(new KeyboardEvent('keydown', { code })),
      get quality() { return quality; },
    };
  }
})();
