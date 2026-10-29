import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosisResult } from '../services/types';
import Thumb from './Thumb';

/** The leaf photo, with a toggle to show the heatmap of where the disease shows. */
export default function LeafPhoto({ blob, gradcam }: { blob: Blob; gradcam?: DiagnosisResult['gradcam'] }) {
  const { t } = useTranslation();
  const [heat, setHeat] = useState(true);
  const showHeat = heat && !!gradcam;

  return (
    <section className="card space-y-3">
      <div className="overflow-hidden rounded-xl bg-gray-100">
        {showHeat ? (
          <img src={gradcam!.image} alt={t('gradcam.alt')} className="mx-auto max-h-80 w-full object-contain" />
        ) : (
          <Thumb blob={blob} className="mx-auto max-h-80 w-full object-contain" />
        )}
      </div>
      {gradcam && (
        <>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('gradcam.title')}>
            {[true, false].map((v) => (
              <button
                key={String(v)}
                aria-pressed={heat === v}
                onClick={() => setHeat(v)}
                className={`min-h-[44px] rounded-xl border-2 font-semibold ${heat === v ? 'border-leaf-800 bg-leaf-800 text-white' : 'border-gray-300 bg-white'}`}
              >
                {t(v ? 'gradcam.show' : 'gradcam.photo')}
              </button>
            ))}
          </div>
          {showHeat && (
            <p className="text-sm text-gray-700">
              {t('gradcam.help')}{' '}
              {gradcam.method === 'demo' && <span className="font-semibold text-amber-800">{t('gradcam.demo')}</span>}
            </p>
          )}
        </>
      )}
    </section>
  );
}
