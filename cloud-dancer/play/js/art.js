// Drawing, in game units. The airship, navy, bosses and scenery are painted sprites (tools/paint_*.py,
// tools/ship_sprite.py, packed into js/sprites.js); moving parts, shots, gold, effects and the HUD
// are drawn here with shaded canvas shapes under a dark ink outline. The game sets the context
// scale; positions passed in are already interpolated.
(() => {
  const CD = window.CD;
  const art = (CD.art = {});
  const INK = '#2a1a12';
  const W = () => CD.VIEW_W, H = () => CD.VIEW_H;
  const padMode = () => document.documentElement.classList.contains('pad');   // a controller or TV remote

  const BRASS = '#d9a441';

  function outline(ctx, w = 1.2) { ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke(); }
  function ellipse(ctx, x, y, rx, ry, fill, line = 1.2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (line) outline(ctx, line);
  }

  // ---------- sky ----------

  const wrap = (x, span, pad = 0) => ((x % span) + span) % span - pad;

  // A sprite as a white silhouette, for the hit flash.
  art.flashed = k => {
    const key = 'flash:' + k, src = art.sprite(k);
    if (!src) return null;
    if (!tints.has(key)) {
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.65)'; g.fillRect(0, 0, c.width, c.height);
      tints.set(key, c);
    }
    return tints.get(key);
  };

  // Painted scenery (tools/paint_sky.py) is 3 px per game unit; wide layers tile sideways.
  const PX = 3;
  function tileX(ctx, im, offset) {
    const tw = im.width / PX, th = im.height / PX;
    for (let x = wrap(offset, tw) - tw; x < W(); x += tw) ctx.drawImage(im, x, 0, tw, th);
  }
  // A painted cumulus, `w` units wide, centred on x, y.
  function cumulus(ctx, i, x, y, w, alpha = 1, tint = null) {
    if (tint && tint.length < 8 && !tint.startsWith('#')) tint = CLOUD_TINT[tint] || null;   // an area name
    const name = 'cloud-' + (1 + (Math.abs(Math.round(i)) % 4)), im = tint ? art.tinted(name, tint) : art.sprite(name);
    if (!im) return;
    const h = w * im.height / im.width;
    ctx.globalAlpha = alpha; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1;
  }
  // Cumulus sprites are painted white; each area tints them (multiply).
  const CLOUD_TINT = { storm: '#9ea8ba', forts: '#ffd4bf', ceiling: '#e2e8ff' };
  const painted = area => art.sprite('sky-' + area) && art.sprite('far-' + area) && art.sprite('band-' + area) && art.sprite('cloud-4');

  art.drawSky = (ctx, dist, t, area = 'reef') => {
    if (painted(area)) {
      ctx.drawImage(art.sprite('sky-' + area), 0, 0, W(), H());
      for (let i = 0; i < 4; i++) cumulus(ctx, i + 2, wrap(i * 150 + 40 - dist * 0.12, 600, 60), 22 + (i % 2) * 20, 46, 0.75, area);   // high, small
      if (art.sprite('isles-' + area)) tileX(ctx, art.sprite('isles-' + area), -dist * 0.1);
      tileX(ctx, art.sprite('band-' + area), -dist * 0.05);
      tileX(ctx, art.sprite('far-' + area), -dist * 0.08);
      for (let i = 0; i < 5; i++) cumulus(ctx, i, wrap(i * 120 - dist * 0.3, 600, 70), 112 + (i % 2) * 12, 74 + (i % 3) * 12, 0.95, area);   // behind the ship
      return;
    }
  };

  // Near clouds drift in front of everything.
  art.drawNearClouds = (ctx, dist, area = 'reef', t = 0) => {
    if (painted(area)) {
      for (let i = 0; i < 2; i++) cumulus(ctx, i + 1, wrap(i * 300 + 120 - dist * 0.9, 700, 90), 160 + i * 40, 150, 0.8, area);
      if (area === 'storm') {                             // rain, slanting, in front of everything
        ctx.strokeStyle = 'rgba(200,214,232,.35)'; ctx.lineWidth = 0.6; ctx.beginPath();
        for (let i = 0; i < 70; i++) {
          const rx = wrap(i * 53 - dist * 1.4 - t * 20 * (1 + (i % 3) * 0.2), W() + 40, 20), ry = wrap(i * 37 + t * 250, H() + 20, 10);
          ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9);
        }
        ctx.stroke();
      }
      return;
    }
  };

  // ---------- the Cloud Dancer ----------

  // The player's airship is the painted ship from the app icon (assets/sprites, packed into
  // js/sprites.js). Hangar looks recolour it through three masks (envelope, hull, flag); each look
  // is painted once onto its own canvas and kept.
  const SHIP_PX = [360, 322];          // sprite size in pixels
  const SHIP_K = 48 / 360;             // game units per sprite pixel: about 48 units wide
  const SHIP_BODY = [185, 190];        // sprite pixel at the centre of the hitbox
  const SHIP_BOWSPRIT = [350, 136];    // where the parrot perches
  const SHIP_PROP = [22, 255];         // the stern propeller's hub
  // Envelope [colour, mode], hull, flag. Multiply keeps the painted shading under the new colour.
  const ENVELOPES = { red: '#e8695c', navy: '#5f8ae6', black: '#6a6474', gold: '#ffd77a' };
  // Hull wood is dark, so ebony darkens it further and crimson swaps its hue but keeps its grain.
  const HULLS = { ebony: [['#808080', 'saturation'], ['#8a8490', 'multiply']], crimson: [['#c8281e', 'color']] };
  const img = {};
  const loaded = k => img[k] && img[k].complete && img[k].naturalWidth > 0;
  art.spritesReady = () => {
    if (!CD.SPRITE_SRC || typeof Image === 'undefined') return false;
    if (!img.ship) for (const [k, src] of Object.entries(CD.SPRITE_SRC)) { img[k] = new Image(); img[k].src = src; }
    return ['ship', 'ship-envelope', 'ship-hull', 'ship-flag'].every(loaded);
  };
  // A painted sprite by name, or null until it has loaded (callers fall back or skip).
  art.sprite = k => (art.spritesReady() || img.ship) && loaded(k) ? img[k] : null;
  // A sprite multiplied by a colour (storm grey, ink), painted once and kept.
  const tints = new Map();
  art.tinted = (k, colour, mode = 'multiply') => {
    const key = k + colour + mode, src = art.sprite(k);
    if (!src) return null;
    if (!tints.has(key)) {
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0); g.globalCompositeOperation = mode; g.fillStyle = colour; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
      tints.set(key, c);
    }
    return tints.get(key);
  };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Paint `fill` (a colour or a function drawing onto the layer) through a mask onto g with `mode`.
  function tint(g, mask, fill, mode) {
    const layer = canvas(SHIP_PX[0], SHIP_PX[1]), l = layer.getContext('2d');
    if (typeof fill === 'function') fill(l); else { l.fillStyle = fill; l.fillRect(0, 0, SHIP_PX[0], SHIP_PX[1]); }
    l.globalCompositeOperation = 'destination-in'; l.drawImage(mask, 0, 0);
    g.globalCompositeOperation = mode; g.drawImage(layer, 0, 0); g.globalCompositeOperation = 'source-over';
  }
  const looks = new Map();
  function shipLook(look) {
    const key = [look.envelope, look.pattern, look.hull, look.sail].join();
    if (looks.has(key)) return looks.get(key);
    const c = canvas(SHIP_PX[0], SHIP_PX[1]), g = c.getContext('2d');
    g.drawImage(img.ship, 0, 0);
    if (ENVELOPES[look.envelope]) tint(g, img['ship-envelope'], ENVELOPES[look.envelope], 'multiply');
    if (look.pattern === 'stripes' || look.pattern === 'checker') {
      tint(g, img['ship-envelope'], l => {
        l.fillStyle = 'rgba(60,30,24,.6)';
        for (let x = 0; x < SHIP_PX[0]; x += 44) {
          if (look.pattern === 'stripes') l.fillRect(x, 0, 22, SHIP_PX[1]);
          else for (let y = (x / 44) % 2 ? 22 : 0; y < SHIP_PX[1]; y += 44) l.fillRect(x, y, 22, 22);
        }
      }, 'multiply');
    }
    for (const [colour, mode] of HULLS[look.hull] || []) tint(g, img['ship-hull'], colour, mode);
    if (look.sail === 'red') tint(g, img['ship-flag'], '#c23a30', 'screen');
    if (look.sail === 'swords') {
      // Calico Jack's flag: the skull stays, crossed cutlasses replace the bones.
      g.save(); g.translate(158, 48);
      g.fillStyle = '#18161b'; g.beginPath(); g.ellipse(0, 0, 21, 9, 0, 0, Math.PI * 2); g.fill();
      g.lineCap = 'round';
      for (const d of [1, -1]) {
        // a curved silver blade from the hilt at the bottom corner up across the flag
        g.strokeStyle = '#e4e8ee'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(-14 * d, 9); g.quadraticCurveTo(2 * d, 4, 24 * d, -12); g.stroke();
        g.strokeStyle = '#f2b532'; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(-21 * d, 13); g.lineTo(-15 * d, 9.5); g.stroke();          // grip
        g.beginPath(); g.moveTo(-17 * d, 4); g.lineTo(-12 * d, 15); g.stroke();             // guard
      }
      g.restore();
    }
    looks.set(key, c);
    return c;
  }

  art.drawShip = (ctx, s, x, y, t) => {
    if (s.inv > 0 && !s.dash && !(s.shieldT > 0) && Math.floor(t * 20) % 2) return;
    if (!art.spritesReady()) return;
    ctx.save();
    ctx.translate(x + s.w / 2, y + s.h / 2 + Math.sin(t * 2) * 0.6);
    ctx.rotate(s.tilt);
    // steam trail while dashing
    if (s.dash > 0) {
      for (let i = 0; i < 7; i++) ellipse(ctx, -26 - i * 7, 8 + Math.sin(t * 30 + i) * 2, 6 - i * 0.6, 5 - i * 0.5, `rgba(255,255,255,${0.8 - i * 0.1})`, 0);
    }
    const k = SHIP_K, px = -SHIP_BODY[0] * k, py = -SHIP_BODY[1] * k;
    ctx.drawImage(shipLook(s.look || {}), px, py, SHIP_PX[0] * k, SHIP_PX[1] * k);
    // the stern propeller's blur, turning
    const spin = Math.abs(Math.sin(t * 40));
    ctx.beginPath(); ctx.ellipse(px + SHIP_PROP[0] * k, py + SHIP_PROP[1] * k, 1.2, 6.5 * spin + 1.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,236,190,.28)'; ctx.fill();
    if (s.shieldT > 0) {                                // the steam shield: a shimmering bubble that fades
      const a = Math.min(1, s.shieldT / 0.5), g = ctx.createRadialGradient(0, 0, 10, 0, 0, 34);
      g.addColorStop(0, 'rgba(200,240,255,0)'); g.addColorStop(0.8, `rgba(170,225,255,${0.25 * a})`); g.addColorStop(1, `rgba(240,252,255,${0.7 * a})`);
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 26 + Math.sin(t * 12) * 0.8, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    }
    if (s.pet === 'parrot') {
      ctx.save(); ctx.translate(px + SHIP_BOWSPRIT[0] * k, py + SHIP_BOWSPRIT[1] * k - 2.4 + Math.sin(t * 5) * 0.4); ctx.scale(0.7, 0.7);
      art.drawParrot(ctx, 0, 0, t); ctx.restore();
    }
    ctx.restore();
  };

  art.drawParrot = (ctx, x, y, t) => {
    const frame = art.sprite(Math.sin(t * 12) > 0.6 ? 'parrot-2' : 'parrot-1');
    if (frame) { ctx.drawImage(frame, x - 5.6, y - 7.6, 12, 13); return; }
  };

  // ---------- the King's Aerial Navy ----------

  art.drawEnemy = (ctx, e, x, y, t) => {
    const flash = e.flash > 0;
    if (e.type === 'zeppelin') return art.drawZeppelin(ctx, x + e.w / 2, y + 12, t, { flash, fire: e.firing || 0 });
    if (e.type === 'mine') return art.drawMine(ctx, x + e.w / 2, y + 16, t);
    if (e.type === 'flak') return art.drawFlak(ctx, x, y, t, flash);
    if (e.type === 'pike') return art.drawPike(ctx, x, y, t, flash, e.tell);
    if (e.type === 'lurker') return e.hidden ? art.drawLurkerEyes(ctx, x, y, t) : art.drawLurker(ctx, x, y, t, flash);
    return art.drawGyro(ctx, e, x, y, t);
  };

  // Painted navy sprites (tools/paint_navy.py) face left; sizes and anchors in game units.
  // The navy is the user's painted art (assets/source/art, cut by tools/import_sheet.py), all facing
  // left. Size and anchor in game units: the anchor is the point drawn at the enemy's position.
  const GYRO = { w: 30, h: 23.8, ax: 11.4, ay: 14.3 }, ZEP = { w: 90, h: 42.2, ax: 36, ay: 13.9 }, MINE = { w: 17, h: 35.6, ax: 7.7, ay: 17 };
  const FLAK = { w: 46, h: 38.4, ax: 24.4, ay: 3.8 }, PIKE = { w: 38, h: 17.6, ax: 19, ay: 8.8 }, LURK = { w: 32, h: 28.3, ax: 16, ay: 18.4 };
  const CRATE = { w: 12, h: 19.1, ax: 6, ay: 15.3 }, CHEST = { w: 14, h: 13.4, ax: 7, ay: 6.7 };
  // Draw a painted sprite (or its white flash) with its anchor at x, y; `d` = { w, h, ax, ay }.
  const put = (ctx, k, d, x, y, flash = false) => {
    const im = flash ? art.flashed(k) : art.sprite(k);
    if (im) ctx.drawImage(im, x - d.ax, y - d.ay, d.w, d.h);
    return !!im;
  };
  // A shaded gun barrel from (0,0) along +x, `len` long, in the current transform.
  const barrel = (ctx, len, r) => {
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#a8acb8'); g.addColorStop(0.45, '#4a4c58'); g.addColorStop(1, '#16161c');
    ctx.beginPath(); ctx.roundRect(0, -r, len, r * 2, r * 0.4); ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.5);
  };
  // A ball of brass (a tentacle segment, a turret dome), lit from the upper left.
  const brassBall = (ctx, x, y, rx, ry = rx, flash = false) => {
    const g = ctx.createRadialGradient(x - rx * 0.4, y - ry * 0.45, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry));
    g.addColorStop(0, flash ? '#fff' : '#fff0b0'); g.addColorStop(0.4, flash ? '#fff' : '#d9a441'); g.addColorStop(1, flash ? '#ddd' : '#6a3e12');
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.6);
  };
  // A glowing eye or orb.
  const glow = (ctx, x, y, r, core, halo) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, core); g.addColorStop(0.55, halo); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  };

  art.drawGyro = (ctx, e, x, y, t) => {
    const cx = x + e.w / 2, cy = y + e.h / 2;
    put(ctx, 'navy-gyro', GYRO, cx, cy, e.flash > 0);
    rotorBlur(ctx, cx + 2.1, cy - 10.3, 13, t);
  };
  // A faint disc over the painted rotor, so it looks like it's turning.
  const rotorBlur = (ctx, x, y, r, t) => {
    ctx.beginPath(); ctx.ellipse(x, y, r * (0.75 + 0.25 * Math.abs(Math.cos(t * 30))), 1.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230,220,190,.28)'; ctx.fill();
  };

  // A navy zeppelin: long grey-blue envelope with a roundel, a gondola with a gun deck, twin
  // propellers. `fire` (0-1) flashes the gun ports.
  art.drawZeppelin = (ctx, x, y, t, { flash = false, fire = 0 } = {}) => {
    put(ctx, 'navy-zeppelin', ZEP, x, y, flash);
    if (fire > 0) for (const gx of [-3.6, 3.6, 10.8]) glow(ctx, x + gx, y + 20.7, 1.4, '#ffd34e', `rgba(255,140,40,${0.5 * fire})`);   // the gun deck firing
  };

  // A balloon mine: a striped balloon carrying a spiked sea mine with a blinking light.
  art.drawMine = (ctx, x, y, t) => {
    const by = y + Math.sin(t * 2 + x) * 2;
    put(ctx, 'navy-mine', MINE, x, by);
    if (Math.floor(t * 6) % 2) glow(ctx, x - MINE.ax + 0.87 * MINE.w, by - MINE.ay + 0.9 * MINE.h, 1, '#fff2a0', 'rgba(255,150,40,.6)');   // the fuse fizzing
  };

  // A cloud bank in the middle band: big enough to hide the Cloud Dancer in.
  // `area` is an area id (or true for the storm), for the cloud's tint.
  art.drawCloudBank = (ctx, x, y, w, t, alpha = 1, area = 'reef', ink = false, h = 44) => {
    const name = 'cloud-' + (1 + (Math.round(w * 7) % 4)), tint = ink ? '#4a3a5c' : CLOUD_TINT[area === true ? 'storm' : area];
    const storm = area === true || area === 'storm';
    const im = tint ? art.tinted(name, tint) : art.sprite(name);
    if (im) {
      // The painted cloud's body fills about 80% of its width and 70% of its height.
      const dw = w / 0.8, dh = Math.max(h / 0.7, dw * im.height / im.width * 0.75);
      ctx.globalAlpha = alpha; ctx.drawImage(im, x + w / 2 - dw / 2, y - dh * 0.48 + Math.sin(t * 0.8 + w) * 1, dw, dh); ctx.globalAlpha = 1;
      return;
    }
  };

  // A flak tower on a rocky islet far below: brass dome, gun pointing up.
  art.drawFlak = (ctx, x, y, t, flash) => {
    ctx.save(); ctx.translate(x + 9, y + 3); ctx.rotate(-Math.PI / 2 - 0.5 + Math.sin(t * 1.5) * 0.3); barrel(ctx, 12, 1.6); ctx.restore();
    put(ctx, 'navy-flak', FLAK, x + 9, y + 3, flash);
  };

  // A sky pike: an armoured flying fish of the storm. `tell` = about to dart (eye glows, fins flare).
  art.drawPike = (ctx, x, y, t, flash, tell) => {
    const cx = x + 11, cy = y + 5, wob = tell ? Math.sin(t * 60) * 0.6 : 0;   // it shivers before it darts
    put(ctx, 'navy-pike', PIKE, cx + wob, cy, flash);
    if (tell) glow(ctx, cx + wob - 10.3, cy - 0.5, 1.6, '#ff6a5a', 'rgba(255,40,40,.6)');
  };

  // A cloud lurker: a small navy pod with a periscope that hides in cloud banks.
  art.drawLurker = (ctx, x, y, t, flash) => {
    put(ctx, 'navy-lurker', LURK, x + 10, y + 7, flash);
  };
  // Only the periscope and a glint show above the cloud while it hides.
  art.drawLurkerEyes = (ctx, x, y, t) => {
    const im = art.sprite('navy-lurker');
    if (!im) return;
    // just the top of the periscope, cropped from the painted lurker, where it would be
    const k = im.width / LURK.w, sx = 11.5, sw = 5.2, sh = 6.4;
    ctx.drawImage(im, sx * k, 0, sw * k, sh * k, x + 10 - LURK.ax + sx, y + 7 - LURK.ay, sw, sh);
    if (Math.floor(t * 3) % 3 === 0) glow(ctx, x + 10 - LURK.ax + 13.8, y + 7 - LURK.ay + 2, 0.9, '#ffffff', 'rgba(220,240,255,.6)');
  };

  // Lightning: a flickering warning line, then a jagged bolt top to bottom.
  art.drawBolt = (ctx, b, t) => {
    if (b.warn > 0) {
      if (Math.floor(t * 16) % 2) return;
      ctx.fillStyle = 'rgba(255,240,140,.35)'; ctx.fillRect(b.x - 8, 0, 16, H());
      ctx.fillStyle = 'rgba(255,240,140,.9)'; ctx.fillRect(b.x - 0.5, 0, 1, H());
      return;
    }
    ctx.fillStyle = 'rgba(220,235,255,.22)'; ctx.fillRect(0, 0, W(), H());
    const path = [[b.x, 0]], seed = Math.floor(t * 30);
    for (let y = 10; y <= H(); y += 10) path.push([b.x + (((y * 7919 + seed * 31) % 15) - 7), y]);
    const stroke = (pts, w, col) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
    const branch = [path[6]]; for (let i = 1; i < 6; i++) branch.push([path[6][0] + i * 5 + ((i * 13 + seed) % 5) - 2, path[6][1] + i * 7]);
    ctx.lineJoin = 'round';
    for (const pts of [path, branch]) { stroke(pts, 10, 'rgba(150,200,255,.25)'); stroke(pts, 4.5, 'rgba(200,230,255,.8)'); stroke(pts, 1.6, '#ffffff'); }
  };

  // Cloud banks from the world (cover): drawn over the ship and lurkers so hiding looks like hiding.
  art.drawCloudBanks = (ctx, clouds, t, area) => {
    for (const c of clouds) art.drawCloudBank(ctx, c.x, c.y + c.h / 2, c.w, t, 0.9, area, c.ink, c.h);
  };

  art.drawShot = (ctx, b) => {
    if (b.harpoon || b.rocket) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy || 0, b.vx || 1));
      if (b.harpoon) {
        const sg = ctx.createLinearGradient(0, -1, 0, 1); sg.addColorStop(0, '#c08a52'); sg.addColorStop(1, '#5c3418');
        ctx.beginPath(); ctx.rect(-13, -0.9, 13, 1.8); ctx.fillStyle = sg; ctx.fill(); outline(ctx, 0.4);
        ctx.strokeStyle = 'rgba(230,220,190,.8)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-17, 2, -21, 0); ctx.stroke();
        const hg = ctx.createLinearGradient(0, -3, 0, 3); hg.addColorStop(0, '#f0f2f8'); hg.addColorStop(1, '#6a6e7c');
        ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(6, 0); ctx.lineTo(-1, 3); ctx.lineTo(1, 0); ctx.closePath(); ctx.fillStyle = hg; ctx.fill(); outline(ctx, 0.5);
        ctx.restore(); return;
      }
      // a rocket: brass tube, red nose, a flickering flame
      const fl = ctx.createRadialGradient(-8, 0, 0, -8, 0, 5);
      fl.addColorStop(0, '#fffbe0'); fl.addColorStop(0.4, '#ffb43c'); fl.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.beginPath(); ctx.ellipse(-8.5, 0, 4 + Math.random() * 1.5, 2.2, 0, 0, Math.PI * 2); ctx.fillStyle = fl; ctx.fill();
      const tg = ctx.createLinearGradient(0, -1.8, 0, 1.8); tg.addColorStop(0, '#ffe9a0'); tg.addColorStop(0.5, '#d9a441'); tg.addColorStop(1, '#6a3e12');
      ctx.beginPath(); ctx.rect(-6, -1.6, 9, 3.2); ctx.fillStyle = tg; ctx.fill(); outline(ctx, 0.4);
      ctx.beginPath(); ctx.moveTo(3, -1.6); ctx.lineTo(6.5, 0); ctx.lineTo(3, 1.6); ctx.closePath(); ctx.fillStyle = '#c8281e'; ctx.fill(); outline(ctx, 0.4);
      ctx.beginPath(); ctx.moveTo(-6, -1.6); ctx.lineTo(-8, -3.4); ctx.lineTo(-4, -1.6); ctx.moveTo(-6, 1.6); ctx.lineTo(-8, 3.4); ctx.lineTo(-4, 1.6); ctx.fillStyle = '#8a2a20'; ctx.fill();
      ctx.restore(); return;
    }
    const r = b.r + 0.4;
    if (b.friendly) {                                   // an iron cannonball, lit from the upper left
      const g = ctx.createRadialGradient(b.x - r * 0.4, b.y - r * 0.45, r * 0.1, b.x, b.y, r);
      g.addColorStop(0, '#d4d4de'); g.addColorStop(0.35, '#5a5a66'); g.addColorStop(1, '#141418');
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.5);
      return;
    }
    // the navy's shot: a glowing ember with a halo
    const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r + 3);
    halo.addColorStop(0, 'rgba(255,150,60,.55)'); halo.addColorStop(1, 'rgba(255,70,30,0)');
    ctx.beginPath(); ctx.arc(b.x, b.y, r + 3, 0, 7); ctx.fillStyle = halo; ctx.fill();
    const core = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, 0, b.x, b.y, r);
    core.addColorStop(0, '#fffbe0'); core.addColorStop(0.45, '#ffb43c'); core.addColorStop(1, '#c8281e');
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fillStyle = core; ctx.fill();
    ctx.lineWidth = 0.5; ctx.strokeStyle = '#5a1008'; ctx.stroke();
  };

  const GUN_LETTER = { chain: 'C', harpoon: 'H', rockets: 'R', gatling: 'G' };
  // The wingman: a pirate gyrocopter (the navy's, repainted rust-red) facing the way you fly.
  art.drawWingman = (ctx, wg, t) => {
    const im = art.tinted('navy-gyro', '#b8452e', 'color');
    if (!im) return;
    ctx.save(); ctx.translate(wg.x + 8, wg.y + 7); ctx.scale(-0.8, 0.8);
    ctx.drawImage(im, -GYRO.ax, -GYRO.ay, GYRO.w, GYRO.h);
    rotorBlur(ctx, 2.1, -10.3, 13, t);
    ctx.restore();
    ctx.fillStyle = '#16141a'; ctx.beginPath(); ctx.moveTo(wg.x + 6, wg.y - 6); ctx.lineTo(wg.x + 12, wg.y - 4); ctx.lineTo(wg.x + 6, wg.y - 2); ctx.fill();   // a little black flag
  };

  art.drawPickup = (ctx, k, t) => {
    if (k.type === 'chest') {                           // a treasure chest, gold glinting
      const y = k.y + 5 + Math.sin(t * 4) * 1;
      put(ctx, 'chest', CHEST, k.x + 5, y);
      if ((t * 1.5 + k.x * 0.05) % 1 < 0.15) glow(ctx, k.x + 7, y - 4, 0.9, '#fffbe8', 'rgba(255,230,140,.6)');
      return;
    }
    if (k.type === 'weapon') {                          // a gun crate on a parachute, its gun's letter on the side
      const bob = Math.sin(t * 4) * 1.5;
      put(ctx, 'crate', CRATE, k.x + 5, k.y + 5 + bob);
      art.text(ctx, GUN_LETTER[k.gun] || '?', k.x + 5, k.y + 5.6 + bob, { size: 5.5, color: '#ffd34e', align: 'center' });
      return;
    }
    if (k.type === 'coal') {        // a little sack of coal
      const sg = ctx.createLinearGradient(k.x, k.y, k.x + 10, k.y + 10); sg.addColorStop(0, '#c8a878'); sg.addColorStop(1, '#6a4a2a');
      ctx.beginPath(); ctx.moveTo(k.x + 1, k.y + 10); ctx.quadraticCurveTo(k.x - 1, k.y + 4, k.x + 3, k.y + 3); ctx.lineTo(k.x + 7, k.y + 3); ctx.quadraticCurveTo(k.x + 11, k.y + 4, k.x + 9, k.y + 10); ctx.closePath();
      ctx.fillStyle = sg; ctx.fill(); outline(ctx, 0.6);
      for (const [dx, dy, r] of [[3.2, 2.6, 1.8], [5.6, 1.6, 2], [7.4, 2.8, 1.6]]) {
        const cg = ctx.createRadialGradient(k.x + dx - 0.6, k.y + dy - 0.6, 0.1, k.x + dx, k.y + dy, r);
        cg.addColorStop(0, '#8a8a96'); cg.addColorStop(1, '#141418');
        ctx.beginPath(); ctx.arc(k.x + dx, k.y + dy, r, 0, 7); ctx.fillStyle = cg; ctx.fill(); outline(ctx, 0.4);
      }
      return;
    }
    if (k.type === 'repair') {      // a steel spanner with a red grip
      ctx.save(); ctx.translate(k.x + 5, k.y + 5); ctx.rotate(-0.7 + Math.sin(t * 3) * 0.2);
      const mg = ctx.createLinearGradient(-1.5, 0, 1.5, 0); mg.addColorStop(0, '#f0f2f8'); mg.addColorStop(1, '#6a6e7c');
      ctx.beginPath(); ctx.rect(-1.2, -3, 2.4, 8.4); ctx.fillStyle = mg; ctx.fill(); outline(ctx, 0.5);
      ctx.beginPath(); ctx.arc(0, -5, 3.1, 0.35 * Math.PI, 2.65 * Math.PI); ctx.lineTo(0, -5); ctx.closePath(); ctx.fillStyle = mg; ctx.fill(); outline(ctx, 0.5);
      const rg = ctx.createLinearGradient(-1.5, 0, 1.5, 0); rg.addColorStop(0, '#ff8a7a'); rg.addColorStop(1, '#8a1a14');
      ctx.beginPath(); ctx.rect(-1.4, 1.4, 2.8, 4.4); ctx.fillStyle = rg; ctx.fill(); outline(ctx, 0.5);
      ctx.restore(); return;
    }
    // a gold doubloon, spinning (squeezed sideways), with a glint now and then
    const sq = Math.abs(Math.cos(t * 5 + k.x * 0.1)), cx = k.x + 4, cy = k.y + 4, im = art.sprite('coin');
    if (im) ctx.drawImage(im, cx - 4.5 * sq, cy - 4.5, Math.max(0.8, 9 * sq), 9);
    if ((t * 1.3 + k.x * 0.07) % 1 < 0.12) glow(ctx, cx + 1.6, cy - 2.8, 0.8, '#fffbe8', 'rgba(255,240,180,.6)');
  };

  art.drawFx = (ctx, f) => {
    if (f.type !== 'boom' || f.t > 0.45) return;          // longer timers are a delay (a boss going down in stages)
    const k = 1 - f.t / 0.45, r = f.r * (0.5 + k * 0.7);
    // smoke puffs rolling outward and up, soft-edged
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + f.r, d = r * (0.5 + k * 0.7), px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d * 0.8 - k * 8, pr = f.r * (0.25 + k * 0.35);
      const sg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
      sg.addColorStop(0, `rgba(150,140,140,${0.75 * (1 - k)})`); sg.addColorStop(1, 'rgba(70,64,70,0)');
      ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fillStyle = sg; ctx.fill();
    }
    // the fireball: white-hot core, yellow, orange, a red fringe fading out
    const fa = Math.max(0, 1 - k * 1.15);
    const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    fg.addColorStop(0, `rgba(255,255,240,${fa})`); fg.addColorStop(0.3, `rgba(255,214,90,${fa})`);
    fg.addColorStop(0.7, `rgba(255,120,40,${fa * 0.9})`); fg.addColorStop(1, 'rgba(200,40,20,0)');
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fillStyle = fg; ctx.fill();
    // sparks flying out
    if (k < 0.7) {
      ctx.strokeStyle = `rgba(255,220,120,${1 - k})`; ctx.lineWidth = 0.8;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + f.r * 0.3, d0 = r * 0.6 + k * f.r, d1 = d0 + 3;
        ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * d0, f.y + Math.sin(a) * d0); ctx.lineTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1); ctx.stroke();
      }
    }
  };

  // ---------- bosses ----------

  // The painted bosses (tools/paint_navy.py): a still body, with the moving parts drawn here.
  const BOSS = {
    thunderer: { w: 150, h: 71.1, ax: 75, ay: 33.4 }, tempest: { w: 50, h: 83.9, ax: 25, ay: 46 },
    fort: { w: 122, h: 93.1, ax: 0, ay: 0 }, kraken: { w: 58, h: 73.8, ax: 29, ay: 36.9 },
  };
  function paintedBoss(ctx, b, x, y, t, f) {
    const d = BOSS[b.id], k = 'boss-' + b.id;
    if (b.id === 'thunderer') {
      const cx = x + 60, cy = y + 18;
      put(ctx, k, d, cx, cy, f);
      if (b.state === 'act' && b.attack === 'broadside') {      // both gun decks firing
        for (const gx of [-25.5, -16.5, -7.5, 12, 21, 30]) glow(ctx, cx + gx, cy + 30.6, 1.7, '#ffd34e', 'rgba(255,140,40,.55)');
      }
    } else if (b.id === 'tempest') {
      const cx = x + b.w / 2, cy = y + b.h / 2;
      art.drawCloudBank(ctx, x - 10, cy + 34, b.w + 20, t, 0.95, true);
      put(ctx, k, d, cx, cy, f);
      const oy = cy - 36;
      glow(ctx, cx, oy, 5 + Math.sin(t * 20) * 0.7, b.tell ? '#fff6a0' : '#bfefff', b.tell ? 'rgba(255,220,90,.55)' : 'rgba(120,200,255,.45)');
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {                       // crackling arcs from the orb
        const a = t * 9 + i * 2.1; ctx.beginPath(); ctx.moveTo(cx, oy);
        for (let n = 1; n <= 4; n++) ctx.lineTo(cx + Math.cos(a) * n * 6 + ((n * 7 + Math.floor(t * 20)) % 5) - 2, oy + Math.sin(a) * n * 6);
        ctx.strokeStyle = 'rgba(150,210,255,.35)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = 'rgba(235,250,255,.95)'; ctx.lineWidth = 0.9; ctx.stroke();
      }
    } else if (b.id === 'fort') {
      put(ctx, k, d, x - 6, y - 4, f);
      for (const [tx, ty] of CD.BOSSES.fort.turrets) {   // a gun barrel from each painted dome
        ctx.save(); ctx.translate(x + tx, y + ty + 2); ctx.rotate(Math.PI + 0.3 + Math.sin(t + tx) * 0.2); barrel(ctx, 11, 1.6); ctx.restore();
      }
    } else if (b.id === 'kraken') {
      const cx = x + b.w / 2 + 6, cy = y + 30;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {                       // eight clockwork tentacles: tapered brass tubes with dark rings
        const x0 = cx - 24 + i * 6.9, out = (i - 3.5) * 0.9, pts = [];
        for (let n = 0; n <= 7; n++) pts.push([x0 + out * n + Math.sin(t * 3 + i * 0.9 + n * 0.6) * n * 0.9, cy + 22 + n * 6]);
        const pass = (extra, col, dx = 0) => {
          for (let n = 0; n < 7; n++) {
            ctx.beginPath(); ctx.moveTo(pts[n][0] + dx, pts[n][1]); ctx.lineTo(pts[n + 1][0] + dx, pts[n + 1][1]);
            ctx.lineWidth = Math.max(0.6, 5.2 - n * 0.6 + extra); ctx.strokeStyle = col; ctx.stroke();
          }
        };
        pass(1.4, INK); pass(0, f ? '#fff' : '#c08a30'); pass(-3.2, f ? '#fff' : 'rgba(255,236,170,.75)', -0.7);
        if (!f) for (let n = 1; n < 7; n += 1) {
          const r = Math.max(0.8, 5.2 - n * 0.6) / 2 + 0.3;
          ctx.beginPath(); ctx.ellipse(pts[n][0], pts[n][1], r, r * 0.45, 0, 0, Math.PI * 2); ctx.fillStyle = n % 2 ? '#6a3e12' : '#e8b860'; ctx.fill();
        }
      }
      ctx.lineCap = 'butt';
      put(ctx, k, d, cx, cy - 4, f);
      for (const [ex, ey, r] of [[-9.9, 1.5, 3.4], [4.9, 2.6, 2.6]]) glow(ctx, cx + ex, cy - 4 + ey, r, b.tell ? '#ff6a5a' : '#bff4ff', b.tell ? 'rgba(255,40,40,.6)' : 'rgba(120,220,255,.35)');
    }
  }

  art.drawBoss = (ctx, b, x, y, t) => {
    ctx.save();
    if (b.tell && Math.floor(t * 12) % 2) { ctx.shadowColor = '#ffd34e'; ctx.shadowBlur = 10; }
    const f = b.flash > 0 && Math.floor(b.t * 24) % 2 === 0;   // flicker, so steady fire doesn't bleach it
    paintedBoss(ctx, b, x, y, t, f);
    ctx.restore();
  };

  // Tentacle rows from the Kraken: a warning band, then a brass tentacle sweeping across.
  art.drawHazard = (ctx, h, t) => {
    if (h.warn > 0) {
      if (Math.floor(t * 14) % 2) return;
      ctx.fillStyle = 'rgba(255,90,90,.22)'; ctx.fillRect(0, h.y, W(), h.h);
      ctx.fillStyle = 'rgba(255,90,90,.8)'; ctx.fillRect(0, h.y, W(), 1); ctx.fillRect(0, h.y + h.h - 1, W(), 1);
      return;
    }
    const k = 1 - h.active / 0.5, x0 = W() + 20 - k * (W() + 60), cy = h.y + h.h / 2;
    // a sweeping brass tentacle, segment by segment
    for (let x = x0, i = 0; x < W() + 30; x += 6, i++) brassBall(ctx, x, cy + Math.sin(x * 0.08 + t * 20) * 4, Math.min(7.5, 3.5 + i * 0.35));
  };

  // The boss's name and health along the bottom.
  art.drawBossBar = (ctx, b) => {
    const w = 200, x = (W() - w) / 2, y = H() - 13;
    art.text(ctx, b.name, W() / 2, y - 7, { size: 8, color: '#ffd34e', align: 'center' });
    ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#4a1018'; ctx.fillRect(x, y, w, 5);
    const k = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = k < 0.5 ? '#ff9a3c' : '#e04848'; ctx.fillRect(x, y, w * k, 5);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w * k, 1);
  };

  // ---------- menus ----------

  const panel = (ctx, x, y, w, h) => {
    ctx.fillStyle = 'rgba(42,26,18,.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = BRASS; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(217,164,65,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 4); ctx.stroke();
    for (const [rx, ry] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) ellipse(ctx, rx, ry, 1.6, 1.6, BRASS, 0.5);
  };
  art.button = (ctx, b, label, on = true) => {
    ctx.fillStyle = on ? BRASS : '#6a5a48'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill(); outline(ctx, 1.2);
    art.text(ctx, label, b.x + b.w / 2, b.y + b.h / 2 + 0.5, { size: 7, color: '#fff', align: 'center' });
  };

  art.drawHangar = (ctx, h, profile, t) => {
    const L = CD.HLAYOUT;
    const g = ctx.createLinearGradient(0, 0, 0, H()); g.addColorStop(0, '#3a2a20'); g.addColorStop(1, '#1a120c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W(), H());
    ctx.strokeStyle = 'rgba(217,164,65,.12)'; ctx.lineWidth = 1;
    for (let x = 0; x < W(); x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H()); ctx.stroke(); }
    // the airship in its new colours, on a mooring
    const preview = CD.applyLoadout({ ...CD.makeShip(), tilt: Math.sin(t) * 0.04, inv: 0 }, h.view);
    ctx.save(); ctx.translate(24, 62); ctx.scale(2.4, 2.4); art.drawShip(ctx, preview, 0, Math.sin(t * 1.4) * 1.5, t); ctx.restore();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(70, 118); ctx.lineTo(70, 200); ctx.stroke();
    art.text(ctx, 'THE HANGAR', W() / 2 + 60, 16, { size: 13, color: '#ffd34e', align: 'center' });
    art.text(ctx, `${profile.gold} GOLD`, W() - 8, 27, { size: 8, color: '#ffd34e', align: 'right' });
    panel(ctx, L.labelX - 10, L.top - 10, W() - L.labelX + 4, CD.CATALOG.length * L.step + 12);
    CD.CATALOG.forEach((r, i) => {
      const y = L.top + i * L.step, sel = i === h.row, o = r.options.find(o => o.id === h.view[r.key]), own = CD.owns(profile, r.key, o.id);
      if (sel) { ctx.fillStyle = 'rgba(217,164,65,.22)'; ctx.fillRect(L.labelX - 6, y - 6, W() - L.labelX - 4, 12); }
      art.text(ctx, r.label, L.labelX, y, { size: 7, color: sel ? '#ffd34e' : '#d9c4a0' });
      art.text(ctx, (sel ? '< ' : '') + o.name + (sel ? ' >' : ''), L.valueX, y, { size: 7, color: own ? '#ffffff' : '#a8a0b0', align: 'center' });
      if (!own) art.text(ctx, o.price + 'G', L.priceX, y, { size: 7, color: profile.gold >= o.price ? '#7cfc7c' : '#ff8a7a', align: 'right' });
      else if (profile.equip[r.key] === o.id) art.text(ctx, '✓', L.priceX, y, { size: 7, color: '#7cfc7c', align: 'right' });
    });
    const sel = CD.CATALOG[h.row], o = sel.options.find(o => o.id === h.view[sel.key]);
    const note = h.msgT > 0 ? h.msg : o.note || (CD.owns(profile, sel.key, o.id) ? '' : `BUY FOR ${o.price} GOLD`);
    if (note) art.text(ctx, note, W() / 2 + 60, 188, { size: 7, color: h.msgT > 0 ? '#ffd34e' : '#cfe8ff', align: 'center' });
    if (document.documentElement.classList.contains('touch')) { art.button(ctx, L.buy, 'BUY', !CD.owns(profile, sel.key, o.id)); art.button(ctx, L.done, 'DONE'); }
    else art.text(ctx, padMode() ? 'D-PAD: CHOOSE   A / OK: BUY   B / BACK: DONE' : 'ARROWS: CHOOSE   SPACE: BUY   ENTER: DONE', W() / 2 + 60, 204, { size: 6.5, color: '#d9c4a0', align: 'center' });
  };

  art.drawMarket = (ctx, m, w, s, t, touch) => {
    const L = CD.MLAYOUT;
    ctx.fillStyle = 'rgba(16,24,48,.6)'; ctx.fillRect(0, 0, W(), H());
    panel(ctx, 40, 14, W() - 80, H() - 28);
    art.text(ctx, 'THE SKY MARKET', W() / 2, 28, { size: 13, color: '#ffd34e', align: 'center' });
    art.text(ctx, `HEARTS ${s.hearts}/${s.maxHearts}   LIVES ${s.lives}`, 54, 42, { size: 7, color: '#ffb0a8' });
    art.text(ctx, `${w.gold} GOLD`, W() - 54, 42, { size: 7, color: '#ffd34e', align: 'right' });
    m.rows().forEach((it, i) => {
      const col = i >= L.per ? 1 : 0, x0 = col ? L.col : 54, x1 = col ? W() - 54 : L.col - 14;
      const y = L.top + (i % L.per) * L.step, sel = i === m.row;
      if (sel) { ctx.fillStyle = 'rgba(217,164,65,.22)'; ctx.fillRect(x0 - 6, y - 6, x1 - x0 + 12, 12); }
      const name = it.id === 'gun' ? `GUN: ${sel ? '< ' : ''}${CD.WEAPONS[m.gun()].name}${sel ? ' >' : ''}` : it.name;
      art.text(ctx, (sel ? '> ' : '') + name, x0, y, { size: 6.5, color: sel ? '#ffd34e' : '#f1e6cc' });
      if (it.id !== 'leave') { const c = m.price(it.id); art.text(ctx, c + 'G', x1, y, { size: 6.5, color: w.gold >= c ? '#7cfc7c' : '#ff8a7a', align: 'right' }); }
    });
    const cur = m.current();
    art.text(ctx, m.msgT > 0 ? m.msg : cur.note, W() / 2, touch ? 184 : 188, { size: 7, color: m.msgT > 0 ? '#ffd34e' : '#cfe8ff', align: 'center' });
    if (touch) { art.button(ctx, L.buy, 'BUY'); art.button(ctx, L.sail, 'CAST OFF'); }
    else art.text(ctx, padMode() ? 'D-PAD: CHOOSE   A / OK: BUY   B / BACK: CAST OFF' : 'ARROWS: CHOOSE   SPACE: BUY   ENTER: CAST OFF', W() / 2, 200, { size: 6.5, color: '#d9c4a0', align: 'center' });
  };

  // ---------- HUD ----------

  const heart = (ctx, x, y, full) => {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 7); ctx.bezierCurveTo(x - 2, y + 3, x + 1, y - 1, x + 4, y + 2);
    ctx.bezierCurveTo(x + 7, y - 1, x + 10, y + 3, x + 4, y + 7);
    ctx.fillStyle = full ? '#e04848' : '#4a3b45'; ctx.fill(); outline(ctx, 0.8);
  };

  art.text = (ctx, s, x, y, { size = 9, color = '#fff', align = 'left', weight = 800 } = {}) => {
    ctx.font = `${weight} ${size}px "Trebuchet MS", "Verdana", system-ui, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size / 4); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
  };

  art.drawHud = (ctx, s, w, best, inset = { l: 0, r: 0 }) => {
    const L = 6 + inset.l, R = W() - 6 - inset.r;
    for (let i = 0; i < (s.maxHearts || CD.MAX_HEARTS); i++) heart(ctx, L + i * 10, 5, i < s.hearts);
    art.text(ctx, `LIVES ${s.lives}`, L, 21, { size: 7 });
    // steam gauge
    const gx = L + Math.max(36, (s.maxHearts || 6) * 10 - 24), gy = 18, gw = 46;
    ctx.fillStyle = INK; ctx.fillRect(gx - 1, gy - 1, gw + 2, 6);
    ctx.fillStyle = '#4a3b45'; ctx.fillRect(gx, gy, gw, 4);
    ctx.fillStyle = s.steam >= CD.DASH_COST ? '#e8f4ff' : '#8aa0b4'; ctx.fillRect(gx, gy, gw * s.steam / (s.steamMax || CD.STEAM_MAX), 4);
    ctx.fillStyle = '#ffd34e'; ctx.fillRect(gx + gw * CD.DASH_COST / (s.steamMax || CD.STEAM_MAX), gy - 1, 1, 6);
    art.text(ctx, 'STEAM', gx + gw + 4, 20, { size: 6, color: '#cfe8ff' });
    const gun = CD.WEAPONS ? CD.WEAPONS[s.weapon || 'cannon'] : null;
    if (gun) art.text(ctx, s.weaponT > 0 && s.weapon !== 'cannon' ? (s.gunRack ? gun.name : `${gun.name} ${Math.ceil(s.weaponT)}`) : gun.name, L, 31, { size: 6.5, color: s.weaponT > 0 && s.weapon !== 'cannon' ? '#ffd34e' : '#cfe8ff' });
    art.text(ctx, String(w.score).padStart(6, '0'), R, 9, { size: 9, align: 'right' });
    art.text(ctx, `GOLD ${w.gold}`, R, 20, { size: 7, align: 'right', color: '#ffd34e' });
    if (best) art.text(ctx, `BEST ${best}`, R, 30, { size: 6, align: 'right', color: '#cfe8ff' });
  };
})();
