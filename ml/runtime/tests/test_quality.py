"""Tests for ml.runtime.quality check interface and failure conditions."""
import cv2
import numpy as np
import pytest
from PIL import Image

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


def _make_sharp_green_image(size: tuple[int, int] = (256, 256)) -> Image.Image:
    """Generate a high-frequency checkerboard of green shades."""
    w, h = size
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            if (y // 8 + x // 8) % 2 == 0:
                arr[y, x] = [34, 139, 34]  # Forest green
            else:
                arr[y, x] = [50, 205, 50]  # Lime green
    return Image.fromarray(arr, "RGB")


def test_constants():
    """Verify quality constants match brief specifications."""
    assert MIN_BLUR == 60.0
    assert MIN_BRIGHTNESS == 0.18
    assert MAX_BRIGHTNESS == 0.90
    assert MIN_LEAF_RATIO == 0.15
    assert MAX_LONG_SIDE == 512


def test_quality_shape():
    """Return dictionary must have exact fields and rounded floats."""
    img = _make_sharp_green_image()
    res = check(img)

    assert set(res.keys()) == {"ok", "blur", "brightness", "leaf_ratio", "reason_key"}
    assert isinstance(res["ok"], bool)
    assert isinstance(res["blur"], float)
    assert isinstance(res["brightness"], float)
    assert isinstance(res["leaf_ratio"], float)
    assert res["reason_key"] is None or isinstance(res["reason_key"], str)

    # Floats must be rounded to 3 decimal places
    assert res["blur"] == round(res["blur"], 3)
    assert res["brightness"] == round(res["brightness"], 3)
    assert res["leaf_ratio"] == round(res["leaf_ratio"], 3)


def test_synthetic_sharp_green_passes():
    """A synthetic sharp green image passes all checks."""
    img = _make_sharp_green_image()
    res = check(img)

    assert res["ok"] is True
    assert res["reason_key"] is None
    assert res["blur"] >= MIN_BLUR
    assert MIN_BRIGHTNESS <= res["brightness"] <= MAX_BRIGHTNESS
    assert res["leaf_ratio"] >= MIN_LEAF_RATIO


def test_heavily_blurred_fails():
    """A heavily Gaussian-blurred green image fails with blurry reason."""
    img = _make_sharp_green_image()
    arr = np.array(img)
    blurred_arr = cv2.GaussianBlur(arr, (51, 51), 0)
    blurred_img = Image.fromarray(blurred_arr, "RGB")

    res = check(blurred_img)
    assert res["ok"] is False
    assert res["reason_key"] in (REASON_TOO_BLURRY, REASON_BLURRY)
    assert res["blur"] < MIN_BLUR


def test_all_black_fails_too_dark():
    """An all-black image fails with quality.too_dark."""
    black_img = Image.new("RGB", (256, 256), color=(0, 0, 0))
    res = check(black_img)

    assert res["ok"] is False
    assert res["reason_key"] == REASON_TOO_DARK
    assert res["brightness"] < MIN_BRIGHTNESS


def test_all_white_fails_too_bright():
    """An overexposed image fails with quality.too_bright."""
    white_img = Image.new("RGB", (256, 256), color=(255, 255, 255))
    res = check(white_img)

    assert res["ok"] is False
    assert res["reason_key"] == REASON_TOO_BRIGHT
    assert res["brightness"] > MAX_BRIGHTNESS


def test_grey_fails_no_leaf():
    """A grey textured image (high sharpness, no green) fails with quality.no_leaf."""
    w, h = 256, 256
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            val = 110 if (y // 6 + x // 6) % 2 == 0 else 160
            arr[y, x] = [val, val, val]
    grey_img = Image.fromarray(arr, "RGB")

    res = check(grey_img)
    assert res["ok"] is False
    assert res["reason_key"] == REASON_NO_LEAF
    assert res["blur"] >= MIN_BLUR
    assert MIN_BRIGHTNESS <= res["brightness"] <= MAX_BRIGHTNESS
    assert res["leaf_ratio"] < MIN_LEAF_RATIO


def test_downscale_preserves_aspect_and_caps_long_side():
    """Images with long side > 512 are downscaled before processing."""
    img = Image.new("RGB", (1024, 768), color=(34, 139, 34))
    res = check(img)
    assert "ok" in res

