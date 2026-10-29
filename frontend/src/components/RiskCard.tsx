import { useTranslation } from 'react-i18next';
import type { DiagnosisResult } from '../services/types';
import Icon from './Icon';

const LEVEL_TONE = {
  high: 'bg-red-600 text-white',
  medium: 'bg-amber-400 text-amber-950',
  low: 'bg-leaf-600 text-white',
  not_assessed: 'bg-gray-200 text-gray-800',
} as const;

export default function RiskCard({ risk }: { risk: DiagnosisResult['weather_risk'] }) {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric' });
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="cloud" className="h-5 w-5 text-field" />{t('risk.title')}</h2>
        <span className={`chip shrink-0 whitespace-nowrap ${LEVEL_TONE[risk.level]}`}>{t(`risk.${risk.level}`)}</span>
      </div>
      {risk.days.length > 0 && (
        <ol className="mt-3 grid grid-cols-3 gap-2 text-center">
          {risk.days.map((d) => (
            <li key={d.date} className="flex flex-col items-center gap-1" title={t(d.favourable ? 'risk.favourable_day' : 'risk.safe_day')}>
              <span className={`h-6 w-6 rounded-full ${d.favourable ? 'bg-red-600' : 'bg-leaf-600'}`} aria-hidden />
              <span className="text-sm">{fmt.format(new Date(`${d.date}T12:00:00`))}</span>
              <span className="sr-only">{t(d.favourable ? 'risk.favourable_day' : 'risk.safe_day')}</span>
            </li>
          ))}
        </ol>
      )}
      {risk.days.length > 0 && (
        <p className="mt-3 flex gap-4 text-xs text-gray-600">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600" />{t('risk.favourable_day')}</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-leaf-600" />{t('risk.safe_day')}</span>
        </p>
      )}
      {risk.source && <p className="mt-2 text-xs text-gray-500">{t('risk.source')}</p>}
    </section>
  );
}
