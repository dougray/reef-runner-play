// Game controllers and TV remotes. Each pad button becomes a key the game already understands,
// so menus and play need nothing new. Two sources feed it:
//  - in a browser, the Gamepad API, polled every frame (controllers with the standard mapping);
//  - in the Android app (phones, tablets, Fire TV), the activity sends remote and controller
//    buttons here by name with window.padInput(name, down, from), and the web view never sees them.
// Button names: up down left right a b x y lb rb lt rt back start ls rs. A TV remote's OK is
// "a", Back is "back", Menu is "start", Play/Pause is "x", Rewind and Fast-forward are lb and rb.
// The app also says which kind of device pressed it; while the last one was a TV remote the page
// has the class "remote", so a game can make up for the remote's few buttons.
// The game sets window.PAD = { code(name) -> a key code or null, canExit() -> true at its title,
// sideways() -> true while playing }. While sideways() a TV remote is held on its side, ring in the
// left hand (its top pointing left), so its directions are turned a quarter: the ring's up is left.
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

  const kind = k => { if (k) document.documentElement.classList.toggle('remote', k === 'remote'); };
  const SIDEWAYS = { up: 'left', right: 'up', down: 'right', left: 'down' };
  const turned = new Map();                     // remote button -> the direction it pressed, until let go
  // From the Android app. Returns 'exit' when Back should close the app (the game is at its title).
  window.padInput = (name, down, from) => {
    kind(from);
    if (name === 'back' && down && window.PAD && window.PAD.canExit && window.PAD.canExit()) return 'exit';
    if (down) {
      const side = from === 'remote' && SIDEWAYS[name] && window.PAD && window.PAD.sideways && window.PAD.sideways();
      turned.set(name, side ? SIDEWAYS[name] : name);
    }
    const as = turned.get(name) || name;
    if (!down) turned.delete(name);
    press(as, !!down);
    return '';
  };

  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  // A TV (the app, with no touch screen) shows the remote's buttons in its hints from the start,
  // and the page gets the class "tv" so the game can draw fewer pixels (TV chips are slow).
  if (native && !navigator.maxTouchPoints) { padMode(); kind('remote'); document.documentElement.classList.add('tv'); }

  // Browser controllers: the standard mapping's buttons in order, then the left stick.
  const BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
  let polling = false;
  function poll() {
    const now = {};
    let any = false;
    for (const gp of navigator.getGamepads()) {
      if (!gp || gp.mapping !== 'standard') continue;
      any = true;
      if (gp.buttons.some(b => b.pressed)) kind('pad');
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
