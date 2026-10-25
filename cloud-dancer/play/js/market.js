// The Sky Market: opens after each boss; spend this run's gold on upgrades for the rest of the run.
// Prices climb 50% per purchase; limited items sell out. Pure logic (drawing lives in art.js).
(() => {
  const CD = window.CD;

  CD.MARKET = [
    { id: 'plating', name: 'HULL PLATING', base: 40, max: 3, note: 'ONE MORE HEART, AND MENDS ONE', apply: s => { s.maxHearts++; s.hearts++; } },
    { id: 'refill', name: 'PATCH THE HULL', base: 20, note: 'MEND EVERY HEART', apply: s => { s.hearts = s.maxHearts; }, when: s => s.hearts < s.maxHearts },
    { id: 'boiler', name: 'BIGGER BOILER', base: 50, max: 2, note: 'MORE STEAM FOR FULL STEAM', apply: s => { s.steamMax += 25; s.steam = s.steamMax; } },
    { id: 'quick', name: 'QUICK CANNONS', base: 50, max: 2, note: 'CANNONS FIRE 15% FASTER', apply: s => { s.fireMult *= 0.85; } },
    { id: 'wide', name: 'WIDE BROADSIDE', base: 60, note: '3 CANNONBALLS, THEN 5', apply: s => { s.spread = (s.spread || 0) + 1; }, when: s => (s.spread || 0) < 2 },
    { id: 'heavy', name: 'HEAVY SHOT', base: 70, max: 2, note: 'CANNONBALLS HIT HARDER', apply: s => { s.heavy = (s.heavy || 0) + 1; } },
    { id: 'shells', name: 'EXPLODING SHELLS', base: 120, max: 1, note: 'CANNONBALLS BURST ON WHAT THEY HIT', apply: s => { s.burst = true; } },
    { id: 'rear', name: 'REAR GUNNER', base: 90, max: 1, note: 'A GUN FIRING BACK THE WAY YOU CAME', apply: s => { s.rear = true; } },
    { id: 'wingman', name: 'WINGMAN', base: 150, max: 4, note: 'A PIRATE AIRSHIP JOINS YER SQUADRON (UP TO 4)', apply: s => { s.wingmen = (s.wingmen || 0) + 1; } },
    { id: 'shield', name: 'STEAM SHIELD', base: 80, max: 1, note: 'SAFE A MOMENT AFTER FULL STEAM', apply: s => { s.shield = true; } },
    { id: 'rack', name: 'GUN RACK', base: 100, max: 1, note: 'PICKUP GUNS LAST TILL YOU LOSE A LIFE', apply: s => { s.gunRack = true; } },
    { id: 'magnet', name: 'LODESTONE', base: 80, max: 1, note: 'EVERY COIN COUNTS DOUBLE', apply: s => { s.magnet = true; } },
    { id: 'life', name: 'SPARE CREW', base: 100, note: '+1 LIFE', apply: s => { s.lives++; } },
    { id: 'gun', name: 'GUN', base: 35, note: 'THIS GUN FOR 30 SECONDS', gun: true },
    { id: 'leave', name: 'CAST OFF', note: 'BACK TO THE SKIES' },
  ];

  CD.makeMarket = (w, s) => {
    const bought = {};
    let gunIndex = 0;
    const m = {
      row: 0, msg: '', msgT: 0,
      rows: () => CD.MARKET.filter(it => (!it.max || (bought[it.id] || 0) < it.max) && (!it.when || it.when(s))),
      price: id => { const it = CD.MARKET.find(i => i.id === id); return Math.round((it.base || 0) * Math.pow(1.5, bought[id] || 0)); },
      gun: () => CD.PICKUP_GUNS[gunIndex],
      cycle(d) { gunIndex = (gunIndex + d + CD.PICKUP_GUNS.length) % CD.PICKUP_GUNS.length; },
      current: () => m.rows()[Math.min(m.row, m.rows().length - 1)],
      move(d) { const n = m.rows().length; m.row = (m.row + d + n) % n; },
      // 'bought' | 'poor' | 'leave'
      buy() {
        const it = m.current();
        if (it.id === 'leave') return 'leave';
        const cost = m.price(it.id);
        if (w.gold < cost) { m.msg = 'NOT ENOUGH GOLD'; m.msgT = 1.2; return 'poor'; }
        w.gold -= cost;
        bought[it.id] = (bought[it.id] || 0) + 1;
        if (it.gun) { s.weapon = m.gun(); s.weaponT = 30; } else it.apply(s);
        m.msg = it.gun ? CD.WEAPONS[m.gun()].name + '!' : 'SOLD!'; m.msgT = 1;
        m.row = Math.min(m.row, m.rows().length - 1);
        return 'bought';
      },
    };
    return m;
  };
})();
