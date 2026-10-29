import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { syncPending } from '../services/sync';
import Thumb from '../components/Thumb';
import type { Check } from '../services/types';

const STATUS_TONE = {
  pending: 'bg-amber-100 text-amber-950',
  synced: 'bg-leaf-100 text-leaf-900',
  failed: 'bg-red-100 text-red-900',
} as const;

function headline(c: Check, t: (k: string) => string) {
  const v = c.result?.verdict;
  if (!v) return t(`home.crop_${c.crop}`);
  if (v.status === 'likely' && v.label) return t(`label.${v.label}`);
  return t(`result.${v.status}`);
}

export default function History() {
  const { t } = useTranslation();
  const checks = useLiveQuery(() => db.checks.orderBy('captured_at').reverse().toArray(), [], []);
  const [syncing, setSyncing] = useState(false);
  const hasUnsent = checks.some((c) => c.status !== 'synced');

  async function sendNow() {
    setSyncing(true);
    // "Send now" also gives failed items another full round of tries.
    await db.checks.where('status').equals('failed').modify({ status: 'pending', tries: 0, next_try_at: 0 });
    await syncPending(true);
    setSyncing(false);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-leaf-900">{t('queue.title')}</h1>
      {hasUnsent && (
        <button className="btn-primary md:w-auto" disabled={syncing} onClick={() => void sendNow()}>
          {syncing ? t('queue.syncing') : `⬆️ ${t('queue.sync_now')}`}
        </button>
      )}
      {checks.length === 0 && <p className="card text-center text-gray-600">{t('queue.empty')}</p>}
      <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {checks.map((c) => (
          <li key={c.client_id}>
            <Link to={`/result/${c.client_id}`} className="card flex items-center gap-3">
              <Thumb blob={c.blob} className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{headline(c, t)}</p>
                <p className="text-sm text-gray-600">{new Date(c.captured_at).toLocaleString()}</p>
              </div>
              <span className={`chip shrink-0 ${STATUS_TONE[c.status]}`}>{t(`queue.status.${c.status}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
