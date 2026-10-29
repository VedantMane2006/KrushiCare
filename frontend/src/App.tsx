import { useEffect, useState } from 'react';
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
import InstallButton from './components/InstallButton';
import FarmerSplash, { shouldPlayIntro } from './components/intro/FarmerSplash';
import Icon from './components/Icon';

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
  useEffect(() => {
    const lang = loadSettings().lang;
    prefetchAdvicePack(lang, (pack) => storeAdvicePack(lang, pack));
  }, [i18n.language]);

  const tabs = [
    { to: '/', label: t('nav.home'), icon: 'home' as const, end: true },
    { to: '/history', label: t('nav.history'), icon: 'history' as const, badge: pending },
    { to: '/schemes', label: t('nav.schemes'), icon: 'scroll' as const },
    { to: '/settings', label: t('nav.settings'), icon: 'settings' as const },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      {intro && <FarmerSplash onDone={() => setIntro(false)} />}
      {!online && (
        <div role="status" className="bg-chili px-4 py-2 text-center text-sm font-semibold text-wheat">
          {t('app.offline_banner')}
        </div>
      )}
      {USE_FIXTURES && (
        <div className="bg-sky-100 px-4 py-1 text-center text-xs text-sky-900">Fixtures mode (no backend)</div>
      )}
      {/* Laptop and tablet: a top bar. Phones use the bottom tab bar below. */}
      <header className="sticky top-0 z-30 hidden bg-forest text-paper print:hidden md:block">
        <div className="mx-auto flex max-w-6xl items-stretch gap-6 px-6">
          <NavLink to="/" className="flex items-center gap-2.5 py-3">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="font-display text-2xl font-bold tracking-tight text-wheat">{t('app.name')}</span>
          </NavLink>
          <nav className="ml-auto flex items-stretch gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 border-b-[3px] px-3 font-medium transition-colors ${isActive ? 'border-wheat text-wheat' : 'border-transparent text-paper/75 hover:text-paper'}`
                }
              >
                <Icon name={tab.icon} className="h-[18px] w-[18px]" />
                {tab.label}
                {!!tab.badge && (
                  <span className="min-w-[20px] rounded bg-tomato px-1 text-center text-[11px] font-semibold text-white">{tab.badge}</span>
                )}
              </NavLink>
            ))}
            <span className="ml-3 flex items-center"><InstallButton compact /></span>
            <span className="ml-2 flex items-center">
              <NavLink to="/capture" className="flex items-center gap-2 rounded-md bg-tomato px-4 py-2 font-semibold text-white hover:bg-red-700">
                <Icon name="camera" className="h-5 w-5" /> {t('home.check_leaf')}
              </NavLink>
            </span>
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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-forest/20 bg-paper pb-[env(safe-area-inset-bottom)] print:hidden md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-tomato before:absolute before:inset-x-6 before:top-0 before:h-[3px] before:bg-tomato' : 'text-gray-600'}`
                }
              >
                <Icon name={tab.icon} className="h-6 w-6" />
                {tab.label}
                {!!tab.badge && (
                  <span className="absolute right-5 top-1.5 min-w-[18px] rounded bg-tomato px-1 text-center text-[11px] text-white">
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
