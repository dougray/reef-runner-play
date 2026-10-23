// Level: chunks (js/chunks.js) strung together endlessly in area segments, plus tile collision.
// Spawn letters are lifted out of the grid into level.spawns, tagged with the segment's nation.
(() => {
  const JR = window.JR;
  const W = 30, H = 17;
  const SPAWNS = 'odmrcsbfn$';

  JR.makeLevel = seed => {
    const rand = JR.rng(seed);
    const cols = [];
    const chunks = [];                    // one entry per appended chunk: {chunk, biome, nation, seg}
    let last = null;
    const info = col => chunks[Math.floor(col / W)] || chunks[chunks.length - 1];
    const lv = {
      spawns: [],
      arenas: [],
      get cols() { return cols.length; },
      difficulty: col => Math.min(3, Math.floor(col / 120)),
      tile(c, r) { return c >= 0 && c < cols.length && r >= 0 && r < H ? cols[c][r] : '.'; },
      setTile(c, r, ch) { lv.ensure(c + 1); cols[c][r] = ch; },
      solid(c, r) { return lv.tile(c, r) === '#'; },
      platform(c, r) { return lv.tile(c, r) === '='; },
      ensure(upto) { while (cols.length < upto) append(next()); },
      biomeAt: col => (lv.ensure(col + 1), info(Math.max(0, col)).biome),
      nationAt: col => (lv.ensure(col + 1), info(Math.max(0, col)).nation),
      segmentAt: col => (lv.ensure(col + 1), info(Math.max(0, col)).seg),
      chunkAt: col => (lv.ensure(col + 1), info(Math.max(0, col)).chunk),
    };

    function next() {
      const seg = Math.floor(chunks.length / JR.SEGMENT);
      const biome = JR.BIOMES[seg % JR.BIOMES.length];
      const nation = JR.NATIONS[(seg + Math.floor(seg / JR.BIOMES.length)) % JR.NATIONS.length];
      const meta = { biome, nation, seg };
      if (chunks.length % JR.SEGMENT === 0) return [JR.CHUNKS.find(c => c.biome === biome && c.gate), meta];
      if (chunks.length % JR.SEGMENT === JR.SEGMENT - 1) return [JR.CHUNKS.find(c => c.biome === biome && c.arena), meta];
      const d = lv.difficulty(cols.length);
      // Mostly chunks near the current difficulty, with easier ones as breathers.
      const area = JR.CHUNKS.filter(c => c.biome === biome && !c.gate && !c.arena && c.diff <= d);
      let pool = area.filter(c => c !== last);
      if (!pool.length) pool = area;
      const hard = pool.filter(c => c.diff >= d - 1);
      if (hard.length && rand() < 0.75) pool = hard;
      return [JR.pick(rand, pool), meta];
    }

    function append([ch, meta]) {
      last = ch;
      chunks.push({ chunk: ch, ...meta });
      const base = cols.length;
      if (ch.arena) lv.arenas.push({ x0: base * JR.TILE, x1: (base + W) * JR.TILE, ...meta, done: false });
      for (let c = 0; c < W; c++) {
        const col = [];
        for (let r = 0; r < H; r++) {
          const t = ch.rows[r][c];
          if (SPAWNS.includes(t)) {
            lv.spawns.push({ type: t, x: (base + c) * JR.TILE, y: r * JR.TILE, nation: meta.nation });
            col.push('.');
          } else col.push(t);
        }
        cols.push(col);
      }
    }

    return lv;
  };

  // Moves a body {x, y, w, h, vx, vy} through the tiles, X then Y. The caller applies gravity.
  // One-way platforms only catch a falling body whose feet were above them, unless b.drop is set.
  JR.moveBody = (lv, b, dt) => {
    const T = JR.TILE;
    b.hitWall = false;

    b.x += b.vx * dt;
    const top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
    if (b.vx > 0) {
      const c = Math.floor((b.x + b.w - 0.01) / T);
      for (let r = top; r <= bot; r++) if (lv.solid(c, r)) { b.x = c * T - b.w; b.vx = 0; b.hitWall = true; break; }
    } else if (b.vx < 0) {
      const c = Math.floor(b.x / T);
      for (let r = top; r <= bot; r++) if (lv.solid(c, r)) { b.x = (c + 1) * T; b.vx = 0; b.hitWall = true; break; }
    }

    const prevBottom = b.y + b.h;
    b.y += b.vy * dt;
    b.onGround = false;
    const left = Math.floor(b.x / T), right = Math.floor((b.x + b.w - 0.01) / T);
    if (b.vy > 0) {
      const r = Math.floor((b.y + b.h - 0.01) / T);
      for (let c = left; c <= right; c++) {
        const oneWay = lv.platform(c, r) && !b.drop && prevBottom <= r * T + 0.01;
        if (lv.solid(c, r) || oneWay) { b.y = r * T - b.h; b.vy = 0; b.onGround = true; break; }
      }
    } else if (b.vy < 0) {
      const r = Math.floor(b.y / T);
      for (let c = left; c <= right; c++) if (lv.solid(c, r)) { b.y = (r + 1) * T; b.vy = 0; break; }
    }
  };
})();
