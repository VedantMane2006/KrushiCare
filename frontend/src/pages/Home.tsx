import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadSettings, saveSettings } from '../services/settings';
import type { Crop, Lang } from '../services/types';
import KccButton from '../components/KccButton';
import InstallButton from '../components/InstallButton';

const CROPS: { id: Crop; emoji: string }[] = [
  { id: 'tomato', emoji: '🍅' },
  { id: 'potato', emoji: '🥔' },
];
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'hi', name: 'हिन्दी' },
  { id: 'mr', name: 'मराठी' },
];

export default function Home({ pending }: { pending: number }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [crop, setCrop] = useState<Crop>(loadSettings().crop);

  const pickLang = (lang: Lang) => {
    saveSettings({ lang, langChosen: true });
    void i18n.changeLanguage(lang);
  };
  const pickCrop = (c: Crop) => {
    setCrop(c);
    saveSettings({ crop: c });
  };

  return (
    <div className="space-y-6 md:grid md:grid-cols-2 md:items-start md:gap-10 md:space-y-0">
      <div className="space-y-6">
      <header className="flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-bold text-leaf-900">{t('app.name')}</h1>
          <p className="text-gray-700">{t('app.tagline')}</p>
        </div>
      </header>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">{t('home.choose_language')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => pickLang(l.id)}
              aria-pressed={i18n.language === l.id}
              className={`min-h-[52px] rounded-xl border-2 text-lg font-semibold ${
                i18n.language === l.id ? 'border-leaf-800 bg-leaf-800 text-white' : 'border-gray-300 bg-white text-gray-900'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="crop-h">
        <h2 id="crop-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">{t('home.choose_crop')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {CROPS.map((c) => (
            <button
              key={c.id}
              onClick={() => pickCrop(c.id)}
              aria-pressed={crop === c.id}
              className={`flex min-h-[120px] flex-col items-center justify-center rounded-2xl border-4 bg-white text-lg font-bold ${
                crop === c.id ? 'border-leaf-800 text-leaf-900' : 'border-transparent text-gray-800 ring-1 ring-black/10'
              }`}
            >
              <span aria-hidden className="text-5xl">{c.emoji}</span>
              {t(`home.crop_${c.id}`)}
            </button>
          ))}
        </div>
      </section>

      </div>
      <div className="space-y-6 md:card md:p-8">
      <p className="hidden text-lg text-gray-700 md:block">{t('home.desktop_hint')}</p>
      <button className="btn-primary min-h-[72px] text-xl" onClick={() => navigate('/capture')}>
        <span aria-hidden>📷</span> {t('home.check_leaf')}
      </button>

      {pending > 0 && (
        <Link to="/history" className="block rounded-xl bg-amber-100 px-4 py-3 text-center font-semibold text-amber-950">
          ⏳ {t('home.pending_badge', { count: pending })}
        </Link>
      )}

      <div className="pt-2">
        <p className="mb-2 text-center text-sm text-gray-600">{t('home.kcc_help')}</p>
        <KccButton />
      </div>
      <InstallButton />
      </div>
    </div>
  );
}
