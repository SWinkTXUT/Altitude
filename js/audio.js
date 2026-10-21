// Procedural upbeat music + voice, mixed into a single WAV file.
//
// Each session's instruments (pad chords with reverb, bass notes, arp notes with echoes,
// a riser) are synthesized once with Web Audio, then the full track is sequenced and mixed
// in plain JavaScript: far faster than scheduling thousands of nodes in an offline graph.

import { rng } from './script.js';

export const SR = 32000;
const DUCK = 0.32;
const MUSIC_GAIN = 0.62;
const LIMIT = 0.9;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- Drum kit (synthesized directly) ----------

function samples(seconds, fill) {
  const n = Math.ceil(seconds * SR);
  const d = new Float32Array(n);
  fill(d, n);
  return d;
}

export function makeKit() {
  const rand = rng(12345);
  const noise = () => rand() * 2 - 1;
  const kick = samples(0.45, (d, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = 46 + 120 * Math.exp(-t / 0.028);
      ph += (2 * Math.PI * f) / SR;
      const click = i < 40 ? noise() * 0.3 * (1 - i / 40) : 0;
      d[i] = Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t / 0.16)) * 0.95 + click;
    }
  });
  const clap = samples(0.4, (d, n) => {
    let hp = 0, prev = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let env = 0;
      for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / (o < 0.02 ? 0.006 : 0.09)));
      const x = noise();
      hp = 0.85 * (hp + x - prev); prev = x;
      lp += 0.45 * (hp - lp);
      d[i] = lp * env * 1.3;
    }
  });
  const hat = (decay, len) => samples(len, (d, n) => {
    let p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) {
      const x = noise();
      const h1 = x - p1; p1 = x;
      const h2 = h1 - p2; p2 = h1;
      d[i] = h2 * 0.35 * Math.exp(-(i / SR) / decay);
    }
  });
  return { kick, clap, hat: hat(0.018, 0.12), ohat: hat(0.09, 0.35) };
}

function impulse(seconds) {
  const rand = rng(777);
  const b = new AudioBuffer({ length: Math.ceil(seconds * SR), sampleRate: SR, numberOfChannels: 1 });
  const d = b.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < d.length; i++) {
    lp += 0.35 * (rand() * 2 - 1 - lp);
    d[i] = lp * Math.exp(-(i / SR) / 0.55);
  }
  return b;
}

// ---------- Per-session musical choices ----------

const PROGS = [
  [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']],
  [[0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']],
  [[8, 'M'], [10, 'M'], [0, 'm'], [0, 'm']],
  [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M']],
  [[0, 'm'], [3, 'M'], [10, 'M'], [5, 'm']],
  [[5, 'm'], [8, 'M'], [10, 'M'], [0, 'm']],
];
const ARPS = [
  [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3],
  [0, 2, 1, 3, 0, 2, 4, 3, 0, 2, 1, 3, 4, 2, 3, 1],
  [0, 0, 2, 0, 3, 0, 2, 0, 4, 0, 3, 0, 2, 0, 1, 0],
  [4, 3, 2, 0, 4, 3, 2, 1, 4, 3, 2, 0, 3, 2, 1, 0],
];
const ROOTS = [45, 46, 48, 50, 52, 53, 55];

export function musicPlan(seed) {
  const r = rng(seed * 7919 + 17);
  return {
    bpm: 118 + Math.floor(r() * 7),
    root: ROOTS[Math.floor(r() * ROOTS.length)],
    prog: PROGS[Math.floor(r() * PROGS.length)],
    arp: ARPS[Math.floor(r() * ARPS.length)],
    bass: ['offbeat', 'rolling', 'octave'][Math.floor(r() * 3)],
    lead: r() < 0.5 ? 'square' : 'triangle',
    padCut: 900 + r() * 900,
    swingHat: r() < 0.4,
  };
}

function chordTones(root, q) {
  return [root, root + (q === 'm' ? 3 : 4), root + 7];
}

// What gets played each bar, independent of how it is rendered.
function chordsFor(mp) {
  return mp.prog.map(([off, q]) => {
    const root = mp.root + off;
    const tones = chordTones(root + 12, q);
    return {
      root,
      pad: [...tones, tones[0] + 12],
      arp: [...chordTones(root + 24, q), root + 36, root + 24 + (q === 'm' ? 3 : 4) + 12],
    };
  });
}

// ---------- Instrument sample rendering (one small Web Audio graph per instrument) ----------

async function renderSlots(count, slot, build) {
  const ctx = new OfflineAudioContext(1, Math.ceil(count * slot * SR), SR);
  build(ctx);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  const n = Math.round(slot * SR);
  return Array.from({ length: count }, (_, k) => d.slice(k * n, (k + 1) * n));
}

async function makeInstruments(mp) {
  const beat = 60 / mp.bpm;
  const bar = beat * 4;
  const six = beat / 4;
  const chords = chordsFor(mp);

  const padSlot = bar + 3.2;
  const pads = renderSlots(chords.length, padSlot, (ctx) => {
    const rv = ctx.createConvolver();
    rv.buffer = impulse(2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    rv.connect(wet).connect(ctx.destination);
    chords.forEach((c, k) => {
      const t = k * padSlot;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = mp.padCut;
      const a = ctx.createGain();
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(0.05, t + 0.3);
      a.gain.setValueAtTime(0.05, t + bar);
      a.gain.linearRampToValueAtTime(0, t + bar + 0.45);
      f.connect(a);
      a.connect(ctx.destination);
      a.connect(rv);
      for (const m of c.pad) {
        for (const det of [-9, 9]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(m);
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(t + bar + 0.5);
        }
      }
    });
  });

  // Bass: each chord root and its octave, short (16th) and long (dotted quarter) notes.
  const bassNotes = [];
  for (const c of chords) for (const m of [c.root, c.root + 12]) for (const len of ['s', 'l']) {
    if (!bassNotes.some((b) => b.m === m && b.len === len)) bassNotes.push({ m, len });
  }
  const bassSlot = beat * 1.5 + 0.1;
  const bass = renderSlots(bassNotes.length, bassSlot, (ctx) => {
    bassNotes.forEach(({ m, len }, k) => {
      const t = k * bassSlot;
      const dur = len === 's' ? six * 1.6 : beat * 1.5;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = mtof(m - 12);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(2200, t);
      f.frequency.exponentialRampToValueAtTime(260, t + dur);
      const a = ctx.createGain();
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(0.22, t + 0.005);
      a.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const sg = ctx.createGain();
      sg.gain.value = 0.9;
      o.connect(f).connect(a);
      sub.connect(sg).connect(a);
      a.connect(ctx.destination);
      o.start(t); sub.start(t);
      o.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
    });
  });

  // Arp: every pitch used, with a dotted-eighth echo baked in.
  const arpPitches = [...new Set(chords.flatMap((c) => c.arp))];
  const arpSlot = 2.6;
  const arps = renderSlots(arpPitches.length, arpSlot, (ctx) => {
    const d = ctx.createDelay(2);
    d.delayTime.value = beat * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    d.connect(lp).connect(fb).connect(d);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    lp.connect(wet).connect(ctx.destination);
    arpPitches.forEach((m, k) => {
      const t = k * arpSlot;
      const o = ctx.createOscillator();
      o.type = mp.lead;
      o.frequency.value = mtof(m);
      const a = ctx.createGain();
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(0.06, t + 0.004);
      a.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(a);
      a.connect(ctx.destination);
      a.connect(d);
      o.start(t);
      o.stop(t + 0.2);
    });
  });

  // Riser: 4s of noise through a rising band-pass, used at the end of each hold.
  const riser = renderSlots(1, 4.3, (ctx) => {
    const rand = rng(99);
    const nb = new AudioBuffer({ length: 2 * SR, sampleRate: SR, numberOfChannels: 1 });
    nb.getChannelData(0).forEach((_, i, a) => (a[i] = rand() * 2 - 1));
    const s = ctx.createBufferSource();
    s.buffer = nb;
    s.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(500, 0);
    bp.frequency.exponentialRampToValueAtTime(6000, 4);
    const a = ctx.createGain();
    a.gain.setValueAtTime(0, 0);
    a.gain.linearRampToValueAtTime(0.12, 4);
    a.gain.linearRampToValueAtTime(0, 4.25);
    s.connect(bp).connect(a).connect(ctx.destination);
    s.start(0);
    s.stop(4.3);
  });

  const [padBufs, bassBufs, arpBufs, [riserBuf]] = await Promise.all([pads, bass, arps, riser]);
  const bassMap = {};
  bassNotes.forEach((b, k) => (bassMap[b.m + b.len] = bassBufs[k]));
  const arpMap = {};
  arpPitches.forEach((m, k) => (arpMap[m] = arpBufs[k]));
  return { chords, pads: padBufs, bass: bassMap, arp: arpMap, riser: riserBuf };
}

// ---------- Automation (piecewise-linear points read with a forward-only cursor) ----------

function cursor(points, def) {
  let k = 0;
  return (t) => {
    if (!points.length) return def;
    while (k < points.length - 1 && points[k + 1].t <= t) k++;
    const a = points[k], b = points[k + 1];
    if (!b || t <= a.t) return a.v;
    return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1e-6, b.t - a.t);
  };
}

function duckPoints(session, durations) {
  const iv = session.voice
    .map((v) => [v.t, v.t + (durations[v.key] || 0)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of iv) {
    const last = merged[merged.length - 1];
    if (last && s - last[1] < 0.8) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const pts = [{ t: 0, v: 1 }];
  for (const [s, e] of merged) {
    pts.push({ t: Math.max(0, s - 0.12), v: 1 }, { t: s, v: DUCK }, { t: e, v: DUCK }, { t: e + 0.5, v: 1 });
  }
  return pts;
}

function filterPoints(session) {
  const OPEN = 14000;
  const pts = [{ t: 0, v: OPEN }];
  for (const h of session.holds) {
    pts.push({ t: h.start, v: OPEN }, { t: h.start + 0.8, v: 2500 }, { t: h.start + 2, v: 750 }, { t: h.end - 0.2, v: 950 }, { t: h.end + 0.6, v: OPEN });
  }
  return pts;
}

function energyAt(points, t) {
  let lvl = 0;
  for (const p of points) if (p.t <= t + 0.01) lvl = p.level; else break;
  return lvl;
}

// ---------- Mixing ----------

function add(out, src, at, gain) {
  const s0 = Math.round(at * SR);
  const n = Math.min(src.length, out.length - s0);
  for (let i = Math.max(0, -s0); i < n; i++) out[s0 + i] += src[i] * gain;
}

function sequence(out, mp, inst, kit, session) {
  const beat = 60 / mp.bpm;
  const bar = beat * 4;
  const six = beat / 4;
  const end = session.duration;
  const bars = Math.ceil(end / bar);
  for (let b = 0; b < bars; b++) {
    const bt = b * bar;
    const lvl = energyAt(session.energy, bt);
    if (lvl < 0) continue;
    const ci = b % 4;
    const c = inst.chords[ci];
    const fill = b % 8 === 7 && lvl >= 2;
    add(out, inst.pads[ci], bt, lvl >= 2 ? 1 : 0.8);
    for (let s = 0; s < 16; s++) {
      const t = bt + s * six + (mp.swingHat && s % 2 === 1 ? six * 0.12 : 0);
      if (t >= end) break;
      const onBeat = s % 4 === 0;
      const offBeat = s % 4 === 2;
      if (lvl >= 1) {
        if (onBeat && !(fill && s === 12)) add(out, kit.kick, t, lvl >= 2 ? 0.9 : 0.6);
        if (offBeat) add(out, kit.hat, t, lvl >= 2 ? 0.55 : 0.4);
        if (lvl >= 2 && !onBeat && !offBeat) add(out, kit.hat, t, 0.22);
        if (lvl >= 3 && s % 8 === 6) add(out, kit.ohat, t, 0.3);
      }
      if (lvl >= 2) {
        if (s === 4 || s === 12) add(out, kit.clap, t, 0.55);
        if (fill && (s === 14 || s === 15)) add(out, kit.clap, t, 0.3);
      }
      if (lvl >= 1 && lvl < 1.5 && s === 0) add(out, inst.bass[c.root + 'l'], t, 0.8);
      if (lvl >= 1.5) {
        let play = false, m = c.root;
        if (mp.bass === 'offbeat') play = offBeat || s === 15;
        else if (mp.bass === 'rolling') play = !onBeat;
        else { play = s % 2 === 0; if (offBeat) m = c.root + 12; }
        if (play) add(out, inst.bass[m + 's'], t, lvl >= 2 ? 1 : 0.8);
      }
      if (lvl >= 3 || (lvl === 0.5 && s % 2 === 0)) {
        add(out, inst.arp[c.arp[mp.arp[s] % c.arp.length]], t, lvl === 0.5 ? 0.6 : 1);
      }
    }
  }
}

// Time-varying low-pass (RBJ biquad), coefficients updated every 64 samples.
function lowpass(x, points) {
  const cut = cursor(points, 14000);
  const Q = 0.9;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < x.length; i++) {
    if ((i & 63) === 0) {
      const f = Math.min(14000, Math.max(80, cut(i / SR)));
      const w = (2 * Math.PI * f) / SR;
      const cs = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al;
      b0 = (1 - cs) / 2 / a0; b1 = (1 - cs) / a0; b2 = b0; a1 = (-2 * cs) / a0; a2 = (1 - al) / a0;
    }
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
}

function applyGain(x, points, scale = 1) {
  const g = cursor(points, 1);
  for (let i = 0; i < x.length; i += 64) {
    const v = g(i / SR) * scale;
    const n = Math.min(x.length, i + 64);
    for (let j = i; j < n; j++) x[j] *= v;
  }
}

// Peak limiter: instant attack, smooth release.
function limit(x) {
  const rel = 1 - Math.exp(-1 / (0.12 * SR));
  let env = 1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    const target = a > LIMIT ? LIMIT / a : 1;
    env = target < env ? target : env + (target - env) * rel;
    x[i] *= env;
  }
}

// ---------- Voice clip loading ----------

const voiceCache = {};
let decoder;

export async function loadVoice(keys, base = 'audio/voice/') {
  decoder = decoder || new OfflineAudioContext(1, 1, SR);
  await Promise.all(
    [...new Set(keys)].filter((k) => !voiceCache[k]).map(async (k) => {
      const res = await fetch(base + k + '.mp3');
      if (!res.ok) throw new Error('Could not load voice clip ' + k);
      const data = await res.arrayBuffer();
      const buf = await new Promise((ok, fail) => decoder.decodeAudioData(data, ok, fail));
      voiceCache[k] = buf.getChannelData(0);
    })
  );
  return voiceCache;
}

// ---------- Main render ----------

let kitCache;
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

export async function renderSession(session, durations, settings, onProgress = () => {}) {
  onProgress(0.02);
  const voice = await loadVoice(session.voice.map((v) => v.key));
  onProgress(0.2);
  kitCache = kitCache || makeKit();
  const mp = musicPlan(session.plan.seed);
  const inst = await makeInstruments(mp);
  onProgress(0.45);
  await yieldFrame();

  const dur = session.duration;
  const x = new Float32Array(Math.ceil(dur * SR));
  sequence(x, mp, inst, kitCache, session);
  onProgress(0.6);
  await yieldFrame();

  lowpass(x, filterPoints(session));
  for (const h of session.holds) add(x, inst.riser, Math.max(h.start, h.end - 4), 1);
  applyGain(x, duckPoints(session, durations));
  applyGain(x, [{ t: 0, v: 0 }, { t: 2, v: 1 }, { t: Math.max(2, dur - 5), v: 1 }, { t: dur, v: 0 }], MUSIC_GAIN * settings.music);
  onProgress(0.8);
  await yieldFrame();

  for (const v of session.voice) add(x, voice[v.key], v.t, settings.voice);
  limit(x);
  onProgress(0.95);
  await yieldFrame();

  const pcm = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-1, Math.min(1, x[i])) * 32767;
  onProgress(1);
  return wavBlob(pcm);
}

function wavBlob(pcm) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  const bytes = pcm.length * 2;
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, bytes, true);
  return new Blob([header, pcm.buffer], { type: 'audio/wav' });
}
