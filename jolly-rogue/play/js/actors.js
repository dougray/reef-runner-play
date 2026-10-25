// Actors: the pirate, navy sailors, pickups, and who-hits-whom. No drawing here.
(() => {
  const JR = window.JR;
  const T = () => JR.TILE;

  // Everything that lives in a run besides the level and the player.
  // events: sound/effect cues for the game to play this frame ('shot', 'kill', ...).
  JR.makeWorld = seed => ({
    rand: JR.rng(seed ^ 0x5eed), shots: [], enemies: [], pickups: [], fx: [], events: [], corpses: [],
  });

  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  JR.makePlayer = (x, y) => ({
    x, y, w: 10, h: 24, vx: 0, vy: 0, facing: 1, onGround: false, crouch: false, drop: 0,
    hearts: 7, maxHearts: 7, lives: 3, gold: 0, runGold: 0, kills: 0,
    inv: 0, cool: 0, slash: 0, coyote: 0, gun: 'pistol', baseGun: 'pistol', melee: 'cutlass',
    aim: { x: 1, y: 0 }, safeX: x, safeY: y, dead: false, god: false, runT: 0,
    cls: 'swash', speed: JR.RUN_SPEED, jumpMult: 1, doubleJump: false, usedDouble: false,
    meleeMult: 1, reloadMult: 1, graceMax: 0, grace: 0, pet: 'none', mag: 0, magnet: 0,
  });

  JR.CLASSES = {
    swash: { hearts: 7, speed: 1.1, jump: 1.08 },
    brawler: { hearts: 9, speed: 0.88, melee: 1.5 },
    gunner: { hearts: 6, reload: 0.75, grace: 1 },
  };

  // Turns the profile's class, kit and pet into the player's numbers.
  JR.applyBuild = (p, equip) => {
    const c = JR.CLASSES[equip.cls] || JR.CLASSES.swash;
    p.cls = equip.cls;
    p.maxHearts = p.hearts = c.hearts;
    p.speed = JR.RUN_SPEED * (c.speed || 1);
    p.jumpMult = c.jump || 1;
    p.doubleJump = true;                         // every class (the user's call, 2026-10-11)
    p.meleeMult = c.melee || 1;
    p.reloadMult = c.reload || 1;
    p.graceMax = c.grace || 0;
    p.melee = equip.melee;
    p.gun = p.baseGun = equip.gun;
    p.pet = equip.pet;
    p.look = equip;
    return p;
  };

  JR.hurt = (p, w) => {
    if (p.inv > 0 || p.god || p.dead) return false;
    p.hearts -= 1;
    p.inv = 1;
    p.hurtAt = p.clock;
    emit(w, 'hurt', p.x, p.y);
    if (p.hearts <= 0) {
      p.lives -= 1;
      emit(w, 'lifeLost', p.x, p.y);
      if (p.lives <= 0) { p.lives = 0; p.dead = true; return true; }
      p.hearts = p.maxHearts;
      // Gunners keep a pickup gun through one lost life; everyone else drops to their starting gun.
      if (p.grace > 0 && p.gun !== p.baseGun) p.grace -= 1;
      else p.gun = p.baseGun;
      p.mag = 0;
      p.inv = 2;
    }
    return true;
  };

  // Continue? after the last life: three fresh lives where the pirate fell, gold and gear kept.
  JR.continueRun = p => {
    p.dead = false;
    p.lives = 3;
    p.hearts = p.maxHearts;
    p.continues = (p.continues || 0) + 1;
    if (p.y > JR.WORLD_H) p.y = p.safeY - (24 - p.h), p.x = p.safeX;
    p.vx = p.vy = 0;
    p.inv = 2.5;
  };

  // Returns true when this gold earned an extra life.
  JR.addGold = (p, n) => {
    const before = Math.floor(p.runGold / JR.LIFE_GOLD);
    p.gold += n;
    p.runGold += n;
    const gained = Math.floor(p.runGold / JR.LIFE_GOLD) - before;
    p.lives += gained;
    return gained > 0;
  };

  JR.makePickup = (type, x, y) => ({ type, x: x - 4, y: y - 4, w: 8, h: 8, vx: 0, vy: 0, t: 0 });

  // Muzzle position: the end of the gun as drawn in the captain's hand (js/packart.js).
  const muzzle = p => {
    const dir = p.aim.x ? Math.sign(p.aim.x) : p.facing || 1;
    const m = JR.packart.muzzle(p.gun, JR.aimKey(Math.abs(p.aim.x), p.aim.y), dir, p.crouch);
    return { x: p.x + p.w / 2 + m.x, y: p.y + p.h + m.y };
  };

  JR.updatePlayer = (p, input, lv, w, dt) => {
    p.clock = (p.clock || 0) + dt;
    p.inv = Math.max(0, p.inv - dt);
    p.cool = Math.max(0, p.cool - dt);
    p.slash = Math.max(0, p.slash - dt);
    p.drop = Math.max(0, p.drop - dt);
    const feet = p.y + p.h;

    // Crouch: only on the ground, Down with no left/right. Feet stay planted.
    const wantCrouch = p.onGround && input.down && input.left === input.right;
    if (wantCrouch !== p.crouch) {
      p.crouch = wantCrouch;
      p.h = p.crouch ? 14 : 24;
      p.y = feet - p.h;
    }

    // Run: reach full speed in ~3 frames, stop in ~2. Crisp, but not robotic.
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.facing = dir;
    const target = p.crouch ? 0 : dir * p.speed;
    const rate = (target === 0 ? JR.RUN_DECEL : JR.RUN_ACCEL) * (p.onGround ? 1 : 0.75) * dt;
    p.vx = Math.abs(target - p.vx) <= rate ? target : p.vx + Math.sign(target - p.vx) * rate;
    p.runT = dir && p.onGround ? p.runT + dt : 0;

    // Jump: buffered presses, coyote time after leaving a ledge, and a short hop if released early.
    if (input.jumpPressed) p.jumpBuf = JR.JUMP_BUFFER;
    else p.jumpBuf = Math.max(0, (p.jumpBuf || 0) - dt);
    p.coyote = p.onGround ? JR.COYOTE : Math.max(0, p.coyote - dt);
    if (p.onGround) p.usedDouble = false;
    if (input.jumpPressed && !p.onGround && p.coyote <= 0 && p.doubleJump && !p.usedDouble) {
      p.vy = JR.JUMP_VEL * p.jumpMult * 0.9;         // the second jump
      p.usedDouble = true; p.jumpHeld = true; p.jumpBuf = 0;
      emit(w, 'jump', p.x, p.y);
      w.fx.push({ type: 'dust', x: p.x + p.w / 2, y: p.y + p.h, t: 0.25 });
    }
    if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
      const c = Math.floor((p.x + p.w / 2) / T()), r = Math.floor((feet + 1) / T());
      if (input.down && lv.platform(c, r)) {
        p.drop = 0.25;                       // Down + Jump on a dock drops through it
      } else {
        p.vy = JR.JUMP_VEL * p.jumpMult;
        p.jumpHeld = true;
        emit(w, 'jump', p.x, p.y);
      }
      p.jumpBuf = 0;
      p.coyote = 0;
      if (p.crouch) { p.crouch = false; p.h = 24; p.y = feet - p.h; }
    }
    if (!input.jump) p.jumpHeld = false;
    if (!p.jumpHeld && p.vy < JR.JUMP_CUT) p.vy = JR.JUMP_CUT;

    // Floaty on the way up while held, a little hang at the top, quick on the way down.
    let g = p.vy < 0 && p.jumpHeld ? JR.GRAVITY_UP : JR.GRAVITY_FALL;
    if (p.jumpHeld && Math.abs(p.vy) < 50) g *= 0.6;
    const wasAir = !p.onGround;
    p.vy = Math.min(p.vy + g * dt, JR.MAX_FALL);
    JR.moveBody(lv, p, dt);              // p.drop (a timer) is truthy while dropping through
    if (wasAir && p.onGround) { p.land = 0.1; emit(w, 'land', p.x + p.w / 2, p.y + p.h); }
    p.land = Math.max(0, (p.land || 0) - dt);

    p.aim = JR.aimDir(input, p.facing, p.onGround);

    // Remember the last spot of solid ground under both feet, to respawn after a fall.
    if (p.onGround) {
      const r = Math.floor((p.y + p.h + 1) / T());
      if (lv.solid(Math.floor(p.x / T()), r) && lv.solid(Math.floor((p.x + p.w - 1) / T()), r)) {
        p.safeX = p.x; p.safeY = p.y;
      }
    }

    if (p.y > JR.WORLD_H + 32) {
      JR.hurt(p, w);
      if (!p.dead) {
        p.x = p.safeX; p.y = p.safeY - (24 - p.h); p.vx = p.vy = 0;
        p.inv = Math.max(p.inv, 1);
      }
    }

    // Fire is held for auto-fire. Close enemies get the blade instead of a bullet.
    if (input.fire && p.cool <= 0) {
      const melee = JR.WEAPONS[p.melee];
      if (JR.inMeleeRange(p, w.enemies, melee)) {
        const box = JR.meleeBox(p, melee);
        for (const e of w.enemies) if (e.hp > 0 && JR.overlap(box, e)) damage(e, melee.dmg * p.meleeMult, p, w);
        // Sword combo: strikes 1-2-3 chain when they come quickly; in the air, two air attacks alternate.
        const quick = p.clock - (p.lastStrike ?? -9) <= Math.max(0.35, melee.cooldown + 0.1);
        if (!p.onGround) p.strike = quick && p.strike === 'air1' ? 'air2' : 'air1';
        else p.strike = 'attack' + (quick && /^attack[12]$/.test(p.strike) ? +p.strike.slice(-1) + 1 : 1);
        p.lastStrike = p.clock;
        p.slash = 0.18;
        p.cool = melee.cooldown;
        w.fx.push({ type: 'swoosh', x: p.x + p.w / 2, y: p.y + 10, dir: p.facing, t: 0.14 });
        emit(w, 'slash', box.x, box.y);
      } else {
        const gun = JR.WEAPONS[p.gun];
        const m = muzzle(p);
        w.shots.push(...JR.fireGun(gun, m.x, m.y, p.aim));
        w.fx.push({ type: 'flash', x: m.x, y: m.y, t: 0.06 });
        p.cool = gun.cooldown * p.reloadMult;
        if (gun.mag) {                                  // brace of pistols: a quick pair, then reload
          p.mag = (p.mag || gun.mag) - 1;
          if (p.mag <= 0) { p.cool = gun.reload * p.reloadMult; p.mag = gun.mag; }
        }
        emit(w, 'shot', m.x, m.y);
      }
    }
  };

  // The downward stab: the blade's damage plus one, a bounce, and the double jump back.
  function stab(e, p, w) {
    const blade = JR.WEAPONS[p.melee] || JR.WEAPONS.cutlass;
    damage(e, (blade.dmg + 1) * p.meleeMult, p, w);
    p.vy = JR.JUMP_VEL * JR.STOMP_BOUNCE * (p.jumpMult || 1);
    p.jumpHeld = true;                       // holding jump through the stab bounces higher
    p.usedDouble = false;
    p.onGround = false;
    p.inv = Math.max(p.inv, 0.12);           // not hurt by the enemy just stabbed
    p.strike = 'air2'; p.slash = 0.18; p.lastStrike = p.clock;
    w.fx.push({ type: 'swoosh', x: p.x + p.w / 2, y: p.y + p.h, dir: p.facing, t: 0.14 });
    emit(w, 'slash', e.x, e.y);
  }

  const damage = (JR.damage = (e, dmg, p, w) => {
    e.hp -= dmg;
    e.flash = 0.1;
    emit(w, e.prop ? 'thud' : 'hit', e.x, e.y);
    w.fx.push({ type: 'spark', x: e.x + e.w / 2, y: e.y + e.h / 3, t: 0.12 });
    if (e.hp > 0) return;
    if (e.prop) {
      emit(w, 'break', e.x, e.y);
      w.fx.push({ type: 'splinters', x: e.x + e.w / 2, y: e.y + e.h / 2, t: 0.45 });
    } else {
      p.kills += 1;
      emit(w, 'kill', e.x, e.y);
      // Knocked flat: flies back away from the pirate, lands, blinks out (JR.updateCorpses).
      if (e.boss) JR.bossDown(e, p, w);
      if (e.type !== 'n') w.corpses.push({
        type: e.type, look: JR.LOOKS[e.type] || 'sailor', nation: e.nation, facing: e.facing,
        x: e.x, y: e.y, w: e.boss ? e.w : 12, h: e.boss ? e.h : 24,
        vx: -e.facing * (e.boss ? 50 : 80), vy: e.boss ? -220 : -170, age: 0, onGround: false, boss: !!e.boss,
      });
      else w.fx.push({ type: 'boom', x: e.x + e.w / 2, y: e.y + e.h / 2, r: 20, t: 0.4 });
    }
    JR.dropsFor(e, w);
  });

  const shotBox = s => { const r = s.r || 2; return { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 }; };

  // Distance from a point to the nearest edge of a box (0 inside).
  const reach = (x, y, b) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.y - y, 0, y - (b.y + b.h)));

  // Grenades and bombs: everything on the other side within s.boom px takes the blast.
  JR.explode = (w, s, p) => {
    w.fx.push({ type: 'boom', x: s.x, y: s.y, r: s.boom, t: 0.4 });
    emit(w, 'boom', s.x, s.y);
    if (s.friendly) {
      for (const e of w.enemies) if (e.hp > 0 && reach(s.x, s.y, e) <= s.boom) damage(e, s.dmg, p, w);
    } else if (reach(s.x, s.y, p) <= s.boom) JR.hurt(p, w);
  };

  // Moves shots; thrown ones fall. Walls stop everything; bombs and grenades burst instead.
  JR.updateShots = (w, lv, dt, camX, p) => {
    const T = JR.TILE;
    w.shots = w.shots.filter(s => {
      if (s.grav) s.vy = Math.min(s.vy + JR.GRAVITY * dt, JR.MAX_FALL);
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      const wall = lv.solid(Math.floor(s.x / T), Math.floor((s.y + (s.grav ? s.r || 0 : 0)) / T));
      if (wall || s.life <= 0) {
        if (s.boom) JR.explode(w, s, p);
        else if (wall) w.fx.push({ type: 'spark', x: s.x, y: s.y, t: 0.12 });
        return false;
      }
      return s.x > camX - 24 && s.x < camX + JR.VIEW_W + 24 && s.y > -120 && s.y < JR.WORLD_H + 16;
    });
  };

  // Dropped things (coins from sailors, guns from crates) fall and settle; placed coins float.
  JR.updatePickups = (w, lv, dt) => {
    for (const k of w.pickups) {
      k.t += dt;
      if (k.vy || k.falling) {
        k.falling = true;
        k.vy = Math.min(k.vy + JR.GRAVITY * dt, JR.MAX_FALL);
        JR.moveBody(lv, k, dt);
        if (k.onGround) { k.vy = 0; k.vx = 0; k.falling = false; }
      }
    }
  };

  JR.resolveHits = (w, p) => {
    w.shots = w.shots.filter(s => {
      const box = shotBox(s);
      if (s.friendly) {
        const e = w.enemies.find(e => e.hp > 0 && JR.overlap(box, e) && !(s.hit && s.hit.includes(e)));
        if (!e) return true;
        if (s.boom) { JR.explode(w, s, p); return false; }
        damage(e, s.dmg, p, w);
        if (s.pierce) { (s.hit = s.hit || []).push(e); return true; }
        return false;
      }
      if (!JR.overlap(box, p)) return true;
      if (s.boom) JR.explode(w, s, p); else JR.hurt(p, w);
      return false;
    });

    // Landing on an enemy stabs it with the sword (the user's idea): falling, feet near its top. The
    // pirate bounces up with the double jump restored, so stabs chain across a crew. Anything else
    // that touches the pirate still hurts.
    for (const e of w.enemies) {
      if (e.hp <= 0 || !JR.overlap(e, p)) continue;
      const feet = p.y + p.h;
      if (p.vy > 0 && feet - e.y <= JR.STOMP_DEPTH + p.vy / 60) { stab(e, p, w); continue; }
      if (!e.prop) JR.hurt(p, w);
    }

    w.pickups = w.pickups.filter(k => {
      if (!JR.overlap(k, p)) return true;
      if (k.type === 'o') emit(w, JR.addGold(p, JR.COIN) ? 'life' : 'coin', k.x, k.y);
      else if (k.type === 'r') { p.hearts = Math.min(p.maxHearts, p.hearts + 1); emit(w, 'heal', k.x, k.y); }
      else if (k.type === 'w') { p.gun = k.gun; p.grace = p.graceMax; p.mag = 0; emit(w, 'gun', k.x, k.y); }
      return false;
    });
  };
})();

(() => {
  const JR = window.JR;
  JR.updateCorpses = (w, lv, dt) => {
    w.corpses = w.corpses.filter(k => {
      k.age += dt;
      k.vy = Math.min(k.vy + JR.GRAVITY * dt, JR.MAX_FALL);
      JR.moveBody(lv, k, dt);
      if (k.onGround) k.vx *= 0.82;
      return k.age < (k.boss ? 2.2 : 0.9) && k.y < JR.WORLD_H + 32;
    });
  };
})();
