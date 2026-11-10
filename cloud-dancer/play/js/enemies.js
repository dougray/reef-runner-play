// The King's Aerial Navy: each enemy kind, its movement and fire, wave spawning (and formations)
// by stage, each stage's mid-way set piece, aimed fire that respects cloud cover, and mine blasts.
// Pure logic.
(() => {
  const CD = window.CD;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  // Aimed fire from (x, y): at the ship, unless it's hiding in a cloud (then straight left). A
  // searchlight that has spotted the ship (w.spotted) shows every gunner where it is, cloud or not.
  CD.aimAt = (w, s, x, y, speed) => {
    if (CD.inCloud(w, s) && !(w.spotted > 0)) return { vx: -speed, vy: 0 };
    const ax = s.x + s.w / 2 - x, ay = s.y + s.h / 2 - y, len = Math.hypot(ax, ay) || 1;
    return { vx: (ax / len) * speed, vy: (ay / len) * speed };
  };
  const shoot = (w, x, y, v, extra = {}) => w.shots.push({ x, y, vx: v.vx, vy: v.vy, r: 2, friendly: false, dmg: 1, life: 5, ...extra });

  CD.ENEMIES = {
    gyro: {
      w: 18, h: 12, hp: 2, score: 50, gold: 1,
      update(e, w, s, dt) {
        e.x -= 70 * dt;
        if (e.diver && e.x < CD.VIEW_W * 0.75) e.y += CD.clamp(s.y - e.y, -1, 1) * 60 * dt;
        else e.y = e.y0 + Math.sin(e.t * 3 + (e.phase || 0)) * (e.amp || 0);
        if ((e.fire -= dt) <= 0 && e.x < CD.VIEW_W - 20 && e.x > s.x + 40) {
          e.fire = 2.2 + w.rand() * 1.5;
          shoot(w, e.x, e.y + e.h / 2, CD.aimAt(w, s, e.x, e.y + e.h / 2, 110));
        }
      },
    },
    zeppelin: {
      w: 76, h: 36, hp: 12, score: 250, gold: 3, drops: 'weapon',
      update(e, w, s, dt) {
        e.x -= (e.x > CD.VIEW_W - 110 ? 40 : 14) * dt;     // glides in, then crawls
        e.y = e.y0 + Math.sin(e.t * 0.9) * 4;
        if ((e.fire -= dt) <= 0 && e.x < CD.VIEW_W - 60) {
          e.fire = 2.6; e.firing = 0.25;
          const gx = e.x + 20, gy = e.y + e.h - 4, v = CD.aimAt(w, s, gx, gy, 100), a = Math.atan2(v.vy, v.vx);
          for (const da of [-0.3, 0, 0.3]) shoot(w, gx, gy, { vx: Math.cos(a + da) * 100, vy: Math.sin(a + da) * 100 });
          emit(w, 'broadside', gx, gy);
        }
        e.firing = Math.max(0, (e.firing || 0) - dt);
      },
    },
    mine: {
      w: 16, h: 28, hp: 1, score: 25, gold: 1, blast: 30,
      update(e, w, s, dt) { e.x -= 34 * dt; e.y = e.y0 + Math.sin(e.t * 2 + e.x * 0.01) * 3; },
    },
    flak: {
      w: 18, h: 18, hp: 4, score: 100, gold: 1,
      update(e, w, s, dt) {
        e.x -= 34 * dt;                                // sits on an island far below, scrolling with the sea
        flakFire(e, w, s, dt, e.y);
      },
    },
    // The Sky Citadel's guns hang upside down from its underside, firing down.
    ceilflak: {
      w: 18, h: 18, hp: 5, score: 120, gold: 1,
      update(e, w, s, dt) { e.x -= 34 * dt; flakFire(e, w, s, dt, e.y + e.h); },
    },
    // The Midnight Picket's searchlight zeppelins: a beam sweeps the sky below; caught in it, the ship
    // is spotted (every gun can see it, even in a cloud) and the picket fires on it.
    picket: {
      w: 60, h: 28, hp: 8, score: 200, gold: 2,
      update(e, w, s, dt) {
        e.x -= (e.x > CD.VIEW_W - 90 ? 40 : 16) * dt;
        e.y = e.y0 + Math.sin(e.t * 0.9) * 3;
        e.beam = 2.25 + Math.sin(e.t * 0.7 + (e.phase || 0)) * 0.55;   // radians: down and to the left
        if (CD.inBeam(e, s)) {
          if (!(w.spotted > 0)) emit(w, 'spotted', s.x, s.y);
          w.spotted = 1.2; e.lit = true;
          if ((e.fire -= dt) <= 0) { e.fire = 0.55; const lx = CD.lampOf(e); shoot(w, lx[0], lx[1], CD.aimAt(w, s, lx[0], lx[1], 140)); }
        } else { e.lit = false; e.fire = Math.max(e.fire, 0.3); }
      },
    },
    // The Frozen Heights' mines: cased in ice (three hits), and they shatter into shards, not a blast.
    icemine: {
      w: 16, h: 28, hp: 3, score: 60, gold: 1, shards: 6,
      update(e, w, s, dt) { e.x -= 30 * dt; e.y = e.y0 + Math.sin(e.t * 1.6 + e.x * 0.01) * 4; },
    },
    // The Ash Clouds' bombers: fire-gyros that cross high up and drop firebombs as they pass over.
    bomber: {
      w: 18, h: 12, hp: 3, score: 90, gold: 1,
      update(e, w, s, dt) {
        e.x -= 62 * dt; e.y = e.y0 + Math.sin(e.t * 2 + (e.phase || 0)) * 5;
        if ((e.fire -= dt) <= 0 && e.x > s.x - 30 && e.x < s.x + s.w + 110) {
          e.fire = 1.3 + w.rand() * 0.6;
          shoot(w, e.x + e.w / 2, e.y + e.h, { vx: -40, vy: 30 }, { grav: 150, r: 2.6, bomb: true });
        }
      },
    },
    // The Thunderhead's conductor balloons fly in pairs with an arc of lightning between them that
    // switches on and off (it flickers first); shoot either to break the arc.
    rod: {
      w: 16, h: 28, hp: 3, score: 80, gold: 1,
      update(e, w, s, dt) {
        e.x -= 32 * dt; e.y = e.y0 + Math.sin(e.t * 1.4 + (e.phase || 0)) * 4;
        if (!e.lead) return;
        const m = e.mate, c = ((e.t + 0.6) % 2.6);
        e.arc = m && m.hp > 0 && !m.dead ? (c < 0.7 ? 'warn' : c < 2 ? 'on' : null) : null;
        if (e.arc === 'on' && CD.nearArc(e, s)) CD.hurt(s, w);
      },
    },
    // A pay-ship (a set piece): a gilded navy balloon carrying the wages. It never fires, and it
    // turns tail and runs; catch it for a chest and a pile of gold.
    payship: {
      w: 50, h: 22, hp: 10, score: 300, gold: 6, chest: true,
      update(e, w, s, dt) {
        e.y = e.y0 + Math.sin(e.t * 1.6) * 6;
        if (e.t < 4) e.x -= (e.x > CD.VIEW_W - 80 ? 60 : 14) * dt;
        else { e.x += Math.min(110, (e.t - 4) * 60) * dt; e.y0 -= 8 * dt; if (!e.fled) { e.fled = true; emit(w, 'tell', e.x, e.y); } }
      },
    },
    pike: {
      w: 22, h: 10, hp: 3, score: 125, gold: 2,
      update(e, w, s, dt) {
        // cruises, telegraphs (e.tell), then darts at where the ship was
        if (!e.state) { e.state = 'cruise'; e.timer = 1 + w.rand(); }
        if (e.state === 'cruise') { e.x -= 50 * dt; e.y = e.y0 + Math.sin(e.t * 4) * 6; if ((e.timer -= dt) <= 0 && e.x < CD.VIEW_W - 30) { e.state = 'tell'; e.timer = 0.6; e.tell = true; } }
        else if (e.state === 'tell') { e.x -= 10 * dt; if ((e.timer -= dt) <= 0) { const v = CD.aimAt(w, s, e.x, e.y, 240); e.vx = v.vx; e.vy = v.vy; e.state = 'dart'; e.tell = false; } }
        else { e.x += e.vx * dt; e.y += e.vy * dt; }
      },
    },
    lurker: {
      w: 20, h: 14, hp: 3, score: 150, gold: 2,
      update(e, w, s, dt) {
        // rides a cloud: hidden (can't be hit) most of the time, pops out to fire
        e.x -= 34 * dt;
        e.cycle = (e.cycle ?? 2) - dt;
        if (e.hidden && e.cycle <= 0) { e.hidden = false; e.cycle = 1.4; e.shotDone = false; }
        else if (!e.hidden && e.cycle <= 0) { e.hidden = true; e.cycle = 2.4 + w.rand(); }
        if (!e.hidden && !e.shotDone && e.cycle < 1.0) { e.shotDone = true; shoot(w, e.x, e.y + e.h / 2, CD.aimAt(w, s, e.x, e.y + e.h / 2, 120)); }
      },
    },
  };

  function flakFire(e, w, s, dt, my) {
    if ((e.fire -= dt) <= 0 && e.x < CD.VIEW_W - 10 && e.x > 10) { e.fire = 2.4 + w.rand(); e.burst = 3; }
    if (e.burst > 0 && (e.burstT = (e.burstT || 0) - dt) <= 0) {
      e.burst--; e.burstT = 0.14;
      shoot(w, e.x + e.w / 2, my, CD.aimAt(w, s, e.x + e.w / 2, my, 130), { flak: true });
    }
  }
  // A picket's lamp (under the gondola) and whether the ship is in its beam.
  CD.BEAM_LEN = 230; CD.BEAM_HALF = 0.13;
  CD.lampOf = e => [e.x + 22, e.y + e.h - 2];
  CD.inBeam = (e, s, angle = e.beam, lamp = CD.lampOf(e)) => {
    const dx = s.x + s.w / 2 - lamp[0], dy = s.y + s.h / 2 - lamp[1], d = Math.hypot(dx, dy);
    if (d > CD.BEAM_LEN || d < 4) return false;
    let da = Math.atan2(dy, dx) - angle; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    return Math.abs(da) < CD.BEAM_HALF + 8 / d;
  };
  // A conductor pair's arc runs between the two balloons' copper rods (their bottoms).
  CD.rodTip = e => [e.x + e.w / 2, e.y + e.h];
  CD.nearArc = (e, s) => {
    const [ax, ay] = CD.rodTip(e), [bx, by] = CD.rodTip(e.mate), px = s.x + s.w / 2, py = s.y + s.h / 2;
    const vx = bx - ax, vy = by - ay, k = CD.clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    return Math.hypot(ax + vx * k - px, ay + vy * k - py) < 7;
  };

  // `loop`: how many times the areas have cycled; each adds half the base health.
  CD.makeEnemy = (type, x, y, extra = {}, loop = 0) => {
    const d = CD.ENEMIES[type], hp = Math.ceil(d.hp * (1 + loop * 0.5));
    return { type, x, y, w: d.w, h: d.h, hp, maxHp: hp, t: 0, y0: y, flash: 0, fire: 1, ...extra };
  };

  function pick(rand, mix) {
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (const [k, v] of Object.entries(mix)) { if ((r -= v) < 0) return k; }
    return Object.keys(mix)[0];
  }

  CD.spawnWave = (w, s) => {
    const area = CD.areaAt(w.distance), r = w.rand, L = area.loop, X = CD.VIEW_W + 10;
    const type = pick(r, area.mix), add = (t, x, y, extra) => w.enemies.push(CD.makeEnemy(t, x, y, extra, L));
    // After the first stage, waves sometimes come in formation (`shape`) rather than a loose line.
    const shape = area.index > 0 || L > 0 || w.distance > CD.AREA_LEN * 0.4 ? r() : 1;
    if (type === 'gyro' && shape < 0.22) {                 // a V, nose first, flying level
      const y = 50 + r() * (CD.VIEW_H - 120);
      for (let i = 0; i < 5; i++) add('gyro', X + Math.abs(i - 2) * 22, y + (i - 2) * 16, { amp: 0, fire: 1.2 + Math.abs(i - 2) * 0.5 + r() });
      w.formation = 'vee';
    } else if (type === 'gyro' && shape < 0.36) {          // a column, weaving together
      const y = 24 + r() * (CD.VIEW_H - 130), phase = r() * 6.28;
      for (let i = 0; i < 4; i++) add('gyro', X, y + i * 22, { amp: 14, phase, fire: 1 + i * 0.4 + r() });
      w.formation = 'column';
    } else if (type === 'gyro') {
      const n = 3 + Math.floor(r() * 3), y = 30 + r() * (CD.VIEW_H - 80), amp = 10 + r() * 25, phase = r() * 6.28, diver = r() < 0.4;
      for (let i = 0; i < n; i++) add('gyro', X + i * 26, y, { amp, phase: phase + i * 0.6, diver: diver && i === n - 1, fire: 1 + r() * 2 });
    } else if (type === 'zeppelin') {
      const y = 18 + r() * 40;
      add('zeppelin', X, y, { fire: 1.5 });
      if (shape < 0.35) {                                   // an escort of gyrocopters above and below
        for (const dy of [-16, 44]) add('gyro', X + 30, CD.clamp(y + dy, 6, CD.VIEW_H - 20), { amp: 6, phase: dy, fire: 2 + r() });
        w.formation = 'escort';
      }
    } else if (type === 'mine' && shape < 0.25) {          // a wall of mines with one gap to slip through
      const gap = 1 + Math.floor(r() * 3);
      for (let i = 0; i < 6; i++) if (i !== gap && i !== gap + 1) add('mine', X, 6 + i * 34, {});
      w.formation = 'wall';
    } else if (type === 'mine') {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) add('mine', X + i * 40, 30 + r() * (CD.VIEW_H - 90), {});
    } else if (type === 'icemine') {
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) add('icemine', X + i * 46, 24 + r() * (CD.VIEW_H - 80), {});
    } else if (type === 'picket') {
      add('picket', X, 10 + r() * 26, { phase: r() * 6.28, fire: 0.6 });
      if (shape < 0.4) add('gyro', X + 40, 70 + r() * 60, { amp: 20, fire: 1.5 });
    } else if (type === 'bomber') {
      const n = 2 + Math.floor(r() * 3), y = 10 + r() * 30;
      for (let i = 0; i < n; i++) add('bomber', X + i * 34, y + (i % 2) * 8, { phase: i, fire: 0.5 + i * 0.3 });
    } else if (type === 'rod') {
      const y = 14 + r() * (CD.VIEW_H - 150), gap = 64 + r() * 40, phase = r() * 6.28;
      const a = CD.makeEnemy('rod', X, y, { lead: true, phase }, L), b = CD.makeEnemy('rod', X + (r() - 0.5) * 30, y + gap, { phase }, L);
      a.mate = b; b.mate = a; w.enemies.push(a, b);
    } else if (type === 'ceilflak') {
      add('ceilflak', X, 4, { fire: 1 });
    } else if (type === 'flak') {
      w.enemies.push(CD.makeEnemy('flak', X, CD.VIEW_H - 24, { fire: 1 }, L));
    } else if (type === 'pike') {
      const n = 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) w.enemies.push(CD.makeEnemy('pike', X + i * 50, 40 + r() * (CD.VIEW_H - 100), {}, L));
    } else if (type === 'lurker') {
      // lurkers come with their own cloud
      const y = 78 + r() * 50;
      w.clouds.push({ x: X - 30, y: y - 14, w: 110, h: 44 });
      w.enemies.push(CD.makeEnemy('lurker', X + 10, y, { hidden: true, cycle: 1.5 + r() }, L));
    }
    w.wave = (w.wave || 0) + 1;
    w.spawnTimer = CD.spawnInterval(w.distance) + r() * 1.2;
  };

  // Set pieces: once a stage, half-way through, something different happens (announced with a
  // banner). Each: { name, sub, run(w, s, loop) }.
  CD.SET_PIECE_AT = 1700;           // distance into the stage
  CD.SETPIECES = {
    payship: { name: 'A PAY-SHIP!', sub: 'CATCH IT BEFORE IT RUNS', run: (w, s, L) => {
      w.enemies.push(CD.makeEnemy('payship', CD.VIEW_W + 10, 30 + w.rand() * 60, {}, L));
      for (const dy of [-14, 34]) w.enemies.push(CD.makeEnemy('gyro', CD.VIEW_W + 60, 60 + dy, { amp: 8, fire: 2 }, L));
    } },
    squall: { name: 'SQUALL LINE!', sub: 'LIGHTNING MARCHES ACROSS', run: w => {
      for (let i = 0; i < 6; i++) w.bolts.push({ x: CD.VIEW_W - 30 - i * 56, warn: 1 + i * 0.35, strike: 0.25 });
    } },
    battery: { name: 'GUN BATTERY', sub: 'THREE FLAK TOWERS IN A ROW', run: (w, s, L) => {
      for (let i = 0; i < 3; i++) w.enemies.push(CD.makeEnemy('flak', CD.VIEW_W + 10 + i * 46, CD.VIEW_H - 24, { fire: 1 + i * 0.5 }, L));
    } },
    nest: { name: 'A LURKER NEST', sub: 'WATCH THE CLOUDS', run: (w, s, L) => {
      for (let i = 0; i < 3; i++) {
        const x = CD.VIEW_W + 10 + i * 90, y = 60 + i * 30;
        w.clouds.push({ x: x - 30, y: y - 14, w: 110, h: 44 });
        w.enemies.push(CD.makeEnemy('lurker', x + 10, y, { hidden: true, cycle: 1 + i * 0.6 }, L));
      }
    } },
    pickets: { name: 'SEARCHLIGHT LINE', sub: 'SLIP BETWEEN THE BEAMS', run: (w, s, L) => {
      for (let i = 0; i < 3; i++) w.enemies.push(CD.makeEnemy('picket', CD.VIEW_W + 10 + i * 80, 8 + (i % 2) * 22, { phase: i * 2.1, fire: 0.6 }, L));
    } },
    avalanche: { name: 'AVALANCHE!', sub: 'ICE FALLING ALL ACROSS', run: w => {
      for (let i = 0; i < 9; i++) CD.addFall(w, 30 + i * 40 + w.rand() * 10, 'ice', 1 + (i % 3) * 0.5);
    } },
    eruption: { name: 'ERUPTION!', sub: 'LAVA FROM BELOW', run: (w, s) => {
      for (let i = 0; i < 6; i++) CD.addFall(w, s.x + s.w / 2 - 100 + i * 45, 'lava', 1.1 + i * 0.3);
    } },
    fence: { name: 'CONDUCTOR FENCE', sub: 'WAIT FOR THE ARCS TO DROP', run: (w, s, L) => {
      for (let i = 0; i < 3; i++) {
        const x = CD.VIEW_W + 10 + i * 100, y = 12 + (i % 2) * 40;
        const a = CD.makeEnemy('rod', x, y, { lead: true, phase: i, t: i * 0.9 }, L), b = CD.makeEnemy('rod', x, y + 110, { phase: i, t: i * 0.9 }, L);
        a.mate = b; b.mate = a; w.enemies.push(a, b);
      }
    } },
    curtain: { name: 'FLAK CURTAIN!', sub: 'FIND THE GAP', run: (w, s) => {
      for (let i = 0; i < 3; i++) CD.addCurtain(w, CD.VIEW_W - 50 - i * 30, 10 + w.rand() * (CD.VIEW_H - 80), 1.2 + i * 1.1);
    } },
  };
  CD.updateSetPiece = (w, s) => {
    if (w.boss) return;
    const n = Math.floor(w.distance / CD.AREA_LEN), into = w.distance - n * CD.AREA_LEN;
    if (into < CD.SET_PIECE_AT || w.setPieceDone === n) return;
    w.setPieceDone = n;
    const area = CD.areaAt(w.distance), p = CD.SETPIECES[area.setPiece];
    if (!p) return;
    p.run(w, s, area.loop);
    w.setPieces = (w.setPieces || 0) + 1;
    w.events.push({ name: 'setPiece', x: 0, y: 0, title: p.name, sub: p.sub });
  };

  // A blast at (x, y): enemies within r take 3, the ship within r takes a hit.
  // An ice mine shattering: shards flying out in a ring.
  CD.shatter = (w, x, y, n) => {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3; shoot(w, x, y, { vx: Math.cos(a) * 75, vy: Math.sin(a) * 75 }, { shard: true, life: 2 }); }
    w.fx.push({ type: 'boom', x, y, t: 0.3, r: 10 });
    emit(w, 'shatter', x, y);
  };

  CD.explode = (w, s, x, y, r) => {
    w.fx.push({ type: 'boom', x, y, t: 0.5, r });
    emit(w, 'blast', x, y);
    const near = b => Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < r + Math.max(b.w, b.h) / 2;
    for (const e of w.enemies) if (e.hp > 0 && !e.hidden && near(e)) { e.hp -= 3; e.flash = 0.1; if (e.hp <= 0) CD.killEnemy(w, s, e); }
    if (near(s)) CD.hurt(s, w);
  };

  CD.updateEnemies = (w, s, dt) => {
    for (const e of w.enemies) {
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      CD.ENEMIES[e.type].update(e, w, s, dt);
      if (e.x < -100 || e.x > CD.VIEW_W + 200 || e.y > CD.VIEW_H + 60 || e.y < -60) e.gone = true;
    }
  };
})();
