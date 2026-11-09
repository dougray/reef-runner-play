// Reef Runner — steer between storm clouds and sandbars; sink British and Spanish ships,
// grab treasure and sail the voyage's areas (js/voyage.js) out to the man-o'-war and round again.
(() => {
  'use strict';

  // The sea reshapes to fit the screen, like a responsive web page (see setWorld):
  // landscape is 450 units tall and 800-1000 wide, portrait is 480 wide and as tall as
  // the space allows. Everything that depends on the size of the sea reads these.
  let W = 800, H = 450;
  let FLOOR = H - 28;            // sandy sea floor; touching it wrecks the ship
  let SHIP_X = 180;
  let PORTRAIT = false;
  // Share of the landscape sea that lies ahead of the ship (1 in landscape, ~0.6 in
  // portrait). Things that cross the screen slow down with it, so there's the same
  // time to react on a narrow screen.
  let REACH = 1;
  const HORIZON = 95;
  const CEILING = 22;

  // Reduce Motion (iOS) / Remove animations (Android) / the OS setting on desktop all arrive as
  // prefers-reduced-motion. When on: no camera shake and no full-screen lightning wash.
  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let calm = !!(motionQuery && motionQuery.matches);
  if (motionQuery) {
    const onMotion = e => { calm = e.matches; };
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
    else if (motionQuery.addListener) motionQuery.addListener(onMotion);
  }

  // Screen readers: the canvas is labelled in index.html; state changes (not every point) are
  // spoken through a polite live region.
  const statusEl = document.getElementById('status');
  let sayTimer = 0;
  function say(msg) {
    if (!statusEl) return;
    clearTimeout(sayTimer);
    statusEl.textContent = '';               // clear first so a repeated message is spoken again
    sayTimer = setTimeout(() => { statusEl.textContent = msg; }, 60);
  }

  const GRAVITY = 1500;          // px/s²
  const FLAP_VY = -470;          // px/s
  const MAX_FALL = 680;
  const SHIP_SCALE = 0.85;
  // Hitbox circles in unscaled ship space, a bit smaller than the art to be forgiving.
  const SHIP_HITS = [
    { x: 0, y: 5, r: 15 },       // hull
    { x: 24, y: -3, r: 9 },      // bow
    { x: -3, y: -27, r: 13 },    // sail
  ];

  // Combat
  const FIRE_COOLDOWN = 0.6;
  const BALL_SPEED = 560;

  // Enemy ship types. `at` is where it holds station, as a share of the sea ahead of the
  // ship; `box` is its hit area around the
  // waterline; `stay` is seconds before it gives up and sails off; `spread` fans a volley.
  const ENEMIES = {
    frigate: {
      hp: 1, points: 5, at: 0.74, half: 58, track: 70, stay: 9, fire: [1.5, 2.3], spread: [0],
      muzzle: [-54, -12], box: { w: 50, top: 76, bottom: 20 }, sinkTime: 1.6,
      splinters: ['#243a6b', '#f2c230', '#fbf7ee', '#5a3a1f'],
    },
    galleon: {
      hp: 3, points: 15, at: 0.81, half: 74, track: 42, stay: 13, fire: [2.6, 3.2], spread: [-85, 0, 85],
      muzzle: [-58, -8], box: { w: 62, top: 100, bottom: 24 }, sinkTime: 2.2,
      splinters: ['#b8322a', '#e8b23a', '#fbf7ee', '#7a4a24'],
    },
    // Revenue gunboat (Storm Coast on): small and quick to turn, with a fast-loading bow gun.
    gunboat: {
      hp: 1, points: 8, at: 0.7, half: 44, track: 95, stay: 8, fire: [1.0, 1.5], spread: [0],
      muzzle: [-40, -9], box: { w: 38, top: 58, bottom: 16 }, sinkTime: 1.3,
      splinters: ['#2a2e3a', '#d63a2f', '#fbf7ee', '#5a3a1f'],
    },
    // Fire ship (Volcano Isles): no guns; it flares up at its station, then rams.
    fireship: {
      hp: 1, points: 10, at: 0.8, half: 50, track: 55, stay: 99, fire: [9, 9], spread: [], ram: true,
      muzzle: [-50, -6], box: { w: 44, top: 64, bottom: 18 }, sinkTime: 1.4,
      splinters: ['#3a2018', '#ff7a2a', '#ffe14d', '#5a3a1f'],
    },
  };
  const RAM_AFTER = 1.1;           // seconds a fire ship flares at its station before it rams

  const REEF_W = 76;
  let REEF_SPACING = 300;

  // The voyage's areas (js/voyage.js) bring the weather, the enemies and the man-o'-war.
  const V = window.Voyage;
  const POOL_R = 110, POOL_PULL = 900;   // a whirlpool's reach and its tug (px/s² at its eye)
  const BOSS = { at: 0.74, half: 112, track: 38, muzzle: [-90, -17], box: { w: 90, top: 132, bottom: 34 }, points: 100 };
  const CHEST_POINTS = 10;
  const RAPID_TIME = 5, RAPID_COOLDOWN = 0.18;
  let PICKUP_DX = REEF_W + (REEF_SPACING - REEF_W) / 2;   // floats midway between two reefs

  function setWorld(w, h, portrait) {
    W = w; H = h; PORTRAIT = portrait;
    FLOOR = H - 28;
    SHIP_X = portrait ? 100 : 180;
    REACH = Math.min(1, (W - SHIP_X) / 620);
    REEF_SPACING = portrait ? 250 : 300;
    PICKUP_DX = REEF_W + (REEF_SPACING - REEF_W) / 2;
  }
  // Where a warship holds station; `half` (half its hull length) keeps it fully on screen.
  const stationX = T => Math.min(SHIP_X + (W - SHIP_X) * T.at, W - T.half);
  const startY = () => H * 0.45;
  // Below the logo and text in portrait; the floor keeps it clear on shorter seas (iPad).
  const menuShipY = () => (PORTRAIT ? Math.max(H * 0.72, 445) : H * 0.45);
  const TICK = 1 / 120;
  // Play-testing aid: ?god makes the ship invincible and exposes window.reef / window.reefStep.
  const GOD = /[?&]god\b/.test(location.search);
  // ?area=N (0-5) offers that area on the title screen for this visit, unlocked or not (not saved).
  const AREA_PARAM = /[?&]area=(\d+)/.exec(location.search);

  // Title-screen logo; falls back to drawn text until (or unless) it loads.
  const logo = new Image();
  logo.src = 'assets/logo-600.webp';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  const game = {
    state: 'menu',               // menu → playing → dead → playing …
    t: 0,
    scroll: 0,
    score: 0,
    best: loadBest(),
    ship: { y: 0, vy: 0, tilt: 0, stretch: 0 },
    reefs: [],
    balls: [],                   // player cannonballs
    shots: [],                   // enemy cannonballs
    enemies: [],
    popups: [],                  // floating "+5" text and KABOOM bursts
    flashes: [],                 // muzzle flashes
    particles: [],
    gulls: [],
    sails: [{ x: 520, s: 0.8 }, { x: 110, s: 0.6 }],   // distant ships on the horizon
    sunk: { frigate: 0, galleon: 0, gunboat: 0, fireship: 0 },
    storm: { on: false, k: 0, gust: 0, gustTarget: 0, gustT: 0, flash: 0, nextBolt: 0 },
    wx: { fog: 0, night: 0, embers: 0, sunset: 0 },   // how much of each area's weather is showing
    boss: null,
    banner: null,                // big centre-screen announcement
    bossesBeaten: 0,
    area: 0,                     // index into Voyage.AREAS
    loop: 0,                     // times round the whole voyage
    unlocked: 0,                 // furthest area reached on this device (a checkpoint to start from)
    startArea: 0,                // the checkpoint the next run sets sail from
    startPassed: 0,
    look: null,                  // the fade between two areas' colours (see setLook)
    treasure: 0,
    rapid: 0,                    // seconds of powder-keg rapid fire left
    clouds: [
      { x: 80, y: 42, s: 0.9 }, { x: 330, y: 64, s: 0.7 },
      { x: 560, y: 36, s: 1.0 }, { x: 760, y: 70, s: 0.6 },
    ],
    untilReef: 0,
    untilEnemy: 0,
    passed: 0,                   // reefs passed; drives difficulty
    reload: 0,
    lastGapY: 0,
    deadT: 0,
    shake: 0,
    freeze: 0,                   // hit-stop after a sinking
    paused: false,
    scorePop: 0,
    newBest: false,
    untilGull: 2,
    wakeT: 0,
  };

  // ---------- persistence ----------

  function loadBest() {
    try { return parseInt(localStorage.getItem('reefrunner.best'), 10) || 0; } catch { return 0; }
  }
  function saveBest(n) {
    try { localStorage.setItem('reefrunner.best', String(n)); } catch { /* private mode etc. */ }
  }
  // localStorage itself can throw when site data is blocked; Voyage's helpers catch the rest.
  const store = (() => { try { return window.localStorage; } catch { return null; } })() ||
    { getItem: () => null, setItem() {} };
  game.unlocked = V.loadUnlocked(store);
  game.startArea = V.loadStart(store);
  if (AREA_PARAM) {
    const n = Math.min(V.AREAS.length - 1, +AREA_PARAM[1]);
    game.unlocked = Math.max(game.unlocked, n);
    game.startArea = n;
  }

  // ---------- difficulty ----------

  // Difficulty climbs with reefs passed rather than score, so sinking ships
  // earns points without also speeding up the sea.
  // The curve itself lives in js/voyage.js, so the tests can check it.
  const speed = () => V.speed(game.passed, PORTRAIT);
  const gapSize = () => V.gapSize(game.passed);
  const enemyShotSpeed = () => V.shotSpeed(game.passed) * Math.max(0.6, REACH);
  const maxEnemies = () => V.maxEnemies(game.passed, PORTRAIT);   // no room for two in portrait
  const enemyInterval = () => V.enemyGap(game.passed, Math.random());
  const area = () => V.AREAS[game.area];

  // ---------- game flow ----------

  function reset() {
    const s = game.ship;
    s.y = startY(); s.vy = 0; s.tilt = 0; s.stretch = 0;
    game.reefs = [];
    game.balls = [];
    game.shots = [];
    game.enemies = [];
    game.popups = [];
    game.flashes = [];
    game.sunk = { frigate: 0, galleon: 0, gunboat: 0, fireship: 0 };
    game.storm = { on: false, k: game.storm.k, gust: 0, gustTarget: 0, gustT: 0, flash: 0, nextBolt: 0 };
    game.boss = null;
    game.banner = null;
    game.bossesBeaten = 0;
    game.treasure = 0;
    game.rapid = 0;
    game.newBest = false;
    game.reload = 0;
    game.untilEnemy = 6;
    game.startPassed = V.startOf(game.startArea);
    game.passed = game.startPassed;
    game.score = 0;
    game.untilReef = 120;
    game.lastGapY = startY();
    game.deadT = 0;
  }

  function setSail() {
    reset();
    game.state = 'playing';
    enterArea(V.areaAt(game.passed), 'Set sail! ');
  }

  function flap() {
    Sfx.unlock();
    if (game.state === 'menu') {
      setSail();
    } else if (game.state === 'dead') {
      if (game.deadT < 0.7) return;   // don't let a panicked tap skip the game-over screen
      setSail();
    }
    const s = game.ship;
    s.vy = FLAP_VY;
    s.stretch = 1;
    Sfx.flap();
    for (let i = 0; i < 6; i++) {
      spawnParticle(SHIP_X - 10 + Math.random() * 20, s.y + 16,
        -60 - Math.random() * 120, 40 + Math.random() * 120,
        3 + Math.random() * 3, 0.45, Math.random() < 0.5 ? '#ffffff' : '#bdf0f5');
    }
  }

  function wreck(cause) {
    fireHeld = false;
    if (GOD) { game.hits = game.hits || {}; game.hits[cause] = (game.hits[cause] || 0) + 1; return; }
    game.state = 'dead';
    game.deadT = 0;
    game.shake = 14;
    game.ship.vy = -320;
    Sfx.crash();
    const colors = ['#9a5a32', '#7a4a2a', '#f7ecd2', '#f2c14e'];
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * 260;
      spawnParticle(SHIP_X, game.ship.y - 10, Math.cos(a) * v, Math.sin(a) * v - 120,
        3 + Math.random() * 4, 1.1, colors[i % colors.length], 900);
    }
    if (game.score > game.best) {
      game.best = game.score;
      game.newBest = true;
      saveBest(game.best);
      setTimeout(() => {
        Sfx.coin();
        for (let i = 0; i < 30; i++) {
          spawnParticle(W / 2 + rnd(-120, 120), 120, rnd(-160, 160), rnd(-380, -120), rnd(4, 6), 1.6,
            i % 3 ? '#ffd34e' : '#f2a62a', 700);
        }
      }, 450);
    }
    say(`Shipwrecked in ${area().name}! Score ${game.score}. ${game.newBest ? 'New best!' : `Best ${game.best}.`} Sail up to try again.`);
  }

  function spawnReef() {
    const R = V.areaAt(game.passed).area.reefs;
    const gap = gapSize();
    const amp = R.bob || 0;       // Ghost Waters: the whole reef rises and falls on the swell
    const lo = 50 + gap / 2 + amp;
    const hi = FLOOR - 40 - gap / 2 - amp;
    // Keep consecutive gaps within reach so no layout is impossible (bobbing eats into the reach).
    const minY = Math.max(lo, game.lastGapY - 160 + amp);
    const maxY = Math.min(hi, game.lastGapY + 160 - amp);
    const gapY = minY + Math.random() * Math.max(0, maxY - minY);
    game.lastGapY = gapY;
    const roll = Math.random();
    const pickup = game.passed >= 3 && roll < 0.16 ? 'chest' : game.passed >= 6 && roll < 0.22 ? 'keg' : null;
    // Fog Banks: some of the empty stretches between reefs hide a whirlpool.
    const pool = !pickup && R.whirlpools && Math.random() < R.whirlpools
      ? { y: Math.max(CEILING + 70, Math.min(FLOOR - 70, gapY + rnd(-90, 90))) } : null;
    const py = Math.max(CEILING + 40, Math.min(FLOOR - 40, gapY + rnd(-70, 70)));
    game.reefs.push({
      x: W + 20,
      top: gapY - gap / 2,        // bottom edge of the storm cloud
      bottom: gapY + gap / 2,     // top edge of the sandbar
      baseTop: gapY - gap / 2, baseBottom: gapY + gap / 2,
      bob: amp ? { amp, w: rnd(0.9, 1.4), ph: rnd(0, Math.PI * 2) } : null,
      passed: false,
      look: Art.makeObstacle(),
      area: R.look,               // drawn in the look of the area it was spawned in
      lanterns: !!R.lanterns,
      pool,
      pickup: pickup && { kind: pickup, y: py, y0: py, taken: false },
    });
  }

  function spawnParticle(x, y, vx, vy, r, life, color, gravity = 500) {
    game.particles.push({ x, y, vx, vy, r, life, max: life, color, gravity });
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  // Short vibration on Android phones; iPhone browsers ignore it.
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not allowed */ } };

  function smoke(x, y, n, drift = 0) {
    for (let i = 0; i < n; i++) {
      spawnParticle(x + rnd(-4, 4), y + rnd(-4, 4), drift + rnd(-40, 40), rnd(-50, 10),
        rnd(5, 10), rnd(0.4, 0.7), Math.random() < 0.5 ? '#f2f2f2' : '#c9ccd4', -40);
    }
  }

  function puffSand(x, y) {
    for (let i = 0; i < 7; i++) {
      spawnParticle(x, y, rnd(-90, 60), rnd(-200, -60), rnd(2.5, 4.5), 0.6, i % 2 ? '#f2cf82' : '#d9ad5e', 700);
    }
  }

  // A point on the player ship, given in unscaled ship space.
  function shipPoint(hx, hy) {
    const s = game.ship;
    const c = Math.cos(s.tilt), n = Math.sin(s.tilt);
    return { x: SHIP_X + (hx * c - hy * n) * SHIP_SCALE, y: s.y + (hx * n + hy * c) * SHIP_SCALE };
  }

  function fire() {
    Sfx.unlock();
    if (game.state !== 'playing' || game.reload > 0) return;
    game.reload = game.rapid > 0 ? RAPID_COOLDOWN : FIRE_COOLDOWN;
    const m = shipPoint(50, -18);
    const aim = Math.sin(game.ship.tilt);
    const bs = BALL_SPEED * Math.max(0.7, REACH);
    game.balls.push({ x: m.x, y: m.y, vx: bs, vy: aim * bs * 0.4, g: 60 });
    smoke(m.x, m.y, 5, 60);
    game.flashes.push({ x: m.x + 6, y: m.y, r: 12, life: 0.09 });
    game.shake = Math.max(game.shake, 3);
    buzz(12);
    Sfx.cannon();
  }

  const clampSea = y => Math.max(CEILING + 70, Math.min(FLOOR - 30, y));

  function spawnEnemy() {
    const { kind, ghost } = V.pickEnemy(game.passed, Math.random());
    const T = ENEMIES[kind];
    const other = game.enemies.find(e => e.state !== 'sinking');
    let station = stationX(T);
    let fireT = 1.2;
    if (other) {
      // Share the sea: take the other slot and fire out of step with the first ship.
      station = other.station >= stationX(ENEMIES.frigate) ? other.station - 160 : other.station + 150;
      fireT = Math.max(1.2, other.fireT + 1);
    }
    game.enemies.push({
      kind, T, station, fireT, hp: T.hp, ghost, solid: ghost ? 0 : 1, phase: rnd(0, 3.6),
      x: W + 90, y: clampSea(game.ship.y), t: 0, state: 'enter', sink: 0, flash: 0,
    });
    if (ghost) Sfx.ghost();
    else if (T.ram) Sfx.flame();
  }

  function splinter(e, n, speed) {
    const cols = e.T.splinters;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(speed * 0.35, speed);
      spawnParticle(e.x, e.y - 20, Math.cos(a) * v, Math.sin(a) * v - 140, rnd(3, 6), 1.1, cols[i % cols.length], 900);
    }
  }

  function hitEnemy(e, b) {
    e.hp--;
    e.flash = 0.2;
    if (e.hp > 0) {
      game.popups.push({ burst: true, x: b.x, y: b.y, r: 16, text: '', life: 0.25, max: 0.25, spin: rnd(0, 1) });
      splinter(e, 8, 200);
      smoke(b.x, b.y, 4);
      game.shake = Math.max(game.shake, 4);
      Sfx.thud();
      return;
    }
    e.state = 'sinking';
    e.solid = 1;
    game.sunk[e.kind]++;
    game.score += e.T.points;
    game.scorePop = 1;
    game.freeze = 0.07;
    game.popups.push({ burst: true, x: e.x, y: e.y - 40, r: 46, text: 'KABOOM!', life: 0.7, max: 0.7, spin: rnd(0, 1) });
    game.popups.push({ x: e.x, y: e.y - e.T.box.top - 34, text: `+${e.T.points}`, life: 1.2 });
    game.shake = Math.max(game.shake, e.kind === 'galleon' || e.T.ram ? 12 : 8);
    Sfx.sink();
    splinter(e, e.kind === 'galleon' || e.T.ram ? 36 : 24, 300);
    smoke(e.x, e.y - 30, 10);
  }

  // A fan of shots from (mx, my), aimed straight at where the ship is now,
  // so keeping on the move dodges it.
  function volley(mx, my, spread, r, ghost = false) {
    const speed = enemyShotSpeed();
    const time = (mx - SHIP_X) / speed;
    const aim = Math.max(-160, Math.min(160, (game.ship.y - 10 - my) / time));
    for (const fan of spread) game.shots.push({ x: mx, y: my, vx: -speed, vy: aim + fan, g: 0, r, ghost });
    smoke(mx, my, 4 + 2 * spread.length, -60);
    game.flashes.push({ x: mx - 6, y: my, r: 14, life: 0.09 });
    Sfx.enemyCannon();
  }

  function enemyVolley(e) {
    volley(e.x + e.T.muzzle[0], e.y + e.T.muzzle[1], e.T.spread, e.kind === 'galleon' ? 7 : e.kind === 'gunboat' ? 5 : 6, e.ghost);
  }

  // ---------- events: treasure, the voyage's areas, the man-o'-war ----------

  // `spoken` replaces the title for screen readers (area names read better in their own case).
  function announce(title, sub, spoken, life = 2.6) {
    game.banner = { title, sub, life, max: life };
    const t = spoken || title.charAt(0) + title.slice(1).toLowerCase();   // "VICTORY!" reads better as "Victory!"
    say(sub ? `${t} ${sub.replace(/\s*·\s*/g, ', ')}.` : t);
  }

  // Fade the sea, sky and weather to area `index` (also used by the title screen's area picker).
  function setLook(index, instant) {
    const now = game.look ? currentPalette() : V.AREAS[index];
    const fromDecor = game.look ? (game.look.k < 0.5 ? game.look.fromDecor : V.AREAS[game.look.to].decor) : V.AREAS[index].decor;
    game.look = { from: now, to: index, k: instant ? 1 : 0, fromDecor };
    game.area = index;
    game.storm.on = V.AREAS[index].weather === 'storm' && game.state === 'playing';
  }
  function currentPalette() {
    const L = game.look;
    return V.blend(L.from, V.AREAS[L.to], L.k);
  }

  // A new area: its title card, its weather, and (the first time ever) a new checkpoint.
  function enterArea(at, prefix = '') {
    const A = at.area;
    game.loop = at.loop;
    setLook(at.index, prefix !== '' && game.look && game.look.to === at.index);
    game.storm.on = A.weather === 'storm';
    if (game.storm.on) game.storm.nextBolt = 1.2;
    // Only sailing into an area unlocks it (a run that starts there already had it).
    const fresh = !prefix && V.unlock(store, at.index);
    game.unlocked = Math.max(game.unlocked, at.index);
    const voyage = at.loop ? `Voyage ${at.loop + 1}  ·  ` : '';
    const sub = fresh ? `${voyage}Checkpoint unlocked!` : `${voyage}${A.sub}`;
    announce(A.name.toUpperCase(), sub, prefix + A.name + '.', 3.2);
    if (fresh && !prefix) { Sfx.fanfare(); } else if (A.weather === 'storm') Sfx.thunder(); else Sfx.bell();
  }

  function onReefPassed() {
    const A = area();
    game.score += A.pay;                  // the Storm Coast pays double, as the old storms did
    game.passed++;
    game.scorePop = 1;
    Sfx.point();
    const at = V.areaAt(game.passed);
    if (at.index !== game.area || at.loop !== game.loop) enterArea(at);
    else if (at.area.boss && at.into === at.area.boss && !game.boss) startBoss();
  }

  function collect(p, x) {
    p.taken = true;
    if (p.kind === 'chest') {
      game.score += CHEST_POINTS;
      game.treasure++;
      game.scorePop = 1;
      game.popups.push({ x, y: p.y - 30, text: `+${CHEST_POINTS}`, life: 1 });
      Sfx.coin();
      for (let i = 0; i < 14; i++) {
        spawnParticle(x, p.y, rnd(-140, 140), rnd(-260, -80), rnd(3, 5), 0.9, i % 2 ? '#ffd34e' : '#f2a62a', 700);
      }
    } else {
      game.rapid = RAPID_TIME;
      game.reload = 0;
      game.popups.push({ x, y: p.y - 30, text: 'RAPID FIRE!', life: 1.2 });
      Sfx.keg();
    }
  }

  // The areas' weather fades in and out with them, title screen included.
  function updateWeather(dt) {
    const L = game.look;
    if (L && L.k < 1) L.k = Math.min(1, L.k + dt / 2.5);
    const w = area().weather;
    for (const key of Object.keys(game.wx)) game.wx[key] += ((w === key ? 1 : 0) - game.wx[key]) * Math.min(1, dt * 0.6);
    const st = game.storm;
    const raining = w === 'storm';
    st.k += ((raining ? 1 : 0) - st.k) * Math.min(1, dt * 0.8);
    st.flash = Math.max(0, st.flash - dt * 4);
  }

  function updateStorm(dt) {
    const st = game.storm;
    if (st.k < 0.02) return;
    st.gustT -= dt;
    if (st.gustT <= 0) { st.gustTarget = st.on ? rnd(-260, 200) : 0; st.gustT = rnd(1.2, 2.4); }
    st.gust += (st.gustTarget - st.gust) * Math.min(1, dt * 2);
    game.ship.vy += st.gust * st.k * dt;        // negative gusts lift, positive ones push down
    st.nextBolt -= dt;
    if (st.on && st.nextBolt <= 0) {
      st.flash = 1;
      st.nextBolt = rnd(2.5, 5.5);
      game.shake = Math.max(game.shake, 5);
      Sfx.thunder();
    }
  }

  function startBoss() {
    const hp = 12 + game.bossesBeaten * 6;
    game.boss = {
      x: W + 170, y: 260, hp, maxHp: hp, t: 0, state: 'enter',
      attackT: 1.5, attacks: 0, wall: 0, sink: 0, flash: 0, burstT: 0,
    };
    for (const e of game.enemies) if (e.state !== 'sinking') e.state = 'leave';
    announce("HMS INVINCIBLE", "A man-o'-war blocks the way!");
    Sfx.horn();
  }

  // A wall of shot down the whole sea with one gap near the player to slip through.
  function broadside(b) {
    const gapY = Math.max(CEILING + 70, Math.min(FLOOR - 70, game.ship.y + rnd(-80, 80)));
    for (let y = CEILING + 12; y < FLOOR - 6; y += 30) {
      if (Math.abs(y - gapY) < 62) continue;
      game.shots.push({ x: b.x - 70 + rnd(-6, 6), y, vx: -300 * Math.max(0.6, REACH), vy: 0, g: 0, r: 6 });
      smoke(b.x - 70, y, 1, -60);
    }
    game.shake = Math.max(game.shake, 10);
    Sfx.cannon();
    Sfx.enemyCannon();
  }

  function hitBoss(b, ball) {
    b.hp--;
    b.flash = 0.2;
    game.popups.push({ burst: true, x: ball.x, y: ball.y, r: 18, text: '', life: 0.25, max: 0.25, spin: rnd(0, 1) });
    if (b.hp > 0) { Sfx.thud(); game.shake = Math.max(game.shake, 4); return; }
    b.state = 'sinking';
    b.wall = 0;
    game.bossesBeaten++;
    game.score += BOSS.points;
    game.scorePop = 1;
    game.freeze = 0.12;
    game.shake = 16;
    game.popups.push({ burst: true, x: b.x, y: b.y - 60, r: 64, text: 'KABOOM!', life: 0.9, max: 0.9, spin: rnd(0, 1) });
    game.popups.push({ x: b.x, y: b.y - 150, text: `+${BOSS.points}`, life: 1.6 });
    announce('VICTORY!', 'The seas are yours, captain');
    Sfx.sink();
    Sfx.fanfare();
  }

  function updateBoss(dt, v) {
    const b = game.boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.state === 'sinking') {
      b.sink += dt / 3;
      b.x -= v * dt * 0.3;
      b.burstT -= dt;
      if (b.sink < 0.55 && b.burstT <= 0) {
        b.burstT = 0.22;
        const bx = b.x + rnd(-80, 80), by = b.y - rnd(0, 110);
        game.popups.push({ burst: true, x: bx, y: by, r: rnd(22, 38), text: '', life: 0.4, max: 0.4, spin: rnd(0, 1) });
        for (let i = 0; i < 6; i++) spawnParticle(bx, by, rnd(-200, 200), rnd(-300, -60), rnd(3, 6), 1, i % 2 ? '#1f2530' : '#f2c230', 900);
        game.shake = Math.max(game.shake, 6);
        Sfx.thud();
      }
      if (b.sink >= 1) {
        game.boss = null;
        game.untilReef = 260;
        game.untilEnemy = 4;
      }
      return;
    }
    b.x += (stationX(BOSS) - b.x) * Math.min(1, dt * 0.9);
    const dy = Math.max(150, Math.min(FLOOR - 40, game.ship.y + 30)) - b.y;
    b.y += Math.sign(dy) * Math.min(Math.abs(dy), BOSS.track * dt);
    if (b.state === 'enter' && b.t > 2) b.state = 'fight';
    if (b.state !== 'fight') return;
    if (b.wall > 0) {
      b.wall -= dt;
      if (b.wall <= 0) broadside(b);
      return;
    }
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attacks++;
      if (b.attacks % 3 === 0) b.wall = 0.9;    // every third attack: light the gun decks, then the wall
      else volley(b.x + BOSS.muzzle[0], b.y + BOSS.muzzle[1], [-110, -55, 0, 55, 110], 7);
      b.attackT = rnd(1.6, 2.2) - Math.min(0.4, game.bossesBeaten * 0.15);
    }
  }

  // Cannonballs fly straight through storm clouds but bury themselves in sandbars.
  function ballHitsSand(x, y) {
    if (y > FLOOR) return true;
    for (const r of game.reefs) {
      if (x > r.x && x < r.x + REEF_W && y > r.bottom + 4) return true;
    }
    return false;
  }

  function updateCombat(dt, v) {
    const s = game.ship;
    game.reload = Math.max(0, game.reload - dt);

    game.rapid = Math.max(0, game.rapid - dt);
    if (fireHeld && game.reload <= 0) fire();
    // No new warships while the man-o'-war is out.
    if (!game.boss && game.enemies.filter(e => e.state !== 'sinking').length < maxEnemies()) {
      game.untilEnemy -= dt;
      if (game.untilEnemy <= 0) { spawnEnemy(); game.untilEnemy = enemyInterval(); }
    }

    for (const e of game.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.state === 'sinking') {
        e.sink += dt / e.T.sinkTime;
        e.x -= v * dt * 0.6;
        if (Math.random() < dt * 20) spawnParticle(e.x + rnd(-30, 30), e.y + rnd(-10, 20), 0, -60, rnd(2, 4), 0.6, '#dff6ff', -80);
        continue;
      }
      if (e.ghost) e.solid = V.ghostSolid(e.t + e.phase);
      if (e.state === 'ram') {
        // A fire ship under full sail, straight down the sea; it only slowly follows you.
        e.x -= 240 * Math.max(0.7, REACH) * dt;
        const dy = clampSea(s.y) - e.y;
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), 22 * dt);
        if (Math.random() < dt * 30) spawnParticle(e.x + rnd(-30, 30), e.y - rnd(20, 60), rnd(20, 80), rnd(-90, -30), rnd(2, 4), 0.5, Math.random() < 0.5 ? '#ff8a2a' : '#ffe14d', -60);
        if (shipCircles().some(c => circleHitsRect(c.x, c.y, c.r, e.x - e.T.box.w, e.y - e.T.box.top, e.T.box.w * 2, e.T.box.top + e.T.box.bottom))) {
          // It goes up with you: no points for this one.
          e.state = 'sinking'; e.flash = 0.2;
          game.popups.push({ burst: true, x: e.x, y: e.y - 40, r: 46, text: 'KABOOM!', life: 0.7, max: 0.7, spin: rnd(0, 1) });
          splinter(e, 30, 300);
          wreck('fireship');
          if (game.state !== 'playing') return;
        }
        continue;
      }
      const hold = e.state === 'leave' ? W + 160 : e.station;
      e.x += (hold - e.x) * Math.min(1, dt * 1.4);
      // Shadow the player's height, but slowly enough to be outrun.
      const dy = clampSea(s.y) - e.y;
      e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.T.track * dt);

      if (e.state === 'enter' && e.t > 1.2) e.state = 'fight';
      if (e.state === 'fight' && e.T.ram) {
        if (e.t > 1.2 + RAM_AFTER) { e.state = 'ram'; Sfx.flame(); }
      } else if (e.state === 'fight') {
        // A ghost ship only fires once it has fully taken shape, so its glow always warns first.
        if (e.ghost && e.solid < 0.95) e.fireT = Math.max(e.fireT, 0.5);
        else e.fireT -= dt;
        if (e.fireT <= 0) {
          enemyVolley(e);
          e.fireT = rnd(...e.T.fire) - Math.min(0.5, game.passed * 0.01);
        }
        if (e.t > e.T.stay) e.state = 'leave';
      }
    }
    game.enemies = game.enemies.filter(e => e.sink < 1 && !(e.state === 'leave' && e.x > W + 140) && e.x > -140);
    updateBoss(dt, v);

    for (const b of [...game.balls, ...game.shots]) {
      b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (ballHitsSand(b.x, b.y)) { b.dead = true; puffSand(b.x, b.y); Sfx.poof(); }
    }

    for (const b of game.balls) {
      if (b.dead) continue;
      for (const e of game.enemies) {
        if (e.state === 'sinking' || e.solid < 0.5) continue;   // shot passes through a fading ghost
        const box = e.T.box;
        if (Math.abs(b.x - e.x) < box.w && b.y > e.y - box.top && b.y < e.y + box.bottom) {
          b.dead = true;
          hitEnemy(e, b);
          break;
        }
      }
      const B = game.boss;
      if (!b.dead && B && B.state !== 'sinking' && Math.abs(b.x - B.x) < BOSS.box.w &&
          b.y > B.y - BOSS.box.top && b.y < B.y + BOSS.box.bottom) {
        b.dead = true;
        hitBoss(B, b);
        continue;
      }
      // Cannonballs that meet in mid-air knock each other out.
      for (const e of game.shots) {
        if (!e.dead && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 14 * 14) {
          b.dead = e.dead = true;
          smoke(b.x, b.y, 6);
          Sfx.poof();
        }
      }
    }

    for (const e of game.shots) {
      if (e.dead) continue;
      for (const c of shipCircles()) {
        if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 < (c.r + e.r - 1) ** 2) { e.dead = true; wreck('cannonball'); return; }
      }
    }

    const alive = b => !b.dead && b.x > -20 && b.x < W + 40 && b.y < H;
    game.balls = game.balls.filter(alive);
    game.shots = game.shots.filter(alive);
  }

  // ---------- collision ----------

  function circleHitsRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function shipCircles() {
    const s = game.ship;
    const c = Math.cos(s.tilt), n = Math.sin(s.tilt);
    return SHIP_HITS.map(h => ({
      x: SHIP_X + (h.x * c - h.y * n) * SHIP_SCALE,
      y: s.y + (h.x * n + h.y * c) * SHIP_SCALE,
      r: h.r * SHIP_SCALE,
    }));
  }

  function shipCollides() {
    for (const c of shipCircles()) {
      if (c.y + c.r > FLOOR) return true;
      for (const r of game.reefs) {
        if (circleHitsRect(c.x, c.y, c.r, r.x, -100, REEF_W, r.top + 100)) return true;
        if (circleHitsRect(c.x, c.y, c.r, r.x, r.bottom, REEF_W, H - r.bottom + 100)) return true;
      }
    }
    return false;
  }

  // ---------- update ----------

  function update(dt) {
    if (game.freeze > 0) { game.freeze -= dt; return; }
    game.t += dt;
    const s = game.ship;
    const moving = game.state !== 'dead';
    const v = game.state === 'playing' ? speed() : 90;

    if (moving) game.scroll += v * dt;
    for (const c of game.clouds) {
      if (moving) c.x -= v * 0.12 * dt;
      if (c.x < -90) { c.x = W + 40; c.y = 30 + Math.random() * 45; }
    }
    for (const d of game.sails) {
      if (moving) d.x -= v * 0.03 * dt;
      if (d.x < -30) { d.x = W + rnd(40, 300); d.s = rnd(0.5, 0.9); }
    }
    game.untilGull -= dt;
    if (game.untilGull <= 0 && area().gulls) {
      game.gulls.push({ x: W + 20, y: rnd(16, 72), vx: rnd(40, 75), t: rnd(0, 6), s: rnd(0.7, 1) });
      game.untilGull = rnd(3, 8);
    }
    for (const g of game.gulls) { g.x -= (g.vx + (moving ? v * 0.2 : 0)) * dt; g.t += dt * 9; }
    game.gulls = game.gulls.filter(g => g.x > -30);

    if (game.state === 'playing') {
      game.wakeT -= dt;
      if (game.wakeT <= 0) {
        const p = shipPoint(-30, 14);
        spawnParticle(p.x, p.y, -v * 0.5, rnd(-12, 12), rnd(3, 5), 0.45, Math.random() < 0.6 ? '#ffffff' : '#bdf0f5', 0);
        game.wakeT = 0.035;
      }
    }
    for (const f of game.flashes) f.life -= dt;
    game.flashes = game.flashes.filter(f => f.life > 0);
    game.scorePop = Math.max(0, game.scorePop - dt * 4);
    if (game.banner) { game.banner.life -= dt; if (game.banner.life <= 0) game.banner = null; }
    updateWeather(dt);
    const tempo = game.boss && game.boss.state !== 'sinking' ? 1.08 : game.state === 'playing' ? area().tempo : 1;
    if (tempo !== game.tempo) { game.tempo = tempo; Sfx.tempo(tempo); }

    if (game.state === 'menu') {
      s.y = menuShipY() + Math.sin(game.t * 2.5) * 10;
      s.tilt = Math.sin(game.t * 2.5 + 1) * 0.08;
    } else if (game.state === 'playing') {
      s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * dt);
      s.y += s.vy * dt;
      if (s.y < CEILING) { s.y = CEILING; s.vy = Math.max(0, s.vy); }
      const target = Math.max(-0.45, Math.min(0.6, s.vy / 800));
      s.tilt += (target - s.tilt) * Math.min(1, dt * 10);
      s.stretch = Math.max(0, s.stretch - dt * 5);

      updateStorm(dt);
      for (const r of game.reefs) {
        r.x -= v * dt;
        if (r.bob) {
          const off = Math.sin(game.t * r.bob.w + r.bob.ph) * r.bob.amp;
          r.top = r.baseTop + off; r.bottom = r.baseBottom + off;
          if (r.pickup) r.pickup.y = r.pickup.y0 + off;
        }
        if (!r.passed && r.x + REEF_W < SHIP_X) {
          r.passed = true;
          onReefPassed();
        }
        const p = r.pickup;
        if (p && !p.taken) {
          const px = r.x + PICKUP_DX;
          if (shipCircles().some(c => (c.x - px) ** 2 + (c.y - p.y) ** 2 < (c.r + 16) ** 2)) collect(p, px);
        }
        if (r.pool) {
          // A whirlpool tugs the ship toward its eye, harder the closer it sails.
          const dx = r.x + PICKUP_DX - SHIP_X, dy = r.pool.y - s.y, d = Math.hypot(dx, dy);
          if (d < POOL_R && d > 1) s.vy += (dy / d) * POOL_PULL * (1 - d / POOL_R) * dt;
        }
      }
      game.reefs = game.reefs.filter(r => r.x + PICKUP_DX > -40);
      // The man-o'-war fight is in open water: no new reefs until it's sunk.
      if (!game.boss) {
        game.untilReef -= v * dt;
        if (game.untilReef <= 0) { spawnReef(); game.untilReef += REEF_SPACING; }
      }

      updateCombat(dt, v);
      if (game.state === 'playing' && shipCollides()) wreck('reef');
    } else {
      // Wrecked: the ship tumbles and sinks to the sand.
      game.deadT += dt;
      s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * dt);
      s.y = Math.min(FLOOR - 8, s.y + s.vy * dt);
      if (s.y < FLOOR - 8) s.tilt += dt * 6;
    }

    for (const p of game.particles) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    game.particles = game.particles.filter(p => p.life > 0);
    for (const p of game.popups) { p.y -= 40 * dt; p.life -= dt; }
    game.popups = game.popups.filter(p => p.life > 0);
    game.shake = Math.max(0, game.shake - dt * 40);
  }

  // ---------- render ----------

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  const rgb = V.rgb;
  const moonX = () => (PORTRAIT ? W * 0.68 : W * 0.78);   // clear of the score and the corner buttons

  // The horizon's landmark for an area, faded by `a` while one area gives way to the next.
  function drawDecor(kind, a) {
    if (a <= 0.02 || kind === 'none') return;
    const x = W + 120 - ((game.scroll * 0.06 + 300) % (W + 260));
    ctx.globalAlpha = a;
    if (kind === 'island') Art.island(ctx, x, HORIZON + 2);
    else if (kind === 'volcano') Art.volcano(ctx, x, HORIZON + 2, game.t);
    else if (kind === 'wreck') Art.wreck(ctx, x, HORIZON + 1);
    else if (kind === 'fleet') {    // the blockade's line of warships, hull down on the horizon
      for (let i = 0; i < 5; i++) Art.distantSail(ctx, wrap(x + i * 150, W + 260) - 60, HORIZON - 3, 1.1 + (i % 2) * 0.25);
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    const P = currentPalette();
    const wx = game.wx;
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, rgb(P.sky[0]));
    sky.addColorStop(1, rgb(P.sky[1]));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 2);

    if (wx.night > 0.02) {
      // Stars twinkle, and the full moon lights Ghost Waters.
      for (let i = 0; i < 40; i++) {
        const tw = 0.5 + 0.5 * Math.sin(game.t * 2 + i * 1.7);
        ctx.fillStyle = `rgba(255,255,240,${wx.night * (0.35 + 0.6 * tw)})`;
        ctx.fillRect(wrap(i * 97.3, W), 6 + ((i * 53.7) % (HORIZON - 16)), 2, 2);
      }
      ctx.globalAlpha = wx.night;
      Art.moon(ctx, moonX(), 46, 20);
      ctx.globalAlpha = 1;
    }
    if (wx.sunset > 0.02) { ctx.globalAlpha = wx.sunset; Art.sun(ctx, W * 0.62, HORIZON, 34); ctx.globalAlpha = 1; }
    if (wx.embers > 0.02) {
      const g = ctx.createLinearGradient(0, HORIZON - 50, 0, HORIZON);
      g.addColorStop(0, 'rgba(255,110,40,0)'); g.addColorStop(1, `rgba(255,110,40,${0.45 * wx.embers})`);
      ctx.fillStyle = g; ctx.fillRect(0, HORIZON - 50, W, 52);
    }

    if (P.cloud && P.cloudAlpha > 0.02) {
      ctx.globalAlpha = P.cloudAlpha;
      for (const c of game.clouds) Art.cloud(ctx, c.x, c.y, c.s, rgb(P.cloud));
      ctx.globalAlpha = 1;
    }
    for (const g of game.gulls) Art.gull(ctx, g.x, g.y, g.t, g.s);

    const sea = ctx.createLinearGradient(0, HORIZON, 0, H);
    sea.addColorStop(0, rgb(P.sea[0]));
    sea.addColorStop(1, rgb(P.sea[1]));
    ctx.fillStyle = sea;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    ctx.strokeStyle = Art.INK;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke();
    for (const d of game.sails) Art.distantSail(ctx, d.x, HORIZON - 3, d.s);
    const L = game.look, k = L.k;
    drawDecor(L.fromDecor, 1 - k);
    drawDecor(V.AREAS[L.to].decor, k);
    if (wx.night > 0.02) {
      // Moonlight glittering on the water below the moon.
      ctx.strokeStyle = `rgba(230,240,255,${0.4 * wx.night})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const y = HORIZON + 8 + i * 11, len = 14 - i, drift = Math.sin(game.t * 1.6 + i * 1.9) * (6 + i * 2);
        const x = moonX() + drift + (i % 2 ? 10 : -10);
        ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y);
      }
      ctx.stroke();
    }

    // Rows of little cartoon wave marks, farther rows scroll slower.
    ctx.lineCap = 'round';
    for (let row = 0; HORIZON + 30 + row * 62 < FLOOR - 10; row++) {
      const y = HORIZON + 30 + row * 62;
      const k = 0.3 + row * 0.18;
      const spacing = 130;
      const off = (game.scroll * k + row * 47) % spacing;
      ctx.strokeStyle = rgb(P.wave, 0.35 + row * 0.08);
      ctx.lineWidth = 2 + row * 0.5;
      for (let x = -off; x < W + spacing; x += spacing) {
        const bob = Math.sin(game.t * 2 + x * 0.05 + row) * (3 + game.storm.k * 6);
        const wx = x + (row % 2) * 60;
        ctx.beginPath();
        ctx.moveTo(wx, y + bob);
        ctx.quadraticCurveTo(wx + 9, y - 7 + bob, wx + 18, y + bob);
        ctx.quadraticCurveTo(wx + 27, y - 7 + bob, wx + 36, y + bob);
        ctx.stroke();
      }
    }
  }

  function drawFloor() {
    ctx.fillStyle = rgb(currentPalette().sand);
    ctx.strokeStyle = Art.INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H + 10);
    const off = game.scroll % 80;
    for (let x = -off - 80; x <= W + 80; x += 20) {
      ctx.lineTo(x, FLOOR + Math.sin((x + off) * 0.08) * 3);
    }
    ctx.lineTo(W + 80, H + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const wrap = (n, m) => ((n % m) + m) % m;

  function drawRain() {
    const st = game.storm;
    if (st.k < 0.02) return;
    const slant = 0.35 + st.gust / 600;     // the wind leans the rain
    ctx.strokeStyle = `rgba(215,228,255,${0.45 * st.k})`;
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const x = wrap(i * 137.5 - game.t * 160, W + 100) - 50;
      const y = wrap(i * 71.3 + game.t * 620, H + 40) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant * 18, y + 18);
    }
    ctx.stroke();
    if (st.flash > 0) {
      // Reduced motion: a soft glow in the sky instead of a full-screen white flash.
      ctx.fillStyle = `rgba(255,255,255,${st.flash * (calm ? 0.18 : 0.55)})`;
      if (calm) ctx.fillRect(0, 0, W, HORIZON); else ctx.fillRect(0, 0, W, H);
    }
  }

  // Fog Banks: a bank that thickens with distance ahead, so reefs and warships loom out of it,
  // and drifting wreaths of mist. Drawn over the scenery but under the player's ship and the shot.
  function drawFog() {
    const k = game.wx.fog;
    if (k < 0.02) return;
    const x0 = SHIP_X + 110;
    const g = ctx.createLinearGradient(x0, 0, W, 0);
    g.addColorStop(0, 'rgba(214,222,226,0)');
    g.addColorStop(0.4, `rgba(214,222,226,${0.6 * k})`);
    g.addColorStop(1, `rgba(214,222,226,${0.88 * k})`);
    ctx.fillStyle = g; ctx.fillRect(x0, 0, W - x0, H);
    for (let i = 0; i < 7; i++) {
      const x = wrap(i * 173 - game.t * (14 + i * 4) - game.scroll * 0.12, W + 300) - 150;
      const y = HORIZON + 10 + ((i * 97) % Math.max(60, FLOOR - HORIZON - 30));
      Art.glow(ctx, x, y, 90 + (i % 3) * 30, '230,236,240', 0.4 * k);
    }
  }

  // Lantern light and warship gun-glow shine through the fog; whirlpools spin on the surface.
  function drawFogLights() {
    for (const r of game.reefs) {
      if (r.lanterns) {
        const ax = r.x + REEF_W * r.look.lamp, bx = r.x + REEF_W * (1 - r.look.lamp);
        const flick = 0.75 + Math.sin(game.t * 9 + r.x) * 0.08;
        // Hung just inside the cloud and stood just inside the sand, so they mark the gap's edges
        // without poking into it.
        Art.glow(ctx, ax, r.top - 12, 46, '255,214,110', 0.55 * flick);
        Art.glow(ctx, bx, r.bottom + 10, 46, '255,214,110', 0.55 * flick);
        Art.lantern(ctx, ax, r.top - 12, game.t, true);
        Art.lantern(ctx, bx, r.bottom + 10, game.t, false);
      }
      if (r.pool) Art.whirlpool(ctx, r.x + PICKUP_DX, r.pool.y, 46, game.t);
    }
    if (game.wx.fog < 0.02) return;
    for (const e of game.enemies) {
      const c = enemyCharge(e);
      if (c > 0) Art.glow(ctx, e.x + e.T.muzzle[0], e.y + e.T.muzzle[1], 26, '255,190,80', 0.9 * c * game.wx.fog);
    }
  }

  // Volcano Isles: embers rising and ash drifting down. Ghost Waters: will-o'-the-wisps.
  function drawSparks() {
    const em = game.wx.embers, ni = game.wx.night;
    if (em > 0.02) {
      for (let i = 0; i < 46; i++) {
        const x = wrap(i * 89.7 - game.t * (30 + (i % 5) * 9) - game.scroll * 0.2, W + 40) - 20;
        const y = wrap(H - game.t * (36 + (i % 7) * 9) - i * 53.1, H + 20) - 10;
        const fl = 0.55 + 0.45 * Math.sin(game.t * 8 + i);
        ctx.fillStyle = i % 3 ? `rgba(255,150,50,${em * fl})` : `rgba(255,225,120,${em * fl})`;
        ctx.fillRect(x, y, 3, 3);
      }
      ctx.fillStyle = `rgba(90,80,80,${0.5 * em})`;
      for (let i = 0; i < 30; i++) {
        const x = wrap(i * 131.3 - game.t * 50 - game.scroll * 0.3, W + 40) - 20;
        const y = wrap(i * 61.7 + game.t * (28 + (i % 4) * 6), H + 20) - 10;
        ctx.fillRect(x, y, 4, 2);
      }
    }
    if (ni > 0.02) {
      for (let i = 0; i < 9; i++) {
        const x = wrap(i * 211 - game.t * 22 - game.scroll * 0.25, W + 60) - 30;
        const y = HORIZON + 40 + ((i * 71) % Math.max(60, FLOOR - HORIZON - 80)) + Math.sin(game.t * 1.7 + i) * 14;
        Art.glow(ctx, x, y, 14, '140,255,200', 0.55 * ni * (0.6 + 0.4 * Math.sin(game.t * 3 + i * 2)));
      }
    }
  }

  function drawParticles() {
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Title screen: logo right of the bobbing ship in landscape, centred above it in portrait.
  const menuX = () => (PORTRAIT ? W / 2 : W - 320);
  const PAUSE_BTN = { x: 34, y: 34, r: 20 };

  function drawGameOver() {
    const drop = Math.min(1, game.deadT / 0.35);      // scroll slides down into place
    const y0 = (PORTRAIT ? H * 0.28 : 110) - (1 - drop) * 40;
    ctx.globalAlpha = drop;
    Art.text(ctx, 'SHIPWRECKED!', W / 2, y0 - 42, 50, '#ff7a9c');
    const pw = 360, ph = 196, px = W / 2 - pw / 2;
    Art.panel(ctx, px, y0, pw, ph);
    Art.label(ctx, 'Score', px + 40, y0 + 40, 22, '#6b4a22', 'left');
    Art.label(ctx, String(game.score), px + pw - 40, y0 + 40, 30, Art.INK, 'right');
    Art.label(ctx, 'Best', px + 40, y0 + 78, 22, '#6b4a22', 'left');
    Art.label(ctx, String(game.best), px + pw - 40, y0 + 78, 26, Art.INK, 'right');
    ctx.strokeStyle = '#d7b87e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 30, y0 + 102); ctx.lineTo(px + pw - 30, y0 + 102); ctx.stroke();
    const sunk = Object.values(game.sunk).reduce((a, b) => a + b, 0);
    Art.label(ctx, `Reefs ${game.passed - game.startPassed}  ·  Ships sunk ${sunk}  ·  Treasure ${game.treasure}`,
      W / 2, y0 + 128, 15, '#6b4a22');
    const at = V.areaAt(game.passed);   // not game.area: the picker below changes that
    const where = `Reached ${at.area.name}${at.loop ? ` (voyage ${at.loop + 1})` : ''}`;
    Art.label(ctx, game.bossesBeaten ? `${where}  ·  Men-o'-war ${game.bossesBeaten}` : where, W / 2, y0 + 156, 15, '#6b4a22');
    if (game.newBest) Art.ribbon(ctx, W / 2, y0 - 2, 150, 'NEW BEST!', -0.04 + Math.sin(game.t * 3) * 0.02);
    ctx.globalAlpha = 1;
    if (game.deadT >= 0.7) {
      ctx.globalAlpha = 0.6 + Math.sin(game.t * 5) * 0.4;
      Art.text(ctx, isTouch() ? 'Tap SAIL to sail again' : 'Tap to sail again', W / 2, y0 + ph + 36, isTouch() ? 26 : 22, '#fff');
      ctx.globalAlpha = 1;
      drawPicker(W / 2, y0 + ph + 76, false);
    }
  }

  // ---------- checkpoints: the title screen's "set sail from" picker ----------

  const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
  let pickHits = [];               // where the picker's arrows were drawn, for taps and clicks
  const pickerShown = () => game.unlocked > 0 && !game.paused &&
    (game.state === 'menu' || (game.state === 'dead' && game.deadT >= 0.7));

  function drawPicker(cx, y, hint) {
    pickHits = [];
    if (!pickerShown()) return;
    const name = V.AREAS[game.startArea].name;
    const label = `Set sail from: ${name}`;
    ctx.font = `900 20px ${FONT}`;
    const half = ctx.measureText(label).width / 2;
    Art.text(ctx, label, cx, y, 20, '#ffd34e');
    for (const dir of [-1, 1]) {
      const ax = cx + dir * (half + 24);
      ctx.fillStyle = '#ffd34e'; ctx.strokeStyle = Art.INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ax + dir * 10, y); ctx.lineTo(ax - dir * 8, y - 11); ctx.lineTo(ax - dir * 8, y + 11);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      pickHits.push({ x: ax, y, dir });
    }
    if (hint) {
      const how = isTouch() ? 'Tap the arrows' : isRemote() ? 'Left / right on the remote' : isPad() ? 'D-pad left / right' : '← / → keys or click the arrows';
      Art.text(ctx, `${how} to start from a checkpoint (${game.unlocked + 1} of ${V.AREAS.length} reached)`, cx, y + 26, 12, '#bdf0f5');
    }
  }

  function choose(dir) {
    const n = game.unlocked + 1;
    game.startArea = (((game.startArea + dir) % n) + n) % n;
    if (!AREA_PARAM) V.saveStart(store, game.startArea);
    setLook(game.startArea);
    Sfx.unlock();
    Sfx.point();
    const A = V.AREAS[game.startArea];
    say(`Set sail from ${A.name}, area ${game.startArea + 1} of ${V.AREAS.length}.`);
  }

  // A tap or click on one of the picker's arrows (stage coordinates).
  function pickAt(p) {
    if (!pickerShown()) return false;
    const hit = pickHits.find(h => (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < 30 * 30);
    if (hit) choose(hit.dir);
    return !!hit;
  }
  // Phones and tablets: index.html adds .touch (and can add it late, on a first touch).
  const isTouch = () => document.documentElement.classList.contains('touch');
  const isPad = () => document.documentElement.classList.contains('pad');   // a controller or TV remote (js/pad.js)
  const isRemote = () => document.documentElement.classList.contains('remote');   // a TV remote alone
  // The remote button that fires: Fast-forward on a Fire TV remote, Play/Pause on a Siri Remote.
  const fireButton = () => (document.documentElement.classList.contains('appletv') ? 'Play/Pause' : 'Fast-forward');

  function drawUI() {
    if (game.state === 'menu') {
      const wob = Math.sin(game.t * 3) * 0.04;
      if (logo.complete && logo.naturalWidth) {
        const h = 270, w = h * logo.naturalWidth / logo.naturalHeight;
        ctx.save();
        ctx.translate(menuX(), 18 + h / 2 + Math.sin(game.t * 2.6) * 4);
        ctx.rotate(wob * 0.5);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logo, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(menuX(), 140);
        ctx.rotate(wob);
        Art.text(ctx, 'REEF RUNNER', 0, 0, 64, '#ffd34e');
        ctx.restore();
      }
      if (isTouch()) {
        Art.text(ctx, 'Tap SAIL to set sail!', menuX(), 322, 30);
        Art.text(ctx, 'Hold FIRE to keep the cannon firing', menuX(), 358, 20, '#ffd34e');
      } else if (isRemote()) {
        Art.text(ctx, 'Press OK to set sail!', menuX(), 316, 22);
        Art.text(ctx, `OK: sail up  ·  ${fireButton()}: FIRE! (hold to keep firing)`, menuX(), 346, 16, '#ffd34e');
      } else if (isPad()) {
        Art.text(ctx, 'Press A or OK to set sail!', menuX(), 316, 22);
        Art.text(ctx, 'A / OK / up: sail up  ·  B, X or Play/Pause: FIRE! (hold to keep firing)', menuX(), 346, 16, '#ffd34e');
      } else {
        Art.text(ctx, 'Tap, click or press Space to set sail!', menuX(), 316, 22);
        Art.text(ctx, 'Space / click: sail up  ·  F / right-click: FIRE!', menuX(), 346, 16, '#ffd34e');
      }
      if (game.best > 0) Art.text(ctx, `Best: ${game.best}`, menuX(), 378, 18, '#bdf0f5');
      if (PORTRAIT) drawPicker(W / 2, Math.min(FLOOR - 40, menuShipY() + 66), true);
      else drawPicker(menuX(), 410, true);
    } else if (game.state === 'playing') {
      ctx.save();
      ctx.translate(W / 2, 50);
      ctx.scale(1 + game.scorePop * 0.35, 1 + game.scorePop * 0.35);
      Art.text(ctx, String(game.score), 0, 0, 52, game.scorePop > 0.5 ? '#ffe14d' : '#fff');
      ctx.restore();
      const cooldown = game.rapid > 0 ? RAPID_COOLDOWN : FIRE_COOLDOWN;
      // Phones get real on-screen buttons instead (see updatePad).
      if (!isTouch()) Art.fireButton(ctx, W - 50, H - 78, 30, 1 - game.reload / cooldown, game.rapid > 0 ? 'KEG!' : 'F');
      if (game.rapid > 0 && !isTouch()) {
        ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(W - 50, H - 78, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (game.rapid / RAPID_TIME));
        ctx.stroke();
      }
      const B = game.boss;
      if (B && B.state !== 'sinking') Art.bossBar(ctx, W / 2, 98, 300, B.hp / B.maxHp, 'HMS INVINCIBLE');
      if (game.banner) {
        const bn = game.banner, age = bn.max - bn.life;
        const pop = age < 0.15 ? age / 0.15 : 1;
        ctx.globalAlpha = Math.min(1, bn.life * 2);
        ctx.save();
        ctx.translate(W / 2, PORTRAIT ? H * 0.3 : 170);
        ctx.font = `900 50px ${FONT}`;
        const fit = Math.min(1, (W - 40) / ctx.measureText(bn.title).width);   // long area names on a narrow sea
        ctx.scale((0.6 + pop * 0.4) * fit, (0.6 + pop * 0.4) * fit);
        Art.text(ctx, bn.title, 0, 0, 50, '#ffd34e');
        if (bn.sub) Art.text(ctx, bn.sub, 0, 42, 20);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      if (!isTouch()) Art.pauseButton(ctx, PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.r, game.paused);
      if (game.paused) {
        ctx.fillStyle = 'rgba(10,30,45,0.45)';
        ctx.fillRect(0, 0, W, H);
        Art.text(ctx, 'PAUSED', W / 2, H / 2 - 20, 56, '#ffd34e');
        Art.text(ctx, isTouch() ? 'Tap anywhere to keep sailing' : 'Press P or click to keep sailing', W / 2, H / 2 + 34, isTouch() ? 28 : 20);
      }
    } else {
      drawGameOver();
    }
    if (!isTouch()) Art.text(ctx, Sfx.muted ? '🔇 M' : '🔊 M', W - 14, H - 14, 13, '#fff', 'right');
  }

  // 0-1 as a warship gets ready to fire (its gun glows), or a fire ship flares up to ram.
  function enemyCharge(e) {
    if (e.T.ram) return e.state === 'ram' ? 1 : e.state === 'fight' ? Math.min(1, (e.t - 1.2) / RAM_AFTER) : 0;
    return e.state === 'fight' && e.fireT < 0.45 ? 1 - e.fireT / 0.45 : 0;
  }

  function render() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#0d3b4f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const k = view.scale * view.dpr;
    const shake = calm ? 0 : game.shake;   // hit-stop and KABOOM still carry the hit without moving the camera
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.translate(sx, sy);

    drawBackground();
    // Enemy ships sail behind the reefs; sandbars give both sides cover.
    for (const e of game.enemies) {
      const charge = enemyCharge(e);
      const jolt = e.flash > 0 ? Math.sin(e.flash * 90) * 4 : 0;
      const y = e.y + Math.sin(game.t * 2.2 + e.station) * 3;
      if (e.ghost) Art.ghostShip(ctx, e.kind, e.x + jolt, y, game.t, e.sink, charge, e.solid);
      else Art[e.kind](ctx, e.x + jolt, y, game.t, e.sink, charge);
      if (e.T.hp > 1 && e.state !== 'sinking' && e.solid > 0.5) Art.pips(ctx, e.x, y - e.T.box.top - 12, e.hp, e.T.hp);
    }
    const B = game.boss;
    if (B) {
      const nextIsWall = (B.attacks + 1) % 3 === 0;
      const charge = B.state === 'fight' && B.wall <= 0 && !nextIsWall && B.attackT < 0.45 ? 1 - B.attackT / 0.45 : 0;
      const jolt = B.flash > 0 ? Math.sin(B.flash * 90) * 4 : 0;
      Art.manOWar(ctx, B.x + jolt, B.y + Math.sin(game.t * 1.6) * 3, game.t, B.sink, charge, B.wall > 0 ? 1 - B.wall / 0.9 : 0);
    }
    for (const r of game.reefs) {
      Art.stormCloud(ctx, r.x, r.top, REEF_W, r.look, game.t, r.area);
      Art.sandbar(ctx, r.x, r.bottom, REEF_W, H + 10, r.look, r.area, game.t);
    }
    for (const r of game.reefs) {
      const p = r.pickup;
      if (p && !p.taken) Art[p.kind === 'chest' ? 'chest' : 'barrel'](ctx, r.x + PICKUP_DX, p.y, game.t + r.x * 0.01);
    }
    drawFog();
    drawFogLights();
    const s = game.ship;
    for (const b of game.balls) Art.cannonball(ctx, b.x, b.y, 5);
    for (const b of game.shots) {
      if (b.ghost) Art.ghostShot(ctx, b.x, b.y, b.r, game.t);
      else Art.cannonball(ctx, b.x, b.y, b.r);
    }
    Art.ship(ctx, SHIP_X, s.y, s.tilt, s.stretch, game.t, SHIP_SCALE);
    for (const f of game.flashes) Art.burst(ctx, f.x, f.y, f.r, '', f.x);
    drawParticles();
    drawFloor();
    drawRain();
    drawSparks();
    for (const p of game.popups) {
      if (p.burst) {
        const age = p.max - p.life;
        const pop = age < 0.1 ? age / 0.1 * 1.15 : 1 + Math.max(0, 0.15 - (age - 0.1));
        ctx.globalAlpha = Math.min(1, p.life * 5);
        Art.burst(ctx, p.x, p.y, p.r * pop, p.text, p.spin);
      } else {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        Art.text(ctx, p.text, p.x, p.y, 28, '#ffd34e');
      }
    }
    ctx.globalAlpha = 1;
    drawUI();
    ctx.restore();
  }

  // ---------- plumbing ----------

  // Reads the notch / home-bar insets that CSS exposes as env(safe-area-inset-*).
  const insetProbe = document.createElement('div');
  insetProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
  document.body.appendChild(insetProbe);
  const safeTop = () => parseFloat(getComputedStyle(insetProbe).paddingTop) || 0;
  // Some web views (the iOS app's, notably) report the notch / Dynamic Island inset only
  // after first layout, so re-check now and then and re-lay out when it changes.
  let lastSafeTop = -1;
  function watchInsets() {
    const t = safeTop();
    if (t !== lastSafeTop) { lastSafeTop = t; resize(); }
  }

  // `quality` drops the canvas below the screen's own resolution when frames run slow (a TV stick
  // driving a 1080p screen, an old phone); see pace().
  let quality = 1, slowT = 0, slowN = 0;
  function pace(ms) {
    if (game.state !== 'playing' || game.paused || ms > 250 || quality <= 0.5) return;
    slowT += ms; slowN++;
    if (slowT < 2000) return;
    if (slowT / slowN > 25) { quality = Math.max(0.5, quality * 0.75); resize(); }   // under ~40 fps: 3/4 the pixels
    slowT = slowN = 0;
  }

  function resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    // A TV draws at most 1280 pixels across (its graphics chip can't fill 1080p at 60 fps).
    const tvCap = document.documentElement.classList.contains('tv') ? 1280 / cw : Infinity;
    view.dpr = Math.max(Math.min(1, tvCap), Math.min(window.devicePixelRatio || 1, 2, tvCap) * quality);
    canvas.width = Math.round(cw * view.dpr);
    canvas.height = Math.round(ch * view.dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    // Portrait phone: the sea sits above the SAIL / FIRE deck, clear of the notch.
    let top = 0, room = ch;
    if (isTouch() && ch > cw) {
      top = safeTop();
      room = ch - top - pad.getBoundingClientRect().height;
    }
    const wasPortrait = PORTRAIT;
    const aspect = cw / room;
    if (aspect < 1) setWorld(480, Math.round(Math.min(960, Math.max(560, 480 / aspect))), true);
    else setWorld(Math.round(Math.min(1000, Math.max(800, 450 * aspect))), 450, false);
    if (PORTRAIT !== wasPortrait) settleWorld();
    view.scale = Math.min(cw / W, room / H);
    view.ox = (cw - W * view.scale) / 2;
    view.oy = top + (room - H * view.scale) / 2;
    redraw = true;                  // resizing cleared the canvas
  }

  // After turning the phone mid-run: pause, keep everything inside the new sea,
  // and send warships back to their new stations.
  function settleWorld() {
    const s = game.ship;
    s.y = Math.min(s.y, FLOOR - 40);
    game.lastGapY = Math.min(game.lastGapY, FLOOR - 120);
    for (const e of game.enemies) if (e.state !== 'sinking') e.station = stationX(e.T);
    game.enemies = game.enemies.filter((e, i) => i < maxEnemies() || e.state === 'sinking');
    setPaused(true);
  }

  function setPaused(on) {
    if (game.state !== 'playing' || game.paused === on) return;
    game.paused = on;
    redraw = true;
    say(on ? 'Paused. Press P or tap to resume.' : 'Resumed.');
    if (!on) Sfx.unlock();          // phones may have suspended audio while we were away
    Sfx.duck(on);
    Sfx.pause();
  }

  // Screen point → 800x450 stage point.
  const toStage = e => ({ x: (e.clientX - view.ox) / view.scale, y: (e.clientY - view.oy) / view.scale });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('blur', () => setPaused(true));
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') { setPaused(!game.paused); return; }
    if (e.code === 'KeyM') { Sfx.toggleMute(); return; }   // mutes without un-pausing
    if (game.paused) { e.preventDefault(); setPaused(false); return; }
    if (pickerShown() && /^(ArrowLeft|ArrowRight|KeyA|KeyD)$/.test(e.code)) {
      e.preventDefault();
      choose(e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1);
      return;
    }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); flap(); }
    if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'ArrowRight' || e.code === 'Enter') {
      e.preventDefault();
      if (game.state === 'playing') fireHeld = true;           // holding the key keeps firing, like the FIRE button
      fire();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'ArrowRight' || e.code === 'Enter') fireHeld = false;
  });
  // Controllers and TV remotes (js/pad.js): A, OK and up sail; B, X, Play/Pause, right and the
  // shoulder buttons fire; Back and Menu pause. Back on the title screen leaves the app.
  // On the title and game-over screens left and right pick the checkpoint to start from.
  window.PAD = {
    code: name => {
      if (pickerShown() && (name === 'left' || name === 'right')) return name === 'left' ? 'ArrowLeft' : 'ArrowRight';
      switch (name) {
        case 'a': case 'up': return 'Space';
        case 'b': case 'x': case 'right': case 'rb': case 'rt': case 'lb': case 'lt': return 'KeyF';
        case 'back': case 'start': return 'Escape';
        default: return null;
      }
    },
    canExit: () => game.state === 'menu' && !game.paused,
    sideways: () => game.state === 'playing' && !game.paused,
  };
  // Mouse: left button sails up, right button fires. Touch: a tap anywhere on the sea
  // sails up; firing has its own button.
  window.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (game.paused) { setPaused(false); return; }
    const p = toStage(e);
    if (!isTouch() && game.state === 'playing' && (p.x - PAUSE_BTN.x) ** 2 + (p.y - PAUSE_BTN.y) ** 2 < (PAUSE_BTN.r + 8) ** 2) {
      setPaused(true);
      return;
    }
    if (game.state !== 'playing' && pickAt(p)) return;
    if (e.pointerType === 'mouse' && e.button === 2 && game.state === 'playing') fire();
    else flap();
  });

  // ---------- phone controls: on-screen SAIL, FIRE, pause and mute ----------

  const pad = document.getElementById('pad');
  const sailBtn = document.getElementById('btn-sail');
  const fireBtn = document.getElementById('btn-fire');
  const fireLabel = fireBtn.querySelector('.label');
  const pauseBtn = document.getElementById('btn-pause');
  const muteBtn = document.getElementById('btn-mute');
  let fireHeld = false;                     // holding FIRE keeps shooting as the cannon reloads

  function button(el, press, release) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();                  // don't also count as a tap on the sea
      try { el.setPointerCapture(e.pointerId); } catch { /* keep going without capture */ }
      el.classList.add('down');
      if (game.paused && el !== pauseBtn) { setPaused(false); return; }
      press();
    });
    const up = () => { el.classList.remove('down'); if (release) release(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  button(sailBtn, () => { flap(); buzz(8); });
  // FIRE also starts a run from the title and game-over screens.
  button(fireBtn, () => { if (game.state === 'playing') { fireHeld = true; fire(); } else flap(); },
    () => { fireHeld = false; });
  button(pauseBtn, () => setPaused(!game.paused));
  button(muteBtn, () => { Sfx.unlock(); Sfx.toggleMute(); });

  // Corner-button icons drawn as SVG so they look the same on iOS and Android (emoji and
  // text glyphs render differently per platform).
  const svg = body => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const SPEAKER = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>';
  const ICON = {
    pause: svg('<path d="M8.5 6v12M15.5 6v12" stroke-width="3.4"/>'),
    play: svg('<path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/>'),
    sound: svg(SPEAKER + '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    muted: svg(SPEAKER + '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>'),
  };

  // Keeps the DOM buttons in step with the game: reload ring, powder keg, pause and mute icons.
  const padState = {};
  function updatePad() {
    if (!isTouch()) return;
    const set = (key, value, apply) => { if (padState[key] !== value) { padState[key] = value; apply(value); } };
    const cooldown = game.rapid > 0 ? RAPID_COOLDOWN : FIRE_COOLDOWN;
    const ready = game.state === 'playing' ? Math.max(0, Math.min(1, 1 - game.reload / cooldown)) : 1;
    set('ready', ready.toFixed(2), v => fireBtn.style.setProperty('--ready', v));
    set('loaded', ready >= 1, v => fireBtn.classList.toggle('ready', v));
    set('keg', game.rapid > 0, v => { fireBtn.classList.toggle('keg', v); fireLabel.textContent = v ? 'KEG!' : 'FIRE'; });
    set('playing', game.state === 'playing', v => { pauseBtn.hidden = !v; });
    set('paused', game.paused, v => { pauseBtn.innerHTML = v ? ICON.play : ICON.pause; pauseBtn.setAttribute('aria-label', v ? 'Resume' : 'Pause'); });
    set('muted', Sfx.muted, v => { muteBtn.innerHTML = v ? ICON.muted : ICON.sound; muteBtn.setAttribute('aria-label', v ? 'Unmute sound' : 'Mute sound'); });
  }
  window.addEventListener('contextmenu', e => e.preventDefault());

  // Fixed timestep so physics feel the same at 60 Hz and 120 Hz.
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  let redraw = true;               // draw the next frame even while paused
  function frame(now) {
    pace(now - last);
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    // ?god recordings set window.reefHold and drive time themselves with reefStep().
    if (game.paused || (GOD && window.reefHold)) acc = 0;
    while (acc >= TICK) { update(TICK); acc -= TICK; }
    // Paused: nothing moves, so redraw at ~10 fps (enough for the pause screen) instead of 60-120.
    if (!game.paused || redraw || frames % 6 === 0) { render(); redraw = false; }
    updatePad();
    if (++frames % 30 === 0) watchInsets();
    requestAnimationFrame(frame);
  }

  setLook(game.startArea, true);
  if (GOD) {
    window.reef = game;
    // Advance the simulation by `secs` and draw, even when the tab is hidden.
    window.reefStep = secs => { for (let i = 0; i < secs / TICK; i++) update(TICK); render(); updatePad(); };
  }
  resize();
  requestAnimationFrame(frame);
})();
