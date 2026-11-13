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
    // The voyage update's four: the pack's bosses again, recolored for their crew (`crew`, see
    // JR.CREWS in js/atlas.js), each with a new attack of its own.
    mossback: { name: 'THE TEMPLE BRUTE', hp: 50, art: 'bigGuy', crew: 'mossback', w: 30, h: 52, attacks: ['boulders', 'leap', 'summon'], item: 'swivel' },
    drowned: { name: 'THE DROWNED CAPTAIN', hp: 55, art: 'pbCaptain', crew: 'drowned', ghost: true, w: 30, h: 52, attacks: ['daggers', 'blink', 'lunge'], item: 'rapier' },
    cinder: { name: 'THE HOT PEPPER', hp: 60, art: 'cucumber', crew: 'pepper', w: 30, h: 52, attacks: ['eruption', 'grapeshot', 'kegs'], item: 'bomb' },
    navy: { name: 'ADMIRAL BLUBBERTON', hp: 75, art: 'whale', crew: 'admiral', w: 52, h: 40, attacks: ['broadside', 'volley', 'summon'], item: 'blunderbuss' },
    // The King's navy and the far shores (levels 9-20): the pack's five bosses (the bald officer
    // grown to full size too), each recolored for its crew, with attacks of their own.
    topmen: { name: 'BOSUN HALYARD', hp: 60, art: 'bigGuy', crew: 'bosun', w: 30, h: 52, attacks: ['sails', 'volley', 'swingers'], item: 'swivel' },
    shellbacks: { name: 'THE KING CRAB', hp: 62, art: 'whale', crew: 'kingcrab', w: 52, h: 40, attacks: ['charge', 'crabs', 'tide'], item: 'blunderbuss' },
    marines: { name: 'CAPTAIN STARCHLEY', hp: 64, art: 'pbCaptain', crew: 'starchley', w: 30, h: 52, attacks: ['lunge', 'redcoats', 'chainshot'], item: 'rapier' },
    howlers: { name: 'THE CANOPY KING', hp: 66, art: 'bald', crew: 'canopy', w: 30, h: 52, attacks: ['coconuts', 'leap', 'swingers'], item: 'bomb' },
    wreckers: { name: 'THE WRECKER QUEEN', hp: 68, art: 'cucumber', crew: 'gullqueen', w: 30, h: 52, attacks: ['rockfall', 'gust', 'daggers'], item: 'rapier' },
    smugglers: { name: 'OLD GREASEPOT', hp: 70, art: 'bigGuy', crew: 'greasepot', w: 30, h: 52, attacks: ['kegs', 'stalactites', 'mortar'], item: 'bomb' },
    dockwatch: { name: 'THE FOREMAN', hp: 72, art: 'whale', crew: 'foreman', w: 52, h: 40, attacks: ['crates', 'charge', 'redcoats'], item: 'blunderbuss' },
    garrison: { name: 'COLONEL BRASSBUTTON', hp: 74, art: 'pbCaptain', crew: 'brassbutton', w: 30, h: 52, attacks: ['broadside', 'swivels', 'redcoats'], item: 'swivel' },
    stormwatch: { name: 'THE SQUALL CAPTAIN', hp: 78, art: 'bald', crew: 'squall', w: 30, h: 52, attacks: ['sails', 'gust', 'chainshot'], item: 'rapier' },
    bullion: { name: 'THE PAYMASTER', hp: 80, art: 'cucumber', crew: 'paymaster', w: 30, h: 52, attacks: ['coinshot', 'kegs', 'volley'], item: 'bomb' },
    picket: { name: 'THE COMMODORE', hp: 84, art: 'whale', crew: 'commodore', w: 52, h: 40, attacks: ['broadside', 'swingers', 'mortar'], item: 'blunderbuss' },
    // The finale: four attacks, the most health, and every trick the King's navy has.
    royal: { name: 'LORD ADMIRAL STORMHAVEN', hp: 110, art: 'bigGuy', crew: 'stormhaven', w: 30, h: 52, attacks: ['broadside', 'sails', 'redcoats', 'chainshot', 'swingers'], item: 'swivel', finale: true },
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
      t: 0, flash: 0, fired: 0, tell: false, act: {}, fade: 1, phased: false,
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
  // The new four's attacks.
  Object.assign(ATTACKS, {
    // Two or three stones roll along the ground at you, one after another: jump them.
    boulders: {
      start: b => { b.act = { n: angry(b) ? 3 : 2, gap: 0 }; },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        w.shots.push({ x: b.x + b.w / 2 + b.facing * 18, y: b.ground - 7, vx: b.facing * (angry(b) ? 150 : 125), vy: 0, r: 7, life: 4, dmg: 1, friendly: false, boulder: true });
        emit(w, 'pound', b.x, b.ground);
        b.fired = 0.25; b.act.gap = 0.75;
        return --b.act.n <= 0;
      },
    },
    // Fades out (shots pass through), reappears on your other side, and throws daggers.
    blink: {
      start: (b, p, w) => { b.act = { phase: 'out', t: 0.45 }; emit(w, 'blink', b.x, b.y); },
      step: (b, p, w, dt) => {
        b.vx = 0;
        const a = b.act;
        a.t -= dt;
        if (a.phase === 'out') {
          b.fade = Math.max(0, a.t / 0.45); b.phased = b.fade < 0.5;
          if (a.t <= 0) {
            const px = p.x + p.w / 2, mid = (b.minX + b.maxX) / 2;
            const x = px < mid ? px + 70 : px - 70 - b.w;   // the side with more room
            b.x = JR.clamp(x, b.minX, b.maxX - b.w);
            b.facing = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1;
            a.phase = 'in'; a.t = 0.35;
          }
          return false;
        }
        b.fade = Math.min(1, 1 - a.t / 0.35); b.phased = b.fade < 0.5;
        if (a.t > 0) return false;
        b.fade = 1; b.phased = false;
        fan(w, gun(b), p, angry(b) ? 3 : 2, 0.15, 170, { dagger: true });
        emit(w, 'throw', b.x, b.y);
        b.fired = 0.25;
        return true;
      },
    },
    // Lava rocks rain down round you; each one's landing spot glows first.
    eruption: {
      start: (b, p, w) => {
        const n = angry(b) ? 6 : 4, px = p.x + p.w / 2;
        b.act = { drops: [], wait: 1.5 };
        for (let i = 0; i < n; i++) {
          const x = JR.clamp(px + (i - (n - 1) / 2) * 44 + (w.rand() - 0.5) * 16, b.minX + 8, b.maxX - 8);
          b.act.drops.push({ x, at: 0.45 + i * 0.12 });
          w.fx.push({ type: 'mark', x, y: b.ground, t: 0.45 + i * 0.12 + 0.45, lava: true });
        }
        emit(w, 'erupt', b.x, b.y);
        b.fired = 0.3;
      },
      step: (b, p, w, dt) => {
        b.vx = 0;
        const before = 1.5 - b.act.wait;
        b.act.wait -= dt;
        const now = 1.5 - b.act.wait;
        for (const d of b.act.drops) {
          if (d.at > before && d.at <= now) w.shots.push({ x: d.x, y: JR.CAM_Y - 10, vx: 0, vy: 220, grav: true, r: 4, life: 3, dmg: 1, friendly: false, lava: true, boom: 16 });
        }
        return b.act.wait <= 0;
      },
    },
    // A wall of cannonballs from the right: low ones to jump, high ones to duck, both when angry.
    broadside: {
      start: (b, p, w) => {
        const rows = angry(b) ? ['low', 'high'] : [w.rand() < 0.5 ? 'low' : 'high'];
        b.act = { balls: rows.flatMap(r => [r, r, r]), gap: 0, i: 0 };
        emit(w, 'whistle', b.x, b.y);
      },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        const row = b.act.balls[b.act.i++], last = b.act.i >= b.act.balls.length;
        // Low: 6 px off the deck (jump it). High: 19 px up, the height a crouch ducks under.
        const y = b.ground - (row === 'low' ? 6 : 19);
        w.shots.push({ x: b.maxX + 8, y, vx: -150, vy: 0, dmg: 1, life: 5, friendly: false, r: 4.5, ball: true });
        emit(w, 'cannon', b.maxX, y);
        b.fired = 0.3;
        b.act.gap = b.act.balls[b.act.i] === row ? 0.2 : 0.8;   // a stream of three, then the next row
        return last;
      },
    },
  });

  // The King's navy's attacks.
  const drop = (w, b, type, x, n = 0) => {
    const e = JR.makeEnemy(type, x, b.ground - JR.ENEMY_DEFS[type].h - 90, b.nation);
    e.active = true; e.timer = 1.4 + n * 0.5;
    w.enemies.push(e);
    return e;
  };
  Object.assign(ATTACKS, {
    // Two loose sails blow across the arena from the right: one low (jump), one high (duck).
    sails: {
      start: (b, p, w) => {
        const rows = angry(b) ? ['low', 'high', 'low'] : w.rand() < 0.5 ? ['low', 'high'] : ['high', 'low'];
        b.act = { rows, i: 0, gap: 0 };
        emit(w, 'gust', b.x, b.y);
      },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        const row = b.act.rows[b.act.i++];
        // Low: its bottom on the deck, 12 px tall (jump it). High: 18 px off the deck (a crouch is 14).
        const y = b.ground - (row === 'low' ? 6 : 30);
        w.shots.push({ x: b.maxX + 12, y, vx: -125, vy: 0, r: row === 'low' ? 6 : 11, life: 5, dmg: 1, friendly: false, sail: true, low: row === 'low' });
        emit(w, 'flap', b.maxX, y);
        b.fired = 0.3; b.act.gap = 0.9;
        return b.act.i >= b.act.rows.length;
      },
    },
    // Boarders swing in on ropes from above the arena, then charge.
    swingers: {
      start: (b, p, w) => {
        const n = w.enemies.filter(e => e.type === 'h' && e.hp > 0).length;
        for (let i = n; i < (angry(b) ? 3 : 2); i++) {
          const e = JR.makeEnemy('h', b.maxX - 30 - i * 56, b.ground - 168, b.nation);
          e.active = true; e.swing = 'on'; e.omega = 0;
          w.enemies.push(e);
        }
        emit(w, 'whistle', b.x, b.y);
        b.act = { wait: 0.6 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    // Crabs scuttle in from the right.
    crabs: {
      start: (b, p, w) => {
        const n = w.enemies.filter(e => e.type === 'l' && e.hp > 0).length;
        for (let i = n; i < (angry(b) ? 4 : 3); i++) {
          const e = JR.makeEnemy('l', b.maxX - 12 - i * 22, b.ground - 9, b.nation);
          e.active = true; e.timer = 0.6 + i * 0.3;
          w.enemies.push(e);
        }
        emit(w, 'pinch', b.x, b.y);
        b.act = { wait: 0.5 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    // Waves roll in along the sand from the right, one after another: jump each.
    tide: {
      start: (b, p, w) => { b.act = { n: angry(b) ? 3 : 2, gap: 0 }; },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        w.shots.push({ x: b.maxX + 8, y: b.ground - 7, vx: -150, vy: 0, r: 7, life: 4, dmg: 1, friendly: false, tide: true });
        emit(w, 'wave', b.maxX, b.ground);
        b.fired = 0.25; b.act.gap = 1.0;
        return --b.act.n <= 0;
      },
    },
    // Redcoats drop onto the deck and take aim.
    redcoats: {
      start: (b, p, w) => {
        const n = w.enemies.filter(e => e.type === 'i' && e.hp > 0).length;
        for (let i = n; i < 2; i++) drop(w, b, 'i', b.maxX - 40 - i * 40, i);
        emit(w, 'whistle', b.x, b.y);
        b.act = { wait: 0.6 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    // Chain shot: two balls on a chain, spinning low (jump) or high (duck), two or three of them.
    chainshot: {
      start: (b, p, w) => { b.act = { n: angry(b) ? 3 : 2, gap: 0, row: w.rand() < 0.5 ? 0 : 1 }; },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        const high = (b.act.row++ % 2) === 1, g = gun(b);
        w.shots.push({ x: g.x, y: b.ground - (high ? 22 : 7), vx: b.facing * 160, vy: 0, r: 6, life: 3, dmg: 1, friendly: false, chain: true });
        w.fx.push({ type: 'smoke', x: g.x, y: g.y, t: 0.4 });
        emit(w, 'cannon', g.x, g.y);
        b.fired = 0.3; b.act.gap = 0.7;
        return --b.act.n <= 0;
      },
    },
    // Coconuts lobbed high to land round you, bursting where they hit.
    coconuts: {
      start: (b, p, w) => {
        const n = angry(b) ? 5 : 3, tx = p.x + p.w / 2, from = { x: b.x + b.w / 2, y: b.y };
        for (let i = 0; i < n; i++) {
          const x = JR.clamp(tx + (i - (n - 1) / 2) * 46, b.minX + 8, b.maxX - 8), vy = -360;
          w.shots.push({ x: from.x, y: from.y, vx: JR.lobVx(from.x, from.y, x, b.ground - 4, vy), vy, dmg: 1, life: 4, friendly: false, grav: true, boom: 16, r: 4, coconut: true });
          w.fx.push({ type: 'mark', x, y: b.ground, t: 1.0 });
        }
        emit(w, 'throw', from.x, from.y);
        b.fired = 0.3; b.act = { wait: 0.5 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
  });

  // Things dropped from above onto marked spots (rocks off the cliff, stalactites, crates off a crane).
  const fallers = kind => ({
    start: (b, p, w) => {
      const n = angry(b) ? 5 : 3, px = p.x + p.w / 2;
      b.act = { drops: [], wait: 1.4 };
      for (let i = 0; i < n; i++) {
        const x = JR.clamp(px + (i - (n - 1) / 2) * 48 + (w.rand() - 0.5) * 12, b.minX + 8, b.maxX - 8);
        b.act.drops.push({ x, at: 0.5 + i * 0.14 });
        w.fx.push({ type: 'mark', x, y: b.ground, t: 0.5 + i * 0.14 + 0.47 });
      }
      emit(w, kind === 'crate' ? 'whistle' : 'creak', b.x, b.y);
      b.fired = 0.3;
    },
    step: (b, p, w, dt) => {
      b.vx = 0;
      const before = 1.4 - b.act.wait;
      b.act.wait -= dt;
      const now = 1.4 - b.act.wait;
      for (const d of b.act.drops) if (d.at > before && d.at <= now) w.shots.push({ x: d.x, y: JR.CAM_Y - 10, vx: 0, vy: 220, grav: true, r: kind === 'crate' ? 6 : 4, life: 3, dmg: 1, friendly: false, faller: kind, boom: kind === 'crate' ? 18 : 0 });
      return b.act.wait <= 0;
    },
  });
  Object.assign(ATTACKS, {
    rockfall: fallers('rock'),
    stalactites: fallers('stalactite'),
    crates: fallers('crate'),
    // A gale across the arena pushes you toward the boss while he throws daggers into it.
    gust: {
      start: (b, p, w) => { b.act = { t: 1.6, thrown: false }; emit(w, 'gust', b.x, b.y); },
      step: (b, p, w, dt) => {
        b.vx = 0;
        b.act.t -= dt;
        if (!p.rope) p.vx += b.facing * -1 * (p.onGround ? 320 : 420) * dt;   // blown toward him
        if (!b.act.thrown && b.act.t < 0.8) { fan(w, gun(b), p, angry(b) ? 3 : 2, 0.2, 160, { dagger: true }); emit(w, 'throw', b.x, b.y); b.fired = 0.25; b.act.thrown = true; }
        if (b.act.t <= 0) return true;
        return false;
      },
    },
    // A fan of gold coins, hot from the strongbox: they hurt, and the ones that miss can be picked up.
    coinshot: {
      start: (b, p, w) => {
        const g = gun(b);
        fan(w, g, p, angry(b) ? 7 : 5, 0.32, 150, { coinshot: true, r: 2.5 });
        emit(w, 'cannon', g.x, g.y);
        b.fired = 0.25; b.act = { wait: 0.35 };
      },
      step: (b, p, w, dt) => (b.act.wait -= dt) <= 0,
    },
    // Three quick swivel-gun sprays.
    swivels: {
      start: b => { b.act = { n: angry(b) ? 4 : 3, gap: 0 }; },
      step: (b, p, w, dt) => {
        if ((b.act.gap -= dt) > 0) return false;
        const g = gun(b);
        fan(w, g, p, 3, 0.16, 155, { grape: true, r: 2 });
        emit(w, 'swivel', g.x, g.y);
        b.fired = 0.15; b.act.gap = 0.45;
        return --b.act.n <= 0;
      },
    },
  });

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
