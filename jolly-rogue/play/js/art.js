// Drawing, NES style: everything is pixel sprites from js/pixel.js and js/sprites.js, drawn with
// smoothing off at device-pixel-snapped positions. World coordinates are game pixels; the game sets
// the context scale and JR.px.S. Positions passed in here are already interpolated.
(() => {
  const JR = window.JR;
  const px = JR.px;
  const art = (JR.art = {});
  const W = () => JR.VIEW_W;

  // ---------- the world (js/art-world.js) ----------

  art.drawSky = (ctx, camX, t, biome = 'beach') => {
    ctx.fillStyle = '#2e2a3a'; ctx.fillRect(0, 0, W(), JR.VIEW_H);   // until the atlas is in
    JR.artWorld.drawBackdrop(ctx, camX, t, biome);
  };
  art.drawTiles = (ctx, lv, camX) => JR.artWorld.drawTiles(ctx, lv, camX);

  // ---------- the cast (Pixel Frog's packs via js/atlas.js; guns and pets from js/packart.js) ----------

  const A = JR.atlas, PA = () => JR.packart;
  const blink = (age, from) => age > from && Math.floor(age * 16) % 2;

  // The captain from game state. x, y = feet center (interpolated).
  art.drawPlayer = (ctx, p, x, y, t) => {
    if (!A.ready || (p.inv > 0 && Math.floor(t * 20) % 2)) return;
    const look = { body: p.look.body, recolor: JR.lookRecolors(p.look) };
    const flip = p.facing < 0, aim = JR.aimKey(Math.abs(p.aim.x), p.aim.y);
    ctx.save(); ctx.translate(px.snap(x), px.snap(y)); if (flip) ctx.scale(-1, 1);
    if (p.crouch && p.slash <= 0) {
      const c = PA().crouch(look);
      ctx.drawImage(c.img, c.dx, c.dy);
      gunAt(ctx, p, JR.packart.CROUCH_HAND, 'fwd');
    } else {
      let anim, at = t, gun = true;
      if (p.slash > 0) {
        anim = 'captain.' + (p.strike || 'attack1'); gun = false;
        at = Math.min(0.999, 1 - p.slash / 0.18) * A.frames(anim) / A.data.anims[anim].fps;
      } else if (p.hurtAt != null && p.clock - p.hurtAt < 0.25) anim = 'captain.hit', at = p.clock - p.hurtAt;
      else if (!p.onGround) anim = p.vy < 0 ? 'captain.jump' : 'captain.fall';
      else anim = Math.abs(p.vx) > 8 ? 'captain.run' : 'captain.idle', at = Math.abs(p.vx) > 8 ? p.runT : t;
      const i = A.index(anim, at, !/\.(attack\d|air\d|hit)$/.test(anim));
      const f = A.frameAt(anim, i);
      ctx.drawImage(PA().captainFrame(anim, i, look), f.dx, f.dy);
      if (gun && f.hand) gunAt(ctx, p, f.hand, aim);
    }
    ctx.restore();
    art.drawPet(ctx, p, x, y, t);
  };

  // The gun in the captain's hand, kicked back a pixel just after a shot.
  function gunAt(ctx, p, hand, aim) {
    const g = PA().gun(p.gun, aim), w = JR.WEAPONS[p.gun];
    const kick = p.cool > w.cooldown - 0.07 ? 1 : 0;
    ctx.drawImage(g.img, hand.x - g.gx - kick, hand.y - g.gy);
  }

  // The parrot flutters above the captain's back shoulder; the monkey rides on it.
  art.drawPet = (ctx, p, x, y, t) => {
    const f = p.facing || 1, crouch = p.crouch ? 8 : 0;
    const put = (img, ox, oy) => {
      ctx.save(); ctx.translate(px.snap(x - f * ox), px.snap(y + oy)); if (f < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -Math.floor(img.width / 2), -img.height); ctx.restore();
    };
    if (p.pet === 'parrot') {
      const bob = Math.round(Math.sin(t * 6) * 2);
      put(PA().parrot(Math.floor(t * 10)), 10, -30 + bob + crouch);
      if (p.alert && Math.floor(t * 8) % 2) px.text(ctx, '!', x - f * 10, y - 46 + bob + crouch, { color: '#fcc838', align: 'center' });
    } else if (p.pet === 'monkey') put(PA().monkey(Math.floor(t * 3)), 7, -20 + crouch);
  };

  const tell = (ctx, x, y, t) => { if (Math.floor(t * 12) % 2 === 0) px.text(ctx, '!', x, y, { color: '#fcc838', align: 'center' }); };

  art.drawBoss = (ctx, b, x, y, t) => {
    if (!A.ready) return;
    const art_ = JR.BOSSES[b.nation].art;
    let pose = 'idle', at = b.t, opts = { flip: b.facing > 0, white: b.flash > 0 };   // Pirate Bomb art faces left
    if (!b.onGround) pose = b.vy < 0 ? 'jump' : 'fall';
    else if (b.tell) pose = 'attack', opts.i = 0;
    else if (b.fired > 0.1 || b.state === 'act') pose = 'attack';
    else if (Math.abs(b.vx) > 1) pose = 'run';
    A.draw(ctx, `${art_}.${pose}`, at, x, y, opts);
    if (b.tell) tell(ctx, x, y - b.h - 18, t);
  };

  art.drawEnemy = (ctx, e, x, y, t) => {
    if (!A.ready) return;
    if (e.type === 'B') return art.drawBoss(ctx, e, x, y, t);
    const c = PA().CAST[e.type];
    const opts = { flip: c.left ? e.facing > 0 : e.facing < 0, white: e.flash > 0, crew: e.prop || e.type === 'n' ? null : e.nation, scale: c.scale };
    let pose = 'idle', at = e.t;
    if (e.type === 'c') pose = e.flash > 0 ? 'hit' : 'idle';
    else if (e.type === 'n' || e.type === 's') {
      if (e.fired > 0) pose = 'fire', at = 0.25 - e.fired, opts.loop = false;
    } else if (e.tell) pose = e.type === 'f' ? 'idle' : 'anticipation';
    else if (e.fired > 0) pose = 'attack', at = 0.25 - e.fired;
    else if (Math.abs(e.vx) > 1) pose = 'run';
    A.draw(ctx, `${c.anim}.${pose}`, at, x, y, opts);
    if (e.tell) tell(ctx, x, y - e.h - 16, t);
  };

  // Knocked down: the dead-hit tumble in the air, then flat on the ground, blinking out.
  art.drawCorpse = (ctx, k, x, y) => {
    if (!A.ready || blink(k.age, k.boss ? 1.6 : 0.55)) return;
    const c = k.boss ? { anim: JR.BOSSES[k.nation].art } : PA().CAST[k.type] || PA().CAST.d;
    const opts = { flip: k.boss || c.left ? k.facing > 0 : k.facing < 0, white: k.age < 0.07, crew: k.boss ? null : k.nation, scale: c.scale, loop: false };
    const name = k.type === 's' ? 'seashell.destroyed' : `${c.anim}.${k.onGround ? 'deadGround' : 'deadHit'}`;
    A.draw(ctx, name, k.age, x, y, opts);
  };

  // A sprite centered on (x, y) rather than standing on it.
  const centered = (ctx, name, t, x, y, opts = {}) => {
    const f = A.frameAt(name, 0), s = opts.scale || 1;
    A.draw(ctx, name, t, x, y + (f.dy + f.h / 2) * -s, opts);
  };

  art.drawShot = (ctx, s, x, y, t) => {
    if (!A.ready) return;
    if (s.roll || s.boom) centered(ctx, 'bomb.on', t, x, y + 6, { scale: 0.5 });
    else if (s.wave) px.draw(ctx, JR.small.wave(Math.floor(t * 10) % 2), x, y + 4, 7, 10, s.vx < 0);
    else if (s.dagger) px.draw(ctx, JR.small.dagger(), x, y, 5, 2, s.vx < 0);
    else if (s.ball) centered(ctx, 'cannonball', t, x, y, { scale: 0.7 });
    else if (s.friendly) px.draw(ctx, JR.small.bullet(), x, y, 2.5, 2.5);
    else centered(ctx, 'pearl', t, x, y);
  };

  art.drawPickup = (ctx, k, x, y, t) => {
    if (!A.ready) return;
    if (k.type === 'o') A.draw(ctx, 'coin', t + k.x * 0.01, x + 4, y + 9 + Math.round(Math.sin(t * 3 + k.x * 0.1)));
    else if (k.type === 'w') {
      const bob = k.falling ? 0 : Math.round(Math.sin(t * 5) * 1.5);
      if (k.t < 6 || Math.floor(t * 10) % 2) px.draw(ctx, JR.small.badge(JR.WEAPONS[k.gun].letter), x + 4, y + 8 + bob, 7, 14);
    } else if (k.type === 'r') A.draw(ctx, 'potion', t, x + 4, y + 12);
  };
  art.drawFx = (ctx, f, t) => {
    if (f.delay > 0) return;
    if (f.type === 'flash') { const img = JR.packart.flash(f.t > 0.03 ? 0 : 1); ctx.drawImage(img, px.snap(f.x) - (img.width >> 1), px.snap(f.y) - (img.height >> 1)); }
    else if (f.type === 'dust') { if (A.ready) A.draw(ctx, 'dust.jump', 0.25 - f.t, f.x, f.y + 1, { loop: false }); }
    else if (f.type === 'smoke') {
      const k = 1 - f.t / 0.4, r = Math.max(1, Math.round(2 + k * 3));
      ctx.fillStyle = '#e8e8f0';
      if (k < 0.7 || Math.floor(t * 30) % 2) {
        const cx = px.snap(f.x), cy = px.snap(f.y - k * 6);
        ctx.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 2); ctx.fillRect(cx - r + 1, cy - r, r * 2 - 2, r * 2);
      }
    } else if (f.type === 'poof') {
      const k = 1 - f.t / 0.35;
      ctx.fillStyle = '#fcfcfc';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047, d = 3 + k * 12, s = Math.max(1, Math.round(3 * (1 - k)));
        ctx.fillRect(px.snap(f.x + Math.cos(a) * d), px.snap(f.y + Math.sin(a) * d), s, s);
      }
    } else if (f.type === 'boom') {
      // The pack's explosions: the cannonball's for small blasts, Pirate Bomb's (scaled) for big ones.
      if (!A.ready) return;
      const R = f.r || 24, big = R > 20;
      centered(ctx, big ? 'bomb.boom' : 'cannonball.boom', 0.4 - f.t, f.x, f.y, { loop: false, scale: big ? R / 34 : R / 18 });
    } else if (f.type === 'splinters') {
      const k = 1 - f.t / 0.45;
      ctx.fillStyle = '#8a5a3a';
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI + (i / 7) * Math.PI, v = 50 + (i % 3) * 20;
        ctx.fillRect(px.snap(f.x + Math.cos(a) * v * k * 0.5), px.snap(f.y + Math.sin(a) * v * k * 0.5 + 120 * k * k * 0.5), 2, 2);
      }
    } else if (f.type === 'spark') {
      ctx.fillStyle = '#fcfcfc';
      const d = 2 + (1 - f.t / 0.12) * 4;
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) ctx.fillRect(px.snap(f.x + dx * d), px.snap(f.y + dy * d), 1, 1);
    } else if (f.type === 'float') {
      px.text(ctx, f.text, f.x, f.y - (0.8 - f.t) * 20, { color: f.color || '#fcc838', align: 'center' });
    } else if (f.type === 'swoosh') {
      const k = 1 - f.t / 0.14;
      ctx.fillStyle = '#fcfcfc';
      for (let i = 0; i < 8; i++) {
        const a = -1.2 + (i / 7) * 2.2 * Math.min(1, k * 1.6);
        ctx.fillRect(px.snap(f.x + Math.cos(a) * 15 * f.dir), px.snap(f.y + Math.sin(a) * 15), 2, 2);
      }
    }
  };

  // inset.l / inset.r: game pixels kept clear for the phone's pause and mute buttons.
  art.drawHud = (ctx, p, score, best, inset = { l: 0, r: 0 }) => {
    const L = 5 + inset.l, R = W() - 5 - inset.r;
    for (let i = 0; i < p.maxHearts; i++) JR.ui.heart(ctx, L + i * 10, 4, i < p.hearts);
    ctx.drawImage(JR.small.skull(), L, 14);
    px.text(ctx, 'x' + p.lives, L + 10, 18);
    if (A.ready) A.draw(ctx, 'coin', 0, L + 36, 24, { i: 0 });
    px.text(ctx, String(p.gold), L + 41, 18, { color: '#fcc838' });
    px.text(ctx, JR.WEAPONS[p.gun].name, L, 29, { color: p.gun === 'pistol' ? '#bcbcd0' : '#fcfcfc' });
    px.text(ctx, String(score).padStart(6, '0'), R, 8, { align: 'right' });
    if (best) px.text(ctx, 'HI ' + String(best).padStart(6, '0'), R, 18, { align: 'right', color: '#bcdcfc' });
  };

  // Boss name and health along the bottom of the screen.
  art.drawBossBar = (ctx, b) => {
    const w = 190, x = Math.round((W() - w) / 2), y = JR.VIEW_H - 22;
    JR.ui.bar(ctx, x, y, w, b.hp / b.maxHp);
    px.text(ctx, b.name, W() / 2 + 8, y - 4, { align: 'center', color: '#fcc838' });
  };

  art.text = (ctx, str, x, y, opts) => px.text(ctx, str, x, y, opts);

  // On a touch screen menus show big tappable buttons instead of keyboard hints.
  JR.touchMode = () => typeof document !== 'undefined' && document.documentElement.classList.contains('touch');
  // Green for buying, grayed when there is nothing to buy, yellow otherwise.
  art.button = (ctx, b, label, color = '#fcc838') => {
    ctx.save();
    if (color === '#a8a8bc') ctx.globalAlpha = 0.55;
    JR.ui.button(ctx, b, label, color === '#7cfc7c');
    ctx.restore();
  };
  JR.hit = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
})();
