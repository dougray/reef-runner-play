// The four bosses, one at the end of each area: arrival, the warn-then-attack loop, anger below
// half health, defeat and rewards, plus the tentacle-row hazards. Pure logic.
(() => {
  const CD = window.CD;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });
  const shoot = (w, x, y, vx, vy, extra = {}) => w.shots.push({ x, y, vx, vy, r: 2.5, friendly: false, dmg: 1, life: 6, ...extra });
  const aimed = (w, s, x, y, speed, da = 0) => {
    const v = CD.aimAt(w, s, x, y, speed), a = Math.atan2(v.vy, v.vx) + da;
    return [Math.cos(a) * speed, Math.sin(a) * speed];
  };
  const angry = b => b.hp < b.maxHp / 2;
  CD.bossTell = b => (angry(b) ? 0.5 : 0.85);
  const pause = b => (angry(b) ? 0.8 : 1.4);
  const minion = (w, type, x, y, extra) => w.enemies.push(CD.makeEnemy(type, x, y, { fromBoss: true, ...extra }, w.boss.loop));

  // Each attack: start(b, w, s) once, then step(b, w, s, dt) until it returns true.
  // A boss uses all three of its attacks (shuffled) before it repeats one.
  CD.BOSSES = {
    thunderer: {
      name: 'HMS THUNDERER', w: 120, h: 50, hp: 80, area: 'reef',
      attacks: {
        broadside: {
          start: b => { b.act = { n: angry(b) ? 4 : 3, gap: 0 }; },
          step: (b, w, s, dt) => {
            if ((b.act.gap -= dt) > 0) return false;
            const gx = b.x + 30, gy = b.y + b.h - 6;
            for (const da of [-0.4, -0.2, 0, 0.2, 0.4]) shoot(w, gx, gy, ...aimed(w, s, gx, gy, 105, da));
            emit(w, 'broadside', gx, gy);
            b.act.gap = 0.45; return --b.act.n <= 0;
          },
        },
        mines: {
          start: (b, w) => { const n = angry(b) ? 4 : 3; for (let i = 0; i < n; i++) minion(w, 'mine', b.x + 20 - i * 16, 20 + w.rand() * (CD.VIEW_H - 70)); b.act = { t: 0.6 }; },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
        gyros: {
          start: (b, w) => { const n = angry(b) ? 6 : 4, y = b.y + b.h / 2; for (let i = 0; i < n; i++) minion(w, 'gyro', b.x - 10 + i * 18, y, { amp: 30, phase: i * 0.8, fire: 1.5 + i * 0.3 }); b.act = { t: 0.8 }; emit(w, 'launch', b.x, y); },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
      },
    },
    tempest: {
      name: 'THE TEMPEST ENGINE', w: 70, h: 70, hp: 90, area: 'storm',
      attacks: {
        bolts: {
          start: (b, w, s) => {
            const n = angry(b) ? 5 : 3, cx = s.x + s.w / 2;
            for (let i = 0; i < n; i++) w.bolts.push({ x: CD.clamp(cx + (i - (n - 1) / 2) * 34, 12, CD.VIEW_W - 12), warn: 0.9 + i * 0.15, strike: 0.25 });
            b.act = { t: 1.6 };
          },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
        orbs: {
          start: b => { b.act = { rings: angry(b) ? 2 : 1, gap: 0 }; },
          step: (b, w, s, dt) => {
            if ((b.act.gap -= dt) > 0) return false;
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2, n = angry(b) ? 14 : 10, off = w.rand();
            for (let i = 0; i < n; i++) { const a = (i / n + off) * Math.PI * 2; shoot(w, cx, cy, Math.cos(a) * 70, Math.sin(a) * 70, { orb: true, r: 3 }); }
            emit(w, 'zap', cx, cy);
            b.act.gap = 0.7; return --b.act.rings <= 0;
          },
        },
        burst: {
          start: b => { b.act = { n: 3, shot: 0, gap: 0 }; },
          step: (b, w, s, dt) => {
            if ((b.act.gap -= dt) > 0) return false;
            const cx = b.x + 10, cy = b.y + b.h / 2;
            shoot(w, cx, cy, ...aimed(w, s, cx, cy, 150), { orb: true });
            b.act.shot++;
            if (b.act.shot % 3 === 0) { b.act.gap = 0.5; b.act.n--; } else b.act.gap = 0.1;
            return b.act.n <= 0;
          },
        },
      },
    },
    fort: {
      name: 'FORT SOVEREIGN', w: 110, h: 80, hp: 110, area: 'forts',
      turrets: [[18, 10], [55, 2], [92, 10]],
      attacks: {
        volley: {
          start: b => { b.act = { n: angry(b) ? 3 : 2, gap: 0 }; },
          step: (b, w, s, dt) => {
            if ((b.act.gap -= dt) > 0) return false;
            for (const [tx, ty] of CD.BOSSES.fort.turrets) shoot(w, b.x + tx, b.y + ty, ...aimed(w, s, b.x + tx, b.y + ty, 120));
            emit(w, 'broadside', b.x, b.y);
            b.act.gap = 0.6; return --b.act.n <= 0;
          },
        },
        mortar: {
          start: (b, w, s) => {
            const n = angry(b) ? 4 : 3;
            for (let i = 0; i < n; i++) {
              const tx = s.x + s.w / 2 + (i - (n - 1) / 2) * 40, x0 = b.x + 55, y0 = b.y;
              shoot(w, x0, y0, (tx - x0) / 1.4, -160, { grav: 180, fuse: 1.4 + i * 0.05, r: 3.5, shell: true });
            }
            emit(w, 'mortar', b.x, b.y); b.act = { t: 1.6 };
          },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
        rockets: {
          start: (b, w, s) => {
            const n = angry(b) ? 3 : 2;
            for (let i = 0; i < n; i++) shoot(w, b.x + 10, b.y + 30 + i * 14, -80, (i - 0.5) * 60, { homing: true, rocket: true, life: 4 });
            emit(w, 'rocket', b.x, b.y); b.act = { t: 1.2 };
          },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
      },
    },
    kraken: {
      name: 'THE BRASS KRAKEN', w: 90, h: 80, hp: 130, area: 'ceiling',
      attacks: {
        tentacle: {
          start: (b, w, s) => {
            const rows = [s.y + s.h / 2];
            for (let i = 1; i < (angry(b) ? 3 : 2); i++) rows.push(20 + w.rand() * (CD.VIEW_H - 40));
            rows.forEach((y, i) => w.hazards.push({ y: y - 9, h: 18, warn: 0.9 + i * 0.25, active: 0.5 }));
            b.act = { t: 1.8 };
          },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
        ink: {
          start: (b, w, s) => {
            // fire first, then squirt the ink: the volley is aimed, the ink hides what comes next
            const cx = b.x + 10, cy = b.y + b.h / 2, n = angry(b) ? 8 : 6;
            for (let i = 0; i < n; i++) shoot(w, cx, cy, ...aimed(w, s, cx, cy, 110, (i - (n - 1) / 2) * 0.12));
            for (let i = 0; i < 2; i++) w.clouds.push({ x: s.x - 20 + i * 90 + w.rand() * 30, y: CD.clamp(s.y - 20 + (w.rand() - 0.5) * 60, 10, CD.VIEW_H - 60), w: 70, h: 44, ink: true });
            emit(w, 'ink', cx, cy); b.act = { t: 1 };
          },
          step: (b, w, s, dt) => (b.act.t -= dt) <= 0,
        },
        grab: {
          start: (b, w, s) => { b.act = { phase: 'out', tx: Math.max(10, s.x - 10), ty: CD.clamp(s.y + s.h / 2 - b.h / 2, 0, CD.VIEW_H - b.h) }; emit(w, 'roar', b.x, b.y); },
          step: (b, w, s, dt) => {
            const a = b.act, sp = angry(b) ? 280 : 220;
            if (a.phase === 'out') {
              b.x -= sp * dt; b.y += CD.clamp(a.ty - b.y, -1, 1) * 120 * dt;
              if (b.x <= a.tx) { a.phase = 'hold'; a.t = 0.3; }
            } else if (a.phase === 'hold') { if ((a.t -= dt) <= 0) a.phase = 'back'; }
            else { b.x += sp * 0.7 * dt; if (b.x >= b.homeX) { b.x = b.homeX; return true; } }
            return false;
          },
        },
      },
    },
  };
  const ORDER = ['thunderer', 'tempest', 'fort', 'kraken'];
  CD.bossFor = areaIndex => ORDER[areaIndex % ORDER.length];

  CD.makeBoss = (id, loop = 0) => {
    const d = CD.BOSSES[id], hp = Math.round(d.hp * (1 + loop * 0.5));
    return {
      id, name: d.name, loop, x: CD.VIEW_W + 10, y: CD.VIEW_H / 2 - d.h / 2, w: d.w, h: d.h,
      homeX: CD.VIEW_W - d.w - 12, homeY: CD.VIEW_H / 2 - d.h / 2,
      hp, maxHp: hp, state: 'enter', timer: 0, t: 0, flash: 0, attack: null, last: null, next: null, act: {}, tell: false,
    };
  };

  CD.startBoss = (w, s) => {
    const area = CD.areaAt(w.distance);
    w.boss = CD.makeBoss(CD.bossFor(area.index), area.loop);
    emit(w, 'bossIn', w.boss.x, w.boss.y);
  };

  CD.damageBoss = (w, s, n) => {
    const b = w.boss;
    if (!b || b.state === 'enter') return;
    b.hp -= n; b.flash = 0.08;
    if (b.hp > 0) return;
    // defeat
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (let i = 0; i < 6; i++) w.fx.push({ type: 'boom', x: cx + (w.rand() - 0.5) * b.w, y: cy + (w.rand() - 0.5) * b.h, t: 0.45 + i * 0.12, r: 18 });
    for (let i = 0; i < 10; i++) w.pickups.push({ type: 'gold', x: cx - 40 + i * 8, y: cy - 10 + (i % 3) * 8, w: 10, h: 10, vy: -30 - (i % 4) * 10, t: 0 });
    w.pickups.push({ type: 'weapon', gun: CD.PICKUP_GUNS[Math.floor(w.rand() * CD.PICKUP_GUNS.length)], x: cx - 5, y: cy, w: 10, h: 10, vy: -20, t: 0 });
    if (!s.dead) { s.lives += 1; w.score += 1000; }       // no extra life for a ship that went down the same moment
    w.bossesBeaten = (w.bossesBeaten || 0) + 1;
    w.lastBoss = b.name;
    emit(w, 'bossDown', cx, cy);
    w.boss = null;
    w.hazards.length = 0; w.bolts.length = 0;              // its tentacles and lightning go with it
    w.nextBoss += CD.AREA_LEN;
  };

  CD.updateBoss = (w, s, dt) => {
    const b = w.boss, d = CD.BOSSES[b.id];
    b.t += dt; b.flash = Math.max(0, b.flash - dt);
    if (b.state !== 'act' || b.attack !== 'grab') b.y = b.homeY + Math.sin(b.t * 0.8) * 12;
    if (b.state === 'enter') {
      b.x -= 60 * dt;
      if (b.x <= b.homeX) { b.x = b.homeX; b.state = 'pause'; b.timer = 0.8; }
      return;
    }
    if (b.state === 'pause') {
      if ((b.timer -= dt) > 0) return;
      // every attack once, in a shuffled order, before any repeats
      const all = Object.keys(d.attacks);
      if (!b.bag || !b.bag.length) b.bag = all.filter(a => a !== b.last).sort(() => w.rand() - 0.5).concat(b.last && all.includes(b.last) ? [b.last] : []);
      b.attack = b.next || b.bag.shift(); b.next = null;
      b.state = 'tell'; b.tell = true; b.timer = CD.bossTell(b);
      emit(w, 'tell', b.x, b.y);
      return;
    }
    if (b.state === 'tell') {
      if (b.next) { b.attack = b.next; b.next = null; }
      if ((b.timer -= dt) > 0) return;
      b.tell = false; b.state = 'act'; b.act = {};
      d.attacks[b.attack].start(b, w, s);
      return;
    }
    if (b.state === 'act' && d.attacks[b.attack].step(b, w, s, dt)) {
      b.last = b.attack; b.state = 'pause'; b.timer = pause(b);
    }
  };

  // Tentacle rows: warn, then sweep the whole row.
  CD.updateHazards = (w, s, dt) => {
    for (const h of w.hazards) {
      if (h.warn > 0) { h.warn -= dt; if (h.warn <= 0) emit(w, 'sweep', 0, h.y); continue; }
      h.active -= dt;
      const cy = s.y + s.h / 2;
      if (h.active > 0 && cy > h.y && cy < h.y + h.h) CD.hurt(s, w);
    }
    w.hazards = w.hazards.filter(h => h.warn > 0 || h.active > 0);
  };
})();
