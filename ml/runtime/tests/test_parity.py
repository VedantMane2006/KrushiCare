"""Parity test: run the real v1 ONNX model on the 5 reference images
and assert that each output probability vector is within 1e-3 (max absolute
difference) of the expected values recorded in ml/parity/expected.json.

Run with:
    python -m pytest ml/runtime/tests/test_parity.py -v

Skipped automatically when the real ONNX model is not present (stub mode),
so the regular test suite can still run in CI before Krisha's model lands.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from ml.runtime.predict import Predictor

REPO_ROOT = Path(__file__).resolve().parents[3]
PARITY_DIR = REPO_ROOT / "ml" / "parity"
EXPECTED_PATH = PARITY_DIR / "expected.json"
MODEL_PATH = REPO_ROOT / "ml" / "models" / "model.onnx"

MAX_ABS_DIFF = 1e-3  # contract requirement


@pytest.fixture(scope="module")
def predictor():
    """Load the real ONNX predictor once for all parity tests."""
    p = Predictor()
    if p.is_stub:
        pytest.skip("Real ONNX model not present; skipping parity tests.")
    return p


@pytest.fixture(scope="module")
def expected():
    assert EXPECTED_PATH.exists(), f"Missing {EXPECTED_PATH}"
    return json.loads(EXPECTED_PATH.read_text(encoding="utf-8"))


def _image_ids():
    if EXPECTED_PATH.exists():
        data = json.loads(EXPECTED_PATH.read_text(encoding="utf-8"))
        return [item["file"] for item in data]
    return []


@pytest.mark.parametrize("entry", json.loads(EXPECTED_PATH.read_text()) if EXPECTED_PATH.exists() else [],
                         ids=lambda e: e["file"])
def test_parity(entry, predictor):
    """Each parity image's probability vector must match expected within 1e-3."""
    fname = entry["file"]
    img_path = PARITY_DIR / fname
    assert img_path.exists(), f"Missing parity image: {img_path}"

    img = Image.open(img_path)
    got = predictor.predict_probs(img).astype(np.float64)
    exp = np.array(entry["probs"], dtype=np.float64)

    assert len(got) == len(exp), (
        f"{fname}: output length mismatch: got {len(got)}, expected {len(exp)}"
    )

    abs_diff = np.abs(got - exp)
    max_diff = float(abs_diff.max())
    worst_idx = int(abs_diff.argmax())

    assert max_diff < MAX_ABS_DIFF, (
        f"{fname}: max_abs_diff={max_diff:.2e} exceeds {MAX_ABS_DIFF:.0e} "
        f"at index {worst_idx} (label={predictor.labels[worst_idx]}); "
        f"got={got[worst_idx]:.8f}, expected={exp[worst_idx]:.8f}"
    )


def test_parity_overall_max(predictor, expected):
    """Overall max absolute difference across all 5 parity images must be < 1e-3."""
    overall_max = 0.0
    for item in expected:
        img_path = PARITY_DIR / item["file"]
        img = Image.open(img_path)
        got = predictor.predict_probs(img).astype(np.float64)
        exp = np.array(item["probs"], dtype=np.float64)
        diff = float(np.abs(got - exp).max())
        overall_max = max(overall_max, diff)

    assert overall_max < MAX_ABS_DIFF, (
        f"Overall parity max_abs_diff={overall_max:.2e} exceeds {MAX_ABS_DIFF:.0e}"
    )


def test_output_not_double_softmaxed(predictor, expected):
    """Probabilities must sum to ~1.0 (not 0 after double-softmax or wrong scale)."""
    for item in expected:
        img_path = PARITY_DIR / item["file"]
        img = Image.open(img_path)
        probs = predictor.predict_probs(img).astype(np.float64)
        total = float(probs.sum())
        assert abs(total - 1.0) < 1e-4, (
            f"{item['file']}: probs sum={total:.6f}, expected ~1.0. "
            "Check that softmax is not applied a second time."
        )
        assert probs.min() >= 0.0, f"{item['file']}: negative probability detected"


def test_model_version_v1(predictor):
    """The loaded model must report model_version='v1'."""
    assert predictor.model_version == "v1", (
        f"Expected model_version='v1', got '{predictor.model_version}'"
    )


def test_label_order_matches_labels_json(predictor):
    """The predictor's label list must exactly match ml/models/labels.json."""
    labels_path = REPO_ROOT / "ml" / "models" / "labels.json"
    assert labels_path.exists(), f"Missing {labels_path}"
    expected_labels = json.loads(labels_path.read_text(encoding="utf-8"))
    assert predictor.labels == expected_labels, (
        "Predictor label order does not match labels.json. "
        "Do NOT reorder to match older PDF briefs."
    )
