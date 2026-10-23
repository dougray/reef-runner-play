// The world in pack art: terrain, platforms and each area's backdrop, drawn from the atlas.
(() => {
  const JR = window.JR;
  const mod = (a, n) => ((a % n) + n) % n;

  // Pure: which 16 px quarter of a pack's 3x3 block of 32 px tiles (a 6x6 grid of quarters) a solid
  // cell shows, from the solid neighbors in `mask` (N 1, E 2, S 4, W 8, NE 16, SE 32, SW 64, NW 128).
  // Inside rows/columns cycle through `inner` by cell position so the 32 px pattern repeats.
  // Returns [qx, qy] plus a notch ('nw' | 'ne' | 'sw' | 'se') when an inner corner needs one.
  JR.quarterFor = (mask, x, y, inner = [1, 2, 3, 4]) => {
    const has = b => (mask & b) !== 0;
    const axis = (lo, hi, v) => !lo && !hi ? (mod(v, 2) ? 5 : 0) : !lo ? 0 : !hi ? 5 : inner[mod(v, inner.length)];
    const r = [axis(has(8), has(2), x), axis(has(1), has(4), y)];
    if ((mask & 15) === 15) {
      const notch = !has(128) ? 'nw' : !has(16) ? 'ne' : !has(64) ? 'sw' : !has(32) ? 'se' : null;
      if (notch) r.push(notch);
    }
    return r;
  };

  // ---------- drawing (needs the atlas) ----------

  const A = () => JR.atlas;
  const W = () => JR.VIEW_W, H = () => JR.VIEW_H;
  const wrap = (x, span, pad = 0) => mod(x, span) - pad;
  const GROUND = 15 * 16 - 56;            // screen y of the usual ground top

  // Terrain per area: the sheet, the 3x3 block's origin in it, the source quarter size (Pirate Bomb
  // art is drawn at twice our scale, so its 32 px quarters are halved) and inner-corner notch quarters.
  const TERRAIN = {
    beach: { anim: 'island.terrain', ox: 0, oy: 0, q: 16, notch: { nw: [224, 32], ne: [208, 32] } },
    town: { anim: 'ship.terrain', ox: 32, oy: 32, q: 16 },
    fort: { anim: 'hold.tiles', ox: 0, oy: 0, q: 32 },
    ship: { anim: 'ship.terrain', ox: 32, oy: 32, q: 16 },
  };

  // Tiles are stretched to whole device pixels so no seams show at in-between (phone) scales.
  const blit = (ctx, sx, sy, sw, sh, x, y, w, h) => {
    const snap = JR.px.snap, x0 = snap(x), y0 = snap(y);
    ctx.drawImage(A().image, sx, sy, sw, sh, x0, y0, snap(x + w) - x0, snap(y + h) - y0);
  };

  const maskAt = (lv, c, r) => {
    const s = (dc, dr) => (r + dr >= JR.ROWS ? 1 : lv.solid(c + dc, r + dr) ? 1 : 0);
    return s(0, -1) | s(1, 0) << 1 | s(0, 1) << 2 | s(-1, 0) << 3 | s(1, -1) << 4 | s(1, 1) << 5 | s(-1, 1) << 6 | s(-1, -1) << 7;
  };

  const drawTiles = (ctx, lv, camX) => {
    if (!A().ready) return;
    const T = JR.TILE, c0 = Math.floor(camX / T) - 1, c1 = c0 + Math.ceil(W() / T) + 2;
    const plat = A().frameAt('ship.platforms', 0);
    for (let c = c0; c <= c1; c++) {
      const set = TERRAIN[lv.biomeAt(Math.max(0, c))], f = A().frameAt(set.anim, 0);
      for (let r = 3; r < JR.ROWS; r++) {
        const t = lv.tile(c, r), x = c * T, y = r * T;
        if (t === '#') {
          const [qx, qy, notch] = JR.quarterFor(maskAt(lv, c, r), c, r);
          blit(ctx, f.x + set.ox + qx * set.q, f.y + set.oy + qy * set.q, set.q, set.q, x, y, T, T);
          const n = notch && set.notch && set.notch[notch];
          if (n) blit(ctx, f.x + n[0], f.y + n[1], 16, 16, x, y, T, T);
        } else if (t === '=') {
          const l = lv.platform(c - 1, r), rr = lv.platform(c + 1, r);
          const sx = !l ? 32 : !rr ? 112 : 48 + mod(c, 4) * 16;
          blit(ctx, plat.x + sx, plat.y + 32, 16, 16, x, y, T, T);
        }
      }
    }
  };

  // ---------- backdrops ----------

  // Sunset sky, sea, clouds and glints: the island and the merchant ship's deck share it.
  function seaBackdrop(ctx, camX, t) {
    const sky = A().frameAt('island.sky', 0);   // tiles stretched to whole device pixels: no seams
    for (let x = 0; x < W(); x += sky.w) for (let y = 0; y < 90; y += sky.h) blit(ctx, sky.x, sky.y, sky.w, sky.h, x, y, sky.w, sky.h);
    A().draw(ctx, 'island.bg', 0, 0, 90 + 128);
    const cw = A().frameAt('island.bigClouds', 0).w;
    for (let x = wrap(-camX * 0.06 - t * 2, cw, cw); x < W(); x += cw) A().draw(ctx, 'island.bigClouds', 0, x, 92);
    for (let i = 0; i < 3; i++) A().draw(ctx, 'island.smallCloud', 0, wrap(i * 170 + 40 - camX * 0.1 - t * 4, 520, 70), 30 + i * 14, { i });
    for (let i = 0; i < 4; i++) A().draw(ctx, 'island.reflectBig', t + i * 0.2, wrap(40 + i * 110 - camX * 0.2, 440, 40), 170);
    for (let i = 0; i < 3; i++) A().draw(ctx, 'island.reflectMedium', t + i * 0.3, wrap(95 + i * 140 - camX * 0.25, 420, 30), 160);
  }

  function interior(ctx, camX, t, wall, tile) {
    for (let x = wrap(-camX * 0.5, tile.w, tile.w); x < W(); x += tile.w) for (let y = 0; y < H(); y += tile.h) blit(ctx, wall.x, wall.y, wall.w, wall.h, x, y, tile.w, tile.h);
    for (let x = wrap(-camX * 0.5 + 40, 192, 192); x < W() + 96; x += 192) {
      A().draw(ctx, 'ship.window', t, x, 92);
      A().draw(ctx, 'ship.windowLight', 0, x - 32, 92 + 96, { alpha: 0.35 });
      A().draw(ctx, 'ship.chainBig', t, x + 80, 64);
      A().draw(ctx, 'ship.candle', t, x + 120, GROUND);
      A().draw(ctx, 'ship.candleLight', t, x + 104, GROUND + 6, { alpha: 0.35 });
    }
  }

  const drawBackdrop = (ctx, camX, t, biome) => {
    if (!A().ready) return;
    if (biome === 'beach') {
      seaBackdrop(ctx, camX, t);
      for (let i = 0; i < 3; i++) A().draw(ctx, 'island.backPalm', t + i * 0.3, wrap(i * 150 + 60 - camX * 0.45, 450, 40), GROUND + 2);
    } else if (biome === 'town') {
      seaBackdrop(ctx, camX, t);
      for (let i = 0; i < 2; i++) {
        const x = wrap(i * 260 + 120 - camX * 0.15 - t * 3, 560, 100), y = 168 + Math.round(Math.sin(t * 1.5 + i) * 1);
        A().draw(ctx, 'merchant.sail', t, x + 30, y - 22);
        A().draw(ctx, 'merchant.ship', t, x, y);
      }
    } else if (biome === 'fort') {
      const s = A().frameAt('hold.tiles', 0);
      interior(ctx, camX, t, { x: s.x + 224, y: s.y + 32, w: 128, h: 128 }, { w: 64, h: 64 });
    } else {
      const s = A().frameAt('ship.terrain', 0);
      interior(ctx, camX, t, { x: s.x + 64, y: s.y + 256, w: 32, h: 32 }, { w: 32, h: 32 });
    }
  };

  JR.artWorld = { drawTiles, drawBackdrop, TERRAIN };
})();
