"""AgriSense Inference wrapper (owner: Vedant).

Delegates to ml.runtime.predict to maintain compatibility across repository layout
(CONTRACTS.md) and brief structure.
"""
from ml.runtime.predict import (
    DEFAULT_META_PATH,
    DEFAULT_MODEL_PATH,
    Predictor,
    get_default_predictor,
    predict,
    preprocess,
)

__all__ = [
    "Predictor",
    "predict",
    "preprocess",
    "get_default_predictor",
    "DEFAULT_MODEL_PATH",
    "DEFAULT_META_PATH",
]
