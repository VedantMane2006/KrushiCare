import { useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { registerSW } from 'virtual:pwa-register';
import { db } from './services/db';
import { useOnline } from './hooks/useOnline';
import { prefetchAdvicePack, USE_FIXTURES, warmUp } from './services/api';
import { startAutoSync } from './services/sync';
import { storeAdvicePack } from './services/onDevice';
import { loadSettings } from './services/settings';
import Home from './pages/Home';
import Capture from './pages/Capture';
import Result from './pages/Result';
import History from './pages/History';
import Schemes from './pages/Schemes';
import Settings from './pages/Settings';
import Report from './pages/Report';

registerSW({ immediate: true });

export default function App() {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const pending = useLiveQuery(() => db.checks.where('status').equals('pending').count(), [], 0);

  useEffect(() => {
    warmUp();
    return startAutoSync();
  }, []);
  useEffect(() => {
    const lang = loadSettings().lang;
    prefetchAdvicePack(lang, (pack) => storeAdvicePack(lang, pack));
  }, [i18n.language]);

  const tabs = [
    { to: '/', label: t('nav.home'), icon: '🏠', end: true },
    { to: '/history', label: t('nav.history'), icon: '🗂️', badge: pending },
    { to: '/schemes', label: t('nav.schemes'), icon: '📜' },
    { to: '/settings', label: t('nav.settings'), icon: '⚙️' },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      {!online && (
        <div role="status" className="bg-amber-200 px-4 py-2 text-center text-sm font-semibold text-amber-950">
          {t('app.offline_banner')}
        </div>
      )}
      {USE_FIXTURES && (
        <div className="bg-sky-100 px-4 py-1 text-center text-xs text-sky-900">Fixtures mode (no backend)</div>
      )}
      {/* Laptop and tablet: a top bar. Phones use the bottom tab bar below. */}
      <header className="sticky top-0 z-30 hidden border-b border-black/10 bg-white/95 backdrop-blur print:hidden md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
          <NavLink to="/" className="flex items-center gap-2 py-3 text-xl font-bold text-leaf-900">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            {t('app.name')}
          </NavLink>
          <nav className="ml-auto flex items-center gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-xl px-4 py-2 font-semibold ${isActive ? 'bg-leaf-50 text-leaf-900' : 'text-gray-600 hover:bg-gray-100'}`
                }
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
                {!!tab.badge && (
                  <span className="min-w-[20px] rounded-full bg-amber-500 px-1 text-center text-[11px] text-white">{tab.badge}</span>
                )}
              </NavLink>
            ))}
            <NavLink to="/capture" className="ml-2 rounded-xl bg-leaf-800 px-4 py-2 font-semibold text-white shadow-sm hover:bg-leaf-900">
              📷 {t('home.check_leaf')}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4 md:max-w-6xl md:px-6 md:pb-12 md:pt-8">
        <Routes>
          <Route path="/" element={<Home pending={pending} />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/history" element={<History />} />
          <Route path="/schemes" element={<Schemes />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t print:hidden md:hidden border-black/10 bg-white pb-[env(safe-area-inset-bottom)]">
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
