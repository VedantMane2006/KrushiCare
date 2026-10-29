import { useTranslation } from 'react-i18next';
import { DISTRICTS } from '../services/districts';

const STATES = [...new Set(DISTRICTS.map((d) => d.state))];

/** District picker grouped by state. value '' = none. */
export default function DistrictSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('settings.district')}
      className="min-h-[52px] w-full rounded-xl border-2 border-gray-300 bg-white px-3 text-lg focus:border-leaf-700 focus:outline-none"
    >
      <option value="">{t('settings.district_none')}</option>
      {STATES.map((s) => (
        <optgroup key={s} label={s}>
          {DISTRICTS.filter((d) => d.state === s).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
