// Game: states (title, quarters, play, shop, paused, over), the fixed-step loop, camera, spawning,
// HUD, music cues, touch menus and screen-reader announcements.
(() => {
  const JR = window.JR;
  const art = JR.art, sfx = JR.sfx;
  const DT = 1 / 60;
  const GROUND_Y = 15 * JR.TILE;
  const params = new URLSearchParams(location.search);
  const GOD = params.has('god');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let scale = 1;

  // Whole-number scaling keeps every game pixel the same size (crisp) on computers. Phones (and
  // anything under 2x) fill the screen instead: there, screen space matters more than even pixels.
  // An upright phone shows a narrower slice of the same 384-wide world during a run, centred on
  // the captain, so everything is drawn bigger. Game logic always uses the full JR.VIEW_W.
  const NARROW_W = 256;
  const upright = () => document.documentElement.classList.contains('touch') && window.innerHeight > window.innerWidth;
  const narrow = () => upright() && (state === 'play' || state === 'paused');
  const viewW = () => (narrow() ? NARROW_W : JR.VIEW_W);
  let cropX = 0, wasNarrow = null, wasUpright = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    // Turning the phone mid-run: touches can be left hanging, so let go of every control and pause.
    if (wasUpright !== null && upright() !== wasUpright && touch) {
      touch.releaseAll();
      if (state === 'play') { state = 'paused'; document.documentElement.dataset.state = 'paused'; pauseRow = 0; }
    }
    wasUpright = upright(); wasNarrow = narrow();
    // Upright phones put the game at the top, below the corner buttons (body padding in index.html).
    const top = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    const fit = Math.min(window.innerWidth * dpr / viewW(), (window.innerHeight - top) * dpr / JR.VIEW_H);
    const phone = document.documentElement.classList.contains('touch');
    scale = fit >= 2 && !phone ? Math.floor(fit) : fit;
    canvas.width = Math.round(viewW() * scale);
    canvas.height = Math.round(JR.VIEW_H * scale);
    canvas.style.width = canvas.width / dpr + 'px';
    canvas.style.height = canvas.height / dpr + 'px';
    JR.px.S = scale;
    measureInsets();
  }

  // How far the phone's corner buttons reach into the picture, in game pixels, so the HUD can
  // sit beside them instead of underneath.
  const hudInset = { l: 0, r: 0 };
  function measureInsets() {
    hudInset.l = hudInset.r = 0;
    if (!document.documentElement.classList.contains('touch')) return;
    const c = canvas.getBoundingClientRect(), k = viewW() / c.width;
    const pause = document.getElementById('btn-pause').getBoundingClientRect();
    const mute = document.getElementById('btn-mute').getBoundingClientRect();
    if (pause.width) hudInset.l = Math.max(0, Math.ceil((pause.right - c.left) * k) + 2);
    if (mute.width) hudInset.r = Math.max(0, Math.ceil((c.right - mute.left) * k) + 2);
  }
  window.addEventListener('resize', resize);
  resize();

  // The saved pirate. Storage can be missing or blocked (private windows): then nothing persists.
  let store = null;
  try { store = window.localStorage; } catch (e) { /* blocked */ }
  const STORE = store || { getItem: () => null, setItem() {} };
  const profile = JR.loadProfile(STORE);
  let best = profile.best;
  let quarters = null, quartersThen = 'title', banked = 0, shop = null, shopIn = 0;

  const input = JR.newInput();
  let state = 'title', t = 0, overT = 0, pauseRow = 0;
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;   // no screen shake
  const statusEl = document.getElementById('status');
  const announce = msg => { statusEl.textContent = ''; setTimeout(() => { statusEl.textContent = msg; }, 50); };
  let touch = null;

  function setState(s) {
    if (s !== 'play' && touch) touch.release();
    state = s;
    document.documentElement.dataset.state = s;
    if (s === 'play') requestAnimationFrame(measureInsets);   // the pause button only shows in play
    if (s === 'paused') pauseRow = 0;
    if (narrow() !== wasNarrow) resize();                       // in and out of the upright run view
  }
  document.documentElement.dataset.state = state;
  let level, world, player, camX, prevCam, look, nextSpawn, alpha = 1;
  let banner = null, seg = -1, shake = 0, arena = null, boss = null, lockX = 0;

  function newRun() {
    const seed = +params.get('seed') || (Date.now() & 0xffffffff);
    level = JR.makeLevel(seed);
    level.ensure(40);
    world = JR.makeWorld(seed);
    player = JR.makePlayer(48, GROUND_Y - 24);
    JR.applyBuild(player, profile.equip);
    player.god = GOD;
    camX = prevCam = 0;
    look = 0;
    nextSpawn = 0;
    seg = -1; banner = null; shake = 0; arena = null; boss = null; shop = null; shopIn = 0;
  }
  newRun();

  const score = () => Math.floor(camX / JR.TILE) + player.kills * 50 + player.gold * 10 + (player.bosses || 0) * 1000;

  function openQuarters(then) {
    quarters = JR.makeQuarters(profile);
    if (profile.fresh) quarters.say('WELCOME, CAPTAIN! DRESS YER PIRATE');
    quartersThen = then;
    setState('quarters');
  }

  function closeQuarters() {
    quarters.leave();
    JR.saveProfile(STORE, profile);
    quarters = null;
    newRun();
    setState('title');
    if (quartersThen === 'play') start();
  }

  // Pause menu: resume, or quit to the title (the run's gold still goes into the chest).
  function quitToTitle() {
    JR.bank(profile, player.gold, score());
    JR.saveProfile(STORE, profile);
    best = Math.max(best, profile.best);
    newRun();
    setState('title');
  }
  // Leaving the app or tab mid-run (a call, the home button, another tab) pauses the game.
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('paused'); });
  const togglePause = () => { if (state === 'play') setState('paused'); else if (state === 'paused') setState('play'); };

  function start() {
    sfx.unlock();
    if (state === 'title' && profile.fresh) { openQuarters('play'); return; }
    if (state === 'over') newRun();
    setState('play');
    sfx.play('start');
  }

  JR.bindKeys(input, code => {
    sfx.unlock();
    if (state === 'quarters') {
      const q = quarters;
      if (code === 'ArrowUp' || code === 'KeyW') q.move(-1);
      else if (code === 'ArrowDown' || code === 'KeyS') q.move(1);
      else if (code === 'ArrowLeft' || code === 'KeyA') { q.cycle(-1); sfx.play('hit'); }
      else if (code === 'ArrowRight' || code === 'KeyD') { q.cycle(1); sfx.play('hit'); }
      else if (code === 'Space' || code === 'KeyX' || code === 'KeyJ' || code === 'KeyF') {
        const r = q.buy();
        sfx.play(r === 'bought' ? 'gun' : 'thud');
        if (r === 'bought') JR.saveProfile(STORE, profile);
      } else if (code === 'Enter' || code === 'Escape') closeQuarters();
      else if (code === 'KeyM') sfx.toggleMute();
      return;
    }
    if (state === 'shop') {
      if (code === 'ArrowUp' || code === 'KeyW') shop.move(-1);
      else if (code === 'ArrowDown' || code === 'KeyS') shop.move(1);
      else if (code === 'ArrowLeft' || code === 'KeyA') shop.cycle(-1);
      else if (code === 'ArrowRight' || code === 'KeyD') shop.cycle(1);
      else if (code === 'Space' || code === 'KeyX' || code === 'KeyJ' || code === 'KeyF') {
        const r = shop.buy();
        if (r === 'leave') leaveShop();
        else sfx.play(r === 'bought' ? 'gun' : 'thud');
      } else if (code === 'Enter' || code === 'Escape') leaveShop();
      else if (code === 'KeyM') sfx.toggleMute();
      input.jumpPressed = input.firePressed = false;
      return;
    }
    if (code === 'KeyC' && (state === 'title' || (state === 'over' && overT > 0.8))) { openQuarters('title'); return; }
    if (state === 'paused' && /^(ArrowUp|ArrowDown|KeyW|KeyS)$/.test(code)) { pauseRow = 1 - pauseRow; return; }
    if (state === 'paused' && /^(Enter|Space|KeyX|KeyJ)$/.test(code)) { if (pauseRow) quitToTitle(); else setState('play'); input.jumpPressed = input.firePressed = false; return; }
    if (code === 'KeyM') sfx.toggleMute();
    else if (code === 'KeyP' || code === 'Escape') togglePause();
    else if (code === 'Enter' || code === 'Space' || code === 'KeyZ' || code === 'KeyX') {
      if (state === 'title' || (state === 'over' && overT > 0.8)) { start(); input.jumpPressed = input.firePressed = false; }
    }
  });
  // Controllers and TV remotes (js/pad.js). A (OK on a remote) jumps, starts and buys; X, B,
  // Play/Pause and the triggers fire (B backs out of a menu); Y or Fast-forward opens the Captain's
  // Quarters; Back pauses or backs out, and leaves the app from the title; Menu starts or pauses.
  window.PAD = {
    code: name => {
      const menu = state === 'quarters' || state === 'shop';
      const front = state === 'title' || (state === 'over' && overT > 0.8);
      switch (name) {
        case 'up': return 'ArrowUp';
        case 'down': return 'ArrowDown';
        case 'left': return 'ArrowLeft';
        case 'right': return 'ArrowRight';
        case 'a': return 'Space';
        case 'b': return menu ? 'Escape' : 'KeyX';
        case 'x': case 'rt': case 'rb': return 'KeyX';
        case 'lt': case 'lb': return 'KeyZ';
        case 'y': return front ? 'KeyC' : null;
        case 'back': return 'Escape';
        case 'start': return front ? 'Enter' : menu ? 'Escape' : 'KeyP';
        default: return null;
      }
    },
    canExit: () => state === 'title',
  };
  // Phone controls (js/touch.js), plus taps on the canvas for every menu.
  touch = JR.initTouch(input, { onPause: () => { sfx.unlock(); togglePause(); }, onMute: () => { sfx.unlock(); sfx.toggleMute(); } });
  resize();                                                    // touch mode may change the scaling
  canvas.addEventListener('pointerdown', e => {
    sfx.unlock();
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * viewW(), y = (e.clientY - r.top) / r.height * JR.VIEW_H;
    tap(x, y);
  });

  function tap(x, y) {
    const near = (yy, line) => Math.abs(yy - line) <= 7;
    if (state === 'title' || (state === 'over' && overT > 0.8)) {
      if (near(y, state === 'title' ? 118 : 170)) openQuarters('title'); else start();
    } else if (state === 'paused') {
      if (near(y, JR.VIEW_H / 2 + 14)) setState('play');
      else if (near(y, JR.VIEW_H / 2 + 28)) quitToTitle();
    } else if (state === 'quarters') {
      const L = JR.QLAYOUT, q = quarters;
      if (JR.hit(L.buy, x, y)) { const res = q.buy(); sfx.play(res === 'bought' ? 'gun' : 'thud'); if (res === 'bought') JR.saveProfile(STORE, profile); return; }
      if (JR.hit(L.done, x, y)) { closeQuarters(); return; }
      const i = Math.round((y - L.top) / L.step);
      if (x < L.rowX || i < 0 || i >= JR.CATALOG.length) return;
      if (i !== q.row || x < L.valueMid - 70) { q.row = i; return; }   // tapping a label just selects
      if (x > L.priceX) { const res = q.buy(); sfx.play(res === 'bought' ? 'gun' : 'thud'); if (res === 'bought') JR.saveProfile(STORE, profile); }
      else { q.cycle(x < L.valueMid ? -1 : 1); sfx.play('hit'); }
    } else if (state === 'shop') {
      const L = JR.SLAYOUT;
      const doBuy = () => { const res = shop.buy(); if (res === 'leave') leaveShop(); else sfx.play(res === 'bought' ? 'gun' : 'thud'); };
      if (JR.hit(L.buy, x, y)) { doBuy(); return; }
      if (JR.hit(L.sail, x, y)) { leaveShop(); return; }
      const i = Math.round((y - L.top) / L.step), rows = shop.rows();
      if (i < 0 || i >= rows.length) return;
      if (i !== shop.row) { shop.row = i; return; }
      if (rows[i].id === 'gun' && x < 260) shop.cycle(x < 170 ? -1 : 1);
      else doBuy();
    }
  }
  function leaveShop() { shop = null; setState('play'); sfx.play('start'); }

  function spawn() {
    const edge = camX + JR.VIEW_W + 32;
    while (nextSpawn < level.spawns.length && level.spawns[nextSpawn].x < edge) {
      const s = level.spawns[nextSpawn++];
      if (JR.ENEMY_DEFS[s.type]) world.enemies.push(JR.spawnEnemy(s));
      else world.pickups.push(JR.makePickup(s.type, s.x + 8, s.y + 8));
    }
  }

  function step() {
    t += DT;
    if (state === 'over') overT += DT;
    if (quarters) quarters.msgT -= DT;
    if (shop) shop.msgT -= DT;
    if (state !== 'play') { input.jumpPressed = input.firePressed = false; return; }

    // Remember where everything was, so render() can draw between steps (smooth at 120/144 Hz).
    prevCam = camX;
    for (const list of [[player], world.enemies, world.shots, world.pickups, world.corpses]) for (const o of list) { o.px = o.x; o.py = o.y; }

    level.ensure(Math.floor(camX / JR.TILE) + 40);
    spawn();

    JR.updatePlayer(player, input, level, world, DT);
    if (player.x < camX) player.x = camX;                     // the left screen edge is a wall
    JR.updatePet(player, world, level, DT);
    const alert = player.pet === 'parrot' && !!JR.parrotAlert(level.spawns, nextSpawn, camX);
    if (alert && !player.alert) sfx.play('squawk');
    player.alert = alert;

    // Arena: entering one locks the screen and brings out the area's boss.
    if (!arena) {
      const a = level.arenas.find(a => !a.done && player.x > a.x0 + 32 && player.x < a.x1);
      if (a) {
        arena = a;
        lockX = a.x0 + 48;
        boss = JR.makeBoss(a.nation, lockX + JR.VIEW_W + 8, 15 * JR.TILE, lockX + 4, lockX + JR.VIEW_W - 4, Math.floor(a.seg / 4));
        world.enemies.push(boss);
        banner = { a: boss.name, b: 'BLOCKS YER WAY!', t: 2.4 };
        announce(`Boss: ${boss.name.toLowerCase()} blocks your way.`);
        sfx.play('bossIn');
      }
    }
    if (arena) player.x = Math.min(player.x, lockX + JR.VIEW_W - player.w - 2);

    for (const e of world.enemies) JR.updateEnemy(e, player, level, world, DT);

    JR.updateCorpses(world, level, DT);

    JR.updateShots(world, level, DT, camX, player);
    JR.updatePickups(world, level, DT);

    JR.resolveHits(world, player);

    for (const ev of world.events) {
      sfx.play(ev.name);
      if (ev.name === 'life') world.fx.push({ type: 'float', text: '1UP!', x: player.x + 5, y: player.y - 8, t: 0.8, color: '#7dff8a' });
      if (ev.name === 'kill') world.fx.push({ type: 'float', text: '+50', x: ev.x + 6, y: ev.y, t: 0.8, color: '#fcfcfc' });
      if (ev.name === 'boom' || ev.name === 'pound') shake = Math.max(shake, 0.25);
      if (ev.name === 'bossDown') { player.bosses = (player.bosses || 0) + 1; shake = 0.6; }
      if (ev.name === 'hurt') shake = Math.max(shake, 0.15);
      if (ev.name === 'gun') world.fx.push({ type: 'float', text: JR.WEAPONS[player.gun].name + '!', x: player.x + 5, y: player.y - 8, t: 0.8, color: '#fcc838' });
      if (ev.name === 'land' || ev.name === 'jump') world.fx.push({ type: 'dust', x: player.x + player.w / 2, y: player.y + player.h - 2, t: 0.25 });
    }
    world.events.length = 0;

    world.fx = world.fx.filter(f => (f.delay > 0 ? (f.delay -= DT) || true : (f.t -= DT) > 0));
    if (arena && boss && boss.hp <= 0) {
      arena.done = true; arena = null; boss = null;
      banner = { a: 'VICTORY!', b: '+1 LIFE   +1000', t: 2.6 };
      announce('Victory! Plus one life. The Black Market opens next.');
      shopIn = 2.4;                                            // then the Black Market opens
    }
    shake = Math.max(0, shake - DT);
    if (banner) banner.t -= DT;

    if (shopIn > 0 && (shopIn -= DT) <= 0 && !player.dead) {
      shop = JR.makeShop(player);
      setState('shop');
      sfx.play('area');
    }

    // Entering a new area: name it and its navy.
    const s2 = level.segmentAt(Math.floor((camX + JR.VIEW_W / 2) / JR.TILE));
    if (s2 !== seg) {
      if (seg >= 0) sfx.play('area');
      seg = s2;
      const c = Math.floor((camX + JR.VIEW_W / 2) / JR.TILE);
      banner = { a: JR.BIOME_NAMES[level.biomeAt(c)], b: JR.NATION_NAMES[level.nationAt(c)], t: 2.6 };
      announce(`${banner.a.toLowerCase()}, ${banner.b.toLowerCase()}.`);
    }
    world.enemies = world.enemies.filter(e => e.hp > 0 && e.x > camX - 64);
    world.pickups = world.pickups.filter(k => k.x > camX - 64 && k.y < JR.WORLD_H + 32);

    // Camera: eases forward (never back) and looks a little ahead while running right.
    look += ((player.vx > 10 ? 36 : 0) - look) * Math.min(1, DT * 2.5);
    const target = player.x + player.w / 2 - 150 + look;
    if (arena) { if (camX < lockX) camX += Math.min(lockX - camX, Math.max(2, (lockX - camX) * DT * 6)); }
    else {
      if (target > camX) camX += (target - camX) * Math.min(1, DT * 8);
      camX = Math.max(camX, player.x - (JR.VIEW_W - 90));
    }

    if (player.dead) {
      setState('over');
      overT = 0;
      sfx.play('gameover');
      // Everything picked up this run goes into the treasure chest for the Captain's Quarters.
      const prevBest = best;
      banked = player.gold;
      JR.bank(profile, player.gold, score());
      JR.saveProfile(STORE, profile);
      best = Math.max(profile.best, prevBest);
      announce(`Davy Jones takes ye. Score ${score()}, ${banked} gold to your chest.`);
    }
    input.jumpPressed = input.firePressed = false;
  }

  const lerp = (o, k) => {
    const prev = o['p' + k];
    return prev == null || Math.abs(o[k] - prev) > 48 ? o[k] : prev + (o[k] - prev) * alpha;
  };

  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state === 'quarters') { JR.drawQuarters(ctx, quarters, t); return; }
    const cam = state === 'play' ? prevCam + (camX - prevCam) * alpha : camX;
    const mid = Math.max(0, Math.floor((cam + JR.VIEW_W / 2) / JR.TILE));
    if (calm) shake = 0;
    const sx = shake > 0 ? Math.round((Math.random() * 2 - 1) * 2) : 0, sy = shake > 0 ? Math.round((Math.random() * 2 - 1) * 2) : 0;
    ctx.translate(sx, sy);
    const vw = viewW();
    if (vw < JR.VIEW_W) {                                       // follow the captain inside the full view
      const target = JR.clamp(lerp(player, 'x') - cam - vw * 0.38, 0, JR.VIEW_W - vw);
      cropX += (target - cropX) * (state === 'play' ? 0.1 : 1);
      ctx.translate(-Math.round(cropX * scale) / scale, 0);
    } else cropX = 0;
    art.drawSky(ctx, cam, t, level.biomeAt(mid), level.nationAt(mid));
    ctx.save();
    ctx.translate(-Math.round(cam * scale) / scale, -JR.CAM_Y);
    art.drawTiles(ctx, level, cam);
    for (const k of world.pickups) art.drawPickup(ctx, k, lerp(k, 'x'), lerp(k, 'y'), t);
    for (const k of world.corpses) art.drawCorpse(ctx, k, lerp(k, 'x') + k.w / 2, lerp(k, 'y') + k.h);
    for (const e of world.enemies) art.drawEnemy(ctx, e, lerp(e, 'x') + e.w / 2, lerp(e, 'y') + e.h, t);
    art.drawPlayer(ctx, player, lerp(player, 'x') + player.w / 2, lerp(player, 'y') + player.h, t);
    for (const s of world.shots) art.drawShot(ctx, s, lerp(s, 'x'), lerp(s, 'y'), t);
    for (const f of world.fx) art.drawFx(ctx, f, t);
    ctx.restore();

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // The HUD and overlays lay out across what is on screen.
    const full = JR.VIEW_W;
    JR.VIEW_W = vw;
    try { overlay(cam); } finally { JR.VIEW_W = full; }
  }

  function overlay(cam) {
    const W = JR.VIEW_W, H = JR.VIEW_H;
    const say = (str, y, size = 1, color, outline = true) => art.text(ctx, str, W / 2, y, { size, color, align: 'center', outline });
    const ink = (str, y, size = 1, color = '#3e2731') => say(str, y, size, color, false);   // on paper
    if (state === 'title') {
      JR.ui.panel(ctx, 'board', W / 2 - 104, 16, 208, 80);
      say('JOLLY', 38, 4, '#fcc838');
      say('ROGUE', 72, 4);
      const go = JR.touchMode() ? 'TAP TO SET SAIL' : JR.padMode() ? 'PRESS A / OK TO SET SAIL' : 'PRESS SPACE TO SET SAIL';
      if (Math.floor(t * 2) % 2 === 0) { JR.ui.banner(ctx, W / 2, 98, JR.px.textImage(go).width + 36); ink(go, 104); }
      say(JR.touchMode() ? "TAP HERE: CAPTAIN'S QUARTERS" : JR.padMode() ? "Y OR FAST-FORWARD: CAPTAIN'S QUARTERS" : "C: CAPTAIN'S QUARTERS", 118, 1, '#fcc838');
      if (JR.padMode()) {
        say('STICK/D-PAD MOVE + AIM   A JUMP   X OR B FIRE', 196, 1, '#fce4a8');
        say('REMOTE: OK JUMPS, PLAY/PAUSE FIRES', 207, 1, '#fce4a8');
      } else if (JR.touchMode()) {
        say('D-PAD: MOVE + AIM   RIGHT: JUMP + FIRE', 196, 1, '#fce4a8');
        say('TAP ANYWHERE TO START', 207, 1, '#fce4a8');
      } else {
        say('ARROWS/WASD MOVE + AIM   SPACE/Z JUMP   X/J FIRE', 196, 1, '#fce4a8');
        say('TAP JUMP FOR A HOP  ·  DOWN+JUMP DROPS THROUGH DOCKS', 207, 1, '#fce4a8');
      }
      if (best) art.text(ctx, 'HI ' + String(best).padStart(6, '0'), W - 5, 8, { align: 'right', color: '#bcdcfc' });
      return;
    }
    art.drawHud(ctx, player, score(), best, hudInset);
    if (player.alert && Math.floor(t * 6) % 2) {                // the parrot spotted loot ahead
      ctx.drawImage(JR.small.chest(), W - 26, 96);
      art.text(ctx, '>', W - 6, 103, { align: 'right', color: '#fcc838' });
    }
    if (boss && boss.state !== 'enter') art.drawBossBar(ctx, boss);
    if (banner && banner.t > 0 && (banner.t > 0.5 || Math.floor(t * 12) % 2)) {
      JR.ui.banner(ctx, W / 2, 44, JR.px.textImage(banner.a).width + 48);
      ink(banner.a, 50);
      say(banner.b, 64, 1, '#fcc838');
    }
    if (sfx.muted) say('MUTED', 8, 1, '#bcdcfc');
    if (state === 'shop') JR.drawShop(ctx, shop, t);
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(16,16,40,.45)'; ctx.fillRect(0, 0, W, H);
      JR.ui.panel(ctx, 'paper', W / 2 - 92, H / 2 - 40, 184, 82);
      ink('PAUSED', H / 2 - 14, 3);
      ink((pauseRow === 0 ? '> ' : '  ') + 'RESUME', H / 2 + 14, 1, pauseRow === 0 ? '#b8463e' : '#3e2731');
      ink((pauseRow === 1 ? '> ' : '  ') + 'QUIT TO TITLE (KEEP GOLD)', H / 2 + 28, 1, pauseRow === 1 ? '#b8463e' : '#3e2731');
    } else if (state === 'over') {
      ctx.fillStyle = `rgba(16,16,40,${Math.min(0.5, overT)})`; ctx.fillRect(0, 0, W, H);
      JR.ui.panel(ctx, 'board', W / 2 - 150, 30, 300, 152);
      say('DAVY JONES', 50, 3, '#fc7c18');
      say('TAKES YE!', 76, 2);
      say(`SCORE ${score()}   GOLD ${player.gold}   SAILORS ${player.kills}`, 104);
      say(score() >= best && best ? 'NEW HIGH SCORE!' : `HI ${best}`, 118, 1, '#fcc838');
      say(`+${banked} GOLD TO YER CHEST   (${profile.gold} IN ALL)`, 132, 1, '#fcc838');
      if (overT > 0.8 && Math.floor(t * 2) % 2 === 0) say(JR.touchMode() ? 'TAP TO SAIL AGAIN' : JR.padMode() ? 'PRESS A / OK TO SAIL AGAIN' : 'PRESS SPACE TO SAIL AGAIN', 156);
      if (overT > 0.8) say(JR.touchMode() ? "TAP HERE: CAPTAIN'S QUARTERS" : JR.padMode() ? "Y OR FAST-FORWARD: CAPTAIN'S QUARTERS" : "C: CAPTAIN'S QUARTERS", 170, 1, '#fce4a8');
    }
  }

  // Which tune fits right now: the area's, the boss theme, or none after Davy Jones.
  function music() {
    if (state === 'over') JR.music.stop();
    else if (state === 'quarters' || state === 'title') JR.music.play('town');
    else if (boss || arena) JR.music.play('boss');
    else JR.music.play(level.biomeAt(Math.max(0, Math.floor((camX + JR.VIEW_W / 2) / JR.TILE))));
    JR.music.update();
  }

  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) { step(); acc -= DT; }
    alpha = acc / DT;
    music();
    render();
    requestAnimationFrame(frame);
  }
  // The pack art loads in the background; until it is ready the world simply isn't drawn.
  // The logo shows (index.html) until the art is in, then fades.
  const splash = document.getElementById('splash');
  const unsplash = () => { if (!splash) return; splash.classList.add('gone'); setTimeout(() => splash.remove(), 450); };
  JR.atlas.load('assets/atlas.png', JR.ATLAS_INDEX).then(() => { window.atlasReady = true; unsplash(); }, unsplash);
  requestAnimationFrame(frame);

  // Test hook (?god): drive frames without requestAnimationFrame, which stalls in hidden tabs.
  if (GOD) {
    window.jr = {
      get state() { return state; }, get player() { return player; }, get world() { return world; },
      get level() { return level; }, get camX() { return camX; }, get boss() { return boss; }, input,
      get profile() { return profile; }, get shop() { return shop; }, get quarters() { return quarters; }, openQuarters, closeQuarters,
      key: code => window.dispatchEvent(new KeyboardEvent('keydown', { code })),
      start, tap, step(n = 1) { for (let i = 0; i < n; i++) step(); alpha = 1; render(); },
      // Jump the run ahead to a column (for screenshots of later areas).
      warp(col) {
        level.ensure(col + 40);
        player.x = col * JR.TILE; player.y = 4 * JR.TILE; player.vy = 0;
        camX = prevCam = player.x - 150;
        world.enemies.length = world.shots.length = world.pickups.length = 0;
        arena = null; boss = null;
        while (nextSpawn < level.spawns.length && level.spawns[nextSpawn].x < camX) nextSpawn++;
      },
    };
  }
})();
