// The sky's stages (nine of them, in a loop), cloud banks you can hide in, and each stage's
// weather: Storm Wall lightning, searchlights, icing and hail, ash and lava bombs, wind shear, flak
// curtains. Pure logic.
(() => {
  const CD = window.CD;

  CD.AREA_LEN = 3600;        // distance units per stage: one minute of flying, then its boss
  // Each stage: the enemies' mix (weights), how often cloud banks drift by, its weather flags, the
  // mid-stage set piece (enemies.js), its tune (music.js) and, for the new skies, which painted sky
  // it is built from (art.js grades it).
  CD.AREAS = [
    { id: 'reef', name: 'THE REEF SKIES', sub: 'THE KING\'S AERIAL NAVY', mix: { gyro: 5, mine: 2, flak: 2, zeppelin: 1 }, clouds: 0.25, lightning: false, setPiece: 'payship' },
    { id: 'storm', name: 'THE STORM WALL', sub: 'LIGHTNING ON THE WARNING LINES', mix: { gyro: 3, pike: 3, lurker: 2, mine: 2, zeppelin: 1 }, clouds: 0.6, lightning: true, setPiece: 'squall' },
    { id: 'forts', name: 'THE SKY-FORTS', sub: 'THE NAVY\'S FLOATING GUNS', mix: { zeppelin: 3, gyro: 3, mine: 2, flak: 2 }, clouds: 0.3, lightning: false, setPiece: 'battery' },
    { id: 'ceiling', name: 'THE CEILING OF THE WORLD', sub: 'WHERE THE LURKERS NEST', mix: { zeppelin: 2, pike: 2, lurker: 2, gyro: 2, mine: 2 }, clouds: 0.4, lightning: false, setPiece: 'nest' },
    { id: 'night', name: 'THE MIDNIGHT PICKET', sub: 'STAY OUT OF THE SEARCHLIGHTS', base: 'reef', tune: 'night', mix: { picket: 3, gyro: 3, mine: 2, flak: 2, lurker: 1 }, clouds: 0.45, lightning: false, setPiece: 'pickets' },
    { id: 'frost', name: 'THE FROZEN HEIGHTS', sub: 'FULL STEAM SHAKES OFF THE ICE', base: 'ceiling', tune: 'frost', mix: { icemine: 3, gyro: 3, pike: 2, zeppelin: 1, flak: 1 }, clouds: 0.3, lightning: false, icing: true, hail: true, setPiece: 'avalanche' },
    { id: 'ash', name: 'THE ASH CLOUDS', sub: 'ASH CHOKES THE BOILER: DON\'T LINGER', base: 'storm', tune: 'ash', mix: { bomber: 3, gyro: 2, flak: 3, mine: 1, zeppelin: 1 }, clouds: 0.5, lightning: false, ash: true, lava: true, setPiece: 'eruption' },
    { id: 'thunder', name: 'THE THUNDERHEAD', sub: 'WIND SHEAR AND CONDUCTOR FENCES', base: 'storm', tune: 'storm', mix: { rod: 3, pike: 3, gyro: 2, lurker: 2 }, clouds: 0.55, lightning: true, shear: true, setPiece: 'fence' },
    { id: 'citadel', name: 'THE SKY CITADEL', sub: 'STORM THE ADMIRALTY', base: 'forts', tune: 'forts', mix: { zeppelin: 3, ceilflak: 3, flak: 2, gyro: 3, mine: 1 }, clouds: 0.25, lightning: false, curtains: true, setPiece: 'curtain' },
  ];

  CD.areaAt = distance => {
    const n = Math.floor(Math.max(0, distance) / CD.AREA_LEN);
    return { ...CD.AREAS[n % CD.AREAS.length], index: n % CD.AREAS.length, loop: Math.floor(n / CD.AREAS.length) };
  };
  // Where stage `index` (of the first loop) begins.
  CD.areaStart = index => Math.max(0, Math.min(CD.AREAS.length - 1, index | 0)) * CD.AREA_LEN;

  // Seconds between waves: 3.2 at the start, down to 1.4 far out.
  CD.spawnInterval = distance => Math.max(1.4, 3.2 - distance / 4000);

  const CLOUD_TOP = 70, CLOUD_BOTTOM = 160, SCROLL = 34;
  CD.SCROLL = SCROLL;

  CD.inCloud = (w, s) => {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    return w.clouds.some(c => cx > c.x + 6 && cx < c.x + c.w - 6 && cy > c.y + 4 && cy < c.y + c.h - 4);
  };

  // Lightning bolts (and the Furnace's flame columns, `fire`): warn for `warn` seconds, then strike
  // their column for `strike` seconds.
  CD.updateBolts = (w, s, dt) => {
    for (const b of w.bolts) {
      if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) w.events.push({ name: b.fire ? 'blast' : 'thunder', x: b.x, y: 0 }); continue; }
      b.strike -= dt;
      const cx = s.x + s.w / 2;
      if (b.strike > 0 && Math.abs(cx - b.x) < 10) CD.hurt(s, w);
    }
    w.bolts = w.bolts.filter(b => b.warn > 0 || b.strike > 0);
  };

  // Falls: a marker warns where something will come from (`ice`: an icicle drops from above; `lava`:
  // a lava bomb bursts up from the volcano below), then it becomes an enemy shot.
  CD.addFall = (w, x, kind, warn = 0.9) => w.falls.push({ x: CD.clamp(x, 10, CD.VIEW_W - 10), kind, warn, t: 0 });
  CD.updateFalls = (w, dt) => {
    for (const f of w.falls) {
      f.t += dt;
      if ((f.warn -= dt) > 0) continue;
      if (f.kind === 'ice') w.shots.push({ x: f.x, y: -8, vx: 0, vy: 190, r: 3, friendly: false, dmg: 1, life: 3, icicle: true });
      else {
        w.shots.push({ x: f.x, y: CD.VIEW_H + 6, vx: (w.rand() - 0.5) * 50, vy: -250 - w.rand() * 40, grav: 200, r: 4, friendly: false, dmg: 1, life: 4, lava: true });
        w.events.push({ name: 'blast', x: f.x, y: CD.VIEW_H });
      }
    }
    w.falls = w.falls.filter(f => f.warn > 0);
  };

  // Flak curtains: a wall of bursts across the sky with one gap; it warns, then bursts for `live`
  // seconds, drifting with the sky.
  CD.addCurtain = (w, x, gapY, warn = 1.1) => w.curtains.push({ x, gapY: CD.clamp(gapY, 8, CD.VIEW_H - 60), gapH: 52, warn, live: 0.7 });
  CD.inCurtainGap = (c, y) => y > c.gapY && y < c.gapY + c.gapH;
  CD.updateCurtains = (w, s, dt) => {
    for (const c of w.curtains) {
      c.x -= SCROLL * dt;
      if (c.warn > 0) { if ((c.warn -= dt) <= 0) w.events.push({ name: 'broadside', x: c.x, y: 0 }); continue; }
      c.live -= dt;
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      if (c.live > 0 && Math.abs(cx - c.x) < 9 && !CD.inCurtainGap(c, cy)) CD.hurt(s, w);
    }
    w.curtains = w.curtains.filter(c => c.warn > 0 || c.live > 0);
  };

  // Cloud banks drift past in the middle band; each stage brings its own weather on top.
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
        w.boltTimer = (area.shear ? 1.8 : 2.2) + w.rand() * 2.5;   // the Thunderhead strikes more often
      }
    }
    // The Frozen Heights: ice builds on the rigging and slows the steering; FULL STEAM (or a sack
    // of coal) shakes it off. Out of the cold it melts quickly.
    if (area.icing && !s.dead) {
      if (s.dash > 0) { if (s.ice > 0.2) w.events.push({ name: 'thaw', x: s.x, y: s.y }); s.ice = 0; }
      else s.ice = Math.min(1, (s.ice || 0) + dt / 20);
    } else if (s.ice) s.ice = Math.max(0, s.ice - dt / 3);
    if (area.hail && !w.boss) {
      w.hailTimer = (w.hailTimer ?? 3) - dt;
      if (w.hailTimer <= 0) {
        const n = 1 + Math.floor(w.rand() * 3), cx = s.x + s.w / 2;
        for (let i = 0; i < n; i++) CD.addFall(w, cx + (w.rand() - 0.5) * 140, 'ice', 0.9 + i * 0.2);
        w.hailTimer = 2.6 + w.rand() * 2.4;
      }
    }
    // The Ash Clouds: hiding in ash chokes the boiler (steam drains), and lava bombs burst up from
    // the volcano far below.
    w.choking = !!(area.ash && !w.boss && CD.inCloud(w, s));
    if (w.choking) s.steam = Math.max(0, s.steam - 30 * dt);
    if (area.lava && !w.boss) {
      w.lavaTimer = (w.lavaTimer ?? 2.5) - dt;
      if (w.lavaTimer <= 0) {
        CD.addFall(w, s.x + s.w / 2 + (w.rand() - 0.3) * 160, 'lava', 1.1);
        w.lavaTimer = 2.4 + w.rand() * 2.6;
      }
    }
    // The Thunderhead: wind shear. A gust warns (streaks show which way), then shoves the ship up or down.
    if (area.shear && !w.boss) {
      if (!w.gust) { w.gustTimer = (w.gustTimer ?? 4) - dt; if (w.gustTimer <= 0) w.gust = { dir: w.rand() < 0.5 ? -1 : 1, warn: 1, push: 1.6 }; }
      else if (w.gust.warn > 0) { if ((w.gust.warn -= dt) <= 0) w.events.push({ name: 'sweep', x: 0, y: s.y }); }
      else if ((w.gust.push -= dt) > 0) s.y = CD.clamp(s.y + w.gust.dir * 58 * dt, CD.MARGIN, CD.VIEW_H - CD.MARGIN - s.h);
      else { w.gust = null; w.gustTimer = 5 + w.rand() * 4; }
    } else if (w.gust) w.gust = null;
    // The Sky Citadel: flak curtains, each with one gap to slip through.
    if (area.curtains && !w.boss) {
      w.curtainTimer = (w.curtainTimer ?? 5) - dt;
      if (w.curtainTimer <= 0) {
        CD.addCurtain(w, CD.clamp(s.x + s.w / 2 + 90 + w.rand() * 90, 140, CD.VIEW_W - 30), 10 + w.rand() * (CD.VIEW_H - 80));
        w.curtainTimer = 6 + w.rand() * 4;
      }
    }
    w.spotted = Math.max(0, (w.spotted || 0) - dt);
    CD.updateBolts(w, s, dt);
    CD.updateFalls(w, dt);
    CD.updateCurtains(w, s, dt);
  };
})();
