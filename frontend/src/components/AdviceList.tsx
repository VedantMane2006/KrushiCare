import { useTranslation } from 'react-i18next';
import type { Advice } from '../services/types';

export default function AdviceList({ advice }: { advice: Advice }) {
  const { t } = useTranslation();
  if (!advice.summary && advice.steps.length === 0) return null;
  const num = new Map(advice.citations.map((c, i) => [c.id, i + 1]));
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">✅ {t('result.next_steps')}</h2>
      {advice.summary && <p className="text-gray-800">{advice.summary}</p>}
      <ol className="list-decimal space-y-2 pl-6">
        {advice.steps.map((s, i) => (
          <li key={i} className="text-lg leading-snug">
            {s.text}
            {s.citation_id && num.has(s.citation_id) && (
              <a href={`#cite-${s.citation_id}`} className="ml-1 align-super text-sm font-semibold text-leaf-700 underline">
                [{num.get(s.citation_id)}]
              </a>
            )}
          </li>
        ))}
      </ol>
      {advice.citations.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700">{t('result.sources')}</p>
          <ol className="mt-1 space-y-1 text-sm">
            {advice.citations.map((c) => (
              <li key={c.id} id={`cite-${c.id}`}>
                [{num.get(c.id)}]{' '}
                <a href={c.url} target="_blank" rel="noreferrer" className="text-leaf-700 underline">
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-xs text-gray-500">{t('result.disclaimer')}</p>
    </section>
  );
}
