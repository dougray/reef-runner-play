// Phone controls. An 8-way D-pad bottom-left (slide the thumb around it); JUMP and FIRE are round
// buttons on the right. They write into the same input object the keyboard uses.
(() => {
  const JR = window.JR;
  const DEAD = 12;                       // CSS px from the D-pad's centre before a direction counts
  const SECTOR = Math.PI / 8;            // 8 directions, 45° each

  // Drag (dx, dy) from the stick's center → left/right/up/down, like arrow keys.
  JR.stickToInput = (dx, dy, input) => {
    input.left = input.right = input.up = input.down = false;
    if (Math.hypot(dx, dy) < DEAD) return input;
    const a = Math.atan2(dy, dx);        // 0 = right, +π/2 = down
    const s = Math.round(a / (2 * SECTOR));   // -4..4, in 45° steps
    const dirs = { 0: 'r', 1: 'rd', 2: 'd', 3: 'ld', 4: 'l', '-4': 'l', '-3': 'lu', '-2': 'u', '-1': 'ru' }[s];
    input.right = dirs.includes('r'); input.left = dirs.includes('l');
    input.up = dirs.includes('u'); input.down = dirs.includes('d');
    return input;
  };

  // Where to draw the knob: follows the thumb but stays inside a ring of radius r.
  JR.stickKnob = (dx, dy, r) => {
    const d = Math.hypot(dx, dy);
    return d <= r ? { x: dx, y: dy } : { x: (dx / d) * r, y: (dy / d) * r };
  };

  // ---------- DOM pad (browser only) ----------

  JR.initTouch = (input, { onPause, onMute }) => {
    const $ = id => document.getElementById(id);
    const root = document.documentElement;
    const pad = $('dpad'), arrows = { up: pad.querySelector('.u'), right: pad.querySelector('.r'), down: pad.querySelector('.d'), left: pad.querySelector('.l') };
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    // A TV's web view claims a coarse pointer and touch events but has no touch points.
    const touchable = navigator.maxTouchPoints === undefined || navigator.maxTouchPoints > 0;
    if (touchable && (coarse || 'ontouchstart' in window)) root.classList.add('touch');
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && !root.classList.contains('touch')) { root.classList.add('touch'); window.dispatchEvent(new Event('resize')); }
    }, true);

    // The D-pad: direction from its centre, so a thumb can roll from one arrow to the next.
    let sid = null;
    const show = () => { for (const k in arrows) arrows[k].classList.toggle('on', !!input[k]); };
    const aim = e => {
      const r = pad.getBoundingClientRect();
      JR.stickToInput(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), input);
      show();
    };
    const release = () => { sid = null; JR.stickToInput(0, 0, input); show(); };
    pad.addEventListener('pointerdown', e => {
      if (sid !== null) return;
      sid = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      aim(e);
      e.preventDefault();
    });
    pad.addEventListener('pointermove', e => { if (e.pointerId === sid) aim(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, e => { if (e.pointerId === sid) release(); });

    const buttons = [];
    const hold = (el, key, pressed) => {
      const ids = new Set();
      const up = e => { ids.delete(e.pointerId); if (!ids.size) { input[key] = false; el.classList.remove('down'); } };
      buttons.push(() => { ids.clear(); input[key] = false; el.classList.remove('down'); });
      el.addEventListener('pointerdown', e => {
        // Every new touch is a fresh press, even if an earlier finger-lift never arrived (iOS can
        // drop one); otherwise a quick second tap - a double jump - would be lost.
        if (!ids.has(e.pointerId)) input[pressed] = true;
        ids.add(e.pointerId); el.setPointerCapture(e.pointerId);
        input[key] = true; el.classList.add('down');
        e.preventDefault();
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
    };
    hold($('btn-jump'), 'jump', 'jumpPressed');
    hold($('btn-fire'), 'fire', 'firePressed');

    $('btn-pause').addEventListener('click', e => { e.stopPropagation(); onPause(); });
    $('btn-mute').addEventListener('click', e => { e.stopPropagation(); onMute(); });
    // Let go of everything: the stick and both buttons (after a rotation, touches may never end).
    const releaseAll = () => { if (sid !== null) release(); buttons.forEach(b => b()); };
    return { release, releaseAll };
  };
})();
