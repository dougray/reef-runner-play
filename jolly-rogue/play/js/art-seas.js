// The King's navy and the far shores (levels 9-20): each level's own backdrop layer and weather,
// its own terrain treatment (masts, yards, wet sand, gunwales, roots...), and the pixel art for the
// new foes and hazards (crabs, gulls, loose sails, the tide, chain shot, coconuts, stalactites).
// Everything is drawn in code over tinted paintings and pack tiles: no new assets. Only the canvas
// calls the Apple TV / Switch runtime.js supports (fillRect, drawImage, globalAlpha).
(() => {
  const JR = window.JR;
  const AA = JR.areaArt;
  const W = () => JR.VIEW_W, H = () => JR.VIEW_H;
  const mod = (a, n) => ((a % n) + n) % n;
  const wrap = (x, span, pad = 0) => mod(x, span) - pad;
  const rect = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const alpha = (ctx, a, fn) => { const was = ctx.globalAlpha; ctx.globalAlpha = was * a; fn(); ctx.globalAlpha = was; };
  const hash = n => { let x = (n | 0) * 374761393; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

  // ---------- skies painted in code: horizontal bands from the top colour to the bottom ----------
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, k) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
  function codeSky(ctx, stops) {
    const cols = stops.map(hex), bands = 18, h = Math.ceil(H() / bands);
    for (let i = 0; i < bands; i++) {
      const k = i / (bands - 1) * (cols.length - 1), j = Math.min(cols.length - 2, Math.floor(k));
      rect(ctx, mix(cols[j], cols[j + 1], k - j), 0, i * h, W(), h + 1);
    }
  }

  // A sail in silhouette or colour: a bellied square of canvas with seams. (x, y) top-left.
  function sail(ctx, x, y, w, h, cloth, seam, belly = 0) {
    for (let k = 0; k < h; k += 2) {
      const bulge = Math.round(Math.sin((k / h) * Math.PI) * belly);
      rect(ctx, cloth, x - bulge, y + k, w + bulge * 2, 2);
    }
    for (let s = 1; s < 3; s++) rect(ctx, seam, x + Math.round((w * s) / 3), y + 1, 1, h - 2);
    rect(ctx, seam, x - 1, y, w + 2, 1);
  }

  // ---------- parallax layers ----------
  Object.assign(AA.LAYERS, {
    // The Rigging: high up a man-o'-war. The sea far below, other masts and their sails drifting
    // past near and far, gulls, clouds.
    masts(ctx, camX, t) {
      for (let i = 0; i < 6; i++) {                                                  // clouds
        const x = wrap(i * 97 - camX * 0.04 - t * 3, W() + 120, 60), y = 14 + (i * 31) % 70;
        alpha(ctx, 0.85, () => { rect(ctx, '#f4f8fc', x, y, 50, 8); rect(ctx, '#f4f8fc', x + 8, y - 5, 30, 6); rect(ctx, '#dce8f4', x, y + 7, 50, 3); });
      }
      rect(ctx, '#2c6ca4', 0, 176, W(), 40); rect(ctx, '#3c88c0', 0, 176, W(), 2);   // the sea, far below
      for (let i = 0; i < 20; i++) rect(ctx, '#7cb8e0', wrap(i * 41 - camX * 0.08, W() + 20, 10), 182 + (i * 7) % 28, 6, 1);
      // Other masts, hazy with distance (pale and bluish, so they never read as yards to stand on).
      alpha(ctx, 0.55, () => {
        for (let x = wrap(-camX * 0.15 + 40, 260, 120); x < W() + 120; x += 260) {   // a far mast
          rect(ctx, '#7c8ca0', x, 30, 4, 186);
          for (let j = 0; j < 3; j++) sail(ctx, x - 30 + j * 3, 40 + j * 46, 64 - j * 6, 36, '#dce6f0', '#b4c4d4', 3);
        }
      });
      alpha(ctx, 0.8, () => {
        for (let x = wrap(-camX * 0.45, 420, 160); x < W() + 160; x += 420) {      // a nearer one, its sails billowing
          const b = Math.round(3 + Math.sin(t * 1.4 + x * 0.01) * 2);
          rect(ctx, '#6c7c90', x + 72, 0, 4, H());
          sail(ctx, x + 22, 20, 104, 52, '#e4ecf4', '#bccad8', b);
          sail(ctx, x + 28, 88, 92, 46, '#e4ecf4', '#bccad8', b);
          for (let k = 0; k < 9; k++) rect(ctx, '#7c8ca0', x + 140 + k * 3, 30 + k * 18, 1, 20);   // a stay
        }
      });
    },
    // Sandbar Shore: hot noon over the bay, a surf line rolling in, dunes and beach grass.
    surf(ctx, camX, t) {
      const sx = W() - 70, sy = 30;                                                    // the noon sun and its glare
      alpha(ctx, 0.12, () => { for (let r = 22; r > 10; r -= 4) rect(ctx, '#fff8d8', sx - r, sy - r * 0.7, r * 2, r * 1.4); });
      for (const [w, h] of [[10, 16], [14, 12], [16, 8]]) rect(ctx, '#fffcec', sx - w / 2, sy - h / 2, w, h);
      for (let x = wrap(-camX * 0.3, 32, 32); x < W(); x += 32) {                   // dunes
        const n = Math.floor((x + camX * 0.3) / 32), h = 10 + Math.floor(hash(n) * 14);
        rect(ctx, '#e8c890', x, 170 - h, 32, 60); rect(ctx, '#f4dca8', x + 2, 170 - h, 28, 2);
        if (hash(n * 3) > 0.5) for (let k = 0; k < 4; k++) rect(ctx, '#6c8c3c', x + 8 + k * 4, 164 - h - (k % 2) * 3, 1, 6);
      }
      for (let i = 0; i < 3; i++) {                                                   // surf rolling in
        const y = 184 + i * 10, ph = Math.sin(t * 1.2 + i * 1.7) * 6;
        rect(ctx, i % 2 ? '#3ca0c8' : '#48b4d8', 0, y + ph, W(), 10);
        for (let x = wrap(-camX * (0.5 + i * 0.1) + i * 30, 40, 40); x < W(); x += 40) rect(ctx, '#f4fcfc', x, y + ph, 18, 2);
      }
    },
    // The Convoy: the King's ships alongside, grey with powder smoke, gun ports flashing.
    hulls(ctx, camX, t) {
      // A ship of the line in silhouette: tapered hull, the ochre stripe, three masts, sails.
      const ship = (x, y, k, hull, sails, flash) => {
        const L = Math.round(150 * k), h = Math.round(20 * k);
        for (let i = 0; i < h; i += 2) { const inset = Math.round((i / h) * 14 * k); rect(ctx, hull, x + inset, y + i, L - inset * 2, 2); }
        rect(ctx, hull, x + L - Math.round(26 * k), y - Math.round(8 * k), Math.round(26 * k), Math.round(8 * k));   // the stern castle
        rect(ctx, '#b89850', x + 2, y + Math.round(5 * k), L - 4, Math.max(1, Math.round(2 * k)));
        for (let g = 0; g < 9; g++) rect(ctx, flash && g % 2 ? '#fcc838' : '#14141c', x + Math.round((10 + g * 14) * k), y + Math.round(9 * k), Math.max(2, Math.round(4 * k)), Math.max(2, Math.round(3 * k)));
        for (let m = 0; m < 3; m++) {
          const mx = x + Math.round((32 + m * 42) * k), mh = Math.round((m === 1 ? 92 : 78) * k);
          rect(ctx, hull, mx, y - mh, Math.max(1, Math.round(2 * k)), mh);
          for (let j = 0; j < 3; j++) sail(ctx, mx - Math.round((16 - j * 2) * k), y - mh + Math.round((6 + j * 25) * k), Math.round((34 - j * 4) * k), Math.round(20 * k), sails, hull, 1);
        }
      };
      alpha(ctx, 0.6, () => { for (let x = wrap(-camX * 0.08, 340, 200); x < W() + 200; x += 340) ship(x, 128, 0.7, '#383c54', '#a8acbc', mod(t + x * 0.01, 4.4) < 0.15); });
      alpha(ctx, 0.5, () => { for (let x = wrap(-camX * 0.25 + 120, 560, 280); x < W() + 280; x += 560) ship(x, 176, 1.2, '#30344a', '#8c90a4', mod(t * 0.9 + x * 0.003, 3.7) < 0.12); });
    },
    // Vine Gorge: cliff walls either side, a waterfall, the river far below, hanging vines.
    gorge(ctx, camX, t) {
      for (let x = wrap(-camX * 0.1, 360, 200); x < W() + 200; x += 360) {          // the far wall and its waterfall
        rect(ctx, '#18403a', x, 30, 120, 190); rect(ctx, '#1f5046', x + 6, 30, 108, 4);
        for (let k = 0; k < 10; k++) rect(ctx, k % 2 ? '#c8f0f4' : '#88d0e0', x + 46 + k * 3, 30, 3, 160);
        alpha(ctx, 0.5, () => { const f = mod(t * 60, 20); for (let k = 0; k < 8; k++) rect(ctx, '#f4fcfc', x + 46 + (k * 7) % 30, 40 + f + k * 20, 2, 6); });
        alpha(ctx, 0.4, () => rect(ctx, '#e8fcfc', x + 30, 184, 64, 10));         // spray at its foot
      }
      rect(ctx, '#1c6c70', 0, 196, W(), 20);                                          // the river
      for (let i = 0; i < 14; i++) rect(ctx, '#4ca8a8', wrap(i * 33 - camX * 0.3 - t * 20, W() + 20, 10), 200 + (i * 5) % 14, 8, 1);
      for (let x = wrap(-camX * 0.3, 180, 90); x < W() + 90; x += 180) {           // nearer cliff faces
        alpha(ctx, 0.7, () => { rect(ctx, '#0a2620', x, 70, 40, 150); rect(ctx, '#123a28', x - 4, 64, 48, 8); });
      }
      for (let x = wrap(-camX * 0.7, 70, 35); x < W() + 35; x += 70) {               // hanging vines and canopy
        const n = Math.floor((x + camX * 0.7) / 70), len = 30 + Math.floor(hash(n) * 60), sway = Math.round(Math.sin(t + n) * 2);
        for (let y = 0; y < len; y += 3) rect(ctx, y % 9 ? '#1d5a2c' : '#3c9a44', x + (y > len / 2 ? sway : 0), y, 2, 3);
        rect(ctx, '#123c1c', x - 20, 0, 50, 8);
      }
    },
    // Gull Cliffs: white chalk cliffs along the coast, a lighthouse, gulls wheeling.
    chalk(ctx, camX, t) {
      for (let x = wrap(-camX * 0.08 + 200, 600, 120); x < W() + 120; x += 600) {    // the lighthouse on its headland
        alpha(ctx, 0.5, () => { for (let k = 0; k < 8; k++) rect(ctx, '#8c9c8c', x - 4 - k * 6, 100 + k * 6, 38 + k * 12, 8); });   // its headland
        for (let k = 0; k < 6; k++) rect(ctx, k % 2 ? '#c83838' : '#f4f4ec', x + 8, 60 + k * 8, 14, 8);
        rect(ctx, '#3c3c48', x + 6, 52, 18, 8); rect(ctx, Math.floor(t * 1.5) % 2 ? '#fcf0a0' : '#c8a848', x + 10, 54, 10, 5);
      }
      alpha(ctx, 0.5, () => {                                                         // the chalk cliffs along the coast, ragged-topped
        for (let x = wrap(-camX * 0.3, 10, 10); x < W(); x += 10) {
          const n = Math.floor((x + camX * 0.3) / 10), top = 96 + Math.round(Math.sin(n * 0.21) * 22 + hash(n) * 8);
          rect(ctx, '#e4e0d0', x, top, 10, 220); rect(ctx, '#6c8c4c', x, top - 2, 10, 3);
          if (n % 7 === 0) rect(ctx, '#b4b4a8', x + 4, top + 8, 2, 120);
        }
      });
      for (let i = 0; i < 5; i++) {                                                   // gulls wheeling far off
        const x = wrap(i * 90 + Math.sin(t * 0.6 + i) * 30 - camX * 0.1, W() + 20, 10), y = 30 + (i * 23) % 50 + Math.sin(t * 1.3 + i) * 6;
        const up = Math.floor(t * 4 + i) % 2;
        rect(ctx, '#f4f4f4', x - 3, y + (up ? -1 : 0), 3, 1); rect(ctx, '#f4f4f4', x + 1, y + (up ? -1 : 0), 3, 1); rect(ctx, '#f4f4f4', x, y, 1, 1);
      }
    },
    // Smugglers' Caves: a black cavern, stalactites hanging, lanterns glowing, the sea glimpsed through a mouth.
    cavern(ctx, camX, t) {
      for (let x = wrap(-camX * 0.15 + 100, 480, 120); x < W() + 120; x += 480) {   // the cave mouth, moonlit sea
        // A ragged opening, wider at the bottom, the night sea and the moon beyond.
        for (let k = 0; k < 14; k++) { const w = 30 + Math.round(Math.sin((k / 13) * Math.PI * 0.9) * 50) + (k % 3) * 4; rect(ctx, k > 8 ? '#2c4c70' : '#1c3450', x + 50 - w / 2, 78 + k * 5, w, 5); }
        for (let k = 0; k < 5; k++) rect(ctx, '#7ca4c8', x + 26 + k * 12, 128 + (k % 2) * 5, 6, 1);
        rect(ctx, '#e8f0fc', x + 60, 90, 4, 4);
      }
      for (let x = wrap(-camX * 0.35, 36, 36); x < W(); x += 36) {                    // stalactites
        const n = Math.floor((x + camX * 0.35) / 36), len = 12 + Math.floor(hash(n) * 40);
        for (let k = 0; k < len; k += 4) rect(ctx, '#0c1420', x + Math.floor(k / 6), k, 14 - Math.floor(k / 3), 4);
      }
      for (let x = wrap(-camX * 0.5 + 60, 220, 60); x < W() + 60; x += 220) {        // lanterns with a flicker
        const f = 0.5 + 0.2 * Math.sin(t * 9 + x);
        alpha(ctx, f * 0.18, () => { for (const [w, h] of [[30, 14], [22, 24], [14, 32]]) rect(ctx, '#fcb848', x + 3 - w / 2, 100 - h / 2, w, h); });
        rect(ctx, '#3c2c1c', x, 96, 6, 2); rect(ctx, '#fce49c', x + 1, 98, 4, 6); rect(ctx, '#3c2c1c', x, 104, 6, 2);
      }
    },
    // The King's Dockyard: cranes against a smoky dusk, a hull on the slip with its ribs showing, warehouses.
    cranes(ctx, camX, t) {
      alpha(ctx, 0.5, () => {
        for (let x = wrap(-camX * 0.1, 260, 80); x < W() + 120; x += 260) {         // warehouses, hazy, with lit windows
          rect(ctx, '#5c4840', x, 120, 120, 100); rect(ctx, '#5c4840', x + 10, 108, 100, 12);
          for (let k = 0; k < 5; k++) rect(ctx, k % 3 ? '#fcb860' : '#3c3028', x + 12 + k * 22, 140, 8, 10);
        }
      });
      for (let x = wrap(-camX * 0.25 + 150, 420, 200); x < W() + 200; x += 420) {   // a hull on the slip: ribs and keel
        rect(ctx, '#4c3424', x, 176, 180, 6);
        for (let k = 0; k < 12; k++) { const h = 30 + Math.round(Math.sin((k / 11) * Math.PI) * 26); rect(ctx, '#5c4430', x + 6 + k * 15, 176 - h, 4, h); }
      }
      for (let x = wrap(-camX * 0.45 + 60, 360, 120); x < W() + 120; x += 360) {    // a crane, its hook swinging
        rect(ctx, '#3c3028', x, 40, 8, 180); rect(ctx, '#3c3028', x - 10, 40, 90, 6);
        for (let k = 0; k < 8; k++) rect(ctx, '#3c3028', x + 8 + k * 9, 46 + (k % 2) * 3, 2, 6);
        const sw = Math.sin(t * 0.9 + x) * 8;
        for (let k = 0; k < 20; k++) rect(ctx, '#7c6c5c', x + 70 + (sw * k) / 20, 46 + k * 3, 1, 3);
        rect(ctx, '#5c5c68', x + 66 + sw, 106, 8, 6);
      }
    },
    // Harbor Fort by night: bastions and gun towers against the stars, braziers burning, the moon.
    ramparts(ctx, camX, t) {
      rect(ctx, '#f0ecd8', W() - 80, 22, 14, 14); rect(ctx, '#f0ecd8', W() - 82, 25, 18, 8);
      alpha(ctx, 0.55, () => { for (let x = wrap(-camX * 0.12, 300, 100); x < W() + 100; x += 300) {   // the far fort on the headland, hazy
        rect(ctx, '#34405c', x, 104, 200, 116); rect(ctx, '#34405c', x + 40, 80, 50, 24); rect(ctx, '#34405c', x + 140, 86, 40, 18);
        for (let k = 0; k < 10; k++) rect(ctx, '#34405c', x + k * 20, 98, 12, 6);
        for (let k = 0; k < 3; k++) rect(ctx, Math.floor(t * 2 + k) % 3 ? '#c87c28' : '#fcc838', x + 50 + k * 50, 120, 4, 4);
        rect(ctx, '#2c3c64', x + 64, 50, 2, 30); rect(ctx, '#a83838', x + 66, 50, 12, 7);   // a plain red pennant
      } });
      for (let x = wrap(-camX * 0.4 + 80, 240, 80); x < W() + 80; x += 240) {        // braziers on the near wall
        const f = Math.floor(t * 10 + x) % 3;
        rect(ctx, '#3c3c48', x + 8, 140, 12, 10); rect(ctx, '#fc7c18', x + 9, 133 - f, 10, 8); rect(ctx, '#fcc838', x + 11, 130 - f, 6, 6);
        alpha(ctx, 0.15, () => rect(ctx, '#fc9c38', x - 10, 118, 48, 40));
      }
    },
    // Storm Rigging: black clouds racing, mountainous waves below, tattered sails on other masts.
    squall(ctx, camX, t) {
      for (let i = 0; i < 7; i++) {                                                  // low clouds, racing
        const x = wrap(i * 83 - camX * 0.1 - t * 40, W() + 160, 80), y = 6 + (i * 19) % 50;
        alpha(ctx, 0.7, () => { rect(ctx, '#0c1416', x, y, 90, 12); rect(ctx, '#0c1416', x + 14, y - 6, 56, 8); });
      }
      for (let x = wrap(-camX * 0.2 + 30, 300, 150); x < W() + 150; x += 300) {     // a far mast, its sails in rags
        alpha(ctx, 0.5, () => {
          rect(ctx, '#3c4c4c', x, 30, 4, 186);
          for (let j = 0; j < 3; j++) for (let k = 0; k < 7; k++) rect(ctx, '#8c9c94', x - 26 + k * 8, 44 + j * 44, 6, 18 + ((k * 7 + j) % 4) * 4 + Math.round(Math.sin(t * 6 + k) * 2));
        });
      }
      for (let i = 0; i < 2; i++) {                                                   // the heaving sea far below
        const base = 186 + i * 14;
        for (let x = wrap(-camX * (0.3 + i * 0.15), 8, 8); x < W(); x += 8) {
          const n = Math.floor((x + camX * (0.3 + i * 0.15)) / 8), h = Math.round(10 + Math.sin(n * 0.35 + t * 1.6 + i) * 9);
          rect(ctx, i ? '#1c3c40' : '#2c5054', x, base - h, 8, 40 + h); rect(ctx, '#c8e0dc', x, base - h, 8, 1);
        }
      }
    },
    // The Treasure Galleon: the strongroom: heaps of coin, chests, chandeliers swinging.
    hoard(ctx, camX, t) {
      for (let x = wrap(-camX * 0.3, 160, 80); x < W() + 80; x += 160) {            // heaps of gold
        alpha(ctx, 0.75, () => {
          for (let k = 0; k < 6; k++) rect(ctx, k % 2 ? '#c89820' : '#a87810', x - k * 6, 196 - k * 5, 40 + k * 12, 5);
          rect(ctx, '#5c3418', x + 50, 176, 26, 18); rect(ctx, '#c89820', x + 50, 182, 26, 2); rect(ctx, '#fce07c', x + 61, 184, 4, 4);
        });
        if (Math.floor(t * 3 + x) % 5 === 0) rect(ctx, '#fffcd8', x + 10, 186, 2, 2);
      }
      for (let x = wrap(-camX * 0.45 + 40, 230, 80); x < W() + 80; x += 230) {      // chandeliers
        const sw = Math.round(Math.sin(t * 1.2 + x) * 3);
        rect(ctx, '#5c4420', x + sw / 2, 0, 1, 40); rect(ctx, '#a87810', x - 14 + sw, 40, 30, 3);
        for (let k = 0; k < 4; k++) { rect(ctx, '#f4e8c8', x - 12 + k * 8 + sw, 34, 2, 6); rect(ctx, '#fcd848', x - 12 + k * 8 + sw, 31 - (Math.floor(t * 8 + k) % 2), 2, 3); }
        alpha(ctx, 0.12, () => rect(ctx, '#fcd848', x - 30 + sw, 24, 62, 34));
      }
    },
    // The Blockade: the picket line of warships at night, lanterns lit, their boats out, the moon on the water.
    pickets(ctx, camX, t) {
      alpha(ctx, 0.4, () => {                                                         // the picket line, far off on the horizon
        for (let x = wrap(-camX * 0.1, 220, 120); x < W() + 120; x += 220) {
          rect(ctx, '#0c1430', x, 104, 120, 8); rect(ctx, '#0c1430', x + 100, 98, 20, 6);
          for (let m = 0; m < 3; m++) rect(ctx, '#0c1430', x + 24 + m * 34, 50, 2, 54);
          for (let k = 0; k < 6; k++) rect(ctx, (k + Math.floor(t)) % 4 ? '#fcc848' : '#7c5c28', x + 10 + k * 18, 107, 2, 2);
        }
      });
      for (let x = wrap(-camX * 0.25 + 90, 400, 200); x < W() + 200; x += 400) {   // a lantern's beam sweeping the water
        const a = Math.sin(t * 0.5 + x * 0.01);
        alpha(ctx, 0.08, () => { for (let k = 0; k < 10; k++) rect(ctx, '#fce4a8', x + a * k * 10, 140 + k * 7, 14 + k * 5, 7); });
      }
      for (let i = 0; i < 16; i++) rect(ctx, '#3c5c9c', wrap(i * 29 - camX * 0.3, W() + 10, 5), 160 + (i * 13) % 50, 8, 1);
    },
    // The King's Flagship: a burning sunset, the fleet ablaze on the horizon, the stern lanterns and the King's banner.
    royal(ctx, camX, t) {
      for (let x = wrap(-camX * 0.06, 260, 130); x < W() + 130; x += 260) {        // the fleet ablaze
        const f = Math.floor(t * 8 + x) % 3;
        alpha(ctx, 0.55, () => { rect(ctx, '#2c0c10', x, 124, 50, 5); rect(ctx, '#2c0c10', x + 14, 98, 2, 26); rect(ctx, '#2c0c10', x + 32, 102, 2, 22); });
        rect(ctx, '#fc7c18', x + 8, 116 - f, 10, 8); rect(ctx, '#fcc838', x + 11, 113 - f, 4, 5);
        alpha(ctx, 0.3, () => { for (let k = 0; k < 5; k++) rect(ctx, '#3c2424', x + 6 + k * 4 + Math.sin(t + k) * 3, 120 - k * 14 - (t * 10) % 14, 16, 10); });
      }
      for (let x = wrap(-camX * 0.35 + 50, 420, 160); x < W() + 160; x += 420) {   // stern lanterns and the King's banner
        for (let k = 0; k < 3; k++) {
          rect(ctx, '#3c2c10', x + k * 40, 50, 14, 22); rect(ctx, '#d8a030', x + k * 40, 48, 14, 3);
          rect(ctx, Math.floor(t * 6 + k) % 4 ? '#fcd868' : '#fcb838', x + 3 + k * 40, 54, 8, 14);
          alpha(ctx, 0.15, () => rect(ctx, '#fcc848', x - 8 + k * 40, 40, 30, 40));
        }
        rect(ctx, '#3c2c10', x + 150, 10, 3, 120);
        const wave = k => Math.round(Math.sin(t * 4 - k * 0.6) * 2);
        for (let k = 0; k < 10; k++) rect(ctx, '#a81c24', x + 153 + k * 4, 14 + wave(k), 4, 26);        // a plain crimson banner
        const cy = 22 + wave(4);                                                       // a gold crown on it
        rect(ctx, '#fcc838', x + 165, cy + 6, 14, 4);
        for (const dx of [0, 6, 12]) rect(ctx, '#fcc838', x + 165 + dx, cy, 2, 6);
        rect(ctx, '#fcc838', x + 168, cy + 3, 2, 3); rect(ctx, '#fcc838', x + 174, cy + 3, 2, 3);
        rect(ctx, '#a81c24', x + 171, cy + 7, 2, 2);
      }
    },
  });

  // ---------- weather ----------
  Object.assign(AA.WEATHER, {
    // Gusts (JR.gust): streaks gather on the right (the tell), then race left across everything.
    wind(ctx, camX, t, calm) {
      const g = JR.gust(t);
      const n = g.tell ? 10 : Math.round(-g.push * 34);
      alpha(ctx, g.tell ? 0.35 : 0.55, () => {
        for (let i = 0; i < n; i++) {
          const sp = g.tell ? 40 : 520, x = g.tell ? W() - 30 - mod(i * 13 + t * sp, 60) : mod(i * 71 - t * sp, W() + 60) - 30;
          rect(ctx, '#ffffff', x, 20 + (i * 29) % (H() - 40), g.tell ? 10 : 22, 1);
        }
      });
      if (g.tell && Math.floor(t * 6) % 2) AA.arrowLeft(ctx, W() - 14, 30);
    },
    sun(ctx, camX, t) {                                                               // heat shimmer, sea birds' shadows
      alpha(ctx, 0.08, () => rect(ctx, '#fff0b0', 0, 0, W(), H()));
      for (let i = 0; i < 3; i++) alpha(ctx, 0.15, () => rect(ctx, '#203040', wrap(i * 150 - t * 30 - camX * 0.9, W() + 40, 20), 150 + i * 14, 8, 2));
    },
    smoke(ctx, camX, t) {                                                             // powder smoke drifting across
      for (let i = 0; i < 8; i++) {
        const x = wrap(i * 83 - camX * 0.8 - t * (14 + i * 2), W() + 160, 80), y = 40 + (i * 37) % 130, w = 70 + (i % 3) * 20;
        alpha(ctx, 0.13, () => { rect(ctx, '#d8d8e0', x, y, w, 10); rect(ctx, '#d8d8e0', x + 10, y - 6, w - 20, 6); rect(ctx, '#d8d8e0', x + 6, y + 10, w - 12, 4); });
      }
    },
    mist(ctx, camX, t) {                                                              // spray rising off the river, drops
      for (let i = 0; i < 30; i++) {
        const x = mod(i * 37.3 - camX * 0.6, W() + 10) - 5, y = mod(i * 61.7 - t * (10 + (i % 4) * 4), H() + 10) - 5;
        alpha(ctx, 0.5, () => rect(ctx, '#d8fcf8', x, y, 1, 2));
      }
      alpha(ctx, 0.1, () => rect(ctx, '#bcecec', 0, H() - 40, W(), 40));
    },
  });

  Object.assign(AA.WEATHER, {
    breeze(ctx, camX, t, calm) {                                                      // spray and gusts off the sea
      AA.WEATHER.wind(ctx, camX, t, calm);
      for (let i = 0; i < 14; i++) alpha(ctx, 0.4, () => rect(ctx, '#e8f4fc', mod(i * 67 - t * 140 - camX * 0.5, W() + 20) - 10, mod(i * 41, H()), 3, 1));
    },
    drips(ctx, camX, t) {                                                             // dark at the edges, water dripping
      for (let k = 0; k < 4; k++) alpha(ctx, 0.18, () => { rect(ctx, '#000008', 0, 0, W(), 18 + k * 10); rect(ctx, '#000008', 0, 0, 30 + k * 16, H()); rect(ctx, '#000008', W() - 30 - k * 16, 0, 30 + k * 16, H()); });
      for (let i = 0; i < 12; i++) {
        const x = mod(i * 97.3 - camX, W()), y = mod(i * 31 + t * 160, H());
        alpha(ctx, 0.6, () => rect(ctx, '#9cc8e8', x, y, 1, 3));
      }
    },
    haze(ctx, camX, t) {                                                              // forge smoke and sawdust in the dusk light
      alpha(ctx, 0.12, () => rect(ctx, '#c88c58', 0, 0, W(), H()));
      for (let i = 0; i < 20; i++) alpha(ctx, 0.5, () => rect(ctx, '#e8c898', mod(i * 53 - camX * 0.7 + Math.sin(t + i) * 10, W()), mod(i * 37 - t * 8, H()), 1, 1));
    },
    storm(ctx, camX, t, calm) {                                                       // driving rain, gusts, lightning
      alpha(ctx, 0.5, () => {
        for (let i = 0; i < 90; i++) {
          const x = mod(i * 41.7 - t * 260 - camX * 0.6, W() + 40) - 20, y = mod(i * 83.1 + t * 380, H() + 20) - 10;
          rect(ctx, '#a8c4cc', x, y, 1, 4); rect(ctx, '#a8c4cc', x - 1, y + 4, 1, 3); rect(ctx, '#a8c4cc', x - 2, y + 7, 1, 2);
        }
      });
      AA.WEATHER.wind(ctx, camX, t, calm);
      const flash = JR.lightning(t);
      if (flash) alpha(ctx, flash * (calm ? 0.12 : 0.45), () => rect(ctx, '#f0fcfc', 0, 0, W(), H()));
    },
    glitter(ctx, camX, t) {                                                           // gold dust in the lamplight
      for (let i = 0; i < 30; i++) if ((i + Math.floor(t * 5)) % 3) rect(ctx, i % 2 ? '#fce07c' : '#fffcd8', mod(i * 47 - camX * 0.6 + Math.sin(t + i) * 6, W()), mod(i * 29 + t * 6, H()), 1, 1);
      alpha(ctx, 0.08, () => rect(ctx, '#fcc848', 0, 0, W(), H()));
    },
    flares(ctx, camX, t) {                                                            // signal flares rising, hanging, falling
      for (let i = 0; i < 3; i++) {
        const P = 6, ph = mod(t + i * 2.1, P), x = mod(i * 140 - camX * 0.2, W() + 40) - 20;
        const y = ph < 1 ? 200 - ph * 170 : 30 + (ph - 1) * 22;
        if (ph < 1) rect(ctx, '#fcc848', x, y, 1, 4);
        else {
          rect(ctx, i % 2 ? '#fc4848' : '#7cfc7c', x - 1, y - 1, 3, 3);
          alpha(ctx, 0.12 * (1 - (ph - 1) / (P - 1)), () => rect(ctx, i % 2 ? '#fc6868' : '#9cfc9c', 0, 0, W(), H()));
        }
      }
    },
    ash(ctx, camX, t) {                                                               // ash and cinders on the wind, the sunset's glow
      for (let i = 0; i < 40; i++) {
        const x = mod(i * 43.3 - t * (30 + (i % 5) * 8) - camX * 0.7, W() + 10) - 5, y = mod(i * 67.1 + t * (12 + (i % 3) * 6), H() + 10) - 5;
        rect(ctx, i % 4 ? '#7c6c6c' : '#fc7c18', x, y, i % 3 ? 1 : 2, 1);
      }
      alpha(ctx, 0.1, () => rect(ctx, '#fc5c28', 0, H() - 50, W(), 50));
    },
    night(ctx, camX, t) {                                                             // stars twinkling, a cool night tint
      for (let i = 0; i < 40; i++) if ((i + Math.floor(t * 2)) % 7) rect(ctx, '#e8ecfc', mod(i * 71 - camX * 0.02, W()), (i * 29) % 90, 1, 1);
      alpha(ctx, 0.12, () => rect(ctx, '#0c1440', 0, 0, W(), H()));
    },
  });

  // A small "<<" for wind and tide tells.
  AA.arrowLeft = (ctx, x, y) => { for (let k = 0; k < 4; k++) { rect(ctx, '#fcfcfc', x - k, y - k, 1, 1); rect(ctx, '#fcfcfc', x - k, y + k, 1, 1); rect(ctx, '#fcfcfc', x - k + 5, y - k, 1, 1); rect(ctx, '#fcfcfc', x - k + 5, y + k, 1, 1); } };

  // ---------- terrain treatments (js/art-world.js calls these per tile) ----------
  const open = (lv, c, r) => !lv.solid(c, r);
  const FILL = {
    // A mast: dark oak with vertical grain, iron bands, a cap on top.
    mast(ctx, lv, c, r, x, y) {
      const l = open(lv, c - 1, r), rt = open(lv, c + 1, r);
      rect(ctx, '#5c3c20', x, y, 16, 16);
      rect(ctx, '#74502c', x + 3, y, 3, 16); rect(ctx, '#4a2e18', x + 10, y, 2, 16);
      if (l) rect(ctx, '#2c1c10', x, y, 2, 16);
      if (rt) rect(ctx, '#2c1c10', x + 14, y, 2, 16);
      if ((r + c) % 3 === 0) { rect(ctx, '#3c3c44', x, y + 6, 16, 2); rect(ctx, '#6c6c78', x, y + 6, 16, 1); }
      if (open(lv, c, r - 1)) { rect(ctx, '#8c6438', x, y, 16, 3); rect(ctx, '#2c1c10', x, y + 3, 16, 1); }
    },
  };
  // Sand all the way down: pale and dry near the top, darker and damp below, shell grit.
  FILL.sand = (ctx, lv, c, r, x, y) => {
    let d = 0; while (d < 4 && lv.solid(c, r - d - 1)) d++;
    rect(ctx, ['#e0c088', '#d0ac74', '#bc9864', '#a88454', '#947448'][d], x, y, 16, 16);
    for (let k = 0; k < 3; k++) rect(ctx, '#f0dcac', x + ((c * 7 + r * 3 + k * 5) % 14), y + ((c * 3 + k * 7 + r) % 14), 2, 1);
    if (open(lv, c - 1, r) || open(lv, c + 1, r)) rect(ctx, '#8c6c40', open(lv, c - 1, r) ? x : x + 14, y, 2, 16);
  };
  // A navy hull: painted planks, dark below the waterline, iron bolts.
  FILL.hull = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#3c4058', x, y, 16, 16);
    for (let k = 0; k < 16; k += 4) rect(ctx, '#2c3044', x, y + k + 3, 16, 1);
    rect(ctx, (c * 7 + r) % 5 ? '#4c506c' : '#545874', x + ((r * 5) % 3) * 4, y + 1, 6, 2);
    if (r >= 15) rect(ctx, '#1c2030', x, y, 16, 16);
    if (open(lv, c - 1, r)) rect(ctx, '#1c2030', x, y, 2, 16);
    if (open(lv, c + 1, r)) rect(ctx, '#1c2030', x + 14, y, 2, 16);
    if ((c + r) % 4 === 0) rect(ctx, '#8c8ca0', x + 8, y + 8, 1, 1);
  };
  // Chalk: white with grey flint bands; darker toward its edges.
  FILL.chalk = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#e8e4d4', x, y, 16, 16);
    if (r % 3 === 0) for (let k = 0; k < 16; k += 5) rect(ctx, '#5c5c64', x + k + (c % 2) * 2, y + 6, 3, 2);
    rect(ctx, '#d4d0bc', x + ((c * 5 + r) % 12), y + 11, 4, 1);
    if (open(lv, c - 1, r)) rect(ctx, '#b8b4a0', x, y, 3, 16);
    if (open(lv, c + 1, r)) rect(ctx, '#b8b4a0', x + 13, y, 3, 16);
  };
  // Cave rock: black-blue, lumpy, wet glints.
  FILL.cave = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#141c28', x, y, 16, 16);
    rect(ctx, '#1c2838', x + ((c * 3 + r * 5) % 8), y + ((c + r * 3) % 8), 8, 6);
    if ((c + r) % 3 === 0) rect(ctx, '#3c5068', x + 3, y + 2, 2, 1);
    if (open(lv, c, r + 1)) rect(ctx, '#0c121c', x, y + 13, 16, 3);
  };
  // Fort masonry: grey ashlar blocks, lichen.
  FILL.ashlar = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#6c6c74', x, y, 16, 16);
    const off = r % 2 ? 0 : 8;
    rect(ctx, '#4c4c54', x, y + 15, 16, 1); rect(ctx, '#4c4c54', x + off, y, 1, 16);
    rect(ctx, '#84848c', x + 1, y, 14, 1);
    if ((c * 7 + r) % 6 === 0) rect(ctx, '#7c8c5c', x + 9, y + 4, 3, 2);
  };
  // A storm-soaked mast: the mast's oak gone dark, water streaming down it.
  FILL.wetmast = (ctx, lv, c, r, x, y, t) => {
    FILL.mast(ctx, lv, c, r, x, y);
    alpha(ctx, 0.45, () => rect(ctx, '#0c1c24', x, y, 16, 16));
    rect(ctx, '#a8c8d0', x + 5 + (c % 2) * 4, y + mod(Math.floor(t * 40) + r * 5, 16), 1, 4);
  };
  // The gold deck: dark polished planks with gold inlay.
  FILL.gilded = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#3c2010', x, y, 16, 16);
    for (let k = 0; k < 16; k += 4) rect(ctx, '#4c2c14', x, y + k, 16, 3);
    if ((c + r) % 3 === 0) rect(ctx, '#c89820', x + 6, y + 6, 4, 4);
  };
  // A rowboat's clinker-built side: overlapping strakes, tar, a pale sheer strake on top.
  FILL.boat = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#2c2418', x, y, 16, 16);
    for (let k = 0; k < 16; k += 4) { rect(ctx, '#4c3c28', x, y + k, 16, 3); rect(ctx, '#1c1810', x, y + k + 3, 16, 1); }
    if (open(lv, c, r - 1)) { rect(ctx, '#bcb4a0', x, y, 16, 2); rect(ctx, '#7c6c50', x, y + 2, 16, 1); }
    if (open(lv, c - 1, r) || open(lv, c + 1, r)) rect(ctx, '#140c08', open(lv, c - 1, r) ? x : x + 13, y, 3, 16);
  };
  // The flagship's deck: holystoned white oak over crimson-painted bulwarks.
  FILL.royaldeck = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#7c1c20', x, y, 16, 16);
    for (let k = 0; k < 16; k += 4) rect(ctx, '#5c1418', x, y + k + 3, 16, 1);
    if ((c * 3 + r) % 7 === 0) rect(ctx, '#d8a030', x + 7, y + 7, 2, 2);
  };
  // A stone quay: dressed blocks, a timber fender along the top.
  FILL.quay = (ctx, lv, c, r, x, y) => {
    rect(ctx, '#5c5850', x, y, 16, 16);
    const off = r % 2 ? 0 : 8;
    rect(ctx, '#3c3a36', x, y + 7, 16, 1); rect(ctx, '#3c3a36', x + off, y, 1, 7); rect(ctx, '#3c3a36', x + ((off + 8) % 16), y + 8, 1, 8);
    rect(ctx, '#6c6860', x + 2, y + 1, 4, 1);
    if (open(lv, c, r - 1)) { rect(ctx, '#4a3424', x, y, 16, 4); rect(ctx, '#6c4c30', x, y, 16, 1); }
  };
  const TOP = {
    wetsand(ctx, x, y, c, t) {                                                        // damp sand over the grass, a foam fringe, shells
      rect(ctx, '#e8cc90', x, y, 16, 8); rect(ctx, '#d4b478', x, y + 6, 16, 2); rect(ctx, '#f4f0e0', x, y, 16, 1);
      if (mod(c * 3, 4) === 1) rect(ctx, '#c8a468', x + 4, y + 3, 3, 1);
      if (mod(c * 7, 5) === 0) { rect(ctx, '#f4c8c8', x + 5, y - 2, 3, 2); rect(ctx, '#c88c8c', x + 5, y - 1, 3, 1); }
    },
    gunwale(ctx, x, y, c) {                                                           // the navy's ochre stripe and a rail
      rect(ctx, '#d8a848', x, y + 2, 16, 3); rect(ctx, '#2c2c38', x, y, 16, 2);
      if (mod(c, 3) === 0) { rect(ctx, '#2c2c38', x + 7, y - 6, 2, 6); rect(ctx, '#4c4c58', x + 4, y - 7, 8, 1); }
    },
    turf(ctx, x, y, c) {                                                              // cliff-top turf with sea pinks
      rect(ctx, '#5c8c3c', x, y, 16, 3); rect(ctx, '#7cac4c', x, y, 16, 1);
      for (let k = 1; k < 16; k += 5) rect(ctx, '#5c8c3c', x + k, y - 2, 1, 2);
      if (mod(c * 7, 4) === 0) rect(ctx, '#f48cb4', x + 9, y - 1, 2, 1);
    },
    wet(ctx, x, y, c, t) {                                                            // slick black rock, a glint, glowing moss
      rect(ctx, '#0c1824', x, y, 16, 2); rect(ctx, '#7ca8c8', x + mod(c * 5, 12), y, 3, 1);
      if (mod(c, 5) === 2) alpha(ctx, 0.6 + 0.3 * Math.sin(t * 2 + c), () => rect(ctx, '#5cfcb8', x + 3, y - 1, 4, 1));
    },
    bollards(ctx, x, y, c) {                                                          // iron bollards along the wharf
      if (mod(c, 6) === 2) { rect(ctx, '#1c1c24', x + 4, y - 7, 8, 7); rect(ctx, '#3c3c48', x + 3, y - 8, 10, 2); rect(ctx, '#5c5c68', x + 5, y - 6, 2, 4); }
    },
    gilt(ctx, x, y, c) {                                                              // gold trim and coins spilt on the deck
      rect(ctx, '#c89820', x, y, 16, 2); rect(ctx, '#fce07c', x, y, 16, 1);
      if (mod(c * 5, 4) === 0) rect(ctx, '#fcd848', x + 5, y - 1, 3, 1);
    },
    royal(ctx, x, y, c) {                                                             // white planking edged in gold
      rect(ctx, '#e8dcc0', x, y, 16, 4); rect(ctx, '#d8a030', x, y + 4, 16, 1);
      for (let k = 3; k < 16; k += 6) rect(ctx, '#c8bca0', x + k, y + 1, 1, 3);
    },
    battlement(ctx, x, y, c) {                                                        // crenellations and a lamp-lit edge
      rect(ctx, '#8c887c', x, y, 16, 2);
      if (mod(c, 2) === 0) { rect(ctx, '#6c685c', x + 2, y - 6, 12, 6); rect(ctx, '#8c887c', x + 2, y - 6, 12, 1); }
    },
    roots(ctx, x, y, c) {                                                             // moss on top, roots trailing
      rect(ctx, '#3c8a44', x, y, 16, 3); rect(ctx, '#5cac54', x + 2, y, 4, 1); rect(ctx, '#5cac54', x + 10, y, 3, 1);
      if (mod(c * 5, 3) === 0) rect(ctx, '#2c6c34', x + 6, y - 2, 4, 2);
    },
  };
  const SIDE = {
    roots(ctx, x, y, c, r) { if (mod(c + r, 2) === 0) for (let k = 0; k < 8; k += 2) rect(ctx, '#4a3420', x + (k % 4 ? 13 : 2), y + k, 1, 2); },
  };
  const PLAT = {
    // A yard: a round spar with rope lashings and footropes; its ends taper.
    yard(ctx, x, y, c, t, l, rt) {
      rect(ctx, '#2c1c10', x, y + 1, 16, 7); rect(ctx, '#8c6438', x, y + 2, 16, 4); rect(ctx, '#a87c48', x, y + 2, 16, 1);
      if (!l) rect(ctx, '#2c1c10', x, y + 1, 2, 7);
      if (!rt) rect(ctx, '#2c1c10', x + 14, y + 1, 2, 7);
      if (mod(c, 2) === 0) { rect(ctx, '#d8c08c', x + 6, y + 1, 2, 7); rect(ctx, '#d8c08c', x + 9, y + 1, 1, 7); }
      for (let k = 0; k < 16; k += 4) rect(ctx, '#c8a878', x + k, y + 11 + (k === 4 || k === 8 ? 1 : 0), 4, 1);   // the footrope
    },
    driftwood(ctx, x, y, c, t, l, rt) {
      rect(ctx, '#5c4c3c', x, y + 1, 16, 6); rect(ctx, '#a89478', x, y + 2, 16, 2); rect(ctx, '#c8b89c', x + (c % 3) * 4, y + 2, 5, 1);
      if (!l || !rt) rect(ctx, '#3c3024', l ? x + 13 : x, y + 1, 3, 6);
    },
    gangplank(ctx, x, y, c, t, l, rt) {
      rect(ctx, '#3c2c1c', x, y, 16, 5); rect(ctx, '#9c7448', x, y + 1, 16, 3);
      for (let k = 2; k < 16; k += 5) rect(ctx, '#5c4430', x + k, y + 1, 1, 3);
      if (!l || !rt) rect(ctx, '#c8c8d0', l ? x + 12 : x + 2, y - 2, 2, 2);
    },
    log(ctx, x, y, c, t, l, rt) {
      rect(ctx, '#2c1c10', x, y, 16, 8); rect(ctx, '#6c4c2c', x, y + 1, 16, 6); rect(ctx, '#8c6438', x, y + 2, 16, 1);
      rect(ctx, '#3c8a44', x + (c % 4) * 3, y, 4, 2);
      if (!l || !rt) { const ex = l ? x + 12 : x; rect(ctx, '#c8a070', ex, y + 1, 4, 6); rect(ctx, '#8c6438', ex + 1, y + 3, 2, 2); }
    },
  };
  Object.assign(PLAT, {
    ledge(ctx, x, y, c, t, l, rt) {                                                   // a chalk shelf, crumbling at the ends
      rect(ctx, '#bcb8a4', x, y, 16, 6); rect(ctx, '#f0ece0', x, y, 16, 2); rect(ctx, '#5c8c3c', x, y, 16, 1);
      if (!l) rect(ctx, '#bcb8a4', x + 2, y + 6, 10, 2);
      if (!rt) rect(ctx, '#bcb8a4', x + 4, y + 6, 10, 2);
    },
    boards(ctx, x, y, c, t, l, rt) {                                                  // rickety smugglers' boards on a rope
      rect(ctx, '#3c2c1c', x, y, 16, 4); rect(ctx, mod(c, 2) ? '#7c5c38' : '#6c4c2c', x + 1, y + 1, 14, 2);
      rect(ctx, '#a8804c', x, y - 1, 16, 1);
      if (!l || !rt) rect(ctx, '#a8804c', l ? x + 14 : x + 1, y - 10, 1, 10);
    },
    beam(ctx, x, y, c, t, l, rt) {                                                    // a squared timber with iron straps
      rect(ctx, '#2c1c10', x, y, 16, 7); rect(ctx, '#a8784c', x, y + 1, 16, 4);
      if (mod(c, 3) === 0) rect(ctx, '#3c3c48', x + 6, y, 3, 7);
    },
    torn(ctx, x, y, c, t, l, rt) {                                                    // a soaked yard, torn canvas flogging under it
      PLAT.yard(ctx, x, y, c, t, l, rt);
      alpha(ctx, 0.85, () => rect(ctx, '#9cb0a8', x + 3, y + 8, 4 + (c % 3) * 2, 4 + Math.round(Math.abs(Math.sin(t * 8 + c)) * 6)));
    },
    giltshelf(ctx, x, y, c, t, l, rt) {                                               // a carved shelf, gold-edged, coins on it
      rect(ctx, '#3c2010', x, y, 16, 6); rect(ctx, '#c89820', x, y, 16, 2); rect(ctx, '#fce07c', x, y, 16, 1);
      if (!l || !rt) rect(ctx, '#c89820', l ? x + 13 : x, y + 2, 3, 6);
    },
    oars(ctx, x, y, c, t, l, rt) {                                                    // oars lashed across as a bridge
      rect(ctx, '#3c2c1c', x, y + 1, 16, 4); rect(ctx, '#bc9c6c', x, y + 2, 16, 1);
      if (!l || !rt) { rect(ctx, '#bc9c6c', l ? x + 10 : x, y, 6, 6); rect(ctx, '#7c6444', l ? x + 10 : x, y + 3, 6, 1); }
    },
    giltyard(ctx, x, y, c, t, l, rt) {                                                // a gilded yard on the King's ship
      PLAT.yard(ctx, x, y, c, t, l, rt);
      rect(ctx, '#d8a030', x, y + 2, 16, 1); if (mod(c, 2) === 0) rect(ctx, '#a81c24', x + 6, y + 1, 3, 7);
    },
    scaffold(ctx, x, y, c, t, l, rt) {                                                // planks on poles, lashed
      rect(ctx, '#8c6c44', x, y, 16, 3); rect(ctx, '#5c4430', x, y + 3, 16, 1);
      if (mod(c, 3) === 0) { rect(ctx, '#5c4430', x + 7, y + 4, 2, 12); rect(ctx, '#c8a878', x + 6, y + 4, 4, 1); }
    },
  });
  AA.terrain = {
    solid(ctx, lv, c, r, x, y, t, style) {
      if (style.fill && FILL[style.fill]) FILL[style.fill](ctx, lv, c, r, x, y, t);
      if (style.top && SIDE[style.top]) SIDE[style.top](ctx, x, y, c, r);
      if (style.top && TOP[style.top] && open(lv, c, r - 1)) TOP[style.top](ctx, x, y, c, t);
    },
    plat(ctx, lv, c, r, x, y, t, style) {
      (PLAT[style.plat] || PLAT.yard)(ctx, x, y, c, t, lv.platform(c - 1, r), lv.platform(c + 1, r));
    },
    FILL, TOP, PLAT, SIDE,
  };
  AA.codeSky = codeSky;

  // ---------- the new cast's pixel art ----------
  const crewOf = nation => JR.LEVELS.find(l => l.crew === nation) || {};
  // A crab: shell, eyes on stalks, claws up during its tell. (x, y) = feet centre.
  AA.drawCrab = (ctx, e, x, y, t, dead) => {
    const k = Math.floor(t * 10 + e.x) % 2, up = e.tell ? 3 : 0, X = Math.round(x), Y = Math.round(y);
    const shell = e.flash > 0 ? '#fcfcfc' : '#d84c28', dark = '#8c2410';
    if (dead) { rect(ctx, dark, X - 7, Y - 4, 14, 4); rect(ctx, shell, X - 6, Y - 4, 12, 2); return; }
    for (let i = 0; i < 3; i++) { rect(ctx, dark, X - 8 + (k ? 0 : 1), Y - 3 + i, 2, 1); rect(ctx, dark, X + 6 - (k ? 0 : 1), Y - 3 + i, 2, 1); }
    rect(ctx, dark, X - 6, Y - 7, 12, 5); rect(ctx, shell, X - 5, Y - 8, 10, 5); rect(ctx, '#fc8c58', X - 3, Y - 8, 4, 1);
    rect(ctx, dark, X - 3, Y - 11, 1, 3); rect(ctx, dark, X + 2, Y - 11, 1, 3);
    rect(ctx, '#fcfcfc', X - 4, Y - 12, 2, 2); rect(ctx, '#fcfcfc', X + 2, Y - 12, 2, 2);
    rect(ctx, shell, X - 10, Y - 9 - up, 4, 3); rect(ctx, shell, X + 6, Y - 9 - up, 4, 3);
    rect(ctx, dark, X - 10, Y - 8 - up, 1, 1); rect(ctx, dark, X + 9, Y - 8 - up, 1, 1);
  };
  // A gull: white body, grey wings that flap, a yellow beak.
  const drawGull = (ctx, e, x, y, t) => {
    const up = Math.floor(t * 8 + e.x) % 2, X = Math.round(x), Y = Math.round(y) - 5, f = e.facing < 0 ? -1 : 1;
    const body = e.flash > 0 ? '#fcd8d8' : '#f4f4f4';
    rect(ctx, '#7c7c8c', X - 7, Y + (up ? -3 : 1), 6, 2); rect(ctx, '#7c7c8c', X + 1, Y + (up ? -3 : 1), 6, 2);
    rect(ctx, body, X - 4, Y, 8, 4); rect(ctx, body, X + f * 3 - 1, Y - 2, 3, 3);
    rect(ctx, '#fcc838', X + f * 5 - (f < 0 ? 1 : 0), Y - 1, 2, 1); rect(ctx, '#1c1c1c', X + f * 3, Y - 2, 1, 1);
  };
  const baseEnemy = AA.drawEnemy;
  AA.drawEnemy = (ctx, e, x, y, t) => {
    if (e.type === 'l') { AA.drawCrab(ctx, e, x, y, t); return true; }
    if (e.type === 'v' && crewOf(e.nation).flyer === 'gull') { drawGull(ctx, e, x, y, t); return true; }
    return baseEnemy(ctx, e, x, y, t);
  };
  // A redcoat's aim (a dotted line to where he'll fire) and his reload (ramrod puffs).
  AA.drawRedcoat = (ctx, e, x, y, t) => {
    if (e.tell && e.aim) {
      const gx = x + e.facing * 10, gy = y - e.h + 8, dx = e.aim.x - gx, dy = e.aim.y - gy, len = Math.hypot(dx, dy) || 1;
      alpha(ctx, Math.floor(t * 12) % 2 ? 0.8 : 0.45, () => {
        for (let d = 6; d < Math.min(len, 220); d += 6) rect(ctx, '#fc3838', gx + (dx / len) * d, gy + (dy / len) * d, 2, 1);
      });
    }
    if (e.reloading) { rect(ctx, '#c8c8d0', x + e.facing * 4, y - e.h - 6 - (Math.floor(t * 6) % 3), 1, 7); }
  };
  // A boarder's rope, from its anchor to his hands while he swings in.
  AA.drawSwingRope = (ctx, e, x, y) => {
    const hx = x, hy = y - e.h + 4, n = 24;
    for (let i = 0; i <= n; i++) rect(ctx, i % 2 ? '#a8804c' : '#6c4c2c', e.ax + ((hx - e.ax) * i) / n, e.ay + ((hy - e.ay) * i) / n, 2, 2);
  };

  // A loose sail: patched canvas with a torn edge, billowing; it ripples and brightens before it blows.
  function drawLooseSail(ctx, x, y, w, h, t, tell) {
    const b = Math.round(2 + Math.sin(t * 5) * 2 + (tell ? Math.sin(t * 40) * 2 : 0));
    alpha(ctx, 0.95, () => sail(ctx, x + 2, y, w - 4, h - 3, tell && Math.floor(t * 12) % 2 ? '#fcfcf0' : '#ece0c4', '#c0ac84', b));
    for (let k = 0; k < w - 4; k += 4) rect(ctx, '#ece0c4', x + 2 + k, y + h - 3, 3, 1 + (k % 8 ? 2 : 0));   // torn hem
    rect(ctx, '#a8804c', x + 2, y - 1, w - 4, 1);
    rect(ctx, '#d84c28', x + w / 2 - 4, y + 6, 8, 2);                               // a patch
  }
  const baseHazard = AA.drawHazard;
  AA.drawHazard = (ctx, h, t) => {
    if (h.type === 'a') {
      drawLooseSail(ctx, h.x, h.y, h.w, h.h, t + h.hx * 0.01, h.tell);
      if (h.tell && Math.floor(t * 8) % 2) for (let k = 0; k < 3; k++) rect(ctx, '#ffffff', h.x + (h.dir || -1) * 0 - 10 - k * 6, h.y + 4 + k * 6, 6, 1);
      return;
    }
    if (h.type === 't') {                                                             // foam gathering: the tide's tell
      if (h.foam != null && Math.floor(t * 8) % 2) { rect(ctx, '#f4fcfc', h.foam, 15 * JR.TILE - 6, 24, 3); AA.arrowLeft(ctx, h.foam - 4, 15 * JR.TILE - 14); }
      return;
    }
    if (h.type === 'x') {                                                             // a stalactite or loose rock, shivering before it drops
      if (h.y < 0) return;
      const X = Math.round(h.x + (h.tell ? Math.sin(t * 60) : 0)), Y = Math.round(h.y);
      if (crewOf(h.nation).faller === 'rock') { drawRock(ctx, X + 4, Y + 7); return; }
      for (let k = 0; k < 7; k++) rect(ctx, k % 2 ? '#5c6c7c' : '#7c8c9c', X + Math.floor(k / 2), Y + k * 2, 8 - Math.floor(k / 2) * 2, 2);
      rect(ctx, '#bcdcfc', X + 3, Y + 13, 1, 1);
      return;
    }
    baseHazard(ctx, h, t);
  };

  function drawRock(ctx, x, y) {
    rect(ctx, '#3c3a34', x - 6, y - 5, 12, 11); rect(ctx, '#3c3a34', x - 7, y - 3, 14, 7);
    rect(ctx, '#d8d4c4', x - 5, y - 4, 10, 8); rect(ctx, '#f0ece0', x - 4, y - 4, 4, 2); rect(ctx, '#a8a490', x + 1, y + 1, 4, 2);
  }
  const baseShot = AA.drawShot;
  AA.drawShot = (ctx, s, x, y, t) => {
    if (s.sail) { const w = s.low ? 22 : 26, hh = s.low ? 12 : 22; drawLooseSail(ctx, x - w / 2, y - hh / 2, w, hh, t, false); return true; }
    if (s.tide) {                                                                     // a breaking wave
      const k = Math.floor(t * 10) % 2;
      rect(ctx, '#2c84b4', x - 9, y - 4, 20, 12); rect(ctx, '#48b4d8', x - 7, y - 7, 16, 6);
      rect(ctx, '#f4fcfc', x - 8, y - 8 + k, 12, 2); rect(ctx, '#f4fcfc', x - 10, y - 6, 3, 3); rect(ctx, '#d8f4fc', x + 4, y + 2, 6, 1);
      return true;
    }
    if (s.chain) {                                                                    // two balls on a spinning chain
      const a = t * 18, dx = Math.round(Math.cos(a) * 5), dy = Math.round(Math.sin(a) * 5);
      for (let k = -2; k <= 2; k++) rect(ctx, '#8c8c98', x + (dx * k) / 2, y + (dy * k) / 2, 1, 1);
      for (const sg of [-1, 1]) { rect(ctx, '#1c1c24', x + sg * dx - 2, y + sg * dy - 2, 5, 5); rect(ctx, '#5c5c6c', x + sg * dx - 1, y + sg * dy - 1, 2, 2); }
      return true;
    }
    if (s.faller === 'rock') { drawRock(ctx, x, y); return true; }
    if (s.faller === 'stalactite') { for (let k = 0; k < 6; k++) rect(ctx, k % 2 ? '#5c6c7c' : '#7c8c9c', x - 4 + Math.floor(k / 2), y - 8 + k * 2, 8 - Math.floor(k / 2) * 2, 2); return true; }
    if (s.faller === 'crate') { rect(ctx, '#3c2818', x - 7, y - 7, 14, 14); rect(ctx, '#a8784c', x - 6, y - 6, 12, 12); rect(ctx, '#3c2818', x - 6, y - 1, 12, 2); rect(ctx, '#3c2818', x - 1, y - 6, 2, 12); return true; }
    if (s.coinshot) { rect(ctx, '#7c4808', x - 2, y - 2, 5, 5); rect(ctx, '#fcd848', x - 1, y - 2, 3, 4); rect(ctx, '#fffcd8', x - 1, y - 1, 1, 1); return true; }
    if (s.coconut) { rect(ctx, '#3c2414', x - 3, y - 3, 7, 7); rect(ctx, '#6c4424', x - 2, y - 2, 4, 3); rect(ctx, '#1c1008', x, y, 1, 1); return true; }
    if (s.grape) { rect(ctx, '#1c1c24', x - 1.5, y - 1.5, 3, 3); rect(ctx, '#6c6c78', x - 1, y - 1, 1, 1); return true; }
    return baseShot(ctx, s, x, y, t);
  };
})();
