// Non-sleep deep rest (NSDR): a guided, lying-down session separate from the breath-hold
// program. Settle in, a few physiological sighs, slow breathing with long exhales, a body
// scan, quiet rest, then a gentle return. The script is fixed per length; silences stretch
// so each session lands on its exact length.

export const REST_LENGTHS = [
  { minutes: 5, title: '5 minutes', blurb: 'A quick reset' },
  { minutes: 10, title: '10 minutes', blurb: 'A midday recharge' },
  { minutes: 15, title: '15 minutes', blurb: 'A full-body restore' },
];

const FULL_SCAN = [
  ['rest_scan_rfoot', 'Right foot'], ['rest_scan_rleg', 'Right leg'],
  ['rest_scan_lfoot', 'Left foot'], ['rest_scan_lleg', 'Left leg'],
  ['rest_scan_hips', 'Hips'], ['rest_scan_belly', 'Belly'], ['rest_scan_chest', 'Chest'],
  ['rest_scan_arms', 'Arms and hands'], ['rest_scan_shoulders', 'Shoulders'],
  ['rest_scan_neck', 'Neck'], ['rest_scan_jaw', 'Jaw'], ['rest_scan_face', 'Face'],
  ['rest_scan_head', 'Crown of the head'], ['rest_scan_whole', 'Whole body'],
];
const SHORT_SCAN = [
  ['rest_scan_legs_short', 'Feet and legs'], ['rest_scan_torso_short', 'Hips, belly and chest'],
  ['rest_scan_arms_short', 'Arms and shoulders'], ['rest_scan_face_short', 'Neck and face'],
  ['rest_scan_whole', 'Whole body'],
];
const REMINDERS = ['rest_rem_1', 'rest_rem_2', 'rest_rem_3', 'rest_rem_4', 'rest_rem_5'];

const LEAD = 4; // drone fades in before the voice
const TAIL = 8; // drone fades out after "deep rest complete"

// Builds the whole timeline with scan gaps and rest silence as unknowns, then solves for them.
export function buildRest(clips, minutes) {
  const target = minutes * 60;
  const short = minutes <= 5;
  const scan = short ? SHORT_SCAN : FULL_SCAN;
  const sighs = short ? 2 : 3;
  const paced = { 5: 3, 10: 4, 15: 5 }[minutes] || 4;
  const d = (k) => {
    if (clips[k] == null) throw new Error('Missing voice clip: ' + k);
    return clips[k];
  };

  const make = (scanGap, restFill) => {
    const voice = [], phases = [];
    let t = LEAD;
    const say = (k, after = 0) => { voice.push({ t, key: k }); t += d(k) + after; };
    const phase = (type, start, label, extra = {}) => phases.push({ type, start, end: t, label, ...extra });

    let s = 0;
    say('rest_welcome', 3);
    say('rest_eyes', 4);
    phase('settle', s, 'Settle in');

    s = t;
    say('rest_sigh_intro', 1);
    phase('settle', s, 'Deep sighs');
    for (let k = 0; k < sighs; k++) {
      if (k) { s = t; say('rest_sigh_again', 0.4); phase('settle', s, 'Deep sighs'); }
      s = t; say('rest_sigh_in', 1.6); phase('inhale', s, 'Breathe in');
      s = t; say('rest_sigh_top', 0.8); phase('top', s, 'A little more');
      s = t; say('rest_sigh_out', 4); phase('exhale', s, 'Let it all go');
    }

    s = t;
    say('rest_pace_intro', 2);
    phase('settle', s, 'Slow breathing');
    for (let k = 0; k < paced; k++) {
      s = t; say('rest_in', 4 - d('rest_in')); phase('inhale', s, 'Breathe in');
      s = t; say('rest_out', 6.5 - d('rest_out')); phase('exhale', s, 'Breathe out');
    }
    s = t;
    say('rest_pace_own', 6);
    phase('rest', s, 'Long, slow exhales');

    s = t;
    say('rest_scan_intro', 3);
    phase('scan', s, 'Body scan');
    for (const [k, label] of scan) {
      s = t;
      say(k, scanGap);
      phase('scan', s, label);
    }

    s = t;
    say('rest_rest_intro', 0);
    // Quiet rest with an occasional gentle reminder.
    const every = short ? 40 : minutes <= 10 ? 55 : 65;
    const n = Math.max(short ? 1 : 0, Math.floor(restFill / every) - 1);
    const restStart = t;
    for (let k = 0; k < n; k++) voice.push({ t: restStart + (k + 1) * (restFill / (n + 1)), key: REMINDERS[k % REMINDERS.length] });
    t += restFill;
    phase('rest', s, 'Rest');

    s = t;
    say('rest_return_1', 6);
    say('rest_return_2', 6);
    say('rest_return_3', 5);
    say('rest_return_4', 3);
    phase('return', s, 'Return');
    s = t;
    say('rest_complete', TAIL);
    phase('return', s, 'Complete');
    voice.sort((a, b) => a.t - b.t);
    return { voice, phases, duration: t };
  };

  // Everything is linear in the two unknowns, so measure with zero gaps and solve.
  const base = make(0, 0).duration;
  const spare = Math.max(0, target - base);
  let gap = Math.min(short ? 10 : 22, Math.max(short ? 3 : 5, (spare * (short ? 0.35 : 0.45)) / scan.length));
  let fill = spare - gap * scan.length;
  if (fill < 20) { gap = Math.max(2, (spare - 20) / scan.length); fill = Math.max(0, spare - gap * scan.length); }
  const out = make(gap, fill);
  return { kind: 'rest', minutes, ...out, holds: [], rounds: 0, plan: { seed: minutes * 101 } };
}
