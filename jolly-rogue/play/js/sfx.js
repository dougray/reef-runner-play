// Synthesized sound effects (Web Audio). Nothing to download.
(() => {
  const JR = window.JR;
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('jr.mute') === '1'; } catch (e) {}

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(freq, dur, type = 'square', vol = 0.15, slideTo = null, delay = 0) {
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, type, freq, freqTo = null) {
    const t0 = ac.currentTime;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0); s.stop(t0 + dur);
  }

  const SOUNDS = {
    shot() { noise(0.12, 0.35, 'lowpass', 2200, 400); tone(140, 0.08, 'triangle', 0.25, 50); },
    musket() { noise(0.22, 0.22, 'lowpass', 1100, 200); tone(90, 0.12, 'triangle', 0.18, 40); },
    slash() { noise(0.1, 0.25, 'bandpass', 1500, 5000); },
    hit() { tone(320, 0.06, 'square', 0.08, 160); },
    kill() { tone(420, 0.16, 'square', 0.09, 90); noise(0.12, 0.12, 'lowpass', 900); },
    coin() { tone(988, 0.05, 'square', 0.07); tone(1319, 0.12, 'square', 0.07, null, 0.05); },
    life() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.08, null, i * 0.08)); },
    heal() { tone(600, 0.18, 'sine', 0.15, 980); },
    jump() { tone(280, 0.1, 'square', 0.05, 560); },
    land() { noise(0.05, 0.08, 'lowpass', 500); },
    boom() { noise(0.5, 0.5, 'lowpass', 900, 80); tone(80, 0.3, 'sine', 0.35, 30); },
    cannon() { noise(0.35, 0.4, 'lowpass', 700, 100); tone(60, 0.25, 'sine', 0.3, 30); },
    throw() { tone(500, 0.12, 'triangle', 0.06, 900); },
    gun() { [523, 784, 1047].forEach((f, i) => tone(f, 0.08, 'square', 0.08, null, i * 0.06)); },
    thud() { noise(0.06, 0.18, 'lowpass', 400); },
    break() { noise(0.18, 0.3, 'bandpass', 900, 300); tone(150, 0.1, 'square', 0.06, 70); },
    bossIn() { [147, 139, 131, 98].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.12, null, i * 0.22)); },
    bossDown() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.16, 'square', 0.1, null, i * 0.1)); noise(0.8, 0.3, 'lowpass', 600, 80); },
    pound() { noise(0.3, 0.45, 'lowpass', 400, 60); tone(55, 0.3, 'sine', 0.4, 30); },
    lunge() { noise(0.2, 0.2, 'bandpass', 800, 3000); },
    whistle() { tone(1400, 0.15, 'sine', 0.08, 1900); tone(1900, 0.25, 'sine', 0.08, 1300, 0.15); },
    squawk() { tone(1300, 0.07, 'square', 0.06, 900); tone(1500, 0.09, 'square', 0.06, 1000, 0.09); },
    area() { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, null, i * 0.12)); },
    hurt() { tone(220, 0.25, 'sawtooth', 0.12, 70); },
    lifeLost() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, 'triangle', 0.15, null, i * 0.12)); },
    start() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.1, 'square', 0.07, null, i * 0.07)); },
    gameover() { [330, 311, 294, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, null, i * 0.25)); },
  };

  JR.sfx = {
    // For the music player: the shared context, master volume (muting lives there) and noise.
    audio() { return ac ? { ac, master, noise: noiseBuf } : null; },
    unlock() { if (ensure() && ac.state === 'suspended') ac.resume(); },
    play(name) {
      if (muted || !SOUNDS[name] || !ensure()) return;
      SOUNDS[name]();
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('jr.mute', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
})();
