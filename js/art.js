// Generated mountain landscapes and thin line icons.

import { rng } from './script.js';

// Sky + ridge palettes. Ridges run from the far (hazy) layer to the near (dark) layer.
export const MOODS = {
  night:  { sky: ['#050816', '#141B3D', '#2B2F63'], glow: ['#6F78C9', 0.35], sun: null, moon: true, far: '#3A3F78', near: '#04060F', snow: '#8E94D6', mist: '#5A62A8', stars: 1 },
  dawn:   { sky: ['#1A2350', '#6B5A9A', '#F2A98C'], glow: ['#FFD2A6', 0.7], sun: '#FFE7CC', far: '#9C88B8', near: '#0C1029', snow: '#FFD9C7', mist: '#E8B6B0', stars: 0.25 },
  day:    { sky: ['#2F6BB0', '#6FA6D6', '#D5E7F2'], glow: ['#FFFFFF', 0.55], sun: '#FFFFFF', far: '#A9C1DA', near: '#10233D', snow: '#F4F8FC', mist: '#DCE9F3', stars: 0 },
  dusk:   { sky: ['#14143A', '#4B3474', '#E07E7A'], glow: ['#FFB38A', 0.65], sun: '#FFD9B8', far: '#7E5E9C', near: '#090A1F', snow: '#F2B9B4', mist: '#C98AA0', stars: 0.5 },
  breathe:{ sky: ['#06263D', '#145B78', '#7ACFD6'], glow: ['#C8F4F0', 0.5], sun: '#E9FFFB', far: '#4F93A8', near: '#031421', snow: '#CFEFF2', mist: '#7FC1CC', stars: 0.15 },
  hold:   { sky: ['#2A1240', '#7A2E5E', '#FF8E6E'], glow: ['#FFC48A', 0.75], sun: '#FFE1C2', far: '#B45C7C', near: '#12081E', snow: '#FFC9B0', mist: '#E58A8A', stars: 0.1 },
};

const hex = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, '0')).join('');
};

// One ridgeline: dominant peaks with concave flanks plus fractal ridged noise
// that is stronger near the summits (rocky tops, smoother foothills).
function ridge(r, W, base, amp, peaks, rough) {
  const oct = Array.from({ length: 5 }, (_, k) => ({ f: (0.007 + r() * 0.004) * Math.pow(2.1, k), p: r() * 10, a: Math.pow(0.5, k) }));
  const pts = [];
  for (let x = -12; x <= W + 12; x += 2) {
    let n = 0, norm = 0;
    for (const o of oct) { n += o.a * (1 - Math.abs(Math.sin(x * o.f + o.p))); norm += o.a; }
    n /= norm;
    let m = 0;
    for (const p of peaks) {
      const d = Math.abs(x - p.x) / p.w;
      const side = x < p.x ? p.l : p.rr;
      m = Math.max(m, p.h * Math.pow(Math.max(0, 1 - d * side), 1.7));
    }
    const y = base - amp * (m * (0.78 + 0.22 * n) + rough * n * (0.35 + 0.65 * m) + rough * 0.25 * n);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts;
}

function peakSet(r, W, k) {
  if (k === 0) {
    return [
      { x: W * 0.6, w: W * 0.5, h: 1, l: 1, rr: 1.15 },
      { x: W * 0.12, w: W * 0.35, h: 0.62, l: 1, rr: 1.1 },
      { x: W * 0.95, w: W * 0.3, h: 0.55, l: 1.1, rr: 1 },
    ];
  }
  const n = 4 + Math.floor(r() * 2);
  return Array.from({ length: n }, (_, j) => ({ x: W * ((j + r() * 0.8) / (n - 0.6)) - W * 0.05, w: W * (0.16 + r() * 0.22), h: 0.35 + r() * 0.65, l: 0.8 + r() * 0.5, rr: 0.8 + r() * 0.5 }));
}

let uid = 0;

export function landscape(mood = 'dusk', { seed = 11, W = 390, H = 844, horizon = 0.5 } = {}) {
  const P = MOODS[mood];
  const r = rng(seed);
  const id = `ls${++uid}`;
  const hy = H * horizon;
  let defs = `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.sky[0]}"/><stop offset=".55" stop-color="${P.sky[1]}"/><stop offset="1" stop-color="${P.sky[2]}"/></linearGradient>
    <radialGradient id="${id}g" cx=".62" cy="${(hy / H).toFixed(3)}" r=".55" gradientTransform="translate(0 0)">
      <stop offset="0" stop-color="${P.glow[0]}" stop-opacity="${P.glow[1]}"/><stop offset="1" stop-color="${P.glow[0]}" stop-opacity="0"/></radialGradient>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;

  if (P.stars) {
    const sr = rng(seed + 99);
    for (let k = 0; k < 90; k++) {
      const y = sr() * hy * 0.85;
      const o = (0.25 + sr() * 0.75) * P.stars * (1 - y / hy);
      body += `<circle cx="${(sr() * W).toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.4 + sr() * 0.9).toFixed(2)}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
    }
  }
  body += `<rect width="${W}" height="${H}" fill="url(#${id}g)"/>`;
  if (P.sun) body += `<circle cx="${W * 0.62}" cy="${hy - H * 0.035}" r="${W * 0.06}" fill="${P.sun}" opacity=".9"/>`;
  if (P.moon) body += `<circle cx="${W * 0.74}" cy="${H * 0.16}" r="${W * 0.045}" fill="#E8EAFF" opacity=".9"/><circle cx="${W * 0.74 + 7}" cy="${H * 0.16 - 4}" r="${W * 0.045}" fill="${P.sky[0]}" opacity=".85"/>`;

  const layers = 5;
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const base = hy + H * (0.02 + k * 0.07);
    const amp = H * (k === 0 ? 0.27 : 0.15 - k * 0.02);
    const pts = ridge(r, W, base, amp, peakSet(r, W, k), k === 0 ? 0.16 : 0.24 - t * 0.08);
    const col = mix(P.far, P.near, Math.pow(t, 0.8));
    const top = base - amp;
    if (k === 0) {
      defs += `<linearGradient id="${id}p" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${base}">
        <stop offset="0" stop-color="${P.snow}"/><stop offset=".28" stop-color="${mix(P.snow, col, 0.6)}"/><stop offset=".6" stop-color="${col}"/></linearGradient>`;
    }
    body += `<path d="M-12,${H} L${pts.join(' L')} L${W + 12},${H} Z" fill="${k === 0 ? `url(#${id}p)` : col}"/>`;
    if (k === 0) {
      // Find the summit, then shade the face to its right along a wandering ridge line.
      let si = 0;
      pts.forEach((p, j) => { if (+p.split(',')[1] < +pts[si].split(',')[1]) si = j; });
      const [sx, sy] = pts[si].split(',').map(Number);
      const sr2 = rng(seed + 5);
      const spine = [];
      for (let yy = sy, xx = sx; yy < base + 10; yy += 8) {
        xx += (sr2() - 0.35) * 7;
        spine.push(`${xx.toFixed(1)},${yy.toFixed(1)}`);
      }
      const right = pts.slice(si);
      defs += `<clipPath id="${id}c"><path d="M-12,${H} L${pts.join(' L')} L${W + 12},${H} Z"/></clipPath>
        <linearGradient id="${id}sh" gradientUnits="userSpaceOnUse" x1="0" y1="${sy}" x2="0" y2="${base}">
          <stop offset="0" stop-color="${P.near}" stop-opacity=".24"/><stop offset=".55" stop-color="${P.near}" stop-opacity=".14"/><stop offset="1" stop-color="${P.near}" stop-opacity="0"/></linearGradient>`;
      body += `<path clip-path="url(#${id}c)" d="M${right.join(' L')} L${W + 12},${base + 10} L${spine.reverse().join(' L')} Z" fill="url(#${id}sh)"/>`;
    }
    if (k < layers - 1) {
      defs += `<linearGradient id="${id}m${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.mist}" stop-opacity="0"/><stop offset=".75" stop-color="${P.mist}" stop-opacity="${(0.2 - t * 0.12).toFixed(2)}"/><stop offset="1" stop-color="${P.mist}" stop-opacity="0"/></linearGradient>`;
      body += `<rect x="0" y="${(base - H * 0.14).toFixed(1)}" width="${W}" height="${(H * 0.2).toFixed(1)}" fill="url(#${id}m${k})"/>`;
    }
  }
  return `<svg class="landscape" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
}

export function timeMood(d = new Date()) {
  const h = d.getHours();
  if (h < 5 || h >= 21) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
}

// Thin line icons (1.6px strokes, currentColor).
const I = {
  play: '<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2A.8.8 0 0 0 8 5.8z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  peak: '<path d="M2.5 19.5 9 8l3.2 5.4 2.3-3.4 7 9.5z"/><path d="m7.6 10.5 1.4 1.3 1.3-1"/>',
  chart: '<path d="M4 19.5h16M6.5 16l4-5 3 3 4.5-6.5"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.5-6-5.8 0-3.9 3-5.5 4.2-8.7.9 1.5 1.1 2.8.8 4.2 1.5-.6 2.6-2 2.8-4.2 2.6 1.9 4.2 5 4.2 8.3 0 3.6-2.4 6.2-6 6.2z"/>',
  check: '<path d="M5 12.5 10 17.5 19.5 7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  wind: '<path d="M3 9h11a2.8 2.8 0 1 0-2.8-2.8M3 13.5h15a2.8 2.8 0 1 1-2.8 2.8M3 18h6"/>',
  flag: '<path d="M6 21V4M6 4.5h11l-2.4 3.8L17 12H6"/>',
  leaf: '<path d="M5 19c0-8.5 5-13.5 14.5-14 0 9.5-5 14-12.5 14"/><path d="M5 19c3-4 6-7 9.5-9"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  shield: '<path d="M12 3 19 6v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m10 21 2.2-6.2 2.6 2.3V21M9 12.5l1.5-4.5 3.4 1 2.1 3.2M10.5 8 7.5 10.5v3"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  up: '<path d="M3 17.5 9 11.5l4 4 7.5-7.5M14.5 8h6v6"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2.1-5M4.5 3.5v4h4"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3M12 14v4M8.5 20.5h7"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  moon: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5V20h14v-7.5"/>',
};

export function icon(name, size = 22, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;
}
