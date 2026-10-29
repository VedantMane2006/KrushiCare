import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { registerSW } from 'virtual:pwa-register';
import { db } from './services/db';
import { useOnline } from './hooks/useOnline';
import { prefetchAdvicePack, USE_FIXTURES, warmUp } from './services/api';
import { startAutoSync } from './services/sync';
import { loadSettings } from './services/settings';
import Home from './pages/Home';
import Capture from './pages/Capture';
import Result from './pages/Result';
import History from './pages/History';
import Schemes from './pages/Schemes';
import Settings from './pages/Settings';
import IntroSplash, { shouldPlayIntro } from './components/intro/IntroSplash';

registerSW({ immediate: true });

export default function App() {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const [intro, setIntro] = useState(shouldPlayIntro);
  const pending = useLiveQuery(() => db.checks.where('status').equals('pending').count(), [], 0);

  useEffect(() => {
    warmUp();
    return startAutoSync();
  }, []);
  useEffect(() => prefetchAdvicePack(loadSettings().lang), [i18n.language]);

  const tabs = [
    { to: '/', label: t('nav.home'), icon: '🏠', end: true },
    { to: '/history', label: t('nav.history'), icon: '🗂️', badge: pending },
    { to: '/schemes', label: t('nav.schemes'), icon: '📜' },
    { to: '/settings', label: t('nav.settings'), icon: '⚙️' },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {intro && <IntroSplash onDone={() => setIntro(false)} />}
      {!online && (
        <div role="status" className="bg-amber-200 px-4 py-2 text-center text-sm font-semibold text-amber-950">
          {t('app.offline_banner')}
        </div>
      )}
      {USE_FIXTURES && (
        <div className="bg-sky-100 px-4 py-1 text-center text-xs text-sky-900">Fixtures mode (no backend)</div>
      )}
      <main className="flex-1 px-4 pb-28 pt-4">
        <Routes>
          <Route path="/" element={<Home pending={pending} />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/history" element={<History />} />
          <Route path="/schemes" element={<Schemes />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex min-h-[60px] flex-col items-center justify-center text-xs font-semibold ${isActive ? 'text-leaf-800' : 'text-gray-500'}`
                }
              >
                <span aria-hidden className="text-xl">{tab.icon}</span>
                {tab.label}
                {!!tab.badge && (
                  <span className="absolute right-5 top-1 min-w-[20px] rounded-full bg-amber-500 px-1 text-center text-[11px] text-white">
                    {tab.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
