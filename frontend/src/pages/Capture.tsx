import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { downscale } from '../services/image';
import { getLocation, type Coords } from '../services/geo';
import { districtById } from '../services/districts';
import { loadSettings, saveSettings } from '../services/settings';
import DistrictSelect from '../components/DistrictSelect';
import { createCheck, sendNow, tryOffline } from '../services/sync';
import { USE_FIXTURES } from '../services/api';
import Icon from '../components/Icon';

type Phase = 'idle' | 'working' | 'slow';

export default function Capture() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [locState, setLocState] = useState<'asking' | 'ok' | 'denied'>('asking');
  const [districtId, setDistrictId] = useState(loadSettings().district ?? '');
  const district = districtById(districtId);
  const locRef = useRef<Promise<Coords | null>>();

  // Ask for location once, as soon as the screen opens, so it is ready by the time the photo is.
  useEffect(() => {
    // GPS first; if it's off or denied, fall back to the district picked in Settings.
    locRef.current = getLocation().then((c) => {
      setLocState(c ? 'ok' : 'denied');
      return c;
    });
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhase('working');
    const { crop, lang } = loadSettings();
    const [blob, gps] = await Promise.all([downscale(file), locRef.current ?? Promise.resolve(null)]);
    // The district is read now, so a pick made on this screen counts.
    const d = districtById(loadSettings().district);
    const coords = gps ?? (d ? { lat: d.lat, lon: d.lon } : null);
    const check = await createCheck({ blob, crop, lang, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
    if (navigator.onLine || USE_FIXTURES) await sendNow(check, () => setPhase('slow'));
    else await tryOffline(check);
    navigate(`/result/${check.client_id}`, { replace: true });
  }

  if (phase !== 'idle') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center" role="status" aria-live="polite">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-leaf-100 border-t-leaf-800" />
        <p className="text-xl font-semibold">{t('capture.analysing')}</p>
        {phase === 'slow' && <p className="max-w-xs text-gray-700">{t('app.waking_server')}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-leaf-900">{t('capture.title')}</h1>
      <ul className="card space-y-2 text-lg">
        <li className="flex items-center gap-3"><Icon name="leaf" className="h-6 w-6 text-field" />{t('capture.tip_one_leaf')}</li>
        <li className="flex items-center gap-3"><Icon name="sun" className="h-6 w-6 text-field" />{t('capture.tip_daylight')}</li>
        <li className="flex items-center gap-3"><Icon name="hand" className="h-6 w-6 text-field" />{t('capture.tip_focus')}</li>
      </ul>

      {/* capture="environment" opens the rear camera on every phone; simpler than getUserMedia. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onFile} />

      <button className="btn-primary min-h-[72px] text-xl" onClick={() => cameraRef.current?.click()}>
        <Icon name="camera" className="h-6 w-6" /> {t('capture.take_photo')}
      </button>
      <button className="btn-secondary" onClick={() => galleryRef.current?.click()}>
        <Icon name="image" /> {t('capture.from_gallery')}
      </button>

      <p className="text-sm text-gray-600">
        <Icon name="pin" className="mr-1 inline h-4 w-4 align-[-2px]" />
        {locState === 'ok'
          ? t('capture.location_using_gps')
          : locState === 'denied' && district
            ? t('capture.location_using_district', { name: district.name })
            : locState === 'denied'
              ? t('capture.location_denied')
              : t('capture.location_ask')}{' '}
      </p>
      {locState === 'denied' && (
        <DistrictSelect
          value={districtId}
          onChange={(id) => {
            setDistrictId(id);
            saveSettings({ district: id || null });
          }}
        />
      )}
      <button className="w-full py-3 text-gray-700 underline" onClick={() => navigate(-1)}>
        {t('capture.cancel')}
      </button>
    </div>
  );
}
