"""AgriSense API. Contract: CONTRACTS.md and knowledge_base/schemas/diagnosis_result.schema.json.

Run from backend/:  uvicorn main:app --reload --port 8000
"""
import asyncio
import io
import json
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError

from database import db
from services import fakes
from services.verdict import CONTRACT_VERSION, NOT_ASSESSED_CONTEXT, build_result, decide, load_thresholds, pick_advice

BACKEND = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("AGRISENSE_ROOT", BACKEND.parent))  # repo root, for ml/
sys.path.insert(0, str(ROOT))

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_BATCH = 10
CONTEXT_TIMEOUT_S = float(os.environ.get("CONTEXT_TIMEOUT_S", "8"))
CLIMATE_TIMEOUT_S = float(os.environ.get("CLIMATE_TIMEOUT_S", "25"))
CROPS = {"tomato", "potato"}
LANGS = {"en", "hi", "mr"}
SOIL_CARD_KEYS = {"ph", "n", "p", "k", "oc"}

log = logging.getLogger("agrisense")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class State:
    predict = None
    check = None
    get_context = None
    get_climate = None
    explain = None
    model_meta: dict = {}
    thresholds: dict = {}
    advice_pack: dict = {}
    schemes: dict = {}
    using_fakes: list[str] = []


S = State()


def _read_json(p: Path, default):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def _model_labels() -> list[str]:
    return _read_json(ROOT / "ml/models/model_meta.json", {}).get("labels", [])


def _load_components() -> None:
    use_fakes = os.environ.get("USE_FAKES") == "1"
    S.using_fakes = []

    def load(name, real_import, fake):
        if use_fakes:
            S.using_fakes.append(name)
            return fake
        try:
            return real_import()
        except Exception as e:  # a teammate's module is missing or broken: keep the app up
            log.warning("falling back to fake %s: %s", name, e)
            S.using_fakes.append(name)
            return fake

    def real_predict():
        from ml.inference import predict as m
        # Brief allows either a Predictor class (one instance at startup) or a module-level predict().
        return m.Predictor().predict if hasattr(m, "Predictor") else m.predict

    def real_check():
        from ml.preprocessing import quality as m
        return m.check

    def real_context():
        from services import context as m
        return m.get_context

    def real_climate():
        from services import climate as m
        return m.get_climate

    def real_explain():
        from ml.inference import predict as m
        target = m.Predictor() if hasattr(m, "Predictor") else m
        if hasattr(target, "explain"):
            return target.explain
        # Real Grad-CAM read straight from the exported model; the demo map if there is no model yet.
        from ml.inference.gradcam import OnnxGradCam
        model = ROOT / "ml/models/model.onnx"
        if not model.exists() or getattr(target, "is_stub", False):
            raise FileNotFoundError("no trained model.onnx yet")
        cam = OnnxGradCam(model, m.preprocess)
        labels = _model_labels()
        return lambda image, label: cam.explain(image, labels.index(label))

    S.predict = load("predict", real_predict, fakes.predict)
    S.explain = load("gradcam", real_explain, fakes.explain)
    S.check = load("quality", real_check, fakes.check)
    S.get_context = load("context", real_context, fakes.get_context)
    S.get_climate = load("climate", real_climate, fakes.get_climate)
    S.model_meta = _read_json(ROOT / "ml/models/model_meta.json", {"model_version": "unknown"})
    S.thresholds = load_thresholds(ROOT / "ml/models/thresholds.json")
    S.advice_pack = _read_json(BACKEND / "knowledge_base/advice_pack.json", {})
    S.schemes = _read_json(BACKEND / "knowledge_base/schemes.json", {})


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()
    _load_components()
    yield


app = FastAPI(title="AgriSense API", version=str(CONTRACT_VERSION), lifespan=lifespan)

_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins + ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"],
    allow_origin_regex=os.environ.get("ALLOWED_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------- input parsing ----------

def _bad(msg: str, code: int = 400):
    raise HTTPException(status_code=code, detail=msg)


def _parse_fields(f: dict) -> dict:
    """Validate the non-image fields of one item. Raises HTTPException."""
    try:
        client_id = str(uuid.UUID(str(f.get("client_id", ""))))
    except ValueError:
        _bad("client_id must be a uuid")
    crop = f.get("crop")
    if crop not in CROPS:
        _bad("crop must be tomato or potato")
    lang = f.get("lang") or "en"
    if lang not in LANGS:
        _bad("lang must be en, hi or mr")

    def opt_float(k):
        v = f.get(k)
        if v in (None, "", "null"):
            return None
        try:
            return float(v)
        except ValueError:
            _bad(f"{k} must be a number")

    lat, lon = opt_float("lat"), opt_float("lon")
    if lat is not None and not -90 <= lat <= 90 or lon is not None and not -180 <= lon <= 180:
        _bad("lat/lon out of range")

    soil_card = None
    if f.get("soil_card"):
        try:
            raw = json.loads(f["soil_card"])
            soil_card = {k: (float(raw[k]) if raw.get(k) not in (None, "") else None) for k in SOIL_CARD_KEYS if k in raw}
        except (ValueError, TypeError, AttributeError):
            _bad("soil_card must be a JSON object of numbers")
        soil_card = soil_card or None

    return {"client_id": client_id, "crop": crop, "lang": lang, "lat": lat, "lon": lon,
            "captured_at": f.get("captured_at") or None, "soil_card": soil_card}


async def _read_image(upload) -> Image.Image:
    if upload is None or not hasattr(upload, "read"):
        _bad("image file is required")
    data = await upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        _bad("image is larger than 8 MB", 413)
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
        if img.format not in ("JPEG", "PNG", "WEBP", "MPO"):
            _bad("image must be jpeg or png")
        # exif_transpose also drops orientation; we never keep the original bytes (EXIF/GPS) anyway.
        return ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError):
        _bad("file is not a valid image")


# ---------- pipeline ----------

async def _context(lat, lon, crop, soil_card) -> dict:
    if lat is None or lon is None:
        ctx = json.loads(json.dumps(NOT_ASSESSED_CONTEXT))
        ctx["soil"]["card_values"] = soil_card
        return ctx
    try:
        return await asyncio.wait_for(asyncio.to_thread(S.get_context, lat, lon, crop, soil_card), CONTEXT_TIMEOUT_S)
    except Exception as e:
        log.warning("context failed (%s): %s", type(e).__name__, e)
        ctx = json.loads(json.dumps(NOT_ASSESSED_CONTEXT))
        ctx["soil"]["card_values"] = soil_card
        return ctx


def _classify(img: Image.Image, crop: str) -> tuple[dict, dict | None, dict]:
    quality = S.check(img)
    classifier = S.predict(img) if quality["ok"] else None
    return quality, classifier, decide(classifier, quality, crop, S.thresholds)


def _gradcam(img: Image.Image, verdict: dict) -> dict | None:
    """Heatmap of where the disease shows, for a 'likely' diagnosis. Never fails the request."""
    if verdict["status"] != "likely" or not verdict.get("label") or verdict["label"].endswith("__healthy"):
        return None
    try:
        from ml.inference.gradcam import overlay_jpeg
        cam = S.explain(img, verdict["label"])
        if cam is None:
            return None
        method = "demo" if "gradcam" in S.using_fakes else "gradcam"
        return {"method": method, "label": verdict["label"], "image": overlay_jpeg(img, cam)}
    except Exception as e:
        log.warning("gradcam failed (%s): %s", type(e).__name__, e)
        return None


async def diagnose_one(fields: dict, upload) -> dict:
    t0 = time.perf_counter()
    stored = db.get(fields["client_id"])
    if stored:
        log.info("client_id=%s verdict=%s cached=1 ms=%d", fields["client_id"], stored["verdict"]["status"],
                 (time.perf_counter() - t0) * 1000)
        return stored

    img = await _read_image(upload)
    (quality, classifier, verdict), context = await asyncio.gather(
        asyncio.to_thread(_classify, img, fields["crop"]),
        _context(fields["lat"], fields["lon"], fields["crop"], fields["soil_card"]),
    )
    result = build_result(
        client_id=fields["client_id"], crop=fields["crop"], lang=fields["lang"], captured_at=fields["captured_at"],
        quality=quality, classifier=classifier, verdict=verdict, context=context,
        advice=pick_advice(S.advice_pack, fields["lang"], verdict),
    )
    result["gradcam"] = await asyncio.to_thread(_gradcam, img, verdict)
    result = db.put(fields["client_id"], result)
    lat2 = round(fields["lat"], 2) if fields["lat"] is not None else None
    lon2 = round(fields["lon"], 2) if fields["lon"] is not None else None
    log.info("client_id=%s verdict=%s label=%s loc=%s,%s ms=%d", fields["client_id"], verdict["status"],
             verdict["label"], lat2, lon2, (time.perf_counter() - t0) * 1000)
    return result


# ---------- routes ----------

@app.get("/api/health")
def health():
    return {"ok": True, "model_version": S.model_meta.get("model_version", "unknown"),
            "contract_version": CONTRACT_VERSION, "fakes": S.using_fakes}


@app.post("/api/diagnose")
async def diagnose(request: Request):
    form = await request.form()
    fields = _parse_fields(dict(form))
    return await diagnose_one(fields, form.get("image"))


@app.post("/api/diagnose/batch")
async def diagnose_batch(request: Request):
    """Two accepted shapes:
    1. suffixed fields: image_0, client_id_0, crop_0, ... up to _9
    2. manifest: a JSON list of item fields, plus files named image_<client_id>
    """
    form = await request.form()
    items: list[tuple[dict, object]] = []
    if form.get("manifest"):
        try:
            manifest = json.loads(form["manifest"])
            assert isinstance(manifest, list)
        except (ValueError, AssertionError):
            _bad("manifest must be a JSON list")
        for m in manifest:
            m = {k: (json.dumps(v) if k == "soil_card" and isinstance(v, dict) else v) for k, v in m.items()}
            items.append((m, form.get(f"image_{m.get('client_id')}")))
    else:
        for i in range(MAX_BATCH + 1):
            if f"client_id_{i}" not in form:
                continue
            fields = {k[: -len(f"_{i}")]: v for k, v in form.items() if k.endswith(f"_{i}") and k != f"image_{i}"}
            items.append((fields, form.get(f"image_{i}")))
    if not items:
        _bad("no items in batch")
    if len(items) > MAX_BATCH:
        _bad(f"at most {MAX_BATCH} items per batch", 413)

    results = []
    for fields, upload in items:  # sequential: keeps memory flat on a free-tier box
        try:
            results.append(await diagnose_one(_parse_fields(fields), upload))
        except HTTPException as e:
            results.append({"client_id": str(fields.get("client_id", "")), "error": e.detail})
        except Exception as e:
            log.exception("batch item failed")
            results.append({"client_id": str(fields.get("client_id", "")), "error": f"server error: {type(e).__name__}"})
    return {"results": results}


@app.get("/api/advice-pack")
def advice_pack(lang: str = Query("en")):
    if lang not in LANGS:
        _bad("lang must be en, hi or mr")
    return S.advice_pack.get(lang) or S.advice_pack.get("en", {})


@app.get("/api/schemes")
def schemes(lang: str = Query("en")):
    if lang not in LANGS:
        _bad("lang must be en, hi or mr")
    return S.schemes.get(lang) or S.schemes.get("en", [])


@app.get("/api/climate")
async def climate(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    """This season's rain and temperature vs the 1991-2020 normal (the climate card). 503 if unavailable."""
    try:
        return await asyncio.wait_for(asyncio.to_thread(S.get_climate, lat, lon), CLIMATE_TIMEOUT_S)
    except Exception as e:
        log.warning("climate failed (%s): %s", type(e).__name__, e)
        raise HTTPException(status_code=503, detail="climate unavailable")


@app.get("/api/context")
async def context(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
                  crop: str = Query("tomato")):
    """Weather risk and soil for a place, without a photo. Used when a check was made with no location
    and the farmer picks a district afterwards. 503 if the weather service is down."""
    if crop not in CROPS:
        _bad("crop must be tomato or potato")
    try:
        return await asyncio.wait_for(asyncio.to_thread(S.get_context, lat, lon, crop, None), CONTEXT_TIMEOUT_S)
    except Exception as e:
        log.warning("context failed (%s): %s", type(e).__name__, e)
        raise HTTPException(status_code=503, detail="weather unavailable")


@app.get("/api/labels")
def labels():
    return {"model_version": S.model_meta.get("model_version"), "labels": S.model_meta.get("labels", [])}
