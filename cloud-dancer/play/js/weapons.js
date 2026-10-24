// The Cloud Dancer's guns: the broadside cannons, and pickup guns that last WEAPON_TIME seconds.
// Pure logic.
(() => {
  const CD = window.CD;
  CD.WEAPON_TIME = 20;
  CD.PICKUP_GUNS = ['chain', 'harpoon', 'rockets', 'gatling'];

  // Each: cooldown (s), and shots(bx, by, rand) → list of {vx, vy, life, dmg, ...}.
  const ball = (a, speed, extra) => ({ vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ...extra });
  CD.WEAPONS = {
    cannon: { name: 'CANNONS', cooldown: 0.28, shots: () => [-0.06, 0.06].map(a => ball(a, CD.SHOT_SPEED, { life: 2, dmg: 1 })) },
    chain: { name: 'CHAIN SHOT', cooldown: 0.34, shots: () => [-0.32, 0, 0.32].map(a => ball(a, 320, { life: 0.45, dmg: 1, r: 3 })) },
    harpoon: { name: 'HARPOON', cooldown: 0.45, shots: () => [ball(0, 420, { life: 2, dmg: 2, pierce: true, harpoon: true })] },
    rockets: { name: 'ROCKETS', cooldown: 0.6, shots: () => [-0.5, 0.5].map(a => ball(a, 160, { life: 3, dmg: 2, homing: true, rocket: true })) },
    gatling: { name: 'GATLING', cooldown: 0.09, shots: rand => [ball((rand() - 0.5) * 0.12, 360, { life: 1.6, dmg: 1, r: 1.5 })] },
  };

  CD.fireWeapon = (w, s) => {
    const gun = CD.WEAPONS[s.weapon] || CD.WEAPONS.cannon;
    const bx = s.x + s.w - 2, by = s.y + s.h * 0.62;
    const shots = gun.shots(w.rand);
    if (s.wide && gun === CD.WEAPONS.cannon) shots.push({ vx: CD.SHOT_SPEED, vy: 0, life: 2, dmg: 1 });   // the market's wide broadside
    for (const sh of shots) w.shots.push({ x: bx, y: by, r: 2, friendly: true, ...sh });
    w.events.push({ name: s.weapon === 'harpoon' ? 'harpoon' : s.weapon === 'rockets' ? 'rocket' : 'shot', x: bx, y: by });
    return gun === CD.WEAPONS.cannon ? gun.cooldown * (s.fireMult || 1) : gun.cooldown;   // quick cannons: the cannons only
  };
})();
