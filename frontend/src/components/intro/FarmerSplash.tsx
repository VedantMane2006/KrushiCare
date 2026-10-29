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

        {/* the farmer */}
        <g className="farm-farmer">
          <ellipse cx="140" cy="563" rx="40" ry="5" fill="#3d2615" opacity="0.25" />
          <g stroke="#2a1d14" strokeLinecap="round">
            <line x1="130" y1="500" x2="112" y2="559" strokeWidth="10" />
            <line x1="130" y1="500" x2="153" y2="557" strokeWidth="10" />
          </g>
          <ellipse cx="109" cy="561" rx="8" ry="3.5" fill="#2a1d14" />
          <ellipse cx="157" cy="559" rx="8" ry="3.5" fill="#2a1d14" />
          <path d="M116 490 L145 490 L153 530 L108 530 Z" fill="#f1e8d8" />
          <path d="M131 492 L131 530" stroke="#d9cbb3" strokeWidth="1.5" />
          <g className="farm-torso">
            <line x1="130" y1="498" x2="144" y2="452" stroke="#2a1d14" strokeWidth="18" strokeLinecap="round" />
            <circle cx="151" cy="433" r="11" fill="#2a1d14" />
            <ellipse cx="150" cy="424" rx="13.5" ry="7" fill="#e2702a" />
            <path d="M138 425 q-11 4 -13 15 l5 1 q2 -8 10 -11 Z" fill="#e2702a" />
            <g className="farm-arms">
              <line x1="156" y1="459" x2="206" y2="545" stroke="#7a4b25" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M206 545 L195 563" stroke="#7d8590" strokeWidth="8" />
              <g stroke="#2a1d14" strokeWidth="7.5" strokeLinecap="round">
                <line x1="144" y1="452" x2="171" y2="485" />
                <line x1="144" y1="452" x2="181" y2="501" />
              </g>
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
        <p className="text-5xl font-bold tracking-tight text-leaf-900">{t('app.name')}</p>
        <p className="mt-2 text-lg font-medium text-[#5b4636]">{t('app.tagline')}</p>
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
