// Goofy sound effects synthesized with Web Audio, so there are no audio files to ship.
window.Sfx = (() => {
  'use strict';
  let ac = null;
  let muted = false;

  function audio() {
    if (!ac) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ac = new A();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(f1, f2, dur, type, vol, delay = 0) {
    const a = audio();
    if (!a || muted) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function noise(dur, vol, cutoff, delay = 0) {
    const a = audio();
    if (!a || muted) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource();
    const lp = a.createBiquadFilter();
    const g = a.createGain();
    src.buffer = buf;
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    g.gain.value = vol;
    src.connect(lp).connect(g).connect(a.destination);
    src.start(a.currentTime + delay);
  }

  return {
    unlock: audio,
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    flap() { tone(280, 520, 0.12, 'triangle', 0.14); noise(0.08, 0.08, 2500); },
    point() { tone(880, 880, 0.07, 'square', 0.05); tone(1320, 1320, 0.1, 'square', 0.05, 0.07); },
    cannon() { noise(0.35, 0.5, 700); tone(120, 40, 0.3, 'sine', 0.35); },
    enemyCannon() { noise(0.3, 0.3, 450); tone(90, 35, 0.3, 'sine', 0.22); },
    thud() { noise(0.2, 0.35, 900); tone(160, 70, 0.18, 'square', 0.07); },
    coin() { tone(988, 988, 0.08, 'square', 0.05); tone(1319, 1319, 0.25, 'square', 0.05, 0.08); },
    pause() { tone(660, 440, 0.12, 'triangle', 0.08); },
    thunder() { noise(1.4, 0.5, 260); noise(0.35, 0.3, 1400); },
    horn() { tone(110, 104, 0.9, 'sawtooth', 0.1); tone(82, 80, 1.1, 'sawtooth', 0.08, 0.1); },
    rum() { tone(220, 520, 0.2, 'triangle', 0.12); tone(330, 780, 0.2, 'triangle', 0.1, 0.12); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'square', 0.06, i * 0.13)); },
    poof() { noise(0.12, 0.15, 1600); },
    sink() { noise(0.4, 0.4, 1100); tone(300, 60, 0.5, 'sawtooth', 0.1); noise(0.7, 0.25, 2600, 0.25); },
    crash() { noise(0.45, 0.45, 900); tone(170, 45, 0.45, 'sawtooth', 0.18); },
  };
})();
