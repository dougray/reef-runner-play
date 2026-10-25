// The Black Market: opens after each boss. Spends this run's gold on upgrades that last until
// game over; each one costs 50% more every time it's bought. makeShop() is the screen's state.
(() => {
  const JR = window.JR;

  JR.SHOP_ITEMS = [
    { id: 'heart', name: '+1 MAX HEART', base: 40, max: 3, note: 'ONE MORE HEART, AND HEALS ONE' },
    { id: 'refill', name: 'REFILL HEARTS', base: 20, max: Infinity, note: 'BACK TO FULL HEALTH' },
    { id: 'life', name: '+1 LIFE', base: 75, max: Infinity, note: 'ONE MORE TRY' },
    { id: 'gun', name: 'GUN', base: 35, max: Infinity, note: 'LEFT/RIGHT: CHOOSE A GUN' },
    { id: 'reload', name: 'QUICK RELOAD', base: 50, max: 3, note: 'GUNS FIRE 15% FASTER' },
    { id: 'blade', name: 'SHARP BLADE', base: 50, max: 3, note: 'BLADE HITS 25% HARDER' },
    { id: 'magnet', name: 'COIN MAGNET', base: 60, max: 1, note: 'NEARBY COINS FLY TO YOU' },
  ];
  const LEAVE = { id: 'leave', name: 'SET SAIL', note: 'ON TO THE NEXT WATERS' };

  const EFFECTS = {
    heart: p => { p.maxHearts += 1; p.hearts = Math.min(p.maxHearts, p.hearts + 1); },
    refill: p => { p.hearts = p.maxHearts; },
    life: p => { p.lives += 1; },
    gun: (p, shop) => { p.gun = shop.gun(); p.grace = p.graceMax; p.mag = 0; },
    reload: p => { p.reloadMult *= 0.85; },
    blade: p => { p.meleeMult *= 1.25; },
    magnet: p => { p.magnet = 84; },          // about 5 tiles; the monkey reaches 7
  };

  JR.makeShop = p => {
    p.shopBuys = p.shopBuys || {};
    const count = id => p.shopBuys[id] || 0;
    const shop = {
      p, row: 0, gunIdx: 0, msg: '', msgT: 0,
      rows() {
        const list = JR.SHOP_ITEMS.filter(it => {
          if (count(it.id) >= it.max) return false;
          if (it.id === 'magnet' && (p.pet === 'monkey' || p.magnet)) return false;
          return true;
        });
        return list.concat([LEAVE]);
      },
      price: id => Math.round(JR.SHOP_ITEMS.find(i => i.id === id).base * Math.pow(1.5, count(id))),
      gun: () => JR.PICKUP_GUNS[shop.gunIdx],
      current: () => shop.rows()[Math.min(shop.row, shop.rows().length - 1)],
      move(d) { const n = shop.rows().length; shop.row = (shop.row + d + n) % n; shop.msgT = 0; },
      cycle(d) {
        if (shop.current().id !== 'gun') return;
        const n = JR.PICKUP_GUNS.length;
        shop.gunIdx = (shop.gunIdx + d + n) % n;
      },
      say(m) { shop.msg = m; shop.msgT = 1.6; },
      buy() {
        const it = shop.current();
        if (it.id === 'leave') return 'leave';
        if (it.id === 'refill' && p.hearts >= p.maxHearts) { shop.say('ALREADY HALE AND HEARTY'); return 'full'; }
        const cost = shop.price(it.id);
        if (p.gold < cost) { shop.say(`NEED ${cost} GOLD`); return 'poor'; }
        p.gold -= cost;
        p.shopBuys[it.id] = count(it.id) + 1;
        EFFECTS[it.id](p, shop);
        shop.say(it.id === 'gun' ? JR.WEAPONS[p.gun].name + '!' : 'SOLD!');
        shop.row = Math.min(shop.row, shop.rows().length - 1);
        return 'bought';
      },
    };
    return shop;
  };

  // ---------- drawing (layout shared with the tap handler in js/game.js) ----------

  JR.SLAYOUT = { top: 60, step: 12, buy: { x: 132, y: 184, w: 56, h: 12 }, sail: { x: 196, y: 184, w: 56, h: 12 } };

  JR.drawShop = (ctx, shop, t) => {
    const W = JR.VIEW_W, H = JR.VIEW_H, P = JR.px;
    ctx.fillStyle = 'rgba(16,10,24,.82)'; ctx.fillRect(0, 0, W, H);
    JR.ui.panel(ctx, 'board', 36, 14, W - 72, H - 24);
    JR.ui.banner(ctx, W / 2, 10, 120);
    P.text(ctx, 'BLACK MARKET', W / 2, 16, { align: 'center', color: '#3e2731', outline: false });
    if (JR.atlas.ready) JR.atlas.draw(ctx, 'coin', 0, W - 50 - JR.px.textImage(`${shop.p.gold} GOLD`).width - 8, 49, { i: 0 });
    P.text(ctx, `${shop.p.gold} GOLD`, W - 50, 44, { align: 'right', color: '#fcc838' });
    P.text(ctx, `HEARTS ${shop.p.hearts}/${shop.p.maxHearts}  LIVES ${shop.p.lives}`, 52, 44, { color: '#fc9c9c' });
    const rows = shop.rows(), { top, step } = JR.SLAYOUT;
    rows.forEach((it, i) => {
      const y = top + i * step, sel = i === shop.row;
      if (sel) { ctx.fillStyle = 'rgba(252,200,56,.18)'; ctx.fillRect(48, y - 5, W - 96, 10); }
      let name = it.name;
      if (it.id === 'gun') name = `GUN: ${sel ? '< ' : ''}${JR.WEAPONS[shop.gun()].name}${sel ? ' >' : ''}`;
      P.text(ctx, (sel ? '> ' : '  ') + name, 54, y, { color: sel ? '#fcc838' : '#fce4a8' });
      if (it.id !== 'leave') {
        const cost = shop.price(it.id);
        P.text(ctx, cost + 'G', W - 54, y, { align: 'right', color: shop.p.gold >= cost ? '#7cfc7c' : '#fc7c7c' });
      }
    });
    const cur = shop.current();
    P.text(ctx, shop.msgT > 0 ? shop.msg : cur.note, W / 2, JR.touchMode() ? H - 42 : H - 34, { align: 'center', color: shop.msgT > 0 ? '#fcc838' : '#bcdcfc' });
    if (JR.touchMode()) {
      JR.art.button(ctx, JR.SLAYOUT.buy, 'BUY', '#7cfc7c');
      JR.art.button(ctx, JR.SLAYOUT.sail, 'SAIL');
    } else P.text(ctx, JR.padMode() ? 'D-PAD: CHOOSE   A / OK: BUY   B / BACK: SET SAIL' : 'UP/DOWN: CHOOSE   SPACE: BUY   ENTER: SET SAIL', W / 2, H - 22, { align: 'center', color: '#c8a878' });
  };
})();
