// Mirrors backend/knowledge_base/schemas/diagnosis_result.schema.json (contract v1).
export type Crop = 'tomato' | 'potato';
export type Lang = 'en' | 'hi' | 'mr';
export type VerdictStatus = 'likely' | 'uncertain' | 'retake' | 'unsupported';
export type Confidence = 'high' | 'medium' | 'low' | null;

export interface Quality {
  ok: boolean;
  blur: number;
  brightness: number;
  leaf_ratio: number;
  reason_key: string | null;
}

export interface Classifier {
  model_version: string;
  top3: { label: string; prob: number }[];
  margin: number;
}

export interface Verdict {
  status: VerdictStatus;
  label: string | null;
  confidence: Confidence;
}

export interface SoilCard {
  ph?: number | null;
  n?: number | null;
  p?: number | null;
  k?: number | null;
  oc?: number | null;
}

export interface Advice {
  summary: string;
  steps: { text: string; citation_id: string | null }[];
  citations: { id: string; title: string; url: string }[];
}

export interface DiagnosisResult {
  contract_version: 1;
  client_id: string;
  crop: Crop;
  lang: Lang;
  source?: 'server' | 'device';
  captured_at?: string | null;
  quality: Quality | null;
  classifier: Classifier | null;
  verdict: Verdict;
  weather_risk: {
    level: 'high' | 'medium' | 'low' | 'not_assessed';
    rule: string | null;
    days: { date: string; favourable: boolean }[];
    source: string | null;
    fetched_at: string | null;
  };
  soil: {
    moisture: number | null;
    temperature_c: number | null;
    irrigation_key: 'wait_for_rain' | 'consider_irrigating' | 'no_action' | 'unknown';
    card_values: SoilCard | null;
    flags: string[];
  };
  advice: Advice;
  escalation: { kcc_phone: string };
  /** Where the disease shows on the photo (likely verdicts). method 'demo' until the model's Grad-CAM is wired. */
  gradcam?: { method: 'gradcam' | 'demo'; label: string; image: string } | null;
}

export type BatchItemResult = DiagnosisResult | { client_id: string; error: string };

/** GET /api/climate: this season so far vs the 1991-2020 normal for the same dates. */
export interface Climate {
  season: 'kharif' | 'rabi' | 'zaid';
  period: { start: string; end: string };
  rain_mm: number;
  normal_rain_mm: number;
  rain_pct_of_normal: number | null;
  temp_c: number;
  normal_temp_c: number;
  temp_anomaly_c: number;
  baseline: string;
  source: string;
}

export interface Scheme {
  id: string;
  name: string;
  benefit: string;
  eligibility: string[];
  documents: string[];
  official_url: string;
  last_checked: string;
}

export type CheckStatus = 'pending' | 'synced' | 'failed';

/** One row of the Dexie `checks` table. */
export interface Check {
  client_id: string;
  crop: Crop;
  lang: Lang;
  lat: number | null;
  lon: number | null;
  captured_at: string;
  blob: Blob;
  status: CheckStatus;
  result: DiagnosisResult | null;
  error: string | null;
  tries: number;
  next_try_at: number; // epoch ms; backoff gate for sync
}
