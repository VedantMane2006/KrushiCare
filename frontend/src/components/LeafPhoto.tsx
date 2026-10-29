import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosisResult } from '../services/types';
import Thumb from './Thumb';

/** The leaf photo, with a Grad-CAM heatmap switch (off by default) when the result has one. */
export default function LeafPhoto({ blob, gradcam }: { blob: Blob; gradcam?: DiagnosisResult['gradcam'] }) {
  const { t } = useTranslation();
  const [heat, setHeat] = useState(false);
  const showHeat = heat && !!gradcam;

  return (
    <section className="card space-y-3">
      {gradcam && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">🔍 {t('gradcam.title')}</h2>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 font-semibold text-gray-800">
            {t('gradcam.toggle')}
            <button
              role="switch"
              aria-checked={heat}
              aria-label={t('gradcam.toggle')}
              onClick={() => setHeat(!heat)}
              className={`relative h-7 w-12 rounded-full transition-colors ${heat ? 'bg-leaf-700' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${heat ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-gray-100">
        {showHeat ? (
          <img src={gradcam!.image} alt={t('gradcam.alt')} className="mx-auto max-h-80 w-full object-contain" />
        ) : (
          <Thumb blob={blob} className="mx-auto max-h-80 w-full object-contain" />
        )}
      </div>
      {showHeat && (
        <p className="text-sm text-gray-700">
          {t('gradcam.help')}{' '}
          {gradcam.method === 'demo' && <span className="font-semibold text-amber-800">{t('gradcam.demo')}</span>}
        </p>
      )}
    </section>
  );
}
