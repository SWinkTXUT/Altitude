import { PRESETS, KIND_LABEL, sessionCount, sessionKind, trainingParams, latestTest, adjustDifficulty } from './program.js';
import { buildSession } from './script.js';
import { renderSession } from './audio.js';

const KEY = 'altitude.v1';
const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const overlay = document.getElementById('overlay');
const audio = document.getElementById('player');

// ---------- State ----------

const defaults = () => ({
  accepted: false,
  program: null,
  archive: [],
  settings: { music: 0.8, voice: 1 },
  pending: null,
});

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return { ...defaults(), ...s, settings: { ...defaults().settings, ...s.settings } };
  } catch {}
  return defaults();
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

let clips = {};
let tab = 'today';
let calMonth = null;

const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtMin = (s) => `${Math.round(s / 60)} min`;

function allResults() {
  const r = [];
  for (const p of state.archive) r.push(...p.results);
  if (state.program) r.push(...state.program.results);
  return r;
}

function streak() {
  const days = new Set(allResults().map((r) => r.date));
  const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function bestStreak() {
  const days = [...new Set(allResults().map((r) => r.date))].sort();
  let best = 0, cur = 0, prev = null;
  for (const s of days) {
    const d = parseDay(s);
    cur = prev && (d - prev) / 864e5 === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

function planFor(i) {
  const p = state.program;
  return {
    i,
    n: p.n,
    kind: sessionKind(i, p.n),
    testSeconds: latestTest(p.results, i) || 30,
    difficulty: p.difficulty,
    safety: i < 3,
    seed: p.seedBase + i,
  };
}

function sessionFor(i) {
  return buildSession(clips, planFor(i));
}

// ---------- Rendering helpers ----------

function setTabs(show) {
  tabs.hidden = !show;
  tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}

function view() {
  if (!state.accepted) return onboarding();
  if (!state.program) return choose();
  setTabs(true);
  if (tab === 'progress') return progress();
  if (tab === 'settings') return settings();
  return todayView();
}

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  tab = b.dataset.tab;
  view();
  window.scrollTo(0, 0);
});

// ---------- Onboarding ----------

function onboarding() {
  setTabs(false);
  app.innerHTML = `
    <div class="eyebrow">Welcome to</div>
    <h1>Altitude</h1>
    <p>Daily walking breath-hold training to build CO₂ tolerance and simulate altitude — the breathing work most linked to aerobic performance and VO₂ max.</p>
    <div class="card">
      <h3>How it works</h3>
      <ul class="clean">
        <li>Day 1 is a baseline test: one comfortable max breath hold while walking.</li>
        <li>Each day you walk while a voice guides you through timed holds after a gentle exhale, with upbeat music.</li>
        <li>Holds get longer, rounds increase, and recoveries shorten as the program goes on.</li>
        <li>Put in your AirPods, tap Begin, and pocket your phone. It keeps playing with the screen locked.</li>
      </ul>
    </div>
    <div class="card">
      <h3>Safety first</h3>
      <ul class="clean warn">
        <li>Never practice breath holds in or near water, while driving, or anywhere fainting would be dangerous.</li>
        <li>Walk on a safe, familiar path away from traffic.</li>
        <li>Breathe immediately if you feel dizzy, tingly or unwell. A hold can always end early.</li>
        <li>Skip breath holds if you are pregnant or have heart, lung, blood pressure, seizure or panic conditions — check with a doctor first.</li>
      </ul>
      <label class="check"><input type="checkbox" id="ok"> I understand and will train safely</label>
    </div>
    <button class="btn" id="go" disabled>Continue</button>`;
  const ok = app.querySelector('#ok');
  const go = app.querySelector('#go');
  ok.onchange = () => (go.disabled = !ok.checked);
  go.onclick = () => { state.accepted = true; save(); view(); };
}

function choose() {
  setTabs(false);
  let sel = 8;
  app.innerHTML = `
    <div class="eyebrow">Step 2</div>
    <h1>Choose your climb</h1>
    <p>One short session a day (5–10 minutes). If you miss a day, you simply pick up where you left off.</p>
    ${PRESETS.map((p) => `<button class="choice${p.weeks === sel ? ' sel' : ''}" data-w="${p.weeks}"><b>${p.title}</b><span>${p.blurb} ${sessionCount(p.weeks)} sessions.</span></button>`).join('')}
    <div style="height:10px"></div>
    <button class="btn" id="start">Start program</button>
    ${state.archive.length ? '<button class="btn ghost" id="back">Cancel</button>' : ''}`;
  app.querySelectorAll('.choice').forEach((b) => (b.onclick = () => {
    sel = Number(b.dataset.w);
    app.querySelectorAll('.choice').forEach((c) => c.classList.toggle('sel', c === b));
  }));
  app.querySelector('#start').onclick = () => {
    state.program = {
      weeks: sel,
      n: sessionCount(sel),
      startedAt: today(),
      results: [],
      difficulty: 1,
      seedBase: Math.floor(Math.random() * 1e6),
    };
    save();
    tab = 'today';
    view();
  };
  const back = app.querySelector('#back');
  if (back) back.onclick = () => {
    state.program = state.archive.pop();
    save();
    view();
  };
}

// ---------- Today ----------

function todayView() {
  const p = state.program;
  const i = p.results.length;
  const doneToday = p.results.some((r) => r.date === today());
  const finished = i >= p.n;
  const s = streak();
  const install = !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;

  let body = '';
  if (finished) {
    const base = p.results[0]?.testSeconds;
    const last = latestTest(p.results);
    const gain = base ? Math.round(((last - base) / base) * 100) : 0;
    body = `
      <div class="card hero">
        <div class="badge">Program complete</div>
        <h1 style="margin-top:12px">You reached the summit</h1>
        <p>${p.weeks} weeks, ${p.n} sessions. Baseline ${base}s → final ${last}s${gain ? ` (${gain > 0 ? '+' : ''}${gain}%)` : ''}.</p>
        <button class="btn" id="new">Start a new program</button>
      </div>`;
  } else {
    const showI = doneToday ? i - 1 : i;
    const sess = sessionFor(showI);
    const kind = sess.kind;
    const isTest = kind === 'baseline' || kind === 'retest';
    const holds = sess.holdList || [];
    const maxH = Math.max(...holds, 1);
    const desc = {
      baseline: 'One comfortable max breath hold while walking. Your result sets your starting targets.',
      retest: 'Same test as day 1. See how far you have climbed. Your targets update from your result.',
      train: 'Walking breath holds after a gentle exhale. Holds build within the session.',
      light: 'An easier day to absorb the training. Shorter holds, longer recoveries.',
    }[kind];
    body = `
      <div class="card hero kind-${kind}">
        <div class="badge">${KIND_LABEL[kind]}${doneToday ? ' · done ✓' : ''}</div>
        <h1 style="margin-top:12px">${doneToday ? 'Done for today' : `Day ${i + 1}`}</h1>
        <p>${doneToday ? 'Nice work. Your next session unlocks tomorrow.' : desc}</p>
        ${isTest ? `<div class="stats"><div class="stat"><b>${fmtMin(sess.duration)}</b><span>max length</span></div><div class="stat"><b>1</b><span>test hold</span></div></div>`
          : `<div class="stats">
              <div class="stat"><b>${sess.rounds}</b><span>rounds</span></div>
              <div class="stat"><b>${sess.target}s</b><span>top hold</span></div>
              <div class="stat"><b>${fmtMin(sess.duration)}</b><span>total</span></div>
            </div>
            <div class="ladder">${holds.map((h) => `<i style="height:${Math.round((h / maxH) * 100)}%" title="${h}s"></i>`).join('')}</div>`}
        ${doneToday ? `<button class="btn ghost" id="again">Repeat today's session</button>` : `<button class="btn${isTest ? ' warm' : ''}" id="start">Start session</button>`}
      </div>`;
  }

  app.innerHTML = `
    <div class="eyebrow">${p.weeks}-week program · Week ${Math.min(p.weeks, Math.floor(Math.min(i, p.n - 1) / 7) + 1)}</div>
    <h1>Altitude</h1>
    ${body}
    <div class="row">
      <div class="tile"><b>${s}🔥</b><span>day streak</span></div>
      <div class="tile"><b>${Math.min(i, p.n)}/${p.n}</b><span>sessions done</span></div>
    </div>
    ${install ? `<div class="card banner"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg><span>Install: tap <b>Share</b> then <b>Add to Home Screen</b> for the full-screen app that works offline.</span></div>` : ''}
    <div class="card banner"><svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6M3 18a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2zm18 0a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z"/></svg><span>Put in your AirPods, start walking, then pocket your phone. The voice leads everything.</span></div>`;

  const st = app.querySelector('#start');
  if (st) st.onclick = () => startSession(i, false);
  const ag = app.querySelector('#again');
  if (ag) ag.onclick = () => startSession(i - 1, true);
  const nw = app.querySelector('#new');
  if (nw) nw.onclick = () => { state.archive.push(state.program); state.program = null; save(); view(); };
}

// ---------- Progress ----------

function progress() {
  const p = state.program;
  const res = p.results;
  const base = res.find((r) => r.testSeconds)?.testSeconds;
  const last = latestTest(res);
  const gain = base && last ? Math.round(((last - base) / base) * 100) : null;

  app.innerHTML = `
    <div class="eyebrow">${p.weeks}-week program · started ${parseDay(p.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
    <h1>Progress</h1>
    <div class="tiles">
      <div class="tile"><b>${streak()}🔥</b><span>current streak</span></div>
      <div class="tile"><b>${bestStreak()}</b><span>best streak</span></div>
      <div class="tile"><b>${base ? base + 's' : '—'}</b><span>baseline hold</span></div>
      <div class="tile"><b>${last ? last + 's' : '—'}</b><span>latest test ${gain ? `<span class="up">${gain > 0 ? '+' : ''}${gain}%</span>` : ''}</span></div>
    </div>
    <h2>Hold targets</h2>
    <div class="card chart">${chart()}</div>
    <h2>Calendar</h2>
    <div class="card" id="calCard"></div>
    <h2>History</h2>
    <div class="card">${history()}</div>`;
  calendar();
}

function chart() {
  const p = state.program;
  if (!p.results.some((r) => r.testSeconds)) return '<p style="margin:0">Complete your baseline test to see your plan.</p>';
  const W = 340, H = 180, L = 30, B = 22, T = 10, R = 8;
  const pts = [];
  const plan = [];
  for (let i = 0; i < p.n; i++) {
    const kind = sessionKind(i, p.n);
    const done = p.results.find((r) => r.i === i);
    if (kind === 'baseline' || kind === 'retest') {
      if (done?.testSeconds) pts.push({ i, v: done.testSeconds, test: true });
      continue;
    }
    if (done?.target) pts.push({ i, v: done.target });
    else if (!done) plan.push({ i, v: trainingParams(i, p.n, latestTest(p.results, i) || 30, p.difficulty).target });
  }
  const maxV = Math.max(...pts.map((x) => x.v), ...plan.map((x) => x.v), 10) * 1.15;
  const x = (i) => L + ((W - L - R) * i) / Math.max(1, p.n - 1);
  const y = (v) => T + (H - T - B) * (1 - v / maxV);
  const line = (arr) => arr.map((q, k) => `${k ? 'L' : 'M'}${x(q.i).toFixed(1)},${y(q.v).toFixed(1)}`).join('');
  const trained = pts.filter((q) => !q.test);
  const ticks = [0, Math.round(maxV / 2.3), Math.round(maxV / 1.15)];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hold target per session">
    ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${L - 6}" y="${y(v) + 4}" fill="#6d6994" font-size="10" text-anchor="end">${v}s</text>`).join('')}
    ${[...Array(p.weeks + 1).keys()].filter((w) => w % (p.weeks > 8 ? 2 : 1) === 0).map((w) => `<text x="${x(Math.min(p.n - 1, w * 7))}" y="${H - 6}" fill="#6d6994" font-size="10" text-anchor="middle">${w ? 'W' + w : 'Start'}</text>`).join('')}
    ${plan.length ? `<path d="${line(plan)}" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="3 4" opacity=".6"/>` : ''}
    ${trained.length ? `<path d="${line(trained)}" fill="none" stroke="#3ee6c1" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
    ${trained.map((q) => `<circle cx="${x(q.i)}" cy="${y(q.v)}" r="2.5" fill="#3ee6c1"/>`).join('')}
    ${pts.filter((q) => q.test).map((q) => `<circle cx="${x(q.i)}" cy="${y(q.v)}" r="5.5" fill="#ff3d81" stroke="#0a0a1f" stroke-width="2"/><text x="${x(q.i)}" y="${y(q.v) - 10}" fill="#ffb3cc" font-size="11" font-weight="700" text-anchor="middle">${q.v}s</text>`).join('')}
  </svg>
  <div class="legend"><span><i style="background:#3ee6c1"></i>Completed target</span><span><i style="background:#a78bfa"></i>Upcoming plan</span><span><i style="background:#ff3d81"></i>Test result</span></div>`;
}

function calendar() {
  const card = document.getElementById('calCard');
  const now = new Date();
  calMonth = calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  const days = new Set(allResults().map((r) => r.date));
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let k = 0; k < first; k++) cells.push('<div></div>');
  for (let d = 1; d <= count; d++) {
    const key = today(new Date(y, m, d));
    cells.push(`<div class="d${days.has(key) ? ' done' : ''}${key === today() ? ' today' : ''}">${d}</div>`);
  }
  card.innerHTML = `
    <div class="cal-head"><button id="pm" aria-label="Previous month">‹</button><b>${calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button id="nm" aria-label="Next month">›</button></div>
    <div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>`;
  card.querySelector('#pm').onclick = () => { calMonth = new Date(y, m - 1, 1); calendar(); };
  card.querySelector('#nm').onclick = () => { calMonth = new Date(y, m + 1, 1); calendar(); };
}

function history() {
  const res = [...state.program.results].reverse();
  if (!res.length) return '<p style="margin:0">No sessions yet. Your first one is waiting on the Today tab.</p>';
  const rate = { easy: 'felt easy', right: 'just right', hard: 'felt hard' };
  return `<ul class="clean hist">${res.map((r) => `
    <li><div><b>Day ${r.i + 1}</b> · ${KIND_LABEL[r.kind]}<div class="k">${parseDay(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${r.rating ? ' · ' + rate[r.rating] : ''}</div></div>
    <div style="text-align:right">${r.testSeconds ? `<b>${r.testSeconds}s</b><div class="k">test hold</div>` : `<b>${r.rounds}×</b><div class="k">up to ${r.target}s</div>`}</div></li>`).join('')}</ul>`;
}

// ---------- Settings ----------

function settings() {
  const s = state.settings;
  app.innerHTML = `
    <h1>Settings</h1>
    <div class="card">
      <div class="set-row"><div class="lbl">Music volume <span id="mv">${Math.round(s.music * 100)}%</span></div><input type="range" id="music" min="0" max="1" step="0.05" value="${s.music}"></div>
      <div class="set-row"><div class="lbl">Voice volume <span id="vv">${Math.round(s.voice * 100)}%</span></div><input type="range" id="voice" min="0.4" max="1" step="0.05" value="${s.voice}"></div>
      <p style="margin:6px 0 0;font-size:13px">Applies to the next session you start.</p>
    </div>
    <div class="card">
      <h3>Program</h3>
      <p>${state.program.weeks} weeks · day ${Math.min(state.program.results.length + 1, state.program.n)} of ${state.program.n} · difficulty ${Math.round(state.program.difficulty * 100)}%</p>
      <button class="btn ghost" id="change">Switch to a new program</button>
    </div>
    <div class="card">
      <h3>About the training</h3>
      <p>Walking breath holds after a gentle exhale raise CO₂ and lower blood oxygen, a mild altitude-like stimulus. Over weeks this improves CO₂ tolerance and breathing efficiency. Pair it with your regular cardio for the biggest VO₂ max gains.</p>
      <p>Your ratings after each session nudge the difficulty up or down.</p>
      <button class="btn ghost" id="safety">Review safety info</button>
    </div>
    <button class="btn danger" id="reset">Reset all data</button>
    <p class="tip" style="margin-top:18px">Altitude v1.0 · voice by Kokoro TTS</p>`;
  const bind = (id, key, out) => {
    const el = app.querySelector('#' + id);
    el.oninput = () => { s[key] = Number(el.value); app.querySelector('#' + out).textContent = Math.round(s[key] * 100) + '%'; save(); };
  };
  bind('music', 'music', 'mv');
  bind('voice', 'voice', 'vv');
  app.querySelector('#change').onclick = () => {
    if (!confirm('Start a new program? Your current progress is kept in your history and streak.')) return;
    state.archive.push(state.program);
    state.program = null;
    save();
    view();
  };
  app.querySelector('#safety').onclick = () => { state.accepted = false; save(); view(); };
  app.querySelector('#reset').onclick = () => {
    if (!confirm('Erase all programs, history and settings?')) return;
    state = defaults();
    save();
    view();
  };
}

// ---------- Player ----------

let current = null; // { i, practice, session, url, testTap }
let raf = 0;

const RING_C = 2 * Math.PI * 48;

async function startSession(i, practice) {
  const session = sessionFor(i);
  current = { i, practice, session, url: null, testTap: null };
  overlay.hidden = false;
  overlay.dataset.phase = '';
  document.body.style.overflow = 'hidden';
  overlay.innerHTML = `
    <div class="top"><span class="eyebrow">${KIND_LABEL[session.kind]}</span><button class="x" id="cancel">Cancel</button></div>
    <div class="center">
      <svg class="spin" viewBox="0 0 120 120"><defs><linearGradient id="g"><stop offset="0" stop-color="#3ee6c1"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs>
        <circle class="track" cx="60" cy="60" r="48"/><circle class="prog" id="bp" cx="60" cy="60" r="48" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
      <div class="plabel">Mixing your session</div>
      <div class="psub" id="bpct">Building voice and music… 0%</div>
    </div>`;
  let cancelled = false;
  overlay.querySelector('#cancel').onclick = () => { cancelled = true; closePlayer(); };
  try {
    const blob = await renderSession(session, clips, state.settings, (f) => {
      const bp = overlay.querySelector('#bp');
      if (bp) bp.style.strokeDashoffset = RING_C * (1 - f);
      const t = overlay.querySelector('#bpct');
      if (t) t.textContent = `Building voice and music… ${Math.round(f * 100)}%`;
    });
    if (cancelled) return;
    current.url = URL.createObjectURL(blob);
    audio.src = current.url;
    audio.load();
    readyScreen();
  } catch (err) {
    if (cancelled) return;
    console.error(err);
    overlay.innerHTML = `<div class="center"><div class="plabel">Something went wrong</div><p>${String(err.message || err)}</p><button class="btn ghost" id="close">Close</button></div>`;
    overlay.querySelector('#close').onclick = closePlayer;
  }
}

function readyScreen() {
  const s = current.session;
  overlay.innerHTML = `
    <div class="top"><span class="eyebrow">${KIND_LABEL[s.kind]} · ${fmtTime(s.duration)}</span><button class="x" id="cancel">Cancel</button></div>
    <div class="center">
      <div class="big-emoji">🎧</div>
      <div class="plabel">Ready when you are</div>
      <p>Put in your AirPods and step outside. Tap Begin, start walking, then put your phone in your pocket. The screen can lock.</p>
      ${s.test ? '<p>During the test hold, <b>tap your earbuds once</b> when you release, or just remember the last number you hear.</p>' : ''}
    </div>
    <div class="controls"><button class="btn${s.test ? ' warm' : ''}" id="begin">Begin</button></div>`;
  overlay.querySelector('#cancel').onclick = closePlayer;
  overlay.querySelector('#begin').onclick = begin;
}

function begin() {
  const s = current.session;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  audio.currentTime = 0;
  audio.play().catch((e) => alert('Could not start audio: ' + e.message));
  setupMediaSession();
  const dots = s.test ? '' : Array.from({ length: s.rounds }, () => '<i></i>').join('');
  overlay.innerHTML = `
    <div class="top"><span class="eyebrow">${KIND_LABEL[s.kind]}</span><button class="x" id="end">End</button></div>
    <div class="center">
      <div class="dots" id="dots">${dots}</div>
      <div class="stage">
        <div class="orb" id="orb"></div>
        <svg class="ring" viewBox="0 0 110 110"><circle class="track" cx="55" cy="55" r="48"/><circle class="prog" id="ring" cx="55" cy="55" r="48" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
        <div class="count" id="count"></div>
      </div>
      <div class="plabel" id="plabel">Get walking</div>
      <div class="psub" id="psub"></div>
    </div>
    <div class="controls">
      <div class="pbar"><div id="pb"></div></div>
      <div class="times"><span id="tcur">0:00</span><span id="trem">-${fmtTime(s.duration)}</span></div>
      <div style="height:16px"></div>
      <button class="btn ghost" id="pp">Pause</button>
    </div>`;
  overlay.querySelector('#pp').onclick = () => (audio.paused ? audio.play() : audio.pause());
  overlay.querySelector('#end').onclick = endEarly;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const s = current.session;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({
    title: `Altitude · Day ${current.i + 1}`,
    artist: KIND_LABEL[s.kind],
    album: 'Altitude breath training',
    artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
  const tap = () => {
    const t = audio.currentTime;
    if (s.test && t >= s.test.holdStart + 2 && t < s.test.resume && current.testTap == null) {
      current.testTap = Math.min(180, Math.round(t - s.test.holdStart - 0.5));
      audio.currentTime = s.test.resume;
      audio.play();
      return true;
    }
    return false;
  };
  const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch {} };
  set('play', () => audio.play());
  set('pause', () => { if (!tap()) audio.pause(); });
  set('nexttrack', () => tap());
  set('previoustrack', null);
  set('seekbackward', null);
  set('seekforward', null);
  set('seekto', null);
}

function phaseAt(phases, t) {
  let ph = null;
  for (const p of phases) {
    if (p.start <= t && t < p.end) ph = p;
    if (p.start > t) break;
  }
  return ph;
}

const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

function tick() {
  if (!current || overlay.hidden) return;
  const s = current.session;
  const t = audio.currentTime || 0;
  const ph = phaseAt(s.phases, t) || { type: 'walk', label: t > s.duration - 8 ? 'Session complete' : 'Walk · nose breathing', start: t, end: t + 1 };
  const k = (t - ph.start) / Math.max(0.01, ph.end - ph.start);
  let scale = 0.8, ring = 0, count = '', sub = '';
  switch (ph.type) {
    case 'inhale': scale = 0.62 + 0.4 * ease(k); break;
    case 'top': scale = 1.02 + 0.04 * ease(k); break;
    case 'exhale': scale = 1.04 - 0.42 * ease(k); break;
    case 'hold':
      scale = 0.62 + 0.015 * Math.sin(t * 3);
      ring = k;
      count = `${Math.max(0, Math.ceil(ph.end - t))}`;
      sub = `${ph.hold}-second hold · keep walking`;
      break;
    case 'test':
      scale = 0.62 + 0.015 * Math.sin(t * 3);
      ring = ((t - ph.start) % 60) / 60;
      count = current.testTap != null ? `${current.testTap}<small>s</small>` : `${Math.floor(t - ph.start)}<small>s</small>`;
      sub = 'Tap your earbuds when you release';
      break;
    case 'recover':
      scale = 0.76 + 0.07 * Math.sin((2 * Math.PI * t) / 5);
      if (ph.next) { count = `${Math.max(0, Math.ceil(ph.next - t))}`; sub = 'Next hold in…'; }
      break;
    case 'announce':
      scale = 0.78 + 0.04 * Math.sin((2 * Math.PI * t) / 6);
      count = `${ph.hold}<small>s</small>`;
      sub = 'Coming up';
      break;
    default:
      scale = 0.78 + 0.05 * Math.sin((2 * Math.PI * t) / 6);
  }
  const $ = (id) => overlay.querySelector('#' + id);
  const orb = $('orb');
  if (!orb) return;
  const vis = ph.type === 'inhale' || ph.type === 'top' || ph.type === 'exhale' ? 'breathe' : ph.type;
  orb.dataset.phase = vis;
  overlay.dataset.phase = vis;
  orb.style.transform = `scale(${scale.toFixed(3)})`;
  $('ring').style.strokeDashoffset = RING_C * (1 - ring);
  if ($('count').innerHTML !== count) $('count').innerHTML = count;
  $('plabel').textContent = ph.label;
  $('psub').textContent = sub;
  $('pb').style.width = `${Math.min(100, (t / s.duration) * 100)}%`;
  $('tcur').textContent = fmtTime(t);
  $('trem').textContent = '-' + fmtTime(s.duration - t);
  $('pp').textContent = audio.paused ? 'Resume' : 'Pause';
  const r = ph.round;
  if (r != null) $('dots').querySelectorAll('i').forEach((d, j) => { d.className = j < r || (j === r && ph.type === 'recover') ? 'done' : j === r ? 'now' : ''; });
  raf = requestAnimationFrame(tick);
}

audio.addEventListener('timeupdate', () => {
  if (!current || current.practice) return;
  const s = current.session;
  if (audio.currentTime > s.duration - 15 && !state.pending) {
    state.pending = pendingRecord();
    save();
  }
});

audio.addEventListener('ended', () => {
  if (current) finishScreen();
});

function pendingRecord() {
  const s = current.session;
  return {
    i: current.i,
    date: today(),
    kind: s.kind,
    rounds: s.rounds,
    target: s.target || null,
    duration: Math.round(s.duration),
    testTap: current.testTap,
  };
}

function endEarly() {
  const s = current.session;
  const nearlyDone = audio.currentTime > s.duration * 0.85 || (s.test && audio.currentTime > s.test.resume);
  if (nearlyDone && !current.practice) {
    if (confirm('End now and count this session as done?')) { audio.pause(); finishScreen(); }
    return;
  }
  if (confirm(current.practice ? 'End this session?' : "End this session? It won't count toward your program.")) {
    if (!current.practice) { state.pending = null; save(); }
    closePlayer();
  }
}

function finishScreen(rec) {
  cancelAnimationFrame(raf);
  if (!rec) {
    if (current.practice) {
      overlay.dataset.phase = '';
      overlay.innerHTML = `<div class="center"><div class="big-emoji">✅</div><div class="plabel">Bonus session done</div><p>Repeats don't change your program, but they all count as training.</p></div><div class="controls"><button class="btn" id="close">Done</button></div>`;
      overlay.querySelector('#close').onclick = closePlayer;
      return;
    }
    rec = state.pending && state.pending.i === current.i ? { ...state.pending, testTap: current.testTap ?? state.pending.testTap } : pendingRecord();
    state.pending = rec;
    save();
  }
  overlay.hidden = false;
  overlay.dataset.phase = '';
  document.body.style.overflow = 'hidden';
  const isTest = rec.kind === 'baseline' || rec.kind === 'retest';
  if (isTest) {
    let v = rec.testTap ?? (latestTest(state.program.results) || 30);
    overlay.innerHTML = `
      <div class="center">
        <div class="eyebrow">${KIND_LABEL[rec.kind]}</div>
        <div class="plabel">How long did you hold?</div>
        <p>${rec.testTap != null ? `We caught your earbud tap at <b>${rec.testTap}s</b>. Adjust if needed.` : 'Enter the last number you heard before you released.'}</p>
        <div class="stepper">
          <button data-d="-5">−5</button><button data-d="-1">−1</button>
          <output id="val">${v}<small>s</small></output>
          <button data-d="1">+1</button><button data-d="5">+5</button>
        </div>
      </div>
      <div class="controls"><button class="btn warm" id="saveT">Save result</button></div>`;
    overlay.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
      v = Math.max(5, Math.min(180, v + Number(b.dataset.d)));
      overlay.querySelector('#val').innerHTML = `${v}<small>s</small>`;
    }));
    overlay.querySelector('#saveT').onclick = () => commit({ ...rec, testSeconds: v });
  } else {
    overlay.innerHTML = `
      <div class="center">
        <div class="big-emoji">⛰️</div>
        <div class="eyebrow">Day ${rec.i + 1} complete</div>
        <div class="plabel">How did that feel?</div>
        <p>Your answer fine-tunes the next sessions.</p>
        <div class="rate">
          <button data-r="easy">Too easy <span>push me harder</span></button>
          <button data-r="right">Just right <span>keep the plan</span></button>
          <button data-r="hard">Too hard <span>ease off a bit</span></button>
        </div>
      </div>`;
    overlay.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => commit({ ...rec, rating: b.dataset.r })));
  }
}

function commit(rec) {
  const p = state.program;
  delete rec.testTap;
  if (!p.results.some((r) => r.i === rec.i)) p.results.push(rec);
  if (rec.rating) p.difficulty = adjustDifficulty(p.difficulty, rec.rating);
  state.pending = null;
  save();
  const s = streak();
  const done = p.results.length >= p.n;
  overlay.innerHTML = `
    <div class="center">
      <div class="big-emoji">${done ? '🏔️' : '🔥'}</div>
      <div class="plabel">${done ? 'Program complete!' : `${s}-day streak`}</div>
      <p>${rec.testSeconds ? `Test hold saved: <b>${rec.testSeconds}s</b>. Your targets are set from this.` : 'Session saved.'} ${done ? '' : 'See you tomorrow.'}</p>
    </div>
    <div class="controls"><button class="btn" id="close">Done</button></div>`;
  overlay.querySelector('#close').onclick = closePlayer;
}

function closePlayer() {
  cancelAnimationFrame(raf);
  audio.pause();
  if (current?.url) URL.revokeObjectURL(current.url);
  audio.removeAttribute('src');
  audio.load();
  current = null;
  overlay.hidden = true;
  overlay.innerHTML = '';
  document.body.style.overflow = '';
  view();
}

// ---------- Boot ----------

async function boot() {
  try {
    clips = await (await fetch('audio/voice/manifest.json')).json();
  } catch {
    app.innerHTML = '<h1>Altitude</h1><p>Could not load voice files. Check your connection and reload.</p>';
    return;
  }
  view();
  if (state.pending && state.program && !state.program.results.some((r) => r.i === state.pending.i)) {
    current = { i: state.pending.i, practice: false, session: null };
    finishScreen(state.pending);
  } else if (state.pending) {
    state.pending = null;
    save();
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
