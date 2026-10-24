// Cloud Dancer — shared constants, helpers and keyboard input.
// Classic script (not a module) so the game runs from a double-clicked file too.
(() => {
  const CD = (window.CD = window.CD || {});

  CD.VIEW_W = 384;           // what the camera shows, in game units
  CD.VIEW_H = 216;
  CD.MARGIN = 4;             // the ship keeps this far from the screen edge
  // The airship
  CD.SHIP_SPEED = 120;       // units/s under key steering
  CD.SHIP_W = 36;
  CD.SHIP_H = 22;
  CD.MAX_HEARTS = 6;
  CD.LIVES = 3;
  CD.INV_TIME = 1.2;         // invulnerable after a hit
  // FULL STEAM
  CD.STEAM_MAX = 100;
  CD.STEAM_REGEN = 14;       // per second
  CD.DASH_COST = 45;
  CD.DASH_TIME = 0.45;
  CD.DASH_COOLDOWN = 0.9;
  CD.DASH_SPEED = 300;
  // Cannons
  CD.FIRE_COOLDOWN = 0.28;
  CD.SHOT_SPEED = 300;

  CD.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  CD.overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // mulberry32: small, fast, deterministic.
  CD.rng = seed => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // `target` is a touch steering point in game units (or null); *Pressed are edge flags the game
  // clears each step.
  CD.newInput = () => ({ left: false, right: false, up: false, down: false, fire: false, dash: false, dashPressed: false, target: null });

  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'dash', KeyZ: 'dash', KeyK: 'dash', ShiftLeft: 'dash',
    KeyX: 'fire', KeyJ: 'fire', KeyF: 'fire',
  };

  // Holds keyboard state in `input`; `onKey(code)` gets every fresh keydown (menus, pause, mute).
  CD.bindKeys = (input, onKey) => {
    window.addEventListener('keydown', e => {
      const k = KEYS[e.code];
      if (k) {
        if (k === 'dash' && !input.dash) input.dashPressed = true;
        input[k] = true;
        e.preventDefault();
      }
      if (!e.repeat && onKey) onKey(e.code);
    });
    window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) input[k] = false; });
    window.addEventListener('blur', () => { for (const k of Object.values(KEYS)) input[k] = false; });
  };
})();
