import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createIntro, T } from './intro.js'; // plain JS canvas animation

const SEEN_KEY = 'agrisense.intro.seen';
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

/**
 * The eye draws itself in ink, looks around, blinks, then a green bloom opens
 * from the eye and reveals the brand before fading into the app.
 * A tap speeds it up; "Skip" ends it.
 */
export default function IntroSplash({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<{ hurry: () => void; finish: () => void } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  const leave = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setLeaving(true);
    setTimeout(onDone, FADE_MS);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const intro = createIntro({ ink: canvas, reduced: false, debugT: undefined });
    introRef.current = intro;
    let layout = intro.resize(innerWidth, innerHeight);
    const onResize = () => (layout = intro.resize(innerWidth, innerHeight));
    addEventListener('resize', onResize);

    // The bloom (blink + 0.15 s, lasting T.bloom) can run past T.done; wait for it.
    const end = Math.max(T.done, T.blink + 0.15 + T.bloom) + 0.3;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const res = intro.update(dt);
      const { x, y } = layout.eye;
      if (bloomRef.current) bloomRef.current.style.clipPath = `circle(${(res.bloomR ?? 0).toFixed(1)}px at ${x}px ${y}px)`;
      if (brandRef.current) {
        const k = Math.min(1, Math.max(0, (res.t - (T.blink + 0.6)) / 0.8));
        brandRef.current.style.opacity = k.toFixed(3);
        brandRef.current.style.transform = `translateY(${((1 - k) * 12).toFixed(1)}px)`;
      }
      if (res.t >= end) leave();
      if (!leavingRef.current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 select-none bg-[#f6f1e7] transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      onPointerDown={() => introRef.current?.hurry()}
      role="presentation"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <div ref={bloomRef} className="absolute inset-0 bg-leaf-900" style={{ clipPath: 'circle(0px at 50% 38%)' }} aria-hidden>
        <div ref={brandRef} className="absolute inset-x-0 top-[62%] px-6 text-center text-white opacity-0">
          <p className="text-4xl font-bold tracking-tight">{t('app.name')}</p>
          <p className="mt-2 text-lg text-leaf-100">{t('app.tagline')}</p>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          introRef.current?.finish();
          leave();
        }}
        className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 min-h-[44px] rounded-full bg-white/80 px-5 shadow-sm text-base font-semibold text-gray-900 backdrop-blur"
      >
        {t('app.skip')}
      </button>
    </div>
  );
}
