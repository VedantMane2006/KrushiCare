import type { Advice, BatchItemResult, Check, Climate, DiagnosisResult, Lang, Scheme, SoilCard } from './types';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

/** Offline, timed out, or the server is down: keep the item pending and retry later. */
export class NetworkError extends Error {}
/** The server rejected the request (4xx): retrying will not help. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Free-tier hosts sleep; the first request can take 30-60 s.
const DIAGNOSE_TIMEOUT_MS = 75_000;
const SLOW_AFTER_MS = 5_000;

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000, onSlow?: () => void): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const slow = onSlow ? setTimeout(onSlow, SLOW_AFTER_MS) : undefined;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : 'network error');
  } finally {
    clearTimeout(timer);
    clearTimeout(slow);
  }
  if (res.status >= 500 || res.status === 408 || res.status === 429) throw new NetworkError(`server ${res.status}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function appendItem(form: FormData, check: Check, soilCard: SoilCard | null, suffix = '') {
  form.append(`image${suffix}`, check.blob, `${check.client_id}.jpg`);
  form.append(`client_id${suffix}`, check.client_id);
  form.append(`crop${suffix}`, check.crop);
  form.append(`lang${suffix}`, check.lang);
  form.append(`captured_at${suffix}`, check.captured_at);
  if (check.lat != null && check.lon != null) {
    form.append(`lat${suffix}`, String(check.lat));
    form.append(`lon${suffix}`, String(check.lon));
  }
  if (soilCard) form.append(`soil_card${suffix}`, JSON.stringify(soilCard));
  // The phone's own result, if it made one offline; the server's result replaces it.
  if (check.result?.source === 'device') form.append(`device_result${suffix}`, JSON.stringify(check.result));
}

export async function diagnose(check: Check, soilCard: SoilCard | null, onSlow?: () => void): Promise<DiagnosisResult> {
  if (USE_FIXTURES) return fixtureFor(check);
  const form = new FormData();
  appendItem(form, check, soilCard);
  return request<DiagnosisResult>('/api/diagnose', { method: 'POST', body: form }, DIAGNOSE_TIMEOUT_MS, onSlow);
}

export async function diagnoseBatch(checks: Check[], soilCard: SoilCard | null): Promise<BatchItemResult[]> {
  if (USE_FIXTURES) return Promise.all(checks.map(fixtureFor));
  const form = new FormData();
  checks.forEach((c, i) => appendItem(form, c, soilCard, `_${i}`));
  const body = await request<{ results: BatchItemResult[] }>('/api/diagnose/batch', { method: 'POST', body: form }, DIAGNOSE_TIMEOUT_MS * 2);
  return body.results;
}

export async function getSchemes(lang: Lang): Promise<Scheme[]> {
  if (USE_FIXTURES) {
    const all = (await import('./generated/schemes.json')).default as Record<string, Scheme[]>;
    return all[lang] ?? all.en;
  }
  return request<Scheme[]>(`/api/schemes?lang=${lang}`);
}

export async function getClimate(lat: number, lon: number): Promise<Climate> {
  if (USE_FIXTURES) {
    return { season: 'rabi', period: { start: '2026-10-01', end: '2026-10-23' }, rain_mm: 42, normal_rain_mm: 61.5,
      rain_pct_of_normal: 68, temp_c: 25.9, normal_temp_c: 25.1, temp_anomaly_c: 0.8, baseline: '1991-2020', source: 'fixture' };
  }
  // Two archive lookups on a cold server; the backend caches per place for a day.
  return request<Climate>(`/api/climate?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, {}, 30_000);
}

/** Weather risk and soil for a place, for a check that was made without a location. */
export async function getContext(lat: number, lon: number, crop: Check['crop']): Promise<Pick<DiagnosisResult, 'weather_risk' | 'soil'>> {
  if (USE_FIXTURES) {
    const today = new Date();
    const days = [0, 1, 2].map((i) => ({ date: new Date(today.getTime() + i * 864e5).toISOString().slice(0, 10), favourable: i === 1 }));
    return { weather_risk: { level: 'medium', rule: 'hutton', days, source: 'fixture', fetched_at: null },
      soil: { moisture: 0.21, temperature_c: 24.5, irrigation_key: 'no_action', card_values: null, flags: [] } };
  }
  return request(`/api/context?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}&crop=${crop}`, {}, 15_000);
}

/** Warm the service-worker cache so advice works offline later. */
export function prefetchAdvicePack(lang: Lang, onPack?: (pack: Record<string, Advice>) => void): void {
  if (USE_FIXTURES) return;
  request<Record<string, Advice>>(`/api/advice-pack?lang=${lang}`).then(onPack, () => undefined);
}

/** Wake a sleeping free-tier backend as soon as the app opens. */
export function warmUp(): void {
  if (USE_FIXTURES) return;
  request('/api/health', {}, 60_000).catch(() => undefined);
}

// ---------- fixtures mode ----------

const fixtures = import.meta.glob<DiagnosisResult>('./generated/fixtures/*.json', { eager: true, import: 'default' });
let fixtureIndex = 0;

/** Round-robins through backend/tests/fixtures, or uses ?fixture=<name> from the page URL. */
export async function fixtureFor(check: Check): Promise<DiagnosisResult> {
  const names = Object.keys(fixtures).sort();
  const wanted = new URLSearchParams(location.search).get('fixture');
  const key = names.find((n) => wanted && n.endsWith(`/${wanted}.json`)) ?? names[fixtureIndex++ % names.length];
  await new Promise((r) => setTimeout(r, 600));
  return { ...structuredClone(fixtures[key]), client_id: check.client_id, crop: check.crop, lang: check.lang, captured_at: check.captured_at };
}
