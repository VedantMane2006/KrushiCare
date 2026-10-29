import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getClimate } from '../services/api';
import type { Climate } from '../services/types';
import Icon from './Icon';

/** "This season vs normal": rain and temperature so far against the 1991-2020 average. Hidden if unavailable. */
export default function ClimateCard({ lat, lon }: { lat: number; lon: number }) {
  const { t, i18n } = useTranslation();
  const [c, setC] = useState<Climate | null>(null);

  useEffect(() => {
    let live = true;
    getClimate(lat, lon).then((v) => live && setC(v), () => undefined);
    return () => {
      live = false;
    };
  }, [lat, lon]);

  if (!c) return null;
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  const pct = c.rain_pct_of_normal;
  const bar = Math.min(200, pct ?? 100);
  const rainTone = pct == null ? 'text-gray-700' : pct < 75 ? 'text-amber-800' : pct > 125 ? 'text-sky-800' : 'text-leaf-800';
  const d = c.temp_anomaly_c;
  const tempText =
    Math.abs(d) < 0.5
      ? t('climate.temp_normal')
      : t(d > 0 ? 'climate.warmer' : 'climate.cooler', { deg: Math.abs(d).toFixed(1) });

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="calendar" className="h-5 w-5 text-field" />{t('climate.title')}</h2>
        <p className="text-sm text-gray-600">
          {t(`climate.season.${c.season}`)} · {t('climate.period', { start: fmt.format(new Date(c.period.start)), end: fmt.format(new Date(c.period.end)) })}
        </p>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex shrink-0 items-center gap-1.5 font-semibold"><Icon name="rain" className="h-4 w-4 text-forest" />{t('climate.rain')}</span>
          <span className={`text-right font-bold ${rainTone}`}>
            {pct == null ? t('climate.dry_season') : t('climate.rain_pct', { pct })}
          </span>
        </div>
        {/* Bar scale: full width = 200 % of normal, with a tick at normal. */}
        <div className="relative mt-1 h-3 rounded-full bg-gray-100" aria-hidden>
          <div className="h-3 rounded-full bg-sky-600" style={{ width: `${bar / 2}%` }} />
          <div className="absolute inset-y-[-3px] left-1/2 w-0.5 bg-gray-700" />
        </div>
        <p className="mt-1 text-sm text-gray-600">{t('climate.rain_detail', { now: Math.round(c.rain_mm), normal: Math.round(c.normal_rain_mm) })}</p>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex shrink-0 items-center gap-1.5 font-semibold"><Icon name="thermo" className="h-4 w-4 text-forest" />{t('climate.temp')}</span>
        <span className={`text-right font-bold ${d >= 0.5 ? 'text-red-700' : d <= -0.5 ? 'text-sky-800' : 'text-leaf-800'}`}>{tempText}</span>
      </div>
      <p className="text-sm text-gray-600">{t('climate.temp_detail', { now: c.temp_c.toFixed(1), normal: c.normal_temp_c.toFixed(1) })}</p>
      <p className="text-xs text-gray-500">{t('climate.source', { baseline: c.baseline })}</p>
    </section>
  );
}
