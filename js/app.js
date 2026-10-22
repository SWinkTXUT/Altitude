import { PRESETS, KIND_LABEL, sessionCount, sessionKind, trainingParams, latestTest, adjustDifficulty } from './program.js';
import { buildSession } from './script.js';
import { renderSession } from './audio.js';
import { landscape, timeMood, icon } from './art.js';

const KEY = 'altitude.v1';
const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const overlay = document.getElementById('overlay');
const audio = document.getElementById('player');
const backdrop = document.getElementById('backdrop');

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
const isTestKind = (k) => k === 'baseline' || k === 'retest';

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

// ---------- The climb: each completed day gains altitude toward the summit ----------

const BASE_ALT = 1200;
const SUMMIT = { 4: 4000, 8: 6000, 12: 8000 };
const CAMPS = ['Base Camp', 'Foothills', 'Pine Trail', 'Treeline', 'Alpine Meadow', 'Rocky Ridge', 'Glacier', 'High Camp', 'Thin Air', 'Cloud Line', 'Summit Ridge', 'Summit Push'];

const summitOf = (weeks) => SUMMIT[weeks] || BASE_ALT + weeks * 400;
function altitude(i, p) {
  const f = Math.min(1, Math.max(0, i / p.n));
  const wig = f > 0 && f < 1 ? Math.sin(i * 1.7) * 0.01 + Math.sin(i * 0.55) * 0.015 : 0;
  return Math.round((BASE_ALT + (summitOf(p.weeks) - BASE_ALT) * (Math.pow(f, 0.92) + wig)) / 10) * 10;
}
const fmtAlt = (m) => m.toLocaleString('en-US');
function campName(w, weeks) {
  return CAMPS[weeks === 1 ? 0 : Math.round((w * (CAMPS.length - 1)) / (weeks - 1))];
}

const KIND_ICON = { train: 'wind', light: 'leaf', baseline: 'flag', retest: 'flag' };
const KIND_TITLE = { train: 'Walking breath holds', light: 'Easy recovery walk', baseline: 'Baseline breath hold', retest: 'Retest your hold' };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ---------- Backdrop ----------

const sceneCache = {};
function scene(mood, seed = 11, horizon = 0.5) {
  const k = `${mood}${seed}-${horizon}`;
  return sceneCache[k] || (sceneCache[k] = landscape(mood, { seed, horizon }));
}

function setBackdrop(mood, deep = false, horizon = 0.5) {
  const key = mood + horizon;
  if (backdrop.dataset.key !== key) {
    backdrop.innerHTML = `<div class="layer on">${scene(mood, 11, horizon)}</div><div class="shade"></div>`;
    backdrop.dataset.key = key;
  }
  backdrop.dataset.mood = mood;
  backdrop.classList.toggle('deep', deep);
}

// ---------- Sheet (confirm) ----------

function sheet({ title, text, ok = 'OK', cancel = 'Cancel', tone = '' }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <h2>${title}</h2><p>${text}</p>
      <button class="pill ${tone}" data-v="1">${ok}</button>
      <button class="pill text" data-v="0">${cancel}</button></div>`;
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
  app.style.animation = 'none';
  void app.offsetWidth;
  app.style.animation = '';
  if (!state.accepted || !state.program) return onboarding();
  setTabs(true);
  if (tab === 'progress') return progress();
  if (tab === 'settings') return settings();
  return home();
}

tabs.innerHTML = [
  ['today', 'peak', 'Today'],
  ['progress', 'chart', 'Progress'],
  ['settings', 'settings', 'Settings'],
].map(([t, ic, l]) => `<button data-tab="${t}" class="tab" aria-label="${l}">${icon(ic, 22)}<span>${l}</span></button>`).join('');

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b || b.dataset.tab === tab) return;
  tab = b.dataset.tab;
  view();
  window.scrollTo(0, 0);
});

// ---------- Onboarding ----------

function dots(n, on) {
  return `<div class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k === on ? 'on' : ''}"></i>`).join('')}</div>`;
}

function peakGlyph(h) {
  const top = [0, 16, 10, 4][h];
  return `<svg width="40" height="28" viewBox="0 0 40 28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M2 26 L${20 - (26 - top) * 0.62} ${(26 + top) / 2} L20 ${top} L${20 + (26 - top) * 0.7} 26"/><path d="M14 26 L${26 + h} ${16 - h * 2} L38 26"/></svg>`;
}

function onboarding() {
  setTabs(false);
  if (state.accepted && obStep < 3) obStep = 3;
  setBackdrop('dawn', obStep > 0);
  const go = (s) => { obStep = s; view(); window.scrollTo(0, 0); };
  const back = (s) => `<button class="back" data-back="${s}" aria-label="Back">${icon('back', 24)}</button>`;

  if (obStep === 0) {
    app.innerHTML = `<div class="onb">
      <div class="top"><div class="wordmark">Altitude</div></div>
      <div class="hero-text rise">
        <h1>Breathe deeper.<br>Climb higher.</h1>
        <p>A few quiet minutes of guided breath holds on your daily walk, built to strengthen your aerobic engine.</p>
      </div>
      <div class="foot rise d1" style="margin-top:28px">${dots(4, 0)}<button class="pill" id="next">Get started</button></div>
    </div>`;
    app.querySelector('#next').onclick = () => go(1);
  } else if (obStep === 1) {
    const li = (ic, t, d) => `<li>${icon(ic, 22)}<div><b>${t}</b><span>${d}</span></div></li>`;
    app.innerHTML = `<div class="onb">
      <div>${back(0)}</div>
      <div class="grow">
        <h1 class="rise" style="margin:18px 0 24px">How it works</h1>
        <div class="glass rise d1"><ul class="list">
          ${li('flag', 'Find your baseline', 'Day one is a single comfortable breath hold while you walk.')}
          ${li('walk', 'Walk and hold', 'A calm voice guides timed holds after a gentle exhale, set to music.')}
          ${li('phone', 'Pocket your phone', 'Earbuds in, screen locked. The session keeps playing.')}
          ${li('up', 'Climb a little higher', 'Holds lengthen and recoveries shorten as the weeks go by.')}
        </ul></div>
      </div>
      <div class="foot">${dots(4, 1)}<button class="pill" id="next">Continue</button></div>
    </div>`;
    app.querySelector('#next').onclick = () => go(2);
  } else if (obStep === 2) {
    const items = [
      'Never practice breath holds in or near water, or while driving.',
      'Walk on a safe, familiar path away from traffic.',
      'If you feel dizzy, tingly or unwell, breathe right away. A hold can always end early.',
      'If you are pregnant or have a heart, lung, blood pressure, seizure or panic condition, check with a doctor first.',
    ];
    let agreed = false;
    app.innerHTML = `<div class="onb">
      <div>${back(1)}</div>
      <div class="grow">
        <h1 class="rise" style="margin:18px 0 24px">Before you begin</h1>
        <div class="glass rise d1"><ul class="list">${items.map((t, k) => `<li><span class="n">0${k + 1}</span><span style="color:var(--text)">${t}</span></li>`).join('')}</ul></div>
        <button class="agree rise d2" id="agree"><span class="box">${icon('check', 16)}</span>I understand and will train safely</button>
      </div>
      <div class="foot">${dots(4, 2)}<button class="pill" id="next" disabled>Continue</button></div>
    </div>`;
    const ag = app.querySelector('#agree');
    const next = app.querySelector('#next');
    ag.onclick = () => { agreed = !agreed; ag.classList.toggle('on', agreed); next.disabled = !agreed; };
    next.onclick = () => { state.accepted = true; save(); go(3); };
  } else {
    let sel = 8;
    const canBack = state.archive.length && !state.program;
    app.innerHTML = `<div class="onb">
      <div>${canBack ? `<button class="back" id="cancel" aria-label="Back">${icon('back', 24)}</button>` : '<div style="height:44px"></div>'}</div>
      <div class="grow">
        <h1 class="rise" style="margin:18px 0 8px">Choose your climb</h1>
        <p class="rise d1" style="margin-bottom:22px">One session a day, five to ten minutes. Miss a day and you simply pick up where you left off.</p>
        ${PRESETS.map((p, k) => `<button class="glass choice rise d${k + 1}${p.weeks === sel ? ' sel' : ''}" data-w="${p.weeks}">
            ${peakGlyph(k + 1)}
            <div class="t">${p.weeks === 8 ? '<span class="tag">Recommended</span>' : ''}<b>${p.title}</b><span>${sessionCount(p.weeks)} sessions</span></div>
            <div class="elev"><b>${fmtAlt(summitOf(p.weeks))} m</b>summit</div></button>`).join('')}
      </div>
      <div class="foot">${state.archive.length ? '' : dots(4, 3)}<button class="pill" id="start">Begin the climb</button></div>
    </div>`;
    app.querySelectorAll('.choice').forEach((b) => (b.onclick = () => {
      sel = Number(b.dataset.w);
      app.querySelectorAll('.choice').forEach((c) => c.classList.toggle('sel', c === b));
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

// ---------- Today ----------

function home() {
  setBackdrop(timeMood(), false, 0.58);
  const p = state.program;
  const i = p.results.length;
  const doneToday = p.results.some((r) => r.date === today());
  const finished = i >= p.n;
  const s = streak();
  const install = !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
  const week = Math.min(p.weeks - 1, Math.floor(Math.min(i, p.n - 1) / 7));
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  let card;
  if (finished) {
    const base = p.results[0]?.testSeconds;
    const last = latestTest(p.results);
    card = `<div class="glass today rise d1">
      <div class="eyebrow">Summit reached</div>
      <h2>You made it to ${fmtAlt(summitOf(p.weeks))} m</h2>
      <p>${p.weeks} weeks complete. Your breath hold went from ${base} to ${last} seconds.</p>
      <button class="pill" id="new">Start a new climb</button></div>`;
  } else if (doneToday) {
    card = `<div class="glass today rise d1">
      <div class="eyebrow">Today · complete</div>
      <h2>Rest well. You climbed today.</h2>
      <p>Day ${i + 1} opens tomorrow.</p>
      <button class="pill soft" id="again">${icon('reset', 18)} Practice again</button></div>`;
  } else {
    const sess = sessionFor(i);
    const kind = sess.kind;
    const meta = isTestKind(kind)
      ? `<span>${icon('clock', 16)}${minutes(sess.duration)} min</span><span>${icon('flag', 16)}One test hold</span>`
      : `<span>${icon('clock', 16)}${minutes(sess.duration)} min</span><span>${icon('wind', 16)}${sess.rounds} holds</span><span>Up to ${sess.target} s</span>`;
    card = `<div class="glass today rise d1">
      <div class="eyebrow">Today · ${KIND_LABEL[kind]}</div>
      <h2>${KIND_TITLE[kind]}</h2>
      <div class="meta">${meta}</div>
      <button class="pill" id="start">${icon('play', 18)} Begin</button></div>`;
  }

  app.innerHTML = `
    <div class="top">
      <div class="wordmark">Altitude</div>
      <div class="streak" title="Day streak">${icon('flame', 16)}<span class="num">${s}</span></div>
    </div>
    <div class="greet rise">
      <div class="date">${date}</div>
      <h1>${greeting()}</h1>
    </div>
    <div class="spacer"></div>
    ${card}
    ${ascentCard(p, i, week)}
    ${weekCard()}
    ${install ? `<div class="glass hint rise d4">${icon('share', 22)}<p>For the full experience, tap <b>Share</b> then <b>Add to Home Screen</b>.</p></div>` : ''}`;

  const st = app.querySelector('#start');
  if (st) st.onclick = () => startSession(i, false);
  const ag = app.querySelector('#again');
  if (ag) ag.onclick = () => startSession(i - 1, true);
  const nw = app.querySelector('#new');
  if (nw) nw.onclick = () => { state.archive.push(state.program); state.program = null; obStep = 3; save(); view(); };
}

function ascentCard(p, i, week) {
  const W = 320, H = 96;
  const top = summitOf(p.weeks);
  const x = (k) => (k / p.n) * W;
  const y = (a) => H - 6 - ((a - BASE_ALT) / (top - BASE_ALT)) * (H - 16);
  const pts = Array.from({ length: p.n + 1 }, (_, k) => `${x(k).toFixed(1)},${y(altitude(k, p)).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const done = 'M' + pts.slice(0, i + 1).join(' L');
  const cx = x(i), cy = y(altitude(i, p));
  const camps = Array.from({ length: p.weeks - 1 }, (_, w) => (w + 1) * 7).map((k) => `<circle cx="${x(k)}" cy="${y(altitude(k, p))}" r="1.6" fill="rgba(255,255,255,.55)"/>`).join('');
  return `<div class="glass ascent rise d2">
    <div class="eyebrow">Your ascent</div>
    <div class="alt"><span class="v num">${fmtAlt(altitude(i, p))}</span><span class="u">m</span></div>
    <div class="where">Week ${week + 1} · ${campName(week, p.weeks)}</div>
    <svg viewBox="0 0 ${W} ${H}" aria-label="Elevation profile of your program">
      <defs><linearGradient id="asc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="${line} L${W},${H} L0,${H} Z" fill="rgba(255,255,255,.05)"/>
      <path d="${line}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2" stroke-dasharray="2 4" stroke-linecap="round"/>
      ${i > 0 ? `<path d="${done} L${cx},${H} L0,${H} Z" fill="url(#asc)"/><path d="${done}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      ${camps}
      <circle cx="${cx}" cy="${cy}" r="11" fill="#fff" opacity=".14"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="#fff"/>
    </svg>
    <div class="ends"><span>Base camp · ${fmtAlt(BASE_ALT)} m</span><span>Summit · ${fmtAlt(top)} m</span></div>
  </div>`;
}

function weekCard() {
  const days = new Set(allResults().map((r) => r.date));
  const cells = [];
  for (let k = 6; k >= 0; k--) {
    const d = new Date();
    d.setDate(d.getDate() - k);
    const on = days.has(today(d));
    cells.push(`<div class="${k === 0 ? 'today' : ''}"><i class="${on ? 'on' : ''}">${on ? icon('check', 14) : ''}</i>${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</div>`);
  }
  return `<div class="glass rise d3"><div class="eyebrow">This week</div><div class="week">${cells.join('')}</div></div>`;
}

// ---------- Progress ----------

function progress() {
  setBackdrop('night', true);
  const p = state.program;
  const res = p.results;
  const all = allResults();
  const base = res.find((r) => r.testSeconds)?.testSeconds;
  const last = latestTest(res);
  const gain = base && last && last !== base ? Math.round(((last - base) / base) * 100) : null;
  const mins = Math.round(all.reduce((a, r) => a + (r.duration || 0), 0) / 60);
  const holds = all.reduce((a, r) => a + (r.rounds || 0), 0);
  const stat = (ic, v, unit, l, d) => `<div class="glass stat rise ${d}">${icon(ic, 20)}<div class="v num">${v}${unit ? `<small>${unit}</small>` : ''}</div><div class="l">${l}</div></div>`;

  app.innerHTML = `
    <div class="top"><div class="wordmark">Altitude</div></div>
    <h1 class="page-title rise">Progress</h1>
    <div class="stats">
      ${stat('flame', streak(), '', 'Day streak', '')}
      ${stat('peak', fmtAlt(altitude(res.length, p)), 'm', 'Altitude', 'd1')}
      ${stat('trophy', last || '–', last ? 's' : '', gain ? `Latest test <span class="up">${gain > 0 ? '+' : ''}${gain}%</span>` : 'Latest test', 'd1')}
      ${stat('clock', mins, 'min', 'Time trained', 'd2')}
      ${stat('wind', holds, '', 'Breath holds', 'd2')}
      ${stat('up', bestStreak(), '', 'Best streak', 'd3')}
    </div>
    <div class="glass chart rise d3"><div class="eyebrow">Hold targets</div>${chart()}</div>
    <div class="glass rise d4" id="calCard"></div>
    <div class="glass rise d4"><div class="eyebrow" style="margin-bottom:16px">History</div>${history()}</div>`;
  calendar();
}

function chart() {
  const p = state.program;
  if (!p.results.some((r) => r.testSeconds)) return '<p style="margin:12px 0 0">Complete your baseline test and your plan will appear here.</p>';
  const W = 320, H = 150, L = 26, B = 20, T = 18, R = 6;
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
  const maxV = Math.max(...pts.map((x) => x.v), ...plan.map((x) => x.v), 10) * 1.2;
  const x = (i) => L + ((W - L - R) * i) / Math.max(1, p.n - 1);
  const y = (v) => T + (H - T - B) * (1 - v / maxV);
  const line = (arr) => arr.map((q, k) => `${k ? 'L' : 'M'}${x(q.i).toFixed(1)},${y(q.v).toFixed(1)}`).join('');
  const trained = pts.filter((q) => !q.test);
  const area = trained.length > 1 ? `${line(trained)}L${x(trained[trained.length - 1].i)},${H - B}L${x(trained[0].i)},${H - B}Z` : '';
  const step = maxV > 60 ? 20 : 10;
  const ticks = [];
  for (let v = step; v < maxV; v += step) ticks.push(v);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hold target per session">
    <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="${L - 8}" y="${y(v) + 3.5}" fill="rgba(255,255,255,.4)" font-size="10" text-anchor="end">${v}s</text>`).join('')}
    ${[...Array(p.weeks + 1).keys()].filter((w) => w % (p.weeks > 8 ? 3 : p.weeks > 4 ? 2 : 1) === 0).map((w) => `<text x="${x(Math.min(p.n - 1, w * 7))}" y="${H - 4}" fill="rgba(255,255,255,.4)" font-size="10" text-anchor="middle">${w ? 'Week ' + w : 'Start'}</text>`).join('')}
    ${plan.length ? `<path d="${line(plan)}" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.2" stroke-dasharray="2 4" stroke-linecap="round"/>` : ''}
    ${area ? `<path d="${area}" fill="url(#ar)"/>` : ''}
    ${trained.length ? `<path d="${line(trained)}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${pts.filter((q) => q.test).map((q) => `<circle cx="${x(q.i)}" cy="${y(q.v)}" r="4" fill="#FFC9A8"/><text x="${x(q.i) + 8}" y="${y(q.v) - 8}" fill="#FFC9A8" font-size="11" font-weight="500">${q.v}s</text>`).join('')}
  </svg>
  <div class="legend"><span><i style="background:#fff"></i>Completed</span><span><i style="background:rgba(255,255,255,.3)"></i>Planned</span><span><i style="background:#FFC9A8"></i>Test</span></div>`;
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
    <div class="cal-head"><button id="pm" aria-label="Previous month">${icon('back', 18)}</button><b>${calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button id="nm" aria-label="Next month">${icon('chevron', 18)}</button></div>
    <div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>`;
  card.querySelector('#pm').onclick = () => { calMonth = new Date(y, m - 1, 1); calendar(); };
  card.querySelector('#nm').onclick = () => { calMonth = new Date(y, m + 1, 1); calendar(); };
}

function history() {
  const res = [...state.program.results].reverse();
  if (!res.length) return '<p style="margin:0">Your sessions will appear here.</p>';
  const rate = { easy: 'Felt easy', right: 'Just right', hard: 'Felt hard' };
  return `<ul class="hist">${res.map((r) => `<li>${icon(KIND_ICON[r.kind], 20)}
      <div class="main"><b>Day ${r.i + 1} · ${KIND_LABEL[r.kind]}</b><span>${parseDay(r.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${r.rating ? ' · ' + rate[r.rating] : ''}</span></div>
      <div class="val">${r.testSeconds ? `${r.testSeconds}s<span>test hold</span>` : `${r.target}s<span>${r.rounds} holds</span>`}</div></li>`).join('')}</ul>`;
}

// ---------- Settings ----------

function settings() {
  setBackdrop('night', true);
  const s = state.settings;
  const p = state.program;
  const slider = (id, ic, label, min, val) => `<div class="row col"><div class="head">${icon(ic, 22)}<div class="main"><b>${label}</b></div><span class="pct" id="${id}v">${Math.round(val * 100)}%</span></div>
    <input type="range" id="${id}" min="${min}" max="1" step="0.05" value="${val}" aria-label="${label} volume"></div>`;
  app.innerHTML = `
    <div class="top"><div class="wordmark">Altitude</div></div>
    <h1 class="page-title rise">Settings</h1>
    <div class="eyebrow section">Sound</div>
    <div class="glass group rise d1">
      ${slider('music', 'music', 'Music', 0, s.music)}
      ${slider('voice', 'voice', 'Voice', 0.4, s.voice)}
    </div>
    <div class="eyebrow section">Your climb</div>
    <div class="glass group rise d2">
      <div class="row">${icon('map', 22)}<div class="main"><b>${p.weeks}-week program</b><span>Day ${Math.min(p.results.length + 1, p.n)} of ${p.n} · summit ${fmtAlt(summitOf(p.weeks))} m · difficulty ${Math.round(p.difficulty * 100)}%</span></div></div>
      <button class="row" id="change">${icon('reset', 22)}<div class="main"><b>Start a new climb</b><span>Your streak and history are kept</span></div><span class="chev">${icon('chevron', 18)}</span></button>
    </div>
    <div class="eyebrow section">About</div>
    <div class="glass group rise d3">
      <button class="row" id="safety">${icon('shield', 22)}<div class="main"><b>Safety</b><span>Read before you train</span></div><span class="chev">${icon('chevron', 18)}</span></button>
      <div class="row">${icon('info', 22)}<div class="main"><b>The training</b><span>Walking breath holds after a gentle exhale raise CO₂ and mimic altitude, building CO₂ tolerance and breathing efficiency. Pair them with regular cardio for the biggest VO₂ max gains. Your ratings fine-tune the difficulty.</span></div></div>
    </div>
    <button class="pill warn rise d4" id="reset" style="margin-top:24px">Reset all data</button>
    <p class="foot-note">Altitude 3.0 · Voice by Kokoro</p>`;
  const bind = (id) => {
    const el = app.querySelector('#' + id);
    const paint = () => el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
    paint();
    el.oninput = () => { s[id] = Number(el.value); app.querySelector(`#${id}v`).textContent = Math.round(s[id] * 100) + '%'; paint(); save(); };
  };
  bind('music');
  bind('voice');
  app.querySelector('#change').onclick = async () => {
    if (!(await sheet({ title: 'Start a new climb?', text: 'Your current program ends here. Your streak and history are kept.', ok: 'Start a new climb', cancel: 'Keep climbing' }))) return;
    state.archive.push(state.program);
    state.program = null;
    obStep = 3;
    save();
    view();
  };
  app.querySelector('#safety').onclick = () => { state.accepted = false; obStep = 2; save(); view(); };
  app.querySelector('#reset').onclick = async () => {
    if (!(await sheet({ title: 'Reset everything?', text: 'This erases all programs, history and settings on this phone.', ok: 'Erase all data', cancel: 'Cancel', tone: 'warn' }))) return;
    state = defaults();
    obStep = 0;
    save();
    view();
  };
}

// ---------- Player ----------

let current = null; // { i, practice, session, url, testTap }
let raf = 0;
let lastBg = '';
const RING_C = 2 * Math.PI * 48;

// Full-screen flow over its own landscape; moods crossfade during the session.
function flow(inner, moods = ['dusk'], active = moods[0], seed = 23) {
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  lastBg = active;
  overlay.innerHTML = `<div class="backdrop deep">${moods.map((m) => `<div class="layer${m === active ? ' on' : ''}" data-m="${m}">${scene(m, seed)}</div>`).join('')}<div class="shade"></div></div>${inner}`;
}

async function startSession(i, practice) {
  const session = sessionFor(i);
  current = { i, practice, session, url: null, testTap: null };
  flow(`
    <div class="bar"><button class="x" id="cancel" aria-label="Cancel">${icon('close', 18)}</button></div>
    <div class="center">
      <div class="stage" style="width:180px"><div class="orb breathing"></div></div>
      <h1 class="rise">Preparing your session</h1>
      <p class="rise d1">Mixing voice and music for today’s climb.</p>
      <div class="loadline"><div id="lb"></div></div>
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
    flow(`<div class="center"><h1>Something went wrong</h1><p>${String(err.message || err)}</p></div>
      <div class="foot"><button class="pill" id="close">Close</button></div>`);
    overlay.querySelector('#close').onclick = closePlayer;
  }
}

function readyScreen() {
  const s = current.session;
  const li = (ic, t) => `<li>${icon(ic, 22)}<div><span style="color:var(--text);font-size:16px">${t}</span></div></li>`;
  flow(`
    <div class="bar"><button class="x" id="cancel" aria-label="Cancel">${icon('close', 18)}</button></div>
    <div class="center">
      <div class="eyebrow rise">Day ${current.i + 1} · ${KIND_LABEL[s.kind]}</div>
      <h1 class="rise d1" style="margin-top:12px">Find your trail</h1>
      <div class="glass steps rise d2"><ul class="list">
        ${li('headphones', 'Put in your earbuds')}
        ${li('walk', 'Tap begin and start walking')}
        ${li('phone', 'Pocket your phone. The voice will guide you.')}
        ${s.test ? li('flag', 'Tap an earbud once when you release the test hold') : ''}
      </ul></div>
    </div>
    <div class="foot rise d3"><button class="pill" id="begin">${icon('play', 18)} Begin · ${fmtTime(s.duration)}</button></div>`);
  overlay.querySelector('#cancel').onclick = closePlayer;
  overlay.querySelector('#begin').onclick = begin;
}

function begin() {
  const s = current.session;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  audio.currentTime = 0;
  audio.play().catch((e) => alert('Could not start audio: ' + e.message));
  setupMediaSession();
  const segs = Array.from({ length: s.test ? 1 : s.rounds }, () => '<i><s></s></i>').join('');
  flow(`
    <div class="bar"><button class="x" id="end" aria-label="End session">${icon('close', 18)}</button><div class="segs" id="segs">${segs}</div></div>
    <div class="center">
      <div class="plabel" id="plabel">Walk</div>
      <div class="stage">
        <div class="halo h1" id="h1"></div><div class="halo h2" id="h2"></div>
        <svg class="ring" viewBox="0 0 104 104"><circle class="tr" cx="52" cy="52" r="48"/><circle class="pr" id="ring" cx="52" cy="52" r="48" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
        <div class="orb" id="orb"></div>
      </div>
      <div class="pcount" id="count"></div>
      <div class="psub" id="psub"></div>
    </div>
    <div class="foot ctrl">
      <div class="pbar"><div class="track"><div class="fill" id="pb"></div></div><div class="times"><span id="tcur">0:00</span><span id="trem">-${fmtTime(s.duration)}</span></div></div>
      <button class="pp" id="pp" aria-label="Pause">${icon('pause', 24)}</button>
    </div>`, ['dusk', 'breathe', 'hold'], 'dusk');
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
  const ph = phaseAt(s.phases, t) || { type: 'walk', label: t > s.duration - 8 ? 'Complete' : 'Walk', start: t, end: t + 1 };
  const k = (t - ph.start) / Math.max(0.01, ph.end - ph.start);
  let b = 0.4, ring = 0, count = '', sub = '', label = ph.label, bg = 'dusk';
  switch (ph.type) {
    case 'inhale': b = ease(k); label = 'Breathe in'; bg = 'breathe'; break;
    case 'top': b = 1; label = 'A little more'; bg = 'breathe'; break;
    case 'exhale': b = 1 - ease(k); label = 'Breathe out'; bg = 'breathe'; sub = 'Slow and gentle'; break;
    case 'hold':
      b = 0.05 + 0.02 * Math.sin(t * 2.5); ring = k; bg = 'hold'; label = 'Hold';
      count = `${Math.max(0, Math.ceil(ph.end - t))}`; sub = 'Keep walking. Stay loose.';
      break;
    case 'test':
      b = 0.05 + 0.02 * Math.sin(t * 2.5); ring = ((t - ph.start) % 60) / 60; bg = 'hold'; label = 'Hold';
      count = `${current.testTap != null ? current.testTap : Math.floor(t - ph.start)}<small>s</small>`;
      sub = 'Tap an earbud when you release';
      break;
    case 'recover':
      b = 0.45 + 0.18 * Math.sin((2 * Math.PI * t) / 6); label = 'Recover';
      if (ph.next) { count = `${Math.max(0, Math.ceil(ph.next - t))}`; sub = 'until the next hold'; } else sub = 'Easy breaths through your nose';
      break;
    case 'announce':
      b = 0.45 + 0.12 * Math.sin((2 * Math.PI * t) / 6); count = `${ph.hold}<small>s</small>`; sub = 'Next hold';
      break;
    default:
      b = 0.45 + 0.12 * Math.sin((2 * Math.PI * t) / 7);
      label = ph.label.split(' · ')[0];
      sub = label === 'Walk' ? 'Breathe through your nose' : label === 'Get ready' ? 'Test hold coming up' : '';
  }
  const $ = (id) => overlay.querySelector('#' + id);
  const orb = $('orb');
  if (!orb) return;
  if (bg !== lastBg) {
    overlay.querySelectorAll('.backdrop .layer').forEach((d) => d.classList.toggle('on', d.dataset.m === bg));
    lastBg = bg;
  }
  orb.style.transform = `scale(${(0.7 + 0.42 * b).toFixed(3)})`;
  $('h1').style.transform = `scale(${(0.86 + 0.14 * b).toFixed(3)})`;
  $('h2').style.transform = `scale(${(0.8 + 0.22 * b).toFixed(3)})`;
  $('ring').style.strokeDashoffset = RING_C * (1 - ring);
  if ($('count').innerHTML !== count) $('count').innerHTML = count;
  if ($('plabel').textContent !== label) $('plabel').textContent = label;
  $('psub').textContent = sub;
  $('pb').style.width = `${Math.min(100, (t / s.duration) * 100)}%`;
  $('tcur').textContent = fmtTime(t);
  $('trem').textContent = '-' + fmtTime(s.duration - t);
  const paused = audio.paused;
  if ($('pp').dataset.p !== String(paused)) { $('pp').dataset.p = String(paused); $('pp').innerHTML = icon(paused ? 'play' : 'pause', 24); }
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
    if (await sheet({ title: 'Finish here?', text: 'You’re nearly done, so this session will count.', ok: 'Finish session', cancel: 'Keep going' })) {
      audio.pause();
      finishScreen();
    }
    return;
  }
  const ok = await sheet({
    title: 'End this session?',
    text: current.practice ? 'This was a practice session, so nothing changes.' : 'It won’t count toward your climb. You can begin again any time today.',
    ok: 'End session', cancel: 'Keep going', tone: 'warn',
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
      flow(`<div class="center"><div class="eyebrow rise">Practice complete</div><h1 class="rise d1" style="margin-top:12px">Well breathed</h1>
        <p class="rise d2">Extra sessions don’t change your plan, but every one is training.</p></div>
        <div class="foot rise d3"><button class="pill" id="close">Done</button></div>`, ['dawn']);
      overlay.querySelector('#close').onclick = closePlayer;
      return;
    }
    rec = state.pending && state.pending.i === current.i ? { ...state.pending, testTap: current.testTap ?? state.pending.testTap } : pendingRecord();
    state.pending = rec;
    save();
  }
  if (isTestKind(rec.kind)) testResult(rec);
  else complete(rec);
}

function complete(rec) {
  const p = state.program;
  const s = streak() + (allResults().some((r) => r.date === today()) ? 0 : 1);
  flow(`<div class="center">
      <div class="eyebrow rise">Day ${rec.i + 1} complete</div>
      <h1 class="rise d1" style="margin-top:14px">You’ve reached<br>${fmtAlt(altitude(rec.i + 1, p))} m</h1>
      <p class="rise d2">${rec.kind === 'light' ? 'An easy day, well spent. Recovery is part of the climb.' : 'One more step toward the summit.'}</p>
      <div class="statrow rise d3">
        <div><b class="num">${rec.rounds}</b><span>Holds</span></div>
        <div><b class="num">${rec.target}s</b><span>Top hold</span></div>
        <div><b class="num">${s}</b><span>Day streak</span></div>
      </div>
    </div>
    <div class="foot rise d4"><button class="pill" id="next">Continue</button></div>`, ['dawn'], 'dawn', 31);
  overlay.querySelector('#next').onclick = () => rateScreen(rec);
}

function rateScreen(rec) {
  let choice = null;
  const opt = (r, t, d) => `<button class="glass" data-r="${r}"><b>${t}</b><span>${d}</span></button>`;
  flow(`<div class="center">
      <h1 class="rise">How did today feel?</h1>
      <p class="rise d1">Your answer gently tunes the sessions ahead.</p>
      <div class="rate rise d2">
        ${opt('easy', 'Too easy', 'Push a little more')}
        ${opt('right', 'Just right', 'Keep the plan')}
        ${opt('hard', 'Too hard', 'Ease off a little')}
      </div>
    </div>
    <div class="foot"><button class="pill" id="save" disabled>Done</button></div>`, ['dawn'], 'dawn', 31);
  const saveBtn = overlay.querySelector('#save');
  overlay.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
    choice = b.dataset.r;
    overlay.querySelectorAll('[data-r]').forEach((c) => c.classList.toggle('sel', c === b));
    saveBtn.disabled = false;
  }));
  saveBtn.onclick = () => { commit({ ...rec, rating: choice }); closePlayer(); };
}

function testResult(rec) {
  let v = rec.testTap ?? (latestTest(state.program.results) || 30);
  flow(`<div class="center">
      <div class="eyebrow rise">${KIND_LABEL[rec.kind]}</div>
      <h1 class="rise d1" style="margin-top:12px">How long did you hold?</h1>
      <p class="rise d2">${rec.testTap != null ? `We caught your earbud tap at ${rec.testTap} seconds. Adjust it if needed.` : 'Enter the last number you heard before you breathed.'}</p>
      <div class="stepper rise d3">
        <button data-d="-5" aria-label="Minus 5">−5</button><button data-d="-1" aria-label="Minus 1">−1</button>
        <output id="val" class="num">${v}<small>s</small></output>
        <button data-d="1" aria-label="Plus 1">+1</button><button data-d="5" aria-label="Plus 5">+5</button>
      </div>
    </div>
    <div class="foot rise d4"><button class="pill" id="saveT">Save result</button></div>`, ['hold'], 'hold', 31);
  overlay.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
    v = Math.max(5, Math.min(180, v + Number(b.dataset.d)));
    overlay.querySelector('#val').innerHTML = `${v}<small>s</small>`;
  }));
  overlay.querySelector('#saveT').onclick = () => {
    commit({ ...rec, testSeconds: v });
    const p = state.program;
    const done = p.results.length >= p.n;
    flow(`<div class="center">
        <div class="eyebrow rise">${done ? 'Summit reached' : 'Result saved'}</div>
        <h1 class="rise d1" style="margin-top:14px">${done ? `You made it to<br>${fmtAlt(summitOf(p.weeks))} m` : `${v} seconds`}</h1>
        <p class="rise d2">${done ? 'Your climb is complete. Remarkable work.' : rec.kind === 'baseline' ? 'Your plan is set from this hold. Tomorrow, the climb begins.' : 'Your targets have been updated from this hold.'}</p>
      </div>
      <div class="foot rise d3"><button class="pill" id="close">Done</button></div>`, ['dawn'], 'dawn', 31);
    overlay.querySelector('#close').onclick = closePlayer;
  };
}

function commit(rec) {
  const p = state.program;
  delete rec.testTap;
  if (!p.results.some((r) => r.i === rec.i)) p.results.push(rec);
  if (rec.rating) p.difficulty = adjustDifficulty(p.difficulty, rec.rating);
  state.pending = null;
  save();
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
    setBackdrop('night', true);
    app.innerHTML = '<div style="padding-top:30vh;text-align:center"><h1>Can’t reach Altitude</h1><p>Check your connection and reload.</p></div>';
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
