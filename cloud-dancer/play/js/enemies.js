// The King's Aerial Navy: each enemy kind, its movement and fire, wave spawning by area, aimed
// fire that respects cloud cover, and mine blasts. Pure logic.
(() => {
  const CD = window.CD;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  // Aimed fire from (x, y): at the ship, unless it's hiding in a cloud (then straight left).
  CD.aimAt = (w, s, x, y, speed) => {
    if (CD.inCloud(w, s)) return { vx: -speed, vy: 0 };
    const ax = s.x + s.w / 2 - x, ay = s.y + s.h / 2 - y, len = Math.hypot(ax, ay) || 1;
    return { vx: (ax / len) * speed, vy: (ay / len) * speed };
  };
  const shoot = (w, x, y, v, extra = {}) => w.shots.push({ x, y, vx: v.vx, vy: v.vy, r: 2, friendly: false, dmg: 1, life: 5, ...extra });

  CD.ENEMIES = {
    gyro: {
      w: 18, h: 12, hp: 2, score: 100, gold: 1,
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
      w: 76, h: 36, hp: 12, score: 500, gold: 6, drops: 'weapon',
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
      w: 16, h: 28, hp: 1, score: 50, gold: 1, blast: 30,
      update(e, w, s, dt) { e.x -= 34 * dt; e.y = e.y0 + Math.sin(e.t * 2 + e.x * 0.01) * 3; },
    },
    flak: {
      w: 18, h: 18, hp: 4, score: 200, gold: 2,
      update(e, w, s, dt) {
        e.x -= 34 * dt;                                // sits on an island far below, scrolling with the sea
        if ((e.fire -= dt) <= 0 && e.x < CD.VIEW_W - 10 && e.x > 10) {
          e.fire = 2.4 + w.rand(); e.burst = 3;
        }
        if (e.burst > 0 && (e.burstT = (e.burstT || 0) - dt) <= 0) {
          e.burst--; e.burstT = 0.14;
          shoot(w, e.x + e.w / 2, e.y, CD.aimAt(w, s, e.x + e.w / 2, e.y, 130), { flak: true });
        }
      },
    },
    pike: {
      w: 22, h: 10, hp: 3, score: 250, gold: 3,
      update(e, w, s, dt) {
        // cruises, telegraphs (e.tell), then darts at where the ship was
        if (!e.state) { e.state = 'cruise'; e.timer = 1 + w.rand(); }
        if (e.state === 'cruise') { e.x -= 50 * dt; e.y = e.y0 + Math.sin(e.t * 4) * 6; if ((e.timer -= dt) <= 0 && e.x < CD.VIEW_W - 30) { e.state = 'tell'; e.timer = 0.6; e.tell = true; } }
        else if (e.state === 'tell') { e.x -= 10 * dt; if ((e.timer -= dt) <= 0) { const v = CD.aimAt(w, s, e.x, e.y, 240); e.vx = v.vx; e.vy = v.vy; e.state = 'dart'; e.tell = false; } }
        else { e.x += e.vx * dt; e.y += e.vy * dt; }
      },
    },
    lurker: {
      w: 20, h: 14, hp: 3, score: 300, gold: 3,
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
    const type = pick(r, area.mix);
    if (type === 'gyro') {
      const n = 3 + Math.floor(r() * 3), y = 30 + r() * (CD.VIEW_H - 80), amp = 10 + r() * 25, phase = r() * 6.28, diver = r() < 0.4;
      for (let i = 0; i < n; i++) w.enemies.push(CD.makeEnemy('gyro', X + i * 26, y, { amp, phase: phase + i * 0.6, diver: diver && i === n - 1, fire: 1 + r() * 2 }, L));
    } else if (type === 'zeppelin') {
      w.enemies.push(CD.makeEnemy('zeppelin', X, 18 + r() * 40, { fire: 1.5 }, L));
    } else if (type === 'mine') {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) w.enemies.push(CD.makeEnemy('mine', X + i * 40, 30 + r() * (CD.VIEW_H - 90), {}, L));
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

  // A blast at (x, y): enemies within r take 3, the ship within r takes a hit.
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
