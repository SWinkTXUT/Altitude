// Training program: how each day's session gets harder over the selected period.
//
// Method: walking breath holds after a gentle exhale (simulated altitude / CO2 tolerance).
// Day 1 is a baseline test (comfortable max walking hold). Holds start at ~50% of the
// latest test result and climb to ~88% by the final day, with more rounds and shorter
// recoveries. Two lighter days per week. Retest at the end (and halfway for 8/12 weeks).

export const PRESETS = [
  { weeks: 4, title: '4 weeks', blurb: 'A focused month. Quick, steady progression.' },
  { weeks: 8, title: '8 weeks', blurb: 'The sweet spot. Includes a halfway retest.' },
  { weeks: 12, title: '12 weeks', blurb: 'The long climb. Biggest gains, gentlest ramp.' },
];

export const MAX_SESSION_SEC = 600;
const MIN_ROUNDS = 3;

export function sessionCount(weeks) {
  return weeks * 7;
}

export function sessionKind(i, n) {
  if (i === 0) return 'baseline';
  if (i === n - 1) return 'retest';
  if (n >= 56 && i === Math.floor(n / 2)) return 'retest';
  const d = i % 7;
  if (d === 3 || d === 6) return 'light';
  return 'train';
}

export const KIND_LABEL = {
  baseline: 'Baseline test',
  retest: 'Retest',
  train: 'Training',
  light: 'Light day',
};

const round5 = (x) => Math.round(x / 5) * 5;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Hold lengths for each round of a training session. Rounds ramp up to the day's target.
export function trainingParams(i, n, testSeconds, difficulty = 1) {
  const kind = sessionKind(i, n);
  const p = n > 1 ? i / (n - 1) : 1;
  let frac = 0.5 + 0.38 * p;
  let rounds = 4 + Math.round(4 * p);
  let recovery = round5(60 - 30 * p);
  if (kind === 'light') {
    frac *= 0.85;
    rounds -= 1;
    recovery += 15;
  }
  const cap = Math.max(10, Math.round(testSeconds * 0.95));
  const target = clamp(Math.round(testSeconds * frac * difficulty), 8, Math.min(cap, 150));
  const holds = [];
  for (let r = 0; r < rounds; r++) {
    const f = rounds > 1 ? 0.85 + 0.15 * (r / (rounds - 1)) : 1;
    holds.push(clamp(Math.round(target * f), 5, 150));
  }
  return { kind, target, holds, recovery };
}

// The most recent test result (baseline or retest) recorded before session i.
export function latestTest(results, beforeIndex = Infinity) {
  let best = null;
  for (const r of results) {
    if (r.i < beforeIndex && r.testSeconds) best = r.testSeconds;
  }
  return best;
}

export function adjustDifficulty(d, rating) {
  if (rating === 'easy') d += 0.05;
  if (rating === 'hard') d -= 0.07;
  return clamp(Math.round(d * 100) / 100, 0.8, 1.25);
}
