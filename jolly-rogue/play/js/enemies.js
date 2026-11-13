// The navies: what each kind of sailor does, plus cannons, crates and chests ("props" are things
// you break, not fight: no contact damage, no kill credit). Pure logic, no drawing.
(() => {
  const JR = window.JR;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  JR.ENEMY_DEFS = {
    d: { w: 12, h: 24, hp: 1 },              // deckhand: charges with a cutlass
    m: { w: 12, h: 24, hp: 2 },              // marine: musket, aimed, with a tell
    s: { w: 12, h: 18, hp: 1 },              // sharpshooter: kneels up high, long range
    b: { w: 12, h: 24, hp: 2 },              // grenadier: lobs bombs
    f: { w: 12, h: 24, hp: 4 },              // officer: pistol bursts, drops a gun
    n: { w: 20, h: 20, hp: 6 },              // cannon: level shots you can duck
    c: { w: 14, h: 14, hp: 2, prop: true },  // crate
    $: { w: 14, h: 12, hp: 1, prop: true },  // treasure chest
    k: { w: 12, h: 12, hp: 1, prop: true },  // powder keg: shoot it and it blows up the crew around it
    v: { w: 12, h: 10, hp: 1 },              // bat: flaps toward you, drifting to your height
    g: { w: 12, h: 24, hp: 2 },              // drowned sailor: fades in and out; shots pass through a faded one
    // The King's navy and the far shores (levels 9-20).
    i: { w: 12, h: 24, hp: 2 },              // redcoat: shows his aim, fires one fast shot, then a long reload
    u: { w: 14, h: 12, hp: 3 },              // swivel gun on the rail: a three-ball spray
    h: { w: 12, h: 24, hp: 2 },              // boarder: swings in on a rope from above, then charges
    l: { w: 14, h: 9, hp: 1 },               // crab: scuttles low and fast; crouch to shoot it, or stab it
  };
  // Which sprite a fallen one uses.
  JR.LOOKS = { d: 'sailor', m: 'marine', s: 'marine', b: 'grenadier', f: 'officer', g: 'sailor', v: 'bat', B: 'boss', i: 'marine', u: 'cannon', h: 'sailor', l: 'crab' };

  // A drowned sailor's solidity, 0 (a faint shimmer: shots and blades pass through, it can't hurt
  // you) to 1, over a 3.6 s cycle: fade in, hold, fade out, linger unseen. Same as Reef Runner's ghosts.
  JR.ghostSolid = t => {
    const c = ((t % 3.6) + 3.6) % 3.6;
    if (c < 0.6) return c / 0.6;
    if (c < 2.4) return 1;
    if (c < 3.0) return 1 - (c - 2.4) / 0.6;
    return 0;
  };

  JR.makeEnemy = (type, x, y, nation = 'british') => {
    const d = JR.ENEMY_DEFS[type];
    return {
      type, nation, x, y, w: d.w, h: d.h, hp: d.hp, prop: !!d.prop,
      vx: 0, vy: 0, facing: -1, onGround: false, active: false,
      timer: { m: 1.4, s: 1.6, b: 1.2, f: 1.0, n: 1.5, i: 1.6, u: 1.4, l: 1.0 }[type] || 0,
      tell: false, flash: 0, t: 0, burst: 0, burstT: 0,
      // Drowned sailors start part-way through their cycle, so a crew doesn't blink in step.
      ...(type === 'g' ? { t: (Math.abs(Math.floor(x / 16)) % 6) * 0.6, fade: 1, phased: false } : {}),
      ...(type === 'h' ? { swing: 'wait', ax: x + 6, ay: y, angle: 1.15, r: 72 } : {}),
    };
  };
  // A boarder's letter marks his rope's anchor: he waits up there, out of sight, until you come near.
  JR.REDCOAT = { tell: 0.8, every: 3.0, speed: 210 };

  // From a level spawn {type, x, y (tile top-left), nation}: centered on the tile, feet on its bottom.
  JR.spawnEnemy = s => {
    const d = JR.ENEMY_DEFS[s.type];
    if (s.type === 'h') return JR.makeEnemy('h', s.x + (JR.TILE - d.w) / 2, s.y, s.nation);
    return JR.makeEnemy(s.type, s.x + (JR.TILE - d.w) / 2, s.y + JR.TILE - d.h, s.nation);
  };

  const aimed = (w, from, p, speed, extra = {}) => {
    const tx = p.x + p.w / 2 - from.x, ty = p.y + p.h / 2 - from.y;
    const len = Math.hypot(tx, ty) || 1;
    w.shots.push({ x: from.x, y: from.y, vx: (tx / len) * speed, vy: (ty / len) * speed, dmg: 1, life: 3.5, friendly: false, r: 2.5, ...extra });
  };

  // Counts down e.timer; shows a tell for the last `tell` seconds; calls fire() at zero.
  const cycle = (e, dt, tell, every, fire) => {
    e.timer -= dt;
    e.tell = e.timer <= tell;
    if (e.timer <= 0) { fire(); e.timer = every; e.tell = false; e.fired = 0.25; }
  };

  JR.updateEnemy = (e, p, lv, w, dt) => {
    if (e.type === 'B') return JR.updateBoss(e, p, lv, w, dt);
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.fired = Math.max(0, (e.fired || 0) - dt);
    const cx = e.x + e.w / 2;
    const dx = p.x + p.w / 2 - cx;
    const range = { d: 280, m: 280, s: 360, b: 280, f: 300, n: 330, v: 250, g: 280, i: 300, u: 300, h: 200, l: 260 }[e.type] || 0;
    if (Math.abs(dx) < range) e.active = true;
    if (!e.prop) e.facing = dx < 0 ? -1 : 1;
    const gun = { x: cx + e.facing * 10, y: e.y + 8 };

    if (e.type === 'v') {                              // bats fly: no gravity, no walls
      if (e.home == null) e.home = e.y;
      if (e.active) {
        e.vx = e.facing * 58;
        e.home += JR.clamp(p.y + 2 - e.home, -26, 26) * dt;
        e.x += e.vx * dt;
      }
      e.y = e.home + Math.sin(e.t * 4) * 10;
      return;
    }

    // A boarder on his rope: no gravity until he lets go, sweeping down at you from the right.
    if (e.type === 'h' && e.swing !== 'off') {
      if (e.swing === 'wait') {
        e.x = e.ax - e.w / 2 + Math.sin(e.angle) * e.r; e.y = e.ay + Math.cos(e.angle) * e.r - 4;
        if (e.active && dx < 0) { e.swing = 'on'; e.omega = 0; emit(w, 'whistle', e.x, e.y); }
        return;
      }
      e.omega += -(JR.ROPE.g / e.r) * Math.sin(e.angle) * dt;
      e.angle += e.omega * dt;
      e.x = e.ax - e.w / 2 + Math.sin(e.angle) * e.r; e.y = e.ay + Math.cos(e.angle) * e.r - 4;
      e.vx = e.r * e.omega * Math.cos(e.angle); e.facing = e.vx < 0 ? -1 : 1;
      if (e.angle < -0.55 || e.omega > 0) { e.swing = 'off'; e.vy = -60; }
      return;
    }

    switch (e.type) {
      case 'i': {
        // Aims (a line shows where), fires one fast shot, then reloads: the gap to rush him.
        e.vx = 0;
        if (!e.active) break;
        const R = JR.REDCOAT;
        e.timer -= dt;
        e.tell = e.timer <= R.tell;
        if (e.tell) e.aim = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
        e.reloading = e.timer > R.tell + 0.3 && e.timer > R.every - 1.8;
        if (e.timer <= 0) {
          const at = { x: cx + e.facing * 10, y: e.y + 8 };
          aimed(w, at, p, R.speed);
          w.fx.push({ type: 'smoke', x: at.x, y: at.y, t: 0.4 });
          emit(w, 'musket', at.x, at.y);
          e.timer = R.every; e.tell = false; e.fired = 0.25; e.aim = null;
        }
        break;
      }
      case 'u':
        e.vx = 0;
        if (e.active) cycle(e, dt, 0.5, 2.6, () => {
          const at = { x: cx + e.facing * 9, y: e.y + 4 };
          for (const k of [-1, 0, 1]) {
            const a = Math.atan2(p.y + p.h / 2 - at.y, p.x + p.w / 2 - at.x) + k * 0.16;
            w.shots.push({ x: at.x, y: at.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: 1, life: 2.4, friendly: false, r: 2, grape: true });
          }
          w.fx.push({ type: 'smoke', x: at.x, y: at.y, t: 0.3 });
          emit(w, 'swivel', at.x, at.y);
        });
        break;
      case 'l':
        // Scuttles at you, stopping now and then to raise its claws.
        if (!e.active) { e.vx = 0; break; }
        e.timer -= dt;
        e.tell = e.timer < 0.4;
        if (e.timer <= 0) e.timer = 1.6;
        e.vx = e.tell ? 0 : e.facing * 85;
        break;
      case 'h':                                         // on the deck now: charges like a deckhand
        e.vx = e.onGround ? e.facing * 60 : e.vx;
        if (e.hitWall && e.onGround) e.vy = -280;
        break;
      case 'g':
        e.fade = JR.ghostSolid(e.t);
        e.phased = e.fade < 0.5;
        e.vx = e.active ? e.facing * (e.phased ? 62 : 38) : 0;
        if (e.active && e.hitWall && e.onGround) e.vy = -280;
        break;
      case 'd':
        e.vx = e.active ? e.facing * 55 : 0;
        if (e.active && e.hitWall && e.onGround) e.vy = -280;   // hop up dunes and steps
        break;
      case 'm':
        e.vx = 0;
        if (e.active) cycle(e, dt, 0.5, 2.4, () => {
          aimed(w, gun, p, 120);
          w.fx.push({ type: 'smoke', x: gun.x, y: gun.y, t: 0.4 });
          emit(w, 'musket', gun.x, gun.y);
        });
        break;
      case 's':
        e.vx = 0;
        if (e.active) cycle(e, dt, 0.6, 2.8, () => {
          const at = { x: cx + e.facing * 12, y: e.y + 4 };
          aimed(w, at, p, 150);
          w.fx.push({ type: 'smoke', x: at.x, y: at.y, t: 0.4 });
          emit(w, 'musket', at.x, at.y);
        });
        break;
      case 'b':
        e.vx = 0;
        if (e.active) cycle(e, dt, 0.4, 2.6, () => {
          // Solve the arc so the bomb comes down on the pirate.
          const x0 = cx, y0 = e.y + 2, vy0 = -260, g = JR.GRAVITY;
          const ty = p.y + p.h - 4;
          const tFlight = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * Math.max(0, ty - y0))) / g;
          const vx = JR.clamp((p.x + p.w / 2 - x0) / tFlight, -220, 220);
          w.shots.push({ x: x0, y: y0, vx, vy: vy0, dmg: 1, life: 4, friendly: false, grav: true, boom: 22, r: 3, bomb: true });
          emit(w, 'throw', x0, y0);
        });
        break;
      case 'f':
        e.vx = e.active && Math.abs(dx) > 130 && e.burst === 0 ? e.facing * 35 : 0;
        if (e.active) {
          if (e.burst > 0) {
            e.burstT -= dt;
            if (e.burstT <= 0) {
              aimed(w, gun, p, 140);
              emit(w, 'shot', gun.x, gun.y);
              w.fx.push({ type: 'flash', x: gun.x, y: gun.y, t: 0.06 });
              e.burst -= 1; e.burstT = 0.15; e.fired = 0.12;
            }
          } else cycle(e, dt, 0.4, 2.2, () => { e.burst = 3; e.burstT = 0; });
        }
        break;
      case 'n':
        e.vx = 0;
        if (e.active) cycle(e, dt, 0.6, 3.2, () => {
          // Muzzle 19 px above the ground: a crouching pirate (14 px tall) ducks under the ball.
          const mx = cx + e.facing * 12, my = e.y + e.h - 19;
          w.shots.push({ x: mx, y: my, vx: e.facing * 130, vy: 0, dmg: 1, life: 4, friendly: false, r: 4.5, ball: true });
          w.fx.push({ type: 'smoke', x: mx, y: my, t: 0.4 });
          emit(w, 'cannon', mx, my);
        });
        break;
    }

    e.vy = Math.min(e.vy + JR.GRAVITY * dt, JR.MAX_FALL);
    JR.moveBody(lv, e, dt);
    if (e.y > JR.WORLD_H + 32) { e.hp = 0; e.gone = true; }
  };

  const coin = (w, x, y, vx, vy) => {
    const c = JR.makePickup('o', x, y);
    c.vx = vx; c.vy = vy;
    w.pickups.push(c);
  };

  // What falls out when something is destroyed.
  JR.dropsFor = (e, w) => {
    const x = e.x + e.w / 2, y = e.y + 4;
    const gun = () => {
      const k = JR.makePickup('w', x, y);
      k.gun = JR.pick(w.rand, JR.PICKUP_GUNS);
      k.vy = -180;
      w.pickups.push(k);
    };
    switch (e.type) {
      case 'B': gun(); for (let i = 0; i < 40; i++) coin(w, x, y, (i - 19.5) * 7, -200 - w.rand() * 160); break;
      case 'f': gun(); break;
      case 'n': for (let i = 0; i < 6; i++) coin(w, x, y, (i - 2.5) * 20, -200); break;
      case 'u': for (let i = 0; i < 4; i++) coin(w, x, y, (i - 1.5) * 20, -200); break;
      case '$': for (let i = 0; i < 16; i++) coin(w, x, y, (i - 7.5) * 12, -190 - w.rand() * 70); break;
      case 'c': {
        const r = w.rand();
        if (r < 0.6) gun();
        else if (r < 0.8) { const k = JR.makePickup('r', x, y); k.vy = -150; w.pickups.push(k); }
        else for (let i = 0; i < 8; i++) coin(w, x, y, (i - 3.5) * 18, -180);
        break;
      }
      default: for (let i = 0, n = 1 + (w.rand() < 0.5); i < n; i++) coin(w, x, y, (i - (n - 1) / 2) * 24, -160);
    }
  };

  // ---------- hazards: part of the level, not the crew (no health, nothing to shoot) ----------
  //   e  lava vent: rumbles (smoke, glow) then spits three rocks that arc up and fall
  //   y  mortar: while you're in its stretch of deck, the fleet marks where you're heading,
  //      then a shell lands there a second later
  //   z  dart trap: a stone idol that spits a dart at you when you're in front of it (its left)
  //   a  loose sail: drifts and billows about its spot; then ripples (the tell) and blows at you,
  //      knocking you back (off a yard, or off a rope) but not hurting
  //   t  the tide: along its stretch, foam gathers at the right of the screen (the tell), then a
  //      wave rolls in along the sand: jump it
  //   x  stalactite: shivers when you come near (the tell), drops, and grows back
  JR.HAZARD_DEFS = {
    e: { every: 2.6, tell: 0.7 }, y: { every: 3.0, tell: 0 }, z: { every: 2.2, tell: 0.45 },
    a: { every: 4.2, tell: 0.8, blow: 0.7, reach: 84 }, t: { every: 4.6, tell: 1.2 }, x: { every: 0, tell: 0.5 },
  };
  JR.makeHazard = s => ({
    type: s.type, x: s.x, y: s.y, w: 16, h: 16, nation: s.nation,
    timer: 1 + (Math.abs(Math.floor(s.x / 16)) % 4) * 0.4, tell: false, t: 0, fired: 0, pending: null,
    ...(s.type === 'a' ? { w: 28, h: 22, hx: s.x - 6, hy: s.y - 3, blow: 0, x: s.x - 6, y: s.y - 3 } : {}),
    ...(s.type === 'x' ? { w: 8, h: 14, x: s.x + 4, hy: s.y, fall: false, vy: 0, regrow: 0 } : {}),
  });

  // A loose sail's push: away from the sail, up off whatever you stood on, off any rope.
  JR.sailKnock = (h, p, w) => {
    if ((p.knock || 0) > 0 || p.dead) return false;
    const dir = p.x + p.w / 2 < h.x + h.w / 2 ? -1 : 1;
    if (p.rope) JR.releaseRope(p, w, false);
    p.vx = dir * 210; p.vy = -170; p.onGround = false; p.fling = 0.5; p.knock = 0.6;
    emit(w, 'flap', p.x, p.y);
    return true;
  };

  // The top of the ground under column c (world y), or below the world when it's a pit.
  const groundY = (lv, c) => { for (let r = 3; r < JR.ROWS; r++) if (lv.solid(c, r) || lv.platform(c, r)) return r * JR.TILE; return JR.WORLD_H + 40; };
  JR.groundY = groundY;

  JR.updateHazard = (h, p, lv, w, dt, camX = 0) => {
    h.t += dt;
    h.fired = Math.max(0, h.fired - dt);
    const def = JR.HAZARD_DEFS[h.type];
    const px = p.x + p.w / 2, cx = h.x + 8;
    if (h.type === 'e') {
      if (Math.abs(px - cx) > 300) { h.tell = false; return; }
      cycle(h, dt, def.tell, def.every, () => {
        for (let i = 0; i < 3; i++) {
          w.shots.push({ x: cx, y: h.y + 6, vx: (i - 1) * 55 + (w.rand() - 0.5) * 20, vy: -330 - i * 25, grav: true, r: 3, life: 3, dmg: 1, friendly: false, lava: true });
        }
        w.fx.push({ type: 'smoke', x: cx, y: h.y + 4, t: 0.4 });
        emit(w, 'erupt', cx, h.y);
      });
    } else if (h.type === 'y') {
      // Only along its own chunk of deck (30 tiles), and the shell already in the air still lands.
      const inside = px > h.x - 32 && px < h.x + 30 * JR.TILE;
      if (h.pending) {
        h.pending.t -= dt;
        if (!h.pending.shot && h.pending.t <= 0.47) {      // a shell from above the screen takes ~0.47 s
          h.pending.shot = true;
          w.shots.push({ x: h.pending.x, y: JR.CAM_Y - 12, vx: 0, vy: 200, grav: true, r: 4, life: 3, dmg: 1, friendly: false, boom: 24, shell: true });
          emit(w, 'incoming', h.pending.x, JR.CAM_Y);
        }
        if (h.pending.t <= 0) h.pending = null;
      }
      if (!inside) return;
      h.timer -= dt;
      if (h.timer <= 0 && !h.pending) {
        h.timer = def.every;
        const tx = JR.clamp(px + p.vx * 1.0, camX + 20, camX + JR.VIEW_W - 20);
        const ty = groundY(lv, Math.floor(tx / JR.TILE));
        h.pending = { x: tx, y: ty, t: 1.0, shot: false };
        w.fx.push({ type: 'mark', x: tx, y: Math.min(ty, JR.WORLD_H - 8), t: 1.0 });
      }
    } else if (h.type === 'a') {
      p.knock = Math.max(0, (p.knock || 0) - dt);
      if (Math.abs(px - cx) > 360) { h.tell = false; return; }
      // Drift and billow round its spot; every few seconds a gust blows it at you.
      h.timer -= dt;
      h.tell = h.timer <= def.tell && h.timer > 0;
      if (h.timer <= 0) { h.blow = def.blow; h.timer = def.every; h.dir = px < h.hx + h.w / 2 ? -1 : 1; emit(w, 'gust', h.x, h.y); }
      const out = h.blow > 0 ? Math.sin((1 - h.blow / def.blow) * Math.PI) * def.reach * h.dir : 0;
      h.blow = Math.max(0, h.blow - dt);
      h.x = h.hx + Math.sin(h.t * 0.7) * 18 + out;
      h.y = h.hy + Math.sin(h.t * 1.3) * 6;
      if (JR.overlap({ x: h.x + 3, y: h.y + 2, w: h.w - 6, h: h.h - 4 }, p)) JR.sailKnock(h, p, w);
    } else if (h.type === 't') {
      // Only along its own stretch (30 tiles) of shore; the wave already rolling still rolls.
      const inside = px > h.x - 32 && px < h.x + 30 * JR.TILE;
      if (!inside) { h.tell = false; return; }
      cycle(h, dt, def.tell, def.every, () => {
        const gx = camX + JR.VIEW_W + 12, gy = groundY(lv, Math.floor(px / JR.TILE));
        w.shots.push({ x: gx, y: Math.min(gy, 15 * JR.TILE) - 7, vx: -150, vy: 0, r: 7, life: 4, dmg: 1, friendly: false, tide: true });
        emit(w, 'wave', gx, gy);
      });
      h.foam = h.tell ? camX + JR.VIEW_W - 30 : null;
    } else if (h.type === 'x') {
      if (h.regrow > 0) { h.regrow -= dt; if (h.regrow <= 0) { h.y = h.hy; h.fall = false; h.vy = 0; } return; }
      if (!h.fall) {
        const near = Math.abs(px - (h.x + 4)) < 40 && p.y > h.y;
        if (near && !h.tell) { h.tell = true; h.timer = def.tell; emit(w, 'creak', h.x, h.y); }
        if (h.tell && (h.timer -= dt) <= 0) { h.tell = false; h.fall = true; }
        return;
      }
      h.vy = Math.min(h.vy + JR.GRAVITY * dt, JR.MAX_FALL);
      h.y += h.vy * dt;
      if (JR.overlap(h, p)) { JR.hurt(p, w); h.regrow = 3; h.y = -99; emit(w, 'break', h.x, h.y); return; }
      if (lv.solid(Math.floor((h.x + 4) / JR.TILE), Math.floor((h.y + h.h) / JR.TILE)) || h.y > JR.WORLD_H) {
        w.fx.push({ type: 'splinters', x: h.x + 4, y: h.y + h.h, t: 0.4 });
        emit(w, 'break', h.x, h.y);
        h.regrow = 3; h.y = -99;
      }
    } else if (h.type === 'z') {
      const dx = px - cx;
      if (dx > 0 || dx < -320 || Math.abs(p.y - h.y) > 140) { h.tell = false; return; }
      cycle(h, dt, def.tell, def.every, () => {
        const from = { x: h.x + 1, y: h.y + 7 };
        aimed(w, from, p, 150, { dagger: true, dart: true, life: 2.6 });
        emit(w, 'throw', from.x, from.y);
      });
    }
  };
})();
