"""Tests for ml.runtime.predict module and Predictor interface."""
import numpy as np
import pytest
from PIL import Image

from ml.runtime.predict import Predictor, predict, preprocess


def test_predictor_instantiation_without_model():
    """Predictor should instantiate without requiring a trained model.onnx."""
    predictor = Predictor()
    assert predictor.is_stub is True
    assert predictor.model_version == "stub"
    assert len(predictor.labels) == 13


def test_predict_return_shape():
    """predict() must strictly match the agreed shape."""
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    predictor = Predictor()
    out = predictor.predict(img)

    assert set(out.keys()) == {"model_version", "top3", "margin"}
    assert isinstance(out["model_version"], str)
    assert isinstance(out["top3"], list)
    assert 1 <= len(out["top3"]) <= 3
    assert isinstance(out["margin"], float)

    # Check top3 items
    for item in out["top3"]:
        assert "label" in item and isinstance(item["label"], str)
        assert "prob" in item and isinstance(item["prob"], float)
        # Probabilities rounded to 4 decimals
        assert item["prob"] == round(item["prob"], 4)

    # Sorted descending by prob
    probs = [item["prob"] for item in out["top3"]]
    assert probs == sorted(probs, reverse=True)

    # Margin check
    if len(probs) >= 2:
        expected_margin = round(probs[0] - probs[1], 4)
        assert out["margin"] == expected_margin


def test_module_level_predict():
    """Module-level predict(image) function should return expected shape."""
    img = Image.new("RGB", (300, 300), color=(0, 255, 0))
    out = predict(img)
    assert set(out.keys()) == {"model_version", "top3", "margin"}
    assert len(out["top3"]) == 3


def test_preprocess_shape_and_dtype():
    """preprocess(image) must return float32 tensor of shape [1, 3, 224, 224]."""
    img = Image.new("RGB", (640, 480), color=(100, 150, 200))
    tensor = preprocess(img)

    assert isinstance(tensor, np.ndarray)
    assert tensor.dtype == np.float32
    assert tensor.shape == (1, 3, 224, 224)


def test_preprocess_exif_orientation():
    """preprocess(image) should handle EXIF orientation transpose."""
    # Create image with EXIF orientation tag
    img = Image.new("RGB", (100, 200), color=(50, 100, 150))
    exif = img.getexif()
    exif[0x0112] = 6  # Orientation: rotate 270 CW (90 CCW)
    img._getexif = lambda: dict(exif)

    tensor = preprocess(img)
    assert tensor.shape == (1, 3, 224, 224)

