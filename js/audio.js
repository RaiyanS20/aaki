// Tiny chiptune engine: background loop, sound effects, and the birthday song.
const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false, timer = null, track = null;
  const voices = [];

  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(n) {
    if (typeof n === 'number') return n;
    const m = /^([A-G]#?)(\d)$/.exec(n);
    const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  }

  function tone(f, start, dur, { type = 'square', vol = 0.2, out = sfxGain, slideTo = null, attack = 0.005, release = 0.08 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq(f), start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(freq(slideTo), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.setValueAtTime(vol, start + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(out);
    o.start(start); o.stop(start + dur + 0.02);
  }

  const SFX = {
    blip() { tone(988, ctx.currentTime, 0.03, { vol: 0.05 }); },
    select() { const t = ctx.currentTime; tone('E6', t, 0.06, { vol: 0.12 }); tone('A6', t + 0.06, 0.08, { vol: 0.12 }); },
    meow() {
      const t = ctx.currentTime;
      tone(620, t, 0.14, { type: 'triangle', vol: 0.25, slideTo: 1100 });
      tone(1100, t + 0.14, 0.22, { type: 'triangle', vol: 0.25, slideTo: 560 });
    },
    chime() {
      const t = ctx.currentTime;
      ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(n, t + i * 0.09, 0.4, { type: 'triangle', vol: 0.18 }));
    },
    unroll() { const t = ctx.currentTime; tone(300, t, 0.25, { type: 'sawtooth', vol: 0.04, slideTo: 900 }); },
    bump() { tone(140, ctx.currentTime, 0.08, { vol: 0.08 }); },
    fanfare() {
      const t = ctx.currentTime;
      const seq = [['G5', 0.12], ['C6', 0.12], ['E6', 0.12], ['G6', 0.12], ['E6', 0.12], ['G6', 0.7]];
      let at = t;
      seq.forEach(([n, d]) => { tone(n, at, d + 0.05, { vol: 0.16 }); tone(freq(n) / 2, at, d + 0.05, { type: 'triangle', vol: 0.18 }); at += d; });
    },
    sparkle() {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) tone(1400 + Math.random() * 1600, t + i * 0.05, 0.08, { type: 'sine', vol: 0.06 });
    },
  };

  // Tracks: lists of [note | null(rest), beats]
  const TRACKS = {
    valley: {
      bpm: 96,
      parts: [
        { type: 'square', vol: 0.09, notes: [
          ['E5', 1], ['G5', 1], ['A5', 1], ['G5', 1], ['E5', 1], ['D5', 1], ['C5', 2],
          ['D5', 1], ['E5', 1], ['G5', 1], ['E5', 1], ['D5', 2], [null, 2],
          ['E5', 1], ['G5', 1], ['A5', 1], ['C6', 1], ['A5', 1], ['G5', 1], ['E5', 2],
          ['D5', 1], ['E5', 1], ['D5', 1], ['C5', 1], ['C5', 3], [null, 1],
        ] },
        { type: 'triangle', vol: 0.22, notes: [
          ['C3', 4], ['A2', 4], ['F2', 4], ['G2', 4], ['C3', 4], ['A2', 4], ['F2', 2], ['G2', 2], ['C3', 4],
        ] },
        { type: 'triangle', vol: 0.06, notes: [
          ['G4', 1], ['C5', 1], ['E5', 1], ['C5', 1], ['E4', 1], ['A4', 1], ['C5', 1], ['A4', 1],
          ['F4', 1], ['A4', 1], ['C5', 1], ['A4', 1], ['G4', 1], ['B4', 1], ['D5', 1], ['B4', 1],
          ['G4', 1], ['C5', 1], ['E5', 1], ['C5', 1], ['E4', 1], ['A4', 1], ['C5', 1], ['A4', 1],
          ['F4', 1], ['A4', 1], ['G4', 1], ['B4', 1], ['G4', 1], ['C5', 1], ['E5', 1], ['C5', 1],
        ] },
      ],
    },
    night: {
      bpm: 72,
      parts: [
        { type: 'triangle', vol: 0.14, notes: [
          ['E5', 2], ['D5', 1], ['C5', 1], ['D5', 2], ['G4', 2],
          ['A4', 2], ['C5', 1], ['D5', 1], ['E5', 4],
          ['G5', 2], ['E5', 1], ['D5', 1], ['C5', 2], ['A4', 2],
          ['C5', 2], ['D5', 1], ['B4', 1], ['C5', 4],
        ] },
        { type: 'sine', vol: 0.2, notes: [['C3', 4], ['G2', 4], ['A2', 4], ['E2', 4], ['F2', 4], ['C3', 4], ['F2', 4], ['G2', 4]] },
      ],
    },
    birthday: {
      bpm: 110, once: true,
      parts: [
        { type: 'square', vol: 0.12, notes: [
          ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
          ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
          ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
          ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3],
        ] },
        { type: 'triangle', vol: 0.22, notes: [
          [null, 1], ['C3', 3], ['G2', 3],
          ['G2', 3], ['C3', 3],
          ['C3', 3], ['F2', 3], ['F2', 2],
          ['C3', 2], ['G2', 2], ['C3', 3],
        ] },
      ],
    },
  };

  function schedule() {
    if (!track || !ctx) return;
    const spb = 60 / track.def.bpm;
    const horizon = ctx.currentTime + 0.25;
    let alive = false;
    track.state.forEach((st, i) => {
      const part = track.def.parts[i];
      while (st.time < horizon) {
        if (st.idx >= part.notes.length) {
          if (track.def.once) { st.done = true; break; }
          st.idx = 0;
        }
        const [n, beats] = part.notes[st.idx++];
        const d = beats * spb;
        if (n) tone(n, st.time, d * 0.92, { type: part.type, vol: part.vol, out: musicGain, release: Math.min(0.15, d * 0.4) });
        st.time += d;
      }
      if (!st.done) alive = true;
    });
    if (!alive) {
      const after = track.after;
      track = null;
      if (after) setTimeout(after, 800);
    }
  }

  function play(name, after) {
    if (!ctx) return;
    if (track && track.name === name && !TRACKS[name].once) return;
    const start = ctx.currentTime + 0.1;
    track = { name, def: TRACKS[name], after, state: TRACKS[name].parts.map(() => ({ idx: 0, time: start })) };
    if (!timer) timer = setInterval(schedule, 60);
  }

  return {
    init,
    play,
    stop() { track = null; },
    sfx(name) { if (ctx && SFX[name]) SFX[name](); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
      return muted;
    },
    get muted() { return muted; },
  };
})();
