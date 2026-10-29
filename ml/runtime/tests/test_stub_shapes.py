from PIL import Image

from ml.runtime import predict, quality


def test_predict_shape():
    out = predict.predict(Image.new("RGB", (224, 224), "green"))
    assert set(out) == {"model_version", "top3", "margin"}
    assert 1 <= len(out["top3"]) <= 3


def test_quality_shape():
    out = quality.check(Image.new("RGB", (224, 224), "green"))
    assert set(out) == {"ok", "blur", "brightness", "leaf_ratio", "reason_key"}
