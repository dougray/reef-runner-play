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

  // The captain's share for a finished voyage, scaled by how much of it was sailed: a run started
  // from level 5 of 8 sailed half of it, so it gets half (rounded down to 10 gold).
  JR.voyageShare = (voyage, startLevel = 0) => {
    const full = 250 * voyage, n = JR.LEVELS.length;
    const sailed = (n - JR.clampLevel(startLevel)) / n;
    return startLevel > 0 ? Math.floor((full * sailed) / 10) * 10 : full;
  };
})();
