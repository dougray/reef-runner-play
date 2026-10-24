// The world: firing, shots (piercing harpoons, homing rockets), enemies and weather, hits, drops
// and pickups, damage and lives. Pure logic, no drawing.
(() => {
  const CD = window.CD;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  CD.makeWorld = seed => ({
    rand: CD.rng(seed), shots: [], enemies: [], pickups: [], fx: [], events: [], clouds: [], bolts: [], hazards: [],
    score: 0, gold: 0, distance: 0, spawnTimer: 1.2, wave: 0, t: 0, boss: null, nextBoss: CD.AREA_LEN - 60,
  });

  CD.hurt = (s, w) => {
    if (CD.shipInvulnerable(s) || s.dead) return false;
    s.hearts -= 1; s.inv = CD.INV_TIME;
    emit(w, 'hurt', s.x, s.y);
    if (s.hearts <= 0) {
      s.lives -= 1;
      s.weapon = 'cannon'; s.weaponT = 0;                  // a pickup gun goes down with the hull
      emit(w, 'lifeLost', s.x, s.y);
      if (s.lives <= 0) { s.lives = 0; s.dead = true; return true; }
      s.hearts = s.maxHearts; s.inv = 2;
    }
    return true;
  };

  const drop = (w, type, x, y, extra = {}) => w.pickups.push({ type, x: x - 5, y, w: 10, h: 10, vy: -20, t: 0, ...extra });

  CD.killEnemy = (w, s, e) => {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    const d = CD.ENEMIES[e.type], cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    w.score += d.score;
    emit(w, 'kill', e.x, e.y);
    if (d.blast) { CD.explode(w, s, cx, cy, d.blast); return; }
    w.fx.push({ type: 'boom', x: cx, y: cy, t: 0.45, r: Math.max(14, e.w * 0.4) });
    if (d.drops === 'weapon') drop(w, 'weapon', cx, cy, { gun: CD.PICKUP_GUNS[Math.floor(w.rand() * CD.PICKUP_GUNS.length)] });
    const r = w.rand();
    if (r < 0.08) drop(w, 'repair', cx, cy);
    else if (r < 0.18) drop(w, 'coal', cx, cy);
    else if (r < 0.6) drop(w, 'gold', cx, cy);
  };

  CD.collect = (w, s, k) => {
    if (k.type === 'gold') {
      w.gold += 1; w.score += 10;
      if (w.gold % 100 === 0) { s.lives += 1; emit(w, 'extraLife', s.x, s.y); }   // series rule: every 100 gold in a run
    }
    else if (k.type === 'coal') s.steam = Math.min(s.steamMax, s.steam + 40);
    else if (k.type === 'repair') s.hearts = Math.min(s.maxHearts, s.hearts + 1);
    else if (k.type === 'weapon') { s.weapon = k.gun; s.weaponT = CD.WEAPON_TIME; }
    emit(w, k.type === 'gold' ? 'coin' : 'pickup', k.x || 0, k.y || 0);
  };

  // The ship's hitbox is a bit smaller than its art (series rule: generous).
  const hitbox = s => ({ x: s.x + 6, y: s.y + 6, w: s.w - 12, h: s.h - 9 });

  CD.resolveHits = (w, s) => {
    for (const b of w.shots) {
      if (b.life <= 0) continue;
      const box = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
      if (b.friendly) {
        const boss = w.boss;
        if (boss && boss.state !== 'enter' && CD.overlap(box, boss) && !(b.pierce && (b.hit || []).includes(boss))) {
          if (b.pierce) { b.hit = b.hit || []; b.hit.push(boss); } else b.life = 0;
          emit(w, 'hit', b.x, b.y);
          CD.damageBoss(w, s, b.dmg);
          if (!b.pierce) continue;
        }
        for (const e of w.enemies) {
          if (e.hp <= 0 || e.hidden || !CD.overlap(box, e)) continue;
          if (b.pierce) { b.hit = b.hit || []; if (b.hit.includes(e)) continue; b.hit.push(e); }
          e.hp -= b.dmg; e.flash = 0.08;
          emit(w, 'hit', b.x, b.y);
          if (e.hp <= 0) CD.killEnemy(w, s, e);
          if (!b.pierce) { b.life = 0; break; }
        }
      } else if (CD.overlap(box, hitbox(s))) {
        b.life = 0;
        CD.hurt(s, w);
      }
    }
    for (const e of w.enemies) {
      if (e.hp <= 0 || e.hidden || !CD.overlap(e, hitbox(s))) continue;
      if (s.dash > 0) CD.killEnemy(w, s, e);
      else if (CD.hurt(s, w)) { e.hp -= CD.ENEMIES[e.type].blast ? 99 : 1; if (e.hp <= 0) CD.killEnemy(w, s, e); }
    }
    const boss = w.boss;
    if (boss && boss.state !== 'enter' && CD.overlap(boss, hitbox(s))) {
      if (s.dash > 0) { CD.damageBoss(w, s, 5); s.dash = 0; s.x = Math.max(CD.MARGIN, s.x - 24); s.inv = Math.max(s.inv, 0.6); emit(w, 'ram', s.x, s.y); }
      else CD.hurt(s, w);
    }
    for (const k of w.pickups) if (!k.taken && CD.overlap(k, s)) { k.taken = true; CD.collect(w, s, k); }
    w.shots = w.shots.filter(b => b.life > 0);
    w.enemies = w.enemies.filter(e => e.hp > 0 && !e.gone);
    w.pickups = w.pickups.filter(k => !k.taken);
  };

  CD.updateShots = (w, dt, s) => {
    const born = [];
    for (const b of w.shots) {
      if (b.homing && !b.friendly && s) {
        const want = Math.atan2(s.y + s.h / 2 - b.y, s.x + s.w / 2 - b.x), cur = Math.atan2(b.vy, b.vx);
        let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const a = cur + CD.clamp(da, -1.6 * dt, 1.6 * dt), sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      } else if (b.homing) {
        let best = null, bd = 1e9;
        const targets = w.boss && w.boss.state !== 'enter' ? [...w.enemies, w.boss] : w.enemies;   // bosses too
        for (const e of targets) {
          if (e.hp <= 0 || e.hidden) continue;
          const d = Math.hypot(e.x + e.w / 2 - b.x, e.y + e.h / 2 - b.y);
          if (d < bd && e.x + e.w / 2 > b.x - 10) { bd = d; best = e; }
        }
        if (best) {
          const want = Math.atan2(best.y + best.h / 2 - b.y, best.x + best.w / 2 - b.x), cur = Math.atan2(b.vy, b.vx);
          let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
          const a = cur + CD.clamp(da, -4 * dt, 4 * dt), sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        }
      }
      if (b.grav) b.vy += b.grav * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.fuse !== undefined && (b.fuse -= dt) <= 0 && b.life > 0) {        // a mortar shell bursts
        b.life = 0;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; born.push({ x: b.x, y: b.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, r: 2, friendly: false, dmg: 1, life: 2 }); }
        w.fx.push({ type: 'boom', x: b.x, y: b.y, t: 0.35, r: 10 });
      }
      if (b.x < -10 || b.x > CD.VIEW_W + 10 || b.y < (b.grav ? -200 : -10) || b.y > CD.VIEW_H + 10) b.life = 0;
    }
    w.shots.push(...born);
  };

  // Pickups drift down and back; the coin magnet (market) or the parrot pulls gold in from further off.
  CD.updatePickups = (w, s, dt) => {
    const reach = s.magnet ? 80 : s.pet === 'parrot' ? 45 : 0, cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    for (const k of w.pickups) {
      k.t += dt;
      const dx = cx - (k.x + 5), dy = cy - (k.y + 5), d = Math.hypot(dx, dy);
      if (k.type === 'gold' && d < reach) { k.x += (dx / d) * 160 * dt; k.y += (dy / d) * 160 * dt; continue; }
      k.vy = Math.min(40, k.vy + 60 * dt); k.y += k.vy * dt; k.x -= 30 * dt;
      if (k.x < -10 || k.y > CD.VIEW_H) k.taken = true;
    }
  };

  // Leaving the Sky Market: the world was frozen while you shopped, so clear the enemy shots that
  // hung beside the ship and give a moment's safety.
  CD.castOff = (w, s) => {
    w.shots = w.shots.filter(b => b.friendly);
    s.inv = Math.max(s.inv, 1.2);
  };

  CD.updateWorld = (w, s, input, dt) => {
    w.t += dt;
    w.events.length = 0;
    if (!w.boss) {                                         // the voyage waits while a boss is up
      w.distance += dt * 60;
      w.flown = (w.flown || 0) + dt;
      if (w.flown >= 1) { w.flown -= 1; w.score += 5; }   // distance flown counts: 5 a second
    }
    if (!w.boss && w.distance >= w.nextBoss) CD.startBoss(w, s);
    CD.updateShip(s, input, dt);
    input.dashPressed = false;

    s.fireCool -= dt;
    if (s.fireCool <= 0 && !s.dead && !w.paused) s.fireCool = CD.fireWeapon(w, s);

    if (!w.boss) { w.spawnTimer -= dt; if (w.spawnTimer <= 0) CD.spawnWave(w, s); }

    CD.updateWeather(w, s, dt);
    if (w.boss) CD.updateBoss(w, s, dt);
    CD.updateHazards(w, s, dt);
    CD.updateEnemies(w, s, dt);
    CD.updateShots(w, dt, s);
    CD.updatePickups(w, s, dt);
    for (const f of w.fx) f.t -= dt;
    w.fx = w.fx.filter(f => f.t > 0);
    CD.resolveHits(w, s);
  };
})();
