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
    const over = 1 / Math.max(1, ctx.getTransform().a);   // copies overlap a pixel: no line where they meet
    for (let x = wrap(offset, tw) - tw; x < W(); x += tw) ctx.drawImage(im, x - over, 0, tw + 2 * over, th);
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
  const CLOUD_TINT = { storm: '#9ea8ba', forts: '#ffd4bf', ceiling: '#e2e8ff', night: '#56608a', frost: '#f2f9ff', ash: '#8a7670', thunder: '#7a8298', citadel: '#f0c4d4' };
  // The five newer skies are the four painted ones, colour-graded (a multiply over the scenery) and
  // dressed with code-drawn weather: `base` painted sky, `grade` colour.
  const LOOKS = {
    night: { base: 'reef', grade: '#2c3868' },
    frost: { base: 'ceiling', grade: '#d6ebff' },
    ash: { base: 'storm', grade: '#d27c52' },
    thunder: { base: 'storm', grade: '#767e9c' },
    citadel: { base: 'forts', grade: '#e2b2cc' },
  };
  const baseOf = area => (LOOKS[area] ? LOOKS[area].base : area);
  const painted = area => { const b = baseOf(area); return art.sprite('sky-' + b) && art.sprite('far-' + b) && art.sprite('band-' + b) && art.sprite('cloud-4'); };
  // A cheap repeatable "random" for scenery dots: the same every frame.
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  art.drawSky = (ctx, dist, t, area = 'reef') => {
    if (painted(area)) {
      const b = baseOf(area);
      ctx.drawImage(art.sprite('sky-' + b), 0, 0, W(), H());
      if (area === 'night') nightSky(ctx, t);
      for (let i = 0; i < 4; i++) cumulus(ctx, i + 2, wrap(i * 150 + 40 - dist * 0.12, 600, 60), 22 + (i % 2) * 20, 46, 0.75, b);   // high, small
      if (area === 'citadel') farCitadel(ctx, dist, t);
      if (art.sprite('isles-' + b)) tileX(ctx, art.sprite('isles-' + b), -dist * 0.1);
      if (area === 'ash') volcano(ctx, dist, t);
      tileX(ctx, art.sprite('band-' + b), -dist * 0.05);
      tileX(ctx, art.sprite('far-' + b), -dist * 0.08);
      for (let i = 0; i < 5; i++) cumulus(ctx, i, wrap(i * 120 - dist * 0.3, 600, 70), 112 + (i % 2) * 12, 74 + (i % 3) * 12, 0.95, b);   // behind the ship
      if (LOOKS[area]) grade(ctx, area, dist, t);
      return;
    }
  };

  // The grade over the scenery, then what each graded sky adds on top of it.
  function grade(ctx, area, dist, t) {
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = LOOKS[area].grade; ctx.fillRect(0, 0, W(), H());
    ctx.globalCompositeOperation = 'source-over';
    if (area === 'night') {
      // stars (above the scenery), the moon, and far-off searchlights sweeping up from the sea
      for (let i = 0; i < 46; i++) {
        const x = hash(i) * W(), y = hash(i + 99) * 70, tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i + 7) * 3) + i);
        ctx.fillStyle = `rgba(255,250,230,${0.35 + 0.55 * tw})`; ctx.fillRect(x, y, 0.9, 0.9);
      }
      glow(ctx, 318, 34, 7, '#fff8dc', 'rgba(200,220,255,.25)');
      ellipse(ctx, 318, 34, 9, 9, '#f6f0d6', 0);
      ellipse(ctx, 315, 31, 2, 1.6, 'rgba(180,170,140,.5)', 0); ellipse(ctx, 321, 37, 1.4, 1.2, 'rgba(180,170,140,.5)', 0);
      for (let i = 0; i < 3; i++) {
        const x0 = wrap(i * 160 + 60 - dist * 0.08, 480, 50), a = -Math.PI / 2 + Math.sin(t * 0.4 + i * 2) * 0.5;
        beam(ctx, x0, H(), a, 260, 0.07, 'rgba(255,248,210,.10)');
      }
    } else if (area === 'frost') {
      const g = ctx.createLinearGradient(0, 120, 0, H()); g.addColorStop(0, 'rgba(240,248,255,0)'); g.addColorStop(1, 'rgba(240,248,255,.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 120, W(), H() - 120);
      for (let i = 0; i < 14; i++) {                    // ice crystals glinting in the thin air
        if (Math.sin(t * 2 + i * 1.7) < 0.85) continue;
        glow(ctx, wrap(hash(i) * 600 - dist * 0.2, 420, 20), 20 + hash(i + 3) * 120, 0.8, '#ffffff', 'rgba(200,230,255,.6)');
      }
    } else if (area === 'ash') {
      const g = ctx.createLinearGradient(0, 140, 0, H()); g.addColorStop(0, 'rgba(255,90,30,0)'); g.addColorStop(1, 'rgba(255,90,30,.4)');
      ctx.fillStyle = g; ctx.fillRect(0, 140, W(), H() - 140);
    } else if (area === 'thunder') {
      const k = (t * 0.37) % 1;                         // sheet lightning in the far clouds now and then
      if (k < 0.06 && Math.floor(t * 0.37) % 3 === 0) { ctx.fillStyle = `rgba(220,230,255,${0.18 * (1 - k / 0.06)})`; ctx.fillRect(0, 0, W(), H()); }
    } else if (area === 'citadel') {
      for (let i = 0; i < 6; i++) {                     // flak bursting far off over the citadel
        const c = (t * 0.6 + hash(i) * 3) % 3;
        if (c > 0.7) continue;
        const x = wrap(hash(i + 5) * 500 - dist * 0.1, 440, 30), y = 20 + hash(i + 9) * 60;
        ellipse(ctx, x, y, 2 + c * 6, 2 + c * 5, `rgba(70,56,70,${0.45 * (1 - c / 0.7)})`, 0);
        if (c < 0.1) glow(ctx, x, y, 1.6, '#ffd34e', 'rgba(255,140,40,.4)');
      }
    }
  }
  function nightSky(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, 'rgba(8,10,30,.35)'); g.addColorStop(1, 'rgba(8,10,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W(), 90);
  }
  // A searchlight beam: a soft cone from (x, y) at angle `a`.
  function beam(ctx, x, y, a, len, half, colour) {
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.addColorStop(0, colour); g.addColorStop(1, 'rgba(255,248,210,0)');
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - half) * len, y + Math.sin(a - half) * len);
    ctx.lineTo(x + Math.cos(a + half) * len, y + Math.sin(a + half) * len);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  }
  // The volcano far below the Ash Clouds: a dark cone with a glowing crater and a smoke plume.
  function volcano(ctx, dist, t) {
    const x = wrap(260 - dist * 0.09, 640, 120), y = 150;
    ctx.beginPath(); ctx.moveTo(x - 90, H()); ctx.lineTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.lineTo(x + 90, H()); ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, H()); g.addColorStop(0, '#5a3a32'); g.addColorStop(1, '#2a1a18');
    ctx.fillStyle = g; ctx.fill();
    glow(ctx, x, y + 1, 6 + Math.sin(t * 3) * 0.8, '#ffd27a', 'rgba(255,90,30,.5)');
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.25 + i / 5) % 1), r = 6 + k * 18;
      ellipse(ctx, x + k * 30 + Math.sin(t + i) * 3, y - 8 - k * 70, r, r * 0.8, `rgba(70,56,54,${0.5 * (1 - k)})`, 0);
    }
  }
  // The Sky Citadel on the horizon: the painted fort, small and dark, its windows lit.
  function farCitadel(ctx, dist, t) {
    const im = art.tinted('boss-fort', '#4a3452');
    if (!im) return;
    for (let i = 0; i < 2; i++) {
      const x = wrap(i * 260 + 80 - dist * 0.04, 520, 90), y = 52 + i * 10, w = 70 - i * 14;
      ctx.globalAlpha = 0.85; ctx.drawImage(im, x, y, w, w * 93.1 / 122); ctx.globalAlpha = 1;
      if (Math.sin(t * 1.3 + i) > 0) glow(ctx, x + w * 0.45, y + w * 0.35, 0.8, '#ffe9a0', 'rgba(255,200,90,.4)');
    }
  }

  // Near clouds drift in front of everything; each stage's weather is drawn with them.
  art.drawNearClouds = (ctx, dist, area = 'reef', t = 0) => {
    if (painted(area)) {
      for (let i = 0; i < 2; i++) cumulus(ctx, i + 1, wrap(i * 300 + 120 - dist * 0.9, 700, 90), 160 + i * 40, 150, 0.8, area);
      if (area === 'storm' || area === 'thunder') {        // rain, slanting, in front of everything (heavier in the Thunderhead)
        const n = area === 'thunder' ? 110 : 70, slant = area === 'thunder' ? 6 : 3;
        ctx.strokeStyle = area === 'thunder' ? 'rgba(190,204,226,.4)' : 'rgba(200,214,232,.35)'; ctx.lineWidth = 0.6; ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const rx = wrap(i * 53 - dist * 1.4 - t * 20 * (1 + (i % 3) * 0.2), W() + 40, 20), ry = wrap(i * 37 + t * 250, H() + 20, 10);
          ctx.moveTo(rx, ry); ctx.lineTo(rx - slant, ry + 9);
        }
        ctx.stroke();
      } else if (area === 'frost') {                       // snow, drifting
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        for (let i = 0; i < 60; i++) {
          const x = wrap(i * 47 - dist * 0.8 - t * 18 + Math.sin(t + i) * 6, W() + 20, 10), y = wrap(i * 29 + t * (30 + (i % 4) * 8), H() + 10, 5), r = 0.6 + (i % 3) * 0.35;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
      } else if (area === 'ash') {                         // ash falling, embers rising
        ctx.fillStyle = 'rgba(90,80,80,.55)';
        for (let i = 0; i < 50; i++) { const x = wrap(i * 61 - dist * 0.7 - t * 10, W() + 20, 10), y = wrap(i * 23 + t * 22, H() + 10, 5); ctx.fillRect(x, y, 1.2, 1.2); }
        for (let i = 0; i < 18; i++) {
          const x = wrap(i * 71 - dist * 0.5 + Math.sin(t * 2 + i) * 5, W() + 20, 10), y = wrap(H() - (i * 37 + t * 40), H() + 10, 5);
          glow(ctx, x, y, 0.6, '#ffd27a', 'rgba(255,110,40,.5)');
        }
      } else if (area === 'citadel') {                     // gun smoke drifting past
        for (let i = 0; i < 4; i++) {
          const x = wrap(i * 140 - dist * 1.1, W() + 120, 60), y = 30 + (i % 3) * 60;
          ellipse(ctx, x, y, 30, 9, 'rgba(90,76,90,.16)', 0);
        }
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
    if (e.type === 'picket') return art.drawPicket(ctx, e, x, y, t, flash);
    if (e.type === 'icemine') return art.drawIceMine(ctx, x + e.w / 2, y + 16, t, flash);
    if (e.type === 'bomber') return art.drawBomber(ctx, e, x, y, t, flash);
    if (e.type === 'rod') return art.drawRod(ctx, e, x, y, t, flash);
    if (e.type === 'ceilflak') return art.drawCeilFlak(ctx, x, y, t, flash);
    if (e.type === 'payship') return art.drawPayship(ctx, e, x, y, t, flash);
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

  // ---- the newer skies' navy: the painted sprites re-coloured, re-sized and fitted out in code ----
  // A sprite tinted (multiply), or its white flash, drawn with its top-left at x0, y0, scaled by k.
  const paint = (ctx, k, d, x0, y0, scale, tint, flash) => {
    const im = flash ? art.flashed(k) : tint ? art.tinted(k, tint) : art.sprite(k);
    if (im) ctx.drawImage(im, x0, y0, d.w * scale, d.h * scale);
    return !!im;
  };
  // The Midnight Picket's searchlight zeppelin: a darkened, smaller navy zeppelin with a lamp.
  art.drawPicket = (ctx, e, x, y, t, flash) => {
    if (e.beam !== undefined) {
      const [lx, ly] = CD.lampOf({ ...e, x, y });
      beam(ctx, lx, ly, e.beam, CD.BEAM_LEN, CD.BEAM_HALF, e.lit ? 'rgba(255,246,200,.42)' : 'rgba(255,246,200,.24)');
    }
    paint(ctx, 'navy-zeppelin', ZEP, x - 1, y - 2, 0.68, '#6a76a2', flash);
    const [lx, ly] = CD.lampOf({ ...e, x, y });
    ellipse(ctx, lx, ly - 1, 2.6, 2, '#3a3a44', 0.5);
    glow(ctx, lx, ly, 1.8, '#fff8d0', e.lit ? 'rgba(255,240,150,.8)' : 'rgba(255,240,150,.5)');
  };
  // An ice mine: the balloon mine frosted over, icicles hanging off it.
  art.drawIceMine = (ctx, x, y, t, flash) => {
    const by = y + Math.sin(t * 2 + x) * 2;
    paint(ctx, 'navy-mine', MINE, x - MINE.ax, by - MINE.ay, 1, '#bfe4ff', flash);
    ctx.fillStyle = 'rgba(235,248,255,.9)';
    for (const [dx, len] of [[-4, 5], [-1, 7], [2, 4], [5, 6]]) {
      ctx.beginPath(); ctx.moveTo(x + dx - 1.2, by + 14); ctx.lineTo(x + dx + 1.2, by + 14); ctx.lineTo(x + dx, by + 14 + len); ctx.closePath(); ctx.fill(); outline(ctx, 0.4);
    }
    if (Math.sin(t * 3 + x) > 0.8) glow(ctx, x - 3, by - 6, 0.9, '#ffffff', 'rgba(200,235,255,.7)');
  };
  // A fire-gyro bomber: the gyrocopter in red, a firebomb glowing under it.
  art.drawBomber = (ctx, e, x, y, t, flash) => {
    const cx = x + e.w / 2, cy = y + e.h / 2;
    paint(ctx, 'navy-gyro', GYRO, cx - GYRO.ax, cy - GYRO.ay, 1, '#ff9a72', flash);
    rotorBlur(ctx, cx + 2.1, cy - 10.3, 13, t);
    brassBall(ctx, cx + 1, cy + 8, 2.4, 2.4);
    glow(ctx, cx + 1, cy + 10.5, 1 + Math.abs(Math.sin(t * 9)) * 0.6, '#ffe08a', 'rgba(255,90,30,.6)');
  };
  // A conductor balloon: a steel-blue mine balloon with a copper rod below; the lead one draws the
  // arc to its mate.
  art.drawRod = (ctx, e, x, y, t, flash) => {
    const cx = x + e.w / 2, by = y + 16;
    paint(ctx, 'navy-mine', MINE, cx - MINE.ax, by - MINE.ay, 1, '#7088c0', flash);
    ctx.strokeStyle = '#b8742c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, y + e.h - 6); ctx.lineTo(cx, y + e.h); ctx.stroke();
    glow(ctx, cx, y + e.h, 1, '#e8f6ff', 'rgba(120,200,255,.5)');
    if (e.lead && e.arc && e.mate) {
      const m = e.mate, mx = m.x + m.w / 2 + (x - e.x), my = m.y + m.h + (y - e.y);   // the mate, shifted like this one
      if (e.arc === 'warn' && Math.floor(t * 14) % 2) return;
      const pts = [[cx, y + e.h]], n = 8, seed = Math.floor(t * 24);
      for (let i = 1; i < n; i++) pts.push([cx + (mx - cx) * i / n + (((i * 31 + seed * 17) % 9) - 4) * (e.arc === 'on' ? 1 : 0.4), y + e.h + (my - y - e.h) * i / n]);
      pts.push([mx, my]);
      const line = (wd, col) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.stroke(); };
      ctx.lineJoin = 'round';
      if (e.arc === 'on') { line(6, 'rgba(120,190,255,.25)'); line(2.6, 'rgba(190,230,255,.85)'); line(1, '#ffffff'); }
      else line(0.8, 'rgba(190,230,255,.6)');
    }
  };
  // A flak tower hanging upside down from the Sky Citadel's underside.
  art.drawCeilFlak = (ctx, x, y, t, flash) => {
    ctx.save(); ctx.translate(0, 2 * y + 18); ctx.scale(1, -1);
    art.drawFlak(ctx, x, y, t, flash);
    ctx.restore();
  };
  // A pay-ship: a small gilded navy zeppelin, glinting with gold.
  art.drawPayship = (ctx, e, x, y, t, flash) => {
    paint(ctx, 'navy-zeppelin', ZEP, x - 2, y - 3, 0.6, '#ffd77a', flash);
    for (let i = 0; i < 3; i++) if ((t * 1.7 + i * 0.37) % 1 < 0.15) glow(ctx, x + 8 + i * 16, y + 6 + (i % 2) * 6, 1, '#fffbe8', 'rgba(255,230,140,.7)');
    if (e.fled) art.text(ctx, '$', x + 25, y - 6, { size: 7, color: '#ffd34e', align: 'center' });
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
    if (b.fire) {                                        // the Furnace's flame column: glows from below, then roars up
      if (b.warn > 0) {
        const g = ctx.createLinearGradient(0, H(), 0, H() - 60); g.addColorStop(0, 'rgba(255,120,40,.5)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        if (Math.floor(t * 16) % 2) return;
        ctx.fillStyle = g; ctx.fillRect(b.x - 8, H() - 60, 16, 60); ctx.fillStyle = 'rgba(255,200,90,.8)'; ctx.fillRect(b.x - 0.5, 0, 1, H());
        return;
      }
      const g = ctx.createLinearGradient(b.x - 10, 0, b.x + 10, 0);
      g.addColorStop(0, 'rgba(255,80,20,0)'); g.addColorStop(0.3, 'rgba(255,120,30,.8)'); g.addColorStop(0.5, 'rgba(255,240,170,.95)'); g.addColorStop(0.7, 'rgba(255,120,30,.8)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g; ctx.fillRect(b.x - 10, 0, 20, H());
      for (let y = 0; y < H(); y += 14) glow(ctx, b.x + Math.sin(y + t * 30) * 4, H() - ((y + t * 300) % H()), 2, '#fff2c0', 'rgba(255,120,30,.4)');
      return;
    }
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
    if (b.icicle || b.shard) {                          // falling ice: a pale blue spike along its flight
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy || 0, b.vx || 0) - Math.PI / 2);
      const L = b.icicle ? 8 : 3.5, R = b.icicle ? 2.4 : 1.4, g = ctx.createLinearGradient(-R, 0, R, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8ec4ee');
      ctx.beginPath(); ctx.moveTo(-R, -L * 0.4); ctx.lineTo(R, -L * 0.4); ctx.lineTo(0, L * 0.6); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.5);
      ctx.restore(); return;
    }
    if (b.lava || b.bomb) {                             // a lava bomb (crusted, glowing) or a firebomb
      const r = b.r;
      if (b.lava) { ellipse(ctx, b.x - (b.vx || 0) * 0.02, b.y - (b.vy || 0) * 0.03, r * 0.9, r * 0.9, 'rgba(70,60,60,.35)', 0); }
      glow(ctx, b.x, b.y, r * 0.8, '#ffe08a', 'rgba(255,90,30,.5)');
      const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, 0, b.x, b.y, r);
      g.addColorStop(0, b.lava ? '#ffb43c' : '#5a5a66'); g.addColorStop(1, b.lava ? '#5a1a0a' : '#141418');
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); outline(ctx, 0.5);
      return;
    }
    if (b.flare) { glow(ctx, b.x, b.y, 2.6 + Math.random() * 0.6, '#fffbe0', 'rgba(255,240,170,.6)'); return; }
    if (b.frost) {                                       // a frost orb: pale, with a snowflake cross
      glow(ctx, b.x, b.y, b.r, '#ffffff', 'rgba(150,210,255,.6)');
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(b.x - Math.cos(a) * 3, b.y - Math.sin(a) * 3); ctx.lineTo(b.x + Math.cos(a) * 3, b.y + Math.sin(a) * 3); }
      ctx.stroke(); return;
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
  // A wingman: the pirate airship, smaller and in its own colours, flying in the squadron.
  art.drawWingman = (ctx, wg, x, y, t) => {
    const k = wg.w / CD.SHIP_W;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    art.drawShip(ctx, { w: CD.SHIP_W, h: CD.SHIP_H, tilt: 0, inv: 0, dash: 0, look: wg.look }, 0, 0, t + wg.t);
    ctx.restore();
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
    } else if (b.id === 'lamplighter') {
      const L = CD.BOSSES.lamplighter.lamps;
      if (b.beams) b.beams.forEach((a, i) => beam(ctx, x + L[i][0], y + L[i][1], a, CD.BEAM_LEN + 40, CD.BEAM_HALF, 'rgba(255,246,200,.38)'));
      paint(ctx, 'navy-zeppelin', ZEP, x - 6, y - 8, 1.45, '#56618a', f);   // the navy zeppelin, flagship-sized and blacked out
      for (const [lx, ly] of L) { ellipse(ctx, x + lx, y + ly - 1, 3.4, 2.6, '#2e2e38', 0.6); glow(ctx, x + lx, y + ly, 2.2, b.tell ? '#fff2a0' : '#fff8d8', b.beams ? 'rgba(255,240,150,.8)' : 'rgba(255,240,150,.45)'); }
    } else if (b.id === 'icebreaker') {
      // the ice ram on the bow, then the hull frosted over, icicles along the keel
      ctx.beginPath(); ctx.moveTo(x + 4, y + 22); ctx.lineTo(x - 18, y + 33); ctx.lineTo(x + 4, y + 44); ctx.closePath();
      const rg = ctx.createLinearGradient(0, y + 22, 0, y + 44); rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#7ab4e0');
      ctx.fillStyle = f ? '#fff' : rg; ctx.fill(); outline(ctx, 0.8);
      paint(ctx, 'boss-thunderer', BOSS.thunderer, x - 10, y - 16, 1, '#c4e2ff', f);
      ctx.fillStyle = 'rgba(235,248,255,.95)';
      for (let i = 0; i < 9; i++) { const ix = x + 18 + i * 11, len = 4 + ((i * 7) % 5); ctx.beginPath(); ctx.moveTo(ix - 1.6, y + 48); ctx.lineTo(ix + 1.6, y + 48); ctx.lineTo(ix, y + 48 + len); ctx.closePath(); ctx.fill(); outline(ctx, 0.4); }
      glow(ctx, x + 2, y + 33, 2, b.tell ? '#ffffff' : '#d8f0ff', 'rgba(150,210,255,.5)');
    } else if (b.id === 'furnace') {
      const cx = x + b.w / 2, cy = y + b.h / 2;
      art.drawCloudBank(ctx, x - 10, cy + 34, b.w + 20, t, 0.95, 'ash');
      paint(ctx, 'boss-tempest', BOSS.tempest, cx - BOSS.tempest.ax, cy - BOSS.tempest.ay, 1, '#ff9a66', f);
      const oy = cy - 36;
      glow(ctx, cx, oy, 5.5 + Math.sin(t * 14) * 0.9, b.tell ? '#ffffff' : '#ffe08a', b.tell ? 'rgba(255,200,90,.7)' : 'rgba(255,90,30,.55)');
      for (let i = 0; i < 4; i++) {                       // flames licking up from the forge
        const k = (t * 2 + i / 4) % 1;
        glow(ctx, cx + Math.sin(t * 5 + i * 1.7) * 5, oy - 4 - k * 14, 1.6 * (1 - k) + 0.4, '#ffd27a', `rgba(255,90,30,${0.5 * (1 - k)})`);
      }
    } else if (b.id === 'stormjaw') {
      const cx = x + b.w / 2, cy = y + b.h / 2, k = 3.4;
      paint(ctx, 'navy-pike', PIKE, cx - PIKE.ax * k, cy - PIKE.ay * k, k, '#6e7896', f);
      glow(ctx, cx - 10.3 * k, cy - 0.5 * k, 3, b.tell ? '#ff6a5a' : '#bfefff', b.tell ? 'rgba(255,40,40,.6)' : 'rgba(120,200,255,.5)');
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {                       // lightning crawling over its armour
        const sx = cx - 30 + i * 30 + ((Math.floor(t * 12) * 13 + i * 7) % 11), sy = cy - 12 + (i % 2) * 18;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        for (let n = 1; n <= 3; n++) ctx.lineTo(sx + n * 4, sy + (((n * 7 + Math.floor(t * 20)) % 5) - 2) * 1.5);
        ctx.strokeStyle = 'rgba(200,235,255,.8)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
    } else if (b.id === 'citadel') {
      paint(ctx, 'boss-fort', BOSS.fort, x - 8, y - 6, 1.25, '#cdb4e4', f);
      for (const [tx, ty] of CD.BOSSES.citadel.turrets) {
        ctx.save(); ctx.translate(x + tx, y + ty + 2); ctx.rotate(Math.PI + 0.3 + Math.sin(t + tx) * 0.2); barrel(ctx, 12, 1.7); ctx.restore();
      }
      for (const [px, h] of [[40, 22], [96, 26]]) {       // the Admiralty's pennants
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + px, y + 2); ctx.lineTo(x + px, y + 2 - h); ctx.stroke();
        const wv = Math.sin(t * 6 + px) * 2;
        ctx.beginPath(); ctx.moveTo(x + px, y + 2 - h); ctx.quadraticCurveTo(x + px - 7, y + 4 - h + wv, x + px - 14, y + 5 - h); ctx.lineTo(x + px, y + 8 - h); ctx.closePath();
        ctx.fillStyle = '#c8281e'; ctx.fill(); outline(ctx, 0.5);
      }
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
    if (h.kind === 'jaw') {                              // Stormjaw's lunge: a crackling blue lane
      if (h.warn > 0) {
        if (Math.floor(t * 14) % 2) return;
        ctx.fillStyle = 'rgba(140,200,255,.2)'; ctx.fillRect(0, h.y, W(), h.h);
        ctx.fillStyle = 'rgba(190,230,255,.85)'; ctx.fillRect(0, h.y, W(), 1); ctx.fillRect(0, h.y + h.h - 1, W(), 1);
        return;
      }
      ctx.strokeStyle = 'rgba(200,235,255,.7)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0, i = 0; x < W(); x += 8, i++) { const y = h.y + h.h / 2 + (((i * 13 + Math.floor(t * 30)) % 9) - 4) * 1.4; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); return;
    }
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

  // Where an icicle will drop (a shaking cluster at the top) or a lava bomb will burst up (a
  // bubbling glow at the bottom), with a faint line down its path.
  art.drawFall = (ctx, f, t) => {
    const blink = Math.floor(t * 12) % 2;
    if (f.kind === 'ice') {
      if (blink) { ctx.fillStyle = 'rgba(200,235,255,.22)'; ctx.fillRect(f.x - 4, 0, 8, H()); }
      const sh = Math.sin(t * 50) * 0.8;
      ctx.fillStyle = '#e8f6ff';
      for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(f.x + dx - 1.6 + sh, 0); ctx.lineTo(f.x + dx + 1.6 + sh, 0); ctx.lineTo(f.x + dx + sh, 6 + (dx === 0 ? 3 : 0)); ctx.closePath(); ctx.fill(); outline(ctx, 0.4); }
    } else {
      if (blink) { ctx.fillStyle = 'rgba(255,140,60,.18)'; ctx.fillRect(f.x - 5, 0, 10, H()); }
      glow(ctx, f.x, H() - 2, 4 + Math.sin(t * 20) * 1, '#ffe08a', 'rgba(255,90,30,.6)');
    }
  };
  // A flak curtain: warning puffs down its line (the gap left clear and bracketed), then bursts.
  art.drawCurtain = (ctx, c, t) => {
    if (c.warn > 0) {
      for (let y = 6; y < H(); y += 12) {
        if (CD.inCurtainGap(c, y)) continue;
        if (Math.floor(t * 10 + y * 0.1) % 2) ellipse(ctx, c.x, y, 3, 3, 'rgba(255,170,90,.55)', 0.6);
      }
      ctx.strokeStyle = 'rgba(255,211,78,.8)'; ctx.lineWidth = 1;
      for (const [y, d] of [[c.gapY, 1], [c.gapY + c.gapH, -1]]) { ctx.beginPath(); ctx.moveTo(c.x - 6, y + d * 3); ctx.lineTo(c.x - 6, y); ctx.lineTo(c.x + 6, y); ctx.lineTo(c.x + 6, y + d * 3); ctx.stroke(); }
      return;
    }
    const k = 1 - c.live / 0.7;
    for (let y = 4, i = 0; y < H(); y += 10, i++) {
      if (CD.inCurtainGap(c, y)) continue;
      const r = 4 + k * 5 + (i % 3);
      ellipse(ctx, c.x + Math.sin(i * 2.3) * 3, y, r, r * 0.85, `rgba(60,50,60,${0.75 * (1 - k)})`, 0);
      if (k < 0.4 && (i + Math.floor(t * 20)) % 3 === 0) glow(ctx, c.x + Math.sin(i * 2.3) * 3, y, 2, '#ffd34e', 'rgba(255,140,40,.5)');
    }
  };
  // Wind shear: streaks show which way a gust will shove; then they rush that way.
  art.drawGust = (ctx, g, t) => {
    const on = g.warn <= 0, n = on ? 24 : 10;
    ctx.strokeStyle = on ? 'rgba(230,240,255,.45)' : 'rgba(230,240,255,.3)'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = hash(i) * W(), y = wrap(hash(i + 40) * H() + g.dir * t * (on ? 220 : 40), H(), 0), len = on ? 14 : 7;
      ctx.moveTo(x, y); ctx.lineTo(x + 2, y + g.dir * len);
    }
    ctx.stroke();
    if (!on && Math.floor(t * 6) % 2) art.text(ctx, g.dir < 0 ? '\u2191 GUST \u2191' : '\u2193 GUST \u2193', W() / 2, g.dir < 0 ? 44 : H() - 24, { size: 7, color: '#e8f4ff', align: 'center' });
  };
  // The stage picker: < STAGE 5: THE MIDNIGHT PICKET >, and how to change it.
  art.drawPicker = (ctx, st, y, t, hint) => {
    const a = CD.AREAS[st.start];
    art.text(ctx, `SET SAIL FROM  STAGE ${st.start + 1}: ${a.name}`, W() / 2, y - 1, { size: 7, color: '#ffffff', align: 'center' });
    const pulse = 1 + Math.sin(t * 5) * 0.6;
    art.text(ctx, '<', 36 - pulse, y - 1, { size: 9, color: '#ffd34e', align: 'center' });
    art.text(ctx, '>', W() - 36 + pulse, y - 1, { size: 9, color: '#ffd34e', align: 'center' });
    art.text(ctx, `${hint}   ·   ${st.reached + 1} OF ${CD.AREAS.length} STAGES REACHED`, W() / 2, y + 7.5, { size: 5, color: '#cfe8ff', align: 'center' });
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
    if (/\b(touch|mouse)\b/.test(document.documentElement.className)) { art.button(ctx, L.buy, 'BUY', !CD.owns(profile, sel.key, o.id)); art.button(ctx, L.done, 'DONE'); }
    else art.text(ctx, padMode() ? 'D-PAD: CHOOSE   A / OK: BUY   B / BACK: DONE' : 'ARROWS: CHOOSE   SPACE: BUY   ENTER: DONE', W() / 2 + 60, 204, { size: 6.5, color: '#d9c4a0', align: 'center' });
  };

  art.drawMarket = (ctx, m, w, s, t, touch) => {
    const L = CD.MLAYOUT;
    ctx.fillStyle = 'rgba(16,24,48,.6)'; ctx.fillRect(0, 0, W(), H());
    panel(ctx, 40, 14, W() - 80, H() - 28);
    art.text(ctx, m.stake ? 'THE QUARTERMASTER\'S STAKE' : 'THE SKY MARKET', W() / 2, 28, { size: 13, color: '#ffd34e', align: 'center' });
    art.text(ctx, `HEARTS ${s.hearts}/${s.maxHearts}   LIVES ${s.lives}`, 54, 42, { size: 7, color: '#ffb0a8' });
    art.text(ctx, `${w.gold} GOLD`, W() - 54, 42, { size: 7, color: '#ffd34e', align: 'right' });
    m.rows().forEach((it, i) => {
      const col = i >= L.per ? 1 : 0, x0 = col ? L.col : 54, x1 = col ? W() - 54 : L.col - 14;
      const y = L.top + (i % L.per) * L.step, sel = i === m.row;
      if (sel) { ctx.fillStyle = 'rgba(217,164,65,.22)'; ctx.fillRect(x0 - 6, y - 6, x1 - x0 + 12, 12); }
      const name = it.id === 'gun' ? `GUN: ${sel ? '< ' : ''}${CD.WEAPONS[m.gun()].name}${sel ? ' >' : ''}` : it.id === 'wingman' ? `WINGMAN ${(s.wingmen || 0) + 1}/4` : it.name;
      art.text(ctx, (sel ? '> ' : '') + name, x0, y, { size: 6.5, color: sel ? '#ffd34e' : '#f1e6cc' });
      if (it.id !== 'leave') { const c = m.price(it.id); art.text(ctx, c + 'G', x1, y, { size: 6.5, color: w.gold >= c ? '#7cfc7c' : '#ff8a7a', align: 'right' }); }
    });
    const cur = m.current();
    const note = m.msgT > 0 ? m.msg : cur.id === 'leave' && m.stake ? 'SET SAIL: WHAT ISN\'T SPENT STAYS IN PORT' : cur.note;
    art.text(ctx, note, W() / 2, touch ? 184 : 188, { size: 7, color: m.msgT > 0 ? '#ffd34e' : '#cfe8ff', align: 'center' });
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
    if (s.ice > 0.02) {                                  // the Frozen Heights: how iced the rigging is
      ctx.fillStyle = INK; ctx.fillRect(gx - 1, gy + 6, gw + 2, 4);
      ctx.fillStyle = '#bfe4ff'; ctx.fillRect(gx, gy + 7, gw * Math.min(1, s.ice), 2);
      art.text(ctx, s.ice > 0.6 ? 'ICED! FULL STEAM' : 'ICE', gx + gw + 4, gy + 9.5, { size: 5, color: s.ice > 0.6 ? '#ffffff' : '#bfe4ff' });
    }
    const gun = CD.WEAPONS ? CD.WEAPONS[s.weapon || 'cannon'] : null;
    if (gun) art.text(ctx, s.weaponT > 0 && s.weapon !== 'cannon' ? (s.gunRack ? gun.name : `${gun.name} ${Math.ceil(s.weaponT)}`) : gun.name, L, 31, { size: 6.5, color: s.weaponT > 0 && s.weapon !== 'cannon' ? '#ffd34e' : '#cfe8ff' });
    art.text(ctx, String(w.score).padStart(6, '0'), R, 9, { size: 9, align: 'right' });
    art.text(ctx, `GOLD ${w.gold}`, R, 20, { size: 7, align: 'right', color: '#ffd34e' });
    if (best) art.text(ctx, `BEST ${best}`, R, 30, { size: 6, align: 'right', color: '#cfe8ff' });
  };
})();
