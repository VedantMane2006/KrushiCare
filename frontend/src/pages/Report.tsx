import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { KCC_DISPLAY } from '../services/kcc';
import Thumb from '../components/Thumb';

/** One-page summary of a check, laid out to print or save as PDF. */
export default function Report() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const check = useLiveQuery(() => db.checks.get(id), [id], null);

  if (check === null) return <p className="py-10 text-center">{t('app.loading')}</p>;
  if (!check?.result) return <p className="py-10 text-center">{t('report.not_ready')}</p>;

  const r = check.result;
  const v = r.verdict;
  const headline =
    v.status === 'likely' && v.label
      ? v.label.endsWith('__healthy')
        ? t('result.healthy')
        : t(v.confidence === 'high' ? 'result.likely_high' : 'result.likely_medium', { disease: t(`label.${v.label}`) })
      : t(`result.${v.status}`);
  const date = new Date(check.captured_at).toLocaleString(i18n.language);
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  async function share() {
    const text = `${t('report.title')}: ${headline}\n${r.advice.summary}\n${r.advice.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')}\nKCC: ${KCC_DISPLAY}`;
    if (navigator.share) await navigator.share({ title: t('report.title'), text }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  return (
    <article className="report space-y-5 bg-white p-4 text-gray-900 print:p-0">
      <header className="flex items-start justify-between gap-3 border-b-2 border-leaf-800 pb-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-leaf-800">{t('app.name')}</p>
          <h1 className="text-2xl font-bold">{t('report.title')}</h1>
          <p className="text-sm text-gray-600">
            {t(`home.crop_${check.crop}`)} · {date}
            {r.source === 'device' && ` · ${t('result.offline_check')}`}
          </p>
        </div>
        <Thumb blob={check.blob} className="h-20 w-20 shrink-0 rounded-lg" />
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('report.diagnosis')}</h2>
        <p className="text-xl font-bold">{headline}</p>
        {v.confidence && <p className="text-sm">{t(`result.confidence_${v.confidence}`)}</p>}
        {r.verdict.status === 'retake' && r.quality?.reason_key && <p>{t(r.quality.reason_key)}</p>}
        {r.classifier && (
          <table className="mt-2 w-full text-sm">
            <tbody>
              {r.classifier.top3.map((c) => (
                <tr key={c.label} className="border-b border-gray-200">
                  <td className="py-1">{t(`label.${c.label}`)}</td>
                  <td className="py-1 text-right tabular-nums">{Math.round(c.prob * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {r.advice.steps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('result.next_steps')}</h2>
          {r.advice.summary && <p className="mt-1">{r.advice.summary}</p>}
          <ol className="mt-1 list-decimal space-y-1 pl-6">
            {r.advice.steps.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ol>
          {r.advice.citations.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
              {r.advice.citations.map((c) => (
                <li key={c.id}>
                  {c.title}: <span className="break-all">{c.url}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('risk.title')}</h2>
          <p className="font-semibold">{t(`risk.${r.weather_risk.level}`)}</p>
          <ul className="text-sm">
            {r.weather_risk.days.map((d) => (
              <li key={d.date}>
                {dayFmt.format(new Date(`${d.date}T12:00:00`))}: {t(d.favourable ? 'risk.favourable_day' : 'risk.safe_day')}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('soil.title')}</h2>
          {r.soil.moisture != null && <p className="text-sm">{t('soil.moisture')}: {Math.round(r.soil.moisture * 100)}%</p>}
          {r.soil.temperature_c != null && <p className="text-sm">{t('soil.temperature')}: {r.soil.temperature_c.toFixed(1)}°C</p>}
          <p className="text-sm">{t(`soil.irrigation.${r.soil.irrigation_key}`)}</p>
          {r.soil.flags.map((f) => (
            <p key={f} className="text-sm text-amber-900">⚠️ {t(`soil.flag.${f}`, { defaultValue: f })}</p>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-300 pt-3 text-sm">
        <p>📞 {t('result.call_kcc')}: <strong>{KCC_DISPLAY}</strong></p>
        <p className="mt-1 text-xs text-gray-500">{t('result.disclaimer')}</p>
        <p className="mt-1 text-xs text-gray-400">ID {check.client_id}</p>
      </footer>

      <div className="space-y-3 print:hidden">
        <button className="btn-primary" onClick={() => window.print()}>🖨️ {t('report.print')}</button>
        <button className="btn-secondary" onClick={() => void share()}>📤 {t('report.share')}</button>
        <Link to={`/result/${check.client_id}`} className="block py-2 text-center text-gray-700 underline">{t('report.back')}</Link>
      </div>
    </article>
  );
}
