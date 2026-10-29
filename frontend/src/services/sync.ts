// Offline queue: every photo is saved to Dexie first, then sent. Pending items are sent in
// batches of 5 via /api/diagnose/batch with per-item exponential backoff (2, 4, 8, 16 s);
// after 5 failed tries an item is marked failed. Server idempotency on client_id makes
// every retry safe.
import { ApiError, diagnose, diagnoseBatch, NetworkError } from './api';
import { offlineCheck } from './onDevice';
import { db } from './db';
import { loadSettings } from './settings';
import type { Check, Crop, Lang } from './types';

export const BATCH_SIZE = 5;
export const MAX_TRIES = 5;
export const backoffMs = (tries: number) => 2 ** tries * 1000; // tries=1 -> 2 s ... tries=4 -> 16 s

export async function createCheck(input: { blob: Blob; crop: Crop; lang: Lang; lat: number | null; lon: number | null }): Promise<Check> {
  const check: Check = {
    client_id: crypto.randomUUID(),
    ...input,
    captured_at: new Date().toISOString(),
    status: 'pending',
    result: null,
    error: null,
    tries: 0,
    next_try_at: 0,
  };
  await db.checks.put(check);
  return check;
}

/** Try one check right away (the capture flow). Never throws: the outcome is in Dexie. */
export async function sendNow(check: Check, onSlow?: () => void): Promise<Check> {
  try {
    const result = await diagnose(check, loadSettings().soilCard, onSlow);
    await db.checks.update(check.client_id, { status: 'synced', result, error: null });
  } catch (e) {
    if (e instanceof ApiError) {
      await db.checks.update(check.client_id, { status: 'failed', error: e.message });
    } else {
      await markRetry(check, e instanceof Error ? e.message : 'network error');
      await tryOffline(check);
    }
  }
  return (await db.checks.get(check.client_id))!;
}

/** No server: show the on-phone result now (still pending, so the server re-checks it on sync). */
export async function tryOffline(check: Check): Promise<void> {
  const result = await offlineCheck(check);
  if (result) await db.checks.update(check.client_id, { result });
}

async function markRetry(check: Check, error: string) {
  const tries = check.tries + 1;
  await db.checks.update(check.client_id, {
    tries,
    error,
    status: tries >= MAX_TRIES ? 'failed' : 'pending',
    next_try_at: Date.now() + backoffMs(tries),
  });
}

let running: Promise<SyncSummary> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export interface SyncSummary { sent: number; synced: number; failed: number; remaining: number }

/** Send every due pending item. `force` ignores the backoff gate (the "Send now" button). */
export function syncPending(force = false): Promise<SyncSummary> {
  if (!running) running = doSync(force).finally(() => (running = null));
  return running;
}

async function doSync(force: boolean): Promise<SyncSummary> {
  const summary: SyncSummary = { sent: 0, synced: 0, failed: 0, remaining: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    summary.remaining = await db.checks.where('status').equals('pending').count();
    return summary;
  }
  const soilCard = loadSettings().soilCard;
  for (;;) {
    const now = Date.now();
    const due = (await db.checks.where('status').equals('pending').toArray())
      .filter((c) => force || c.next_try_at <= now)
      .sort((a, b) => a.captured_at.localeCompare(b.captured_at))
      .slice(0, BATCH_SIZE);
    if (due.length === 0) break;
    summary.sent += due.length;
    try {
      const results = await diagnoseBatch(due, soilCard);
      const byId = new Map(results.map((r) => [r.client_id, r]));
      for (const c of due) {
        const r = byId.get(c.client_id);
        if (r && !('error' in r)) {
          await db.checks.update(c.client_id, { status: 'synced', result: r, error: null });
          summary.synced++;
        } else if (r && 'error' in r) {
          // The server looked at it and said no (bad image, bad field): retrying won't help.
          await db.checks.update(c.client_id, { status: 'failed', error: r.error });
          summary.failed++;
        } else {
          await markRetry(c, 'missing from batch response');
        }
      }
    } catch (e) {
      const permanent = e instanceof ApiError;
      for (const c of due) {
        if (permanent) await db.checks.update(c.client_id, { status: 'failed', error: (e as ApiError).message });
        else await markRetry(c, e instanceof NetworkError ? e.message : String(e));
      }
      if (!permanent) break; // network is down: stop and let the backoff timer try again
    }
    force = false; // only the first round ignores backoff; avoids a tight loop on repeated failures
  }
  summary.remaining = await db.checks.where('status').equals('pending').count();
  scheduleNext();
  return summary;
}

async function scheduleNext() {
  clearTimeout(timer);
  const pending = await db.checks.where('status').equals('pending').toArray();
  if (pending.length === 0) return;
  const wait = Math.max(1000, Math.min(...pending.map((c) => c.next_try_at)) - Date.now());
  timer = setTimeout(() => void syncPending(), wait);
}

/** Wire up automatic sync: on app open and whenever the phone comes back online. */
export function startAutoSync(): () => void {
  const onOnline = () => void syncPending(true);
  window.addEventListener('online', onOnline);
  void syncPending();
  return () => {
    window.removeEventListener('online', onOnline);
    clearTimeout(timer);
  };
}

export async function retryCheck(client_id: string) {
  await db.checks.update(client_id, { status: 'pending', tries: 0, next_try_at: 0, error: null });
  return syncPending(true);
}
