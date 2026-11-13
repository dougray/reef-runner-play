// Rope swings: a rope (ship's rigging) or a vine (the jungle) hangs from an anchor. Jump into it
// and the pirate grabs on; it swings as a pendulum, Left/Right pump it, Up/Down climb, and Jump lets
// go with the swing's momentum (plus a little hop). Down + Jump drops off without the hop.
// Same physics for every kind; only the art differs (js/art-seas.js). Pure logic, no drawing.
//   j  a rope or vine 5 tiles long, hanging from the top of its cell
//   q  a long one, 7 tiles
(() => {
  const JR = window.JR;
  const emit = (w, name, x, y) => w.events.push({ name, x, y });

  JR.ROPE = {
    lengths: { j: 80, q: 112 },
    g: 900,            // the pendulum's gravity (gentler than a jump's fall: a swing feels floaty)
    pump: 5.2,         // rad/s² of push from Left/Right
    damp: 0.12,        // per second
    maxAngle: 1.3,     // radians either side (about 75°)
    grabDist: 9,       // px from the rope to the pirate's hands
    regrab: 0.3,       // s after letting go before the same rope can catch you again
    climb: 70,         // px/s up or down the rope
    minR: 18,          // you can't climb onto the anchor
    hop: 0.55,         // share of a jump added upward on release
    maxFling: 250,     // px/s cap on the release speed sideways
  };
  JR.ROPE_TYPES = 'jq';
  // The widest gap (tiles) a rope chunk may ask you to swing over: anchored 6-8 tiles above the
  // ledge, about 5 tiles out from it. tests/ropes.test.mjs plays it with every class.
  JR.ROPE_GAP = 12;
  // Rows the anchors hang from over ground-level (row 15) ledges, so a running jump meets the rope
  // part-way down instead of at its knot. Chunks keep to these, relative to the ledge.
  JR.ROPE_ROWS = { j: 6, q: 4 };

  // A rope from a level spawn: anchored at the top middle of its tile. kind: 'rope' or 'vine'.
  JR.makeRope = (s, kind = 'rope') => {
    const len = JR.ROPE.lengths[s.type] || 80;
    // Ropes start with a little sway, offset by position so a row of them doesn't move in step.
    const phase = (Math.abs(Math.floor(s.x / 16)) % 7) * 0.9;
    return { type: s.type, kind, ax: s.x + 8, ay: s.y, len, angle: 0.18 * Math.sin(phase), omega: 0, held: false, t: phase, x: s.x, y: s.y };
  };

  // The pendulum step, shared by an empty rope and one with the pirate on it.
  const swing = (rope, r, push, dt) => {
    const R = JR.ROPE;
    rope.omega += (-(R.g / r) * Math.sin(rope.angle) + push) * dt;
    rope.omega *= 1 - R.damp * dt;
    rope.angle += rope.omega * dt;
    if (Math.abs(rope.angle) > R.maxAngle) { rope.angle = Math.sign(rope.angle) * R.maxAngle; rope.omega *= -0.2; }
  };

  // An empty rope sways gently back toward a slow idle swing.
  JR.updateRope = (rope, dt) => {
    rope.t += dt;
    if (rope.held) return;
    const idle = 0.14 * Math.sin(rope.t * 1.6);
    swing(rope, rope.len, (idle - rope.angle) * 2.2, dt);
  };

  // A point `r` px down the rope.
  JR.ropePoint = (rope, r) => ({ x: rope.ax + Math.sin(rope.angle) * r, y: rope.ay + Math.cos(rope.angle) * r });

  // Where the pirate's hands are (just above his head) and the body placed under them.
  const hands = p => ({ x: p.x + p.w / 2, y: p.y + 2 });
  const hangAt = (p, pt) => { p.x = pt.x - p.w / 2; p.y = pt.y - 2; };

  // Grabs the nearest rope in reach, if any: airborne, hands within grabDist of the rope line.
  // Returns the rope grabbed.
  JR.tryGrabRope = (p, ropes, w) => {
    if (p.onGround || p.rope || (p.regrab || 0) > 0 || p.dead) return null;
    const R = JR.ROPE, h = hands(p);
    let best = null, bestD = R.grabDist, bestR = 0;
    for (const rope of ropes) {
      if (rope.held) continue;
      const dx = Math.sin(rope.angle), dy = Math.cos(rope.angle);
      const rx = h.x - rope.ax, ry = h.y - rope.ay;
      const along = rx * dx + ry * dy;
      if (along < R.minR || along > rope.len) continue;
      const d = Math.abs(rx * dy - ry * dx);
      if (d < bestD) { best = rope; bestD = d; bestR = along; }
    }
    if (!best) return null;
    const r = Math.max(R.minR, bestR);
    // Keep the pirate's sideways momentum: it becomes the swing's speed along the arc.
    const tangential = p.vx * Math.cos(best.angle) - p.vy * Math.sin(best.angle);
    best.omega = JR.clamp(tangential / r, -4, 4);
    best.held = true;
    p.rope = best; p.ropeR = r;
    p.vx = p.vy = 0; p.usedDouble = false; p.fling = 0; p.crouch = false; p.h = 24;
    hangAt(p, JR.ropePoint(best, r));
    emit(w, 'grab', p.x, p.y);
    return best;
  };

  // Lets go: the arc's speed becomes the pirate's, plus a hop unless dropping (Down held).
  JR.releaseRope = (p, w, hop = true) => {
    const rope = p.rope, R = JR.ROPE;
    if (!rope) return;
    const r = p.ropeR, v = r * rope.omega;
    p.vx = JR.clamp(v * Math.cos(rope.angle), -R.maxFling, R.maxFling);
    p.vy = -v * Math.sin(rope.angle) + (hop ? JR.JUMP_VEL * R.hop * (p.jumpMult || 1) : 0);
    if (Math.abs(p.vx) > 8) p.facing = Math.sign(p.vx);
    rope.held = false;
    p.rope = null; p.regrab = R.regrab; p.fling = 1.2; p.jumpHeld = hop; p.usedDouble = false;
    emit(w, hop ? 'jump' : 'land', p.x, p.y);
  };

  // One step on the rope: pump, climb, swing, bump walls, let go on Jump. Returns true while still on it.
  JR.swingPlayer = (p, input, lv, w, dt) => {
    const rope = p.rope, R = JR.ROPE;
    if (input.jumpPressed) { JR.releaseRope(p, w, !input.down); p.jumpBuf = 0; return false; }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.facing = dir;
    if (input.up) p.ropeR = Math.max(R.minR, p.ropeR - R.climb * dt);
    if (input.down) p.ropeR = Math.min(rope.len, p.ropeR + R.climb * dt);
    const before = { angle: rope.angle, omega: rope.omega };
    // Left/Right push the swing that way; in time with the swing, it builds like a playground swing.
    swing(rope, p.ropeR, dir * R.pump, dt);
    hangAt(p, JR.ropePoint(rope, p.ropeR));
    // Swung into a wall or a mast: stop there and bounce back a little.
    const T = JR.TILE;
    const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 0.01) / T), r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 0.01) / T);
    let hit = false;
    for (let c = c0; c <= c1 && !hit; c++) for (let r = r0; r <= r1; r++) if (lv.solid(c, r)) { hit = true; break; }
    if (hit) {
      rope.angle = before.angle; rope.omega = -before.omega * 0.3;
      hangAt(p, JR.ropePoint(rope, p.ropeR));
      emit(w, 'thud', p.x, p.y);
    }
    p.vx = p.vy = 0; p.onGround = false;
    return true;
  };
})();
