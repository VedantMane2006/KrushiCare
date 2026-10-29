import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../services/db';
import { getContext } from '../services/api';
import { districtById } from '../services/districts';
import { loadSettings, saveSettings } from '../services/settings';
import type { Check } from '../services/types';
import DistrictSelect from './DistrictSelect';
import Icon from './Icon';

/** For a check made without location: pick a district, then fill in weather risk, soil and the climate card. */
export default function LocationFix({ check }: { check: Check }) {
  const { t } = useTranslation();
  const [district, setDistrict] = useState(loadSettings().district ?? '');
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');

  async function apply(id: string) {
    setDistrict(id);
    const d = districtById(id);
    if (!d || !check.result) return;
    saveSettings({ district: id });
    setState('working');
    try {
      const ctx = await getContext(d.lat, d.lon, check.crop);
      const r = check.result;
      // Soil Health Card values and flags came with the check; keep them.
      const soil = { ...ctx.soil, card_values: r.soil.card_values, flags: r.soil.flags };
      await db.checks.update(check.client_id, { lat: d.lat, lon: d.lon, result: { ...r, weather_risk: ctx.weather_risk, soil } });
      setState('idle');
    } catch {
      setState('failed');
    }
  }

  return (
    <section className="card space-y-2 border-2 border-dashed border-leaf-600/40">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="pin" className="h-5 w-5 text-field" />{t('locfix.title')}</h2>
      <p className="text-sm text-gray-700">{t('locfix.help')}</p>
      <DistrictSelect value={district} onChange={(id) => void apply(id)} />
      {district && state === 'idle' && (
        <button className="btn-secondary" onClick={() => void apply(district)}>{t('locfix.use')}</button>
      )}
      {state === 'working' && <p className="text-sm text-gray-600" role="status">{t('app.loading')}</p>}
      {state === 'failed' && <p className="text-sm text-red-800" role="alert">{t('locfix.failed')}</p>}
    </section>
  );
}
