// Game controllers and TV remotes. Each pad button becomes a key the game already understands,
// so menus and play need nothing new. Two sources feed it:
//  - in a browser, the Gamepad API, polled every frame (controllers with the standard mapping);
//  - in the Android app (phones, tablets, Fire TV), the activity sends remote and controller
//    buttons here by name with window.padInput(name, down), and the web view never sees them.
// Button names: up down left right a b x y lb rb lt rt back start ls rs. A TV remote's OK is
// "a", Back is "back", Menu is "start", Play/Pause is "x", Rewind and Fast-forward are lb and rb.
// The game sets window.PAD = { code(name) -> a key code or null, canExit() -> true at its title }.
// The same file is in all three games (Reef Runner, Jolly Rogue, Cloud Dancer).
(() => {
  const held = new Map();                       // pad button -> the key code it pressed
  const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
  const padMode = () => document.documentElement.classList.add('pad');

  function press(name, down) {
    if (down === held.has(name)) return;
    if (down) {
      const code = window.PAD && window.PAD.code(name);
      if (!code) return;
      padMode();
      held.set(name, code);
      send('keydown', code);
    } else {
      const code = held.get(name);
      held.delete(name);
      send('keyup', code);
    }
  }

  // From the Android app. Returns 'exit' when Back should close the app (the game is at its title).
  window.padInput = (name, down) => {
    if (name === 'back' && down && window.PAD && window.PAD.canExit && window.PAD.canExit()) return 'exit';
    press(name, !!down);
    return '';
  };

  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  // A TV (the app, with no touch screen) gets the pad's button names in its hints from the start.
  if (native && !('ontouchstart' in window) && !navigator.maxTouchPoints) padMode();

  // Browser controllers: the standard mapping's buttons in order, then the left stick.
  const BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
  let polling = false;
  function poll() {
    const now = {};
    let any = false;
    for (const gp of navigator.getGamepads()) {
      if (!gp || gp.mapping !== 'standard') continue;
      any = true;
      gp.buttons.forEach((b, i) => { if (BUTTONS[i] && (b.pressed || b.value > 0.5)) now[BUTTONS[i]] = true; });
      const [x = 0, y = 0] = gp.axes;
      if (x < -0.5) now.left = true;
      if (x > 0.5) now.right = true;
      if (y < -0.5) now.up = true;
      if (y > 0.5) now.down = true;
    }
    for (const name of BUTTONS) press(name, !!now[name]);
    polling = any;
    if (polling) requestAnimationFrame(poll);
  }
  // In the app the activity already sends the pad's buttons, so polling here would press them twice.
  if (!native && navigator.getGamepads) {
    window.addEventListener('gamepadconnected', () => { if (!polling) { polling = true; requestAnimationFrame(poll); } });
  }
})();
