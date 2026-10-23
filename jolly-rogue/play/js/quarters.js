// The Captain's Quarters: dress the pirate, pick a class, kit and pet, and spend banked gold.
// makeQuarters() is the screen's state (testable); JR.drawQuarters() draws it.
(() => {
  const JR = window.JR;

  JR.makeQuarters = profile => {
    const q = {
      profile, row: 0, msg: '', msgT: 0,
      view: Object.assign({}, profile.equip),      // what's shown, including try-ons
      move(d) { const n = JR.CATALOG.length; q.row = (q.row + d + n) % n; },
      cycle(d) {
        const r = JR.CATALOG[q.row], opts = r.options;
        const i = opts.findIndex(o => o.id === q.view[r.key]);
        const next = opts[(i + d + opts.length) % opts.length].id;
        q.view[r.key] = next;
        JR.equip(profile, r.key, next);
        q.msg = ''; q.msgT = 0;
      },
      status() {
        const r = JR.CATALOG[q.row], o = r.options.find(o => o.id === q.view[r.key]);
        return { label: r.label, name: o.name, price: o.price, note: o.note, owned: JR.owns(profile, r.key, o.id) };
      },
      buy() {
        const r = JR.CATALOG[q.row], id = q.view[r.key];
        if (JR.owns(profile, r.key, id)) { q.say('ALREADY YOURS'); return 'owned'; }
        if (!JR.buy(profile, r.key, id)) { q.say(`NEED ${JR.price(r.key, id)} GOLD`); return 'poor'; }
        JR.equip(profile, r.key, id);
        q.say('BOUGHT!');
        return 'bought';
      },
      say(m) { q.msg = m; q.msgT = 1.6; },
      leave() {
        for (const r of JR.CATALOG) if (!JR.owns(profile, r.key, q.view[r.key])) q.view[r.key] = profile.equip[r.key];
        profile.fresh = false;
        return profile;
      },
    };
    return q;
  };

  // ---------- drawing (layout shared with the tap handler in js/game.js) ----------

  JR.QLAYOUT = {
    top: 22, step: 11, rowX: 124, valueMid: 270, priceX: 340,
    buy: { x: 132, y: 200, w: 56, h: 12 }, done: { x: 196, y: 200, w: 56, h: 12 },
  };

  const px = () => JR.px;

  function cabin(ctx, W, H) {
    ctx.fillStyle = '#3a2410'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 12) {
      ctx.fillStyle = y % 24 ? '#4a2e14' : '#432a12'; ctx.fillRect(0, y, W, 11);
      ctx.fillStyle = '#2a180a'; ctx.fillRect(0, y + 11, W, 1);
    }
    // a porthole with the sea in it
    ctx.fillStyle = '#c88810'; ctx.fillRect(18, 20, 36, 36);
    ctx.fillStyle = '#64bcfc'; ctx.fillRect(22, 24, 28, 16);
    ctx.fillStyle = '#2468c4'; ctx.fillRect(22, 40, 28, 12);
    ctx.fillStyle = '#1b1020'; ctx.fillRect(35, 24, 2, 28); ctx.fillRect(22, 37, 28, 2);
  }

  // The captain (or she-captain) in the chosen colors, three times life size, jogging on the spot.
  function preview(ctx, look, t) {
    const A = JR.atlas, anim = 'captain.run', i = A.index(anim, t), f = A.frameAt(anim, i);
    const lk = { body: look.body, recolor: JR.lookRecolors(look) };
    ctx.save(); ctx.translate(62, 186); ctx.scale(3, 3);
    ctx.drawImage(JR.packart.captainFrame(anim, i, lk), f.dx, f.dy);
    if (f.hand) { const g = JR.packart.gun(look.gun, 'fwd'); ctx.drawImage(g.img, f.hand.x - g.gx, f.hand.y - g.gy); }
    ctx.restore();
  }

  const INK = '#3e2731', RED = '#b8463e', GREEN = '#3e8a4a';

  JR.drawQuarters = (ctx, q, t) => {
    const W = JR.VIEW_W, H = JR.VIEW_H, P = px(), on = { outline: false };
    if (!JR.atlas.ready) { cabin(ctx, W, H); return; }
    JR.artWorld.drawBackdrop(ctx, t * 8, t, 'fort');
    const look = q.view, cls = JR.CLASSES[look.cls];
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(22, 184, 80, 4);
    preview(ctx, look, t);
    if (look.pet !== 'none') {
      const img = look.pet === 'parrot' ? JR.packart.parrot(Math.floor(t * 10)) : JR.packart.monkey(Math.floor(t * 3));
      const pyy = look.pet === 'parrot' ? 58 + Math.round(Math.sin(t * 6) * 3) : 84;
      ctx.drawImage(img, look.pet === 'parrot' ? 18 : 30, pyy, img.width * 2, img.height * 2);
    }
    P.text(ctx, `${cls.hearts} HEARTS`, 62, 198, { align: 'center', color: '#fc7c7c' });

    JR.ui.panel(ctx, 'paper', 118, 14, W - 122, 128);
    JR.ui.banner(ctx, 190, 3, 128);
    P.text(ctx, "CAPTAIN'S QUARTERS", 190, 9, { align: 'center', color: INK, ...on });
    JR.atlas.draw(ctx, 'coin', 0, W - 12, 15, { i: 0 });
    P.text(ctx, String(q.profile.gold), W - 20, 9, { align: 'right', color: '#fcc838' });

    const { top, step } = JR.QLAYOUT;
    JR.CATALOG.forEach((r, i) => {
      const y = top + i * step, sel = i === q.row;
      const o = r.options.find(o => o.id === q.view[r.key]);
      const owned = JR.owns(q.profile, r.key, o.id);
      if (sel) { ctx.fillStyle = 'rgba(184,70,62,.16)'; ctx.fillRect(124, y - 5, W - 134, 10); }
      P.text(ctx, r.label, 130, y, { color: sel ? RED : '#7a4a3a', ...on });
      const name = (sel ? '< ' : '') + o.name + (sel ? ' >' : '');
      P.text(ctx, name, 270, y, { align: 'center', color: owned ? INK : '#9a8a80', ...on });
      if (!owned) P.text(ctx, o.price + 'G', W - 12, y, { align: 'right', color: q.profile.gold >= o.price ? GREEN : RED, ...on });
    });

    const st = q.status();
    const yb = top + JR.CATALOG.length * step + 2;
    if (q.msgT > 0) P.text(ctx, q.msg, 260, yb, { align: 'center', color: RED, ...on });
    else if (!st.owned) P.text(ctx, `SPACE: BUY FOR ${st.price} GOLD`, 260, yb, { align: 'center', color: GREEN, ...on });
    else if (st.note) P.text(ctx, st.note, 260, yb, { align: 'center', color: '#4a6ab0', ...on });
    if (JR.touchMode()) {
      JR.art.button(ctx, JR.QLAYOUT.buy, 'BUY', st.owned ? '#a8a8bc' : '#7cfc7c');
      JR.art.button(ctx, JR.QLAYOUT.done, 'DONE');
    } else P.text(ctx, 'ARROWS: CHOOSE    SPACE: BUY    ENTER: DONE', W / 2, H - 6, { align: 'center', color: '#fce4a8' });
  };
})();
