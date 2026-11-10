// The voyage update's art, with no new paintings: each new level's backdrop is one of the painted
// backdrops tinted for its time of day, with code-drawn parallax layers on top (ruins, wisps, a
// volcano, the fleet) and weather over the whole picture (rain, fog and lightning, embers, spray).
// Plus the pixel art drawn in code in the game's style: bats, powder kegs, spikes and urchins,
// lava, vents, the dart idol, mortar marks, boulders and lava rocks. Uses only canvas calls the
// Apple TV / Switch runtime.js supports (fillRect, drawImage, globalAlpha, source-atop).
(() => {
  const JR = window.JR;
  const px = JR.px;
  const W = () => JR.VIEW_W, H = () => JR.VIEW_H;
  const mod = (a, n) => ((a % n) + n) % n;
  const wrap = (x, span, pad = 0) => mod(x, span) - pad;
  const rect = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  // A cheap repeatable "random" from an integer.
  const hash = n => { let x = (n | 0) * 374761393; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

  // ---------- parallax layers ----------

  const LAYERS = {
    // Skull Isle: a stepped temple far off, broken pillars and a stone skull nearer, vines above.
    ruins(ctx, camX, t) {
      for (let x = wrap(-camX * 0.1 + 60, 520, 160); x < W() + 160; x += 520) {       // the temple, far off
        for (let i = 0; i < 6; i++) rect(ctx, '#1d3a2c', x + i * 10, 112 - i * 10, 140 - i * 20, 10);
        rect(ctx, '#162e22', x + 58, 50, 24, 12);
        rect(ctx, '#5cfc8c', x + 66, 55, 8, 5);                         // its doorway, glowing
      }
      // The jungle along the shore, hiding the sea.
      for (let x = wrap(-camX * 0.2, 8, 8); x < W(); x += 8) {
        const n = Math.floor((x + camX * 0.2) / 8), h = 18 + Math.floor(hash(n) * 14) + Math.floor(hash(n >> 2) * 12);
        rect(ctx, '#0b2a1c', x, 132 - h, 8, 90 + h); rect(ctx, '#16442c', x, 132 - h, 8, 2);
      }
      for (let x = wrap(-camX * 0.35, 300, 240); x < W() + 120; x += 300) {          // pillars and the skull rock
        rect(ctx, '#34483a', x, 118, 18, 100); rect(ctx, '#4a6250', x + 2, 118, 4, 100); rect(ctx, '#2f7a3a', x, 118, 18, 3);
        rect(ctx, '#34483a', x - 4, 112, 26, 8);
        rect(ctx, '#34483a', x + 120, 150, 18, 70); rect(ctx, '#34483a', x + 116, 144, 14, 8); rect(ctx, '#2f7a3a', x + 116, 144, 14, 2);
        rect(ctx, '#3a4e40', x + 190, 128, 44, 90); rect(ctx, '#3a4e40', x + 196, 122, 32, 8); rect(ctx, '#2f7a3a', x + 196, 122, 32, 3);
        rect(ctx, '#0b160f', x + 198, 138, 10, 9); rect(ctx, '#0b160f', x + 216, 138, 10, 9);
        rect(ctx, '#0b160f', x + 209, 150, 6, 6);
        for (let k = 0; k < 4; k++) rect(ctx, '#0b160f', x + 201 + k * 7, 160, 4, 6);
      }
      for (let x = wrap(-camX * 0.8, 96, 48); x < W() + 48; x += 96) {               // vines
        const n = Math.floor((x + camX * 0.8) / 96), len = 24 + Math.floor(hash(n) * 46);
        const sway = Math.round(Math.sin(t * 1.3 + n) * 2);
        for (let y = 0; y < len; y += 2) rect(ctx, y % 6 ? '#1d5a2c' : '#2f7a3a', x + (y > len / 2 ? sway : 0), y, 2, 2);
        rect(ctx, '#3c8a44', x - 2 + sway, len, 6, 3);
      }
    },
    // The Ghost Ship: will-o'-the-wisps bobbing among the rigging.
    wisps(ctx, camX, t) {
      for (let i = 0; i < 7; i++) {
        const x = wrap(i * 67 - camX * 0.3 + Math.sin(t * 0.7 + i) * 12, W() + 60, 30), y = 50 + (i * 37) % 110 + Math.sin(t * 2 + i * 1.7) * 6;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3 + i);
        rect(ctx, '#7cfcc8', x - 3, y - 3, 6, 6);
        ctx.globalAlpha = 1;
        rect(ctx, '#d8fff0', x - 1, y - 1, 2, 2);
      }
    },
    // Volcanic Cove: the volcano, its glowing crater, lava down its side and a smoke plume.
    volcano(ctx, camX, t) {
      // One volcano, drifting slowly enough to stay in sight the whole level.
      for (let x = wrap(-camX * 0.05 + 560, 640, 260); x < W() + 260; x += 640) {
        for (let i = 0; i < 9; i++) rect(ctx, '#4a1e18', x - 16 - i * 10, 92 + i * 6, 32 + i * 20, 6);
        const glow = 0.6 + 0.4 * Math.sin(t * 2.2);
        ctx.globalAlpha = glow; rect(ctx, '#fc7c18', x - 12, 90, 24, 3); rect(ctx, '#fcc838', x - 6, 90, 12, 2);
        ctx.globalAlpha = 1;
        for (let k = 0; k < 8; k++) rect(ctx, k % 2 ? '#c83810' : '#fc7c18', x + 6 + k * 3, 94 + k * 6, 2, 6);   // a lava run
        for (let k = 0; k < 6; k++) {
          const a = mod(t * 0.25 + k / 6, 1), r = 6 + a * 18;
          ctx.globalAlpha = 0.5 * (1 - a);
          rect(ctx, '#4a3434', x - r + Math.sin(k + t * 0.5) * 6 + a * 30, 86 - a * 60 - r / 2, r * 2, r);
        }
        ctx.globalAlpha = 1;
      }
      for (let x = wrap(-camX * 0.4, 240, 160); x < W() + 80; x += 240) {           // black rock nearer
        rect(ctx, '#1c0a08', x, 170, 30, 50); rect(ctx, '#1c0a08', x + 6, 160, 18, 10); rect(ctx, '#1c0a08', x + 11, 152, 8, 8);
        rect(ctx, '#1c0a08', x + 110, 182, 46, 40); rect(ctx, '#1c0a08', x + 120, 170, 24, 12);
        rect(ctx, '#8c2808', x + 124, 176, 2, 8); rect(ctx, '#8c2808', x + 14, 176, 2, 10);
      }
    },
    // Admiral's Flagship: the fleet on the horizon, guns flashing now and then.
    fleet(ctx, camX, t) {
      for (let x = wrap(-camX * 0.06 - t * 2, 560, 360); x < W() + 20; x += 560) {
        for (let s = 0; s < 3; s++) {
          // A man-o'-war in silhouette, small with distance: tapered hull, three masts of sails.
          const k = s % 2 ? 0.45 : 0.6, sx = x + s * 150, sy = 114 + (s % 2) * 2, hw = Math.round(54 * k);
          rect(ctx, '#3a2648', sx, sy, hw, 3); rect(ctx, '#3a2648', sx + 2, sy + 3, hw - 4, 2); rect(ctx, '#3a2648', sx + hw - 3, sy - 3, 5, 3);
          rect(ctx, '#d8a040', sx + 4, sy + 1, hw - 10, 1);                          // the gun ports' line
          for (let m = 0; m < 3; m++) {
            const mx = sx + Math.round((10 + m * 15) * k), mh = Math.round((m === 1 ? 34 : 28) * k);
            rect(ctx, '#3a2648', mx, sy - mh, 1, mh);
            for (let j = 0; j < 3; j++) rect(ctx, '#6a5080', mx - Math.round((6 - j) * k), sy - mh + 2 + Math.round(j * 9 * k), Math.round((13 - j * 2) * k), Math.round(7 * k));
          }
          // A broadside flash every few seconds, different for each ship.
          const ph = mod(t + s * 2.3, 5.2);
          if (ph < 0.15) { rect(ctx, '#fcc838', sx + 8, sy + 1, 3, 3); rect(ctx, '#fc7c18', sx + 24, sy + 1, 3, 3); }
          if (ph < 1.2) { ctx.globalAlpha = 0.35 * (1 - ph / 1.2); rect(ctx, '#e8e0f0', sx + 4 - ph * 10, sy - 2 - ph * 6, 30, 5); ctx.globalAlpha = 1; }
        }
      }
    },
  };

  // ---------- weather (over everything in the world, under the HUD) ----------

  const WEATHER = {
    rain(ctx, camX, t) {
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 70; i++) {
        const sp = 260 + (i % 5) * 30;
        const x = mod(i * 53.7 - t * 70 - camX * 0.5, W() + 20) - 10, y = mod(i * 97.3 + t * sp, H() + 20) - 10;
        rect(ctx, '#b4c8f0', x, y, 1, 5); rect(ctx, '#b4c8f0', x - 1, y + 4, 1, 2);
      }
      ctx.globalAlpha = 1;
    },
    fog(ctx, camX, t, calm) {
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < 6; i++) {
        const x = wrap(i * 97 - camX * 0.9 + t * (8 + i * 3), W() + 240, 120), y = 140 + (i % 3) * 22, w = 90 + (i % 3) * 30;
        rect(ctx, '#bce8dc', x + 16, y - 8, w - 32, 4); rect(ctx, '#bce8dc', x + 6, y - 4, w - 12, 4);
        rect(ctx, '#bce8dc', x, y, w, 8); rect(ctx, '#bce8dc', x + 10, y + 8, w - 20, 4);
        rect(ctx, '#bce8dc', x + 22, y - 2, w - 44, 8);
      }
      ctx.globalAlpha = 1;
      const flash = JR.lightning(t);
      if (flash) { ctx.globalAlpha = flash * (calm ? 0.12 : 0.4); rect(ctx, '#e8fcff', 0, 0, W(), H()); ctx.globalAlpha = 1; }
    },
    embers(ctx, camX, t) {
      for (let i = 0; i < 45; i++) {
        const up = 18 + (i % 7) * 6;
        const x = mod(i * 41.3 - camX * 0.7 + Math.sin(t * 1.5 + i) * 8, W() + 10) - 5, y = mod(i * 71.9 - t * up, H() + 10) - 5;
        rect(ctx, i % 3 ? '#fc7c18' : '#fcc838', x, y, i % 4 ? 1 : 2, i % 4 ? 1 : 2);
      }
      ctx.globalAlpha = 0.12; rect(ctx, '#c83810', 0, H() - 30, W(), 30); ctx.globalAlpha = 1;   // heat off the lava
    },
    spray(ctx, camX, t) {
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 26; i++) {
        const x = mod(i * 89.1 - t * (220 + (i % 4) * 40) - camX, W() + 40) - 20, y = mod(i * 47.7, H() - 30) + Math.sin(t * 3 + i) * 3;
        rect(ctx, '#f0f0ff', x, y, 7, 1);
      }
      ctx.globalAlpha = 1;
    },
  };

  // ---------- backdrops ----------

  // A new level's backdrop: the base painting (or, until it's in, the tint alone), its tint, its
  // layer. Returns false for the first four levels, which keep their own (js/art-world.js).
  function backdrop(ctx, camX, t, biome) {
    const lvl = JR.levelOf && JR.levelOf(biome);
    if (!lvl || !lvl.look) return false;
    const L = lvl.look;
    if (!JR.artWorld.painted(ctx, camX, L.base)) rect(ctx, '#20283a', 0, 0, W(), H());
    rect(ctx, L.tint, 0, 0, W(), H());
    if (L.sky) for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.18; rect(ctx, L.sky, 0, 0, W(), 20 + i * 22); }   // a heavier sky
    ctx.globalAlpha = 1;
    LAYERS[L.layer](ctx, camX, t);
    return true;
  }

  function weather(ctx, camX, t, biome, calm) {
    const lvl = JR.levelOf && JR.levelOf(biome);
    if (lvl && lvl.look && WEATHER[lvl.look.weather]) WEATHER[lvl.look.weather](ctx, camX, t, calm);
  }

  // ---------- pixel art ----------

  const S = (key, w, h, rows, outline = true, pal) => px.sprite(key, w, h, s => { s.rows(rows); if (outline) s.outline(); }, pal);
  const pad = rows => ['', ...rows, ''].map(r => '.' + r.padEnd(rows[0].length, '.') + '.');
  const PAL = {
    M: '#7c8a6c', m: '#4c5a40', n: '#2c3424',            // mossy stone
    U: '#4a2050', u: '#7a3c84',                          // urchin
    Q: '#3a2850', q: '#6a4a8a',                          // bat
  };

  const BAT = [
    ['q..........q', 'qq........qq', 'qqq.QQQQ.qqq', '.qqQQRRQQqq.', '..qQQQQQQq..', '....Q..Q....'],
    ['............', '....QQQQ....', '..qQQRRQQq..', '.qqQQQQQQqq.', 'qqq......qqq', 'q..........q'],
  ];
  const KEG = ['...dDDd...', '..DDDDDD..', '.dGGGGGGd.', '.DDDDDDDD.', '.DDWWWWDD.', '.DDWKWKDD.', '.DDDWWDDD.', '.DDDDDDDD.', '.dGGGGGGd.', '..DDDDDD..', '...dDDd...'];
  const IDOL = (eye) => [
    '..mmmmmmmmmm..', '.mMMMMMMMMMMm.', '.mMnnMMMMnnMm.', `.mMn${eye}MMMMn${eye}Mm.`, '.mMMMMMMMMMMm.', '.mMMMMMmMMMMm.',
    '.mMMMMmmMMMMm.', 'nnnnnMMMMMMMm.', '.....nMMMMMMm.', 'nnnnnMMMMMMMm.', '.mMMMMMMMMMMm.', '.mMmMmMmMmMMm.', '.mmmmmmmmmmmm.',
  ];
  const sprite = {
    bat: f => S('bat' + f, 14, 8, pad(BAT[f]).slice(0, 8), true, PAL),
    keg: () => S('pkeg', 12, 13, pad(KEG).slice(0, 13), true, PAL),
    idol: tell => S('idol' + tell, 16, 15, pad(IDOL(tell ? 'O' : 'n')).slice(0, 15), true, PAL),
    spikes: () => px.sprite('spikes', 16, 8, s => {
      for (let k = 0; k < 4; k++) {
        const x = k * 4;
        s.line(x, 7, x + 2, 1, 'g'); s.line(x + 3, 7, x + 2, 1, 'G');
        s.dot(x + 2, 0, 'W');
      }
      s.rect(0, 7, 16, 1, 'K');
    }),
    urchins: () => px.sprite('urchins', 16, 8, s => {
      for (const [cx, cy] of [[4, 5], [12, 5]]) {
        for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [-2, -2], [2, -2], [-3, 2], [3, 2]]) s.line(cx, cy, cx + dx, cy + dy, 'K');
        s.disc(cx, cy, 2, PAL.U); s.dot(cx - 1, cy - 1, PAL.u);
      }
    }),
  };

  // Spikes or urchins and lava, for js/art-world.js's tile pass. (x, y) = the cell's top-left.
  function drawHazardTile(ctx, lv, c, r, x, y, t, biome) {
    const tile = lv.tile(c, r);
    if (tile === '^') ctx.drawImage(biome === 'beach' ? sprite.urchins() : sprite.spikes(), x, y + 8);
    else if (tile === '~') {
      const T = JR.TILE;
      if (lv.tile(c, r - 1) === '~') { rect(ctx, '#a82808', x, y, T, T); rect(ctx, '#7c1808', x + ((c * 5) % 12), y + 6, 4, 3); return; }
      rect(ctx, '#c83810', x, y + 3, T, T - 3);
      const k = Math.floor(t * 4 + c) % 4;
      rect(ctx, '#fc7c18', x, y + 3, T, 3);
      rect(ctx, '#fcc838', x + k * 4, y + 3, 4, 1);
      if ((c + Math.floor(t * 1.5)) % 5 === 0) rect(ctx, '#fcc838', x + 6, y + 1 + Math.floor(t * 6) % 2, 3, 2);   // a bubble
    }
  }

  // Lava vents, mortar posts (nothing to see but its marks) and dart idols.
  function drawHazard(ctx, h, t) {
    const x = Math.round(h.x), y = Math.round(h.y);
    if (h.type === 'e') {
      rect(ctx, '#2a1414', x - 2, y + 9, 20, 7); rect(ctx, '#3c1c18', x + 1, y + 6, 14, 4);
      const hot = h.tell ? (Math.floor(t * 16) % 2 ? '#fcc838' : '#fc7c18') : '#8c2808';
      rect(ctx, hot, x + 6, y + 6, 4, 3); rect(ctx, hot, x + 7, y + 9, 2, 3);
      if (h.tell) { ctx.globalAlpha = 0.5; rect(ctx, '#5c4848', x + 4 + Math.sin(t * 20) * 2, y - 2 - (t * 30) % 8, 8, 6); ctx.globalAlpha = 1; }
    } else if (h.type === 'z') {
      ctx.drawImage(sprite.idol(h.tell && Math.floor(t * 12) % 2 ? 1 : 0), x, y + 1);
    }
  }

  function drawEnemy(ctx, e, x, y, t) {
    if (e.type === 'v') {
      const img = sprite.bat(Math.floor(t * 8 + e.x) % 2);
      px.draw(ctx, img, x, y, img.width / 2, img.height - 1, e.facing < 0);
      if (e.flash > 0) { ctx.globalAlpha = 0.7; rect(ctx, '#fcfcfc', x - 4, y - 7, 8, 5); ctx.globalAlpha = 1; }
      return true;
    }
    if (e.type === 'k') {
      const img = sprite.keg();
      px.draw(ctx, img, x, y, img.width / 2, img.height);
      if (Math.floor(t * 6 + e.x) % 3 === 0) rect(ctx, '#fcc838', x + 1, y - img.height - 1, 1, 1);   // a fizzing fuse
      return true;
    }
    return false;
  }

  function drawShot(ctx, s, x, y, t) {
    if (s.lava) {
      rect(ctx, '#c83810', x - 3, y - 2, 6, 4); rect(ctx, '#c83810', x - 2, y - 3, 4, 6);
      rect(ctx, Math.floor(t * 12) % 2 ? '#fcc838' : '#fc7c18', x - 1, y - 1, 2, 2);
      return true;
    }
    if (s.boulder) {
      const r = s.r, k = Math.floor((x / 6) % 4);
      rect(ctx, '#1b1020', x - r, y - r + 1, r * 2, r * 2 - 2); rect(ctx, '#1b1020', x - r + 1, y - r, r * 2 - 2, r * 2);
      rect(ctx, '#7c8a6c', x - r + 1, y - r + 2, r * 2 - 2, r * 2 - 4); rect(ctx, '#7c8a6c', x - r + 2, y - r + 1, r * 2 - 4, r * 2 - 2);
      rect(ctx, '#4c5a40', x - 3 + (k % 2) * 4, y - 2 + (k >> 1) * 3, 3, 2);
      return true;
    }
    return false;
  }

  // Where a mortar shell or lava rock is about to land: a blinking target that tightens.
  function drawMark(ctx, f, t) {
    const k = Math.max(0, Math.min(1, f.t)), r = 3 + Math.round(k * 8);
    if (Math.floor(t * (k < 0.35 ? 16 : 8)) % 2) return;
    const c = f.lava ? '#fc7c18' : '#d82838', x = Math.round(f.x), y = Math.round(f.y) - 2;
    rect(ctx, c, x - r, y, r * 2, 1); rect(ctx, c, x - r, y - 2, 1, 3); rect(ctx, c, x + r - 1, y - 2, 1, 3);
    rect(ctx, c, x - 1, y - 3, 2, 3);
  }

  JR.areaArt = { backdrop, weather, drawHazardTile, drawHazard, drawEnemy, drawShot, drawMark, sprite, LAYERS, WEATHER };
})();
