// Weapons: 8-way aiming, guns that spawn shots, and melee reach.
(() => {
  const JR = window.JR;

  JR.WEAPONS = {
    pistol: { name: 'FLINTLOCK', kind: 'gun', cooldown: 0.24, speed: 330, dmg: 1, life: 0.75, spread: [0] },
    rifle: { name: 'RIFLE', letter: 'R', kind: 'gun', cooldown: 0.5, speed: 480, dmg: 2, life: 0.8, spread: [0], pierce: true },
    tribarrel: { name: 'THREE-BARREL', letter: 'T', kind: 'gun', cooldown: 0.38, speed: 320, dmg: 1, life: 0.65, spread: [-0.2, 0, 0.2] },
    blunderbuss: { name: 'BLUNDERBUSS', letter: 'B', kind: 'gun', cooldown: 0.65, speed: 300, dmg: 1, life: 0.25, spread: [-0.36, -0.18, 0, 0.18, 0.36] },
    grenado: { name: 'GRENADOES', letter: 'G', kind: 'gun', cooldown: 0.55, speed: 230, dmg: 3, life: 3, spread: [0], grav: true, boom: 28, lob: 0.7 },
    swivel: { name: 'SWIVEL GUN', letter: 'S', kind: 'gun', cooldown: 0.08, speed: 380, dmg: 1, life: 0.6, spread: [0] },
    musket: { name: 'MUSKET', kind: 'gun', cooldown: 0.7, speed: 420, dmg: 3, life: 0.9, spread: [0] },
    brace: { name: 'BRACE OF PISTOLS', kind: 'gun', cooldown: 0.12, reload: 0.6, mag: 2, speed: 330, dmg: 1, life: 0.75, spread: [0] },
    cutlass: { name: 'CUTLASS', kind: 'melee', cooldown: 0.32, reach: 26, dmg: 2 },
    dagger: { name: 'DAGGER', kind: 'melee', cooldown: 0.16, reach: 18, dmg: 1 },
    axe: { name: 'BOARDING AXE', kind: 'melee', cooldown: 0.5, reach: 26, dmg: 4 },
    rapier: { name: 'RAPIER', kind: 'melee', cooldown: 0.3, reach: 36, dmg: 2 },
  };
  JR.PICKUP_GUNS = ['rifle', 'tribarrel', 'blunderbuss', 'grenado', 'swivel'];

  // Contra rules: up/down add a vertical component, left/right a horizontal one.
  // Straight down only in the air; on the ground Down alone means crouch, aim stays forward.
  JR.aimDir = (input, facing, onGround) => {
    const h = input.left !== input.right ? (input.right ? 1 : -1) : 0;
    let v = input.up ? -1 : input.down ? 1 : 0;
    if (v === 1 && h === 0 && onGround) v = 0;
    let x = h, y = v;
    if (x === 0 && y === 0) x = facing;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  };

  JR.fireGun = (w, x, y, dir) => {
    let d = dir;
    if (w.lob) { const ly = dir.y - w.lob, len = Math.hypot(dir.x, ly); d = { x: dir.x / len, y: ly / len }; }
    return w.spread.map(a => {
      const c = Math.cos(a), s = Math.sin(a);
      const dx = d.x * c - d.y * s, dy = d.x * s + d.y * c;
      const shot = { x, y, vx: dx * w.speed, vy: dy * w.speed, dmg: w.dmg, life: w.life, friendly: true };
      if (w.pierce) { shot.pierce = true; shot.hit = []; }
      if (w.grav) { shot.grav = true; shot.boom = w.boom; shot.r = 3; }
      return shot;
    });
  };

  JR.meleeBox = (p, w) => ({
    x: p.facing > 0 ? p.x + p.w : p.x - w.reach,
    y: p.y - 4, w: w.reach, h: p.h + 4,
  });

  JR.inMeleeRange = (p, enemies, w) => {
    const box = JR.meleeBox(p, w);
    return enemies.some(e => e.hp > 0 && JR.overlap(box, e));
  };
})();
