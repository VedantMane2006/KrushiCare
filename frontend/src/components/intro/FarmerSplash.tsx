import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './farmer.css';

const SEEN_KEY = 'agrisense.intro.seen';
const SHOW_MS = 4800;
const FADE_MS = 500;

/** Plays once per browser session; `?intro=1` forces it, reduced-motion skips it. */
export function shouldPlayIntro(): boolean {
  try {
    if (new URLSearchParams(location.search).get('intro') === '1') return true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

// Crop rows run from a vanishing point on the horizon to the bottom edge.
const VP = { x: 180, y: 424 };
// Extra rows on both sides only show on wide (laptop) screens.
const ROWS = [-560, -470, -385, -305, -235, -170, -110, -55, 0, 55, 110, 170, 235, 300, 370, 445, 525, 610];
// The scene is drawn for a 360x640 phone; wide screens see more of it to the sides (up to X_MIN..X_MAX).
const X_MIN = -600;
const X_MAX = 960;
const FARMER_BOX = { x0: 92, x1: 222, y0: 410, y1: 575 };

function plants() {
  const out: { x: number; y: number; s: number; tomato: boolean }[] = [];
  ROWS.forEach((dx, r) => {
    for (let k = 1; k <= 6; k++) {
      const t = (k / 6) ** 1.6; // denser toward the horizon
      const x = VP.x + (dx * 2.6 - 0) * t;
      const y = VP.y + (640 - VP.y) * t;
      const inFarmer = x > FARMER_BOX.x0 && x < FARMER_BOX.x1 && y > FARMER_BOX.y0 && y < FARMER_BOX.y1;
      if (!inFarmer && x > X_MIN && x < X_MAX) out.push({ x, y, s: 0.35 + 0.9 * t, tomato: (r + k) % 3 === 0 });
    }
  });
  return out;
}
const PLANTS = plants();

/**
 * Opening splash: sunrise over a village, a farmer hoeing the field, then the
 * brand. Pure SVG + CSS animation (no libraries), about 5 s. A tap or "Skip" ends it.
 */
export default function FarmerSplash({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);
  const [aspect, setAspect] = useState(() => window.innerWidth / window.innerHeight);
  useEffect(() => {
    const onResize = () => setAspect(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Portrait: the 360-wide scene, cropped to fit. Landscape: widen the view around the centre instead of zooming in.
  const viewW = Math.min(X_MAX - X_MIN, Math.max(360, 640 * aspect));

  const leave = () => {
    if (left.current) return;
    left.current = true;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setLeaving(true);
    setTimeout(onDone, FADE_MS);
  };

  useEffect(() => {
    const id = setTimeout(leave, SHOW_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`farm fixed inset-0 z-50 select-none overflow-hidden bg-[#fdf1df] transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      onClick={leave}
      role="presentation"
    >
      <svg viewBox={`${(180 - viewW / 2).toFixed(1)} 0 ${viewW.toFixed(1)} 640`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="farm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdf3e3" />
            <stop offset="0.55" stopColor="#fcdcae" />
            <stop offset="0.68" stopColor="#f9c084" />
          </linearGradient>
          <linearGradient id="farm-sky-warm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.25" stopColor="#fde7c4" stopOpacity="0" />
            <stop offset="0.68" stopColor="#f6a85e" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="farm-glow">
            <stop offset="0" stopColor="#fff1c9" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffd88a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="farm-soil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9b6a3f" />
            <stop offset="1" stopColor="#6e4626" />
          </linearGradient>
        </defs>

        {/* sky and sun */}
        <rect x={X_MIN} width={X_MAX - X_MIN} height="640" fill="url(#farm-sky)" />
        <rect className="farm-sky-warm" x={X_MIN} width={X_MAX - X_MIN} height="640" fill="url(#farm-sky-warm)" />
        <g className="farm-sun">
          <circle cx="252" cy="318" r="95" fill="url(#farm-glow)" />
          <g className="farm-rays" opacity="0.22">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M252 318 L246 196 L258 196 Z" fill="#f59e2b" transform={`rotate(${i * 30} 252 318)`} />
            ))}
          </g>
          <circle cx="252" cy="318" r="40" fill="#fbb44a" />
          <circle cx="252" cy="318" r="40" fill="#fde68a" opacity="0.35" />
        </g>

        {/* birds */}
        <g className="farm-birds" fill="none" stroke="#5b4636" strokeWidth="2" strokeLinecap="round">
          <path d="M40 190 q6 -6 12 0 q6 -6 12 0" />
          <path d="M70 176 q5 -5 10 0 q5 -5 10 0" />
          <path d="M58 206 q4 -4 8 0 q4 -4 8 0" />
        </g>

        {/* far hills and the village */}
        <path d="M-600 380 C-480 350 -360 400 -240 378 S-80 360 0 395 C50 365 100 360 150 380 S250 400 300 372 S345 360 360 368 C480 350 600 395 720 372 S880 360 960 380 V640 H-600 Z" fill="#b5c995" />
        <g className="farm-village">
          <g className="farm-smoke" fill="#ffffff">
            <circle cx="101" cy="350" r="4" />
            <circle cx="101" cy="350" r="4" />
            <circle cx="101" cy="350" r="4" />
          </g>
          <rect x="28" y="352" width="4" height="30" fill="#5b3d24" />
          <circle cx="30" cy="350" r="13" fill="#5f8a45" />
          <rect x="48" y="372" width="22" height="18" fill="#efd9b4" />
          <path d="M44 373 L59 359 L74 373 Z" fill="#a8582f" />
          <rect x="78" y="368" width="28" height="22" fill="#f3e0bf" />
          <path d="M74 369 L92 351 L110 369 Z" fill="#9b4d28" />
          <rect x="97" y="352" width="5" height="10" fill="#6b4a33" />
          <rect x="88" y="378" width="7" height="12" fill="#7a5638" />
          <rect x="125" y="360" width="14" height="28" fill="#f4e5c9" />
          <path d="M123 361 L132 338 L141 361 Z" fill="#d98a4c" />
          <path d="M132 338 V328" stroke="#6b4a33" strokeWidth="1.5" />
          <path d="M132 328 L143 331 L132 335 Z" fill="#e2702a" />
          <rect x="168" y="370" width="22" height="18" fill="#efd9b4" />
          <path d="M164 371 L179 358 L194 371 Z" fill="#a8582f" />
          <rect x="207" y="356" width="4" height="30" fill="#5b3d24" />
          <circle cx="209" cy="350" r="15" fill="#557a3e" />
          <circle cx="200" cy="356" r="9" fill="#5f8a45" />
        </g>
        <path d="M-600 396 C-400 384 -200 404 0 402 C80 386 160 394 240 388 S330 382 360 392 C520 404 760 384 960 396 V640 H-600 Z" fill="#94b46f" />

        {/* the field */}
        <path d="M-600 440 C-300 430 -100 434 0 432 C120 420 240 420 360 434 C500 440 760 430 960 440 V640 H-600 Z" fill="url(#farm-soil)" />
        <g stroke="#b07c4b" strokeOpacity="0.55" strokeLinecap="round">
          {ROWS.map((dx) => (
            <line key={dx} x1={VP.x + dx * 0.15} y1={VP.y + 6} x2={VP.x + dx * 2.6} y2="640" strokeWidth="3" />
          ))}
        </g>
        <g className="farm-crops">
          {PLANTS.map((p, i) => (
            <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.s.toFixed(2)})`}>
              <g className="leafy" style={{ animationDelay: `${(i % 7) * 0.2}s` }}>
                <ellipse cx="-7" cy="-8" rx="8" ry="4.5" fill="#3f8a3a" transform="rotate(-30 -7 -8)" />
                <ellipse cx="7" cy="-9" rx="8" ry="4.5" fill="#4c9a43" transform="rotate(30 7 -9)" />
                <ellipse cx="0" cy="-15" rx="5" ry="8" fill="#56a64b" />
                {p.tomato && <circle cx="5" cy="-4" r="3.2" fill="#dc3b26" />}
              </g>
            </g>
          ))}
        </g>

        {/* the farmer: kurta, dhoti, safa (turban) and a gamcha on the shoulder */}
        <g className="farm-farmer">
          <ellipse cx="136" cy="562" rx="42" ry="5" fill="#3d2615" opacity="0.28" />
          {/* legs: calves below the dhoti, bare feet in chappals */}
          <path d="M113 528 Q118 531 121 533 L116 556 L109 556 Z" fill="#6f4224" />
          <path d="M141 528 L150 528 L156 554 L149 555 Z" fill="#8a5631" />
          <path d="M103 557 Q103 553 108 553 L118 554 Q120 558 117 559 L104 559 Z" fill="#5a3a22" />
          <path d="M147 552 L158 552 Q164 554 163 557 L147 557 Z" fill="#5a3a22" />
          <path d="M148 553 Q152 551 157 552" stroke="#8a5631" strokeWidth="2" fill="none" />
          {/* dhoti */}
          <path d="M114 494 L147 494 L153 532 Q145 535 138 530 L133 510 L126 532 Q117 535 109 531 Z" fill="#f4ecdc" />
          <path d="M133 510 L138 530 Q145 535 153 532 L150 518 Z" fill="#e3d6bd" />
          <path d="M119 499 Q121 515 116 530 M128 498 Q131 506 133 510 M141 499 Q143 512 147 528" stroke="#d6c7aa" strokeWidth="1.3" fill="none" />
          <path d="M114 494 L147 494 L147 498 L114 498 Z" fill="#d9caa9" />
          <g className="farm-torso">
            {/* back arm (behind the body) */}
            {/* kurta torso, leaning into the stroke */}
            <path d="M117 500 Q118 476 128 458 Q134 447 145 446 Q155 447 156 457 Q153 478 148 500 Z" fill="#4f78a8" />
            <path d="M117 500 Q118 476 128 458 Q132 451 138 448 Q128 470 126 500 Z" fill="#3e6491" />
            <path d="M146 452 Q150 462 147 474" stroke="#2f5079" strokeWidth="1.4" fill="none" />
            {/* gamcha over the shoulder */}
            <path d="M131 452 Q142 444 154 450 L152 456 Q142 451 133 459 Z" fill="#c23b2b" />
            <path d="M133 455 Q128 468 126 480 L121 479 Q124 465 129 453 Z" fill="#c23b2b" />
            <path d="M136 452 L131 470 M142 450 L139 455 M127 470 L123 478" stroke="#f4d36a" strokeWidth="1.2" />
            {/* neck and head */}
            <path d="M146 449 L148 440 L154 441 L153 450 Z" fill="#7d4c2b" />
            <ellipse cx="152" cy="433" rx="9" ry="10" fill="#8f5a33" />
            <path d="M160 430 Q164 434 161 437 L159 437 Z" fill="#8f5a33" />
            <circle cx="157.5" cy="431" r="1.1" fill="#2a1d14" />
            <path d="M155 439 Q158 437 162 439 Q159 441 155 440 Z" fill="#2a1d14" />
            <path d="M144 431 Q143 440 147 444 Q151 445 149 438" fill="#2a1d14" opacity="0.55" />
            <ellipse cx="146" cy="434" rx="2" ry="3" fill="#7d4c2b" />
            {/* safa */}
            <path d="M140 429 Q139 419 150 417 Q162 417 163 426 Q156 423 150 424 Q144 425 140 429 Z" fill="#e8762d" />
            <path d="M140 429 Q145 425 152 425 Q159 425 163 426 Q163 430 160 429 Q152 427 141 431 Z" fill="#d05f1f" />
            <path d="M143 421 Q151 418 160 421 M141 425 Q151 421 162 424" stroke="#b8501a" strokeWidth="1.2" fill="none" />
            <path d="M140 427 q-10 5 -12 17 l5 1 q2 -9 10 -13 Z" fill="#e8762d" />
            <g className="farm-arms">
              {/* hoe: wooden handle and an iron blade */}
              <line x1="156" y1="459" x2="206" y2="545" stroke="#8a5a2b" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="157" y1="460" x2="205" y2="543" stroke="#b07a40" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M201 541 L211 547 L199 566 L190 561 Z" fill="#6f7782" />
              <path d="M199 566 L190 561 L192 558 L201 563 Z" fill="#aab2bc" />
              {/* back arm */}
              <path d="M141 452 Q154 466 168 480 L172 476 Q158 460 147 449 Z" fill="#3e6491" />
              <path d="M166 478 L173 474 L183 497 L178 500 Z" fill="#6f4224" />
              <circle cx="180" cy="500" r="4" fill="#6f4224" />
              {/* front arm: sleeve to the elbow, then forearm and hand */}
              <path d="M140 450 Q150 462 160 472 L165 466 Q155 455 148 446 Z" fill="#4f78a8" />
              <path d="M158 470 L165 465 L174 482 L168 486 Z" fill="#8f5a33" />
              <circle cx="171" cy="485" r="4.3" fill="#8f5a33" />
            </g>
          </g>
          <g className="farm-dust" fill="#a57447">
            <circle cx="204" cy="560" r="5" />
            <circle cx="204" cy="560" r="4" />
            <circle cx="204" cy="560" r="3" />
          </g>
        </g>
      </svg>

      <div className="farm-brand absolute inset-x-0 top-[11%] px-6 text-center">
        <p className="font-display text-6xl font-bold tracking-tight text-forest">{t('app.name')}</p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          leave();
        }}
        className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 min-h-[44px] rounded-full bg-white/85 px-5 text-base font-semibold text-gray-900 shadow-sm"
      >
        {t('app.skip')}
      </button>
    </div>
  );
}
