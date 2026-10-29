import numpy as np
from PIL import Image

from ml.inference.gradcam import channel_weights, demo_map, gradcam, head_logits, overlay_jpeg


def _head(rng, c=12, hidden=9, n=4):
    return {"W1": rng.normal(size=(hidden, c)), "b1": rng.normal(size=hidden),
            "W2": rng.normal(size=(n, hidden)), "b2": rng.normal(size=n)}


def test_channel_weights_match_numerical_gradient():
    rng = np.random.default_rng(0)
    head, p = _head(rng), rng.normal(size=12)
    for cls in range(4):
        num = np.array([(head_logits(head, p + e)[cls] - head_logits(head, p - e)[cls]) / 2e-6
                        for e in np.eye(12) * 1e-6])
        assert np.allclose(channel_weights(head, p, cls), num, atol=1e-5)


def test_single_linear_head():
    rng = np.random.default_rng(1)
    head = {"W": rng.normal(size=(3, 5)), "b": np.zeros(3)}
    assert np.allclose(channel_weights(head, rng.normal(size=5), 2), head["W"][2])


def test_gradcam_finds_the_hot_region():
    # Channel 0 drives class 0 and is active only in the top-left corner.
    feats = np.zeros((2, 7, 7))
    feats[0, :2, :2] = 5.0
    feats[1] = 1.0
    head = {"W": np.array([[1.0, -1.0]]), "b": np.zeros(1)}
    cam = gradcam(feats, head, 0)
    assert cam.shape == (7, 7) and cam.max() == 1.0
    assert cam[0, 0] == 1.0 and cam[6, 6] == 0.0


def test_demo_map_and_overlay():
    img = Image.new("RGB", (200, 150), (40, 140, 40))
    img.paste((140, 90, 30), (20, 20, 70, 70))  # a brown spot
    m = demo_map(img)
    assert m.max() == 1.0
    ys, xs = np.unravel_index(m.argmax(), m.shape)
    assert xs < 60 and ys < 60
    url = overlay_jpeg(img, m)
    assert url.startswith("data:image/jpeg;base64,") and len(url) < 60_000


def test_onnx_gradcam_matches_the_model():
    """The head read out of model.onnx must reproduce the model's own probabilities."""
    import json
    from pathlib import Path

    import pytest
    root = Path(__file__).resolve().parents[2]
    model, meta = root / "ml/models/model.onnx", json.loads((root / "ml/models/model_meta.json").read_text())
    if not model.exists() or meta.get("model_version") == "stub":
        pytest.skip("no trained model in this checkout")
    pytest.importorskip("onnx")
    from ml.inference.gradcam import OnnxGradCam
    from ml.inference.predict import Predictor, preprocess

    cam, pred = OnnxGradCam(model, preprocess), Predictor()
    img = Image.new("RGB", (200, 150), (40, 140, 40))
    img.paste((140, 90, 30), (20, 20, 70, 70))
    feats = cam.session.run([cam.features_name], {cam.input_name: preprocess(img)})[0][0]
    z = head_logits(cam.head, feats.mean(axis=(1, 2))) / meta["output"].get("temperature", 1.0)
    p = np.exp(z - z.max())
    assert np.allclose(p / p.sum(), pred.predict_probs(img), atol=1e-5)
    m = cam.explain(img, int(np.argmax(z)))
    assert m.shape == feats.shape[1:] and m.max() <= 1.0
