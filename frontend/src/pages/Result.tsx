import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { retryCheck } from '../services/sync';
import type { TFunction } from 'i18next';
import type { DiagnosisResult } from '../services/types';
import VerdictBanner from '../components/VerdictBanner';
import RiskCard from '../components/RiskCard';
import SoilCard from '../components/SoilCard';
import ClimateCard from '../components/ClimateCard';
import AdviceList from '../components/AdviceList';
import KccButton from '../components/KccButton';
import Thumb from '../components/Thumb';
import LeafPhoto from '../components/LeafPhoto';
import LocationFix from '../components/LocationFix';
import Icon from '../components/Icon';

function shareText(r: DiagnosisResult, t: TFunction) {
  const v = r.verdict;
  const head =
    v.status === 'likely' && v.label
      ? t(v.confidence === 'high' ? 'result.likely_high' : 'result.likely_medium', { disease: t(`label.${v.label}`) })
      : t(`result.${v.status}`);
  const steps = r.advice.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
  return `AgriSense: ${head}\n${r.advice.summary}\n${steps}\nKCC: ${r.escalation.kcc_phone}`;
}

export default function Result() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const check = useLiveQuery(() => db.checks.get(id), [id], null);

  if (check === null) return <p className="py-10 text-center">{t('app.loading')}</p>;
  if (!check) return <p className="py-10 text-center">{t('app.error_generic')}</p>;

  const r = check.result;
  const noPlace = check.lat == null || check.lon == null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Thumb blob={check.blob} className="h-16 w-16 rounded-xl lg:hidden" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-leaf-900">{t('result.title')}</h1>
          <p className="text-sm text-gray-600">
            {t(`home.crop_${check.crop}`)} · {new Date(check.captured_at).toLocaleString()}
          </p>
        </div>
        {r?.source === 'device' && <span className="chip bg-sky-100 text-sky-900">{t('result.offline_check')}</span>}
      </div>

      {r?.source === 'device' && check.status === 'pending' && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-950">{t('result.offline_note')}</p>
      )}
      {!r && check.status === 'pending' && (
        <section className="rounded-2xl bg-amber-100 p-5 text-amber-950">
          <p className="text-xl font-bold"><Icon name="clock" className="mr-2 inline h-6 w-6 align-[-4px]" />{t('queue.status.pending')}</p>
          <p className="mt-1">{t('capture.saved_offline')}</p>
        </section>
      )}
      {!r && check.status === 'failed' && (
        <section className="space-y-3 rounded-2xl bg-red-50 p-5 text-red-900">
          <p className="text-xl font-bold">{t('queue.status.failed')}</p>
          {check.error && <p className="text-sm">{check.error}</p>}
          <button className="btn-secondary" onClick={() => void retryCheck(check.client_id)}>{t('queue.retry')}</button>
        </section>
      )}

      {r && (
        // One column on phones; on laptops the diagnosis sits left and weather, soil and actions right.
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4">
            <VerdictBanner r={r} />
            {(r.gradcam || r.verdict.status !== 'retake') && (
              <div className={r.gradcam ? '' : 'hidden lg:block'}>
                <LeafPhoto blob={check.blob} gradcam={r.gradcam} />
              </div>
            )}
            {r.verdict.status === 'retake' && (
              <button className="btn-primary" onClick={() => navigate('/capture')}><Icon name="camera" /> {t('result.retake_button')}</button>
            )}
            {(r.verdict.status === 'uncertain' || r.verdict.status === 'unsupported') && <KccButton variant="primary" />}
            {r.verdict.status !== 'retake' && <AdviceList advice={r.advice} />}
          </div>
          <div className="space-y-4">
            {noPlace && r.source !== 'device' && <LocationFix check={check} />}
            <RiskCard risk={r.weather_risk} />
            <SoilCard soil={r.soil} />
            {!noPlace && <ClimateCard lat={check.lat!} lon={check.lon!} />}
            {r.verdict.status === 'likely' && <KccButton />}
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to={`/report/${check.client_id}`} className="btn-secondary">
                <Icon name="file" /> {t('report.open')}
              </Link>
              <a
                className="btn-secondary"
                href={`https://wa.me/?text=${encodeURIComponent(shareText(r, t))}`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="chat" /> {t('result.share')}
              </a>
            </div>
            <Link to="/capture" className="btn-primary"><Icon name="camera" /> {t('result.new_check')}</Link>
          </div>
        </div>
      )}

      {!r && <Link to="/capture" className="btn-primary"><Icon name="camera" /> {t('result.new_check')}</Link>}
    </div>
  );
}
