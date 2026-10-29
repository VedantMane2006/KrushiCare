import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSchemes } from '../services/api';
import type { Lang, Scheme } from '../services/types';

export default function Schemes() {
  const { t, i18n } = useTranslation();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    getSchemes(i18n.language as Lang).then(setSchemes, () => setFailed(true));
  }, [i18n.language]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-leaf-900">{t('schemes.title')}</h1>
      {!schemes && !failed && <p className="text-center text-gray-600">{t('app.loading')}</p>}
      {failed && !schemes && <p className="card text-center text-gray-600">{t('schemes.empty')}</p>}
      {schemes?.map((s) => (
        <article key={s.id} className="card space-y-3">
          <h2 className="text-xl font-bold">{s.name}</h2>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('schemes.benefit')}</h3>
            <p>{s.benefit}</p>
          </div>
          {s.eligibility.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('schemes.eligibility')}</h3>
              <ul className="list-disc pl-5">{s.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {s.documents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('schemes.documents')}</h3>
              <ul className="list-disc pl-5">{s.documents.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          )}
          <a href={s.official_url} target="_blank" rel="noreferrer" className="btn-secondary">
            🔗 {t('schemes.official_link')}
          </a>
          <p className="text-xs text-gray-500">{t('schemes.last_checked', { date: s.last_checked })}</p>
        </article>
      ))}
    </div>
  );
}
