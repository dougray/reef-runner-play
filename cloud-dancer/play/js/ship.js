// The airship: free 2D steering (keys, or a touch target it eases toward), screen bounds, tilt,
// and FULL STEAM (a forward dash that spends the steam gauge, rams, and can't be hurt). Pure logic.
(() => {
  const CD = window.CD;

  CD.makeShip = () => ({
    x: 40, y: CD.VIEW_H / 2 - CD.SHIP_H / 2, w: CD.SHIP_W, h: CD.SHIP_H, vx: 0, vy: 0, tilt: 0,
    hearts: CD.MAX_HEARTS, maxHearts: CD.MAX_HEARTS, lives: CD.LIVES, inv: 0, dead: false,
    steamMax: CD.STEAM_MAX, fireMult: 1, wide: false, magnet: false, pet: 'none', look: null,
    steam: CD.STEAM_MAX, dash: 0, dashCool: 0, fireCool: 0, t: 0, weapon: 'cannon', weaponT: 0,
  });

  CD.shipInvulnerable = s => s.inv > 0 || s.dash > 0;

  CD.updateShip = (s, input, dt) => {
    s.t += dt;
    s.inv = Math.max(0, s.inv - dt);
    s.dashCool = Math.max(0, s.dashCool - dt);
    if (s.weaponT > 0 && (s.weaponT -= dt) <= 0) { s.weaponT = 0; s.weapon = 'cannon'; }   // a pickup gun runs out
    if (s.dash <= 0) s.steam = Math.min(s.steamMax, s.steam + CD.STEAM_REGEN * dt);   // no refill mid-dash

    if (input.dashPressed && s.dash <= 0 && s.dashCool <= 0 && s.steam >= CD.DASH_COST) {
      s.steam -= CD.DASH_COST;
      s.dash = CD.DASH_TIME;
      s.dashCool = CD.DASH_COOLDOWN;
    }

    let vx = 0, vy = 0;
    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0), ky = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (kx || ky) {
      const len = Math.hypot(kx, ky);
      vx = (kx / len) * CD.SHIP_SPEED; vy = (ky / len) * CD.SHIP_SPEED;
    } else if (input.target) {
      // ease toward the touch point, a little quicker than key speed at most
      const dx = input.target.x - (s.x + s.w / 2), dy = input.target.y - (s.y + s.h / 2);
      const k = 10, max = CD.SHIP_SPEED * 1.4;
      vx = dx * k; vy = dy * k;
      const sp = Math.hypot(vx, vy);
      if (sp > max) { vx = (vx / sp) * max; vy = (vy / sp) * max; }
    }
    if (s.dash > 0) { s.dash = Math.max(0, s.dash - dt); vx = CD.DASH_SPEED; }
    s.vx = vx; s.vy = vy;
    s.x = CD.clamp(s.x + vx * dt, CD.MARGIN, CD.VIEW_W - CD.MARGIN - s.w);
    s.y = CD.clamp(s.y + vy * dt, CD.MARGIN, CD.VIEW_H - CD.MARGIN - s.h);
    s.tilt += (CD.clamp(vy / CD.SHIP_SPEED, -1, 1) * 0.18 - s.tilt) * Math.min(1, dt * 10);
  };
})();
