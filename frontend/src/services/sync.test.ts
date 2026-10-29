import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ diagnose: vi.fn(), diagnoseBatch: vi.fn() }));
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), ...api }));

import { ApiError, NetworkError } from './api';
import { db } from './db';
import { createCheck, MAX_TRIES, sendNow, syncPending } from './sync';

const blob = new Blob(['x'], { type: 'image/jpeg' });
const newCheck = () => createCheck({ blob, crop: 'tomato', lang: 'en', lat: null, lon: null });
const ok = (client_id: string) => ({ client_id, verdict: { status: 'likely' } });

beforeEach(async () => {
  await db.checks.clear();
  vi.resetAllMocks();
});

describe('offline queue', () => {
  it('saves first, then marks synced on success', async () => {
    api.diagnose.mockImplementation(async (c) => ok(c.client_id));
    const c = await newCheck();
    expect((await db.checks.get(c.client_id))?.status).toBe('pending');
    const after = await sendNow(c);
    expect(after.status).toBe('synced');
    expect(after.result?.client_id).toBe(c.client_id);
  });

  it('keeps the item pending with backoff on a network failure', async () => {
    api.diagnose.mockRejectedValue(new NetworkError('offline'));
    const c = await newCheck();
    const after = await sendNow(c);
    expect(after.status).toBe('pending');
    expect(after.tries).toBe(1);
    expect(after.next_try_at).toBeGreaterThan(Date.now() + 1000);
  });

  it('marks failed straight away on a 4xx', async () => {
    api.diagnose.mockRejectedValue(new ApiError(400, 'file is not a valid image'));
    expect((await sendNow(await newCheck())).status).toBe('failed');
  });

  it('syncs pending items in batches of 5 and records per-item errors', async () => {
    const checks: Awaited<ReturnType<typeof newCheck>>[] = [];
    for (let i = 0; i < 7; i++) checks.push(await newCheck());
    api.diagnoseBatch.mockImplementation(async (items: { client_id: string }[]) =>
      items.map((c) => (c.client_id === checks[2].client_id ? { client_id: c.client_id, error: 'bad' } : ok(c.client_id))),
    );
    const s = await syncPending();
    expect(api.diagnoseBatch).toHaveBeenCalledTimes(2);
    expect(api.diagnoseBatch.mock.calls[0][0]).toHaveLength(5);
    expect(s).toMatchObject({ sent: 7, synced: 6, failed: 1, remaining: 0 });
    expect((await db.checks.get(checks[2].client_id))?.status).toBe('failed');
  });

  it('gives up after MAX_TRIES network failures', async () => {
    api.diagnoseBatch.mockRejectedValue(new NetworkError('offline'));
    const c = await newCheck();
    for (let i = 0; i < MAX_TRIES; i++) await syncPending(true);
    const after = await db.checks.get(c.client_id);
    expect(after?.tries).toBe(MAX_TRIES);
    expect(after?.status).toBe('failed');
  });

  it('respects backoff unless forced', async () => {
    api.diagnoseBatch.mockRejectedValue(new NetworkError('offline'));
    await newCheck();
    await syncPending();
    await syncPending();
    expect(api.diagnoseBatch).toHaveBeenCalledTimes(1);
  });
});
