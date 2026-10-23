// The sprite sheet built by `node tools/playtest.mjs atlas` from Pixel Frog's CC0 packs:
// assets/atlas.png plus assets/atlas.json. Every animation is anchored at its feet, so drawing
// at (x, y) puts the feet on y. Recolors (the captain's outfits, rival crews) are made once from
// the frames and cached.
(() => {
  const JR = window.JR;

  // Pure: a copy of RGBA `data` with colors in `map` ('#rrggbb' -> '#rrggbb') swapped.
  // `region` {x, y, w, h, width} limits the swap to a rectangle of a `width`-wide image.
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  JR.remapPixels = (data, map, region) => {
    const out = Uint8ClampedArray.from(data);
    const from = Object.keys(map).map(k => [hex(k), hex(map[k])]);
    const n = data.length / 4;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (!out[o + 3]) continue;
      if (region) {
        const x = i % region.width, y = Math.floor(i / region.width);
        if (x < region.x || x >= region.x + region.w || y < region.y || y >= region.y + region.h) continue;
      }
      for (const [f, t] of from) {
        if (out[o] === f[0] && out[o + 1] === f[1] && out[o + 2] === f[2]) { out[o] = t[0]; out[o + 1] = t[1]; out[o + 2] = t[2]; break; }
      }
    }
    return out;
  };

  // Rival crews: one color scheme per area, made by turning the hue (and saturation, lightness) of
  // colored pixels. Grays, the ink outline and whites stay as they are. Pure.
  JR.CREWS = { british: null, spanish: { hue: -40, sat: 1.1, light: 1 }, french: { hue: 115, sat: 0.85, light: 1 }, dutch: { hue: 215, sat: 0.45, light: 0.8 } };
  JR.crewPixels = (data, nation) => {
    const out = Uint8ClampedArray.from(data), c = JR.CREWS[nation];
    if (!c) return out;
    for (let o = 0; o < out.length; o += 4) {
      if (!out[o + 3]) continue;
      const r = out[o] / 255, g = out[o + 1] / 255, b = out[o + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      if (d < 0.12) continue;                                   // gray enough: leave it
      let s = d / (1 - Math.abs(2 * l - 1));
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + c.hue + 720) % 360;
      s = Math.min(1, s * c.sat);
      const L = l * c.light, C = (1 - Math.abs(2 * L - 1)) * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - C / 2;
      const [R, G, B] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
      out[o] = Math.round((R + m) * 255); out[o + 1] = Math.round((G + m) * 255); out[o + 2] = Math.round((B + m) * 255);
    }
    return out;
  };

  let A = null, img = null;
  const cache = new Map();

  const atlas = (JR.atlas = {
    get ready() { return !!(A && img); },
    get data() { return A; },
    get image() { return img; },
    use(json) { A = json; cache.clear(); },
    load(src, json) {
      atlas.use(json);
      return new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => { img = i; ok(); };
        i.onerror = no;
        i.src = src;
      });
    },
    has: name => !!(A && A.anims[name]),
    frames: name => A.anims[name].frames.length,
    frameAt: (name, i) => { const fr = A.anims[name].frames; return fr[Math.max(0, Math.min(fr.length - 1, i))]; },
    // Frame index for an animation `t` seconds in; loops unless loop === false (then holds the last).
    index(name, t, loop = true) {
      const a = A.anims[name], k = Math.floor(Math.max(0, t) * a.fps);
      return loop ? k % a.frames.length : Math.min(k, a.frames.length - 1);
    },
    frame: (name, t, loop = true) => A.anims[name].frames[atlas.index(name, t, loop)],

    // Draw `name` at time t with its feet at (x, y). opts: flip, loop, i (explicit frame),
    // recolor (an ordered list of JR.RECOLORS keys), crew (a nation), white (hit flash), alpha,
    // scale (the Pirate Bomb officer is drawn at half size).
    draw(ctx, name, t, x, y, opts = {}) {
      if (!atlas.ready || !A.anims[name]) return;
      const i = opts.i != null ? Math.min(opts.i, atlas.frames(name) - 1) : atlas.index(name, t, opts.loop !== false);
      const f = A.anims[name].frames[i];
      const src = (opts.recolor && opts.recolor.length) || opts.white || JR.CREWS[opts.crew] ? variant(name, i, f, opts.recolor || [], !!opts.white, opts.crew) : null;
      const S = JR.px ? JR.px.S : 1, snap = v => Math.round(v * S) / S;
      ctx.save();
      if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
      ctx.translate(snap(x), snap(y));
      if (opts.flip) ctx.scale(-1, 1);
      if (opts.scale) ctx.scale(opts.scale, opts.scale);
      if (src) ctx.drawImage(src, f.dx, f.dy);
      else ctx.drawImage(img, f.x, f.y, f.w, f.h, f.dx, f.dy, f.w, f.h);
      ctx.restore();
    },
  });

  // A recolored (and/or white-flashed) copy of one frame, made once.
  function variant(name, i, f, keys, white, crew) {
    const key = `${name}:${i}:${keys.join(',')}:${white}:${crew}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    const g = c.getContext('2d');
    g.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    let im;
    try { im = g.getImageData(0, 0, f.w, f.h); }
    catch { cache.set(key, c); return c; }   // a file:// page can't read pixels: plain frame, no recolor
    let data = im.data;
    for (const k of keys) {
      const r = JR.RECOLORS[k];
      if (!r) continue;
      data = JR.remapPixels(data, r.map, regionOf(r.part, f));
    }
    if (JR.CREWS[crew]) data = JR.crewPixels(data, crew);
    if (white) for (let p = 0; p < data.length; p += 4) if (data[p + 3]) { data[p] = data[p + 1] = data[p + 2] = 255; }
    im.data.set(data);
    g.putImageData(im, 0, 0);
    cache.set(key, c);
    return c;
  }

  // Rectangle of a captain part inside the trimmed frame, from the brim/chin/belt markers.
  function regionOf(part, f) {
    if (!part || !f.parts) return null;
    const top = v => v - f.dy;                        // anchor-relative -> frame row
    const b = f.parts, W = f.w, H = f.h;
    const rows = {
      hat: [0, top(b.brim) + 1],
      face: [top(b.brim) + 1, top(b.chin) + 1],
      coat: [top(b.chin) + 1, top(b.belt) + 1],
      body: [top(b.brim) + 1, top(b.belt) + 1],
      pants: [top(b.belt) + 1, H],
    }[part];
    return rows ? { x: 0, y: rows[0], w: W, h: Math.max(0, rows[1] - rows[0]), width: W } : null;
  }

  // The captain's palette (measured from his frames) and the outfits made from it.
  const CAP = { hatMain: '#7b7bab', hatShade: '#68538a', stripe: '#d06c63', shirt: '#de9970', skin: '#eebc9d', skinShade: '#cd897c' };
  const two = (part, a, b, main, shade) => ({ part, map: { [a]: main, [b]: shade } });
  JR.RECOLORS = {
    'hat.purple': two('hat', CAP.hatMain, CAP.hatShade, CAP.hatMain, CAP.hatShade),
    'hat.black': two('hat', CAP.hatMain, CAP.hatShade, '#4a4a5e', '#2e2e3e'),
    'hat.red': two('hat', CAP.hatMain, CAP.hatShade, '#b8463e', '#7e2c2c'),
    'hat.navy': two('hat', CAP.hatMain, CAP.hatShade, '#4a6ab0', '#30467a'),
    'pants.purple': two('pants', CAP.hatMain, CAP.hatShade, CAP.hatMain, CAP.hatShade),
    'pants.brown': two('pants', CAP.hatMain, CAP.hatShade, '#8a5a3a', '#5e3a24'),
    'pants.tan': two('pants', CAP.hatMain, CAP.hatShade, '#c8a878', '#9a7c50'),
    'pants.black': two('pants', CAP.hatMain, CAP.hatShade, '#4a4a5e', '#2e2e3e'),
    'coat.red': two('coat', CAP.stripe, CAP.shirt, CAP.stripe, CAP.shirt),
    'coat.blue': two('coat', CAP.stripe, CAP.shirt, '#4a72c8', '#7aa0e8'),
    'coat.green': two('coat', CAP.stripe, CAP.shirt, '#3e9a5a', '#78c88a'),
    'coat.purple': two('coat', CAP.stripe, CAP.shirt, '#8a52b0', '#b888d8'),
    'coat.black': two('coat', CAP.stripe, CAP.shirt, '#3a3a4c', '#5c5c74'),
    'coat.gold': two('coat', CAP.stripe, CAP.shirt, '#c88a20', '#f0c048'),
    'skin.light': two('body', CAP.skin, CAP.skinShade, CAP.skin, CAP.skinShade),
    'skin.tan': two('body', CAP.skin, CAP.skinShade, '#d8a070', '#b07850'),
    'skin.brown': two('body', CAP.skin, CAP.skinShade, '#a86c44', '#7e4c2c'),
    'skin.dark': two('body', CAP.skin, CAP.skinShade, '#70462a', '#4e2e1a'),
  };
  JR.CAPTAIN_PALETTE = CAP;
})();
