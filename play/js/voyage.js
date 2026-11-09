// The voyage: the run passes through a chain of areas, each with its own sky, weather, reefs and
// enemies, then loops round harder. Reaching an area unlocks it as a checkpoint to start from.
// Pure data and arithmetic (no canvas, no DOM), so tests/run.mjs can load it on its own.
window.Voyage = (() => {
  'use strict';

  const AREA_LEN = 25;             // reefs per area

  // Colours are [r, g, b] so they can be blended while one area fades into the next.
  //   sky / sea: top and bottom of each gradient; sand: the sea floor; wave: the wave marks (rgb,
  //   their alpha is the game's); cloud: the little sky clouds (null: none).
  //   decor: what sits on the horizon. weather: the overlay drawn on top (see game.js).
  //   gap: extra gap height to make up for the area's hazard. pay: points per reef.
  //   roster: which warships turn up, with weights; `ghost` ones fade in and out.
  //   every: multiplies the time between warships. most: cap on warships out at once.
  //   reefs: how the obstacles look and move (tint, lanterns, lava, bobbing, whirlpools).
  const AREAS = [
    {
      id: 'shallows', name: 'Sunny Shallows', sub: 'Fair winds, captain',
      sky: [[46, 143, 230], [159, 220, 255]], sea: [[47, 195, 224], [11, 86, 163]],
      sand: [232, 194, 116], wave: [255, 255, 255], cloud: [255, 255, 255],
      decor: 'island', weather: 'clear', gulls: true, gap: 0, pay: 1, tempo: 1,
      roster: [['frigate', 1], ['galleon', 0]],   // galleons come in by reef 12, as before
      every: 1, most: 2,
      reefs: { look: 'day' },
    },
    {
      id: 'storm', name: 'Storm Coast', sub: 'Rain, gusts and double points',
      sky: [[52, 64, 94], [135, 149, 176]], sea: [[43, 142, 166], [10, 58, 110]],
      sand: [214, 178, 110], wave: [230, 240, 255], cloud: [176, 184, 204],
      decor: 'island', weather: 'storm', gulls: false, gap: 12, pay: 2, tempo: 1.04,
      roster: [['frigate', 0.45], ['galleon', 0.3], ['gunboat', 0.25]],
      every: 1.2, most: 2,
      reefs: { look: 'storm' },
    },
    {
      id: 'fog', name: 'Fog Banks', sub: 'Steer by the lanterns',
      sky: [[150, 162, 172], [205, 211, 214]], sea: [[120, 160, 170], [40, 84, 104]],
      sand: [205, 191, 156], wave: [235, 240, 240], cloud: null,
      decor: 'none', weather: 'fog', gulls: true, gap: 10, pay: 1, tempo: 0.97,
      roster: [['frigate', 0.45], ['gunboat', 0.35], ['galleon', 0.2]],
      every: 1.1, most: 2,
      reefs: { look: 'fog', lanterns: true, whirlpools: 0.3 },
    },
    {
      id: 'ghost', name: 'Ghost Waters', sub: 'Shoot the spectres when they show',
      sky: [[10, 16, 44], [44, 58, 104]], sea: [[30, 72, 102], [6, 22, 48]],
      sand: [108, 120, 150], wave: [170, 210, 235], cloud: null,
      decor: 'wreck', weather: 'night', gulls: false, gap: 14, pay: 1, tempo: 0.96,
      roster: [['frigate', 0.55, 'ghost'], ['galleon', 0.45, 'ghost']],
      every: 1, most: 1,
      reefs: { look: 'night', bob: 24 },
    },
    {
      id: 'volcano', name: 'Volcano Isles', sub: 'Fire ships ahead!',
      sky: [[58, 26, 24], [200, 92, 46]], sea: [[120, 70, 66], [36, 18, 26]],
      sand: [74, 58, 54], wave: [255, 190, 140], cloud: [120, 96, 90],
      decor: 'volcano', weather: 'embers', gulls: false, gap: 8, pay: 1, tempo: 1.04,
      roster: [['fireship', 0.4], ['frigate', 0.3], ['galleon', 0.3]],
      every: 1, most: 2,
      reefs: { look: 'lava' },
    },
    {
      id: 'blockade', name: "Admiral's Blockade", sub: "The Royal Navy's last line",
      sky: [[92, 66, 140], [255, 170, 110]], sea: [[226, 140, 120], [40, 50, 110]],
      sand: [236, 184, 120], wave: [255, 228, 200], cloud: [255, 214, 200],
      decor: 'fleet', weather: 'sunset', gulls: true, gap: 6, pay: 1, tempo: 1.02,
      roster: [['frigate', 0.35], ['galleon', 0.35], ['gunboat', 0.3]],
      every: 0.9, most: 2, boss: 3,   // HMS Invincible blocks the way 3 reefs in
      reefs: { look: 'sunset' },
    },
  ];
  const LOOP = AREAS.length * AREA_LEN;
  const MAX_LOOP_STEP = 2;         // past the second loop round, it stops getting harder

  // Where `passed` reefs puts the ship: area index, which loop, and how far in.
  function areaAt(passed) {
    const p = Math.max(0, passed | 0);
    const loop = Math.floor(p / LOOP);
    const index = Math.floor((p % LOOP) / AREA_LEN);
    const start = loop * LOOP + index * AREA_LEN;
    return { index, loop, start, into: p - start, area: AREAS[index] };
  }
  const startOf = (index, loop = 0) => loop * LOOP + index * AREA_LEN;
  // How many notches harder than the first voyage: it eases up over each loop's first area
  // rather than jumping, then holds.
  function hard(passed) {
    const loop = Math.floor(Math.max(0, passed) / LOOP);
    if (loop === 0) return 0;
    return Math.min(MAX_LOOP_STEP, loop - 1 + Math.min(1, (passed - loop * LOOP) / AREA_LEN));
  }

  // ---------- difficulty (by reefs passed, not score; see README) ----------
  // The base curve is the original game's and tops out by reef 40; the areas add their hazard on
  // top, and give a little more gap to pay for it. Each loop round raises the caps a notch.
  const speed = (passed, portrait) => Math.min(290 + 15 * hard(passed), 170 + passed * 3) * (portrait ? 0.9 : 1);
  const gapSize = passed => Math.max(135 - 6 * hard(passed), 190 - passed * 2) + areaAt(passed).area.gap;
  const shotSpeed = passed => Math.min(410 + 20 * hard(passed), 330 + passed * 2);
  const galleonChance = passed => (passed < 12 ? 0 : Math.min(0.5, 0.25 + (passed - 12) * 0.02));
  const maxEnemies = (passed, portrait) => (passed >= 25 && !portrait ? areaAt(passed).area.most : 1);
  const enemyGap = (passed, r) => ((5 + r * 4) - Math.min(3, passed * 0.06)) * areaAt(passed).area.every;

  // Which warship comes next, from the area's roster; `r` is a random number 0-1.
  function pickEnemy(passed, r) {
    const { area } = areaAt(passed);
    if (area.id === 'shallows') return { kind: r < galleonChance(passed) ? 'galleon' : 'frigate', ghost: false };
    const total = area.roster.reduce((s, e) => s + e[1], 0);
    let x = r * total;
    for (const [kind, w, flag] of area.roster) {
      if (x < w) return { kind, ghost: flag === 'ghost' };
      x -= w;
    }
    const [kind, , flag] = area.roster[area.roster.length - 1];
    return { kind, ghost: flag === 'ghost' };
  }

  // A ghost ship's solidity, 0 (a faint shimmer, shots pass through) to 1 (solid), over a 3.6 s
  // cycle: fade in, hold, fade out, linger unseen.
  function ghostSolid(t) {
    const c = ((t % 3.6) + 3.6) % 3.6;
    if (c < 0.6) return c / 0.6;
    if (c < 2.2) return 1;
    if (c < 2.8) return 1 - (c - 2.2) / 0.6;
    return 0;
  }

  // ---------- checkpoints ----------
  // `reefrunner.unlocked` holds the furthest area reached (0 = only the start). Old saves have none.
  const UNLOCK_KEY = 'reefrunner.unlocked', START_KEY = 'reefrunner.start';
  const clampArea = n => Math.max(0, Math.min(AREAS.length - 1, n | 0));
  function readInt(store, key) {
    try { const n = parseInt(store.getItem(key), 10); return Number.isFinite(n) ? n : 0; } catch { return 0; }
  }
  function writeInt(store, key, n) {
    try { store.setItem(key, String(n)); } catch { /* private mode etc. */ }
  }
  const loadUnlocked = store => clampArea(readInt(store, UNLOCK_KEY));
  // Records reaching area `index`; returns true when that is a new checkpoint.
  function unlock(store, index) {
    if (index <= loadUnlocked(store)) return false;
    writeInt(store, UNLOCK_KEY, clampArea(index));
    return true;
  }
  const loadStart = store => Math.min(clampArea(readInt(store, START_KEY)), loadUnlocked(store));
  const saveStart = (store, index) => writeInt(store, START_KEY, clampArea(index));

  // ---------- palettes ----------
  const lerp = (a, b, k) => a + (b - a) * k;
  const mixRGB = (a, b, k) => [0, 1, 2].map(i => Math.round(lerp(a[i], b[i], k)));
  // Blend two areas' colours (k 0 → a, 1 → b), for the fade between areas.
  function blend(a, b, k) {
    const out = {};
    for (const key of ['sky', 'sea']) out[key] = [mixRGB(a[key][0], b[key][0], k), mixRGB(a[key][1], b[key][1], k)];
    for (const key of ['sand', 'wave']) out[key] = mixRGB(a[key], b[key], k);
    const ca = a.cloud || b.cloud, cb = b.cloud || a.cloud;
    out.cloud = ca && mixRGB(ca, cb, k);
    out.cloudAlpha = (a.cloud ? 1 - k : 0) + (b.cloud ? k : 0);
    return out;
  }
  const rgb = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  // Darken a colour toward a stormy slate (k 0-1), for the storm's gloom.
  const gloom = (c, k) => mixRGB(c, [52, 64, 94], k);

  return {
    AREA_LEN, AREAS, LOOP, areaAt, startOf,
    speed, gapSize, shotSpeed, galleonChance, maxEnemies, enemyGap, pickEnemy, ghostSolid,
    UNLOCK_KEY, START_KEY, loadUnlocked, unlock, loadStart, saveStart,
    blend, rgb, gloom, mixRGB,
  };
})();
