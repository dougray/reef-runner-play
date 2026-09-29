// Sound: goofy effects synthesized with Web Audio (no files), plus one looping music track,
// "Australis Frontier [REMIX]" by celestialghost8 (CC0, opengameart.org/content/cc0-scraps).
window.Sfx = (() => {
  'use strict';
  const MUSIC_URL = 'assets/music/australis-frontier-remix.m4a';
  const MUSIC_VOLUME = 0.3;
  let ac = null;
  let master = null;                 // everything plays through here, so mute is one switch
  let musicGain = null;
  let musicBuf = null, musicSrc = null, musicWanted = false, loop = null, rate = 1;
  let muted = false;
  try { muted = localStorage.getItem('reefrunner.muted') === '1'; } catch { /* private mode */ }

  // iPhones: Web Audio normally obeys the ring/silent switch, so a phone on silent plays
  // nothing (a video still would). Ask for the "playback" audio session like a video does;
  // older iOS without navigator.audioSession gets the same effect from a silent looping
  // <audio> element.
  let session = false;
  function playbackSession() {
    if (session) return;
    session = true;
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
    } catch { /* not allowed */ }
    try {
      const sr = 8000, n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
      v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
      const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.play().catch(() => { session = false; });   // retry on the next gesture
    } catch { /* no fallback available */ }
  }

  function audio() {
    playbackSession();
    if (!ac) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ac = new A();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ac.destination);
      musicGain = ac.createGain();
      musicGain.gain.value = MUSIC_VOLUME;
      musicGain.connect(master);
      loadMusic();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function loadMusic() {
    fetch(MUSIC_URL)
      .then(r => r.arrayBuffer())
      .then(bytes => new Promise((ok, fail) => ac.decodeAudioData(bytes, ok, fail)))
      .then(buf => { musicBuf = buf; loop = loopPoints(buf); if (musicWanted) playMusic(); })
      .catch(() => { /* no music (e.g. index.html opened as a file); effects still work */ });
  }

  // The track fades out at the end: loop between the first and last audible samples so
  // the restart has no dead air.
  function loopPoints(buf) {
    const d = buf.getChannelData(0);
    let a = 0, b = d.length - 1;
    while (a < b && Math.abs(d[a]) < 0.004) a++;
    while (b > a && Math.abs(d[b]) < 0.004) b--;
    return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
  }

  function playMusic() {
    if (!musicBuf || musicSrc) return;
    musicSrc = ac.createBufferSource();
    musicSrc.buffer = musicBuf;
    musicSrc.loop = true;
    musicSrc.playbackRate.value = rate;
    [musicSrc.loopStart, musicSrc.loopEnd] = loop;
    musicSrc.connect(musicGain);
    musicSrc.start(0, loop[0]);
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
    o.connect(g).connect(master);
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
    src.connect(lp).connect(g).connect(master);
    src.start(a.currentTime + delay);
  }

  // Safari only unlocks audio on gestures that complete (touchend / pointerup / click / key),
  // not on pointerdown, which is what the game listens to. Wake audio on those too, from
  // the very first tap (including the one that skips the splash screen).
  const wake = () => { if (audio()) { musicWanted = true; playMusic(); } };
  for (const type of ['touchend', 'pointerup', 'click', 'keyup']) {
    window.addEventListener(type, wake, { capture: true, passive: true });
  }

  return {
    // Called on every tap/key: wakes audio (browsers need a gesture) and starts the music.
    unlock() { if (audio()) { musicWanted = true; playMusic(); } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.02);
      try { localStorage.setItem('reefrunner.muted', muted ? '1' : '0'); } catch { /* private mode */ }
      return muted;
    },
    get muted() { return muted; },
    get musicPlaying() { return !!musicSrc; },   // for tests
    // Music fades right down while the game is paused.
    duck(on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.04 : MUSIC_VOLUME, ac.currentTime, 0.15); },
    // Storms and the man-o'-war push the tempo up a little.
    tempo(r) { rate = r; if (musicSrc) musicSrc.playbackRate.setTargetAtTime(r, ac.currentTime, 0.5); },
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
