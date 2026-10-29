import { describe, expect, it } from 'vitest';
import { decide } from './verdict';
import type { Classifier, DiagnosisResult } from './types';

const T = { unknown_photo: 0.45, likely_high: 0.7, likely_high_margin: 0.3, likely_medium: 0.5 };
const c = (p1: number, p2: number, l1 = 'tomato__late_blight'): Classifier => ({
  model_version: 't',
  top3: [{ label: l1, prob: p1 }, { label: 'tomato__early_blight', prob: p2 }],
  margin: p1 - p2,
});
const OK = { ok: true };

// Same cases as backend/tests/test_api.py::test_verdict_branches and test_verdict.py.
describe('decide (mirror of backend/services/verdict.py)', () => {
  it.each([
    [0.85, 0.1, 'tomato__late_blight', 'likely', 'high'],
    [0.75, 0.5, 'tomato__late_blight', 'likely', 'medium'],
    [0.6, 0.3, 'tomato__late_blight', 'likely', 'medium'],
    [0.48, 0.4, 'tomato__late_blight', 'uncertain', 'low'],
    [0.9, 0.05, 'potato__late_blight', 'uncertain', 'low'],
    [0.3, 0.25, 'tomato__late_blight', 'unsupported', null],
    [0.7, 0.4, 'tomato__late_blight', 'likely', 'high'],
    [0.4499, 0.4, 'tomato__late_blight', 'unsupported', null],
  ] as const)('%s/%s %s -> %s %s', (p1, p2, l, status, conf) => {
    const v = decide(c(p1, p2, l), OK, 'tomato', T);
    expect([v.status, v.confidence]).toEqual([status, conf]);
  });

  it('retake when quality fails', () => {
    expect(decide(null, { ok: false }, 'tomato', T).status).toBe('retake');
  });

  it('agrees with every shared fixture', () => {
    const fixtures = import.meta.glob<DiagnosisResult>('./generated/fixtures/*.json', { eager: true, import: 'default' });
    for (const r of Object.values(fixtures)) {
      expect(decide(r.classifier, r.quality, r.crop, T)).toEqual(r.verdict);
    }
  });
});
