// Turns a session plan into a timeline: voice cues, visual phases, and music cues.
// Everything is scheduled ahead of time so the whole session can be mixed into one
// audio track that keeps playing with the phone locked.

import { trainingParams, MAX_SESSION_SEC } from './program.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEST_MAX = 120;
const MUSIC_LEAD = 2.5;

class Builder {
  constructor(clips) {
    this.clips = clips;
    this.t = MUSIC_LEAD;
    this.voice = [];
    this.phases = [];
    this.holds = [];
    this.energy = []; // [{t, level}]
  }
  dur(key) {
    const d = this.clips[key];
    if (d == null) throw new Error('Missing voice clip: ' + key);
    return d;
  }
  // Speak at the cursor and advance past the clip.
  say(key, gap = 0.45) {
    this.voice.push({ t: this.t, key });
    this.t += this.dur(key) + gap;
    return this;
  }
  // Speak at an absolute time without moving the cursor.
  at(t, key) {
    this.voice.push({ t, key });
    return this;
  }
  wait(s) {
    this.t += s;
    return this;
  }
  phase(type, start, end, extra = {}) {
    this.phases.push({ type, start, end, ...extra });
  }
  level(level) {
    this.energy.push({ t: this.t, level });
  }
}

function warmup(b, welcomeKey, withSafety) {
  b.level(1);
  const s0 = 0;
  b.say(welcomeKey, 0.6);
  b.say('start_walking', 3.5);
  b.phase('walk', s0, b.t, { label: 'Walk · nose breathing' });
  b.say('sigh_intro', 0.5);
  sigh(b);
  b.wait(1.5);
  sigh(b);
  b.wait(1.0);
  const r0 = b.t;
  b.say('relax', 2.0);
  if (withSafety) b.say('safety', 1.5);
  b.phase('walk', r0, b.t, { label: 'Walk · nose breathing' });
}

function sigh(b) {
  let s = b.t;
  b.say('sigh_in', 0);
  b.wait(1.6);
  b.phase('inhale', s, b.t, { label: 'Deep breath in' });
  s = b.t;
  b.say('sigh_top', 0);
  b.wait(0.6);
  b.phase('top', s, b.t, { label: 'Sip of air on top' });
  s = b.t;
  b.say('sigh_out', 0);
  b.wait(3.0);
  b.phase('exhale', s, b.t, { label: 'Long exhale' });
}

function prepBreath(b) {
  let s = b.t;
  b.say('prep_in', 0);
  b.wait(1.3);
  b.phase('inhale', s, b.t, { label: 'Normal breath in' });
  s = b.t;
  b.say('prep_out', 0);
  b.wait(1.6);
  b.phase('exhale', s, b.t, { label: 'Gently out' });
}

function cooldown(b, completeKey) {
  b.level(0.5);
  const s = b.t;
  b.say('cooldown', 3.0);
  b.phase('walk', s, b.t, { label: 'Cool down' });
  sigh(b);
  b.wait(2.0);
  const s2 = b.t;
  b.say(completeKey, 2.5);
  b.phase('walk', s2, b.t, { label: 'Session complete' });
  b.level(-1);
  b.wait(3.0);
}

function buildTraining(clips, plan, holds, seed) {
  const r = rng(seed);
  const pick = (prefix, n) => `${prefix}_${1 + Math.floor(r() * n)}`;
  const b = new Builder(clips);
  const R = holds.length;
  warmup(b, plan.kind === 'light' ? 'welcome_light' : 'welcome', plan.safety);

  for (let i = 0; i < R; i++) {
    const h = holds[i];
    b.level(plan.kind === 'light' ? 1.5 : i >= R / 2 ? 3 : 2);
    const a0 = b.t;
    b.say(i === R - 1 ? 'final_round' : `round_${i + 1}`, 0.25);
    b.say(`hold_${h}`, 1.0);
    b.phase('announce', a0, b.t, { label: i === R - 1 ? 'Final round' : `Round ${i + 1}`, round: i, hold: h });
    prepBreath(b);

    const hs = b.t;
    const he = hs + h;
    b.at(hs, 'hold_go');
    if (h >= 30) b.at(hs + h * 0.3, pick('enc', 4));
    if (h >= 24 && he - 10 - (hs + h / 2) > 3) b.at(hs + h / 2, 'halfway');
    if (h >= 22) b.at(he - 10, 'ten_left');
    for (let n = 3; n >= 1; n--) if (h >= 8) b.at(he - n, `n_${n}`);
    b.phase('hold', hs, he, { label: 'Hold', round: i, hold: h });
    b.holds.push({ start: hs, end: he });
    b.t = he;

    const rs = b.t;
    b.say('breathe', 1.2);
    if (i === R - 1) {
      b.wait(3.0);
      b.say('last_done', 1.5);
      b.phase('recover', rs, b.t, { label: 'Recover', round: i });
      break;
    }
    b.say(pick('recover', 4), 1.0);
    if (plan.safety && i === 0) b.say('safety', 1.0);
    // Leave room for the next round's announcement within the recovery time.
    const next = holds[i + 1];
    const announce = clips[i + 1 === R - 1 ? 'final_round' : `round_${i + 2}`] + 0.25 + clips[`hold_${next}`] + 1.0;
    const nextStart = Math.max(b.t + 3, rs + plan.recovery - announce);
    if (nextStart - b.t > 32) b.at(b.t + (nextStart - b.t) / 2 - 6, 'relax');
    if (nextStart - b.t > 14) b.at(nextStart - 5 - clips.get_ready, 'get_ready');
    b.t = nextStart;
    b.phase('recover', rs, nextStart, { label: 'Recover', round: i, next: nextStart + announce });
  }
  cooldown(b, 'complete');
  return finish(b, plan, R);
}

function buildTest(clips, plan) {
  const b = new Builder(clips);
  warmup(b, plan.kind === 'baseline' ? 'welcome_baseline' : 'welcome_retest', true);
  b.level(2);
  const e0 = b.t;
  b.say('baseline_explain', 2.0);
  b.phase('walk', e0, b.t, { label: 'Get ready' });
  prepBreath(b);
  const hs = b.t;
  b.at(hs, 'hold_go');
  for (let s = 5; s <= TEST_MAX; s += 5) b.at(hs + s, `count_${s}`);
  const he = hs + TEST_MAX + 1.6;
  b.at(he, 'baseline_cap');
  b.phase('test', hs, he + clips.baseline_cap, { label: 'Hold as long as comfortable' });
  b.holds.push({ start: hs, end: he });
  b.t = he + clips.baseline_cap + 2;
  // After an earbud tap the player jumps here.
  const post = b.t;
  b.say('baseline_done', 1.5);
  b.phase('recover', post, b.t, { label: 'Recover' });
  b.level(1.5);
  cooldown(b, 'complete_test');
  const out = finish(b, plan, 1);
  out.test = { holdStart: hs, holdEnd: he, resume: post };
  return out;
}

function finish(b, plan, rounds) {
  b.voice.sort((x, y) => x.t - y.t);
  b.phases.sort((x, y) => x.start - y.start);
  return {
    kind: plan.kind,
    duration: b.t,
    voice: b.voice,
    phases: b.phases,
    holds: b.holds,
    energy: b.energy,
    rounds,
    plan,
  };
}

// plan: { i, n, kind, testSeconds, difficulty, safety, seed }
export function buildSession(clips, plan) {
  if (plan.kind === 'baseline' || plan.kind === 'retest') return buildTest(clips, plan);
  const params = trainingParams(plan.i, plan.n, plan.testSeconds, plan.difficulty);
  let holds = params.holds;
  const p = { ...plan, recovery: params.recovery, target: params.target };
  let s = buildTraining(clips, p, holds, plan.seed);
  // Keep sessions within the time budget by dropping the easiest early rounds.
  while (s.duration > MAX_SESSION_SEC && holds.length > 3) {
    holds = holds.slice(1);
    s = buildTraining(clips, p, holds, plan.seed);
  }
  s.target = params.target;
  s.holdList = holds;
  return s;
}
