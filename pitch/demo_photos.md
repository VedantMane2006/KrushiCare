# AgriSense Demo Photo Manifest & Validation Catalogue

This document defines the official 10-photo demonstration dataset for **AgriSense / KrushiCare**, prepared by Vedant for Saad (app integration & testing) and Krisha (pitch & evaluation).

**Location of Photos:** `pitch/demo_photos/`  
**Evaluation Date:** 2026-10-30  
**Model Version:** `v1` (`ml/models/model.onnx`, MobileNetV3-Large, calibrated temperature $T = 0.4026$)  
**Active Thresholds:** `unknown_photo: 0.45`, `likely_medium: 0.9999`, `likely_high: 1.0`, `likely_high_margin: 1.0` (from `ml/models/thresholds.json`)  

---

## 1. Summary Matrix

| # | Filename | Crop | Ground-Truth Label | Quality Result | Model Top-1 Prediction (Prob) | Margin | Application Verdict | Demonstration Purpose |
|---|---|---|---|---|---|---|---|---|
| **01** | `demo_01_tomato_late_blight.png` | Tomato | `tomato__late_blight` | **OK** (`blur: 666.01`) | `tomato__late_blight` (`1.0000`) | `1.0000` | **`likely` (`high`)** | Clear late blight detection; demonstrates high-confidence diagnosis, weather risk, and cited disease treatment steps. |
| **02** | `demo_02_tomato_septoria.png` | Tomato | `tomato__septoria_leaf_spot` | **OK** (`blur: 1311.60`) | `tomato__septoria_leaf_spot` (`0.9998`) | `0.9997` | **`uncertain` (`low`)** | Demonstrates conservative thresholding: score is 0.9998 (just below 0.9999 threshold), showing honest confidence, top-3 closest matches, and Kisan Call Centre (KCC) button. |
| **03** | `demo_03_tomato_spider_mites.png` | Tomato | `tomato__spider_mites` | **OK** (`blur: 1957.09`) | `tomato__spider_mites` (`1.0000`) | `1.0000` | **`likely` (`high`)** | Pest infestation diagnosis showing distinct stippling/bronzing, cultural sanitation, and non-chemical pest management. |
| **04** | `demo_04_tomato_healthy.png` | Tomato | `tomato__healthy` | **OK** (`blur: 830.04`) | `tomato__healthy` (`1.0000`) | `1.0000` | **`likely` (`high`)** | Reassures the farmer that the crop is healthy; provides Good Agricultural Practices (GAP) and preventive tips. |
| **05** | `demo_05_tomato_target_spot.png` | Tomato | `tomato__target_spot` | **OK** (`blur: 1728.44`) | `tomato__target_spot` (`0.9994`) | `0.9988` | **`uncertain` (`low`)** | Concentric lesion pattern; triggers cautious uncertainty mode, demonstrating expert referral and secondary matches. |
| **06** | `demo_06_potato_early_blight.jpg` | Potato | `potato__early_blight` | **OK** (`blur: 6564.60`) | `potato__early_blight` (`1.0000`) | `1.0000` | **`likely` (`high`)** | Core potato disease diagnosis; exhibits concentric bull's-eye rings and triggers potato-specific crop advice and insurance links. |
| **07** | `demo_07_potato_late_blight.jpg` | Potato | `potato__late_blight` | **OK** (`blur: 1550.70`) | `potato__late_blight` (`1.0000`) | `1.0000` | **`likely` (`high`)** | Critical potato late blight infection; triggers high-priority fungicide timing, haulm-cutting guidance, and 3-day weather risk alert. |
| **08** | `demo_08_potato_healthy.jpg` | Potato | `potato__healthy` | **OK** (`blur: 8886.74`) | `potato__healthy` (`0.9996`) | `0.9993` | **`uncertain` (`low`)** | Realistic potato foliage; scores 0.9996, demonstrating safe referral and prevention tips without false certainty. |
| **09** | `demo_09_tomato_bacterial_spot.jpg` | Tomato | `tomato__bacterial_spot` | **OK** (`blur: 742.37`) | `tomato__spider_mites` (`0.7174`) | `0.4377` | **`uncertain` (`low`)** | Challenging field sample with dual visual symptoms (spotting + chlorosis); model honestly defers to low confidence and presents top-3 options. |
| **10** | `demo_10_poor_quality_blurry.png` | Tomato | `tomato__late_blight` | **FAILED** (`blur: 1.63 < 60`) | *Skipped by quality gate* | *N/A* | **`retake` (`None`)** | Quality gate rejection test: blur is below threshold (1.63 < 60.0), model execution is skipped, and user receives clear retake advice in chosen language (`quality.too_blurry`). |

---

## 2. Detailed Per-Photo Technical Specifications

### Photo 01: `demo_01_tomato_late_blight.png`
* **File Path:** `pitch/demo_photos/demo_01_tomato_late_blight.png`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__late_blight`
* **Source:** PlantDoc / PlantVillage (via `ml/parity/p1.png`)
* **License:** Creative Commons Attribution 4.0 International (CC BY 4.0)
* **Image Dimensions:** $224 \times 224\text{ px}$ (PNG, 82.1 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `666.011` ($\ge 60.0$)
  * `brightness`: `0.450` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.376` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `tomato__late_blight` (`prob: 1.0000`)
    2. `tomato__early_blight` (`prob: 0.0000`)
    3. `potato__late_blight` (`prob: 0.0000`)
  * `margin`: `1.0000`
  * `verdict`: `{"status": "likely", "label": "tomato__late_blight", "confidence": "high"}`

---

### Photo 02: `demo_02_tomato_septoria.png`
* **File Path:** `pitch/demo_photos/demo_02_tomato_septoria.png`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__septoria_leaf_spot`
* **Source:** PlantDoc / PlantVillage (via `ml/parity/p2.png`)
* **License:** CC BY 4.0
* **Image Dimensions:** $224 \times 224\text{ px}$ (PNG, 83.5 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `1311.597` ($\ge 60.0$)
  * `brightness`: `0.483` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.199` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `tomato__septoria_leaf_spot` (`prob: 0.9998`)
    2. `tomato__early_blight` (`prob: 0.0001`)
    3. `potato__early_blight` (`prob: 0.0000`)
  * `margin`: `0.9997`
  * `verdict`: `{"status": "uncertain", "label": "tomato__septoria_leaf_spot", "confidence": "low"}`

---

### Photo 03: `demo_03_tomato_spider_mites.png`
* **File Path:** `pitch/demo_photos/demo_03_tomato_spider_mites.png`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__spider_mites`
* **Source:** PlantDoc / PlantVillage (via `ml/parity/p3.png`)
* **License:** CC BY 4.0
* **Image Dimensions:** $224 \times 224\text{ px}$ (PNG, 93.5 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `1957.086` ($\ge 60.0$)
  * `brightness`: `0.438` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.283` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `tomato__spider_mites` (`prob: 1.0000`)
    2. `tomato__yellow_leaf_curl_virus` (`prob: 0.0000`)
    3. `potato__early_blight` (`prob: 0.0000`)
  * `margin`: `1.0000`
  * `verdict`: `{"status": "likely", "label": "tomato__spider_mites", "confidence": "high"}`

---

### Photo 04: `demo_04_tomato_healthy.png`
* **File Path:** `pitch/demo_photos/demo_04_tomato_healthy.png`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__healthy`
* **Source:** PlantDoc / PlantVillage (via `ml/parity/p4.png`)
* **License:** CC BY 4.0
* **Image Dimensions:** $224 \times 224\text{ px}$ (PNG, 69.8 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `830.041` ($\ge 60.0$)
  * `brightness`: `0.411` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.259` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `tomato__healthy` (`prob: 1.0000`)
    2. `potato__early_blight` (`prob: 0.0000`)
    3. `tomato__late_blight` (`prob: 0.0000`)
  * `margin`: `1.0000`
  * `verdict`: `{"status": "likely", "label": "tomato__healthy", "confidence": "high"}`

---

### Photo 05: `demo_05_tomato_target_spot.png`
* **File Path:** `pitch/demo_photos/demo_05_tomato_target_spot.png`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__target_spot`
* **Source:** PlantDoc / PlantVillage (via `ml/parity/p5.png`)
* **License:** CC BY 4.0
* **Image Dimensions:** $224 \times 224\text{ px}$ (PNG, 93.8 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `1728.444` ($\ge 60.0$)
  * `brightness`: `0.465` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.303` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `tomato__target_spot` (`prob: 0.9994`)
    2. `tomato__septoria_leaf_spot` (`prob: 0.0006`)
    3. `tomato__late_blight` (`prob: 0.0000`)
  * `margin`: `0.9988`
  * `verdict`: `{"status": "uncertain", "label": "tomato__target_spot", "confidence": "low"}`

---

### Photo 06: `demo_06_potato_early_blight.jpg`
* **File Path:** `pitch/demo_photos/demo_06_potato_early_blight.jpg`
* **Crop:** Potato (*Solanum tuberosum*)
* **Ground-Truth Label:** `potato__early_blight`
* **Source:** PlantVillage (`raw/color/Potato___Early_blight/001187a0-57ab-4329-baff-e7246a9edeb0___RS_Early.B 8178.JPG`)
* **License:** CC BY 4.0
* **Image Dimensions:** $256 \times 256\text{ px}$ (JPEG, 29.4 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `6564.601` ($\ge 60.0$)
  * `brightness`: `0.463` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.422` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `potato__early_blight` (`prob: 1.0000`)
    2. `potato__healthy` (`prob: 0.0000`)
    3. `tomato__spider_mites` (`prob: 0.0000`)
  * `margin`: `1.0000`
  * `verdict`: `{"status": "likely", "label": "potato__early_blight", "confidence": "high"}`

---

### Photo 07: `demo_07_potato_late_blight.jpg`
* **File Path:** `pitch/demo_photos/demo_07_potato_late_blight.jpg`
* **Crop:** Potato (*Solanum tuberosum*)
* **Ground-Truth Label:** `potato__late_blight`
* **Source:** PlantVillage (`raw/color/Potato___Late_blight/0051e5e8-d1c4-4a84-bf3a-a426cdad6285___RS_LB 4640.JPG`)
* **License:** CC BY 4.0
* **Image Dimensions:** $256 \times 256\text{ px}$ (JPEG, 18.4 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `1550.702` ($\ge 60.0$)
  * `brightness`: `0.445` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.211` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `potato__late_blight` (`prob: 1.0000`)
    2. `potato__healthy` (`prob: 0.0000`)
    3. `tomato__late_blight` (`prob: 0.0000`)
  * `margin`: `1.0000`
  * `verdict`: `{"status": "likely", "label": "potato__late_blight", "confidence": "high"}`

---

### Photo 08: `demo_08_potato_healthy.jpg`
* **File Path:** `pitch/demo_photos/demo_08_potato_healthy.jpg`
* **Crop:** Potato (*Solanum tuberosum*)
* **Ground-Truth Label:** `potato__healthy`
* **Source:** PlantVillage (`raw/color/Potato___healthy/00fc2ee5-729f-4757-8aeb-65c3355874f2___RS_HL 1864.JPG`)
* **License:** CC BY 4.0
* **Image Dimensions:** $256 \times 256\text{ px}$ (JPEG, 31.1 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `8886.740` ($\ge 60.0$)
  * `brightness`: `0.464` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.514` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `potato__healthy` (`prob: 0.9996`)
    2. `tomato__early_blight` (`prob: 0.0003`)
    3. `tomato__yellow_leaf_curl_virus` (`prob: 0.0000`)
  * `margin`: `0.9993`
  * `verdict`: `{"status": "uncertain", "label": "potato__healthy", "confidence": "low"}`

---

### Photo 09: `demo_09_tomato_bacterial_spot.jpg`
* **File Path:** `pitch/demo_photos/demo_09_tomato_bacterial_spot.jpg`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__bacterial_spot`
* **Source:** PlantVillage (`raw/color/Tomato___Bacterial_spot/00416648-be6e-4bd4-bc8d-82f43f8a7240___GCREC_Bact.Sp 3110.JPG`)
* **License:** CC BY 4.0
* **Image Dimensions:** $256 \times 256\text{ px}$ (JPEG, 16.9 KB)
* **Quality Check Metrics:**
  * `ok`: `True`
  * `blur`: `742.370` ($\ge 60.0$)
  * `brightness`: `0.387` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.383` ($\ge 0.15$)
  * `reason_key`: `None`
* **Model Inference (`model.onnx` v1):**
  * `top3`:
    1. `tomato__spider_mites` (`prob: 0.7174`)
    2. `tomato__bacterial_spot` (`prob: 0.2797`)
    3. `tomato__target_spot` (`prob: 0.0011`)
  * `margin`: `0.4377`
  * `verdict`: `{"status": "uncertain", "label": "tomato__spider_mites", "confidence": "low"}`

---

### Photo 10: `demo_10_poor_quality_blurry.png`
* **File Path:** `pitch/demo_photos/demo_10_poor_quality_blurry.png`
* **Crop:** Tomato (*Solanum lycopersici*)
* **Ground-Truth Label:** `tomato__late_blight` (Photograph defect: Defocused / Camera Motion Blur)
* **Source:** Derived from PlantDoc `p1.png` via Gaussian blur kernel ($r = 15$) to replicate a shaky farmer handset photo.
* **License:** Derived from CC BY 4.0
* **Image Dimensions:** $224 \times 224\text{ px}$ (PNG, 24.7 KB)
* **Quality Check Metrics:**
  * `ok`: `False`
  * `blur`: `1.626` ($< 60.0$, defect triggered)
  * `brightness`: `0.452` ($0.18 \le B \le 0.90$)
  * `leaf_ratio`: `0.439` ($\ge 0.15$)
  * `reason_key`: `"quality.too_blurry"`
* **Model Inference:**
  * *Classifier execution strictly skipped by backend and frontend when `quality.ok == False`.*
  * `verdict`: `{"status": "retake", "label": null, "confidence": null}`

---

## 3. Notes for Team Handoffs

1. **For Saad (Backend & PWA Frontend Testing)**:
   - All 10 images are ready in `pitch/demo_photos/`.
   - The set tests all 3 main verdict branches:
     - `likely` (high confidence with full treatment & prevention steps): `demo_01`, `demo_03`, `demo_04`, `demo_06`, `demo_07`.
     - `uncertain` (honest low confidence with top 3 closest matches and KCC hotline button): `demo_02`, `demo_05`, `demo_08`, `demo_09`.
     - `retake` (quality gate rejection with i18n retake instruction): `demo_10`.
2. **For Krisha (Model Calibration & Quantization)**:
   - When quantized INT8 model (`model_int8.onnx`) is exported at H9, re-verify inference on this manifest.
   - Parity with `model.onnx` can be checked directly by running `Predictor(model_path="ml/models/model_int8.onnx")` over these 10 photos.

