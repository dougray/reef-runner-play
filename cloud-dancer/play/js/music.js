// Music: original tunes, one for the harbour (menus), one per area and a boss theme. Each tune is
// a few 4-bar parts strung into a form, so it runs 40+ seconds before it repeats, and each has a
// quiet part where the lead mostly rests. Three soft synth voices (a triangle lead with a little
// vibrato, a triangle bass, light noise drums) go through a gentle low-pass filter and are
// scheduled ahead on the audio clock. Each step is an 8th note; '-' holds, '.' rests, '|' is only a
// bar line for reading. Drum patterns repeat within their part.
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
  // The whole form as flat step lists: lead and bass notes, and one drum letter per step.
  CD.tuneSteps = tune => {
    const out = { lead: [], bass: [], drums: '' };
    for (const p of tune.form.split(' ')) {
      const part = tune.parts[p], lead = parse(part.lead), bass = parse(part.bass), d = part.drums.replace(/ /g, '');
      out.lead.push(...lead); out.bass.push(...bass);
      for (let i = 0; i < lead.length; i++) out.drums += d[i % d.length];
    }
    return out;
  };

  CD.TUNES = {
    harbour: {   // a lilting sea shanty in the hangar
      bpm: 100,
      form: 'A B A C A',
      parts: {
        A: {
          lead: 'A4 - - F#4 A4 - D5 - | B4 - - G4 B4 - D5 - | C#5 - B4 A4 G4 - E4 - | D4 - - - . . . .',
          bass: 'D3 . . . A2 . . . | G2 . . . D3 . . . | A2 . . . E2 . . . | D3 . . . A2 . . .',
          drums: 'k.......s.......',
        },
        B: {
          lead: 'F#5 - E5 D5 E5 - F#5 - | D5 - - B4 . . . . | A4 - B4 D5 F#5 - E5 D5 | E5 - - - . . . .',
          bass: 'B2 . . . F#2 . . . | G2 . . . D3 . . . | D3 . . . A2 . . . | A2 . . . E2 . C#3 .',
          drums: 'k.......s.......',
        },
        C: {     // the quiet part
          lead: 'D5 - - - . . . . | . . . . . . . . | B4 - - - . . . . | A4 - - - . . . .',
          bass: 'D3 . . . A2 . . . | G2 . . . D3 . . . | G2 . . . D3 . . . | A2 . . . E2 . . .',
          drums: 'k...............',
        },
      },
    },
    reef: {      // bright and breezy over the islands
      bpm: 132,
      form: 'A A2 B C B A2',
      parts: {
        A: {
          lead: 'G4 - B4 D5 - B4 D5 - | E5 - D5 B4 G4 - B4 - | C5 - E5 G5 - E5 C5 - | D5 - - - A4 - - -',
          bass: 'G2 . D3 . G2 . D3 . | E2 . B2 . E2 . B2 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . F#2 .',
          drums: 'k...s...k.k.s...',
        },
        A2: {
          lead: 'G4 - B4 D5 - B4 D5 - | E5 - G5 E5 D5 - B4 - | C5 - E5 D5 C5 - A4 - | G4 - - - . . . .',
          bass: 'G2 . D3 . G2 . D3 . | E2 . B2 . E2 . B2 . | A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D2 .',
          drums: 'k...s...k.k.s...',
        },
        B: {
          lead: 'E5 - - D5 C5 - - - | D5 - - C5 B4 - - - | D5 - - C5 B4 - A4 - | B4 - - - G4 - - -',
          bass: 'C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | B2 . F#2 . B2 . F#2 . | E2 . B2 . E2 . B2 .',
          drums: 'k.h.s.h.k.h.s.h.',
        },
        C: {     // the quiet part
          lead: 'B5 - - - . . . . | A5 - - - . . . . | G5 - - - . . . . | F#5 - - - . . . .',
          bass: 'C3 . . . G2 . . . | D3 . . . A2 . . . | E3 . . . B2 . . . | D3 . . . A2 . . .',
          drums: 'k.......k.......',
        },
      },
    },
    storm: {     // minor and driving under the lightning
      bpm: 140,
      form: 'A A2 B C A2 B',
      parts: {
        A: {
          lead: 'E4 - G4 B4 - G4 B4 E5 | - - D5 C5 - - G4 - | A4 - C5 E5 - D5 C5 - | B4 - - - D#5 - - -',
          bass: 'E2 . E3 . E2 . E3 . | C2 . C3 . C2 . C3 . | A1 . A2 . A1 . A2 . | B1 . B2 . B1 . B2 .',
          drums: 'k...s...k.k.s...',
        },
        A2: {
          lead: 'E4 - G4 B4 - G4 B4 E5 | - - F#5 G5 - - E5 - | C5 - B4 A4 - B4 C5 - | B4 - - - E4 - - -',
          bass: 'E2 . E3 . E2 . E3 . | C2 . C3 . C2 . C3 . | A1 . A2 . A1 . A2 . | B1 . B2 . E2 . . .',
          drums: 'k...s...k.k.s...',
        },
        B: {
          lead: 'D5 - - B4 G4 - B4 D5 | F#5 - - - D5 - A4 - | G4 - B4 E5 - D5 B4 G4 | F#4 - A4 - B4 - - -',
          bass: 'G2 . D3 . G2 . D3 . | D2 . A2 . D2 . A2 . | E2 . B2 . E2 . B2 . | B1 . F#2 . B1 . . .',
          drums: 'k.h.s.h.k.h.s.h.',
        },
        C: {     // the quiet part: thunder rolling
          lead: '. . . . . . . . | . . . . . . . . | E5 - - - D5 - - - | B4 - - - . . . .',
          bass: 'E2 . . . . . . . | E2 . . . B1 . . . | C2 . . . . . . . | B1 . . . . . . .',
          drums: 'k.......k...k...',
        },
      },
    },
    forts: {     // a stately march past the floating forts
      bpm: 116,
      form: 'A A2 B C A2',
      parts: {
        A: {
          lead: 'C5 - - G4 C5 - E5 - | D5 - - B4 G4 - - - | A4 - C5 - F5 - E5 D5 | D5 - - - . . . .',
          bass: 'C3 . G2 . C3 . G2 . | G2 . D3 . G2 . D3 . | A2 . E3 . F2 . C3 . | G2 . D3 . G2 . B2 .',
          drums: 's.s.k...s.s.k...',
        },
        A2: {
          lead: 'C5 - - G4 C5 - E5 - | D5 - - B4 G4 - - - | A4 - C5 - F5 - D5 B4 | C5 - - - . . . .',
          bass: 'C3 . G2 . C3 . G2 . | G2 . D3 . G2 . D3 . | A2 . E3 . F2 . G2 . | C3 . G2 . C3 . . .',
          drums: 's.s.k...s.s.k...',
        },
        B: {
          lead: 'A4 - - - C5 - F5 - | E5 - - - C5 - G4 - | F4 - A4 - D5 - B4 - | C5 - - - G4 - - -',
          bass: 'F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | D3 . A2 . G2 . D3 . | C3 . G2 . C3 . G2 .',
          drums: 'k...s...k...s...',
        },
        C: {     // the quiet part: just the march
          lead: '. . . . . . . . | G5 - - - E5 - - - | . . . . . . . . | D5 - - - B4 - - -',
          bass: 'C3 . . . G2 . . . | C3 . . . G2 . . . | G2 . . . D3 . . . | G2 . . . D3 . . .',
          drums: 's.s.k...s.s.k...',
        },
      },
    },
    ceiling: {   // high and airy, the top of the sky
      bpm: 120,
      form: 'A B A2 C B A2',
      parts: {
        A: {
          lead: 'E5 - - C#5 E5 - A5 - | F#5 - - - C#5 - - - | D5 - F#5 - A5 - F#5 - | E5 - - - - - . .',
          bass: 'A2 . E3 . A2 . E3 . | F#2 . C#3 . F#2 . C#3 . | D3 . A2 . D3 . A2 . | E2 . B2 . E2 . B2 .',
          drums: 'k.......s.......',
        },
        A2: {
          lead: 'E5 - - C#5 E5 - A5 - | F#5 - - - C#5 - - - | D5 - F#5 - A5 - G#5 - | A5 - - - . . . .',
          bass: 'A2 . E3 . A2 . E3 . | F#2 . C#3 . F#2 . C#3 . | D3 . A2 . E2 . B2 . | A2 . E3 . A2 . . .',
          drums: 'k.......s.......',
        },
        B: {
          lead: 'F#5 - A5 - F#5 - D5 - | E5 - - - C#5 - A4 - | B4 - D5 - F#5 - E5 D5 | C#5 - - - B4 - - -',
          bass: 'D3 . A2 . D3 . A2 . | A2 . E3 . A2 . E3 . | B2 . F#2 . B2 . F#2 . | E2 . B2 . E2 . B2 .',
          drums: 'k...h...s...h...',
        },
        C: {     // the quiet part
          lead: 'A5 - - - - - - - | . . . . . . . . | G#5 - - - - - - - | . . . . . . . .',
          bass: 'A2 . . . E3 . . . | A2 . . . E3 . . . | E2 . . . B2 . . . | E2 . . . B2 . . .',
          drums: 'k...............',
        },
      },
    },
    boss: {      // urgent, but not shrill
      bpm: 156,
      form: 'A A2 B C A A2 B',
      parts: {
        A: {
          lead: 'D5 - A4 - D5 E5 F5 - | D5 - Bb4 - F4 - Bb4 - | C5 - G4 - C5 D5 E5 - | C#5 - A4 - E5 - - -',
          bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C3 C2 C3 C2 C3 C2 C3 | A1 A2 A1 A2 A1 A2 A1 A2',
          drums: 'k...s...k.k.s...',
        },
        A2: {
          lead: 'D5 - A4 - D5 E5 F5 - | D5 - Bb4 - F4 - Bb4 - | C5 - G4 - C5 D5 E5 - | D5 - - - . . . .',
          bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 . . .',
          drums: 'k...s...k.k.s...',
        },
        B: {
          lead: 'G4 - Bb4 - D5 - G5 - | F5 - E5 - D5 - A4 - | Bb4 - D5 - G5 - F5 - | E5 - - - C#5 - - -',
          bass: 'G1 G2 G1 G2 G1 G2 G1 G2 | D2 D3 D2 D3 D2 D3 D2 D3 | G1 G2 G1 G2 G1 G2 G1 G2 | A1 A2 A1 A2 A1 A2 A1 A2',
          drums: 'k.h.s.h.k.h.s.h.',
        },
        C: {     // the quiet part: the boss winds up
          lead: '. . . . . . . . | . . . . . . . . | . . . . . . . . | A4 - - - C#5 - - -',
          bass: 'D2 . D2 . D2 . D2 . | D2 . D2 . D2 . D2 . | Bb1 . Bb1 . Bb1 . Bb1 . | A1 . A1 . A1 . A1 .',
          drums: 'k...k...k...k.s.',
        },
      },
    },
  };

  // ---------- player (browser only) ----------
  let cur = null, name = null, step = 0, next = 0, bus = null;
  const span = (line, i) => { let n = 1; while (line[(i + n) % line.length] === '-' && n < line.length) n++; return n; };
  // A soft note: quick fade in, eases down to a sustain, fades out. Long notes get a little vibrato.
  function voice(a, type, freq, t0, dur, vol, vibrato) {
    const o = a.ac.createOscillator(), g = a.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (vibrato && dur > 0.35) {
      const lfo = a.ac.createOscillator(), depth = a.ac.createGain();
      lfo.frequency.value = 5; depth.gain.setValueAtTime(0, t0); depth.gain.linearRampToValueAtTime(freq * 0.006, t0 + 0.3);
      lfo.connect(depth).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.02);
    }
    const end = t0 + Math.max(0.03, dur - 0.05);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.linearRampToValueAtTime(vol * 0.7, Math.min(end, t0 + 0.18));
    g.gain.setValueAtTime(vol * 0.7, end); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(bus); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function drum(a, kind, t0) {
    if (kind === 'k') {
      const o = a.ac.createOscillator(), g = a.ac.createGain();
      o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
      g.gain.setValueAtTime(0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(g).connect(bus); o.start(t0); o.stop(t0 + 0.16); return;
    }
    const s = a.ac.createBufferSource(), f = a.ac.createBiquadFilter(), g = a.ac.createGain();
    s.buffer = a.noise; f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1400 : 6000;
    const len = kind === 's' ? 0.09 : 0.03, vol = kind === 's' ? 0.06 : 0.018;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    s.connect(f).connect(g).connect(bus); s.start(t0); s.stop(t0 + len + 0.01);
  }
  CD.music = {
    play(tuneName) {
      if (name === tuneName && cur) return;
      const a = CD.sfx && CD.sfx.audio(), tune = CD.TUNES[tuneName];
      if (!tune || !a) { cur = null; name = null; return; }
      name = tuneName;
      if (!bus) {   // everything through a gentle low-pass, so nothing is shrill
        const lp = a.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
        bus = a.ac.createGain(); bus.gain.value = 0.38; bus.connect(lp).connect(a.master);
      }
      cur = { bpm: tune.bpm, ...CD.tuneSteps(tune) };
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
        if (typeof l === 'number') voice(a, 'triangle', l, next, dt * span(L, step % L.length) * 0.92, 0.11, true);
        if (typeof b === 'number') voice(a, 'triangle', b, next, dt * span(B, step % B.length) * 0.95, 0.13);
        if (d !== '.') drum(a, d, next);
        step++; next += dt;
      }
    },
  };
})();
