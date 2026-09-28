// Cartoon art, all drawn in code: thick ink outlines, flat bright fills.
// Palette follows the Reef Runner logo: black skull sail, red-and-wood hull,
// sandbars below, storm clouds above, bright blue day sky.
window.Art = (() => {
  'use strict';
  const INK = '#1c1512';
  const TAU = Math.PI * 2;

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shapePath(ctx, s) {
    if (s.w === undefined) ctx.arc(s.x, s.y, s.r, 0, TAU);
    else rr(ctx, s.x, s.y, s.w, s.h, s.r || 0);
  }

  // Stroke every piece in ink first, then fill them all on top, so overlapping
  // circles and boxes read as one outlined cartoon blob.
  function blob(ctx, shapes, fill, outline = 6) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = outline;
    for (const s of shapes) { ctx.beginPath(); shapePath(ctx, s); ctx.stroke(); }
    ctx.fillStyle = fill;
    for (const s of shapes) { ctx.beginPath(); shapePath(ctx, s); ctx.fill(); }
  }

  function box(ctx, x, y, w, h, fill, r = 1) {
    ctx.fillStyle = fill;
    ctx.beginPath(); rr(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
  }

  // Pirate ship from the app icon, facing right; origin at the hull's waterline middle.
  function ship(ctx, x, y, tilt, stretch, t, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale * (1 - stretch * 0.14), scale * (1 + stretch * 0.14));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;

    box(ctx, -3, -60, 6, 58, '#6b4423', 2);

    // Red pennant streaming back from the masthead.
    const w = Math.sin(t * 10) * 2.5;
    ctx.fillStyle = '#e0392d';
    ctx.beginPath();
    ctx.moveTo(-1, -60);
    ctx.quadraticCurveTo(-12, -64 + w, -26, -60 + w * 1.5);
    ctx.quadraticCurveTo(-14, -56 + w, -1, -53);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath(); ctx.arc(0, -62, 3, 0, TAU); ctx.fill(); ctx.stroke();

    box(ctx, -24, -51, 46, 5, '#6b4423', 2);

    // Black sail, billowing.
    const puff = Math.sin(t * 3) * 2;
    ctx.fillStyle = '#232327';
    ctx.beginPath();
    ctx.moveTo(-21, -46);
    ctx.lineTo(18, -46);
    ctx.quadraticCurveTo(28 + puff, -28, 16, -12);
    ctx.lineTo(-19, -12);
    ctx.quadraticCurveTo(-10 + puff, -29, -21, -46);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#44444c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -44); ctx.quadraticCurveTo(-2 + puff, -29, -8, -14); ctx.stroke();

    // Skull and crossbones.
    const bone = '#f4efe2';
    ctx.strokeStyle = bone; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2, -26); ctx.lineTo(14, -17); ctx.moveTo(14, -26); ctx.lineTo(-2, -17); ctx.stroke();
    ctx.fillStyle = bone;
    for (const [bx, by] of [[-2, -26], [14, -17], [14, -26], [-2, -17]]) {
      ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(6, -33, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); rr(ctx, 2.5, -30, 7, 6, 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(3.8, -33.5, 1.7, 0, TAU); ctx.arc(8.2, -33.5, 1.7, 0, TAU); ctx.fill();

    // Cargo crates on deck.
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    box(ctx, -31, -21, 12, 12, '#c08a45');
    box(ctx, -18, -23, 14, 14, '#c9944d');
    ctx.strokeStyle = '#7a5226'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-29, -19); ctx.lineTo(-21, -11); ctx.moveTo(-21, -19); ctx.lineTo(-29, -11);
    ctx.moveTo(-16, -21); ctx.lineTo(-6, -11); ctx.moveTo(-6, -21); ctx.lineTo(-16, -11);
    ctx.stroke();

    // Hull: wood with a red upper band, gold rail and an upswept bow.
    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(-36, -10);
      ctx.lineTo(30, -10);
      ctx.quadraticCurveTo(39, -11, 46, -22);
      ctx.quadraticCurveTo(41, 15, 2, 19);
      ctx.quadraticCurveTo(-27, 19, -36, -10);
      ctx.closePath();
    };
    ctx.save();
    hull(); ctx.fillStyle = '#9a6232'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-40, -24, 90, 23);
    ctx.strokeStyle = '#6e4420'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-34, 8); ctx.lineTo(40, 6); ctx.moveTo(-30, 14); ctx.lineTo(34, 12); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#e8b23a'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-35, -9); ctx.lineTo(30, -9); ctx.quadraticCurveTo(38, -10, 45, -21); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    hull(); ctx.stroke();
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath(); ctx.arc(46, -22, 3.2, 0, TAU); ctx.fill(); ctx.stroke();

    // Cannon muzzles.
    for (const cx of [-17, 5]) {
      ctx.fillStyle = INK;
      ctx.beginPath(); rr(ctx, cx - 5, -1, 10, 8, 2); ctx.fill();
      ctx.fillStyle = '#3a3a40';
      ctx.beginPath(); ctx.arc(cx, 3, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Sandbar rising from the sea floor; `top` is the upper edge of the hitbox.
  function sandbar(ctx, x, top, w, far, s) {
    const foot = far - Math.min(70, (far - top) * 0.45);   // where the dune flares out
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(x - 30, far);
      ctx.quadraticCurveTo(x - 4, foot, x - 3, top + 34);
      ctx.bezierCurveTo(x, top + 4, x + w * 0.2, top, x + w * s.peak, top);
      ctx.bezierCurveTo(x + w * 0.8, top, x + w, top + 4, x + w + 3, top + 34);
      ctx.quadraticCurveTo(x + w + 4, foot, x + w + 30, far);
      ctx.closePath();
    };
    ctx.save();
    outline();
    ctx.fillStyle = '#f2cf82';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#d9ad5e';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.72, top); ctx.lineTo(x + w + 20, top); ctx.lineTo(x + w + 20, far); ctx.lineTo(x + w * 0.85, far);
    ctx.fill();
    ctx.fillStyle = '#fbe3aa';
    ctx.beginPath(); ctx.ellipse(x + w * 0.35, top + 12, w * 0.22, 5, 0, 0, TAU); ctx.fill();
    // Wind ripples in the sand.
    ctx.strokeStyle = '#c99a4c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const r of s.ripples) {
      const ry = top + r.v;
      ctx.beginPath();
      ctx.moveTo(x + w * r.u, ry);
      ctx.quadraticCurveTo(x + w * (r.u + 0.1), ry - 4, x + w * (r.u + 0.2), ry);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    outline(); ctx.stroke();

    // Beachcombing details: a shell and sometimes a starfish.
    ctx.lineWidth = 2;
    const sx = x + w * s.shell.u, sy = top + s.shell.v;
    ctx.fillStyle = '#ffd6de';
    ctx.beginPath(); ctx.arc(sx, sy, 5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (s.star) {
      const cx = x + w * s.star.u, cy = top + s.star.v;
      ctx.fillStyle = '#ff8a4c';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3 : 8;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // Storm cloud bank hanging down from the sky; `bottom` is the lower edge of the hitbox.
  function stormCloud(ctx, x, bottom, w, s, t) {
    const puffs = s.puffs.map(p => ({ x: x + p.u * w, y: bottom - p.r - p.lift, r: p.r }));
    // Billows down both sides so the bank reads as cloud, not a pillar.
    const sides = [];
    for (let y = bottom - 34, i = 0; y > -30; y -= 26, i++) {
      const j = s.jitter[i % s.jitter.length];
      sides.push({ x: x + 4 + j, y, r: 15 }, { x: x + w - 4 - j, y: y - 12, r: 15 });
    }
    const body = { x: x + 2, y: -40, w: w - 4, h: bottom - 14 + 40, r: 12 };
    blob(ctx, [body, ...sides, ...puffs], '#50566b', 5);
    ctx.fillStyle = '#687089';
    for (const p of [...sides, ...puffs]) {
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.5, 0, TAU); ctx.fill();
    }

    // Rain streaks and the odd lightning flicker below the cloud.
    ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const rx = x + ((i + 0.5) / 4) * w;
      const ry = bottom + 4 + ((t * 160 + i * 23 + s.phase * 40) % 26);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 7); ctx.stroke();
    }
    if ((t + s.phase) % 2.6 < 0.14) {
      const bx = x + w * s.bolt;
      ctx.lineJoin = 'miter';
      for (const [col, lw] of [[INK, 7], ['#ffe14d', 3.5]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(bx, bottom - 6); ctx.lineTo(bx - 7, bottom + 10); ctx.lineTo(bx + 3, bottom + 12); ctx.lineTo(bx - 5, bottom + 28);
        ctx.stroke();
      }
      ctx.lineJoin = 'round';
    }
  }

  // Random look for one obstacle pair, generated once so it doesn't flicker.
  function makeObstacle() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    return {
      peak: rnd(0.4, 0.6),
      ripples: Array.from({ length: 3 }, (_, i) => ({ u: rnd(0.1, 0.6), v: 40 + i * 45 + rnd(0, 20) })),
      shell: { u: rnd(0.2, 0.8), v: rnd(24, 60) },
      star: Math.random() < 0.4 ? { u: rnd(0.25, 0.75), v: rnd(70, 120) } : null,
      puffs: [0.08, 0.38, 0.66, 0.94].map((u, i) => ({ u, r: rnd(15, 20), lift: i === 1 || i === 2 ? 0 : rnd(4, 12) })),
      jitter: Array.from({ length: 5 }, () => rnd(-3, 4)),
      bolt: rnd(0.3, 0.7),
      phase: rnd(0, 2.6),
    };
  }

  function unionJack(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#1f3f8f'; ctx.fillRect(x, y, w, h);
    ctx.lineCap = 'butt';
    const diag = (col, lw) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
    };
    const cross = (col, lw) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
    };
    diag('#fff', h * 0.3); diag('#d0243a', h * 0.12);
    cross('#fff', h * 0.34); cross('#d0243a', h * 0.2);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  // Square sail bellied toward the bow (+x); used by the enemy ships.
  function squareSail(ctx, cx, top, w, h, puff) {
    ctx.fillStyle = '#fbf7ee';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, top);
    ctx.lineTo(cx + w / 2, top);
    ctx.quadraticCurveTo(cx + w / 2 + 6 + puff, top + h / 2, cx + w / 2, top + h);
    ctx.lineTo(cx - w / 2, top + h);
    ctx.quadraticCurveTo(cx - w / 2 + 6 + puff, top + h / 2, cx - w / 2, top);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // Spanish Cross of Burgundy: ragged red saltire.
  function burgundyCross(ctx, x, y, w, h, lw) {
    ctx.strokeStyle = '#c8202e'; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y + h * 0.15); ctx.lineTo(x + w * 0.85, y + h * 0.85);
    ctx.moveTo(x + w * 0.85, y + h * 0.15); ctx.lineTo(x + w * 0.15, y + h * 0.85);
    ctx.stroke();
    ctx.fillStyle = '#c8202e';   // the "ragged" knots along each branch
    for (const f of [0.3, 0.7]) {
      for (const [px, py] of [[f, f], [1 - f, f]]) {
        ctx.beginPath(); ctx.arc(x + w * px, y + h * py, lw * 0.75, 0, TAU); ctx.fill();
      }
    }
  }

  // British navy frigate facing left. `sink` runs 0→1 as it goes down;
  // `charge` 0→1 lights the bow gun just before it fires.
  function frigate(ctx, x, y, t, sink, charge) {
    ctx.save();
    ctx.translate(x, y + sink * 60);
    ctx.rotate(sink ? -sink * 0.7 : Math.sin(t * 2) * 0.04);
    ctx.globalAlpha = sink > 0.7 ? Math.max(0, (1 - sink) / 0.3) : 1;
    ctx.scale(-1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 3;

    box(ctx, -19, -76, 5, 68, '#5a3a1f', 2);
    box(ctx, 13, -66, 5, 58, '#5a3a1f', 2);
    unionJack(ctx, -39, -76, 20, 12);

    const puff = Math.sin(t * 3) * 1.5;
    const sail = (cx, top, w, h) => squareSail(ctx, cx, top, w, h, puff);
    sail(-16, -68, 30, 20);
    sail(-16, -44, 36, 26);
    sail(15, -60, 26, 18);
    sail(15, -39, 30, 22);
    // Red St George's cross on the big mainsail.
    ctx.strokeStyle = '#d0243a'; ctx.lineWidth = 4; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(-13, -44); ctx.lineTo(-13, -18); ctx.moveTo(-33, -31); ctx.lineTo(4, -31); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';

    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(-50, -22);
      ctx.lineTo(-30, -22);
      ctx.lineTo(-28, -10);
      ctx.lineTo(38, -10);
      ctx.quadraticCurveTo(47, -11, 54, -19);
      ctx.quadraticCurveTo(48, 16, 6, 20);
      ctx.quadraticCurveTo(-38, 20, -50, -22);
      ctx.closePath();
    };
    ctx.save();
    hull(); ctx.fillStyle = '#243a6b'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#f2c230'; ctx.fillRect(-60, -4, 120, 7);
    ctx.fillStyle = INK;
    for (let gx = -34; gx <= 30; gx += 13) { ctx.beginPath(); rr(ctx, gx, -3, 6, 5, 1); ctx.fill(); }
    ctx.restore();
    hull(); ctx.stroke();

    if (charge > 0) {
      ctx.fillStyle = `rgba(255,176,58,${0.4 + charge * 0.6})`;
      ctx.beginPath(); ctx.arc(54, -12, 3 + charge * 7, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,250,210,${charge})`;
      ctx.beginPath(); ctx.arc(54, -12, 2 + charge * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Spanish treasure galleon facing left: tall, tubby, red and gold, three masts.
  function galleon(ctx, x, y, t, sink, charge) {
    ctx.save();
    ctx.translate(x, y + sink * 70);
    ctx.rotate(sink ? sink * 0.6 : Math.sin(t * 1.6) * 0.03);
    ctx.globalAlpha = sink > 0.7 ? Math.max(0, (1 - sink) / 0.3) : 1;
    ctx.scale(-1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 3;

    box(ctx, -37, -84, 5, 60, '#5a3a1f', 2);
    box(ctx, -7, -104, 6, 82, '#5a3a1f', 2);
    box(ctx, 26, -88, 5, 70, '#5a3a1f', 2);

    const flutter = Math.sin(t * 9) * 1.5;
    ctx.fillStyle = '#fbf7ee';
    ctx.beginPath(); ctx.rect(-31, -104 + flutter * 0.3, 24, 15); ctx.fill(); ctx.stroke();
    burgundyCross(ctx, -31, -104 + flutter * 0.3, 24, 15, 2.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;

    const puff = Math.sin(t * 2.6) * 1.5;
    const sail = (cx, top, w, h) => squareSail(ctx, cx, top, w, h, puff);
    sail(-4, -96, 36, 24);
    sail(-4, -68, 44, 32);
    sail(28, -80, 28, 20);
    sail(28, -56, 32, 24);
    sail(-34, -76, 24, 22);
    burgundyCross(ctx, -24, -66, 36, 28, 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';

    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(-64, -44);
      ctx.lineTo(-38, -44);
      ctx.lineTo(-36, -24);
      ctx.lineTo(34, -18);
      ctx.quadraticCurveTo(47, -20, 58, -32);
      ctx.quadraticCurveTo(56, 18, 8, 24);
      ctx.quadraticCurveTo(-48, 24, -64, -44);
      ctx.closePath();
    };
    ctx.save();
    hull(); ctx.fillStyle = '#b8322a'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#7a4a24'; ctx.fillRect(-70, 6, 140, 24);
    ctx.fillStyle = '#e8b23a'; ctx.fillRect(-70, -14, 140, 6); ctx.fillRect(-70, 3, 140, 4);
    ctx.fillStyle = INK;
    for (let gx = -40; gx <= 32; gx += 13) { ctx.beginPath(); rr(ctx, gx, -5, 6, 6, 1); ctx.fill(); }
    ctx.fillStyle = '#ffd86b';   // lit stern-castle windows
    for (const wx of [-58, -50]) { ctx.beginPath(); rr(ctx, wx, -38, 5, 7, 1); ctx.fill(); }
    ctx.restore();
    hull(); ctx.stroke();

    // Gilded beakhead.
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath(); ctx.moveTo(56, -30); ctx.lineTo(70, -34); ctx.lineTo(58, -22); ctx.closePath(); ctx.fill(); ctx.stroke();

    if (charge > 0) {
      ctx.fillStyle = `rgba(255,176,58,${0.4 + charge * 0.6})`;
      ctx.beginPath(); ctx.arc(58, -8, 4 + charge * 9, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,250,210,${charge})`;
      ctx.beginPath(); ctx.arc(58, -8, 2 + charge * 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Health pips over a damaged enemy.
  function pips(ctx, x, y, hp, max) {
    for (let i = 0; i < max; i++) {
      const px = x + (i - (max - 1) / 2) * 16;
      ctx.fillStyle = i < hp ? '#ffd34e' : 'rgba(28,21,18,0.5)';
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, y, 5, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }

  // Comic-book starburst, optionally with a word in it ("KABOOM!").
  function burst(ctx, x, y, r, word, spin = 0) {
    const pts = 12;
    const star = (rad, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = spin + (i * Math.PI) / pts;
        const k = i % 2 ? rad * 0.62 : rad;
        ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k * 0.8);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    star(r, '#ff8a2a');
    star(r * 0.72, '#ffe14d');
    if (word) text(ctx, word, x, y + 1, Math.round(r * 0.42), '#fff');
  }

  // Seagull: a flapping "m" of two arcs.
  function gull(ctx, x, y, t, s = 1) {
    const flap = Math.sin(t) * 5 * s;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, lw] of [[INK, 4.5 * s], ['#ffffff', 2 * s]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x - 11 * s, y + flap);
      ctx.quadraticCurveTo(x - 5 * s, y - 7 * s - flap * 0.3, x, y);
      ctx.quadraticCurveTo(x + 5 * s, y - 7 * s - flap * 0.3, x + 11 * s, y + flap);
      ctx.stroke();
    }
  }

  // Tiny ship silhouette far out on the horizon.
  function distantSail(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(40,70,110,0.45)';
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, y); ctx.lineTo(x + 14 * s, y); ctx.lineTo(x + 10 * s, y + 5 * s); ctx.lineTo(x - 10 * s, y + 5 * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y - 2 * s); ctx.lineTo(x - 2 * s, y - 22 * s); ctx.lineTo(x + 9 * s, y - 4 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, y - 2 * s); ctx.lineTo(x - 4 * s, y - 16 * s); ctx.lineTo(x - 12 * s, y - 3 * s); ctx.closePath(); ctx.fill();
  }

  // Parchment scroll panel for the game-over screen.
  function panel(ctx, x, y, w, h) {
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x : x + w;
      ctx.fillStyle = '#d9b77a';
      ctx.beginPath(); rr(ctx, cx - 10, y - 8, 20, h + 16, 10); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#f5e2b5';
    ctx.beginPath(); rr(ctx, x, y, w, h, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d7b87e'; ctx.lineWidth = 2;
    ctx.beginPath(); rr(ctx, x + 10, y + 10, w - 20, h - 20, 4); ctx.stroke();
  }

  // Plain filled text in ink, for writing on parchment.
  function label(ctx, str, x, y, size, fill = INK, align = 'center') {
    ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  // Red ribbon banner ("NEW BEST!").
  function ribbon(ctx, x, y, w, word, tilt) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.fillStyle = '#9e1f1f';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * w / 2, -10); ctx.lineTo(side * (w / 2 + 22), -10); ctx.lineTo(side * (w / 2 + 14), 2);
      ctx.lineTo(side * (w / 2 + 22), 14); ctx.lineTo(side * w / 2, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#d63a2f';
    ctx.beginPath(); rr(ctx, -w / 2, -16, w, 28, 3); ctx.fill(); ctx.stroke();
    text(ctx, word, 0, -1, 18, '#ffe14d');
    ctx.restore();
  }

  function pauseButton(ctx, x, y, r, paused) {
    ctx.fillStyle = 'rgba(28,21,18,0.35)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    if (paused) {
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.45); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.3, y + r * 0.45);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      for (const dx of [-0.35, 0.12]) { ctx.beginPath(); rr(ctx, x + dx * r, y - r * 0.45, r * 0.23, r * 0.9, 2); ctx.fill(); ctx.stroke(); }
    }
  }

  // British man-o'-war boss: three gun decks, three masts, facing left.
  // `broadside` 0→1 lights every gun port before the wall of shot.
  function manOWar(ctx, x, y, t, sink, charge, broadside) {
    ctx.save();
    ctx.translate(x, y + sink * 90);
    ctx.rotate(sink ? -sink * 0.5 : Math.sin(t * 1.3) * 0.025);
    ctx.globalAlpha = sink > 0.75 ? Math.max(0, (1 - sink) / 0.25) : 1;
    ctx.scale(-1.4, 1.4);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;

    box(ctx, -32, -86, 4, 64, '#4a2f18', 2);
    box(ctx, 0, -98, 5, 76, '#4a2f18', 2);
    box(ctx, 30, -82, 4, 60, '#4a2f18', 2);

    // Long red commissioning pennant and a big Union Jack.
    const w = Math.sin(t * 8) * 2;
    ctx.fillStyle = '#d0243a';
    ctx.beginPath();
    ctx.moveTo(2, -98); ctx.quadraticCurveTo(-20, -103 + w, -44, -99 + w * 1.6); ctx.lineTo(2, -94);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    unionJack(ctx, -26, -92, 24, 14);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;

    const puff = Math.sin(t * 2.4) * 1.2;
    const sail = (cx, top, sw, sh) => squareSail(ctx, cx, top, sw, sh, puff);
    sail(-30, -80, 24, 16); sail(-30, -60, 28, 20);
    sail(2, -76, 30, 18);   sail(2, -54, 36, 26);
    sail(32, -76, 24, 16);  sail(32, -56, 30, 22);
    ctx.strokeStyle = '#d0243a'; ctx.lineWidth = 3.5; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(4, -54); ctx.lineTo(4, -28); ctx.moveTo(-15, -41); ctx.lineTo(24, -41); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';

    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(-68, -32);
      ctx.lineTo(-46, -32);
      ctx.lineTo(-44, -24);
      ctx.lineTo(44, -20);
      ctx.quadraticCurveTo(56, -22, 64, -32);
      ctx.quadraticCurveTo(60, 20, 10, 26);
      ctx.quadraticCurveTo(-52, 26, -68, -32);
      ctx.closePath();
    };
    const decks = [-15, -3, 9];
    ctx.save();
    hull(); ctx.fillStyle = '#1f2530'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#f2c230';
    for (const dy of decks) ctx.fillRect(-80, dy, 160, 5);
    ctx.fillStyle = INK;
    for (const dy of decks) for (let gx = -52; gx <= 46; gx += 11) { ctx.beginPath(); rr(ctx, gx, dy + 0.5, 5, 4, 1); ctx.fill(); }
    if (broadside > 0) {
      ctx.fillStyle = `rgba(255,170,50,${broadside})`;
      for (const dy of decks) for (let gx = -52; gx <= 46; gx += 11) {
        ctx.beginPath(); ctx.arc(gx + 2.5, dy + 2.5, 2 + broadside * 3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    hull(); ctx.stroke();
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.moveTo(62, -30); ctx.lineTo(74, -35); ctx.lineTo(64, -22); ctx.closePath(); ctx.fill(); ctx.stroke();

    if (charge > 0) {
      ctx.fillStyle = `rgba(255,176,58,${0.4 + charge * 0.6})`;
      ctx.beginPath(); ctx.arc(64, -12, 3 + charge * 7, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function bossBar(ctx, x, y, w, frac, name) {
    text(ctx, name, x, y - 15, 15, '#ffd34e');
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(28,21,18,0.55)';
    ctx.beginPath(); rr(ctx, x - w / 2, y - 6, w, 12, 6); ctx.fill();
    ctx.fillStyle = '#d63a2f';
    ctx.beginPath(); rr(ctx, x - w / 2, y - 6, Math.max(12, w * frac), 12, 6); ctx.fill();
    ctx.beginPath(); rr(ctx, x - w / 2, y - 6, w, 12, 6); ctx.stroke();
  }

  function sparkle(ctx, x, y, r, t) {
    ctx.strokeStyle = `rgba(255,248,200,${0.5 + Math.sin(t * 6) * 0.5})`;
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  }

  // Floating treasure chest, lid cracked open on a glint of gold.
  function chest(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3) * 3);
    ctx.rotate(Math.sin(t * 2) * 0.08);
    const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 30);
    glow.addColorStop(0, 'rgba(255,225,77,0.55)'); glow.addColorStop(1, 'rgba(255,225,77,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -4, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffd34e';
    for (const cx of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(cx, -9, 4, 0, TAU); ctx.fill(); ctx.stroke(); }
    box(ctx, -15, -5, 30, 17, '#9a5a2a', 2);
    ctx.fillStyle = '#b06a32';
    ctx.beginPath();
    ctx.moveTo(-15, -6); ctx.lineTo(-15, -12); ctx.quadraticCurveTo(0, -24, 15, -14); ctx.lineTo(15, -8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2c230';
    for (const bx of [-10, 7]) { ctx.beginPath(); ctx.rect(bx, -5, 3, 17); ctx.fill(); ctx.stroke(); }
    box(ctx, -3, -7, 6, 7, '#f2c230', 1);
    ctx.restore();
    sparkle(ctx, x + 14, y - 16, 5, t);
    sparkle(ctx, x - 16, y - 2, 3.5, t + 1.3);
  }

  // Rum barrel: grab it for rapid fire.
  function barrel(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3 + 1) * 3);
    ctx.rotate(Math.sin(t * 2.3) * 0.12);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = '#a0612e';
    ctx.beginPath();
    ctx.moveTo(-10, -15); ctx.quadraticCurveTo(-16, 0, -10, 15); ctx.lineTo(10, 15);
    ctx.quadraticCurveTo(16, 0, 10, -15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#4b4b55'; ctx.lineWidth = 3;
    for (const by of [-9, 9]) { ctx.beginPath(); ctx.moveTo(-13, by); ctx.lineTo(13, by); ctx.stroke(); }
    ctx.restore();
    text(ctx, 'XXX', x, y + Math.sin(t * 3 + 1) * 3, 9, '#fff');
  }

  function cannonball(ctx, x, y, r = 6) {
    ctx.fillStyle = '#26262b'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6a6a74';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU); ctx.fill();
  }

  // Round fire button with a reload ring; `ready` runs 0→1.
  function fireButton(ctx, x, y, r, ready, label) {
    ctx.fillStyle = 'rgba(28,21,18,0.35)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = ready >= 1 ? '#ffd34e' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * ready); ctx.stroke();
    ctx.globalAlpha = ready >= 1 ? 1 : 0.55;
    cannonball(ctx, x, y - 5, r * 0.3);
    text(ctx, label, x, y + r * 0.45, 11);
    ctx.globalAlpha = 1;
  }

  // Distant island with a fort, like the one in the logo. `y` is the horizon.
  function island(ctx, x, y) {
    ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    blob(ctx, [
      { x: x - 60, y: y - 14, w: 130, h: 16, r: 8 },
      { x: x - 30, y: y - 20, r: 18 }, { x: x + 20, y: y - 18, r: 20 },
    ], '#4fae4a', 3);
    ctx.fillStyle = '#8a8378';
    ctx.beginPath(); ctx.moveTo(x - 64, y); ctx.lineTo(x - 50, y - 12); ctx.lineTo(x + 60, y - 12); ctx.lineTo(x + 74, y); ctx.closePath();
    ctx.lineWidth = 3; ctx.fill(); ctx.stroke();

    ctx.lineWidth = 2.5;
    box(ctx, x - 12, y - 58, 26, 42, '#a39c8f', 1);
    for (let i = 0; i < 3; i++) box(ctx, x - 13 + i * 10, y - 64, 7, 7, '#a39c8f', 1);
    ctx.fillStyle = INK;
    ctx.beginPath(); rr(ctx, x - 1, y - 46, 5, 8, 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 10, y - 64); ctx.lineTo(x + 10, y - 82); ctx.stroke();
    ctx.fillStyle = '#e0392d';
    ctx.beginPath(); ctx.moveTo(x + 10, y - 82); ctx.lineTo(x + 24, y - 78); ctx.lineTo(x + 10, y - 73); ctx.closePath(); ctx.fill(); ctx.stroke();

    for (const [px, lean] of [[x - 40, -1], [x + 44, 1]]) {
      ctx.strokeStyle = INK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(px, y - 14); ctx.quadraticCurveTo(px + lean * 4, y - 30, px + lean * 8, y - 42); ctx.stroke();
      ctx.strokeStyle = '#8a6236'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(px, y - 14); ctx.quadraticCurveTo(px + lean * 4, y - 30, px + lean * 8, y - 42); ctx.stroke();
      const tx = px + lean * 8, ty = y - 42;
      const leaves = [];
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        leaves.push({ x: tx + Math.cos(a) * 9, y: ty + Math.sin(a) * 5 + 3, r: 5 });
      }
      blob(ctx, leaves, '#3f9a45', 3);
    }
  }

  function cloud(ctx, x, y, s) {
    blob(ctx, [
      { x: x, y: y, r: 18 * s }, { x: x + 22 * s, y: y - 10 * s, r: 22 * s },
      { x: x + 46 * s, y: y, r: 17 * s }, { x: x - 4 * s, y: y - 6 * s, w: 54 * s, h: 20 * s, r: 10 * s },
    ], '#ffffff', 4);
  }

  // Big outlined title text.
  function text(ctx, str, x, y, size, fill = '#fff', align = 'center') {
    ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 6);
    ctx.strokeStyle = INK;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  return { INK, blob, ship, frigate, galleon, manOWar, bossBar, chest, barrel, pips, burst, gull, distantSail, panel, label, ribbon, pauseButton, cannonball, fireButton, sandbar, stormCloud, makeObstacle, island, cloud, text, rr };
})();
