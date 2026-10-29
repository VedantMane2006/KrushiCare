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
    const tone = healthy || high ? 'bg-leaf-800 text-white' : 'bg-amber-400 text-amber-950';
    return (
      <section className={`rounded-2xl p-5 ${tone}`} aria-live="polite">
        <p className="text-2xl font-bold leading-snug">
          {healthy ? t('result.healthy') : t(high ? 'result.likely_high' : 'result.likely_medium', { disease })}
        </p>
        {healthy && <p className="mt-1 text-lg">{disease}</p>}
        <span className={`chip mt-3 ${high ? 'bg-white/20' : 'bg-white/40'}`}>{t(`result.confidence_${confidence}`)}</span>
      </section>
    );
  }

  if (status === 'uncertain') {
    const wrongCrop = label && cropOf(label) !== r.crop;
    return (
      <section className="rounded-2xl bg-gray-200 p-5 text-gray-900" aria-live="polite">
        <p className="text-2xl font-bold">{t('result.uncertain')}</p>
        <p className="mt-1">{wrongCrop ? t('result.wrong_crop') : t('result.uncertain_body')}</p>
        {r.classifier && (
          <div className="mt-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">{t('result.top3')}</p>
            <ol className="mt-1 space-y-1">
              {r.classifier.top3.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span className="flex-1">{t(`label.${c.label}`)}</span>
                  <span className="h-2 w-20 overflow-hidden rounded bg-white">
                    <span className="block h-full bg-gray-600" style={{ width: `${Math.round(c.prob * 100)}%` }} />
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
      <section className="rounded-2xl bg-orange-100 p-5 text-orange-950 ring-2 ring-orange-400" aria-live="polite">
        <p className="text-2xl font-bold">{t('result.retake')}</p>
        <p className="mt-1 text-lg">{t(key, { defaultValue: t('quality.unknown') })}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-slate-700 p-5 text-white" aria-live="polite">
      <p className="text-2xl font-bold">{t('result.unsupported')}</p>
      <p className="mt-1">{t('result.unsupported_body')}</p>
    </section>
  );
}
