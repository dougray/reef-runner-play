// Our own drawings, in the style of Pixel Frog's packs (same dark outline #33323d, flat 2-3 shade
// fills): the guns at all five aims, the muzzle flash, gun badges, the parrot and monkey, the
// she-captain's hair and the crouch pose. Guns are described once as shapes along the barrel and
// rasterized per aim, so every angle stays crisp; the rasterizer is pure (tested in Node).
(() => {
  const JR = window.JR;

  const COLORS = {
    K: '#33323d', M: '#9aa2bf', m: '#666c8c', H: '#d3daea', W: '#b8703c', w: '#7c4626',
    G: '#eed878', g: '#c59a3a', B: '#4b4a5e', b: '#2c2b38', O: '#ff9a3c', L: '#fff3b0',
    R: '#d06c63', r: '#9c4446', Y: '#f5c84a', U: '#4a72c8', u: '#30508e', E: '#7a3e24', e: '#a85a34',
    S: '#eebc9d', s: '#cd897c', T: '#f4f4f4',
    X: '#e04848', h: '#f49a8c', x: '#a8303a', D: '#5c4c5e', d: '#463a4a',
  };

  // The HUD heart (the Wood and Paper icons have none): 9x8, pack outline, red or emptied.
  const HEART = ['.KK...KK.', 'KhXK.KXXK', 'KhXXKXXxK', 'KXXXXXXxK', '.KXXXXxK.', '..KXXxK..', '...KxK...', '....K....'];
  const heartRows = full => full ? HEART.slice() : HEART.map(r => r.replace(/[hX]/g, 'D').replace(/x/g, 'd'));

  // Shapes along the barrel: u points down the barrel, v points "down" from it; the hand holds
  // the gun at (0, 0). Ranges are [from, to). A part with `s` uses that color on its bottom row.
  const GUNS = {
    pistol: { muzzle: [10, -1], parts: [
      { u: [-1, 2], v: [0, 4], c: 'W', s: 'w' }, { u: [-2, 4], v: [-2, 0], c: 'M', s: 'm' },
      { u: [4, 10], v: [-2, 0], c: 'M', s: 'm' }, { u: [4, 9], v: [-2, -1], c: 'H' }] },
    brace: { muzzle: [10, -1], parts: [
      { u: [-1, 2], v: [0, 4], c: 'W', s: 'w' }, { u: [-2, 4], v: [-2, 0], c: 'G', s: 'g' },
      { u: [4, 10], v: [-2, 0], c: 'M', s: 'm' }, { u: [4, 9], v: [-2, -1], c: 'H' }] },
    musket: { muzzle: [19, -1], parts: [
      { u: [-9, 1], v: [-1, 2], c: 'W', s: 'w' }, { u: [-1, 1], v: [1, 3], c: 'W', s: 'w' },
      { u: [1, 4], v: [-2, 1], c: 'M', s: 'm' }, { u: [4, 19], v: [-2, 0], c: 'M', s: 'm' }, { u: [4, 18], v: [-2, -1], c: 'H' }] },
    rifle: { muzzle: [21, -1], parts: [
      { u: [-9, 1], v: [-1, 2], c: 'w', s: 'E' }, { u: [-1, 1], v: [1, 3], c: 'w', s: 'E' },
      { u: [1, 4], v: [-2, 1], c: 'M', s: 'm' }, { u: [4, 21], v: [-2, 0], c: 'M', s: 'm' }, { u: [4, 20], v: [-2, -1], c: 'H' },
      { u: [15, 17], v: [-3, -2], c: 'M' }] },
    tribarrel: { muzzle: [10, -1], parts: [
      { u: [-1, 2], v: [1, 5], c: 'W', s: 'w' }, { u: [-2, 4], v: [-3, 1], c: 'M', s: 'm' },
      { u: [4, 10], v: [-3, 1], c: 'M', s: 'm' }, { u: [4, 10], v: [-2, -1], c: 'm' }, { u: [4, 10], v: [0, 1], c: 'm' },
      { u: [4, 9], v: [-3, -2], c: 'H' }] },
    blunderbuss: { muzzle: [12, -1], parts: [
      { u: [-6, 1], v: [-1, 2], c: 'W', s: 'w' }, { u: [-1, 1], v: [1, 3], c: 'W', s: 'w' },
      { u: [1, 9], v: [-2, 0], c: 'G', s: 'g' }, { u: [9, 12], v: [-3, 1], c: 'G', s: 'g' }, { u: [2, 9], v: [-2, -1], c: 'L' }] },
    grenado: { muzzle: [4, -3], parts: [                       // held out at arm's length
      { disc: [4, -3, 3.2], c: 'B', s: 'b' }, { u: [3, 4], v: [-5, -4], c: 'H' },
      { u: [4, 5], v: [-8, -6], c: 'g' }, { u: [4, 6], v: [-9, -8], c: 'O' }] },
    swivel: { muzzle: [13, -1], parts: [
      { u: [-1, 2], v: [1, 4], c: 'W', s: 'w' }, { u: [-3, 13], v: [-3, 1], c: 'M', s: 'm' },
      { u: [-2, 12], v: [-3, -2], c: 'H' }, { u: [0, 1], v: [-3, 1], c: 'G' }, { u: [9, 10], v: [-3, 1], c: 'G' }] },
  };
  const ANGLE = { fwd: 0, diagUp: -Math.PI / 4, up: -Math.PI / 2, diagDown: Math.PI / 4, down: Math.PI / 2 };

  // Pure: the gun as rows of color letters ('.' = clear) with the grip (gx, gy) and muzzle (mx, my).
  const rasterCache = new Map();
  function rasterGun(id, aim) {
    const key = id + ':' + aim;
    if (rasterCache.has(key)) return rasterCache.get(key);
    const def = GUNS[id], th = ANGLE[aim], cs = Math.cos(th), sn = Math.sin(th);
    const toXY = (u, v) => [u * cs - v * sn, u * sn + v * cs];
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    const grow = (u, v) => { const [x, y] = toXY(u, v); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const p of def.parts) {
      if (p.disc) { const [cu, cv, r] = p.disc; grow(cu - r, cv - r); grow(cu + r, cv + r); grow(cu - r, cv + r); grow(cu + r, cv - r); }
      else for (const u of p.u) for (const v of p.v) grow(u, v);
    }
    const ox = Math.floor(x0) - 1, oy = Math.floor(y0) - 1;
    const W = Math.ceil(x1) - ox + 2, H = Math.ceil(y1) - oy + 2;
    const grid = Array.from({ length: H }, () => Array(W).fill('.'));
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const x = px + ox + 0.5, y = py + oy + 0.5;
      const u = x * cs + y * sn, v = -x * sn + y * cs;
      for (const p of def.parts) {
        let inside, bottom;
        if (p.disc) {
          const [cu, cv, r] = p.disc;
          inside = (u - cu) ** 2 + (v - cv) ** 2 <= r * r;
          bottom = v > cv + r * 0.35;
        } else {
          inside = u >= p.u[0] && u < p.u[1] && v >= p.v[0] && v < p.v[1];
          bottom = v >= p.v[1] - 1;
        }
        if (inside) grid[py][px] = p.s && bottom ? p.s : p.c;
      }
    }
    // Pack-style outline: every clear pixel touching the gun becomes ink.
    const filled = (x, y) => y >= 0 && y < H && x >= 0 && x < W && grid[y][x] !== '.' && grid[y][x] !== 'k';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (grid[y][x] === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) grid[y][x] = 'k';
    }
    const rows = grid.map(r => r.join('').replace(/k/g, 'K'));
    const [mxw, myw] = toXY(def.muzzle[0], def.muzzle[1]);
    const out = { rows, gx: -ox, gy: -oy, mx: Math.round(mxw - ox), my: Math.round(myw - oy) };
    rasterCache.set(key, out);
    return out;
  }

  // Muzzle flash: 3 frames, white core, yellow, orange.
  const FLASH = [
    ['..O..', '.OYO.', 'OYLYO', '.OYO.', '..O..'],
    ['O.O.O', '.OYO.', 'OYLYO', '.OYO.', 'O.O.O'],
    ['.....', '..O..', '.OYO.', '..O..', '.....'],
  ];
  // Parrot (2 wing frames) and monkey (2 frames), pack-style outlines.
  const PARROT = [
    ['....KKK.....', '...KRRRK....', '..KRRTKRK...', '..KRRRRKYK..', '.KUURRRRKK..', 'KUuURRRRK...', '.KUUURRRK...', '..KKKRRK....', '....KYYK....', '.....KK.....'],
    ['....KKK.....', '...KRRRK....', '..KRRTKRK...', '..KRRRRKYK..', '..KRRRRRKK..', '.KRRUUUUK...', 'KUuUUUUK....', '.KKKKRRK....', '....KYYK....', '.....KK.....'],
  ];
  const MONKEY = [
    ['...KKKK.....', '..KEEEEK....', '.KESSSSEK...', '.KSKSSKSK...', 'KEESSSSSEK..', '.KESSSSEK...', '..KEEEEK....', '.KEEEEEEK.K.', '.KEK..KEKKEK', '..K....K..K.'],
    ['...KKKK.....', '..KEEEEK....', '.KESSSSEK...', '.KSKSSKSK...', 'KEESSSSSEK..', '.KESSSSEK...', '..KEEEEK..K.', '.KEEEEEEKKEK', '.KEK..KEK.K.', '..K....K....'],
  ];

  // The she-captain's hair: a lock hanging behind the head from under the hat to the shoulders,
  // in frame coordinates. backX = the head's back edge (leftmost opaque pixel on the face rows).
  function hairPixels(f, backX) {
    const top = v => v - f.dy;
    const y0 = top(f.parts.brim) + 1, y1 = Math.min(top(f.parts.chin) + 8, top(f.parts.belt) + 1);
    const pts = [];
    for (let y = y0; y <= y1; y++) {
      // a full mane 5 px wide behind the head, narrowing into curled ends
      const k = (y - y0) / Math.max(1, y1 - y0);
      const left = backX - 4 + (k > 0.8 ? 1 : 0), right = backX + (k < 0.5 ? 1 : 0);
      for (let x = left; x <= right; x++) {
        if (x < 0) continue;
        const edge = x === left || y === y1;
        pts.push({ x, y, c: edge ? 'K' : (x * 7 + y * 3) % 5 === 0 ? 'e' : 'E' });
      }
    }
    return pts;
  }

  // ---------- canvases (browser only) ----------

  const imgCache = new Map();
  const toCanvas = (key, rows) => {
    let c = imgCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { g.fillStyle = COLORS[r[x]]; g.fillRect(x, y, 1, 1); } });
    imgCache.set(key, c);
    return c;
  };

  // Who plays each enemy kind (behavior unchanged) and the poses drawn for them; bosses use their
  // JR.BOSSES[nation].art with BOSS_STATES. `left`: the pack draws it facing left (the shooter traps
  // and every Pirate Bomb character); the rest face right.
  const CREW = ['idle', 'run', 'anticipation', 'attack', 'hit', 'deadHit', 'deadGround'];
  const CAST = {
    d: { anim: 'crabby', states: CREW },                     // deckhand
    m: { anim: 'fierceTooth', states: CREW },                // marine
    b: { anim: 'pinkStar', states: CREW },                   // grenadier
    f: { anim: 'bald', scale: 0.5, left: true, states: ['idle', 'run', 'attack', 'hit', 'deadHit', 'deadGround'] },   // officer
    s: { anim: 'seashell', left: true, states: ['idle', 'fire', 'hit', 'destroyed'] },   // sharpshooter
    n: { anim: 'cannon', left: true, states: ['idle', 'fire', 'fireFx'] },
    c: { anim: 'box', states: ['idle', 'hit'] },
    $: { anim: 'chest', states: ['idle'] },
  };
  const BOSS_STATES = ['idle', 'run', 'jump', 'fall', 'attack', 'hit', 'deadHit', 'deadGround'];

  // Aim vector -> pose key. Down-forward while airborne uses diagDown; straight down only in the air.
  JR.aimKey = (ax, ay) => ay < -0.9 ? 'up' : ay > 0.9 ? 'down' : ay < -0.3 ? 'diagUp' : ay > 0.3 ? 'diagDown' : 'fwd';

  // Where the captain holds his gun, from his feet: standing (the idle frame's hand point, checked
  // against the atlas in tests) and crouching (js/art.js draws the crouch gun there).
  const HAND = { x: 7, y: -13 }, CROUCH_HAND = { x: 4, y: -7 };
  // The drawn muzzle from the feet, for a gun at an aim, facing dir (1 right, -1 left): shots and
  // the flash start here.
  const muzzle = (gun, aim, dir, crouch) => {
    const h = crouch ? CROUCH_HAND : HAND, r = rasterGun(gun, aim);
    return { x: dir * (h.x - r.gx + r.mx), y: h.y - r.gy + r.my };
  };

  JR.packart = {
    HAND, CROUCH_HAND, muzzle,
    CAST, BOSS_STATES, heartRows,
    heart: full => toCanvas('heart' + full, heartRows(full)),
    COLORS, GUNS, FLASH, PARROT, MONKEY, rasterGun, hairPixels, toCanvas,
    gun(id, aim) { const r = rasterGun(id, aim); return { img: toCanvas('gun:' + id + aim, r.rows), gx: r.gx, gy: r.gy, mx: r.mx, my: r.my }; },
    flash: i => toCanvas('flash' + i, FLASH[i % FLASH.length]),
    parrot: i => toCanvas('parrot' + (i % 2), PARROT[i % 2]),
    monkey: i => toCanvas('monkey' + (i % 2), MONKEY[i % 2]),
    // The captain's (or she-captain's) frame as a canvas, recolored, plus hair for her.
    // Cached per frame; drawn by the caller with the frame's (dx, dy).
    captainFrame(anim, i, look) {
      const key = `cap:${anim}:${i}:${look.body}:${(look.recolor || []).join(',')}`;
      let c = imgCache.get(key);
      if (c) return c;
      const f = JR.atlas.frameAt(anim, i);
      c = document.createElement('canvas');
      c.width = f.w; c.height = f.h;
      const g = c.getContext('2d');
      JR.atlas.draw(g, anim, 0, -f.dx, -f.dy, { i, recolor: look.recolor });
      let d = null;
      if (look.body === 'female' && f.parts) {
        try { d = g.getImageData(0, 0, f.w, f.h).data; } catch { d = null; }   // file:// can't read pixels: no hair
      }
      if (look.body === 'female' && f.parts && d) {
        const row = f.parts.chin - f.dy - 2;
        let backX = 0;
        for (let x = 0; x < f.w; x++) if (d[(row * f.w + x) * 4 + 3]) { backX = x; break; }
        for (const p of hairPixels(f, backX)) {
          if (d[(p.y * f.w + p.x) * 4 + 3] && p.c === 'K') continue;   // keep his outline where it already is
          g.fillStyle = COLORS[p.c]; g.fillRect(p.x, p.y, 1, 1);
        }
      }
      imgCache.set(key, c);
      return c;
    },
    // Crouch: the landing frame squashed to 70% height, feet kept on the ground.
    crouch(look) {
      const key = `crouch:${look.body}:${(look.recolor || []).join(',')}`;
      let c = imgCache.get(key);
      if (c) return { img: c, dx: c.dx, dy: c.dy };
      const f = JR.atlas.frameAt('captain.ground', 0);
      const src = JR.packart.captainFrame('captain.ground', 0, look);
      c = document.createElement('canvas');
      const h = Math.round(f.h * 0.7);
      c.width = f.w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, 0, f.w, f.h, 0, 0, f.w, h);
      c.dx = f.dx; c.dy = -h;
      imgCache.set(key, c);
      return { img: c, dx: c.dx, dy: c.dy };
    },
  };
})();
