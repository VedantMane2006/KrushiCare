import { useTranslation } from 'react-i18next';
import { cropOf } from '../services/verdict';
import type { DiagnosisResult } from '../services/types';

export default function VerdictBanner({ r }: { r: DiagnosisResult }) {
  const { t } = useTranslation();
  const { status, label, confidence } = r.verdict;
  const disease = label ? t(`label.${label}`) : '';

  if (status === 'likely') {
    const healthy = label?.endsWith('__healthy');
    const high = confidence === 'high';
    // Healthy: forest green. A confident disease call: chili red. Less sure: wheat.
    const tone = healthy ? 'bg-forest text-paper' : high ? 'bg-chili text-paper' : 'border-2 border-chili/40 bg-wheat text-chili';
    return (
      <section className={`rounded-lg p-5 ${tone}`} aria-live="polite">
        <p className="font-display text-[1.7rem] font-bold leading-tight">
          {healthy ? t('result.healthy') : t(high ? 'result.likely_high' : 'result.likely_medium', { disease })}
        </p>
        {healthy && <p className="mt-1 text-lg">{disease}</p>}
        <span className={`chip mt-3 ${healthy || high ? 'bg-paper/15 text-paper' : 'bg-chili text-paper'}`}>{t(`result.confidence_${confidence}`)}</span>
      </section>
    );
  }

  if (status === 'uncertain') {
    const wrongCrop = label && cropOf(label) !== r.crop;
    return (
      <section className="rounded-2xl border border-forest/20 bg-gray-100 p-5 text-gray-900" aria-live="polite">
        <p className="font-display text-2xl font-bold">{t('result.uncertain')}</p>
        <p className="mt-1">{wrongCrop ? t('result.wrong_crop') : t('result.uncertain_body')}</p>
        {r.classifier && (
          <div className="mt-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('result.top3')}</p>
            <ol className="mt-1 space-y-1">
              {r.classifier.top3.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span className="flex-1">{t(`label.${c.label}`)}</span>
                  <span className="h-2 w-20 overflow-hidden rounded bg-white">
                    <span className="block h-full bg-field" style={{ width: `${Math.round(c.prob * 100)}%` }} />
                  </span>
                  <span className="w-10 text-right text-sm tabular-nums">{Math.round(c.prob * 100)}%</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    );
  }

  if (status === 'retake') {
    const key = r.quality?.reason_key ?? 'quality.unknown';
    return (
      <section className="rounded-2xl border-l-[6px] border-tomato bg-red-50 p-5 text-chili" aria-live="polite">
        <p className="font-display text-2xl font-bold">{t('result.retake')}</p>
        <p className="mt-1 text-lg">{t(key, { defaultValue: t('quality.unknown') })}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-slate-700 p-5 text-white" aria-live="polite">
      <p className="font-display text-2xl font-bold">{t('result.unsupported')}</p>
      <p className="mt-1">{t('result.unsupported_body')}</p>
    </section>
  );
}
