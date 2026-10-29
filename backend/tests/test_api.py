import json

import pytest

from .conftest import assert_valid, classifier, fields, jpeg_bytes


def post(client, **kw):
    return client.post("/api/diagnose", data=fields(**kw), files={"image": ("leaf.jpg", jpeg_bytes(), "image/jpeg")})


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["contract_version"] == 1 and body["model_version"]


@pytest.mark.parametrize("pairs,crop,expected", [
    ([("tomato__late_blight", 0.85), ("tomato__early_blight", 0.10)], "tomato", ("likely", "high")),
    ([("tomato__late_blight", 0.75), ("tomato__early_blight", 0.50)], "tomato", ("likely", "medium")),  # margin too small
    ([("tomato__late_blight", 0.60), ("tomato__early_blight", 0.30)], "tomato", ("likely", "medium")),
    ([("tomato__late_blight", 0.48), ("tomato__early_blight", 0.40)], "tomato", ("uncertain", "low")),
    ([("potato__late_blight", 0.90), ("tomato__late_blight", 0.05)], "tomato", ("uncertain", "low")),  # wrong crop
    ([("tomato__late_blight", 0.30), ("tomato__early_blight", 0.25)], "tomato", ("unsupported", None)),
])
def test_verdict_branches(client, monkeypatch, pairs, crop, expected):
    # Test the original verdict branching rules independently
    # from the deployed model's conservative thresholds.
    from services.verdict import DEFAULT_THRESHOLDS
    monkeypatch.setattr(
        client.state,
        "thresholds",
        dict(DEFAULT_THRESHOLDS)
    )
    monkeypatch.setattr(client.state, "predict", lambda img: classifier(*pairs))
    r = post(client, crop=crop)
    assert r.status_code == 200, r.text
    body = r.json()
    assert_valid(body)
    assert (body["verdict"]["status"], body["verdict"]["confidence"]) == expected
    if expected[0] == "unsupported":
        assert body["verdict"]["label"] is None
    assert body["advice"]["summary"]


def test_retake_skips_model(client, monkeypatch):
    called = []
    monkeypatch.setattr(client.state, "check", lambda img: {"ok": False, "blur": 12.0, "brightness": 0.5,
                                                            "leaf_ratio": 0.6, "reason_key": "quality.too_blurry"})
    monkeypatch.setattr(client.state, "predict", lambda img: called.append(1))
    body = post(client).json()
    assert_valid(body)
    assert body["verdict"]["status"] == "retake"
    assert body["classifier"] is None and not called
    assert body["quality"]["reason_key"] == "quality.too_blurry"


def test_no_location_is_not_assessed(client):
    body = post(client, lat="", lon="").json()
    assert_valid(body)
    assert body["weather_risk"]["level"] == "not_assessed"
    assert body["soil"]["irrigation_key"] == "unknown"


def test_context_failure_is_not_assessed(client, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("open-meteo down")
    monkeypatch.setattr(client.state, "get_context", boom)
    body = post(client).json()
    assert_valid(body)
    assert body["weather_risk"]["level"] == "not_assessed"


def test_soil_card_passed_through(client):
    card = {"ph": 6.2, "n": 250, "p": 12, "k": 140, "oc": 0.4}
    body = post(client, lat="", lon="", soil_card=json.dumps(card)).json()
    assert_valid(body)
    assert body["soil"]["card_values"] == card


def test_lang_fallback_and_hindi(client):
    body = post(client, lang="hi").json()
    assert_valid(body)
    assert body["lang"] == "hi"


def test_idempotency(client, monkeypatch):
    f = fields()
    img = {"image": ("leaf.jpg", jpeg_bytes(), "image/jpeg")}
    first = client.post("/api/diagnose", data=f, files=img).json()
    # Even if the model changes its mind, the stored result is returned.
    monkeypatch.setattr(client.state, "predict", lambda i: classifier(("tomato__healthy", 0.99)))
    second = client.post("/api/diagnose", data=f, files={"image": ("leaf.jpg", jpeg_bytes(), "image/jpeg")}).json()
    assert first == second


@pytest.mark.parametrize("override,status", [
    ({"client_id": "nope"}, 400), ({"crop": "rice"}, 400), ({"lang": "fr"}, 400), ({"lat": "abc"}, 400),
])
def test_bad_fields(client, override, status):
    assert post(client, **override).status_code == status


def test_non_image_rejected(client):
    r = client.post("/api/diagnose", data=fields(), files={"image": ("x.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 400


def test_batch_suffixed_with_one_bad_item(client):
    good1, good2 = fields(), fields(crop="potato", lat="", lon="")
    data = {}
    for i, f in enumerate([good1, fields(client_id="bad"), good2]):
        data.update({f"{k}_{i}": v for k, v in f.items()})
    files = {f"image_{i}": (f"{i}.jpg", jpeg_bytes(), "image/jpeg") for i in range(3)}
    r = client.post("/api/diagnose/batch", data=data, files=files)
    assert r.status_code == 200
    res = r.json()["results"]
    assert len(res) == 3
    assert res[1] == {"client_id": "bad", "error": "client_id must be a uuid"}
    assert_valid(res[0]) and assert_valid(res[2])
    assert res[0]["client_id"] == good1["client_id"] and res[2]["client_id"] == good2["client_id"]


def test_batch_manifest_and_missing_image(client):
    a, b = fields(), fields()
    manifest = [a, b]
    files = {f"image_{a['client_id']}": ("a.jpg", jpeg_bytes(), "image/jpeg")}
    res = client.post("/api/diagnose/batch", data={"manifest": json.dumps(manifest)}, files=files).json()["results"]
    assert_valid(res[0])
    assert res[1]["error"] == "image file is required"


def test_batch_limit(client):
    data = {}
    for i in range(11):
        data.update({f"{k}_{i}": v for k, v in fields().items()})
    assert client.post("/api/diagnose/batch", data=data).status_code in (400, 413)


def test_advice_pack_and_schemes(client):
    pack = client.get("/api/advice-pack", params={"lang": "mr"}).json()
    assert "uncertain" in pack and "unsupported" in pack
    schemes = client.get("/api/schemes", params={"lang": "hi"}).json()
    assert isinstance(schemes, list) and schemes
    assert client.get("/api/schemes", params={"lang": "xx"}).status_code == 400


def test_climate_endpoint(client, monkeypatch):
    import jsonschema as js
    from pathlib import Path
    schema = json.loads((Path(__file__).resolve().parents[1] / "knowledge_base/schemas/climate.schema.json").read_text())
    from services import fakes
    monkeypatch.setattr(client.state, "get_climate", fakes.get_climate)
    r = client.get("/api/climate", params={"lat": 18.52, "lon": 73.86})
    assert r.status_code == 200
    js.validate(r.json(), schema)

    def boom(lat, lon):
        raise RuntimeError("archive down")
    monkeypatch.setattr(client.state, "get_climate", boom)
    assert client.get("/api/climate", params={"lat": 18.52, "lon": 73.86}).status_code == 503
    assert client.get("/api/climate", params={"lat": 100, "lon": 0}).status_code == 422


def test_context_endpoint(client, monkeypatch):
    r = client.get("/api/context", params={"lat": 18.52, "lon": 73.86, "crop": "potato"})
    assert r.status_code == 200
    assert set(r.json()) == {"weather_risk", "soil"}
    assert client.get("/api/context", params={"lat": 18.52, "lon": 73.86, "crop": "rice"}).status_code == 400

    def boom(*a):
        raise RuntimeError("down")
    monkeypatch.setattr(client.state, "get_context", boom)
    assert client.get("/api/context", params={"lat": 18.52, "lon": 73.86}).status_code == 503



def test_likely_result_has_gradcam(client, monkeypatch):
    import numpy as np

    from services import fakes
    from services.verdict import DEFAULT_THRESHOLDS

    # Isolate the overlay contract from model accuracy.
    monkeypatch.setattr(
        client.state,
        "thresholds",
        dict(DEFAULT_THRESHOLDS)
    )

    monkeypatch.setattr(
        client.state,
        "predict",
        lambda img: classifier(
            ("tomato__late_blight", 0.85),
            ("tomato__early_blight", 0.10),
        )
    )

    monkeypatch.setattr(
        client.state,
        "check",
        fakes.check
    )

    # Synthetic explanation for an API contract test only.
    monkeypatch.setattr(
        client.state,
        "explain",
        lambda img, label: np.ones(
            (8, 8), dtype=np.float32
        )
    )

    r = client.post(
        "/api/diagnose",
        data=fields(),
        files={
            "image": (
                "a.jpg",
                jpeg_bytes(),
                "image/jpeg"
            )
        }
    )

    assert r.status_code == 200, r.text

    body = r.json()

    assert_valid(body)
    assert body["verdict"]["status"] == "likely"
    assert body["gradcam"] is not None

    assert body["gradcam"]["image"].startswith(
        "data:image/jpeg;base64,"
    )

    assert body["gradcam"]["method"] in (
        "demo", "gradcam"
    )

