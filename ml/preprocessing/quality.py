"""AgriSense Photo Quality Checker wrapper (owner: Vedant).

Delegates to ml.runtime.quality to maintain compatibility across repository layout
(CONTRACTS.md) and brief structure.
"""
from ml.runtime.quality import (
    MAX_BRIGHTNESS,
    MAX_LONG_SIDE,
    MIN_BLUR,
    MIN_BRIGHTNESS,
    MIN_LEAF_RATIO,
    REASON_BLURRY,
    REASON_NO_LEAF,
    REASON_TOO_BLURRY,
    REASON_TOO_BRIGHT,
    REASON_TOO_DARK,
    check,
)

__all__ = [
    "check",
    "MIN_BLUR",
    "MIN_BRIGHTNESS",
    "MAX_BRIGHTNESS",
    "MIN_LEAF_RATIO",
    "MAX_LONG_SIDE",
    "REASON_BLURRY",
    "REASON_NO_LEAF",
    "REASON_TOO_BLURRY",
    "REASON_TOO_BRIGHT",
    "REASON_TOO_DARK",
]
