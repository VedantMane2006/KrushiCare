// Same rules as backend/app/verdict.py, used for the on-phone "offline check" (stretch).
// Keep the two in sync; shared/contracts.md is the source of truth.
import type { Classifier, Crop, Quality, Verdict } from './types';
import thresholdsJson from '../generated/thresholds.json';

export interface Thresholds {
  unknown_photo: number;
  likely_high: number;
  likely_high_margin: number;
  likely_medium: number;
}

export const THRESHOLDS: Thresholds = thresholdsJson as Thresholds;
const EPS = 1e-9;

export const cropOf = (label: string) => label.split('__', 1)[0];

export function decide(classifier: Classifier | null, quality: Pick<Quality, 'ok'> | null, crop: Crop, t: Thresholds = THRESHOLDS): Verdict {
  if (quality && !quality.ok) return { status: 'retake', label: null, confidence: null };
  if (!classifier || classifier.top3.length === 0) return { status: 'retake', label: null, confidence: null };
  const { label, prob } = classifier.top3[0];
  const margin = classifier.margin;
  if (prob < t.unknown_photo - EPS) return { status: 'unsupported', label: null, confidence: null };
  if (cropOf(label) !== crop) return { status: 'uncertain', label, confidence: 'low' };
  if (prob >= t.likely_high - EPS && margin >= t.likely_high_margin - EPS) return { status: 'likely', label, confidence: 'high' };
  if (prob >= t.likely_medium - EPS) return { status: 'likely', label, confidence: 'medium' };
  return { status: 'uncertain', label, confidence: 'low' };
}
