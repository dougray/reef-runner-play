// Companions. The monkey (or the shop's coin magnet) snatches coins near the pirate; the parrot
// spots chests and crates ahead.
(() => {
  const JR = window.JR;
  const REACH = 48, PULL = 240;

  JR.updatePet = (p, w, lv, dt) => {
    const reach = p.pet === 'monkey' ? REACH : p.magnet || 0;      // the shop's coin magnet is a weaker monkey
    if (!reach) return;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    for (const k of w.pickups) {
      if (k.type !== 'o') continue;
      const dx = cx - (k.x + k.w / 2), dy = cy - (k.y + k.h / 2), d = Math.hypot(dx, dy);
      if (d > reach && !k.snatched) continue;
      k.snatched = true; k.falling = false; k.vx = k.vy = 0;
      const step = Math.min(d, PULL * dt);
      k.x += (dx / (d || 1)) * step; k.y += (dy / (d || 1)) * step;
    }
  };

  // The next unspawned chest or crate within 360 px past the right edge of the screen, or null.
  JR.parrotAlert = (spawns, from, camX) => {
    const edge = camX + JR.VIEW_W + 360;
    for (let i = from; i < spawns.length && spawns[i].x < edge; i++) {
      if (spawns[i].type === 'c' || spawns[i].type === '$') return spawns[i];
    }
    return null;
  };
})();
