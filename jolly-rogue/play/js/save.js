// The saved pirate: what can be bought (the catalog), what is owned and worn, banked gold, best score.
// Storage is passed in (localStorage in the game, a stub in tests) and every access is guarded,
// so a private window or blocked storage just means a fresh profile each time.
(() => {
  const JR = window.JR;
  const KEY = 'jr.profile';

  const opt = (id, name, price = 0, note = '') => ({ id, name, price, note });
  JR.CATALOG = [
    { key: 'body', label: 'PIRATE', options: [opt('male', 'HE'), opt('female', 'SHE')] },
    { key: 'coat', label: 'COAT', options: [opt('red', 'RED STRIPES'), opt('blue', 'BLUE', 40), opt('green', 'GREEN', 60), opt('purple', 'PURPLE', 60), opt('black', 'BLACK', 60), opt('gold', 'GOLD', 100)] },
    { key: 'hat', label: 'HAT', options: [opt('purple', 'PURPLE'), opt('black', 'BLACK', 40), opt('red', 'RED', 60), opt('navy', 'NAVY', 60)] },
    { key: 'pants', label: 'PANTS', options: [opt('purple', 'PURPLE'), opt('brown', 'BROWN', 40), opt('tan', 'TAN', 40), opt('black', 'BLACK', 60)] },
    { key: 'outfit', label: 'OUTFIT', options: [opt('none', 'MY COLORS'), opt('gold', 'GOLD TRIM', 250, 'RARE: GOLD COAT, BLACK HAT'), opt('blackred', 'BLACK AND RED', 300, 'RARE: BLACK COAT, RED HAT')] },
    { key: 'cls', label: 'CLASS', options: [
      opt('swash', 'SWASHBUCKLER', 0, '7 HEARTS  FASTER  HIGHER JUMP'),
      opt('brawler', 'BRAWLER', 0, '9 HEARTS  SLOWER  BLADE HITS X1.5'),
      opt('gunner', 'GUNNER', 0, '6 HEARTS  QUICK RELOAD  KEEPS PICKUP GUNS'),
    ] },
    { key: 'melee', label: 'BLADE', options: [
      opt('cutlass', 'CUTLASS', 0, 'BALANCED'), opt('dagger', 'DAGGER', 150, 'VERY FAST  SHORT'),
      opt('axe', 'BOARDING AXE', 250, 'SLOW  HITS HARD'), opt('rapier', 'RAPIER', 350, 'LONG REACH'),
    ] },
    { key: 'gun', label: 'GUN', options: [
      opt('pistol', 'FLINTLOCK', 0, 'RELIABLE'), opt('musket', 'MUSKET', 250, 'SLOW  LONG  HITS HARD'),
      opt('brace', 'BRACE OF PISTOLS', 400, 'TWO QUICK SHOTS THEN RELOAD'),
    ] },
    { key: 'pet', label: 'PET', options: [
      opt('none', 'NONE'), opt('parrot', 'PARROT', 500, 'SPOTS CHESTS AND CRATES AHEAD'),
      opt('monkey', 'MONKEY', 500, 'SNATCHES NEARBY COINS'),
    ] },
  ];
  const row = key => JR.CATALOG.find(r => r.key === key);

  // A look as recolors (JR.RECOLORS keys). A rare outfit replaces the separate colors.
  const OUTFITS = { gold: ['coat.gold', 'hat.black', 'pants.black'], blackred: ['coat.black', 'hat.red', 'pants.black'] };
  JR.lookRecolors = eq => OUTFITS[eq.outfit] ? OUTFITS[eq.outfit].slice() : ['coat.' + eq.coat, 'hat.' + eq.hat, 'pants.' + eq.pants];

  // What the old wardrobe (before the pack art) charged, for the one-time refund of things that are
  // gone. Items that still exist (coat black/purple/green) stay owned instead.
  // Refunds by save version: a profile below version N gets REFUNDS[N] back, once, for items it owns
  // that are gone. Version 2: the old wardrobe before the pack art (coat black/purple/green still
  // exist and stay owned). Version 3: Sea Legs boots, retired when every class got double jump.
  const REFUNDS = {
    2: {
      hair: { ponytail: 40 }, hairColor: { blonde: 25, red: 25, grey: 25 }, beard: { braided: 80 },
      hat: { captain: 150, cavalier: 200 }, coat: { black: 60, crimson: 60, purple: 100, green: 100 },
      eye: { patch: 40 }, hand: { hook: 120 },
    },
    3: { boots: { sea: 600 } },
  };
  const VERSION = 3;
  const option = (key, id) => { const r = row(key); return r && r.options.find(o => o.id === id); };

  JR.price = (key, id) => { const o = option(key, id); return o ? o.price : Infinity; };

  JR.defaultProfile = () => {
    const equip = {}, owned = {};
    for (const r of JR.CATALOG) { equip[r.key] = r.options[0].id; owned[r.key] = []; }
    return { v: 1, gold: 0, best: 0, equip, owned, fresh: true, migrated: VERSION };
  };

  JR.owns = (pr, key, id) => {
    const o = option(key, id);
    return !!o && (o.price === 0 || (pr.owned[key] || []).includes(id));
  };

  JR.buy = (pr, key, id) => {
    const o = option(key, id);
    if (!o || JR.owns(pr, key, id) || pr.gold < o.price) return false;
    pr.gold -= o.price;
    (pr.owned[key] = pr.owned[key] || []).push(id);
    return true;
  };

  JR.equip = (pr, key, id) => {
    if (!JR.owns(pr, key, id)) return false;
    pr.equip[key] = id;
    return true;
  };

  JR.bank = (pr, gold, score) => {
    pr.gold += gold;
    pr.best = Math.max(pr.best || 0, score || 0);
    pr.fresh = false;
  };

  JR.loadProfile = store => {
    const pr = JR.defaultProfile();
    let raw = null, oldBest = 0;
    try { raw = store.getItem(KEY); oldBest = +store.getItem('jr.best') || 0; } catch (e) { return pr; }
    pr.best = oldBest;
    if (!raw) return pr;
    let saved;
    try { saved = JSON.parse(raw); } catch (e) { return pr; }
    if (!saved || typeof saved !== 'object') return pr;
    pr.gold = Math.max(0, +saved.gold || 0);
    // Refund, once per version, anything bought that no longer exists (saving stamps VERSION).
    for (const [ver, prices] of Object.entries(REFUNDS)) {
      if ((saved.migrated || 0) >= +ver || !saved.owned) continue;
      for (const [k, ids] of Object.entries(saved.owned)) {
        if (!Array.isArray(ids)) continue;
        for (const id of ids) if (!option(k, id) && prices[k] && prices[k][id]) pr.gold += prices[k][id];
      }
    }
    pr.best = Math.max(oldBest, +saved.best || 0);
    pr.fresh = !!saved.fresh;
    for (const r of JR.CATALOG) {
      const o = saved.owned && saved.owned[r.key];
      pr.owned[r.key] = Array.isArray(o) ? o.filter(id => option(r.key, id)) : [];
      const e = saved.equip && saved.equip[r.key];
      if (e && JR.owns(pr, r.key, e)) pr.equip[r.key] = e;
    }
    return pr;
  };

  JR.saveProfile = (store, pr) => {
    try { store.setItem(KEY, JSON.stringify(pr)); } catch (e) { /* private window or full: play on */ }
  };
})();
