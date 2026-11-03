// Diaphragm strength: a separate breath-only program done lying down or seated.
// Each ~5 minute session runs four exercises: belly breathing, sniff-sniff-sniff
// inhales, power exhales (one per beat) and a long-exhale ladder. Everything grows
// with progress through the program, scaled by the difficulty from session ratings.

export const STRENGTH_PRESETS = [
  { weeks: 4, title: '4 weeks', blurb: 'Learn the technique and build a base.' },
  { weeks: 8, title: '8 weeks', blurb: 'The full build. Longer exhales, stronger bursts.' },
];
export const PER_WEEK = 5;
export const strengthCount = (weeks) => weeks * PER_WEEK;

const TARGET = 300;
const LEAD = 2;

export const EXERCISES = ['Belly breathing', 'Sniff breathing', 'Power exhales', 'Long exhales'];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function strengthParams(i, n, difficulty = 1) {
  const p = clamp((n > 1 ? i / (n - 1) : 1) * difficulty, 0, 1.15);
  const ladderMax = clamp(8 + 2 * Math.round(4 * p), 8, 18);
  const ladder = [];
  for (let e = Math.max(6, ladderMax - 8); e <= ladderMax; e += 2) ladder.push(e);
  return {
    bellyIn: 4,
    bellyOut: 4 + Math.round(2 * Math.min(1, p)),
    sniffs: 4 + Math.round(3 * p),
    powerRounds: p >= 0.5 ? 3 : 2,
    powerReps: clamp(10 + 5 * Math.round(3 * p), 10, 30),
    bpm: Math.round(72 + 18 * Math.min(1, p)),
    ladder,
  };
}

export function buildStrength(clips, plan) {
  const prm = strengthParams(plan.i, plan.n, plan.difficulty);
  const make = (bellyBreaths) => {
    const beat = 60 / prm.bpm;
    const voice = [], phases = [], clicks = [], blocks = [], energy = [];
    let t = LEAD;
    const d = (k) => {
      if (clips[k] == null) throw new Error('Missing voice clip: ' + k);
      return clips[k];
    };
    const say = (k, after = 0.4) => { voice.push({ t, key: k }); t += d(k) + after; };
    const at = (time, k) => voice.push({ t: time, key: k });
    const phase = (type, start, end, extra) => phases.push({ type, start, end, ...extra });
    const block = (name, start) => blocks.push({ name, start, end: t });
    // A counted breath: cue, then the voice counts each following second.
    const breath = (type, cue, secs, ex, rep, reps, counted = true) => {
      const s = t;
      at(s, cue);
      if (counted) for (let c = 2; c <= secs; c++) at(s + c - 1, `n_${c}`);
      t = s + secs;
      phase(type, s, t, { ex, label: type === 'inhale' ? 'Breathe in' : 'Breathe out', count: secs, rep, reps });
    };

    energy.push({ t: 0, level: 1 });
    let s = t;
    say('str_welcome', 2);
    phase('setup', s, t, { ex: 'Get set', label: 'Hand on chest, hand on belly' });

    // 1. Belly breathing
    let b0 = t;
    s = t;
    say('str_belly_intro', 1.5);
    phase('setup', s, t, { ex: EXERCISES[0], label: 'Belly rises, chest stays still' });
    for (let k = 0; k < bellyBreaths; k++) {
      breath('inhale', 'str_in', prm.bellyIn, EXERCISES[0], k, bellyBreaths, k < 3);
      breath('exhale', 'str_out', prm.bellyOut, EXERCISES[0], k, bellyBreaths, k < 3);
    }
    block(EXERCISES[0], b0);
    t += 1.5;

    // 2. Sniff-sniff-sniff
    b0 = t;
    s = t;
    say('str_sniff_intro', 1.5);
    phase('setup', s, t, { ex: EXERCISES[1], label: 'Three quick sniffs, then out' });
    for (let r = 0; r < prm.sniffs; r++) {
      for (let j = 0; j < 3; j++) {
        at(t, 'str_sniff');
        phase('sniff', t, t + 0.8, { ex: EXERCISES[1], label: 'Sniff', step: j, rep: r, reps: prm.sniffs });
        t += 0.8;
      }
      t += 0.4;
      s = t;
      at(t, 'str_slow_out');
      t += 5.5;
      phase('exhale', s, t, { ex: EXERCISES[1], label: 'Slowly out', count: 5, rep: r, reps: prm.sniffs, quiet: true });
    }
    block(EXERCISES[1], b0);
    t += 1.5;

    // 3. Power exhales, one per beat, in rounds with recovery
    b0 = t;
    s = t;
    say('str_power_intro', 1.5);
    phase('setup', s, t, { ex: EXERCISES[2], label: 'Short, sharp bursts from the belly' });
    for (let r = 0; r < prm.powerRounds; r++) {
      if (r > 0) {
        s = t;
        say(r === prm.powerRounds - 1 ? 'final_round' : `round_${r + 1}`, 0.3);
        phase('setup', s, t, { ex: EXERCISES[2], label: r === prm.powerRounds - 1 ? 'Last round' : `Round ${r + 1}` });
      }
      s = t;
      say('str_in', 1.3);
      phase('inhale', s, t, { ex: EXERCISES[2], label: 'Breathe in', count: 0, rep: r, reps: prm.powerRounds });
      say('str_go', 0.15);
      const p0 = t;
      const beats = [];
      for (let j = 0; j < prm.powerReps; j++) beats.push(p0 + j * beat);
      clicks.push(...beats);
      t = p0 + prm.powerReps * beat;
      energy.push({ t: p0 - 0.5, level: 1.5 }, { t, level: 1 });
      phase('power', p0, t, { ex: EXERCISES[2], label: 'Push', beats, reps: prm.powerReps, rep: r, rounds: prm.powerRounds });
      t += 0.4;
      s = t;
      say('str_power_rest', 0);
      const rest = r < prm.powerRounds - 1 ? 14 : 6;
      t = s + Math.max(d('str_power_rest') + 1, rest);
      phase('rest', s, t, { ex: EXERCISES[2], label: 'Relax', rep: r, reps: prm.powerRounds });
    }
    block(EXERCISES[2], b0);

    // 4. Long-exhale ladder
    b0 = t;
    s = t;
    say('str_ladder_intro', 1.5);
    phase('setup', s, t, { ex: EXERCISES[3], label: 'In for four, out slowly' });
    prm.ladder.forEach((e, k) => {
      breath('inhale', 'str_in', 4, EXERCISES[3], k, prm.ladder.length);
      breath('exhale', 'str_out', e, EXERCISES[3], k, prm.ladder.length);
      t += 0.8;
    });
    block(EXERCISES[3], b0);

    s = t;
    say('str_close', 1);
    say('str_complete', 3);
    phase('setup', s, t, { ex: 'Complete', label: 'Breathe normally' });
    energy.push({ t: t - 3, level: -1 });
    voice.sort((a, b) => a.t - b.t);
    return { voice, phases, clicks, blocks, energy, duration: t };
  };

  // Fit to about five minutes by adjusting the number of belly breaths.
  let belly = 6;
  let out = make(belly);
  while (out.duration > TARGET + 20 && belly > 4) out = make(--belly);
  while (out.duration < TARGET - 20 && belly < 12) out = make(++belly);
  return {
    kind: 'strength',
    ...out,
    holds: [],
    rounds: 0,
    bpm: prm.bpm,
    params: { ...prm, bellyBreaths: belly },
    plan: { seed: plan.seed },
  };
}
