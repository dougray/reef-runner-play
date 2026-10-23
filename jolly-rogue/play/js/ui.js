// Wood and Paper UI (Treasure Hunters): panels, buttons, banners, hearts and the boss bar, drawn
// from the atlas. Every call is a no-op until the atlas is in.
(() => {
  const JR = window.JR;
  const A = JR.atlas;

  // The opaque box of a 32 px panel piece, measured once (the pack's corner pieces sit inside a
  // 32x32 cell with clear margins).
  const boxes = new Map();
  function opaque(name, i) {
    const key = name + i;
    if (boxes.has(key)) return boxes.get(key);
    const f = A.frameAt(name, i), c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    const g = c.getContext('2d');
    g.drawImage(A.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    let d;
    try { d = g.getImageData(0, 0, f.w, f.h).data; }
    catch { d = new Uint8ClampedArray(f.w * f.h * 4).fill(255); }   // file://: treat the piece as solid
    let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (d[(y * f.w + x) * 4 + 3]) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const b = { x0, y0, x1, y1 };
    boxes.set(key, b);
    return b;
  }

  // Draw piece i of `name`, source rectangle (sx, sy, w, h) inside it, at (x, y). Stretched to whole
  // device pixels so no seams show at in-between (phone) scales.
  const piece = (ctx, name, i, sx, sy, w, h, x, y) => {
    if (w <= 0 || h <= 0) return;
    const f = A.frameAt(name, i), snap = JR.px.snap, x0 = snap(Math.round(x)), y0 = snap(Math.round(y));
    ctx.drawImage(A.image, f.x + sx, f.y + sy, w, h, x0, y0, snap(Math.round(x) + w) - x0, snap(Math.round(y) + h) - y0);
  };

  // A 3x3-piece panel (frames 0-8: top row, middle row, bottom row) whose visible edge is exactly
  // the rectangle (x, y, w, h). Edges and middle repeat their piece.
  function nine(ctx, name, x, y, w, h) {
    const tl = opaque(name, 0), br = opaque(name, 8), S = A.frameAt(name, 0).w;
    const L = S - tl.x0, T = S - tl.y0, R = br.x1 + 1, B = br.y1 + 1;
    const cols = [[tl.x0, L, x, 0]], rows = [[tl.y0, T, y, 0]];
    for (let cx = x + L; cx < x + w - R; cx += S) cols.push([0, Math.min(S, x + w - R - cx), cx, 1]);
    cols.push([0, R, x + w - R, 2]);
    for (let cy = y + T; cy < y + h - B; cy += S) rows.push([0, Math.min(S, y + h - B - cy), cy, 1]);
    rows.push([0, B, y + h - B, 2]);
    for (const [sy, hh, dy, r] of rows) for (const [sx, ww, dx, c] of cols) piece(ctx, name, r * 3 + c, sx, sy, ww, hh, dx, dy);
  }

  const ui = (JR.ui = {
    // kind: 'paper' (light parchment) or 'board' (wood frame around planks)
    panel(ctx, kind, x, y, w, h) { if (A.ready) nine(ctx, kind === 'board' ? 'ui.board' : 'ui.paper', x, y, w, h); },

    // A one-row button: the pack's yellow (or green) button strip, 14 px tall, centered on b.
    button(ctx, b, label, green) {
      if (!A.ready) return;
      const name = green ? 'ui.gButton' : 'ui.yButton', S = 14, y = Math.round(b.y + b.h / 2 - 7);
      piece(ctx, name, 1, 0, 0, S, S, b.x, y);
      for (let x = b.x + S; x < b.x + b.w - S; x += S) piece(ctx, name, 2, 0, 0, Math.min(S, b.x + b.w - S - x), S, x, y);
      piece(ctx, name, 3, 0, 0, S, S, b.x + b.w - S, y);
      JR.px.text(ctx, label, b.x + b.w / 2, y + 6, { align: 'center', color: '#3e2731', outline: false });
    },

    // The small paper banner across (cx - w/2 .. cx + w/2), top at y: notched ends, plain middle.
    banner(ctx, cx, y, w) {
      if (!A.ready) return;
      const l = opaque('ui.banner', 8), r = opaque('ui.banner', 9), m = opaque('ui.banner', 12);
      const lw = l.x1 - l.x0 + 1, rw = r.x1 - r.x0 + 1, h = m.y1 - m.y0 + 1, x = Math.round(cx - w / 2);
      piece(ctx, 'ui.banner', 8, l.x0, m.y0, lw, h, x, y);
      for (let px = x + lw; px < x + w - rw; px += 32) piece(ctx, 'ui.banner', 12, 0, m.y0, Math.min(32, x + w - rw - px), h, px, y);
      piece(ctx, 'ui.banner', 9, r.x0, m.y0, rw, h, x + w - rw, y);
      return h;
    },

    // A small heart (our drawing in the pack's palette; js/packart.js).
    heart(ctx, x, y, full) { ctx.drawImage(JR.packart.heart(full), Math.round(x), Math.round(y)); },

    // The boss's life: the pack's big bar (skull cap, plank middle, round end) with a red fill.
    bar(ctx, x, y, w, k) {
      if (!A.ready) return;
      const N = 'ui.bigBars', cap = opaque(N, 1), mid = opaque(N, 2), end = opaque(N, 3);
      const cw = cap.x1 - cap.x0 + 1, ew = end.x1 - end.x0 + 1, h = mid.y1 - mid.y0 + 1;
      const x0 = x + cw, x1 = x + w - ew, my = y + mid.y0 - cap.y0, B = ui.BAR;
      for (let px = x0; px < x1; px += 32) piece(ctx, N, 2, 0, mid.y0, Math.min(32, x1 - px), h, px, my);
      piece(ctx, N, 3, end.x0, mid.y0, ew, h, x1, my);
      piece(ctx, N, 1, cap.x0, cap.y0, cw, cap.y1 - cap.y0 + 1, x, y);
      // the red fill goes over the empty (dark red) channel of the planks
      const red = A.frameAt('ui.barColors', 0), fill = Math.round((x1 - x0 + B.over + B.under) * Math.max(0, Math.min(1, k)));
      if (fill > 0) ctx.drawImage(A.image, red.x, red.y, 1, red.h, x0 - B.over, my + B.top, fill, B.h);
    },
    BAR: { top: 3, h: 2, over: 17, under: 4 },   // the fill channel: rows 3-4 of the planks, from the skull's edge
  });
})();
