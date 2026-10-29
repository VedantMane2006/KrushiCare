import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../services/db';
import { loadSettings, saveSettings } from '../services/settings';
import type { Lang, SoilCard } from '../services/types';
import { LANGS } from './Home';

const FIELDS: { key: keyof SoilCard; step: string }[] = [
  { key: 'ph', step: '0.1' },
  { key: 'n', step: '1' },
  { key: 'p', step: '0.1' },
  { key: 'k', step: '1' },
  { key: 'oc', step: '0.01' },
];

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [card, setCard] = useState<Record<string, string>>(() => {
    const c = loadSettings().soilCard ?? {};
    return Object.fromEntries(FIELDS.map((f) => [f.key, c[f.key] != null ? String(c[f.key]) : '']));
  });
  const [saved, setSaved] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const values: SoilCard = {};
    for (const f of FIELDS) {
      const v = parseFloat(card[f.key]);
      if (!Number.isNaN(v)) values[f.key] = v;
    }
    saveSettings({ soilCard: Object.keys(values).length ? values : null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function clearHistory() {
    if (window.confirm(t('settings.clear_confirm'))) await db.checks.clear();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-leaf-900">{t('settings.title')}</h1>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">{t('settings.language')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              aria-pressed={i18n.language === l.id}
              onClick={() => {
                saveSettings({ lang: l.id as Lang, langChosen: true });
                void i18n.changeLanguage(l.id);
              }}
              className={`min-h-[52px] rounded-xl border-2 text-lg font-semibold ${
                i18n.language === l.id ? 'border-leaf-800 bg-leaf-800 text-white' : 'border-gray-300 bg-white'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </section>

      <form className="card space-y-3" onSubmit={save}>
        <h2 className="text-lg font-bold">{t('settings.soil_card')}</h2>
        <p className="text-sm text-gray-600">{t('settings.soil_card_help')}</p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col justify-end">
              <span className="text-sm font-semibold text-gray-700">{t(`settings.${f.key}`)}</span>
              <input
                type="number"
                inputMode="decimal"
                step={f.step}
                min="0"
                value={card[f.key]}
                onChange={(e) => setCard({ ...card, [f.key]: e.target.value })}
                className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-gray-300 px-3 text-lg focus:border-leaf-700 focus:outline-none"
              />
            </label>
          ))}
        </div>
        <button className="btn-primary" type="submit">{saved ? `✓ ${t('settings.saved')}` : t('settings.save')}</button>
      </form>

      <button className="btn-danger" onClick={() => void clearHistory()}>{t('settings.clear_history')}</button>
    </div>
  );
}
