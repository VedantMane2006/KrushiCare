import { useTranslation } from 'react-i18next';
import type { DiagnosisResult } from '../services/types';

export default function SoilCard({ soil }: { soil: DiagnosisResult['soil'] }) {
  const { t } = useTranslation();
  const pct = soil.moisture != null ? Math.round(soil.moisture * 100) : null;
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">🌱 {t('soil.title')}</h2>
      {(pct != null || soil.temperature_c != null) && (
        <dl className="grid grid-cols-2 gap-3">
          {pct != null && (
            <div>
              <dt className="text-sm text-gray-600">{t('soil.moisture')}</dt>
              <dd className="text-2xl font-bold tabular-nums">{pct}%</dd>
            </div>
          )}
          {soil.temperature_c != null && (
            <div>
              <dt className="text-sm text-gray-600">{t('soil.temperature')}</dt>
              <dd className="text-2xl font-bold tabular-nums">{soil.temperature_c.toFixed(1)}°C</dd>
            </div>
          )}
        </dl>
      )}
      <p className="rounded-xl bg-sky-50 p-3 text-sky-950">💧 {t(`soil.irrigation.${soil.irrigation_key}`)}</p>
      {soil.flags.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700">{t('soil.card_title')}</p>
          <ul className="mt-1 space-y-1">
            {soil.flags.map((f) => (
              <li key={f} className="text-amber-900">⚠️ {t(`soil.flag.${f}`, { defaultValue: f })}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
