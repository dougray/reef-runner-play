// Pixel-art toolkit: sprites are tiny 1x canvases built from strings (one char per pixel) or
// from pixel "pens" (thick lines, discs), then auto-outlined in dark ink. They are drawn scaled up
// with smoothing off, at positions snapped to device pixels, so they stay crisp and still move smoothly.
(() => {
  const JR = window.JR;
  const INK = '#1b1020';

  // NES-flavored palette. Sprites refer to colors by one character.
  const PAL = {
    K: INK,
    S: '#f8b888', s: '#d07850',            // skin, skin shade
    E: '#6a3418', e: '#9a5a28',            // hair/beard, lighter
    H: '#2a2438', h: '#58507a',            // hat black, highlight
    W: '#fcfcfc', w: '#bcbcd0',            // white, white shade
    R: '#d82838', r: '#901830',            // red, dark red (sash, hearts)
    V: '#a05a2c', v: '#6a3418',            // pirate's leather coat
    P: '#f0d8a0', p: '#c0a060',            // pants cream, shade
    B: '#4a2c18', b: '#7a4c28',            // boots, boot highlight
    Y: '#fcc838', y: '#c88810',            // gold, gold dark
    G: '#68687c', g: '#a8a8bc',            // gun metal, gun light
    D: '#8c5020', d: '#5c3010',            // wood, wood dark
    O: '#fc7c18',                          // flash orange
    L: '#fcfc80',                          // flash light
  };
  const NATION = {
    british: { C: '#c82030', c: '#881020', T: '#fcfcfc', J: '#2848a8', j: '#18286c', A: '#fcfcfc', a: '#2848a8', F: '#c82030', f: '#fcfcfc' , N: '#fcfcfc', n: '#bcbcd0' },
    spanish: { C: '#f0e8d0', c: '#b8a880', T: '#c82030', J: '#c82030', j: '#801018', A: '#fcc838', a: '#c82030', F: '#c82030', f: '#fcc838' , N: '#fcfcfc', n: '#bcbcd0' },
    french: { C: '#2850c0', c: '#183078', T: '#fcfcfc', J: '#fcfcfc', j: '#2850c0', A: '#d82838', a: '#2850c0', F: '#2850c0', f: '#fcfcfc' , N: '#2850c0', n: '#183078' },
    dutch: { C: '#f07818', c: '#a84808', T: '#203880', J: '#203880', j: '#101c48', A: '#203880', a: '#f07818', F: '#f07818', f: '#fcfcfc' , N: '#d8c090', n: '#a08858' },
  };

  const px = (JR.px = { PAL, NATION, INK, S: 1 });

  px.canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

  // A 1x drawing surface with pixel pens. Colors are palette chars or CSS colors.
  px.surface = (w, h, pal = PAL) => {
    const c = px.canvas(w, h);
    const g = c.getContext('2d');
    const col = k => pal[k] || PAL[k] || k;
    const s = {
      c, g, w, h,
      dot(x, y, k) { g.fillStyle = col(k); g.fillRect(Math.round(x), Math.round(y), 1, 1); return s; },
      rect(x, y, rw, rh, k) { g.fillStyle = col(k); g.fillRect(Math.round(x), Math.round(y), rw, rh); return s; },
      // Strings: one char per pixel, '.' or ' ' = transparent.
      rows(rows, ox = 0, oy = 0) {
        rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const k = r[x]; if (k !== '.' && k !== ' ') s.dot(ox + x, oy + y, k); } });
        return s;
      },
      // Thick line from (x0,y0) to (x1,y1), `t` px wide.
      line(x0, y0, x1, y1, k, t = 1) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        const o = Math.floor((t - 1) / 2);
        for (let i = 0; i <= n; i++) {
          const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
          s.rect(x - o, y - o, t, t, k);
        }
        return s;
      },
      disc(cx, cy, r, k) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) s.dot(cx + x, cy + y, k);
        return s;
      },
      // Wrap every opaque area in a 1px ink outline (4-neighbour). Call once, after drawing.
      outline(k = INK) {
        const img = g.getImageData(0, 0, w, h), d = img.data;
        const solid = i => d[i * 4 + 3] > 0;
        const add = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (solid(i)) continue;
          if ((x > 0 && solid(i - 1)) || (x < w - 1 && solid(i + 1)) || (y > 0 && solid(i - w)) || (y < h - 1 && solid(i + w))) add.push(x, y);
        }
        g.fillStyle = col(k);
        for (let i = 0; i < add.length; i += 2) g.fillRect(add[i], add[i + 1], 1, 1);
        return s;
      },
    };
    g.imageSmoothingEnabled = false;
    return s;
  };

  const cache = new Map();
  // Builds once per key: build(surface) draws into a w x h surface.
  px.sprite = (key, w, h, build, pal) => {
    let c = cache.get(key);
    if (!c) { const s = px.surface(w, h, pal); build(s); c = s.c; cache.set(key, c); }
    return c;
  };
  px.clearCache = () => cache.clear();

  // Snap a game-pixel coordinate to the nearest device pixel.
  px.snap = v => Math.round(v * px.S) / px.S;

  // Draw a sprite with its anchor (ax, ay) at game position (x, y); flip mirrors around the anchor.
  px.draw = (ctx, img, x, y, ax = 0, ay = 0, flip = false, rot = 0) => {
    if (!flip && !rot) { ctx.drawImage(img, px.snap(x - ax), px.snap(y - ay)); return; }
    ctx.save();
    ctx.translate(px.snap(x), px.snap(y));
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -ax, -ay);
    ctx.restore();
  };

  // ---------- 5x7 pixel font ----------
  const F = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    '&': ['.##..', '#..#.', '.##..', '.#...', '#.#.#', '#..#.', '.##.#'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '#.'],
    ':': ['.', '#', '.', '.', '.', '#', '.'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
    '·': ['.', '.', '.', '#', '.', '.', '.'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
    '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
    '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    ' ': ['...', '...', '...', '...', '...', '...', '...'],
  };

  // A whole string pre-rendered (with outline) at 1x; cached by text + color.
  px.textImage = (str, color = '#fcfcfc', outline = true) => {
    str = String(str);
    const key = `t:${str}:${color}:${outline}`;
    const glyphs = [...str].map(ch => F[ch] || F[ch.toUpperCase()] || F['?']);
    const w = glyphs.reduce((n, g) => n + g[0].length + 1, 0) + 1;
    return px.sprite(key, w + 1, 10, s => {
      let x = 1;
      for (const g of glyphs) {
        g.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') s.dot(x + i, 1 + y, color); });
        x += g[0].length + 1;
      }
      if (outline) s.outline();
    });
  };

  // Text at game position; size multiplies the 7px font. align: left | center | right.
  px.text = (ctx, str, x, y, { color = '#fcfcfc', size = 1, align = 'left', outline = true } = {}) => {
    const img = px.textImage(str, color, outline);
    const w = img.width * size, h = img.height * size;
    const ox = align === 'center' ? w / 2 : align === 'right' ? w : 0;
    ctx.drawImage(img, px.snap(x - ox), px.snap(y - h / 2), w, h);
    return w;
  };
})();
