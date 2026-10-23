// Bosses: one per navy, waiting in the arena at the end of each area. Each runs the same loop
// (walk in → pause → tell → attack → pause …) with its own three attacks, and gets angrier below
// half health: shorter tells and pauses, more projectiles. Pure logic, no drawing.
(() => {
  const JR = window.JR;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  JR.BOSSES = {
    british: { name: 'THE BIG GUY', hp: 40, art: 'bigGuy', w: 30, h: 52, attacks: ['volley', 'mortar', 'summon'], item: 'swivel' },
    spanish: { name: 'THE CAPTAIN', hp: 45, art: 'pbCaptain', w: 30, h: 52, attacks: ['lunge', 'daggers', 'leap'], item: 'rapier' },
    french: { name: 'CUCUMBER', hp: 50, art: 'cucumber', w: 30, h: 52, attacks: ['mortar', 'grapeshot', 'kegs'], item: 'bomb' },
    dutch: { name: 'THE WHALE', hp: 60, art: 'whale', w: 52, h: 40, attacks: ['blast', 'pound', 'charge'], item: 'blunderbuss' },
  };

  const TELL = 0.7, PAUSE = 1.1;

  JR.makeBoss = (nation, x, groundY, minX, maxX, loop = 0) => {
    const def = JR.BOSSES[nation];
    const hp = def.hp + 15 * loop;
    return {
      type: 'B', boss: true, nation, name: def.name, x, y: groundY - def.h, w: def.w, h: def.h,
      hp, maxHp: hp, vx: 0, vy: 0, facing: -1, onGround: false, prop: false,
      ground: groundY, minX, maxX, home: maxX - 70,
      state: 'enter', timer: 0, attack: null, next: 0, force: null,
      t: 0, flash: 0, fired: 0, tell: false, act: {},
    };
  };

  const angry = b => b.hp < b.maxHp / 2;

  // Horizontal speed that lands a lobbed shot (launched upward at vy0) on (tx, ty).
  JR.lobVx = (x0, y0, tx, ty, vy0, maxVx = 240) => {
    const g = JR.GRAVITY;
    const tFlight = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * Math.max(0, ty - y0))) / g;
    return JR.clamp((tx - x0) / tFlight, -maxVx, maxVx);
  };

  const gun = b => ({ x: b.x + b.w / 2 + b.facing * 16, y: b.y + 14 });
  const aimAt = (w, from, p, speed, spread = 0, extra = {}) => {
    const a = Math.atan2(p.y + p.h / 2 - from.y, p.x + p.w / 2 - from.x) + spread;
    w.shots.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: 1, life: 3, friendly: false, r: 2.5, ...extra });
  };
  const fan = (w, from, p, n, width, speed, extra) => {
    for (let i = 0; i < n; i++) aimAt(w, from, p, speed, n > 1 ? -width + (2 * width * i) / (n - 1) : 0, extra);
  };
  const bombAt = (w, from, tx, ty) => {
    const vy = -300;
    w.shots.push({ x: from.x, y: from.y, vx: JR.lobVx(from.x, from.y, tx, ty, vy), vy, dmg: 1, life: 4, friendly: false, grav: true, boom: 22, r: 3, bomb: true });
  };
  const waves = (w, b) => {
    for (const d of [-1, 1]) w.shots.push({ x: b.x + b.w / 2 + d * 14, y: b.ground - 4, vx: d * 150, vy: 0, r: 4, life: 1.6, dmg: 1, friendly: false, wave: true });
    emit(w, 'pound', b.x, b.ground);
  };

  // Each attack: start(b, p, w) once, then step(b, p, w, dt) each frame until it returns true.
  const ATTACKS = {
    volley: {
      start: b => { b.act = { n: angry(b) ? 8 : 5, gap: 0 }; },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        const g = gun(b);
        aimAt(w, g, p, 150);
        w.fx.push({ type: 'flash', x: g.x, y: g.y, t: 0.06 });
        emit(w, 'shot', g.x, g.y);
        b.fired = 0.1; b.act.gap = 0.12;
        return --b.act.n <= 0;
      },
    },
    mortar: {
      start: (b, p, w) => {
        const spread = b.nation === 'french' ? 70 : 40, n = b.nation === 'french' && angry(b) ? 5 : 3;
        const from = { x: b.x + b.w / 2, y: b.y + 4 }, tx = p.x + p.w / 2;
        for (let i = 0; i < n; i++) bombAt(w, from, tx + (i - (n - 1) / 2) * spread, b.ground - 4);
        emit(w, 'throw', from.x, from.y);
        b.fired = 0.3; b.act = { wait: 0.4 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    summon: {
      start: (b, p, w) => {
        const helpers = w.enemies.filter(e => e.type === 'm' && e.hp > 0).length;
        for (let i = helpers; i < 2; i++) {
          const m = JR.makeEnemy('m', b.maxX - 40 - i * 34, b.ground - 24 - 90, b.nation);
          m.active = true; m.timer = 1.6 + i * 0.5;
          w.enemies.push(m);
        }
        emit(w, 'whistle', b.x, b.y);
        b.act = { wait: 0.6 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    lunge: {
      start: (b, p, w) => { b.act = { left: 0.7 }; emit(w, 'lunge', b.x, b.y); },
      step: (b, p, w, dt) => {
        b.vx = b.facing * (angry(b) ? 300 : 260);
        b.act.left -= dt;
        if (b.act.left <= 0 || b.hitEdge) { b.vx = 0; return true; }
        return false;
      },
    },
    daggers: {
      start: (b, p, w) => {
        const g = gun(b);
        fan(w, g, p, angry(b) ? 5 : 3, angry(b) ? 0.4 : 0.25, 170, { dagger: true });
        emit(w, 'throw', g.x, g.y);
        b.fired = 0.25; b.act = { wait: 0.35 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    leap: {
      start: (b, p) => {
        b.vy = -380;
        b.act = { vx: JR.clamp((p.x + p.w / 2 - (b.x + b.w / 2)) / 0.78, -230, 230), air: false };
      },
      step: (b, p, w) => {
        b.vx = b.act.vx;
        if (!b.onGround) b.act.air = true;
        else if (b.act.air) { b.vx = 0; waves(w, b); return true; }
        return false;
      },
    },
    grapeshot: {
      start: (b, p, w) => {
        const g = gun(b);
        fan(w, g, p, angry(b) ? 7 : 5, 0.3, 160);
        w.fx.push({ type: 'smoke', x: g.x, y: g.y, t: 0.4 });
        emit(w, 'cannon', g.x, g.y);
        b.fired = 0.25; b.act = { wait: 0.3 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    kegs: {
      start: b => { b.act = { n: 2, gap: 0 }; },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        w.shots.push({ x: b.x + b.w / 2 + b.facing * 14, y: b.ground - 5, vx: b.facing * (angry(b) ? 140 : 110), vy: 0, r: 5, life: 5, dmg: 1, friendly: false, roll: true, boom: 18 });
        emit(w, 'throw', b.x, b.y);
        b.fired = 0.2; b.act.gap = 0.45;
        return --b.act.n <= 0;
      },
    },
    blast: {
      start: (b, p, w) => {
        const g = gun(b);
        fan(w, g, p, angry(b) ? 9 : 7, 0.45, 160, { life: 0.9 });
        w.fx.push({ type: 'smoke', x: g.x, y: g.y, t: 0.4 });
        emit(w, 'cannon', g.x, g.y);
        b.fired = 0.3; b.act = { wait: 0.35 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    pound: {
      start: b => { b.vy = -300; b.act = { air: false }; },
      step: (b, p, w) => {
        b.vx = 0;
        if (!b.onGround) b.act.air = true;
        else if (b.act.air) { waves(w, b); return true; }
        return false;
      },
    },
    charge: {
      start: (b, p) => { b.act = { dir: b.facing, target: p.x + p.w / 2 }; },
      step: b => {
        b.vx = b.act.dir * (angry(b) ? 230 : 200);
        const cx = b.x + b.w / 2;
        if (b.hitEdge || (b.act.dir > 0 ? cx > b.act.target + 40 : cx < b.act.target - 40)) { b.vx = 0; return true; }
        return false;
      },
    },
  };
  JR.updateBoss = (b, p, lv, w, dt) => {
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.fired = Math.max(0, b.fired - dt);
    const def = JR.BOSSES[b.nation];
    const face = () => { b.facing = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1; };
    const rage = angry(b) ? 0.6 : 1;

    switch (b.state) {
      case 'enter':
        b.facing = -1;
        b.vx = -70;
        if (b.x <= b.home) { b.x = b.home; b.vx = 0; b.state = 'pause'; b.timer = 0.6; emit(w, 'bossIn', b.x, b.y); }
        break;
      case 'pause':
        b.vx = 0; face();
        if ((b.timer -= dt) <= 0) {
          b.attack = b.force || def.attacks[b.next++ % def.attacks.length];
          b.force = null;
          b.state = 'tell'; b.tell = true; b.timer = TELL * rage;
        }
        break;
      case 'tell':
        b.vx = 0; face();
        if ((b.timer -= dt) <= 0) {
          b.tell = false; b.state = 'act';
          ATTACKS[b.attack].start(b, p, w);
        }
        break;
      case 'act':
        if (ATTACKS[b.attack].step(b, p, w, dt)) { b.state = 'pause'; b.timer = PAUSE * rage; b.vx = 0; }
        break;
    }

    b.vy = Math.min(b.vy + JR.GRAVITY * dt, JR.MAX_FALL);
    JR.moveBody(lv, b, dt);
    // Invisible arena walls. (The entering boss starts outside them.)
    b.hitEdge = false;
    if (b.state !== 'enter') {
      if (b.x < b.minX) { b.x = b.minX; b.hitEdge = true; }
      if (b.x + b.w > b.maxX) { b.x = b.maxX - b.w; b.hitEdge = true; }
    }
  };

  // Payout when a boss falls (called by JR.damage via JR.dropsFor).
  JR.bossDown = (b, p, w) => {
    p.lives += 1;
    emit(w, 'bossDown', b.x, b.y);
    emit(w, 'life', b.x, b.y);
    for (let i = 0; i < 6; i++) {
      w.fx.push({ type: 'boom', x: b.x + w.rand() * b.w, y: b.y + w.rand() * b.h, r: 18 + w.rand() * 10, t: 0.4, delay: i * 0.16 });
    }
  };
})();
