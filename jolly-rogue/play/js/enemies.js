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
  };
  // Which sprite a fallen one uses.
  JR.LOOKS = { d: 'sailor', m: 'marine', s: 'marine', b: 'grenadier', f: 'officer', B: 'boss' };

  JR.makeEnemy = (type, x, y, nation = 'british') => {
    const d = JR.ENEMY_DEFS[type];
    return {
      type, nation, x, y, w: d.w, h: d.h, hp: d.hp, prop: !!d.prop,
      vx: 0, vy: 0, facing: -1, onGround: false, active: false,
      timer: { m: 1.4, s: 1.6, b: 1.2, f: 1.0, n: 1.5 }[type] || 0,
      tell: false, flash: 0, t: 0, burst: 0, burstT: 0,
    };
  };

  // From a level spawn {type, x, y (tile top-left), nation}: centered on the tile, feet on its bottom.
  JR.spawnEnemy = s => {
    const d = JR.ENEMY_DEFS[s.type];
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
    const range = { d: 280, m: 280, s: 360, b: 280, f: 300, n: 330 }[e.type] || 0;
    if (Math.abs(dx) < range) e.active = true;
    if (!e.prop) e.facing = dx < 0 ? -1 : 1;
    const gun = { x: cx + e.facing * 10, y: e.y + 8 };

    switch (e.type) {
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
      case 'B': gun(); for (let i = 0; i < 20; i++) coin(w, x, y, (i - 9.5) * 14, -200 - w.rand() * 160); break;
      case 'f': gun(); break;
      case 'n': for (let i = 0; i < 3; i++) coin(w, x, y, (i - 1) * 30, -200); break;
      case '$': for (let i = 0; i < 8; i++) coin(w, x, y, (i - 3.5) * 22, -190 - w.rand() * 70); break;
      case 'c': {
        const r = w.rand();
        if (r < 0.6) gun();
        else if (r < 0.8) { const k = JR.makePickup('r', x, y); k.vy = -150; w.pickups.push(k); }
        else for (let i = 0; i < 5; i++) coin(w, x, y, (i - 2) * 25, -180);
        break;
      }
      default: if (w.rand() < 0.4) coin(w, x, y, 0, -160);
    }
  };
})();
