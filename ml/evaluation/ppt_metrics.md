# KrushiCare — ML Results for Hackathon PPT

*Concise, accurate numbers ready for slide copy-paste. All figures sourced from
`ml/evaluation/` — no estimates.*

---

## Slide: Model Overview

| Item | Value |
|---|---|
| Architecture | MobileNetV3-Large (timm) |
| Classes | 13 (10 tomato + 3 potato) |
| Input | 224 × 224 RGB |
| Model version | v1 (calibrated) |
| ONNX opset | 17 |
| Calibration method | Temperature scaling (T = 0.403) |

---

## Slide: Accuracy at a Glance

| Dataset | Images | Accuracy |
|---|---|---|
| PlantVillage (lab / controlled) | — | **98.93%** |
| PlantDoc field test *(held-out)* | 85 | **43.53%** |

> **Key message:** Near-perfect on clean images; 43.53% on real field photos — a known, expected domain gap.

---

## Slide: Why the Gap?

- PlantVillage = plain background, controlled lighting, cropped leaf
- PlantDoc = web images: cluttered, dark, blurry, mixed angles
- Gap is **normal and expected** — same pattern seen in published research
- System compensates with conservative thresholds + KCC helpline escalation

---

## Slide: What the Model Actually Does in the Field

| Verdict | Count (n = 85) | Coverage | Precision |
|---|---|---|---|
| Auto-diagnose (`likely`) | 6 | 7.1% | **83.3% (5/6 correct)** |
| Show top-3, call KCC (`uncertain`) | 70 | 82.4% | — |
| Not a plant disease image (`unsupported`) | 9 | 10.6% | not evaluated |

> **Key message:** The model deliberately accepts very few cases automatically (7%). When it does, 5 out of 6 are correct. All other cases route to the farmer helpline.

---

## Slide: Per-Class Highlights (PlantDoc Final Test)

**Best performing:**
- `tomato__yellow_leaf_curl_virus` — F1 **0.714**, recall 83%
- `tomato__early_blight` — F1 **0.588**
- `tomato__healthy` — F1 **0.588**

**Most challenging:**
- `potato__late_blight` — F1 **0.143**, recall 13%
- `tomato__leaf_mold` — F1 **0.200**
- `tomato__mosaic_virus` — F1 **0.308**, precision 67% but recall only 20%

**Macro-F1 (10 classes): 0.420**

> Note: 3 model classes (`tomato__spider_mites`, `tomato__target_spot`, `potato__healthy`) have zero samples in the PlantDoc test set and are not evaluated here.

---

## Slide: Calibration

| | NLL |
|---|---|
| Before temperature scaling | 0.1137 |
| After temperature scaling (T = 0.403) | **0.0367** |
| Improvement | **68% reduction in NLL** |

*Calibration measured on PlantVillage validation (2 608 samples). Field calibration not yet verified.*

---

## Slide: Confidence Threshold Design

- Threshold `likely_medium = 0.9999` — selected on PlantDoc dev-val (165 images)
- At this threshold: 11/165 accepted, all correct (100% dev-val precision)
- Final test result: 6/85 accepted, 5/6 correct (**83.3%**)
- Deliberately conservative: farmer helpline always available as backup

> ⚠ High thresholds do **not** guarantee correctness — they reduce coverage to increase reliability.

---

## Slide: Honest Limitations (required for academic integrity)

1. **Field accuracy is 43.53%** — not the 99% PlantVillage number
2. **Small test set** — 85 images, 6–11 per class; wide confidence intervals
3. **3 classes not in test set** — spider mites, target spot, potato healthy
4. **Non-leaf rejection unverified** — unsupported verdict not tested on non-leaf images
5. **Quality gate not benchmarked** — blur/brightness filter not run on PlantDoc
6. **Calibration not verified on field data** — NLL improvement measured on PlantVillage only

---

## Charts to Include in PPT

| Chart file | Recommended slide |
|---|---|
| `ml/evaluation/model_comparison.png` | "Why the gap?" slide |
| `ml/evaluation/per_class_metrics.png` | Per-class highlights slide |
| `ml/evaluation/confidence_bucket_table.png` | "What the model does in the field" slide |
| `ml/evaluation/confusion_matrix.png` | Technical appendix / backup slide |

---

*All numbers from `ml/evaluation/final_plantdoc_test_metrics.json`,
`ml/evaluation/final_plantdoc_test_per_class.csv`,
`ml/evaluation/threshold_validation_report.json`,
`ml/models/calibration_report.json`.*
