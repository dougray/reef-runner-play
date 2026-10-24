// Synthesized sound effects (Web Audio). Nothing to download.
(() => {
  const CD = window.CD;
  let ac = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('cd.mute') === '1'; } catch (e) {}

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.45; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function tone(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
    const t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, type, freq, freqTo = null) {
    const t0 = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t0);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  const SOUNDS = {
    shot: () => noise(0.08, 0.08, 'lowpass', 900, 300),
    hit: () => tone(520, 0.05, 'square', 0.05, 300),
    kill: () => { noise(0.35, 0.22, 'lowpass', 1200, 120); tone(140, 0.25, 'triangle', 0.15, 50); },
    hurt: () => { tone(220, 0.25, 'sawtooth', 0.12, 80); noise(0.2, 0.15, 'bandpass', 600); },
    lifeLost: () => tone(330, 0.6, 'triangle', 0.18, 90),
    blast: () => { noise(0.6, 0.3, 'lowpass', 900, 80); tone(90, 0.4, 'triangle', 0.2, 40); },
    thunder: () => noise(0.9, 0.35, 'lowpass', 600, 60),
    broadside: () => noise(0.18, 0.12, 'lowpass', 500, 150),
    harpoon: () => tone(700, 0.08, 'sawtooth', 0.05, 300),
    rocket: () => noise(0.25, 0.08, 'bandpass', 2400, 600),
    pickup: () => { tone(660, 0.07, 'square', 0.07); setTimeout(() => ac && tone(990, 0.1, 'square', 0.07), 70); },
    bossIn: () => { tone(110, 0.8, 'sawtooth', 0.12, 70); tone(165, 0.8, 'sawtooth', 0.08, 105); },
    bossDown: () => { noise(1.2, 0.35, 'lowpass', 1400, 60); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ac && tone(f, 0.25, 'square', 0.08), 300 + i * 120)); },
    tell: () => tone(880, 0.12, 'square', 0.05),
    sweep: () => noise(0.5, 0.2, 'bandpass', 400, 1800),
    zap: () => tone(1200, 0.25, 'sawtooth', 0.06, 200),
    ram: () => { noise(0.3, 0.3, 'lowpass', 700, 100); tone(70, 0.3, 'triangle', 0.2); },
    extraLife: () => [523, 659, 784].forEach((f, i) => setTimeout(() => ac && tone(f, 0.15, 'square', 0.08), i * 90)),
    coin: () => { tone(988, 0.06, 'square', 0.07); setTimeout(() => ac && tone(1318, 0.12, 'square', 0.07), 60); },
  };
  // The mute button shows (and tells a screen reader) whether sound is off.
  function showMute() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('muted', muted);
    const b = document.getElementById('btn-mute');
    if (b) { b.setAttribute('aria-pressed', String(muted)); b.textContent = muted ? '\u2715' : '\u266a'; }
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', showMute);
  CD.sfx = {
    unlock() { if (ensure() && ac.state === 'suspended') ac.resume(); },
    play(name) { if (!ac || muted || !SOUNDS[name]) return; SOUNDS[name](); },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('cd.mute', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.45;
      showMute();
    },
    get muted() { return muted; },
    // For the music player: null until the first tap or key unlocks audio.
    audio: () => (ac ? { ac, master, noise: noiseBuf } : null),
  };
})();
