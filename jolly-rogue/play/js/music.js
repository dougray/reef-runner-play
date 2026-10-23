// Chiptune music, NES style: a square-wave lead, a triangle bass and noise drums, scheduled a little
// ahead on the audio clock. Original tunes, one per area plus a boss theme. Each step is an 8th note;
// in a line, '-' holds the previous note, '.' rests and '|' is just a bar line for reading.
(() => {
  const JR = window.JR;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  JR.noteFreq = name => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    const midi = 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  JR.parseLine = line => line.split(/\s+/).filter(t => t && t !== '|').map(t => (t === '-' ? '-' : t === '.' ? null : JR.noteFreq(t)));

  JR.TUNES = {
    beach: {
      bpm: 138,
      lead: 'D4 - F4 A4 D5 - A4 F4 | G4 - A4 Bb4 A4 - F4 D4 | C4 - E4 G4 C5 - G4 E4 | D4 - F4 E4 D4 - . .',
      bass: 'D3 . A2 . D3 . A2 . | G2 . D3 . G2 . D3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . . .',
      drums: 'k.h.s.h.k.h.s.hh',
    },
    town: {
      bpm: 150,
      lead: 'F4 A4 C5 A4 F4 A4 C5 - | G4 Bb4 D5 Bb4 G4 - C5 - | A4 C5 F5 C5 A4 F4 G4 A4 | F4 - C4 - F4 - . .',
      bass: 'F2 . C3 . F2 . C3 . | G2 . D3 . C3 . C3 . | F2 . C3 . F2 . C3 . | F2 . C3 . F2 . . .',
      drums: 'k.h.k.s.k.h.k.s.',
    },
    fort: {
      bpm: 120,
      lead: 'A3 - A3 C4 E4 - D4 C4 | B3 - B3 D4 F4 - E4 D4 | C4 - E4 A4 G4 E4 F4 D4 | E4 - - - E4 - . .',
      bass: 'A2 . E2 . A2 . E2 . | G2 . D2 . G2 . D2 . | F2 . C3 . E2 . D2 . | E2 . B2 . E2 . . .',
      drums: 's.s.k.s.s.s.k.ss',
    },
    ship: {
      bpm: 132,
      lead: 'D4 - A4 F4 - D4 | C4 - G4 E4 - C4 | D4 - A4 B4 A4 G4 | F4 E4 D4 - . .',
      bass: 'D3 . . A2 . . | C3 . . G2 . . | D3 . . A2 . . | D3 . . . . .',
      drums: 'k..h..s..h..',
    },
    boss: {
      bpm: 168,
      lead: 'D4 D4 F4 D4 G4 D4 F4 E4 | D4 D4 F4 D4 A4 G4 F4 E4 | Bb3 Bb3 D4 Bb3 F4 Bb3 D4 C4 | A3 A3 C#4 A3 E4 - A4 -',
      bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | A1 A2 A1 A2 A1 A2 A1 A2',
      drums: 'k.s.k.s.kks.k.sh',
    },
  };

  // ---------- player (browser only) ----------

  let cur = null, name = null, step = 0, next = 0, bus = null;

  function voice(a, type, freq, t0, dur, vol) {
    const o = a.ac.createOscillator(), g = a.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.01, dur - 0.04));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function drum(a, kind, t0) {
    if (kind === 'k') {
      const o = a.ac.createOscillator(), g = a.ac.createGain();
      o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
      g.gain.setValueAtTime(0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(g).connect(bus); o.start(t0); o.stop(t0 + 0.16);
      return;
    }
    const s = a.ac.createBufferSource(), f = a.ac.createBiquadFilter(), g = a.ac.createGain();
    s.buffer = a.noise;
    f.type = kind === 's' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 's' ? 1800 : 7000;
    const len = kind === 's' ? 0.1 : 0.035, vol = kind === 's' ? 0.14 : 0.05;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    s.connect(f).connect(g).connect(bus); s.start(t0); s.stop(t0 + len + 0.01);
  }
  // How many steps a note lasts: itself plus any '-' holds after it.
  const span = (line, i) => { let n = 1; while (line[(i + n) % line.length] === '-' && n < line.length) n++; return n; };

  JR.music = {
    play(tuneName) {
      if (name === tuneName && cur) return;
      const a = JR.sfx.audio();                      // null until the first tap or key unlocks audio
      const t = JR.TUNES[tuneName];
      if (!t || !a) { cur = null; name = null; return; }
      name = tuneName;
      if (!bus) { bus = a.ac.createGain(); bus.gain.value = 0.55; bus.connect(a.master); }
      cur = { bpm: t.bpm, lead: JR.parseLine(t.lead), bass: JR.parseLine(t.bass), drums: t.drums.replace(/ /g, '') };
      step = 0; next = a.ac.currentTime + 0.06;
    },
    stop() { cur = null; name = null; },
    get playing() { return name; },
    // Call every frame: schedules whatever falls in the next 150 ms.
    update() {
      const a = JR.sfx.audio();
      if (!cur || !a) return;
      const dt = 60 / cur.bpm / 2;
      if (next < a.ac.currentTime - 0.5) next = a.ac.currentTime + 0.02;   // tab was asleep: don't burst
      while (next < a.ac.currentTime + 0.15) {
        const L = cur.lead, B = cur.bass, D = cur.drums;
        const l = L[step % L.length], b = B[step % B.length], d = D[step % D.length];
        if (typeof l === 'number') voice(a, 'square', l, next, dt * span(L, step % L.length) * 0.92, 0.05);
        if (typeof b === 'number') voice(a, 'triangle', b, next, dt * span(B, step % B.length) * 0.95, 0.16);
        if (d !== '.') drum(a, d, next);
        step++; next += dt;
      }
    },
  };
})();
