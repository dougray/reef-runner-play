// Music: original tunes, one for the harbour (menus), one per area and a boss theme, played by
// three synth voices (a square lead, a triangle bass, noise drums) scheduled ahead on the audio
// clock. Each step is an 8th note; '-' holds, '.' rests, '|' is only a bar line for reading.
(() => {
  const CD = window.CD;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  CD.noteFreq = name => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    const midi = 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
  const parse = line => line.split(/\s+/).filter(t => t && t !== '|').map(t => (t === '-' ? '-' : t === '.' ? null : CD.noteFreq(t)));

  CD.TUNES = {
    harbour: {   // a lilting sea shanty in the hangar
      bpm: 112,
      lead: 'D4 - F#4 A4 D5 - C#5 B4 | A4 - F#4 - A4 - . . | G4 - B4 D5 E5 - D5 B4 | A4 - - - . . . .',
      bass: 'D3 . A2 . D3 . A2 . | D3 . A2 . F#2 . A2 . | G2 . D3 . G2 . D3 . | A2 . E2 . A2 . . .',
      drums: 'k...h...s...h...',
    },
    reef: {      // bright and breezy over the islands
      bpm: 140,
      lead: 'G4 B4 D5 - B4 D5 G5 - | F#5 - D5 - E5 F#5 G5 - | E5 C5 E5 - D5 B4 G4 - | A4 B4 C5 B4 A4 - . .',
      bass: 'G2 . D3 . G2 . D3 . | D2 . A2 . D2 . A2 . | C3 . G2 . G2 . D3 . | D2 . A2 . D2 . . .',
      drums: 'k.h.s.h.k.h.s.hh',
    },
    storm: {     // minor, driving, thunder on the toms
      bpm: 150,
      lead: 'E4 - G4 B4 E5 - D5 B4 | C5 - B4 A4 G4 - A4 B4 | E4 - G4 B4 E5 - F#5 G5 | F#5 E5 D#5 - E5 - . .',
      bass: 'E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | E2 E3 E2 E3 E2 E3 E2 E3 | B1 B2 B1 B2 E2 . . .',
      drums: 'k.s.kks.k.s.kkss',
    },
    forts: {     // a stately march past the floating forts
      bpm: 120,
      lead: 'C5 - C5 G4 C5 - E5 - | D5 - B4 G4 D5 - F5 - | E5 - D5 C5 B4 - A4 G4 | C5 - G4 - C5 - . .',
      bass: 'C3 . G2 . C3 . G2 . | G2 . D3 . G2 . D3 . | C3 . G2 . F2 . G2 . | C3 . G2 . C2 . . .',
      drums: 's.s.k.s.s.s.k.ss',
    },
    ceiling: {   // high and airy, the top of the sky
      bpm: 132,
      lead: 'A4 C#5 E5 A5 - E5 C#5 E5 | B4 D5 F#5 B5 - F#5 D5 F#5 | C#5 E5 A5 - G#5 E5 B4 C#5 | D5 - C#5 - B4 - . .',
      bass: 'A2 . E3 . A2 . E3 . | B2 . F#3 . B2 . F#3 . | A2 . E3 . E2 . B2 . | D3 . A2 . E2 . . .',
      drums: 'k..h..s..h..k.h.',
    },
    boss: {      // urgent
      bpm: 168,
      lead: 'D4 D4 F4 D4 G#4 D4 F4 E4 | D4 D4 F4 D4 A4 G#4 F4 E4 | C4 C4 E4 C4 G4 C4 E4 D4 | B3 B3 D4 B3 F4 - E4 -',
      bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | B1 B2 B1 B2 E2 E3 E2 E3',
      drums: 'k.s.k.s.kks.k.sh',
    },
  };

  // ---------- player (browser only) ----------
  let cur = null, name = null, step = 0, next = 0, bus = null;
  const span = (line, i) => { let n = 1; while (line[(i + n) % line.length] === '-' && n < line.length) n++; return n; };
  function voice(a, type, freq, t0, dur, vol) {
    const o = a.ac.createOscillator(), g = a.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.01, dur - 0.04)); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(bus); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function drum(a, kind, t0) {
    if (kind === 'k') {
      const o = a.ac.createOscillator(), g = a.ac.createGain();
      o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
      g.gain.setValueAtTime(0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(g).connect(bus); o.start(t0); o.stop(t0 + 0.16); return;
    }
    const s = a.ac.createBufferSource(), f = a.ac.createBiquadFilter(), g = a.ac.createGain();
    s.buffer = a.noise; f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
    const len = kind === 's' ? 0.1 : 0.035, vol = kind === 's' ? 0.14 : 0.05;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    s.connect(f).connect(g).connect(bus); s.start(t0); s.stop(t0 + len + 0.01);
  }
  CD.music = {
    play(tuneName) {
      if (name === tuneName && cur) return;
      const a = CD.sfx && CD.sfx.audio(), tune = CD.TUNES[tuneName];
      if (!tune || !a) { cur = null; name = null; return; }
      name = tuneName;
      if (!bus) { bus = a.ac.createGain(); bus.gain.value = 0.5; bus.connect(a.master); }
      cur = { bpm: tune.bpm, lead: parse(tune.lead), bass: parse(tune.bass), drums: tune.drums.replace(/ /g, '') };
      step = 0; next = a.ac.currentTime + 0.06;
    },
    stop() { cur = null; name = null; },
    get playing() { return name; },
    update() {
      const a = CD.sfx && CD.sfx.audio();
      if (!cur || !a) return;
      const dt = 60 / cur.bpm / 2;
      if (next < a.ac.currentTime - 0.5) next = a.ac.currentTime + 0.02;   // the tab was asleep: don't burst
      while (next < a.ac.currentTime + 0.15) {
        const L = cur.lead, B = cur.bass, D = cur.drums, l = L[step % L.length], b = B[step % B.length], d = D[step % D.length];
        if (typeof l === 'number') voice(a, 'square', l, next, dt * span(L, step % L.length) * 0.92, 0.045);
        if (typeof b === 'number') voice(a, 'triangle', b, next, dt * span(B, step % B.length) * 0.95, 0.15);
        if (d !== '.') drum(a, d, next);
        step++; next += dt;
      }
    },
  };
})();
