# KrushiCare ML Evaluation Report — v1

**Model:** MobileNetV3-Large (timm `mobilenetv3_large_100`)  
**Version:** v1 (calibrated)  
**Date:** 2026-10-30  
**Author:** Krisha (ML lead)

---

## 1. Datasets

### 1.1 PlantVillage (controlled, lab-quality images)

| Split | Purpose | Samples |
|---|---|---|
| Train | Fine-tuning | — |
| Validation | Calibration (temperature scaling) | 2 608 |
| Held-out test (v0) | Early accuracy checkpoint | — |

PlantVillage images are photographed under controlled lighting against plain backgrounds. They are **not** representative of farm-field or web-crawled images.

### 1.2 PlantDoc (field / web images)

PlantDoc is a publicly available benchmark of real-world plant disease images collected from the web. It is substantially harder than PlantVillage due to cluttered backgrounds, variable lighting, and mixed image quality.

| Split | Purpose | Samples |
|---|---|---|
| Development validation | Threshold selection | 165 |
| **Official final test** | **Held-out evaluation** | **85** |

> **Critical limitation:** The PlantDoc final test contains only **10 of the 13 model classes**. The three absent classes are `tomato__spider_mites`, `tomato__target_spot`, and `potato__healthy`. Results for these classes cannot be evaluated from this benchmark.

---

## 2. Model Architecture and Training

- **Backbone:** MobileNetV3-Large (`mobilenetv3_large_100`, timm)
- **Input:** RGB 224×224, ImageNet mean/std normalisation
- **Output:** 13-class softmax (10 tomato + 3 potato disease/healthy)
- **ONNX export:** opset 17, input name `input`, output name `probs`
- **Calibration:** Temperature scaling applied post-training (see §4)

---

## 3. Accuracy Results

### 3.1 Controlled images (PlantVillage-style)

| Model | Dataset | Split | Accuracy |
|---|---|---|---|
| v0 | PlantVillage-style | Controlled test | **99.46%** |
| v1 | PlantVillage | Validation | **98.93%** |

These high figures reflect the controlled nature of PlantVillage images, not expected field performance.

### 3.2 Field images (PlantDoc)

| Dataset | Split | Samples | Accuracy | Macro-F1 |
|---|---|---|---|---|
| PlantDoc | Dev-validation | 165 | **45.45%** | — |
| PlantDoc | **Final test** | **85** | **43.53%** | **0.420** |

> ⚠ **The model performs much better on controlled images than on real field images.** A drop from ~99% (PlantVillage) to ~44% (PlantDoc) is a known and expected consequence of the domain gap. This does not mean the model is broken; it reflects the difficulty of generalising from curated lab datasets to diverse web/field images.

### 3.3 Per-class results (PlantDoc final test)

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| tomato__bacterial_spot | 0.429 | 0.333 | 0.375 | 9 |
| tomato__early_blight | 0.625 | 0.556 | 0.588 | 9 |
| tomato__late_blight | 0.333 | 0.400 | 0.364 | 10 |
| tomato__leaf_mold | 0.250 | 0.167 | 0.200 | 6 |
| tomato__septoria_leaf_spot | 0.500 | 0.636 | 0.560 | 11 |
| tomato__yellow_leaf_curl_virus | 0.625 | 0.833 | 0.714 | 6 |
| tomato__mosaic_virus | 0.667 | 0.200 | 0.308 | 10 |
| tomato__healthy | 0.556 | 0.625 | 0.588 | 8 |
| potato__early_blight | 0.286 | 0.500 | 0.364 | 8 |
| potato__late_blight | 0.167 | 0.125 | 0.143 | 8 |
| **Macro avg** | **0.444** | **0.438** | **0.420** | **85** |
| **Weighted avg** | **0.451** | **0.435** | **0.421** | **85** |

Source: `ml/evaluation/final_plantdoc_test_per_class.csv`

See chart: `ml/evaluation/per_class_metrics.png`

---

## 4. Calibration (Temperature Scaling)

Temperature scaling was applied after training using the PlantVillage **validation** split (2 608 samples). It rescales logits by `T` before softmax to produce better-calibrated probabilities.

| Metric | Before calibration | After calibration |
|---|---|---|
| Negative log-likelihood (NLL) | 0.1137 | **0.0367** |
| Temperature `T` | 1.0 (identity) | **0.4026** |
| Dataset | PlantVillage val | PlantVillage val |

> **Important caveats:**
> - Calibration was measured on **PlantVillage validation** images only.
> - `field_calibration_verified = false` — calibration quality on PlantDoc or real farm images has **not** been measured.
> - A reliability (calibration) diagram is **not included** because per-image predicted probabilities and true labels for the test set are not stored in this repository. Fabricating ECE bins from summary statistics alone would misrepresent performance.
> - The NLL improvement is genuine but applies only to the distribution the model was calibrated on.

---

## 5. Threshold Behaviour

Thresholds are defined in `ml/models/thresholds.json`:

| Threshold | Value | Meaning |
|---|---|---|
| `unknown_photo` | 0.45 | Below this → `unsupported` verdict |
| `likely_high` | 1.0 | (effectively disabled) |
| `likely_high_margin` | 1.0 | (effectively disabled) |
| `likely_medium` | 0.9999 | Above this → `likely` verdict |

The `likely_medium` threshold of 0.9999 was selected on the PlantDoc **development validation** set (165 samples) to achieve ≥ 80% precision on accepted predictions.

### 5.1 Threshold behaviour on PlantDoc final test (85 samples)

| Verdict | Count | Coverage | Precision | Note |
|---|---|---|---|---|
| `likely` (prob ≥ 0.9999) | 6 | 7.1% | **5/6 = 83.3%** | Only verdict with measured precision |
| `uncertain` (0.45 ≤ p < 0.9999) | 70 | 82.4% | — | App shows top-3 + KCC helpline |
| `unsupported` (prob < 0.45) | 9 | 10.6% | not evaluated | Non-leaf rejection not validated |

> ⚠ **Confidence thresholds do not guarantee correctness.** The `likely` verdict had 1 error in 6 accepted predictions on this test. Coverage is very low (7.1%) because the threshold is deliberately conservative.

> ⚠ **Unsupported decisions have not been validated as non-leaf rejection.** The 9 `unsupported` predictions may include genuine disease images that the model is simply uncertain about, not necessarily non-leaf inputs.

### 5.2 Threshold selection methodology

Threshold selection used the PlantDoc **development validation** set, which is a different split from the final test set. Results on the dev-val:

| Threshold selected | Accepted | Coverage | Accepted precision |
|---|---|---|---|
| 0.9999 | 11 / 165 | 6.7% | 1.0 (11/11) |

Source: `ml/evaluation/threshold_validation_report.json`

> ⚠ This is exploratory validation-set selection, **not** independent performance verification. The 100% dev-val precision did not fully transfer to the final test (83.3%).

See chart: `ml/evaluation/confidence_bucket_table.png`

---

## 6. Charts

| File | Description |
|---|---|
| `confusion_matrix.png` | Diagonal TPs per class on PlantDoc test. Off-diagonal counts are not available from summary statistics and are shown as blank — not fabricated. |
| `per_class_metrics.png` | Precision / Recall / F1 bar chart for all 10 present classes. |
| `model_comparison.png` | Side-by-side accuracy: v0 controlled, v1 PlantVillage val, v1 PlantDoc dev-val, v1 PlantDoc final test. |
| `confidence_bucket_table.png` | Verdict distribution and precision on the 85-sample final test. |

A **reliability / calibration plot** was not generated because per-image softmax probabilities paired with true labels are not stored in this repository. Any ECE or calibration curve computed from only aggregate statistics would be fabricated.

---

## 7. Limitations

1. **Domain gap.** PlantVillage is a controlled benchmark; real field accuracy is 43.53%. Do not cite the 99% PlantVillage number as deployment accuracy.

2. **Small PlantDoc test set.** 85 samples across 10 classes means per-class support is 6–11 samples. Confidence intervals on per-class metrics are wide.

3. **Three absent classes.** `tomato__spider_mites`, `tomato__target_spot`, and `potato__healthy` have zero test support in PlantDoc. Their real-world performance is unknown from this benchmark.

4. **Non-leaf rejection not evaluated.** The `unsupported` threshold (0.45) was not tested against images that are not plant leaves. It may fail to reject animal photos, blank images, etc.

5. **Calibration not verified on field data.** Temperature scaling was tuned on PlantVillage validation. Calibration quality on field or web images is unknown.

6. **Quality gate not evaluated.** The blur/brightness/leaf-ratio quality check (`ml/preprocessing/quality.py`) was not run on the PlantDoc benchmark, so combined pipeline performance is not measured here.

7. **Do not tune thresholds on the final test.** The final PlantDoc test set must remain held-out. Any further threshold changes must use the dev-val split only.

---

## 8. Conclusion

KrushiCare's MobileNetV3-Large v1 model achieves near-perfect accuracy on controlled PlantVillage-style images (~99%) but **43.53% accuracy on the PlantDoc real-field benchmark**. This gap is expected and common for models trained on clean datasets. The calibrated probability output (T=0.4026) improves NLL significantly on PlantVillage data. The conservative threshold (likely_medium=0.9999) limits automatic diagnosis coverage to ~7% of inputs but maintains 83% precision on that subset in the held-out test. The system is designed to escalate uncertain and unsupported cases to the KCC helpline, so low coverage is an acceptable safety trade-off for a first deployment.

---

*Generated from real evaluation artifacts only. No metrics were fabricated or estimated.*
