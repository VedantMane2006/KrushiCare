"""Grad-CAM for the MobileNetV3 classifier, in numpy (no PyTorch on the server).

What Krisha exports from the notebook (two small changes to the ONNX export):
  1. the ONNX model gets a second output "features": the last conv block, shape [1, 960, 7, 7]
     (torchvision mobilenet_v3_large: model.features(x), before avgpool);
  2. the classifier head weights go to ml/models/head.npz with keys W1, b1, W2, b2
     (model.classifier[0] and model.classifier[3]: Linear 960->1280, Hardswish, Dropout, Linear 1280->13).
     A single-Linear head (keys W, b) also works.

Because the head sits on a global average pool, the Grad-CAM channel weights are just the
gradient of the class logit with respect to the pooled vector, which we get from the head
weights by hand. That is the same number PyTorch autograd would give, without PyTorch.

predict.py (Vedant) then exposes:
    def explain(image, label) -> np.ndarray | None   # HxW map in [0, 1]
by running the model once, taking "features", and calling gradcam(features[0], head, label_index).
The backend turns the map into an overlay with overlay_jpeg().
"""
import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HEAD_PATH = Path(__file__).resolve().parents[1] / "models" / "head.npz"
OVERLAY_MAX_SIDE = 360


# ---------- the math ----------

def _hardswish(x):
    return x * np.clip(x + 3, 0, 6) / 6


def _hardswish_grad(x):
    return np.where(x < -3, 0.0, np.where(x > 3, 1.0, (2 * x + 3) / 6))


def load_head(path: Path = HEAD_PATH) -> dict:
    with np.load(path) as z:
        return {k: z[k].astype(np.float64) for k in z.files}


def head_logits(head: dict, pooled: np.ndarray) -> np.ndarray:
    if "W" in head:
        return head["W"] @ pooled + head["b"]
    return head["W2"] @ _hardswish(head["W1"] @ pooled + head["b1"]) + head["b2"]


def channel_weights(head: dict, pooled: np.ndarray, cls: int) -> np.ndarray:
    """d logit[cls] / d pooled, shape [C]."""
    if "W" in head:
        return head["W"][cls].copy()
    z1 = head["W1"] @ pooled + head["b1"]
    return head["W1"].T @ (_hardswish_grad(z1) * head["W2"][cls])


def gradcam(features: np.ndarray, head: dict, cls: int) -> np.ndarray:
    """features [C, h, w] -> map [h, w] in [0, 1] (all zeros if nothing supports the class)."""
    a = features.astype(np.float64)
    w = channel_weights(head, a.mean(axis=(1, 2)), cls)
    cam = np.maximum(np.tensordot(w, a, axes=1), 0)
    top = cam.max()
    return cam / top if top > 0 else cam


# ---------- demo map, until the trained model and head.npz exist ----------

def demo_map(image: Image.Image) -> np.ndarray:
    """Highlights brown, yellow and dark patches on the leaf. NOT the model's reasoning;
    the API marks it method="demo" and the app says so."""
    small = image.convert("RGB").resize((112, 112))
    a = np.asarray(small, dtype=np.float64) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = (g > r) & (g > b)
    lesion = np.clip((r - g) * 2.5 + 0.4, 0, 1) + np.clip(0.35 - a.mean(axis=2), 0, 1)
    m = np.where(green, lesion * 0.3, lesion)
    img = Image.fromarray(np.uint8(255 * np.clip(m, 0, 1))).filter(ImageFilter.GaussianBlur(4))
    m = np.asarray(img, dtype=np.float64) / 255
    top = m.max()
    return m / top if top > 0 else m


# ---------- picture ----------

def _colormap(m: np.ndarray) -> np.ndarray:
    """[0,1] -> RGB, a short blue-green-yellow-red ramp (like 'jet', easier on the eye)."""
    stops = np.array([[0.0, 0, 0, 160], [0.35, 0, 170, 200], [0.6, 120, 210, 60], [0.8, 250, 210, 0], [1.0, 220, 30, 20]])
    out = np.empty(m.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(m, stops[:, 0], stops[:, c + 1])
    return out


def overlay_jpeg(image: Image.Image, cam: np.ndarray, size: int = OVERLAY_MAX_SIDE) -> str:
    """The photo with the heatmap blended on top, as a data: URL (about 20-30 KB)."""
    img = image.convert("RGB")
    img.thumbnail((size, size))
    m = Image.fromarray(np.uint8(255 * np.clip(cam, 0, 1))).resize(img.size, Image.BILINEAR)
    m = np.asarray(m, dtype=np.float64)[..., None] / 255
    base = np.asarray(img, dtype=np.float64)
    alpha = 0.15 + 0.45 * m  # cold areas stay mostly visible, hot areas are clearly coloured
    blended = base * (1 - alpha) + _colormap(m[..., 0]) * alpha
    buf = io.BytesIO()
    Image.fromarray(np.uint8(np.clip(blended, 0, 255))).save(buf, "JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
