// The saved captain: banked gold, best score and the Hangar (what's owned and fitted), in
// localStorage under cd.profile. Pure logic; `store` is anything with getItem/setItem.
(() => {
  const CD = window.CD;
  const KEY = 'cd.profile';
  const opt = (id, name, price = 0, note = '') => ({ id, name, price, note });

  CD.CATALOG = [
    { key: 'envelope', label: 'ENVELOPE', options: [opt('cream', 'CANVAS CREAM'), opt('red', 'PIRATE RED', 40), opt('navy', 'STOLEN NAVY', 60), opt('black', 'MIDNIGHT', 80), opt('gold', 'GILDED', 120)] },
    { key: 'pattern', label: 'PATTERN', options: [opt('plain', 'PLAIN'), opt('stripes', 'STRIPES', 60), opt('checker', 'CHECKERS', 80)] },
    { key: 'sail', label: 'SAIL', options: [opt('roger', 'JOLLY ROGER'), opt('swords', 'CROSSED SWORDS', 60), opt('red', 'RED SAIL', 80)] },
    { key: 'hull', label: 'HULL', options: [opt('oak', 'OAK'), opt('ebony', 'EBONY', 60), opt('crimson', 'CRIMSON', 60)] },
    { key: 'gun', label: 'START GUN', options: [opt('cannon', 'CANNONS'), opt('chain', 'CHAIN SHOT', 200, 'FIRST 30 SECONDS'), opt('harpoon', 'HARPOON', 250, 'FIRST 30 SECONDS'), opt('gatling', 'GATLING', 300, 'FIRST 30 SECONDS')] },
    { key: 'pet', label: 'CREW PET', options: [opt('none', 'NONE'), opt('parrot', 'PARROT', 150, 'BRINGS THE PLUNDER IN FASTER')] },
    // Upgrades that last every run. Each level needs the one before it.
    { key: 'armor', label: 'HULL ARMOR', tiers: true, options: [opt('a0', 'STOCK'), opt('a1', '+1 HEART', 150, 'START EVERY RUN WITH AN EXTRA HEART'), opt('a2', '+2 HEARTS', 400, 'START WITH TWO EXTRA HEARTS'), opt('a3', '+3 HEARTS', 800, 'START WITH THREE EXTRA HEARTS')] },
    { key: 'boilerUp', label: 'BOILER', tiers: true, options: [opt('u0', 'STOCK'), opt('u1', '+25 STEAM', 120, 'MORE FULL STEAM, EVERY RUN'), opt('u2', '+50 STEAM', 300, 'EVEN MORE FULL STEAM')] },
    { key: 'crew', label: 'GUN CREW', tiers: true, options: [opt('c0', 'STOCK'), opt('c1', 'QUICK', 200, 'CANNONS FIRE 15% FASTER, EVERY RUN'), opt('c2', 'QUICKER', 500, 'CANNONS FIRE 28% FASTER')] },
    { key: 'broadside', label: 'BROADSIDE', tiers: true, options: [opt('b0', 'TWO BALLS'), opt('b1', 'THREE BALLS', 350, 'START EVERY RUN WITH 3 CANNONBALLS')] },
  ];
  const VERSION = 1;
  const row = key => CD.CATALOG.find(r => r.key === key);
  const option = (key, id) => { const r = row(key); return r && r.options.find(o => o.id === id); };
  CD.price = (key, id) => { const o = option(key, id); return o ? o.price : Infinity; };

  CD.defaultProfile = () => {
    const equip = {}, owned = {};
    for (const r of CD.CATALOG) { equip[r.key] = r.options[0].id; owned[r.key] = []; }
    return { v: VERSION, gold: 0, best: 0, equip, owned };
  };
  CD.owns = (p, key, id) => { const o = option(key, id); return !!o && (o.price === 0 || (p.owned[key] || []).includes(id)); };
  CD.buy = (p, key, id) => {
    const o = option(key, id), r = row(key);
    if (!o || CD.owns(p, key, id) || p.gold < o.price) return false;
    const i = r.options.indexOf(o);
    if (r.tiers && i > 1 && !CD.owns(p, key, r.options[i - 1].id)) return false;   // levels in order
    p.gold -= o.price; (p.owned[key] = p.owned[key] || []).push(id);
    return true;
  };
  CD.equip = (p, key, id) => { if (!CD.owns(p, key, id)) return false; p.equip[key] = id; return true; };

  CD.loadProfile = store => {
    const p = CD.defaultProfile();
    let saved = null;
    try { saved = JSON.parse(store.getItem(KEY)); } catch (e) { return p; }
    if (!saved || typeof saved !== 'object') return p;
    p.gold = Math.max(0, Math.floor(+saved.gold || 0));
    p.best = Math.max(0, Math.floor(+saved.best || 0));
    for (const r of CD.CATALOG) {
      const o = saved.owned && saved.owned[r.key];
      p.owned[r.key] = Array.isArray(o) ? o.filter(id => option(r.key, id)) : [];
      const e = saved.equip && saved.equip[r.key];
      if (e && CD.owns(p, r.key, e)) p.equip[r.key] = e;
    }
    return p;
  };
  CD.saveProfile = (store, p) => { try { store.setItem(KEY, JSON.stringify(p)); } catch (e) { /* private window: play on */ } };

  // End of a run: bank the run's gold and keep the best score.
  CD.bankRun = (p, w) => {
    p.gold += w.gold; const prev = p.best; p.best = Math.max(p.best, w.score);
    return { banked: w.gold, newBest: w.score > prev };
  };

  // What the Hangar fit-out does to a fresh ship.
  CD.applyLoadout = (s, equip) => {
    s.look = { envelope: equip.envelope, pattern: equip.pattern, sail: equip.sail, hull: equip.hull };
    s.pet = equip.pet;
    if (equip.gun && equip.gun !== 'cannon') { s.weapon = equip.gun; s.weaponT = 30; }
    const level = key => Math.max(0, row(key).options.findIndex(o => o.id === equip[key]));
    s.maxHearts += level('armor'); s.hearts = s.maxHearts;
    s.steamMax += 25 * level('boilerUp'); s.steam = s.steamMax;
    s.fireMult *= [1, 0.85, 0.72][level('crew')];
    s.spread = Math.max(s.spread || 0, level('broadside'));
    return s;
  };
})();
