// The voyage: the eight levels in the order a run sails them, what each one looks like and who
// fights there, and the checkpoint saves (levels reached can be started from the title screen).
// Pure data and arithmetic (no canvas, no DOM), so tests/run.mjs loads it on its own.
(() => {
  const JR = window.JR;

  // id: the level's biome id (chunks, terrain, music and backdrop are keyed by it).
  // crew: the rival crew that always holds it; null for the first four, whose crews still rotate
  //   with every voyage (as before the voyage update; see JR.crewFor).
  // look: how the new levels' backdrops are built from the painted ones (js/art-areas.js):
  //   base (a JR.PAINTED key), tint (rgba laid over it), layer (code-drawn parallax), weather.
  // terrain: which pack tiles it builds from, and the tint baked into a copy of them.
  JR.LEVELS = [
    { id: 'beach', name: 'PALM TREE ISLAND', crew: null },
    { id: 'town', name: 'MERCHANT SHIP', crew: null },
    {
      id: 'jungle', name: 'SKULL ISLE RUINS', crew: 'mossback', sub: 'RAIN, SPIKE PITS AND DART TRAPS',
      look: { base: 'beach', tint: 'rgba(14,44,36,0.62)', sky: '#0c1c24', layer: 'ruins', weather: 'rain' },
      terrain: { from: 'beach', tint: 'rgba(40,96,40,0.45)' },
    },
    { id: 'fort', name: 'THE HOLD', crew: null },
    {
      id: 'ghost', name: 'THE GHOST SHIP', crew: 'drowned', sub: 'FOG, LIGHTNING AND DROWNED SAILORS',
      look: { base: 'ship2', tint: 'rgba(8,40,44,0.5)', layer: 'wisps', weather: 'fog' },
      terrain: { from: 'ship', tint: 'rgba(60,150,140,0.4)' },
    },
    { id: 'ship', name: 'PIRATE SHIP', crew: null },
    {
      id: 'volcano', name: 'VOLCANIC COVE', crew: 'cinder', sub: 'LAVA, VENTS AND FALLING EMBERS',
      look: { base: 'beach2', tint: 'rgba(80,18,10,0.66)', sky: '#1c0606', layer: 'volcano', weather: 'embers' },
      terrain: { from: 'beach', tint: 'rgba(44,22,22,0.78)' },
    },
    {
      id: 'navy', name: "ADMIRAL'S FLAGSHIP", crew: 'navy', sub: 'THE FLEET IS SHELLING THE DECK',
      look: { base: 'town', tint: 'rgba(30,22,74,0.55)', sky: '#140c28', layer: 'fleet', weather: 'spray' },
      terrain: { from: 'ship', tint: 'rgba(30,50,120,0.35)' },
    },
    // ---------- the King's navy (levels 9-20, js/art-seas.js) ----------
    // look.base null: a sky painted in code instead of a painting (look.sky is its gradient).
    // terrain.top / plat / fill: code-drawn surface, one-way platform and fill styles, so every
    // level reads as its own place. perch: yards and crow's nests are safe footing after a fall.
    // rope: how its ropes look ('rope' or 'vine'). wind: gusts push you (JR.gust).
    // flyer: what its 'v' flyers are drawn as.
    {
      id: 'rigging', name: 'THE RIGGING', crew: 'topmen', sub: "HMS THUNDERBRASS: MAST TO MAST, MIND THE SAILS",
      look: { base: null, sky: ['#3c7cd0', '#7cb8ec', '#cce6f8'], tint: 'rgba(255,255,255,0.0)', layer: 'masts', weather: 'wind' },
      terrain: { from: 'ship', tint: 'rgba(92,56,24,0.35)', fill: 'mast', plat: 'yard' },
      perch: true, rope: 'rope', wind: 1,
    },
    {
      id: 'shore', name: 'SANDBAR SHORE', crew: 'shellbacks', sub: 'CRABS, GULLS AND THE TIDE COMING IN',
      look: { base: 'beach2', tint: 'rgba(255,214,140,0.18)', layer: 'surf', weather: 'sun' },
      terrain: { from: 'beach', tint: 'rgba(252,226,160,0.42)', fill: 'sand', top: 'wetsand', plat: 'driftwood' },
      rope: 'vine', flyer: 'gull',
    },
    {
      id: 'convoy', name: 'THE CONVOY', crew: 'marines', sub: 'BOARD THE KING\'S CONVOY, SHIP TO SHIP',
      look: { base: 'town', tint: 'rgba(70,78,96,0.62)', layer: 'hulls', weather: 'smoke' },
      terrain: { from: 'ship', tint: 'rgba(64,74,104,0.42)', fill: 'hull', top: 'gunwale', plat: 'gangplank' },
      rope: 'rope',
    },
    {
      id: 'vines', name: 'VINE GORGE', crew: 'howlers', sub: 'SWING VINE TO VINE OVER THE RIVER',
      look: { base: 'beach', tint: 'rgba(6,52,48,0.58)', layer: 'gorge', weather: 'mist' },
      terrain: { from: 'beach', tint: 'rgba(36,82,30,0.5)', top: 'roots', plat: 'log' },
      rope: 'vine',
    },
    {
      id: 'cliffs', name: 'GULL CLIFFS', crew: 'wreckers', sub: 'CHALK LEDGES, ROCKFALLS AND THE WIND OFF THE SEA',
      look: { base: 'beach2', tint: 'rgba(56,76,96,0.42)', layer: 'chalk', weather: 'breeze' },
      terrain: { from: 'fort', tint: 'rgba(236,232,214,0.62)', fill: 'chalk', top: 'turf', plat: 'ledge' },
      rope: 'rope', flyer: 'gull', wind: 0.6, faller: 'rock',
    },
    {
      id: 'caves', name: "SMUGGLERS' CAVES", crew: 'smugglers', sub: 'DRIPPING TUNNELS FULL OF POWDER AND PLUNDER',
      look: { base: 'fort', tint: 'rgba(6,14,30,0.7)', layer: 'cavern', weather: 'drips' },
      terrain: { from: 'fort', tint: 'rgba(24,46,66,0.6)', fill: 'cave', top: 'wet', plat: 'boards' },
      rope: 'rope', faller: 'stalactite',
    },
    {
      id: 'dockyard', name: "THE KING'S DOCKYARD", crew: 'dockwatch', sub: 'CRANES, SLIPWAYS AND THE DOCKYARD WATCH',
      look: { base: 'town2', tint: 'rgba(70,52,44,0.55)', layer: 'cranes', weather: 'haze' },
      terrain: { from: 'ship', tint: 'rgba(84,80,76,0.5)', fill: 'quay', top: 'bollards', plat: 'beam' },
      rope: 'rope',
    },
    {
      id: 'harbor', name: 'HARBOR FORT', crew: 'garrison', sub: 'STORM THE RAMPARTS BY NIGHT',
      look: { base: 'beach', tint: 'rgba(8,16,44,0.68)', layer: 'ramparts', weather: 'night' },
      terrain: { from: 'fort', tint: 'rgba(104,100,92,0.5)', fill: 'ashlar', top: 'battlement', plat: 'scaffold' },
      rope: 'rope',
    },
    {
      id: 'storm', name: 'STORM RIGGING', crew: 'stormwatch', sub: 'HMS TEMPEST IN A GALE: HOLD ON TIGHT',
      look: { base: null, sky: ['#141e22', '#24363a', '#3c5456'], tint: 'rgba(0,0,0,0.0)', layer: 'squall', weather: 'storm' },
      terrain: { from: 'ship', tint: 'rgba(40,60,70,0.55)', fill: 'wetmast', plat: 'torn' },
      perch: true, rope: 'rope', wind: 1.4, lightning: true,
    },
    {
      id: 'galleon', name: 'THE TREASURE GALLEON', crew: 'bullion', sub: "THE KING'S GOLD, AND THE GUARDS ON IT",
      look: { base: 'ship', tint: 'rgba(90,56,0,0.42)', layer: 'hoard', weather: 'glitter' },
      terrain: { from: 'ship', tint: 'rgba(150,104,24,0.42)', fill: 'gilded', top: 'gilt', plat: 'giltshelf' },
      rope: 'rope',
    },
    {
      id: 'blockade', name: 'THE BLOCKADE', crew: 'picket', sub: 'BOAT TO BOAT THROUGH THE PICKET LINE',
      look: { base: 'ship2', tint: 'rgba(4,10,40,0.62)', layer: 'pickets', weather: 'flares' },
      terrain: { from: 'ship', tint: 'rgba(20,30,60,0.55)', fill: 'boat', plat: 'oars' },
      rope: 'rope',
    },
    {
      id: 'flagship', name: "THE KING'S FLAGSHIP", crew: 'royal', sub: 'HMS SOVEREIGN OF THE SEAS: THE LAST FIGHT',
      look: { base: null, sky: ['#1c040c', '#6c1418', '#e06830'], tint: 'rgba(0,0,0,0.0)', layer: 'royal', weather: 'ash' },
      terrain: { from: 'ship', tint: 'rgba(110,20,30,0.38)', fill: 'royaldeck', top: 'royal', plat: 'giltyard' },
      rope: 'rope',
    },
  ];
  JR.BIOMES = JR.LEVELS.map(l => l.id);
  JR.BIOME_NAMES = Object.fromEntries(JR.LEVELS.map(l => [l.id, l.name]));
  JR.levelOf = biome => JR.LEVELS.find(l => l.id === biome);

  // The first four levels' crews rotate each voyage, in the order they always had.
  const CLASSIC = ['beach', 'town', 'fort', 'ship'];
  JR.crewFor = seg => {
    const n = JR.LEVELS.length, lvl = JR.LEVELS[((seg % n) + n) % n];
    if (lvl.crew) return lvl.crew;
    return JR.NATIONS[(CLASSIC.indexOf(lvl.id) + Math.floor(seg / n)) % JR.NATIONS.length];
  };

  // Lightning over the Ghost Ship: a bright flash and a weaker flicker every 6.5 s or so (the offset
  // shifts each time). 0 = dark, up to 1. Pure, so the game can play thunder on the same beat.
  JR.lightning = t => {
    const P = 6.5, c = Math.floor(t / P), ph = t - c * P - ((c * 7919) % 5) * 0.6;
    return ph >= 0 && ph < 0.1 ? 1 : ph >= 0.18 && ph < 0.26 ? 0.6 : 0;
  };

  // Wind up in the rigging: every 7 s a gust. First the streaks gather (the tell, 1.2 s), then it
  // blows from the right for 1.6 s, rising and falling. push: 0 to -1 (leftward). Pure, so the game
  // can play the gust's sound on the beat and the art can draw it.
  JR.GUST = { period: 7, tell: 1.2, blow: 1.6, air: 330, ground: 140 };
  JR.gust = t => {
    const G = JR.GUST, ph = ((t % G.period) + G.period) % G.period;
    if (ph < G.tell) return { tell: true, push: 0 };
    if (ph < G.tell + G.blow) return { tell: false, push: -Math.sin(((ph - G.tell) / G.blow) * Math.PI) };
    return { tell: false, push: 0 };
  };

  // ---------- checkpoints ----------
  // 'jr.unlocked' holds the furthest level reached, 0-based (0 = only Palm Tree Island);
  // 'jr.start' the level the picker last chose. Old saves have neither: they start at the island.
  const UNLOCK_KEY = 'jr.unlocked', START_KEY = 'jr.start';
  JR.clampLevel = n => { const v = Math.floor(+n); return Number.isFinite(v) ? Math.max(0, Math.min(JR.LEVELS.length - 1, v)) : 0; };
  const readInt = (store, key) => {
    try { const n = parseInt(store.getItem(key), 10); return Number.isFinite(n) ? n : 0; } catch (e) { return 0; }
  };
  const writeInt = (store, key, n) => { try { store.setItem(key, String(n)); } catch (e) { /* private window */ } };
  JR.loadUnlocked = store => JR.clampLevel(readInt(store, UNLOCK_KEY));
  // Records reaching level `index`; true when that is a new checkpoint.
  JR.unlockLevel = (store, index) => {
    const i = JR.clampLevel(index);
    if (i <= JR.loadUnlocked(store)) return false;
    writeInt(store, UNLOCK_KEY, i);
    return true;
  };
  JR.loadStart = store => Math.min(JR.clampLevel(readInt(store, START_KEY)), JR.loadUnlocked(store));
  JR.saveStart = (store, index) => writeInt(store, START_KEY, JR.clampLevel(index));

  // The captain's share for a finished voyage: 250 gold per eight levels sailed (so 625 for the
  // twenty-level voyage), times the voyage number, scaled by how much of it was sailed: a run started
  // from level 11 of 20 sailed half of it, so it gets half (rounded down to 10 gold).
  JR.SHARE_PER_LEVEL = 250 / 8;
  JR.voyageShare = (voyage, startLevel = 0) => {
    const n = JR.LEVELS.length, full = Math.round(JR.SHARE_PER_LEVEL * n) * voyage;
    const sailed = (n - JR.clampLevel(startLevel)) / n;
    return startLevel > 0 ? Math.floor((full * sailed) / 10) * 10 : full;
  };
})();
