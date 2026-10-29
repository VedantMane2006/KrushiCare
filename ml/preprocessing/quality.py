"""STUB quality.py (owner: Vedant). Right shape, fake values.

Real version: OpenCV variance of Laplacian (blur), mean V (brightness 0..1),
green-pixel ratio (leaf_ratio), reason_key one of quality.too_blurry,
quality.too_dark, quality.too_bright, quality.no_leaf, or None when ok.
"""
from PIL import Image


def check(image: Image.Image) -> dict:
    return {"ok": True, "blur": 182.4, "brightness": 0.52, "leaf_ratio": 0.61, "reason_key": None}
