import { PRESETS, KIND_LABEL, sessionCount, sessionKind, trainingParams, latestTest, adjustDifficulty } from './program.js';
import { buildSession } from './script.js';
import { renderSession } from './audio.js';
import { mascot, scene, peak, icon, confetti } from './art.js';

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
let obStep = 0;

const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const minutes = (s) => Math.max(1, Math.round(s / 60));

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
    cur = prev && Math.round((d - prev) / 864e5) === 1 ? cur + 1 : 1;
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

const isTestKind = (k) => k === 'baseline' || k === 'retest';

// ---------- Climb theme ----------

const CAMPS = ['Base Camp', 'Foothills', 'Pine Trail', 'Treeline', 'Alpine Meadow', 'Rocky Ridge', 'Glacier', 'High Camp', 'Thin Air', 'Cloud Line', 'Summit Ridge', 'Summit Push'];
const UNIT_COLORS = ['teal', 'blue', 'lav', 'pink', 'orange'];

function campName(w, weeks) {
  return CAMPS[weeks === 1 ? 0 : Math.round((w * (CAMPS.length - 1)) / (weeks - 1))];
}

const KIND_STYLE = {
  train: { color: 'teal', icon: 'star' },
  light: { color: 'lav', icon: 'leaf' },
  baseline: { color: 'orange', icon: 'flag' },
  retest: { color: 'orange', icon: 'flag' },
};

const cvar = (c) => `--c:var(--${c});--cd:var(--${c}-d)`;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ---------- Sheet (confirm) ----------

function sheet({ title, text, ok = 'OK', cancel = 'Cancel', tone = '' }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <h3>${title}</h3><p>${text}</p>
      <button class="btn ${tone}" data-v="1">${ok}</button>
      <button class="btn link" data-v="0">${cancel}</button></div>`;
    const done = (v) => { bg.remove(); resolve(v); };
    bg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target === bg) done(false);
    });
    document.body.appendChild(bg);
  });
}

// ---------- Routing ----------

function setTabs(show) {
  tabs.hidden = !show;
  tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}

function view() {
  if (!state.accepted || !state.program) return onboarding();
  setTabs(true);
  if (tab === 'progress') return progress();
  if (tab === 'settings') return settings();
  return home();
}

tabs.innerHTML = [
  ['today', 'home', 'Climb'],
  ['progress', 'chart', 'Progress'],
  ['settings', 'gear', 'Settings'],
].map(([t, ic, l]) => `<button data-tab="${t}" class="tab">${icon(ic, 26)}<span>${l}</span></button>`).join('');

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  tab = b.dataset.tab;
  view();
  window.scrollTo(0, 0);
});

// ---------- Onboarding ----------

function dots(n, on) {
  return `<div class="steps-dots">${Array.from({ length: n }, (_, k) => `<i class="${k === on ? 'on' : ''}"></i>`).join('')}</div>`;
}

function onboarding() {
  setTabs(false);
  if (state.accepted && obStep < 3) obStep = 3;
  const go = (s) => { obStep = s; onboarding(); window.scrollTo(0, 0); };
  const back = (s) => `<button class="back" data-back="${s}" aria-label="Back">${icon('back', 26)}</button>`;

  if (obStep === 0) {
    app.innerHTML = `<div class="onb">
      <div class="rise-in">${scene({ height: 300 })}</div>
      <div class="grow rise-in d1">
        <h1>Breathe better.<br>Climb higher.</h1>
        <p class="lead">A few minutes of guided breath holds on your daily walk, built to boost your aerobic engine.</p>
      </div>
      <div class="foot rise-in d2">${dots(4, 0)}<button class="btn" id="next">Get started</button></div>
    </div>`;
    app.querySelector('#next').onclick = () => go(1);
  } else if (obStep === 1) {
    const f = (tile, ic, t, d, delay) => `<div class="card feature rise-in ${delay}"><div class="tile ${tile}">${icon(ic, 28)}</div><div><h3>${t}</h3><p>${d}</p></div></div>`;
    app.innerHTML = `<div class="onb">
      <div>${back(0)}</div>
      <div class="grow">
        <h1 style="text-align:left;margin-top:4px">How it works</h1>
        ${f('t-orange', 'map', 'Start with a baseline', 'Day 1 is one comfortable max breath hold while walking. It sets your starting point.', 'd1')}
        ${f('t-teal', 'walk', 'Walk and hold', 'Each day a calm voice guides timed holds after a gentle exhale, with upbeat music.', 'd2')}
        ${f('t-blue', 'phone', 'Pocket your phone', 'Pop in your earbuds and lock the screen. Sessions keep playing.', 'd3')}
        ${f('t-lav', 'up', 'Climb a little higher', 'Holds get longer and recoveries shorter as the weeks go by.', 'd4')}
      </div>
      <div class="foot">${dots(4, 1)}<button class="btn" id="next">Continue</button></div>
    </div>`;
    app.querySelector('#next').onclick = () => go(2);
  } else if (obStep === 2) {
    const items = [
      'Never practice breath holds in or near water, or while driving.',
      'Walk on a safe, familiar path away from traffic.',
      'Feel dizzy, tingly or unwell? Breathe right away. Holds can always end early.',
      'Pregnant, or have a heart, lung, blood pressure, seizure or panic condition? Check with a doctor first.',
    ];
    let agreed = false;
    app.innerHTML = `<div class="onb">
      <div>${back(1)}</div>
      <div class="grow">
        <div style="display:flex;align-items:center;gap:14px" class="rise-in">
          <div class="tile t-teal" style="width:56px;height:56px;border-radius:18px;display:grid;place-items:center">${icon('shield', 32)}</div>
          <h1 style="margin:0">Safety first</h1>
        </div>
        <div class="card safety rise-in d1"><ul>${items.map((t) => `<li><span class="dot">!</span><span>${t}</span></li>`).join('')}</ul></div>
        <button class="agree rise-in d2" id="agree"><span class="box">${icon('check', 20)}</span>I understand and will train safely</button>
      </div>
      <div class="foot">${dots(4, 2)}<button class="btn" id="next" disabled>Continue</button></div>
    </div>`;
    const ag = app.querySelector('#agree');
    const next = app.querySelector('#next');
    ag.onclick = () => { agreed = !agreed; ag.classList.toggle('on', agreed); next.disabled = !agreed; };
    next.onclick = () => { state.accepted = true; save(); go(3); };
  } else {
    let sel = 8;
    const cols = { 4: ['teal', 1], 8: ['blue', 2], 12: ['lav', 3] };
    const canBack = state.archive.length && !state.program;
    app.innerHTML = `<div class="onb">
      <div>${canBack ? `<button class="back" id="cancel" aria-label="Back">${icon('back', 26)}</button>` : '<div style="height:44px"></div>'}</div>
      <div class="grow">
        <h1 style="text-align:left;margin-top:4px">Choose your climb</h1>
        <p>One session a day, 5–10 minutes. Miss a day? You pick up right where you left off.</p>
        ${PRESETS.map((p, k) => {
          const [c, h] = cols[p.weeks];
          return `<button class="plan rise-in d${k + 1}${p.weeks === sel ? ' sel' : ''}" data-w="${p.weeks}" style="--c:var(--${c});--cl:var(--${c}-l)">
            ${p.weeks === 8 ? '<span class="rec">Recommended</span>' : ''}
            ${peak(h, `var(--${c})`)}
            <div><h3>${p.title}</h3><p>${p.blurb}<br>${sessionCount(p.weeks)} sessions</p></div></button>`;
        }).join('')}
      </div>
      <div class="foot">${state.archive.length ? '' : dots(4, 3)}<button class="btn" id="start">Start my climb</button></div>
    </div>`;
    app.querySelectorAll('.plan').forEach((b) => (b.onclick = () => {
      sel = Number(b.dataset.w);
      app.querySelectorAll('.plan').forEach((c) => c.classList.toggle('sel', c === b));
    }));
    app.querySelector('#start').onclick = () => {
      state.program = { weeks: sel, n: sessionCount(sel), startedAt: today(), results: [], difficulty: 1, seedBase: Math.floor(Math.random() * 1e6) };
      save();
      tab = 'today';
      view();
      window.scrollTo(0, 0);
    };
    const c = app.querySelector('#cancel');
    if (c) c.onclick = () => { state.program = state.archive.pop(); save(); view(); };
  }
  app.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => go(Number(b.dataset.back))));
}

// ---------- Home (Climb) ----------

function home() {
  const p = state.program;
  const i = p.results.length;
  const doneToday = p.results.some((r) => r.date === today());
  const finished = i >= p.n;
  const s = streak();
  const install = !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;

  let hero;
  if (finished) {
    const base = p.results[0]?.testSeconds;
    const last = latestTest(p.results);
    const gain = base ? Math.round(((last - base) / base) * 100) : 0;
    hero = `<div class="hero done rise-in">
      <div class="art">${mascot({ mood: 'cheer', size: 112 })}</div>
      <span class="tag">${icon('flag', 16)} Summit reached</span>
      <h1>You made it!</h1>
      <p>${p.weeks} weeks complete. Your hold went from ${base}s to ${last}s${gain ? ` (${gain > 0 ? '+' : ''}${gain}%)` : ''}.</p>
      <button class="btn white" id="new">Start a new climb</button></div>`;
  } else {
    const idx = doneToday ? i - 1 : i;
    const sess = sessionFor(idx);
    const kind = sess.kind;
    const test = isTestKind(kind);
    const desc = {
      baseline: 'One comfortable max hold while you walk. It sets your starting point.',
      retest: 'Same test as day 1. Let’s see how far you’ve climbed.',
      train: 'Walking breath holds after a gentle exhale.',
      light: 'An easier day to soak up the training.',
    }[kind];
    hero = `<div class="hero k-${kind}${doneToday ? ' done' : ''} rise-in">
      <div class="art">${mascot({ mood: doneToday ? 'cheer' : 'happy', size: 112 })}</div>
      <span class="tag">${icon(KIND_STYLE[kind].icon, 16)} ${doneToday ? 'Done today' : KIND_LABEL[kind]}</span>
      <h1>${doneToday ? 'Nice work!' : `Day ${i + 1}`}</h1>
      <p>${doneToday ? 'Today’s climb is complete. Your next session unlocks tomorrow.' : desc}</p>
      ${doneToday ? '' : `<div class="facts">
        ${test ? `<div class="fact"><b>1</b>test hold</div><div class="fact"><b>${minutes(sess.duration)} min</b>max</div>`
          : `<div class="fact"><b>${sess.rounds}</b>holds</div><div class="fact"><b>${sess.target}s</b>top hold</div><div class="fact"><b>${minutes(sess.duration)} min</b>total</div>`}
      </div>`}
      <button class="btn white" id="${doneToday ? 'again' : 'start'}">${doneToday ? 'Climb again' : 'Start'}</button></div>`;
  }

  app.innerHTML = `
    <div class="topbar">
      <div class="brand"><img src="icons/logo.svg" alt="">Altitude</div>
      <div class="chips">
        <div class="chip flame" title="Day streak">${icon('flame', 22)}${s}</div>
        <div class="chip day" title="Sessions done">${icon('peak', 22)}${Math.min(i, p.n)}</div>
      </div>
    </div>
    <p style="margin:0 0 10px;font-weight:800">${greeting()} \u{1F44B}</p>
    ${hero}
    ${install ? `<div class="card tip-card"><div class="tile t-blue">${icon('phone', 24)}</div><p><b>Install Altitude:</b> tap Share, then <b>Add to Home Screen</b>.</p></div>` : ''}
    ${pathHTML(p, i, doneToday)}`;

  const st = app.querySelector('#start');
  if (st) st.onclick = () => startSession(i, false);
  const ag = app.querySelector('#again');
  if (ag) ag.onclick = () => startSession(i - 1, true);
  const nw = app.querySelector('#new');
  if (nw) nw.onclick = () => { state.archive.push(state.program); state.program = null; obStep = 3; save(); view(); };
  const cur = app.querySelector('.node.current');
  if (cur) cur.onclick = () => (doneToday ? null : startSession(i, false));
}

function pathHTML(p, next, doneToday) {
  const OFF = [0, 1, 1.6, 1, 0, -1, -1.6, -1];
  let html = '';
  for (let w = 0; w < p.weeks; w++) {
    const s0 = w * 7, s1 = Math.min(p.n, s0 + 7);
    const done = Math.max(0, Math.min(7, next - s0));
    const locked = next < s0;
    const uc = UNIT_COLORS[w % UNIT_COLORS.length];
    html += `<div class="unit${locked ? ' locked' : ''}"${locked ? '' : ` style="${cvar(uc)}"`}>
      <div><div class="eyebrow">Week ${w + 1}</div><h3>${campName(w, p.weeks)}</h3></div>
      <div class="frac">${done}/${s1 - s0}</div></div><div class="path">`;
    for (let i = s0; i < s1; i++) {
      const kind = sessionKind(i, p.n);
      const ks = KIND_STYLE[kind];
      const color = kind === 'train' ? uc : ks.color;
      const isDone = i < next;
      const isCur = i === next;
      const off = OFF[(i - s0) % OFF.length] * 44;
      const cls = isDone ? 'done' : isCur ? 'current' : 'locked';
      const ic = isDone ? 'check' : ks.icon;
      const label = isCur ? (doneToday ? 'Tomorrow' : 'Start') : '';
      let side = '';
      if (isCur && !doneToday) side = `<div class="side-art" style="${off >= 0 ? 'right' : 'left'}:calc(100% + ${Math.abs(off) > 40 ? 10 : 40}px)">${mascot({ mood: 'happy', size: 74 })}</div>`;
      else if (i - s0 === 2 && !(next >= s0 && next < s1)) side = `<div class="side-art deco" style="right:calc(100% + 34px)">${peak(1 + (w % 3), locked ? 'var(--grey-d)' : `var(--${uc})`)}</div>`;
      else if (i - s0 === 6 && !(next >= s0 && next < s1)) side = `<div class="side-art deco" style="left:calc(100% + 84px)">${peak(1 + ((w + 1) % 3), locked ? 'var(--grey-d)' : `var(--${uc})`)}</div>`;
      html += `<div class="node-wrap${isCur ? ' cur' : ''}" style="transform:translateX(${off}px);${cvar(color)}">
        ${isCur ? `<div class="node-ring${doneToday ? '' : ' on'}"></div>${label ? `<div class="bubble">${label}</div>` : ''}` : ''}
        <button class="node ${cls}" aria-label="Day ${i + 1} ${KIND_LABEL[kind]}${isDone ? ', done' : ''}">${icon(ic, isCur ? 34 : 30)}</button>${side}</div>`;
    }
    html += '</div>';
  }
  html += `<div class="summit">${peak(3, 'var(--blue)')}<span>Summit</span></div>`;
  return html;
}

// ---------- Progress ----------

function progress() {
  const p = state.program;
  const res = p.results;
  const all = allResults();
  const base = res.find((r) => r.testSeconds)?.testSeconds;
  const last = latestTest(res);
  const gain = base && last && last !== base ? Math.round(((last - base) / base) * 100) : null;
  const mins = Math.round(all.reduce((a, r) => a + (r.duration || 0), 0) / 60);
  const holds = all.reduce((a, r) => a + (r.rounds || 0), 0);
  const stat = (ic, v, l, extra = '') => `<div class="stat">${icon(ic, 34)}<div><div class="v">${v}</div><div class="l">${l} ${extra}</div></div></div>`;

  app.innerHTML = `
    <div class="topbar"><h1 style="margin:0">Progress</h1></div>
    <div class="stats rise-in">
      ${stat('flame', streak(), 'day streak')}
      ${stat('medal', bestStreak(), 'best streak')}
      ${stat('peak', all.length, 'sessions')}
      ${stat('clock', mins, 'minutes')}
      ${stat('wind', holds, 'breath holds')}
      ${stat('trophy', last ? last + 's' : '–', 'latest test', gain ? `<span class="up">${gain > 0 ? '+' : ''}${gain}%</span>` : '')}
    </div>
    <h2>Hold targets</h2>
    <div class="card chart rise-in d1">${chart()}</div>
    <h2>Calendar</h2>
    <div class="card rise-in d2" id="calCard"></div>
    <h2>History</h2>
    <div class="card rise-in d3">${history()}</div>`;
  calendar();
}

function chart() {
  const p = state.program;
  if (!p.results.some((r) => r.testSeconds)) {
    return `<div style="display:flex;gap:14px;align-items:center">${mascot({ mood: 'happy', size: 72 })}<p style="margin:0">Finish your baseline test and your personal plan appears here.</p></div>`;
  }
  const W = 340, H = 190, L = 32, B = 24, T = 18, R = 10;
  const pts = [], plan = [];
  for (let i = 0; i < p.n; i++) {
    const kind = sessionKind(i, p.n);
    const done = p.results.find((r) => r.i === i);
    if (isTestKind(kind)) {
      if (done?.testSeconds) pts.push({ i, v: done.testSeconds, test: true });
      continue;
    }
    if (done?.target) pts.push({ i, v: done.target });
    else if (!done) plan.push({ i, v: trainingParams(i, p.n, latestTest(p.results, i) || 30, p.difficulty).target });
  }
  const maxV = Math.max(...pts.map((x) => x.v), ...plan.map((x) => x.v), 10) * 1.18;
  const x = (i) => L + ((W - L - R) * i) / Math.max(1, p.n - 1);
  const y = (v) => T + (H - T - B) * (1 - v / maxV);
  const line = (arr) => arr.map((q, k) => `${k ? 'L' : 'M'}${x(q.i).toFixed(1)},${y(q.v).toFixed(1)}`).join('');
  const trained = pts.filter((q) => !q.test);
  const area = trained.length > 1 ? `${line(trained)}L${x(trained[trained.length - 1].i)},${H - B}L${x(trained[0].i)},${H - B}Z` : '';
  const step = maxV > 60 ? 20 : 10;
  const ticks = [];
  for (let v = 0; v < maxV; v += step) ticks.push(v);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hold target per session">
    <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14C3A2" stop-opacity=".35"/><stop offset="1" stop-color="#14C3A2" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#F1E7DB" stroke-width="2"/><text x="${L - 6}" y="${y(v) + 4}" fill="#A9A8BF" font-size="11" font-weight="800" text-anchor="end">${v}s</text>`).join('')}
    ${[...Array(p.weeks + 1).keys()].filter((w) => w % (p.weeks > 8 ? 2 : 1) === 0).map((w) => `<text x="${x(Math.min(p.n - 1, w * 7))}" y="${H - 6}" fill="#A9A8BF" font-size="11" font-weight="800" text-anchor="middle">${w ? 'W' + w : 'Start'}</text>`).join('')}
    ${plan.length ? `<path d="${line(plan)}" fill="none" stroke="#C9C2FF" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>` : ''}
    ${area ? `<path d="${area}" fill="url(#ar)"/>` : ''}
    ${trained.length ? `<path d="${line(trained)}" fill="none" stroke="#14C3A2" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${pts.filter((q) => q.test).map((q) => `<circle cx="${x(q.i)}" cy="${y(q.v)}" r="7" fill="#FF8A3D" stroke="#fff" stroke-width="3"/><text x="${x(q.i)}" y="${y(q.v) - 12}" fill="#E2681B" font-size="12" font-weight="900" text-anchor="middle">${q.v}s</text>`).join('')}
  </svg>
  <div class="legend"><span><i style="background:#14C3A2"></i>Completed</span><span><i style="background:#C9C2FF"></i>Coming up</span><span><i style="background:#FF8A3D"></i>Test result</span></div>`;
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
    const dow = (first + d - 1) % 7;
    const done = days.has(key);
    const prev = d > 1 && dow > 0 && days.has(today(new Date(y, m, d - 1)));
    const next = d < count && dow < 6 && days.has(today(new Date(y, m, d + 1)));
    const shape = done ? (prev && next ? ' m' : prev ? ' r' : next ? ' l' : '') : '';
    cells.push(`<div class="d${done ? ' done' + shape : ''}${key === today() ? ' today' : ''}">${d}</div>`);
  }
  card.innerHTML = `
    <div class="cal-head"><button id="pm" aria-label="Previous month">${icon('back', 20)}</button><b>${calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button id="nm" aria-label="Next month">${icon('chevron', 20)}</button></div>
    <div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>`;
  card.querySelector('#pm').onclick = () => { calMonth = new Date(y, m - 1, 1); calendar(); };
  card.querySelector('#nm').onclick = () => { calMonth = new Date(y, m + 1, 1); calendar(); };
}

function history() {
  const res = [...state.program.results].reverse();
  if (!res.length) return `<div style="display:flex;gap:14px;align-items:center">${mascot({ mood: 'calm', size: 64 })}<p style="margin:0">No sessions yet. Your first climb is waiting.</p></div>`;
  const rate = { easy: 'Felt easy', right: 'Just right', hard: 'Felt hard' };
  return `<ul class="hist">${res.map((r) => {
    const ks = KIND_STYLE[r.kind];
    return `<li><div class="tile t-${ks.color}">${icon(ks.icon, 22)}</div>
      <div class="main"><b>Day ${r.i + 1} · ${KIND_LABEL[r.kind]}</b><span>${parseDay(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${r.rating ? ' · ' + rate[r.rating] : ''}</span></div>
      <div class="val">${r.testSeconds ? `${r.testSeconds}s<span>test hold</span>` : `${r.target}s<span>${r.rounds} holds</span>`}</div></li>`;
  }).join('')}</ul>`;
}

// ---------- Settings ----------

function settings() {
  const s = state.settings;
  const p = state.program;
  const slider = (id, tile, ic, label, min, val) => `<div class="row col"><div class="top"><div class="tile ${tile}">${icon(ic, 22)}</div><div class="main"><b>${label}</b></div><span class="pct" id="${id}v">${Math.round(val * 100)}%</span></div>
    <input type="range" id="${id}" min="${min}" max="1" step="0.05" value="${val}"></div>`;
  app.innerHTML = `
    <div class="topbar"><h1 style="margin:0">Settings</h1></div>
    <div class="eyebrow">Sound</div>
    <div class="group">
      ${slider('music', 't-orange', 'music', 'Music', 0, s.music)}
      ${slider('voice', 't-blue', 'voice', 'Voice', 0.4, s.voice)}
    </div>
    <div class="eyebrow">Your climb</div>
    <div class="group">
      <div class="row"><div class="tile t-teal">${icon('map', 22)}</div><div class="main"><b>${p.weeks}-week program</b><span>Day ${Math.min(p.results.length + 1, p.n)} of ${p.n} · difficulty ${Math.round(p.difficulty * 100)}%</span></div></div>
      <button class="row" id="change"><div class="tile t-lav">${icon('reset', 22)}</div><div class="main"><b>Start a new program</b><span>Your streak and history are kept</span></div><span class="chev">${icon('chevron', 20)}</span></button>
    </div>
    <div class="eyebrow">About</div>
    <div class="group">
      <button class="row" id="safety"><div class="tile t-pink">${icon('shield', 22)}</div><div class="main"><b>Safety tips</b><span>Read before you train</span></div><span class="chev">${icon('chevron', 20)}</span></button>
      <div class="row"><div class="tile t-sun">${icon('wind', 22).replace('#14C3A2', '#fff')}</div><div class="main"><b>The training</b><span>Walking breath holds after a gentle exhale raise CO₂ and mimic altitude, building CO₂ tolerance and breathing efficiency. Pair it with regular cardio for the biggest VO₂ max gains. Your ratings fine-tune the difficulty.</span></div></div>
    </div>
    <button class="btn danger" id="reset">Reset all data</button>
    <p style="text-align:center;font-size:13px;margin-top:18px;color:var(--ink3)">Altitude 2.0 · Voice by Kokoro</p>`;
  const bind = (id) => {
    const el = app.querySelector('#' + id);
    const paint = () => el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    paint();
    el.oninput = () => { s[id] = Number(el.value); app.querySelector(`#${id}v`).textContent = Math.round(s[id] * 100) + '%'; paint(); save(); };
  };
  bind('music');
  bind('voice');
  app.querySelector('#change').onclick = async () => {
    if (!(await sheet({ title: 'Start a new climb?', text: 'Your current program ends here. Your streak and history are kept.', ok: 'Start new climb', cancel: 'Keep climbing' }))) return;
    state.archive.push(state.program);
    state.program = null;
    obStep = 3;
    save();
    view();
  };
  app.querySelector('#safety').onclick = () => { state.accepted = false; obStep = 2; save(); view(); };
  app.querySelector('#reset').onclick = async () => {
    if (!(await sheet({ title: 'Reset everything?', text: 'This erases all programs, history and settings on this phone.', ok: 'Erase all data', cancel: 'Cancel', tone: 'pink' }))) return;
    state = defaults();
    obStep = 0;
    save();
    view();
  };
}

// ---------- Player ----------

let current = null; // { i, practice, session, url, testTap }
let raf = 0;
let lastMood = '';
const RING_C = 2 * Math.PI * 48;

function darkOverlay(inner, phase = 'calm') {
  overlay.className = 'overlay dark';
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  overlay.innerHTML = `<div class="bgs"><div class="bg-calm${phase === 'calm' ? ' on' : ''}"></div><div class="bg-breathe${phase === 'breathe' ? ' on' : ''}"></div><div class="bg-hold${phase === 'hold' ? ' on' : ''}"></div></div>${inner}`;
}

function lightOverlay(inner) {
  overlay.className = 'overlay';
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  overlay.innerHTML = inner;
}

async function startSession(i, practice) {
  const session = sessionFor(i);
  current = { i, practice, session, url: null, testTap: null };
  darkOverlay(`
    <div class="bar"><button class="x" id="cancel" aria-label="Cancel">${icon('close', 22)}</button></div>
    <div class="center">
      <div class="breath-anim">${mascot({ mood: 'calm', size: 170, glow: true })}</div>
      <h1>Mixing your session</h1>
      <p style="color:rgba(255,255,255,.85)">Voice and music, made fresh for today.</p>
      <div class="loadbar"><div id="lb"></div></div>
    </div>`);
  let cancelled = false;
  overlay.querySelector('#cancel').onclick = () => { cancelled = true; closePlayer(); };
  try {
    const blob = await renderSession(session, clips, state.settings, (f) => {
      const lb = overlay.querySelector('#lb');
      if (lb) lb.style.width = `${Math.round(f * 100)}%`;
    });
    if (cancelled) return;
    current.url = URL.createObjectURL(blob);
    audio.src = current.url;
    audio.load();
    readyScreen();
  } catch (err) {
    if (cancelled) return;
    console.error(err);
    darkOverlay(`<div class="center">${mascot({ mood: 'tired', size: 140 })}<h1>Hmm, that didn't work</h1><p style="color:#fff">${String(err.message || err)}</p></div>
      <div class="foot"><button class="btn white" id="close">Close</button></div>`);
    overlay.querySelector('#close').onclick = closePlayer;
  }
}

function readyScreen() {
  const s = current.session;
  const test = !!s.test;
  darkOverlay(`
    <div class="bar"><button class="x" id="cancel" aria-label="Cancel">${icon('close', 22)}</button></div>
    <div class="center">
      <div class="pop">${mascot({ mood: 'happy', size: 150, phones: true, glow: true })}</div>
      <h1>Ready when you are</h1>
      <ul class="howto">
        <li class="rise-in d1"><span class="n">${icon('ear', 20)}</span>Pop in your earbuds</li>
        <li class="rise-in d2"><span class="n">${icon('walk', 20)}</span>Tap Begin and start walking</li>
        <li class="rise-in d3"><span class="n">${icon('phone', 20)}</span>Pocket your phone. The voice leads.</li>
        ${test ? `<li class="rise-in d4"><span class="n">${icon('flag', 20)}</span>Tap your earbuds once when you release the test hold</li>` : ''}
      </ul>
    </div>
    <div class="foot"><button class="btn white" id="begin">${icon('play', 22)} Begin · ${fmtTime(s.duration)}</button></div>`);
  overlay.querySelector('#cancel').onclick = closePlayer;
  overlay.querySelector('#begin').onclick = begin;
}

function begin() {
  const s = current.session;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  audio.currentTime = 0;
  audio.play().catch((e) => alert('Could not start audio: ' + e.message));
  setupMediaSession();
  lastMood = '';
  const segs = Array.from({ length: s.test ? 1 : s.rounds }, () => '<i><s></s></i>').join('');
  darkOverlay(`
    <div class="bar"><button class="x" id="end" aria-label="End session">${icon('close', 22)}</button><div class="segs" id="segs">${segs}</div></div>
    <div class="center">
      <div class="plabel" id="plabel">Let's walk</div>
      <div class="stage">
        <div class="halo" id="h1"></div><div class="halo h2" id="h2"></div><div class="halo h3" id="h3"></div>
        <svg class="ring" viewBox="0 0 104 104"><circle class="tr" cx="52" cy="52" r="48"/><circle class="pr" id="ring" cx="52" cy="52" r="48" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
        <div class="face" id="face"></div>
      </div>
      <div class="pcount" id="count"></div>
      <div class="psub" id="psub"></div>
    </div>
    <div class="foot ctrl">
      <div class="pbar"><div class="track"><div class="fill" id="pb"></div></div><div class="times"><span id="tcur">0:00</span><span id="trem">-${fmtTime(s.duration)}</span></div></div>
      <button class="pp" id="pp" aria-label="Pause">${icon('pause', 30)}</button>
    </div>`, 'calm');
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
  const ph = phaseAt(s.phases, t) || { type: 'walk', label: t > s.duration - 8 ? 'All done' : 'Keep walking', start: t, end: t + 1 };
  const k = (t - ph.start) / Math.max(0.01, ph.end - ph.start);
  let b = 0.4, ring = 0, count = '', sub = '', label = ph.label, mood = 'happy', bg = 'calm';
  switch (ph.type) {
    case 'inhale': b = ease(k); label = 'Breathe in'; mood = 'calm'; bg = 'breathe'; sub = ph.label; break;
    case 'top': b = 1; label = 'Sip a little more'; mood = 'calm'; bg = 'breathe'; break;
    case 'exhale': b = 1 - ease(k); label = 'Breathe out'; mood = 'calm'; bg = 'breathe'; sub = ph.label; break;
    case 'hold':
      b = 0.08 + 0.03 * Math.sin(t * 3); ring = k; mood = 'hold'; bg = 'hold'; label = 'Hold';
      count = `${Math.max(0, Math.ceil(ph.end - t))}`; sub = 'Keep walking, stay loose';
      break;
    case 'test':
      b = 0.08 + 0.03 * Math.sin(t * 3); ring = ((t - ph.start) % 60) / 60; mood = 'hold'; bg = 'hold'; label = 'Hold';
      count = `${current.testTap != null ? current.testTap : Math.floor(t - ph.start)}<small>s</small>`;
      sub = 'Tap your earbuds when you release';
      break;
    case 'recover':
      b = 0.45 + 0.2 * Math.sin((2 * Math.PI * t) / 5); label = 'Recover';
      if (ph.next) { count = `${Math.max(0, Math.ceil(ph.next - t))}`; sub = 'Next hold in…'; } else sub = 'Easy breaths through your nose';
      break;
    case 'announce':
      b = 0.45 + 0.15 * Math.sin((2 * Math.PI * t) / 6); count = `${ph.hold}<small>s</small>`; sub = 'Next hold';
      break;
    default:
      b = 0.45 + 0.15 * Math.sin((2 * Math.PI * t) / 6);
      label = ph.label.split(' \u00B7 ')[0];
      sub = label === 'Walk' ? 'Nose breathing, easy pace' : label === 'Get ready' ? 'Big test hold coming up' : '';
  }
  const $ = (id) => overlay.querySelector('#' + id);
  const face = $('face');
  if (!face) return;
  overlay.querySelectorAll('.bgs > div').forEach((d) => d.classList.toggle('on', d.classList.contains('bg-' + bg)));
  if (mood !== lastMood) { face.innerHTML = mascot({ mood, size: 200 }); lastMood = mood; }
  face.style.transform = `scale(${(0.86 + 0.2 * b).toFixed(3)})`;
  $('h1').style.transform = `scale(${(0.72 + 0.28 * b).toFixed(3)})`;
  $('h2').style.transform = `scale(${(0.8 + 0.2 * b).toFixed(3)})`;
  $('h3').style.transform = `scale(${(0.88 + 0.12 * b).toFixed(3)})`;
  $('ring').style.strokeDashoffset = RING_C * (1 - ring);
  if ($('count').innerHTML !== count) $('count').innerHTML = count;
  $('plabel').textContent = label;
  $('psub').textContent = sub;
  $('pb').style.width = `${Math.min(100, (t / s.duration) * 100)}%`;
  $('tcur').textContent = fmtTime(t);
  $('trem').textContent = '-' + fmtTime(s.duration - t);
  const paused = audio.paused;
  if ($('pp').dataset.p !== String(paused)) { $('pp').dataset.p = String(paused); $('pp').innerHTML = icon(paused ? 'play' : 'pause', 30); }
  const segs = $('segs').children;
  if (s.test) {
    segs[0].firstChild.style.width = `${Math.min(100, (t / s.duration) * 100)}%`;
  } else if (ph.round != null) {
    for (let j = 0; j < segs.length; j++) {
      const w = j < ph.round || (j === ph.round && ph.type === 'recover') ? 100 : j === ph.round && ph.type === 'hold' ? k * 100 : 0;
      segs[j].firstChild.style.width = `${w}%`;
    }
  }
  raf = requestAnimationFrame(tick);
}

audio.addEventListener('timeupdate', () => {
  if (!current || current.practice || !current.session) return;
  if (audio.currentTime > current.session.duration - 15 && !state.pending) {
    state.pending = pendingRecord();
    save();
  }
});

audio.addEventListener('ended', () => {
  if (current && current.session) finishScreen();
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

async function endEarly() {
  const s = current.session;
  const nearlyDone = audio.currentTime > s.duration * 0.85 || (s.test && audio.currentTime > s.test.resume);
  if (nearlyDone && !current.practice) {
    if (await sheet({ title: 'Finish early?', text: 'You’re nearly at the top. This session will count as done.', ok: 'Finish session', cancel: 'Keep going' })) {
      audio.pause();
      finishScreen();
    }
    return;
  }
  const ok = await sheet({
    title: 'Leave this session?',
    text: current.practice ? 'This was a bonus climb, so nothing changes.' : 'It won’t count toward your program. You can start again any time today.',
    ok: 'Leave', cancel: 'Keep climbing', tone: 'pink',
  });
  if (ok) {
    if (!current.practice) { state.pending = null; save(); }
    closePlayer();
  }
}

function finishScreen(rec) {
  cancelAnimationFrame(raf);
  if (!rec) {
    if (current.practice) {
      lightOverlay(`${confetti()}<div class="center">
        <div class="pop">${mascot({ mood: 'cheer', size: 170 })}</div>
        <h1 class="rise-in d1">Bonus climb done!</h1>
        <p class="rise-in d2">Extra practice doesn’t change your plan, but it all counts as training.</p></div>
        <div class="foot"><button class="btn" id="close">Continue</button></div>`);
      overlay.querySelector('#close').onclick = closePlayer;
      return;
    }
    rec = state.pending && state.pending.i === current.i ? { ...state.pending, testTap: current.testTap ?? state.pending.testTap } : pendingRecord();
    state.pending = rec;
    save();
  }
  if (isTestKind(rec.kind)) testResult(rec);
  else celebrate(rec);
}

function celebrate(rec) {
  lightOverlay(`${confetti()}<div class="center">
      <div class="pop">${mascot({ mood: 'cheer', size: 170 })}</div>
      <h1 class="rise-in d1">Day ${rec.i + 1} complete!</h1>
      <p class="rise-in d2">${rec.kind === 'light' ? 'Easy day, well spent. Recovery is part of the climb.' : 'You climbed a little higher today.'}</p>
      <div class="tiles3 rise-in d3">
        <div class="rtile"><div class="h">Holds</div><div class="b">${icon('wind', 22)}${rec.rounds}</div></div>
        <div class="rtile o"><div class="h">Top hold</div><div class="b">${rec.target}s</div></div>
        <div class="rtile l"><div class="h">Time</div><div class="b">${minutes(rec.duration)}m</div></div>
      </div>
    </div>
    <div class="foot"><button class="btn" id="next">Continue</button></div>`);
  overlay.querySelector('#next').onclick = () => rateScreen(rec);
}

function rateScreen(rec) {
  let choice = null;
  const opt = (r, mood, t, d) => `<button data-r="${r}">${mascot({ mood, size: 52 })}<div>${t}<span>${d}</span></div></button>`;
  lightOverlay(`<div class="center">
      <h1>How did that feel?</h1>
      <p>Your answer fine-tunes the next sessions.</p>
      <div class="rate">
        ${opt('easy', 'cheer', 'Too easy', 'Push me harder')}
        ${opt('right', 'happy', 'Just right', 'Keep the plan')}
        ${opt('hard', 'tired', 'Too hard', 'Ease off a little')}
      </div>
    </div>
    <div class="foot"><button class="btn" id="save" disabled>Continue</button></div>`);
  const saveBtn = overlay.querySelector('#save');
  overlay.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
    choice = b.dataset.r;
    overlay.querySelectorAll('[data-r]').forEach((c) => c.classList.toggle('sel', c === b));
    saveBtn.disabled = false;
  }));
  saveBtn.onclick = () => commit({ ...rec, rating: choice });
}

function testResult(rec) {
  let v = rec.testTap ?? (latestTest(state.program.results) || 30);
  lightOverlay(`<div class="center">
      <div class="pop">${mascot({ mood: 'wow', size: 150 })}</div>
      <h1>Great hold!</h1>
      <p>${rec.testTap != null ? `We caught your earbud tap at <b>${rec.testTap}s</b>. Adjust if it’s off.` : 'What was the last number you heard before you breathed?'}</p>
      <div class="stepper">
        <button data-d="-5">−5</button><button data-d="-1">−1</button>
        <output id="val">${v}<small>s</small></output>
        <button data-d="1">+1</button><button data-d="5">+5</button>
      </div>
    </div>
    <div class="foot"><button class="btn orange" id="saveT">Save my result</button></div>`);
  overlay.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
    v = Math.max(5, Math.min(180, v + Number(b.dataset.d)));
    overlay.querySelector('#val').innerHTML = `${v}<small>s</small>`;
  }));
  overlay.querySelector('#saveT').onclick = () => commit({ ...rec, testSeconds: v });
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
  const days = new Set(allResults().map((r) => r.date));
  const week = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date();
    d.setDate(d.getDate() - k);
    week.push({ l: d.toLocaleDateString(undefined, { weekday: 'narrow' }), on: days.has(today(d)), today: k === 0 });
  }
  lightOverlay(`${done ? confetti(60) : ''}<div class="center">
      ${done ? `<div class="pop">${mascot({ mood: 'cheer', size: 170 })}</div><h1>You reached the summit!</h1><p>${p.weeks} weeks of training, complete. Incredible work.</p>`
        : `<div class="big-flame pop">${icon('flame', 120)}<div class="num">${s}</div></div>
           <h1 class="rise-in d1" style="color:var(--orange)">day streak!</h1>
           <p class="rise-in d2">${rec.testSeconds ? `Test hold saved: <b>${rec.testSeconds}s</b>. Your plan is set from this.` : s > 1 ? 'You’re on a roll. Come back tomorrow to keep it going.' : 'Every climb starts with one step. See you tomorrow!'}</p>
           <div class="week rise-in d3">${week.map((d) => `<div class="${d.today ? 'today' : ''}"><i class="${d.on ? 'on' : ''}">${d.on ? icon('check', 18) : ''}</i>${d.l}</div>`).join('')}</div>`}
    </div>
    <div class="foot"><button class="btn${done ? '' : ' orange'}" id="close">Continue</button></div>`);
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
    app.innerHTML = `<div style="text-align:center;padding-top:80px">${mascot({ mood: 'tired', size: 140 })}<h1>Can’t load Altitude</h1><p>Check your connection and reload.</p></div>`;
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
