"""STUB predict.py (owner: Vedant). Right shape, fake values.

Real version: load ml/models/model.onnx with onnxruntime, preprocess exactly as
model_meta.json says, return top-3 and margin (top1 - top2).
"""
import json
from pathlib import Path

from PIL import Image

_META = json.loads((Path(__file__).resolve().parents[1] / "models" / "model_meta.json").read_text())


def predict(image: Image.Image) -> dict:
    return {
        "model_version": _META["model_version"],
        "top3": [
            {"label": "tomato__late_blight", "prob": 0.81},
            {"label": "tomato__early_blight", "prob": 0.19},
            {"label": "potato__late_blight", "prob": 0.0},
        ],
        "margin": 0.62,
    }
