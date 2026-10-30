"""Parity and verification test for the quantized INT8 model (ml/models/model_int8.onnx).
"""
from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pytest
from PIL import Image
import onnxruntime as ort

from ml.runtime.predict import Predictor

REPO_ROOT = Path(__file__).resolve().parents[3]
PARITY_DIR = REPO_ROOT / "ml" / "parity"
EXPECTED_PATH = PARITY_DIR / "expected.json"
INT8_MODEL_PATH = REPO_ROOT / "ml" / "models" / "model_int8.onnx"
MAX_ALLOWED_DIFF = 0.02


@pytest.fixture(scope="module")
def int8_session():
    if not INT8_MODEL_PATH.exists():
        pytest.skip(f"INT8 model not found at {INT8_MODEL_PATH}")
    return ort.InferenceSession(str(INT8_MODEL_PATH), providers=["CPUExecutionProvider"])


@pytest.fixture(scope="module")
def fp32_predictor():
    p = Predictor()
    if p.is_stub:
        pytest.skip("FP32 model not present.")
    return p


@pytest.fixture(scope="module")
def expected():
    assert EXPECTED_PATH.exists(), f"Missing {EXPECTED_PATH}"
    return json.loads(EXPECTED_PATH.read_text(encoding="utf-8"))


def test_int8_io_contract(int8_session):
    """INT8 model must maintain identical I/O contract as FP32."""
    inp = int8_session.get_inputs()[0]
    out = int8_session.get_outputs()[0]
    assert inp.name == "input"
    assert inp.shape == [1, 3, 224, 224]
    assert out.name == "probs"
    assert out.shape == [1, 13]


def test_int8_parity_and_accuracy(int8_session, fp32_predictor, expected):
    """INT8 model must match FP32 top-1 predictions and stay within <= 0.02 diff."""
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    for item in expected:
        img_path = PARITY_DIR / item["file"]
        img = Image.open(img_path).convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
        arr = (np.array(img, dtype=np.float32) / 255.0 - mean) / std
        arr = arr.transpose(2, 0, 1)[np.newaxis, ...]

        int8_out = int8_session.run(["probs"], {"input": arr})[0][0]
        fp32_out = fp32_predictor.predict_probs(Image.open(img_path))

        assert np.all(np.isfinite(int8_out)), f"{item['file']}: non-finite probability output"
        assert abs(float(int8_out.sum()) - 1.0) < 1e-4, f"{item['file']}: probabilities do not sum to 1"

        top1_int8 = int(np.argmax(int8_out))
        top1_fp32 = int(np.argmax(fp32_out))
        assert top1_int8 == top1_fp32, (
            f"{item['file']}: Top-1 mismatch! FP32={fp32_predictor.labels[top1_fp32]}, "
            f"INT8={fp32_predictor.labels[top1_int8]}"
        )

        max_diff = float(np.max(np.abs(int8_out - fp32_out)))
        assert max_diff <= MAX_ALLOWED_DIFF, (
            f"{item['file']}: Max prob diff {max_diff:.5f} exceeds threshold {MAX_ALLOWED_DIFF}"
        )
