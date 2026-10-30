# KrushiCare MobileNetV3-Large INT8 Quantization Report

**Model Version:** `v1`  
**Architecture:** `mobilenetv3_large_100`  
**Source FP32 Model:** [`ml/models/model.onnx`](file:///d:/KrushiCare/KrushiCare/ml/models/model.onnx)  
**Quantized INT8 Model:** [`ml/models/model_int8.onnx`](file:///d:/KrushiCare/KrushiCare/ml/models/model_int8.onnx)  
**Report Date:** 2026-10-30  

---

## 1. Executive Summary

MobileNetV3-Large v1 was quantized to INT8 using **ONNX Runtime Static Quantization (QDQ format)**.
- **Model Size:** Reduced from **16.08 MB** (16,865,119 bytes) down to **4.48 MB** (4,702,812 bytes), achieving a **72.12% size reduction** (3.59× compression).
- **Parity & Accuracy:** **100% Top-1 match** across all reference parity test images.
- **Max Probability Difference:** **0.011035** across all classes and images, comfortably satisfying the target threshold of **≤ 0.02**.
- **Probability Sums:** Exactly normalized (~1.0000), finite, non-negative.
- **Compatibility:** Uses 100% standard ONNX opset 17 operators (`QuantizeLinear`, `DequantizeLinear`). Avoids unsupported dynamic `ConvInteger` and non-standard `com.microsoft` operators for maximum ONNX Runtime WebAssembly (WASM) compatibility.

---

## 2. Graph & Operator Verification

### I/O Contract Verification
| Property | Expected / FP32 Contract | Quantized INT8 Value | Status |
|---|---|---|---|
| Input Name | `input` | `input` | Pass |
| Input Shape | `[1, 3, 224, 224]` | `[1, 3, 224, 224]` | Pass |
| Input Dtype | `float32` | `float32` | Pass |
| Output Name | `probs` | `probs` | Pass |
| Output Shape | `[1, 13]` | `[1, 13]` | Pass |
| Output Dtype | `float32` | `float32` | Pass |
| Number of Classes | 13 | 13 | Pass |
| Output Calibration | Calibrated Softmax ($T=0.4026$) | Calibrated Softmax ($T=0.4026$) | Pass |
| Label Ordering | Exact `labels.json` order | Exact `labels.json` order | Pass |

### Operator Analysis
- **Quantization Format:** `QDQ` (QuantizeLinear / DequantizeLinear)
- **Active Node Domains:** `` (100% standard ONNX domain, no `com.microsoft` extensions)
- **Included Operator Types:** `Add, Conv, DequantizeLinear, Div, Flatten, Gemm, GlobalAveragePool, HardSigmoid, HardSwish, Mul, QuantizeLinear, ReduceMean, Softmax`
- **Output Layer Precision Preservation:** The `/Softmax` and `/Div` (temperature scaling) operations were explicitly excluded from 8-bit quantization. This ensures that the final calibrated confidence probabilities retain full floating-point precision without being coarsened by 8-bit binning (avoiding 1/255 stepping artifacts).

---

## 3. Model Size Comparison

| Model | File Size (Bytes) | File Size (MB) | Compression Ratio | Size Reduction |
|---|---|---|---|---|
| **FP32 Baseline** (`model.onnx`) | 16,865,119 | 16.08 MB | 1.00× | Baseline |
| **INT8 Quantized** (`model_int8.onnx`) | **4,702,812** | **4.48 MB** | **3.59×** | **-72.12%** |

---

## 4. Parity & Numerical Validation

Validation against the reference image suite ([`ml/parity/`](file:///d:/KrushiCare/KrushiCare/ml/parity)):

| Image | FP32 Top-1 Prediction | INT8 Top-1 Prediction | FP32 Top Conf | INT8 Top Conf | Max Abs Diff | Prob Sum | Match? |
|---|---|---|---|---|---|---|---|
| `p1.png` | **tomato__late_blight** | **tomato__late_blight** | 1.0000 | 0.9998 | 0.000155 | 1.000000 | PASS |
| `p2.png` | **tomato__septoria_leaf_spot** | **tomato__septoria_leaf_spot** | 0.9998 | 0.9991 | 0.000778 | 1.000000 | PASS |
| `p3.png` | **tomato__spider_mites** | **tomato__spider_mites** | 1.0000 | 0.9906 | 0.009417 | 1.000000 | PASS |
| `p4.png` | **tomato__healthy** | **tomato__healthy** | 1.0000 | 1.0000 | 0.000017 | 1.000000 | PASS |
| `p5.png` | **tomato__target_spot** | **tomato__target_spot** | 0.9994 | 0.9883 | 0.011035 | 1.000000 | PASS |

- **Overall Maximum Absolute Difference:** `0.011035` (Target: `≤ 0.02` -> **ACHIEVED**)
- **Top-1 Decision Parity:** 5 / 5 (100.0%)
- **Numerical Integrity:** All outputs finite, non-negative, sums equal 1.0 within numerical precision.

---

## 5. Evaluation Accuracy-Drop Status

> [!NOTE]
> **Accuracy-Drop Testing Status:** Incomplete (Raw Evaluation Imagery Unavailable)
>
> The KrushiCare repository and handoff package contain the pre-computed test metric logs (`final_plantdoc_test_metrics.json`, `final_plantdoc_test_predictions.csv`), but raw image files for the 85 PlantDoc test instances are not distributed in the repository. Full dataset re-inference on the 85-image test split cannot be executed without raw imagery.
> 
> However, on the 5 reference validation images spanning distinct disease categories, the INT8 model demonstrated 100% top-1 label agreement with the FP32 model and a maximum per-class probability deviation of only 0.0110 (1.10 percentage points).

---

## 6. Runtime & Web WASM Compatibility Analysis

### Quantization Approach Comparison
1. **Dynamic Quantization with Conv (`quantize_dynamic`):**
   - **Result:** FAILED at runtime (`[ONNXRuntimeError] : 9 : NOT_IMPLEMENTED : Could not find an implementation for ConvInteger(10) node`).
   - **Reason:** `ConvInteger` dynamic activation quantization is not implemented in ONNX Runtime CPU or WebAssembly.
2. **Dynamic Quantization MatMul-Only:**
   - **Result:** Succeeded, but provided negligible compression (reduced size by only 37 KB, 16.82 MB total) because the 54 convolutional layers remained full FP32.
3. **Static Quantization (QOperator format):**
   - **Result:** Introduced `com.microsoft` custom operators (`QLinearAdd`, `QLinearMul`, `QGemm`) and produced integer bias scale overflow warnings. These proprietary operators are not reliably supported in standard browser WebAssembly builds.
4. **Static Quantization (QDQ format — CHOSEN):**
   - **Result:** SUCCESS. Standard ONNX domain (`ai.onnx`) `QuantizeLinear` and `DequantizeLinear` operators surrounding convolutional blocks.

### WebAssembly (WASM) & Mobile Phone Compatibility
- **WASM Support:** ONNX Runtime Web (`ort-web`) includes official support for QDQ graphs via WebAssembly with SIMD (`ort.wasm-simd.min.js`).
- **Phone Deployment Caveat:** Testing successfully on an x86-64 CPU does **not** prove equal latency or performance on mobile devices. In mobile browsers without WebAssembly SIMD or WebNN acceleration, QDQ execution may fall back to software dequantization, which adds runtime overhead without throughput benefits. Comprehensive client-side browser profiling on actual target mobile hardware (Android Chrome / iOS Safari) is required prior to production mobile edge rollout.

---

## 7. Artifact Integrity Verification

In strict accordance with integration requirements:
- `ml/models/model.onnx` — **UNCHANGED** (FP32 baseline intact)
- `ml/models/model_meta.json` — **UNCHANGED**
- `ml/models/labels.json` — **UNCHANGED**
- `ml/models/thresholds.json` — **UNCHANGED**
- `ml/models/model_int8.onnx` — **CREATED** (4.48 MB)
- `ml/evaluation/int8_quantization_report.json` — **CREATED**
- `ml/evaluation/int8_quantization_report.md` — **CREATED**
