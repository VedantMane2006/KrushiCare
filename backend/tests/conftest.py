import io
import json
import uuid
from pathlib import Path

import jsonschema
import pytest
from fastapi.testclient import TestClient
from PIL import Image

BACKEND = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((BACKEND / "knowledge_base/schemas/diagnosis_result.schema.json").read_text())


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    import main
    with TestClient(main.app) as c:
        c.state = main.S
        yield c


def jpeg_bytes(color="green") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color).save(buf, "JPEG")
    return buf.getvalue()


def fields(**kw):
    base = {"client_id": str(uuid.uuid4()), "crop": "tomato", "lang": "en", "lat": "18.52", "lon": "73.86",
            "captured_at": "2026-10-29T10:00:00Z"}
    base.update(kw)
    return base


def classifier(*pairs):
    top3 = [{"label": l, "prob": p} for l, p in pairs]
    margin = pairs[0][1] - (pairs[1][1] if len(pairs) > 1 else 0)
    return {"model_version": "test", "top3": top3, "margin": round(margin, 4)}


def assert_valid(body):
    jsonschema.validate(body, SCHEMA)
