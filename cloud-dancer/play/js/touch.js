// Phone controls: drag anywhere on the left of the screen to steer (relative: the ship goes where
// it was when the thumb landed, plus how far the thumb has moved, so the thumb never hides it),
// and a FULL STEAM button on the right. The cannons fire on their own.
(() => {
  const CD = window.CD;

  // Pure: anchor = ship centre at touch start (game units); start/now = finger (CSS px);
  // k = game units per CSS px.
  CD.dragTarget = (anchor, start, now, k) => ({
    x: CD.clamp(anchor.x + (now.x - start.x) * k, 0, CD.VIEW_W),
    y: CD.clamp(anchor.y + (now.y - start.y) * k, 0, CD.VIEW_H),
  });

  // ---------- DOM (browser only) ----------

  CD.initTouch = (input, { canvas, ship, onPause, onMute }) => {
    const $ = id => document.getElementById(id);
    const root = document.documentElement;
    if ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window) root.classList.add('touch');
    const zone = $('steer'), btn = $('btn-steam');
    let id = null, start = null, anchor = null;
    const k = () => CD.VIEW_W / canvas.getBoundingClientRect().width;
    const release = () => { id = null; input.target = null; };
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return;
      id = e.pointerId; zone.setPointerCapture(id);
      const s = ship();
      start = { x: e.clientX, y: e.clientY }; anchor = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      input.target = { ...anchor };
      e.preventDefault();
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === id) input.target = CD.dragTarget(anchor, start, { x: e.clientX, y: e.clientY }, k()); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, e => { if (e.pointerId === id) release(); });
    btn.addEventListener('pointerdown', e => { input.dashPressed = true; btn.classList.add('down'); e.preventDefault(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => btn.classList.remove('down'));
    $('btn-pause').addEventListener('click', e => { e.stopPropagation(); onPause(); });
    $('btn-mute').addEventListener('click', e => { e.stopPropagation(); onMute(); });
    return { release };
  };
})();
