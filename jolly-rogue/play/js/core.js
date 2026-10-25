// Jolly Rogue — shared constants, helpers and keyboard input.
// Classic script (not a module) so the game runs from a double-clicked file too.
(() => {
  const JR = (window.JR = window.JR || {});

  JR.TILE = 16;
  JR.VIEW_W = 384;     // what the camera shows, in game pixels
  JR.VIEW_H = 216;
  JR.ROWS = 17;        // the level is 17 tiles (272 px) tall
  JR.WORLD_H = 272;
  JR.CAM_Y = 56;       // the camera sits low: rows 0-3 are headroom above the screen
  JR.GRAVITY = 900;          // enemies, pickups, thrown things
  JR.MAX_FALL = 460;
  // Player feel
  JR.RUN_SPEED = 92;
  JR.RUN_ACCEL = 1900;       // px/s²: full speed in ~3 frames
  JR.RUN_DECEL = 2800;       // stop in ~2 frames
  JR.JUMP_VEL = -352;
  JR.JUMP_CUT = -190;        // releasing jump early caps the rise here (short hop)
  JR.GRAVITY_UP = 960;       // rising with jump held
  JR.GRAVITY_FALL = 1650;    // falling, or rising after release
  JR.JUMP_BUFFER = 0.1;
  JR.STOMP_DEPTH = 8;
  // Gold: each coin is worth COIN, and every LIFE_GOLD picked up in a run is an extra life.
  JR.COIN = 2;
  JR.LIFE_GOLD = 200;        // landing with the feet this far into an enemy's top is a stab, not a bump
  JR.STOMP_BOUNCE = 0.8;     // the bounce off a stab, as a share of a jump      // a press this early before landing still jumps
  JR.COYOTE = 0.08;          // and this late after running off a ledge

  JR.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  JR.overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // mulberry32: small, fast, deterministic.
  JR.rng = seed => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  JR.pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

  JR.newInput = () => ({
    left: false, right: false, up: false, down: false, jump: false, fire: false,
    jumpPressed: false, firePressed: false,
  });

  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    KeyX: 'fire', KeyJ: 'fire', KeyF: 'fire',
  };

  // Holds keyboard state in `input`; *Pressed are edge flags the game clears each step.
  // `onKey(code)` gets every fresh keydown, for menus, pause and mute.
  JR.bindKeys = (input, onKey) => {
    window.addEventListener('keydown', e => {
      const k = KEYS[e.code];
      if (k) {
        if (!input[k]) {
          if (k === 'jump') input.jumpPressed = true;
          if (k === 'fire') input.firePressed = true;
        }
        input[k] = true;
        e.preventDefault();
      }
      if (!e.repeat && onKey) onKey(e.code);
    });
    window.addEventListener('keyup', e => {
      const k = KEYS[e.code];
      if (k) input[k] = false;
    });
    window.addEventListener('blur', () => {
      for (const k of Object.values(KEYS)) input[k] = false;
    });
  };
})();
