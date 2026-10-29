import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const model = vi.hoisted(() => ({ predict: vi.fn() }));
vi.mock('../../../ml/inference/predict', () => model);
const api = vi.hoisted(() => ({ diagnose: vi.fn(), diagnoseBatch: vi.fn() }));
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), ...api }));

import { NetworkError } from './api';
import { db } from './db';
import { offlineCheck } from './onDevice';
import { createCheck, sendNow, syncPending } from './sync';

const blob = new Blob(['x'], { type: 'image/jpeg' });

beforeEach(async () => {
  await db.checks.clear();
  vi.resetAllMocks();
});

describe('offline check on the phone', () => {
  it('returns null while there is no model (stub throws)', async () => {
    model.predict.mockRejectedValue(new Error('on-device model not added yet'));
    const c = await createCheck({ blob, crop: 'tomato', lang: 'en', lat: null, lon: null });
    expect(await offlineCheck(c)).toBeNull();
  });

  it('applies the verdict rules and tags the result as a device result', async () => {
    model.predict.mockResolvedValue({ model_version: 'v1-int8', top3: [{ label: 'tomato__late_blight', prob: 0.9 }, { label: 'tomato__early_blight', prob: 0.05 }], margin: 0.85 });
    const c = await createCheck({ blob, crop: 'tomato', lang: 'en', lat: null, lon: null });
    const r = await offlineCheck(c);
    expect(r?.source).toBe('device');
    expect(r?.verdict).toEqual({ status: 'uncertain', label: 'tomato__late_blight', confidence: 'low' });    
    expect(r?.weather_risk.level).toBe('not_assessed');
  });

  it('shows the device result while pending, then the server result replaces it', async () => {
    model.predict.mockResolvedValue({ model_version: 'v1-int8', top3: [{ label: 'tomato__leaf_mold', prob: 0.6 }, { label: 'tomato__healthy', prob: 0.3 }], margin: 0.3 });
    api.diagnose.mockRejectedValue(new NetworkError('offline'));
    const c = await createCheck({ blob, crop: 'tomato', lang: 'en', lat: null, lon: null });
    const after = await sendNow(c);
    expect(after.status).toBe('pending');
    expect(after.result?.source).toBe('device');

    api.diagnoseBatch.mockImplementation(async (items: { client_id: string; result: { source?: string } | null }[]) => {
      expect(items[0].result?.source).toBe('device'); // sent along as device_result
      return items.map((i) => ({ client_id: i.client_id, source: 'server', verdict: { status: 'likely' } }));
    });
    await syncPending(true);
    const done = await db.checks.get(c.client_id);
    expect(done?.status).toBe('synced');
    expect(done?.result?.source).toBe('server');
  });
});
