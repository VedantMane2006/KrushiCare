"""Parity: predict.py on ml/parity/*.png must match Krisha's expected.json (brief: max abs diff < 1e-3)."""
import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from ml.runtime.predict import Predictor

PARITY = Path(__file__).resolve().parents[2] / "parity"


def test_parity_with_training_export():
    if not (PARITY / "expected.json").exists():
        pytest.skip("no parity set")
    p = Predictor()
    if p.is_stub:
        pytest.skip("no trained model in this checkout")
    for item in json.loads((PARITY / "expected.json").read_text()):
        probs = p.predict_probs(Image.open(PARITY / item["file"]))
        assert np.abs(probs - np.array(item["probs"])).max() < 1e-3, item["file"]
