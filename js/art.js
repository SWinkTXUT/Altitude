// Illustrations and icons (inline SVG strings).
// The mascot "Sunny" is the sun/breath orb from the app icon, given a face.

let uid = 0;

export function mascot({ mood = 'happy', size = 120, phones = false, glow = false } = {}) {
  const id = `m${++uid}`;
  const eyes = {
    happy: `<ellipse cx="76" cy="94" rx="7.5" ry="10" fill="#3A2614"/><ellipse cx="124" cy="94" rx="7.5" ry="10" fill="#3A2614"/>
            <circle cx="78.5" cy="90" r="2.8" fill="#fff"/><circle cx="126.5" cy="90" r="2.8" fill="#fff"/>`,
    calm: `<path d="M64 96 Q76 106 88 96" stroke="#3A2614" stroke-width="5.5" fill="none" stroke-linecap="round"/>
           <path d="M112 96 Q124 106 136 96" stroke="#3A2614" stroke-width="5.5" fill="none" stroke-linecap="round"/>`,
    cheer: `<path d="M63 100 Q76 84 89 100" stroke="#3A2614" stroke-width="6" fill="none" stroke-linecap="round"/>
            <path d="M111 100 Q124 84 137 100" stroke="#3A2614" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  };
  eyes.hold = eyes.calm;
  eyes.wow = eyes.happy;
  eyes.tired = `<path d="M64 99 L88 99" stroke="#3A2614" stroke-width="5.5" stroke-linecap="round"/><path d="M112 99 L136 99" stroke="#3A2614" stroke-width="5.5" stroke-linecap="round"/>`;
  const mouth = {
    happy: `<path d="M86 120 Q100 133 114 120" stroke="#3A2614" stroke-width="5.5" fill="none" stroke-linecap="round"/>`,
    calm: `<path d="M90 122 Q100 129 110 122" stroke="#3A2614" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    hold: `<ellipse cx="100" cy="124" rx="7" ry="5.5" fill="#3A2614"/>`,
    cheer: `<path d="M82 116 Q100 116 118 116 Q116 140 100 140 Q84 140 82 116Z" fill="#3A2614"/><path d="M90 132 Q100 126 110 132 Q106 139 100 139 Q94 139 90 132Z" fill="#FF7A8A"/>`,
    wow: `<ellipse cx="100" cy="125" rx="9" ry="11" fill="#3A2614"/>`,
    tired: `<path d="M88 126 Q100 120 112 126" stroke="#3A2614" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  };
  const cheeks = mood === 'hold' ? 1.35 : 1;
  const headphones = phones
    ? `<path d="M38 104 Q38 30 100 30 Q162 30 162 104" stroke="#2A2B4A" stroke-width="11" fill="none" stroke-linecap="round"/>
       <rect x="22" y="92" width="28" height="44" rx="12" fill="#2A2B4A"/><rect x="150" y="92" width="28" height="44" rx="12" fill="#2A2B4A"/>
       <rect x="27" y="98" width="10" height="32" rx="5" fill="#4A4C72"/><rect x="163" y="98" width="10" height="32" rx="5" fill="#4A4C72"/>`
    : '';
  return `<svg class="mascot" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="${id}b" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#FFEA8C"/><stop offset=".55" stop-color="#FFC531"/><stop offset="1" stop-color="#FF9F1C"/></radialGradient>
      <radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#FFC531" stop-opacity=".45"/><stop offset="1" stop-color="#FFC531" stop-opacity="0"/></radialGradient>
    </defs>
    ${glow ? `<circle cx="100" cy="100" r="100" fill="url(#${id}g)"/>` : ''}
    <circle cx="100" cy="100" r="74" fill="url(#${id}b)"/>
    <ellipse cx="74" cy="62" rx="20" ry="11" fill="#fff" opacity=".45" transform="rotate(-28 74 62)"/>
    <ellipse cx="62" cy="116" rx="${11 * cheeks}" ry="${6.5 * cheeks}" fill="#FF7A6B" opacity=".5"/>
    <ellipse cx="138" cy="116" rx="${11 * cheeks}" ry="${6.5 * cheeks}" fill="#FF7A6B" opacity=".5"/>
    ${eyes[mood] || eyes.happy}${mouth[mood] || mouth.happy}${headphones}
  </svg>`;
}

// Layered rounded mountains with Sunny rising behind them.
export function scene({ height = 240, sunMood = 'happy' } = {}) {
  return `<div class="scene" style="height:${height}px">
    <svg class="clouds" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g fill="#fff" opacity=".9">
        <rect x="34" y="52" width="74" height="22" rx="11"/><rect x="52" y="40" width="40" height="24" rx="12"/>
        <rect x="292" y="74" width="80" height="22" rx="11"/><rect x="314" y="62" width="40" height="22" rx="11"/>
      </g>
    </svg>
    <div class="scene-sun">${mascot({ mood: sunMood, size: 132, glow: true })}</div>
    <svg class="hills" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M-20 240 L80 120 Q100 96 120 120 L230 240Z" fill="#FFB8C8"/>
      <path d="M150 240 L280 96 Q300 74 320 96 L440 240Z" fill="#B9AEFF"/>
      <path d="M282 92 Q300 74 318 92 L306 104 L298 96 L290 104Z" fill="#fff"/>
      <path d="M-40 240 L120 150 Q140 138 160 150 L300 240Z" fill="#2FCBA9"/>
      <path d="M180 240 L300 168 Q318 157 336 168 L460 240Z" fill="#4C8DF6"/>
      <path d="M-20 240 Q100 205 210 222 T440 214 L440 240Z" fill="#1FB596"/>
    </svg>
  </div>`;
}

// Small mountain for program choices; h = 1..3 grows the peak.
export function peak(h, color) {
  const top = [0, 40, 24, 8][h];
  return `<svg viewBox="0 0 96 80" width="72" height="60" aria-hidden="true">
    <circle cx="74" cy="${top + 4}" r="9" fill="#FFC531"/>
    <path d="M6 76 L${48 - 4} ${top + 6} Q48 ${top} ${48 + 4} ${top + 6} L90 76Z" fill="${color}"/>
    <path d="M${48 - 9} ${top + 14} L${48 - 4} ${top + 6} Q48 ${top} ${48 + 4} ${top + 6} L${48 + 9} ${top + 14} L${48 + 3} ${top + 19} L48 ${top + 14} L${48 - 3} ${top + 19}Z" fill="#fff" opacity=".95"/>
  </svg>`;
}

const I = {
  flame: `<path d="M12.5 2.2c.9 3.3-1.6 4.8-1.6 7.2 0 1.2.8 2 1.8 2 1.5 0 2.2-1.5 1.7-3.2 2.6 1.5 4.1 4.2 4.1 6.9 0 3.9-3 6.7-6.8 6.7s-6.7-2.8-6.7-6.6c0-4.5 3.5-6.8 4.9-9.4.8-1.5 1.7-2.6 2.6-3.6z" fill="#FF8A3D"/><path d="M12 13.6c1.9 1.3 2.8 2.7 2.8 4.2a2.8 2.8 0 0 1-5.6 0c0-1.6 1.2-2.6 2.8-4.2z" fill="#FFC531"/>`,
  peak: `<path d="M2.5 20 9.5 7.5q1-1.6 2 0l2.7 4.6 1.4-2.2q1-1.5 2 0L21.5 20z" fill="#3B82F6"/><path d="M8.2 9.8 9.5 7.5q1-1.6 2 0l1.3 2.3-1.3 1-1-1-1 1z" fill="#fff"/>`,
  clock: `<circle cx="12" cy="12" r="9.5" fill="#8B7CF6"/><path d="M12 7v5.2l3.4 2" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  trophy: `<path d="M7 3.5h10v5.5a5 5 0 0 1-10 0z" fill="#FFC531"/><path d="M7 5H3.8v1.6A3.4 3.4 0 0 0 7.2 10M17 5h3.2v1.6a3.4 3.4 0 0 1-3.4 3.4" stroke="#FFC531" stroke-width="2" fill="none"/><path d="M10.5 13.6h3l.6 3.9h-4.2z" fill="#F0A400"/><rect x="7.5" y="17.5" width="9" height="3" rx="1.5" fill="#F0A400"/>`,
  wind: `<path d="M3 9h11.5a3 3 0 1 0-3-3M3 13.5h15.5a3 3 0 1 1-3 3M3 18h6" stroke="#14C3A2" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  medal: `<path d="M7.5 2h3.5l2 5-3.5 1.5zM16.5 2H13l-2 5 3.5 1.5z" fill="#FF4F8B"/><circle cx="12" cy="14.5" r="6.5" fill="#FFC531"/><path d="m12 11 1.1 2.2 2.4.3-1.8 1.6.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="#fff"/>`,
  check: `<path d="M5 12.5 10 17.5 19.5 7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="3" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.6" fill="none"/>`,
  star: `<path d="m12 2.8 2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8z" fill="currentColor"/>`,
  leaf: `<path d="M5 19C5 10 10 5 20 4c0 10-5 15-13 15" fill="currentColor"/><path d="M4 20c3-4 6-7 10-9.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>`,
  flag: `<path d="M6 3v18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M7 4h11l-2.5 4L18 12H7z" fill="currentColor"/>`,
  play: `<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor"/>`,
  pause: `<rect x="6.5" y="5" width="4" height="14" rx="1.6" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.6" fill="currentColor"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`,
  music: `<path d="M9 17.5V6l10-2v11.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8" fill="#fff"/><circle cx="16.5" cy="15.5" r="2.8" fill="#fff"/>`,
  voice: `<rect x="9" y="3" width="6" height="11" rx="3" fill="#fff"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  shield: `<path d="M12 2.8 19.5 6v5.5c0 4.6-3.1 8.3-7.5 9.7-4.4-1.4-7.5-5.1-7.5-9.7V6z" fill="#fff"/><path d="m8.6 12 2.4 2.4 4.6-4.8" stroke="#14C3A2" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  map: `<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" fill="#fff"/><path d="M9 4v13.5M15 6.5V20" stroke="#4C8DF6" stroke-width="1.8"/>`,
  up: `<path d="M3 17.5 9 11.5l4 4 7.5-7.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 8h6v6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  reset: `<path d="M5 12a7 7 0 1 0 2.1-5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M4.5 3.5v4h4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  phone: `<rect x="6" y="2.5" width="12" height="19" rx="3" fill="#fff"/><rect x="10" y="18" width="4" height="1.4" rx=".7" fill="#4C8DF6"/>`,
  walk: `<circle cx="13" cy="4.5" r="2.2" fill="#fff"/><path d="m10 21 2.2-6.2 2.6 2.3V21M9 12.5l1.5-4.5 3.4 1 2.1 3.2M10.5 8 7.5 10.5v3" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  ear: `<path d="M5 13V12a7 7 0 0 1 14 0v1" stroke="#fff" stroke-width="2.4" fill="none"/><rect x="3" y="12" width="5" height="8" rx="2.2" fill="#fff"/><rect x="16" y="12" width="5" height="8" rx="2.2" fill="#fff"/>`,
  home: `<path d="M3 19.5 9.6 8q1.1-1.9 2.2 0l2.6 4.5 1.5-2.4q1.1-1.7 2.2 0l3 9.4z" fill="currentColor"/>`,
  chart: `<rect x="3.5" y="12" width="4.2" height="8.5" rx="1.6" fill="currentColor"/><rect x="9.9" y="6.5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="16.3" y="3.5" width="4.2" height="17" rx="1.6" fill="currentColor"/>`,
  gear: `<path d="M10.3 2.5h3.4l.5 2.6 1.8.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.8 2.6.5v3.4l-2.6.5-.8 1.8 1.5 2.2-2.4 2.4-2.2-1.5-1.8.8-.5 2.6h-3.4l-.5-2.6-1.8-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.8-2.6-.5v-3.4l2.6-.5.8-1.8-1.5-2.2 2.4-2.4 2.2 1.5 1.8-.8z" fill="currentColor"/><circle cx="12" cy="12" r="3.4" fill="var(--icon-hole, #fff)"/>`,
  chevron: `<path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  back: `<path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function icon(name, size = 24, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
}

export function confetti(n = 36) {
  const colors = ['#14C3A2', '#3B82F6', '#FF8A3D', '#FF4F8B', '#FFC531', '#8B7CF6'];
  let s = '';
  for (let i = 0; i < n; i++) {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur = 1.8 + Math.random() * 1.4;
    const rot = Math.random() * 360;
    const w = 7 + Math.random() * 6;
    const round = Math.random() < 0.35;
    s += `<i style="left:${left}%;width:${w}px;height:${round ? w : w * 1.6}px;background:${colors[i % colors.length]};border-radius:${round ? '50%' : '2px'};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${rot}deg)"></i>`;
  }
  return `<div class="confetti" aria-hidden="true">${s}</div>`;
}
