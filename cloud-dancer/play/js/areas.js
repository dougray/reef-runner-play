// The sky's areas (endless, in a loop), cloud banks you can hide in, and Storm Wall lightning.
// Pure logic.
(() => {
  const CD = window.CD;

  CD.AREA_LEN = 3600;        // distance units per area: one minute of flying
  CD.AREAS = [
    { id: 'reef', name: 'THE REEF SKIES', mix: { gyro: 5, mine: 2, flak: 2, zeppelin: 1 }, clouds: 0.25, lightning: false },
    { id: 'storm', name: 'THE STORM WALL', mix: { gyro: 3, pike: 3, lurker: 2, mine: 2, zeppelin: 1 }, clouds: 0.6, lightning: true },
    { id: 'forts', name: 'THE SKY-FORTS', mix: { zeppelin: 3, gyro: 3, mine: 2, flak: 2 }, clouds: 0.3, lightning: false },
    { id: 'ceiling', name: 'THE CEILING OF THE WORLD', mix: { zeppelin: 2, pike: 2, lurker: 2, gyro: 2, mine: 2 }, clouds: 0.4, lightning: false },
  ];

  CD.areaAt = distance => {
    const n = Math.floor(Math.max(0, distance) / CD.AREA_LEN);
    return { ...CD.AREAS[n % CD.AREAS.length], index: n % CD.AREAS.length, loop: Math.floor(n / CD.AREAS.length) };
  };

  // Seconds between waves: 3.2 at the start, down to 1.4 far out.
  CD.spawnInterval = distance => Math.max(1.4, 3.2 - distance / 4000);

  const CLOUD_TOP = 70, CLOUD_BOTTOM = 160, SCROLL = 34;

  CD.inCloud = (w, s) => {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    return w.clouds.some(c => cx > c.x + 6 && cx < c.x + c.w - 6 && cy > c.y + 4 && cy < c.y + c.h - 4);
  };

  // Lightning bolts: warn for `warn` seconds, then strike their column for `strike` seconds.
  CD.updateBolts = (w, s, dt) => {
    for (const b of w.bolts) {
      if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) w.events.push({ name: 'thunder', x: b.x, y: 0 }); continue; }
      b.strike -= dt;
      const cx = s.x + s.w / 2;
      if (b.strike > 0 && Math.abs(cx - b.x) < 10) CD.hurt(s, w);
    }
    w.bolts = w.bolts.filter(b => b.warn > 0 || b.strike > 0);
  };

  // Cloud banks drift past in the middle band; the Storm Wall brings more of them, and lightning.
  CD.updateWeather = (w, s, dt) => {
    const area = CD.areaAt(w.distance);
    for (const c of w.clouds) c.x -= SCROLL * dt;
    w.clouds = w.clouds.filter(c => c.x + c.w > -20);
    w.cloudTimer = (w.cloudTimer ?? 0.5) - dt;
    if (w.cloudTimer <= 0 && !w.boss) {                 // no new banks during a boss fight: nowhere for it to hide
      const r = w.rand, cw = 90 + r() * 110, ch = 34 + r() * 20;
      w.clouds.push({ x: CD.VIEW_W + 10, y: CLOUD_TOP + r() * (CLOUD_BOTTOM - CLOUD_TOP - ch), w: cw, h: ch });
      w.cloudTimer = (cw / SCROLL) * (1 / area.clouds - 0.5) + r() * 2;
    }
    if (area.lightning) {
      w.boltTimer = (w.boltTimer ?? 2) - dt;
      if (w.boltTimer <= 0) {
        // strike near the ship often enough to matter, never exactly on cue
        const x = CD.clamp(s.x + s.w / 2 + (w.rand() - 0.5) * 120, 20, CD.VIEW_W - 20);
        w.bolts.push({ x, warn: 0.8, strike: 0.2 });
        w.boltsMade = (w.boltsMade || 0) + 1;
        w.boltTimer = 2.2 + w.rand() * 2.5;
      }
    }
    CD.updateBolts(w, s, dt);
  };
})();
