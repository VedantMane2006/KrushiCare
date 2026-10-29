import { useTranslation } from 'react-i18next';
import type { DiagnosisResult } from '../services/types';
import Icon from './Icon';

export default function SoilCard({ soil }: { soil: DiagnosisResult['soil'] }) {
  const { t } = useTranslation();
  const pct = soil.moisture != null ? Math.round(soil.moisture * 100) : null;
  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="sprout" className="h-5 w-5 text-field" />{t('soil.title')}</h2>
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
      <p className="flex items-start gap-2 rounded-md border-l-4 border-field bg-leaf-50 p-3 text-forest"><Icon name="drop" className="mt-0.5 h-5 w-5 text-field" />{t(`soil.irrigation.${soil.irrigation_key}`)}</p>
      {soil.flags.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700">{t('soil.card_title')}</p>
          <ul className="mt-1 space-y-1">
            {soil.flags.map((f) => (
              <li key={f} className="flex items-center gap-2 text-chili"><Icon name="alert" className="h-4 w-4" />{t(`soil.flag.${f}`, { defaultValue: f })}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
