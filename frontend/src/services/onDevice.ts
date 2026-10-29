// "Offline check": when the server can't be reached, run the model on the phone,
// apply the same verdict rules, and show the result tagged as an offline check.
// The server result replaces it on sync (the phone's result is sent as device_result).
import { predict } from '../../../ml/inference/predict';
import { decide } from './verdict';
import { KCC_DISPLAY } from './kcc';
import type { Advice, Check, DiagnosisResult, Lang } from './types';

const PACK_KEY = (lang: Lang) => `agrisense.advice.${lang}`;

/** Keep the advice pack for this language on the phone (the service worker caches it too). */
export function storeAdvicePack(lang: Lang, pack: Record<string, Advice>): void {
  try {
    localStorage.setItem(PACK_KEY(lang), JSON.stringify(pack));
  } catch {
    /* storage full or blocked: advice will be empty offline */
  }
}

function advicePack(lang: Lang): Record<string, Advice> {
  for (const l of [lang, 'en'] as Lang[]) {
    try {
      const raw = localStorage.getItem(PACK_KEY(l));
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return {};
}

/** Returns null when there is no on-phone model (the stub throws) or it fails. */
export async function offlineCheck(check: Check): Promise<DiagnosisResult | null> {
  let classifier;
  try {
    classifier = await predict(check.blob);
  } catch {
    return null;
  }
  const verdict = decide(classifier, null, check.crop);
  const pack = advicePack(check.lang);
  const key = verdict.status === 'likely' ? verdict.label! : verdict.status === 'unsupported' ? 'unsupported' : 'uncertain';
  return {
    contract_version: 1,
    client_id: check.client_id,
    crop: check.crop,
    lang: check.lang,
    source: 'device',
    captured_at: check.captured_at,
    quality: null,
    classifier,
    verdict,
    weather_risk: { level: 'not_assessed', rule: null, days: [], source: null, fetched_at: null },
    soil: { moisture: null, temperature_c: null, irrigation_key: 'unknown', card_values: null, flags: [] },
    advice: pack[key] ?? { summary: '', steps: [], citations: [] },
    escalation: { kcc_phone: KCC_DISPLAY },
  };
}
