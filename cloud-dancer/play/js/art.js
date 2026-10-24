// Drawing: everything is code-drawn cartoon art (canvas shapes with a dark outline), in game units.
// The game sets the context scale; positions passed in are already interpolated.
(() => {
  const CD = window.CD;
  const art = (CD.art = {});
  const INK = '#2a1a12';
  const W = () => CD.VIEW_W, H = () => CD.VIEW_H;

  const BRASS = '#d9a441', BRASS_D = '#9a6a24', WOOD = '#8a5230', WOOD_D = '#5c3418', CANVAS = '#f1e6cc', CANVAS_D = '#d6c7a4';

  function outline(ctx, w = 1.2) { ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke(); }
  function ellipse(ctx, x, y, rx, ry, fill, line = 1.2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (line) outline(ctx, line);
  }

  // ---------- sky: three bands, far to near ----------

  const cloud = (ctx, x, y, s, col = '#ffffff', shade = '#dfe9f3') => {
    const blobs = [[0, 0, 14], [14, -6, 12], [28, 0, 13], [10, 6, 12], [22, 6, 11]];
    for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s + 2 * s, r * s, 0, 7); ctx.fillStyle = shade; ctx.fill(); }
    for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fillStyle = col; ctx.fill(); }
  };
  const wrap = (x, span, pad = 0) => ((x % span) + span) % span - pad;

  // Sky colours per area: high sky, mid, horizon, sea top, sea bottom.
  const SKIES = {
    reef: ['#2f7fd6', '#8fd0f7', '#cfeeff', '#4fb7d6', '#1d6aa0'],
    storm: ['#3a4660', '#6c7a92', '#9aa6b8', '#46667e', '#24384c'],
    forts: ['#e07a4a', '#f6b26b', '#ffe0a8', '#4f9fc2', '#1f5d8c'],
    ceiling: ['#1b2a6b', '#4a5fb0', '#9fb4ea', '#3e86b8', '#1a4a7a'],
  };
  art.drawSky = (ctx, dist, t, area = 'reef') => {
    // high sky to the sea far below
    const c = SKIES[area] || SKIES.reef;
    const g = ctx.createLinearGradient(0, 0, 0, H());
    g.addColorStop(0, c[0]); g.addColorStop(0.42, c[1]); g.addColorStop(0.62, c[2]);
    g.addColorStop(0.63, c[3]); g.addColorStop(1, c[4]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W(), H());
    // far islands on the sea below
    for (let i = 0; i < 3; i++) {
      const x = wrap(i * 180 + 60 - dist * 0.08, 540, 80), y = H() * 0.66 + i * 6;
      ctx.beginPath(); ctx.ellipse(x, y + 4, 34 - i * 6, 7, 0, Math.PI, 0); ctx.fillStyle = '#3f8f5a'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + 4, 38 - i * 6, 3, 0, 0, Math.PI * 2); ctx.fillStyle = '#e8d49a'; ctx.fill();
    }
    // sparkles on the sea
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 18; i++) {
      const x = wrap(i * 47 - dist * 0.15 - t * 6, W() + 40, 20), y = H() * 0.7 + (i * 29) % 60;
      ctx.fillRect(x, y, 6, 1);
    }
    // floating rocks of the Sky-Forts and the Ceiling, far off
    if (area === 'forts' || area === 'ceiling') {
      for (let i = 0; i < 3; i++) {
        const x = wrap(i * 170 + 30 - dist * 0.12, 510, 60), y = 40 + i * 22;
        ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.lineTo(x + 8, y + 16); ctx.lineTo(x - 4, y + 22); ctx.lineTo(x - 14, y + 10); ctx.closePath();
        ctx.fillStyle = area === 'forts' ? '#8a6a5a' : '#5a6488'; ctx.fill();
        ctx.fillStyle = area === 'forts' ? '#6f9a52' : '#8a98c8'; ctx.fillRect(x - 22, y - 2, 44, 3);
        if (area === 'forts') { ctx.fillStyle = '#9a8c80'; ctx.fillRect(x - 6, y - 12, 10, 10); ctx.fillRect(x - 8, y - 14, 3, 3); ctx.fillRect(x + 3, y - 14, 3, 3); }
      }
    }
    // far cloud band (behind the ship)
    const storm = area === 'storm';
    for (let i = 0; i < 6; i++) cloud(ctx, wrap(i * 90 - dist * 0.3, 560, 70), 118 + (i % 2) * 12, 0.9 + (i % 3) * 0.15, storm ? '#aab4c4' : '#f7fbff', storm ? '#7c889c' : '#d5e4f2');
    for (let i = 0; i < 4; i++) cloud(ctx, wrap(i * 140 + 40 - dist * 0.18, 560, 70), 30 + (i % 2) * 18, 0.6, 'rgba(255,255,255,.75)', 'rgba(210,228,245,.6)');
  };

  // Near clouds drift in front of everything.
  art.drawNearClouds = (ctx, dist) => {
    for (let i = 0; i < 2; i++) cloud(ctx, wrap(i * 300 + 120 - dist * 0.9, 700, 90), 150 + i * 40, 1.6, 'rgba(255,255,255,.82)', 'rgba(215,230,245,.7)');
  };

  // ---------- the Cloud Dancer ----------

  // Hangar colours: envelope [main, shade], hull [main, dark], sail [cloth, mark].
  const ENVELOPES = { cream: [CANVAS, CANVAS_D], red: ['#d24a3e', '#a33028'], navy: ['#3d5f9c', '#2a4474'], black: ['#4a4352', '#2e2a36'], gold: ['#ecc256', '#c0922e'] };
  const HULLS = { oak: [WOOD, WOOD_D], ebony: ['#4a3630', '#2c1e1a'], crimson: ['#9a3030', '#6a1e1e'] };
  const SAILS = { roger: ['#1d1a1f', '#f1e6cc'], swords: ['#1d1a1f', '#f1e6cc'], red: ['#b8322a', '#1d1a1f'] };

  art.drawShip = (ctx, s, x, y, t) => {
    if (s.inv > 0 && !s.dash && Math.floor(t * 20) % 2) return;
    const look = s.look || {}, env = ENVELOPES[look.envelope] || ENVELOPES.cream, hull = HULLS[look.hull] || HULLS.oak, sail = SAILS[look.sail] || SAILS.roger;
    ctx.save();
    ctx.translate(x + s.w / 2, y + s.h / 2);
    ctx.rotate(s.tilt);
    const sway = Math.sin(t * 2) * 0.8;
    // steam trail while dashing
    if (s.dash > 0) {
      for (let i = 0; i < 6; i++) ellipse(ctx, -22 - i * 7, 4 + Math.sin(t * 30 + i) * 2, 5 - i * 0.5, 4 - i * 0.4, `rgba(255,255,255,${0.8 - i * 0.12})`, 0);
    }
    // gas envelope with brass ribs
    ctx.save(); ctx.translate(0, -5 + sway * 0.3);
    ellipse(ctx, 0, 0, 19, 7.5, env[0]);
    if (look.pattern === 'stripes' || look.pattern === 'checker') {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 19, 7.5, 0, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = env[1];
      for (let i = -19; i < 19; i += 6) {
        if (look.pattern === 'stripes') ctx.fillRect(i, -8, 3, 16);
        else for (let j = -8; j < 8; j += 6) if (((i + 19) / 6 + (j + 8) / 6) % 2 < 1) ctx.fillRect(i, j, 3, 3);
      }
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 2.5, 17, 4, 0, 0, Math.PI); ctx.fillStyle = env[1]; ctx.globalAlpha *= 0.7; ctx.fill(); ctx.globalAlpha /= 0.7;
    ctx.strokeStyle = BRASS_D; ctx.lineWidth = 1;
    for (const rx of [-11, -4, 4, 11]) { ctx.beginPath(); ctx.ellipse(rx, 0, 1.6, Math.sqrt(1 - (rx / 19) ** 2) * 7.5, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(19, 0); ctx.stroke();
    ellipse(ctx, 0, 0, 19, 7.5, 'rgba(0,0,0,0)');
    // tail fin
    ctx.beginPath(); ctx.moveTo(-17, -2); ctx.lineTo(-24, -7); ctx.lineTo(-22, 0); ctx.lineTo(-24, 6); ctx.lineTo(-17, 2); ctx.closePath();
    ctx.fillStyle = BRASS; ctx.fill(); outline(ctx);
    ctx.restore();
    // rigging
    ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
    for (const rx of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(rx, 1); ctx.lineTo(rx * 0.8, 6); ctx.stroke(); }
    // hull
    ctx.beginPath();
    ctx.moveTo(-15, 5); ctx.lineTo(13, 5); ctx.quadraticCurveTo(17, 5, 19, 3); ctx.lineTo(17, 9);
    ctx.quadraticCurveTo(8, 13, -11, 12); ctx.quadraticCurveTo(-15, 10, -15, 5); ctx.closePath();
    ctx.fillStyle = hull[0]; ctx.fill(); outline(ctx);
    ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(16, 7); ctx.strokeStyle = hull[1]; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = BRASS; for (const px of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(px, 9, 1.2, 0, 7); ctx.fill(); }
    // bowsprit + cannon
    ctx.beginPath(); ctx.moveTo(17, 5); ctx.lineTo(25, 1); ctx.strokeStyle = WOOD_D; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(15, 6.5, 6, 2.4);
    // black sail with a skull on a short mast
    ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(2, -14); ctx.strokeStyle = WOOD_D; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(-3 + sway, -6, -6, 1); ctx.lineTo(1, 1); ctx.lineTo(1, -12); ctx.closePath();
    ctx.fillStyle = sail[0]; ctx.fill(); outline(ctx, 0.8);
    if (look.sail === 'swords') {
      ctx.strokeStyle = sail[1]; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(0, -2); ctx.moveTo(0, -10); ctx.lineTo(-5, -2); ctx.stroke();
    } else {
      ellipse(ctx, -2.6, -6.5, 1.7, 1.5, sail[1], 0);
      ctx.fillStyle = sail[1]; ctx.fillRect(-3.4, -5.2, 1.6, 1);
    }
    // flag
    ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(9, -13 + Math.sin(t * 9) * 1.2); ctx.lineTo(2, -11); ctx.fillStyle = '#1d1a1f'; ctx.fill();
    // stern propeller, spinning
    ctx.fillStyle = BRASS; ctx.fillRect(-19, 6, 4, 3);
    const spin = Math.abs(Math.sin(t * 40));
    ctx.beginPath(); ctx.ellipse(-20, 7.5, 1.4, 6 * spin + 1, 0, 0, Math.PI * 2); ctx.fillStyle = '#b5743a'; ctx.fill(); outline(ctx, 0.8);
    if (s.pet === 'parrot') art.drawParrot(ctx, 23, -1 + Math.sin(t * 5) * 0.6, t);   // perched on the bowsprit
    ctx.restore();
  };

  art.drawParrot = (ctx, x, y, t) => {
    ctx.save(); ctx.translate(x, y);
    ellipse(ctx, 0, 0, 2.6, 3.4, '#2fa84f', 0.7);
    ellipse(ctx, 0.6, -3.6, 2, 2, '#e04848', 0.7);
    ctx.beginPath(); ctx.moveTo(2.3, -3.8); ctx.lineTo(4.2, -3); ctx.lineTo(2.3, -2.6); ctx.fillStyle = '#ffd34e'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(0.9, -4.4, 0.8, 0.8);
    const flap = Math.sin(t * 12) > 0.6 ? -2 : 0;
    ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(-3.5, 1 + flap); ctx.lineTo(-0.5, 1.5); ctx.fillStyle = '#3c6fd0'; ctx.fill();
    ctx.restore();
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

  art.drawGyro = (ctx, e, x, y, t) => {
    ctx.save(); ctx.translate(x + e.w / 2, y + e.h / 2);
    const white = e.flash > 0;
    // body: navy-blue pod with a red, white and blue roundel
    ellipse(ctx, 0, 1, 8, 4.5, white ? '#fff' : '#2c4f8c');
    ellipse(ctx, -2, 1, 2.2, 2.2, white ? '#fff' : '#fff', 0.6);
    ellipse(ctx, -2, 1, 1.2, 1.2, white ? '#fff' : '#c8323a', 0);
    // cockpit and tail
    ellipse(ctx, 4, -0.5, 2.5, 2, '#9fd6f2', 0.6);
    ctx.beginPath(); ctx.moveTo(7, 1); ctx.lineTo(10, -2); ctx.lineTo(10, 3); ctx.closePath(); ctx.fillStyle = white ? '#fff' : '#2c4f8c'; ctx.fill(); outline(ctx, 0.8);
    // rotor
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0, -6); ctx.stroke();
    const r = 9 * Math.abs(Math.cos(t * 30));
    ctx.beginPath(); ctx.ellipse(0, -6, r + 1, 1, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,60,70,.75)'; ctx.fill();
    ctx.restore();
  };

  // A navy zeppelin: long grey-blue envelope with a roundel, a gondola with a gun deck, twin
  // propellers. `fire` (0-1) flashes the gun ports.
  art.drawZeppelin = (ctx, x, y, t, { flash = false, fire = 0, flip = true } = {}) => {
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    const body = flash ? '#ffffff' : '#7d8ea6', shade = flash ? '#ffffff' : '#5e6f88';
    // envelope
    ellipse(ctx, 0, 0, 38, 12, body);
    ctx.beginPath(); ctx.ellipse(0, 4, 35, 6.5, 0, 0, Math.PI); ctx.fillStyle = shade; ctx.fill();
    ctx.strokeStyle = shade; ctx.lineWidth = 0.8;
    for (const rx of [-24, -12, 0, 12, 24]) { ctx.beginPath(); ctx.ellipse(rx, 0, 2, Math.sqrt(1 - (rx / 38) ** 2) * 12, 0, 0, Math.PI * 2); ctx.stroke(); }
    ellipse(ctx, 0, 0, 38, 12, 'rgba(0,0,0,0)');
    // tail fins
    for (const dy of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-32, dy * 4); ctx.lineTo(-44, dy * 13); ctx.lineTo(-41, dy * 2); ctx.closePath();
      ctx.fillStyle = flash ? '#fff' : '#2c4f8c'; ctx.fill(); outline(ctx, 0.9);
    }
    // roundel
    ellipse(ctx, 12, -2, 5, 5, '#2c4f8c', 0.8); ellipse(ctx, 12, -2, 3.3, 3.3, '#ffffff', 0); ellipse(ctx, 12, -2, 1.8, 1.8, '#c8323a', 0);
    // gondola with gun ports
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6;
    for (const gx of [-8, 8]) { ctx.beginPath(); ctx.moveTo(gx, 10); ctx.lineTo(gx * 0.8, 15); ctx.stroke(); }
    ctx.beginPath(); ctx.roundRect(-14, 14, 28, 8, 3); ctx.fillStyle = flash ? '#fff' : '#4a3a2c'; ctx.fill(); outline(ctx, 0.9);
    for (const gx of [-8, -1, 6]) {
      ctx.fillStyle = fire > 0 ? '#ffd34e' : '#20180f'; ctx.fillRect(gx, 16.5, 4, 3);
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(gx + 1, 19.5, 2, 3);
    }
    // propellers
    for (const py of [-6, 6]) {
      ctx.fillStyle = BRASS; ctx.fillRect(-40, py - 1, 4, 2);
      const spin = Math.abs(Math.sin(t * 35 + py));
      ctx.beginPath(); ctx.ellipse(-41, py, 1, 5 * spin + 0.8, 0, 0, Math.PI * 2); ctx.fillStyle = '#9aa4b4'; ctx.fill(); outline(ctx, 0.6);
    }
    // navy pennant
    ctx.beginPath(); ctx.moveTo(-20, -11); ctx.lineTo(-20, -19); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, -19); ctx.lineTo(-13, -17.5 + Math.sin(t * 8)); ctx.lineTo(-20, -16); ctx.fillStyle = '#c8323a'; ctx.fill();
    ctx.restore();
  };

  // A balloon mine: a striped balloon carrying a spiked sea mine with a blinking light.
  art.drawMine = (ctx, x, y, t) => {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2 + x) * 2);
    ellipse(ctx, 0, -12, 7, 8, '#c8323a');
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -12, 7, 8, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#f1e6cc'; ctx.fillRect(-2, -20, 4, 16); ctx.restore();
    ellipse(ctx, 0, -12, 7, 8, 'rgba(0,0,0,0)');
    ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 1); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4, 6 + Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * 7, 6 + Math.sin(a) * 7);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ellipse(ctx, 0, 6, 5, 5, '#3a3a44');
    ellipse(ctx, -1.5, 4.5, 1.2, 1.2, '#7a7a88', 0);
    ellipse(ctx, 0, 6, 1.3, 1.3, Math.floor(t * 4) % 2 ? '#ff4d4d' : '#5a1a1a', 0);
    ctx.restore();
  };

  // A cloud bank in the middle band: big enough to hide the Cloud Dancer in.
  art.drawCloudBank = (ctx, x, y, w, t, alpha = 1, storm = false, ink = false) => {
    ctx.save(); ctx.globalAlpha = alpha;
    const n = Math.max(3, Math.round(w / 22));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const bx = x + (i + 0.5) * (w / n), r = 16 + ((i * 7) % 5) * 3 + Math.sin(t * 0.8 + i) * 1.5;
        ctx.beginPath(); ctx.arc(bx, y + (pass ? 0 : 4) + ((i * 13) % 7) - 3, r, 0, 7);
        ctx.fillStyle = ink ? (pass ? '#3a2c4a' : '#241a30') : storm ? (pass ? '#aab4c4' : '#7c889c') : (pass ? '#ffffff' : '#d5e4f2'); ctx.fill();
      }
    }
    ctx.restore();
  };

  // A flak tower on a rocky islet far below: brass dome, gun pointing up.
  art.drawFlak = (ctx, x, y, t, flash) => {
    ctx.save(); ctx.translate(x + 9, y);
    ctx.beginPath(); ctx.ellipse(0, 22, 22, 6, 0, Math.PI, 0); ctx.fillStyle = '#3f8f5a'; ctx.fill(); outline(ctx, 0.8);
    ctx.beginPath(); ctx.ellipse(0, 22, 24, 3, 0, 0, Math.PI * 2); ctx.fillStyle = '#e8d49a'; ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#7c7466'; ctx.fillRect(-7, 6, 14, 12); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-7, 6, 14, 12);
    ctx.beginPath(); ctx.arc(0, 6, 7, Math.PI, 0); ctx.fillStyle = flash ? '#fff' : BRASS; ctx.fill(); outline(ctx);
    ctx.save(); ctx.rotate(-0.5 + Math.sin(t * 1.5) * 0.3); ctx.fillStyle = '#3a3a44'; ctx.fillRect(-1.5, -9, 3, 12); ctx.restore();
    ctx.restore();
  };

  // A sky pike: an armoured flying fish of the storm. `tell` = about to dart (eye glows, fins flare).
  art.drawPike = (ctx, x, y, t, flash, tell) => {
    ctx.save(); ctx.translate(x + 11, y + 5);
    const body = flash ? '#fff' : '#5a7a8c';
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-2, -7, 9, -1); ctx.lineTo(12, 0); ctx.lineTo(9, 1); ctx.quadraticCurveTo(-2, 7, -11, 0); ctx.closePath();
    ctx.fillStyle = body; ctx.fill(); outline(ctx, 0.9);
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(16, -2); ctx.lineTo(16, 2); ctx.closePath(); ctx.fillStyle = BRASS; ctx.fill(); outline(ctx, 0.6);
    const flap = Math.sin(t * (tell ? 40 : 14)) * (tell ? 5 : 3);
    ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-6, -7 - flap); ctx.lineTo(2, -4); ctx.fillStyle = '#9fd6f2'; ctx.fill(); outline(ctx, 0.6);
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-16, -4); ctx.lineTo(-15, 0); ctx.lineTo(-16, 4); ctx.closePath(); ctx.fillStyle = body; ctx.fill(); outline(ctx, 0.6);
    ellipse(ctx, 5, -1.5, 1.4, 1.4, tell ? '#ff4d4d' : '#fff', 0.5);
    ctx.restore();
  };

  // A cloud lurker: a small navy pod with a periscope that hides in cloud banks.
  art.drawLurker = (ctx, x, y, t, flash) => {
    ctx.save(); ctx.translate(x + 10, y + 7);
    ellipse(ctx, 0, 0, 10, 6, flash ? '#fff' : '#2c4f8c');
    ellipse(ctx, -3, 0, 2, 2, '#fff', 0.5); ellipse(ctx, -3, 0, 1, 1, '#c8323a', 0);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(-12, 1, 5, 2);
    ctx.fillStyle = BRASS; ctx.fillRect(2, -11, 2, 6); ctx.fillRect(2, -11, 5, 2);
    ctx.restore();
  };
  // Only the periscope and a glint show above the cloud while it hides.
  art.drawLurkerEyes = (ctx, x, y, t) => {
    ctx.fillStyle = BRASS; ctx.fillRect(x + 12, y - 6, 2, 6); ctx.fillRect(x + 12, y - 6, 5, 2);
    if (Math.floor(t * 3) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 17, y - 6, 2, 2); }
  };

  // Lightning: a flickering warning line, then a jagged bolt top to bottom.
  art.drawBolt = (ctx, b, t) => {
    if (b.warn > 0) {
      if (Math.floor(t * 16) % 2) return;
      ctx.fillStyle = 'rgba(255,240,140,.35)'; ctx.fillRect(b.x - 8, 0, 16, H());
      ctx.fillStyle = 'rgba(255,240,140,.9)'; ctx.fillRect(b.x - 0.5, 0, 1, H());
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, 0, W(), H());
    ctx.beginPath(); let px = b.x; ctx.moveTo(px, 0);
    for (let y = 12; y <= H(); y += 12) { px = b.x + (((y * 7919 + Math.floor(t * 30) * 31) % 13) - 6); ctx.lineTo(px, y); }
    ctx.strokeStyle = '#fff8c0'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
  };

  // Cloud banks from the world (cover): drawn over the ship and lurkers so hiding looks like hiding.
  art.drawCloudBanks = (ctx, clouds, t, storm) => {
    for (const c of clouds) art.drawCloudBank(ctx, c.x, c.y + c.h / 2, c.w, t, 0.9, storm, c.ink);
  };

  art.drawShot = (ctx, b) => {
    if (b.harpoon || b.rocket) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy || 0, b.vx || 1));
      if (b.harpoon) { ctx.fillStyle = WOOD_D; ctx.fillRect(-12, -0.8, 12, 1.6); ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(5, 0); ctx.lineTo(0, 2.5); ctx.fillStyle = '#c8ccd8'; ctx.fill(); outline(ctx, 0.5); }
      else { ctx.fillStyle = '#c8323a'; ctx.fillRect(-5, -1.5, 8, 3); ctx.beginPath(); ctx.moveTo(3, -1.5); ctx.lineTo(6, 0); ctx.lineTo(3, 1.5); ctx.fill(); ellipse(ctx, -7, 0, 2.5, 1.5, '#ffd34e', 0); }
      ctx.restore(); return;
    }
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 0.4, 0, 7);
    ctx.fillStyle = b.friendly ? '#2b2b33' : '#c8323a'; ctx.fill(); outline(ctx, 0.6);
    if (b.friendly) { ctx.beginPath(); ctx.arc(b.x - 0.6, b.y - 0.6, 0.6, 0, 7); ctx.fillStyle = '#9a9aa8'; ctx.fill(); }
  };

  const GUN_LETTER = { chain: 'C', harpoon: 'H', rockets: 'R', gatling: 'G' };
  art.drawPickup = (ctx, k, t) => {
    if (k.type === 'weapon') {
      const bob = Math.sin(t * 4) * 1.5;
      ctx.beginPath(); ctx.moveTo(k.x + 5, k.y - 6 + bob); ctx.lineTo(k.x + 5, k.y + 1 + bob); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
      ellipse(ctx, k.x + 5, k.y - 9 + bob, 4, 4.5, '#f1e6cc', 0.8);
      ctx.fillStyle = WOOD; ctx.fillRect(k.x, k.y + bob, 10, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(k.x, k.y + bob, 10, 10);
      art.text(ctx, GUN_LETTER[k.gun] || '?', k.x + 5, k.y + 5.5 + bob, { size: 7, color: '#ffd34e', align: 'center' });
      return;
    }
    if (k.type === 'coal') { ctx.fillStyle = '#5c3418'; ctx.fillRect(k.x, k.y + 3, 10, 7); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(k.x, k.y + 3, 10, 7); for (const [dx, dy] of [[2, 2], [5, 1], [7, 3]]) ellipse(ctx, k.x + dx, k.y + dy + 2, 2, 1.6, '#222228', 0.4); return; }
    if (k.type === 'repair') { ctx.save(); ctx.translate(k.x + 5, k.y + 5); ctx.rotate(-0.7 + Math.sin(t * 3) * 0.2); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(-1.2, -4, 2.4, 9); ctx.beginPath(); ctx.arc(0, -5, 3, 0, 7); ctx.fill(); outline(ctx, 0.6); ctx.fillStyle = '#e04848'; ctx.fillRect(-1.2, 1, 2.4, 4); ctx.restore(); return; }
    const sq = Math.abs(Math.cos(t * 5 + k.x * 0.1));
    ctx.beginPath(); ctx.ellipse(k.x + 4, k.y + 4, 3.6 * sq + 0.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f4c542'; ctx.fill(); outline(ctx, 0.8);
  };

  art.drawFx = (ctx, f) => {
    if (f.type !== 'boom' || f.t > 0.45) return;          // longer timers are a delay (a boss going down in stages)
    const k = 1 - f.t / 0.45, r = f.r * (0.5 + k * 0.7);
    ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
    ellipse(ctx, f.x, f.y, r, r, k < 0.3 ? '#fff4b0' : '#ff9a3c', 0);
    ellipse(ctx, f.x, f.y, r * 0.6, r * 0.6, k < 0.3 ? '#ffffff' : '#ffd34e', 0);
    if (k > 0.4) for (let i = 0; i < 5; i++) ellipse(ctx, f.x + Math.cos(i * 1.3) * r, f.y + Math.sin(i * 1.3) * r - k * 6, 3, 3, 'rgba(110,110,120,.7)', 0);
    ctx.globalAlpha = 1;
  };

  // ---------- bosses ----------

  art.drawBoss = (ctx, b, x, y, t) => {
    ctx.save();
    if (b.tell && Math.floor(t * 12) % 2) { ctx.shadowColor = '#ffd34e'; ctx.shadowBlur = 10; }
    const f = b.flash > 0 && Math.floor(b.t * 24) % 2 === 0;   // flicker, so steady fire doesn't bleach it
    if (b.id === 'thunderer') {
      // a dreadnought: a double-length zeppelin with two gondolas and a red war stripe
      ctx.save(); ctx.translate(x + b.w / 2, y + 18); ctx.scale(1.55, 1.3);
      art.drawZeppelin(ctx, 0, 0, t, { flash: f, fire: b.state === 'act' && b.attack === 'broadside' ? 1 : 0 });
      ctx.restore();
      if (!f) { ctx.fillStyle = '#c8323a'; ctx.fillRect(x + 22, y + 15, b.w - 40, 3); }
    } else if (b.id === 'tempest') {
      const cx = x + b.w / 2, cy = y + b.h / 2;
      art.drawCloudBank(ctx, x - 6, cy + 18, b.w + 12, t, 0.95, true);
      ctx.beginPath(); ctx.moveTo(cx - 30, cy + 8); ctx.lineTo(cx + 30, cy + 8); ctx.lineTo(cx + 22, cy + 18); ctx.lineTo(cx - 22, cy + 18); ctx.closePath();
      ctx.fillStyle = f ? '#fff' : BRASS; ctx.fill(); outline(ctx);
      ctx.fillStyle = f ? '#fff' : '#5a5a68'; ctx.fillRect(cx - 5, cy - 22, 10, 30); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(cx - 5, cy - 22, 10, 30);
      for (let i = 0; i < 4; i++) ellipse(ctx, cx, cy - 18 + i * 7, 9 - i, 2.2, f ? '#fff' : BRASS_D, 0.8);
      ellipse(ctx, cx, cy - 26, 6, 6, '#e8f8ff', 1);
      for (let i = 0; i < 3; i++) {                     // crackling arcs from the coil
        const a = t * 9 + i * 2.1; ctx.beginPath(); ctx.moveTo(cx, cy - 26);
        for (let k = 1; k <= 4; k++) ctx.lineTo(cx + Math.cos(a) * k * 6 + ((k * 7 + Math.floor(t * 20)) % 5) - 2, cy - 26 + Math.sin(a) * k * 6);
        ctx.strokeStyle = 'rgba(200,240,255,.85)'; ctx.lineWidth = 1; ctx.stroke();
      }
      for (const dx of [-24, 24]) { ctx.save(); ctx.translate(cx + dx, cy + 20); const sp = Math.abs(Math.sin(t * 30 + dx)); ctx.beginPath(); ctx.ellipse(0, 0, 8 * sp + 1, 1.2, 0, 0, 7); ctx.fillStyle = '#9aa4b4'; ctx.fill(); outline(ctx, 0.6); ctx.restore(); }
    } else if (b.id === 'fort') {
      // a fortress on a floating rock
      ctx.beginPath(); ctx.moveTo(x, y + 40); ctx.lineTo(x + b.w, y + 40); ctx.lineTo(x + b.w - 14, y + 62); ctx.lineTo(x + 60, y + b.h); ctx.lineTo(x + 24, y + 66); ctx.closePath();
      ctx.fillStyle = f ? '#fff' : '#8a6a5a'; ctx.fill(); outline(ctx);
      ctx.fillStyle = '#6f9a52'; ctx.fillRect(x, y + 38, b.w, 4);
      ctx.fillStyle = f ? '#fff' : '#9a8c80'; ctx.fillRect(x + 8, y + 14, b.w - 16, 26); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x + 8, y + 14, b.w - 16, 26);
      for (let i = 0; i < 9; i++) ctx.fillRect(x + 8 + i * 11, y + 10, 6, 5);
      ctx.fillStyle = '#3a2c22'; for (const gx of [24, 50, 76]) ctx.fillRect(x + gx, y + 26, 6, 9);
      for (const [tx, ty] of CD.BOSSES.fort.turrets) {
        ellipse(ctx, x + tx, y + ty + 4, 7, 5, f ? '#fff' : BRASS, 1);
        ctx.save(); ctx.translate(x + tx, y + ty + 2); ctx.rotate(Math.PI + 0.3 + Math.sin(t + tx) * 0.2); ctx.fillStyle = '#3a3a44'; ctx.fillRect(0, -1.5, 11, 3); ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(x + 55, y + 2); ctx.lineTo(x + 55, y - 14); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 55, y - 14); ctx.lineTo(x + 66, y - 12 + Math.sin(t * 7)); ctx.lineTo(x + 55, y - 9); ctx.fillStyle = '#2c4f8c'; ctx.fill();
    } else if (b.id === 'kraken') {
      // a clockwork kraken: brass dome head, porthole eyes, eight segmented tentacles
      const cx = x + b.w / 2 + 6, cy = y + 30;
      for (let i = 0; i < 8; i++) {
        const x0 = cx - 26 + i * 7.4, out = (i - 3.5) * 0.9;
        ctx.beginPath(); let px = x0, py = cy + 12; ctx.moveTo(px, py);
        for (let k = 1; k <= 7; k++) { px = x0 + out * k + Math.sin(t * 3 + i * 0.9 + k * 0.6) * k * 0.9; py = cy + 12 + k * 6; ctx.lineTo(px, py); }
        ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = f ? '#fff' : BRASS_D; ctx.lineWidth = 2.6; ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(cx, cy, 30, 24, 0, Math.PI * 1.05, Math.PI * 1.95 + 0.3); ctx.lineTo(cx + 30, cy + 14); ctx.lineTo(cx - 30, cy + 14); ctx.closePath();
      ctx.fillStyle = f ? '#fff' : BRASS; ctx.fill(); outline(ctx, 1.4);
      ctx.strokeStyle = BRASS_D; ctx.lineWidth = 1; for (const rx of [-15, 0, 15]) { ctx.beginPath(); ctx.moveTo(cx + rx, cy - 22 + Math.abs(rx) * 0.3); ctx.lineTo(cx + rx, cy + 14); ctx.stroke(); }
      const glow = b.tell ? '#ff4d4d' : '#9fe8ff';
      for (const ex of [-12, 6]) { ellipse(ctx, cx + ex, cy + 2, 6, 6, '#5a5a68', 1); ellipse(ctx, cx + ex, cy + 2, 3.6, 3.6, glow, 0); }
      for (let i = 0; i < 5; i++) ellipse(ctx, cx - 20 + i * 10, cy + 13, 1.2, 1.2, BRASS_D, 0);
    }
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
    ctx.beginPath(); ctx.moveTo(W() + 30, cy);
    for (let x = W() + 30; x > x0; x -= 8) ctx.lineTo(x, cy + Math.sin(x * 0.08 + t * 20) * 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = BRASS; ctx.lineWidth = 7; ctx.stroke(); ctx.lineCap = 'butt';
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
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(70, 130); ctx.lineTo(70, 200); ctx.stroke();
    art.text(ctx, 'THE HANGAR', W() / 2 + 60, 16, { size: 13, color: '#ffd34e', align: 'center' });
    art.text(ctx, `${profile.gold} GOLD`, W() - 8, 30, { size: 8, color: '#ffd34e', align: 'right' });
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
    if (note) art.text(ctx, note, W() / 2 + 60, 182, { size: 7, color: h.msgT > 0 ? '#ffd34e' : '#cfe8ff', align: 'center' });
    if (document.documentElement.classList.contains('touch')) { art.button(ctx, L.buy, 'BUY', !CD.owns(profile, sel.key, o.id)); art.button(ctx, L.done, 'DONE'); }
    else art.text(ctx, 'ARROWS: CHOOSE   SPACE: BUY   ENTER: DONE', W() / 2 + 60, 204, { size: 6.5, color: '#d9c4a0', align: 'center' });
  };

  art.drawMarket = (ctx, m, w, s, t, touch) => {
    const L = CD.MLAYOUT;
    ctx.fillStyle = 'rgba(16,24,48,.6)'; ctx.fillRect(0, 0, W(), H());
    panel(ctx, 40, 14, W() - 80, H() - 28);
    art.text(ctx, 'THE SKY MARKET', W() / 2, 28, { size: 13, color: '#ffd34e', align: 'center' });
    art.text(ctx, `HEARTS ${s.hearts}/${s.maxHearts}   LIVES ${s.lives}`, 54, 42, { size: 7, color: '#ffb0a8' });
    art.text(ctx, `${w.gold} GOLD`, W() - 54, 42, { size: 7, color: '#ffd34e', align: 'right' });
    m.rows().forEach((it, i) => {
      const y = L.top + i * L.step, sel = i === m.row;
      if (sel) { ctx.fillStyle = 'rgba(217,164,65,.22)'; ctx.fillRect(48, y - 6, W() - 96, 12); }
      const name = it.id === 'gun' ? `GUN: ${sel ? '< ' : ''}${CD.WEAPONS[m.gun()].name}${sel ? ' >' : ''}` : it.name;
      art.text(ctx, (sel ? '> ' : '  ') + name, 54, y, { size: 7, color: sel ? '#ffd34e' : '#f1e6cc' });
      if (it.id !== 'leave') { const c = m.price(it.id); art.text(ctx, c + 'G', W() - 54, y, { size: 7, color: w.gold >= c ? '#7cfc7c' : '#ff8a7a', align: 'right' }); }
    });
    const cur = m.current();
    art.text(ctx, m.msgT > 0 ? m.msg : cur.note, W() / 2, touch ? 184 : 188, { size: 7, color: m.msgT > 0 ? '#ffd34e' : '#cfe8ff', align: 'center' });
    if (touch) { art.button(ctx, L.buy, 'BUY'); art.button(ctx, L.sail, 'CAST OFF'); }
    else art.text(ctx, 'UP/DOWN: CHOOSE   SPACE: BUY   ENTER: CAST OFF', W() / 2, 200, { size: 6.5, color: '#d9c4a0', align: 'center' });
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
    if (gun) art.text(ctx, s.weaponT > 0 && s.weapon !== 'cannon' ? `${gun.name} ${Math.ceil(s.weaponT)}` : gun.name, L, 31, { size: 6.5, color: s.weaponT > 0 && s.weapon !== 'cannon' ? '#ffd34e' : '#cfe8ff' });
    art.text(ctx, String(w.score).padStart(6, '0'), R, 9, { size: 9, align: 'right' });
    art.text(ctx, `GOLD ${w.gold}`, R, 20, { size: 7, align: 'right', color: '#ffd34e' });
    if (best) art.text(ctx, `BEST ${best}`, R, 30, { size: 6, align: 'right', color: '#cfe8ff' });
  };
})();
