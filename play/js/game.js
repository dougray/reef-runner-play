// Reef Runner — steer between storm clouds and sandbars; sink British and Spanish ships,
// grab treasure, ride out storms and take on the man-o'-war.
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
  };

  const REEF_W = 76;
  let REEF_SPACING = 300;

  // Events: a storm rolls in for STORM_LEN reefs from reef 20, and a man-o'-war blocks
  // the way at reef 40; both come round again every EVENT_CYCLE reefs.
  const STORM_AT = 20, STORM_LEN = 10, BOSS_AT = 40, EVENT_CYCLE = 50;
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
  const menuShipY = () => H * (PORTRAIT ? 0.72 : 0.45);   // below the logo and text in portrait
  const TICK = 1 / 120;
  // Play-testing aid: ?god makes the ship invincible and exposes window.reef / window.reefStep.
  const GOD = /[?&]god\b/.test(location.search);

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
    sunk: { frigate: 0, galleon: 0 },
    storm: { on: false, k: 0, gust: 0, gustTarget: 0, gustT: 0, flash: 0, nextBolt: 0 },
    boss: null,
    banner: null,                // big centre-screen announcement
    nextStorm: STORM_AT,
    nextBoss: BOSS_AT,
    bossesBeaten: 0,
    treasure: 0,
    rapid: 0,                    // seconds of rum-fuelled rapid fire left
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

  // ---------- difficulty ----------

  // Difficulty climbs with reefs passed rather than score, so sinking ships
  // earns points without also speeding up the sea.
  const speed = () => Math.min(290, 170 + game.passed * 3) * (PORTRAIT ? 0.9 : 1);
  const gapSize = () => Math.max(135, 190 - game.passed * 2);
  const enemyShotSpeed = () => Math.min(410, 330 + game.passed * 2) * Math.max(0.6, REACH);
  const maxEnemies = () => (game.passed >= 25 && !PORTRAIT ? 2 : 1);   // no room for two in portrait
  const enemyInterval = () => rnd(5, 9) - Math.min(3, game.passed * 0.06);
  const galleonChance = () => (game.passed < 12 ? 0 : Math.min(0.5, 0.25 + (game.passed - 12) * 0.02));

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
    game.sunk = { frigate: 0, galleon: 0 };
    game.storm = { on: false, k: 0, gust: 0, gustTarget: 0, gustT: 0, flash: 0, nextBolt: 0 };
    game.boss = null;
    game.banner = null;
    game.nextStorm = STORM_AT;
    game.nextBoss = BOSS_AT;
    game.bossesBeaten = 0;
    game.treasure = 0;
    game.rapid = 0;
    game.newBest = false;
    game.reload = 0;
    game.untilEnemy = 6;
    game.passed = 0;
    game.score = 0;
    game.untilReef = 120;
    game.lastGapY = startY();
    game.deadT = 0;
  }

  function flap() {
    Sfx.unlock();
    if (game.state === 'menu') {
      reset();
      game.state = 'playing';
    } else if (game.state === 'dead') {
      if (game.deadT < 0.7) return;   // don't let a panicked tap skip the game-over screen
      reset();
      game.state = 'playing';
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
  }

  function spawnReef() {
    const gap = gapSize();
    const lo = 50 + gap / 2;
    const hi = FLOOR - 40 - gap / 2;
    // Keep consecutive gaps within reach so no layout is impossible.
    const minY = Math.max(lo, game.lastGapY - 160);
    const maxY = Math.min(hi, game.lastGapY + 160);
    const gapY = minY + Math.random() * (maxY - minY);
    game.lastGapY = gapY;
    const roll = Math.random();
    const pickup = game.passed >= 3 && roll < 0.16 ? 'chest' : game.passed >= 6 && roll < 0.22 ? 'rum' : null;
    game.reefs.push({
      x: W + 20,
      top: gapY - gap / 2,        // bottom edge of the storm cloud
      bottom: gapY + gap / 2,     // top edge of the sandbar
      passed: false,
      look: Art.makeObstacle(),
      pickup: pickup && { kind: pickup, y: Math.max(CEILING + 40, Math.min(FLOOR - 40, gapY + rnd(-70, 70))), taken: false },
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
    const kind = Math.random() < galleonChance() ? 'galleon' : 'frigate';
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
      kind, T, station, fireT, hp: T.hp,
      x: W + 90, y: clampSea(game.ship.y), t: 0, state: 'enter', sink: 0, flash: 0,
    });
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
    game.sunk[e.kind]++;
    game.score += e.T.points;
    game.scorePop = 1;
    game.freeze = 0.07;
    game.popups.push({ burst: true, x: e.x, y: e.y - 40, r: 46, text: 'KABOOM!', life: 0.7, max: 0.7, spin: rnd(0, 1) });
    game.popups.push({ x: e.x, y: e.y - e.T.box.top - 34, text: `+${e.T.points}`, life: 1.2 });
    game.shake = Math.max(game.shake, e.kind === 'galleon' ? 12 : 8);
    Sfx.sink();
    splinter(e, e.kind === 'galleon' ? 36 : 24, 300);
    smoke(e.x, e.y - 30, 10);
  }

  // A fan of shots from (mx, my), aimed straight at where the ship is now,
  // so keeping on the move dodges it.
  function volley(mx, my, spread, r) {
    const speed = enemyShotSpeed();
    const time = (mx - SHIP_X) / speed;
    const aim = Math.max(-160, Math.min(160, (game.ship.y - 10 - my) / time));
    for (const fan of spread) game.shots.push({ x: mx, y: my, vx: -speed, vy: aim + fan, g: 0, r });
    smoke(mx, my, 4 + 2 * spread.length, -60);
    game.flashes.push({ x: mx - 6, y: my, r: 14, life: 0.09 });
    Sfx.enemyCannon();
  }

  function enemyVolley(e) {
    volley(e.x + e.T.muzzle[0], e.y + e.T.muzzle[1], e.T.spread, e.kind === 'galleon' ? 7 : 6);
  }

  // ---------- events: treasure, storms, the man-o'-war ----------

  function announce(title, sub) {
    game.banner = { title, sub, life: 2.6, max: 2.6 };
  }

  function onReefPassed() {
    const pts = game.storm.on ? 2 : 1;    // storms pay double
    game.score += pts;
    game.passed++;
    game.scorePop = 1;
    Sfx.point();
    if (!game.storm.on && game.passed === game.nextStorm) {
      game.storm.on = true;
      game.storm.nextBolt = 1.2;
      announce('STORM!', 'Wind gusts  ·  double points');
      Sfx.thunder();
    } else if (game.storm.on && game.passed >= game.nextStorm + STORM_LEN) {
      game.storm.on = false;
      game.nextStorm += EVENT_CYCLE;
      announce('Calm seas', '');
    }
    if (game.passed === game.nextBoss && !game.boss) startBoss();
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
      Sfx.rum();
    }
  }

  function updateStorm(dt) {
    const st = game.storm;
    st.k += ((st.on ? 1 : 0) - st.k) * Math.min(1, dt * 0.8);
    st.flash = Math.max(0, st.flash - dt * 4);
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
        game.nextBoss += EVENT_CYCLE;
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
    // No new warships while a storm blows or the man-o'-war is out.
    if (!game.boss && !game.storm.on && game.enemies.filter(e => e.state !== 'sinking').length < maxEnemies()) {
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
      const hold = e.state === 'leave' ? W + 160 : e.station;
      e.x += (hold - e.x) * Math.min(1, dt * 1.4);
      // Shadow the player's height, but slowly enough to be outrun.
      const dy = clampSea(s.y) - e.y;
      e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.T.track * dt);

      if (e.state === 'enter' && e.t > 1.2) e.state = 'fight';
      if (e.state === 'fight') {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          enemyVolley(e);
          e.fireT = rnd(...e.T.fire) - Math.min(0.5, game.passed * 0.01);
        }
        if (e.t > e.T.stay) e.state = 'leave';
      }
    }
    game.enemies = game.enemies.filter(e => e.sink < 1 && !(e.state === 'leave' && e.x > W + 140));
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
        if (e.state === 'sinking') continue;
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
    if (game.untilGull <= 0) {
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
    const tempo = game.boss && game.boss.state !== 'sinking' ? 1.08 : game.storm.on ? 1.04 : 1;
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
        if (!r.passed && r.x + REEF_W < SHIP_X) {
          r.passed = true;
          onReefPassed();
        }
        const p = r.pickup;
        if (p && !p.taken) {
          const px = r.x + PICKUP_DX;
          if (shipCircles().some(c => (c.x - px) ** 2 + (c.y - p.y) ** 2 < (c.r + 16) ** 2)) collect(p, px);
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

  function drawBackground() {
    // The weather turns as the run gets harder.
    const storm = game.state === 'menu' ? 0 : Math.max(Math.min(1, game.passed / 45) * 0.7, game.storm.k);
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, mix('#2e8fe6', '#34405e', storm));
    sky.addColorStop(1, mix('#9fdcff', '#8795b0', storm));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 2);

    for (const c of game.clouds) Art.cloud(ctx, c.x, c.y, c.s);
    for (const g of game.gulls) Art.gull(ctx, g.x, g.y, g.t, g.s);

    const sea = ctx.createLinearGradient(0, HORIZON, 0, H);
    sea.addColorStop(0, mix('#2fc3e0', '#2b8ea6', storm));
    sea.addColorStop(1, mix('#0b56a3', '#0a3a6e', storm));
    ctx.fillStyle = sea;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    ctx.strokeStyle = Art.INK;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke();
    for (const d of game.sails) Art.distantSail(ctx, d.x, HORIZON - 3, d.s);
    Art.island(ctx, W + 120 - ((game.scroll * 0.06 + 300) % (W + 260)), HORIZON + 2);

    // Rows of little cartoon wave marks, farther rows scroll slower.
    ctx.lineCap = 'round';
    for (let row = 0; HORIZON + 30 + row * 62 < FLOOR - 10; row++) {
      const y = HORIZON + 30 + row * 62;
      const k = 0.3 + row * 0.18;
      const spacing = 130;
      const off = (game.scroll * k + row * 47) % spacing;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + row * 0.08})`;
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
    ctx.fillStyle = '#e8c274';
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
      ctx.fillStyle = `rgba(255,255,255,${st.flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
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
    const pw = 360, ph = 190, px = W / 2 - pw / 2;
    Art.panel(ctx, px, y0, pw, ph);
    Art.label(ctx, 'Score', px + 40, y0 + 40, 22, '#6b4a22', 'left');
    Art.label(ctx, String(game.score), px + pw - 40, y0 + 40, 30, Art.INK, 'right');
    Art.label(ctx, 'Best', px + 40, y0 + 78, 22, '#6b4a22', 'left');
    Art.label(ctx, String(game.best), px + pw - 40, y0 + 78, 26, Art.INK, 'right');
    ctx.strokeStyle = '#d7b87e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px + 30, y0 + 102); ctx.lineTo(px + pw - 30, y0 + 102); ctx.stroke();
    Art.label(ctx, `Reefs ${game.passed}   ·   Frigates ${game.sunk.frigate}   ·   Galleons ${game.sunk.galleon}`,
      W / 2, y0 + 128, 15, '#6b4a22');
    Art.label(ctx, `Treasure ${game.treasure}   ·   Men-o'-war ${game.bossesBeaten}`, W / 2, y0 + 154, 15, '#6b4a22');
    if (game.newBest) Art.ribbon(ctx, W / 2, y0 - 2, 150, 'NEW BEST!', -0.04 + Math.sin(game.t * 3) * 0.02);
    ctx.globalAlpha = 1;
    if (game.deadT >= 0.7) {
      ctx.globalAlpha = 0.6 + Math.sin(game.t * 5) * 0.4;
      Art.text(ctx, isTouch() ? 'Tap SAIL to sail again' : 'Tap to sail again', W / 2, y0 + ph + 40, isTouch() ? 26 : 22, '#fff');
      ctx.globalAlpha = 1;
    }
  }
  // Phones and tablets: index.html adds .touch (and can add it late, on a first touch).
  const isTouch = () => document.documentElement.classList.contains('touch');

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
      } else {
        Art.text(ctx, 'Tap, click or press Space to set sail!', menuX(), 316, 22);
        Art.text(ctx, 'Space / click: sail up  ·  F / right-click: FIRE!', menuX(), 346, 16, '#ffd34e');
      }
      if (game.best > 0) Art.text(ctx, `Best: ${game.best}`, menuX(), 378, 18, '#bdf0f5');
    } else if (game.state === 'playing') {
      ctx.save();
      ctx.translate(W / 2, 50);
      ctx.scale(1 + game.scorePop * 0.35, 1 + game.scorePop * 0.35);
      Art.text(ctx, String(game.score), 0, 0, 52, game.scorePop > 0.5 ? '#ffe14d' : '#fff');
      ctx.restore();
      const cooldown = game.rapid > 0 ? RAPID_COOLDOWN : FIRE_COOLDOWN;
      // Phones get real on-screen buttons instead (see updatePad).
      if (!isTouch()) Art.fireButton(ctx, W - 50, H - 78, 30, 1 - game.reload / cooldown, game.rapid > 0 ? 'RUM!' : 'F');
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
        ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
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

  function render() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#0d3b4f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const k = view.scale * view.dpr;
    const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.translate(sx, sy);

    drawBackground();
    // Enemy ships sail behind the reefs; sandbars give both sides cover.
    for (const e of game.enemies) {
      const charge = e.state === 'fight' && e.fireT < 0.45 ? 1 - e.fireT / 0.45 : 0;
      const jolt = e.flash > 0 ? Math.sin(e.flash * 90) * 4 : 0;
      const y = e.y + Math.sin(game.t * 2.2 + e.station) * 3;
      Art[e.kind](ctx, e.x + jolt, y, game.t, e.sink, charge);
      if (e.T.hp > 1 && e.state !== 'sinking') Art.pips(ctx, e.x, y - e.T.box.top - 12, e.hp, e.T.hp);
    }
    const B = game.boss;
    if (B) {
      const nextIsWall = (B.attacks + 1) % 3 === 0;
      const charge = B.state === 'fight' && B.wall <= 0 && !nextIsWall && B.attackT < 0.45 ? 1 - B.attackT / 0.45 : 0;
      const jolt = B.flash > 0 ? Math.sin(B.flash * 90) * 4 : 0;
      Art.manOWar(ctx, B.x + jolt, B.y + Math.sin(game.t * 1.6) * 3, game.t, B.sink, charge, B.wall > 0 ? 1 - B.wall / 0.9 : 0);
    }
    for (const r of game.reefs) {
      Art.stormCloud(ctx, r.x, r.top, REEF_W, r.look, game.t);
      Art.sandbar(ctx, r.x, r.bottom, REEF_W, H + 10, r.look);
    }
    for (const r of game.reefs) {
      const p = r.pickup;
      if (p && !p.taken) Art[p.kind === 'chest' ? 'chest' : 'barrel'](ctx, r.x + PICKUP_DX, p.y, game.t + r.x * 0.01);
    }
    const s = game.ship;
    for (const b of game.balls) Art.cannonball(ctx, b.x, b.y, 5);
    for (const b of game.shots) Art.cannonball(ctx, b.x, b.y, b.r);
    Art.ship(ctx, SHIP_X, s.y, s.tilt, s.stretch, game.t, SHIP_SCALE);
    for (const f of game.flashes) Art.burst(ctx, f.x, f.y, f.r, '', f.x);
    drawParticles();
    drawFloor();
    drawRain();
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

  function resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * view.dpr);
    canvas.height = Math.round(ch * view.dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    // Portrait phone: the sea sits above the SAIL / FIRE deck, clear of the notch.
    let top = 0, room = ch;
    if (isTouch() && ch > cw) {
      top = parseFloat(getComputedStyle(insetProbe).paddingTop) || 0;
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
    if (game.paused) { e.preventDefault(); setPaused(false); return; }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); flap(); }
    if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'ArrowRight' || e.code === 'Enter') { e.preventDefault(); fire(); }
    if (e.code === 'KeyM') Sfx.toggleMute();
  });
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

  // Keeps the DOM buttons in step with the game: reload ring, rum, pause and mute icons.
  const padState = {};
  function updatePad() {
    if (!isTouch()) return;
    const set = (key, value, apply) => { if (padState[key] !== value) { padState[key] = value; apply(value); } };
    const cooldown = game.rapid > 0 ? RAPID_COOLDOWN : FIRE_COOLDOWN;
    const ready = game.state === 'playing' ? Math.max(0, Math.min(1, 1 - game.reload / cooldown)) : 1;
    set('ready', ready.toFixed(2), v => fireBtn.style.setProperty('--ready', v));
    set('loaded', ready >= 1, v => fireBtn.classList.toggle('ready', v));
    set('rum', game.rapid > 0, v => { fireBtn.classList.toggle('rum', v); fireLabel.textContent = v ? 'RUM!' : 'FIRE'; });
    set('playing', game.state === 'playing', v => { pauseBtn.hidden = !v; });
    set('paused', game.paused, v => { pauseBtn.textContent = v ? '▶' : '❚❚'; pauseBtn.setAttribute('aria-label', v ? 'Resume' : 'Pause'); });
    set('muted', Sfx.muted, v => { muteBtn.textContent = v ? '🔇' : '🔊'; muteBtn.setAttribute('aria-label', v ? 'Unmute sound' : 'Mute sound'); });
  }
  window.addEventListener('contextmenu', e => e.preventDefault());

  // Fixed timestep so physics feel the same at 60 Hz and 120 Hz.
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    if (game.paused) acc = 0;
    while (acc >= TICK) { update(TICK); acc -= TICK; }
    render();
    updatePad();
    requestAnimationFrame(frame);
  }

  if (GOD) {
    window.reef = game;
    // Advance the simulation by `secs` and draw, even when the tab is hidden.
    window.reefStep = secs => { for (let i = 0; i < secs / TICK; i++) update(TICK); render(); updatePad(); };
  }
  resize();
  requestAnimationFrame(frame);
})();
