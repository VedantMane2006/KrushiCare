import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadSettings, saveSettings } from '../services/settings';
import type { Crop, Lang } from '../services/types';
import KccButton from '../components/KccButton';
import InstallButton from '../components/InstallButton';
import Icon from '../components/Icon';

const CROPS: Crop[] = ['tomato', 'potato'];

function CropArt({ crop }: { crop: Crop }) {
  if (crop === 'tomato') {
    return (
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden>
        <ellipse cx="32" cy="37" rx="22" ry="19" fill="#d63121" />
        <path d="M14 33c2 10 10 17 20 17 8 0 15-5 18-12-5 6-12 9-19 8-9-1-16-6-19-13z" fill="#7c1a10" opacity="0.45" />
        <ellipse cx="23" cy="30" rx="5" ry="3" fill="#f5dea4" opacity="0.45" transform="rotate(-25 23 30)" />
        <path d="M32 22l4-6 1 7 7-2-5 5 6 3-8 0-1 6-4-5-4 5-1-6-8 0 6-3-5-5 7 2 1-7z" fill="#558934" />
        <path d="M32 21v-7" stroke="#274636" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden>
      <path d="M12 36c-2-10 6-19 18-20 10-1 20 3 22 11 3 10-5 20-19 21-11 1-19-4-21-12z" fill="#b98a4e" />
      <path d="M13 40c4 7 12 10 21 9 9-1 16-6 18-13-4 6-11 9-19 9-8 1-15-1-20-5z" fill="#7c5a2e" opacity="0.5" />
      <g fill="#7c5a2e">
        <circle cx="24" cy="29" r="1.6" /><circle cx="37" cy="26" r="1.4" /><circle cx="42" cy="36" r="1.6" />
        <circle cx="29" cy="40" r="1.3" /><circle cx="19" cy="37" r="1.2" />
      </g>
    </svg>
  );
}
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
      <header className="border-b-2 border-forest pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-forest md:text-5xl">{t('app.name')}</h1>
        <p className="mt-1 text-lg text-gray-700">{t('app.tagline')}</p>
      </header>

      <section aria-labelledby="lang-h">
        <h2 id="lang-h" className="eyebrow mb-2 font-sans">{t('home.choose_language')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => pickLang(l.id)}
              aria-pressed={i18n.language === l.id}
              className={`min-h-[52px] rounded-md border-[1.5px] text-lg font-semibold ${
                i18n.language === l.id ? 'border-forest bg-forest text-wheat' : 'border-forest/25 bg-[#f7efdd] text-ink hover:border-forest/50'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="crop-h">
        <h2 id="crop-h" className="eyebrow mb-2 font-sans">{t('home.choose_crop')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {CROPS.map((c) => (
            <button
              key={c}
              onClick={() => pickCrop(c)}
              aria-pressed={crop === c}
              className={`relative flex min-h-[128px] flex-col items-center justify-center gap-1 rounded-lg border-2 bg-[#f7efdd] font-display text-xl font-bold ${
                crop === c ? 'border-forest text-forest' : 'border-forest/15 text-gray-700 hover:border-forest/40'
              }`}
            >
              <CropArt crop={c} />
              {t(`home.crop_${c}`)}
              {crop === c && (
                <span className="absolute right-2 top-2 rounded bg-forest p-0.5 text-wheat">
                  <Icon name="check" className="h-4 w-4" />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      </div>
      <div className="md-dark space-y-6 md:rounded-lg md:bg-forest md:p-8 md:text-paper">
      <p className="hidden font-display text-2xl leading-snug text-wheat md:block">{t('home.desktop_hint')}</p>
      <button className="btn-primary min-h-[72px] text-xl" onClick={() => navigate('/capture')}>
        <Icon name="camera" className="h-6 w-6" /> {t('home.check_leaf')}
      </button>

      {pending > 0 && (
        <Link to="/history" className="block rounded-md border border-chili/30 bg-wheat px-4 py-3 text-center font-semibold text-chili">
          <Icon name="clock" className="mr-1.5 inline h-5 w-5 align-[-4px]" />{t('home.pending_badge', { count: pending })}
        </Link>
      )}

      <div className="pt-2">
        <p className="mb-2 text-center text-sm text-gray-600 md:text-paper/75">{t('home.kcc_help')}</p>
        <KccButton />
      </div>
      </div>
      <div className="md:col-start-2">
        <InstallButton />
      </div>
    </div>
  );
}
