# AgriSense contracts (v1)

Owner: Saad. Change this file, `backend/knowledge_base/schemas/`, `backend/tests/fixtures/` or `frontend/src/i18n/keys.json` only with a team announcement. `make check` must pass before every handoff.

## Endpoints (backend, FastAPI)

| Method | Path | Input | Output |
|---|---|---|---|
| POST | `/api/diagnose` | multipart: `image` (jpeg/png, max 8 MB), `client_id` (uuid), `crop` (`tomato`/`potato`), `lang` (`en`/`hi`/`mr`), `lat`, `lon` (optional), `captured_at` (ISO), optional `soil_card` (JSON string `{ph,n,p,k,oc}`), optional `device_result` (JSON string, ignored by the server: the server result replaces it) | `DiagnosisResult` |
| POST | `/api/diagnose/batch` | multipart, up to 10 items: fields suffixed `_0`…`_9` (`image_0`, `client_id_0`, …), **or** `manifest` (JSON list of item fields) plus files `image_<client_id>` | `{"results": [DiagnosisResult or {"client_id", "error"}]}` |
| GET | `/api/advice-pack?lang=hi` | | `advice_pack.json["hi"]` (falls back to `en`) |
| GET | `/api/schemes?lang=hi` | | `schemes.json["hi"]` |
| GET | `/api/health` | | `{"ok": true, "model_version": "v1", "contract_version": 1, "fakes": []}` |
| GET | `/api/context?lat=..&lon=..&crop=..` | | weather risk and soil for a place without a photo (`{"weather_risk", "soil"}`); used when a check had no location and the farmer picks a district afterwards; 503 if weather is down |
| GET | `/api/climate?lat=..&lon=..` | | climate card: this season so far vs the 1991-2020 normal for the same dates (schema `climate.schema.json`); 503 if unavailable |
| POST | `/api/whatsapp` | Twilio form fields (`From`, `Body`, `NumMedia`, `MediaUrl0`, `MediaContentType0`, `Latitude`, `Longitude`, `MessageSid`) | WhatsApp bot webhook, replies with TwiML text: a photo gets the diagnosis, advice, blight risk and KCC; "tomato"/"potato" and "english"/"hindi"/"marathi" set preferences; a shared location turns on weather. Signature checked when `TWILIO_AUTH_TOKEN` is set. Reply text uses the `wa.*`, `label.*`, `result.*`, `risk.*`, `soil.*` i18n keys |
| GET | `/api/labels` | | `{"model_version", "labels"}` from `model_meta.json` |
| POST | `/api/whatsapp` | Twilio webhook | TwiML (stretch) |

Errors: HTTP 400 for bad fields or a non-image, 413 for an image over 8 MB or more than 10 batch items. `client_id` is idempotent: the same id always returns the first stored result, so retries are safe.

## DiagnosisResult

Schema: `backend/knowledge_base/schemas/diagnosis_result.schema.json`. Examples: `backend/tests/fixtures/` (one per verdict status plus `weather_not_assessed`).

- `verdict.status`: `likely` | `uncertain` | `retake` | `unsupported`; `confidence`: `high` | `medium` | `low` | `null`.
- `quality.reason_key`: an i18n key, `quality.too_blurry` | `quality.too_dark` | `quality.too_bright` | `quality.no_leaf`, or `null` when ok.
- `classifier` is `null` when quality fails.
- `weather_risk.level`: `high` | `medium` | `low` | `not_assessed` (no location or the weather call failed; then `days` is `[]`).
- `soil.irrigation_key`: `wait_for_rain` | `consider_irrigating` | `no_action` | `unknown`. `soil.flags` are i18n suffixes for `soil.flag.*` (e.g. `ph_low`).
- Optional extras: `source` (`server` | `device`), `captured_at`, `gradcam` (`null` or `{"method": "gradcam" | "demo", "label", "image": "data:image/jpeg;base64,..."}`, only for a `likely` non-healthy verdict).

## Verdict rules (backend/services/verdict.py, copied in frontend/src/services/verdict.ts)

Thresholds from `ml/models/thresholds.json` (defaults: `unknown_photo` 0.45, `likely_high` 0.7, `likely_high_margin` 0.3, `likely_medium` 0.5). `margin = top1 - top2`. A value exactly on a threshold counts as reaching it.

1. Quality not ok → `retake`, model skipped.
2. top1 prob < `unknown_photo` → `unsupported`, label `null`, confidence `null`.
3. top1 label's crop (prefix before `__`) ≠ chosen crop → `uncertain`, `low`.
4. top1 ≥ `likely_high` and margin ≥ `likely_high_margin` → `likely`, `high`.
5. top1 ≥ `likely_medium` → `likely`, `medium`.
6. Otherwise → `uncertain`, `low` (app shows top 3 and the KCC button).

Advice: `advice_pack[lang][label]` for `likely`, else `[lang]["uncertain"]` / `[lang]["unsupported"]`; falls back to `en`.

## Building blocks (function or file with a fixed shape)

The repo layout wins over the paths in the plan and briefs. Where a brief says `ml/runtime/`, `ml/export/`, `services/`, `content/` or `shared/`, use the path in this table.

| Block | Interface | Owner |
|---|---|---|
| `ml/inference/predict.py` | `predict(image: PIL.Image) -> {"model_version", "top3": [{"label", "prob"}], "margin"}` (a `Predictor` class with `.predict` also works) | Vedant |
| `ml/preprocessing/quality.py` | `check(image: PIL.Image) -> {"ok", "blur", "brightness", "leaf_ratio", "reason_key"}` | Vedant |
| `ml/inference/predict.ts` | `predict(file: Blob): Promise<same as predict.py>`; throw when no model (the stub does), and the app just queues the photo. Imported by `frontend/src/services/onDevice.ts` | Vedant |
| `backend/services/climate.py` | `get_climate(lat, lon)` for the climate card (Open-Meteo ERA5 archive vs the 1991-2020 normal), tests in `backend/tests/test_climate.py` | Saad |
| `backend/services/context.py` | `get_context(lat, lon, crop, soil_card=None) -> {"weather_risk", "soil"}` in the exact result shape. Rules: `backend/services/CONTEXT_RULES.md` | Krisha |
| `ml/models/model.onnx`, `model_int8.onnx`, `model_meta.json` | input `[1,3,224,224]`, output probs `[1,13]`, calibration built in. Schema `model_meta.schema.json` | Krisha |
| `ml/models/thresholds.json` | schema `thresholds.schema.json` | Krisha |
| `ml/inference/gradcam.py` (Grad-CAM, optional) | numpy Grad-CAM, no PyTorch on the server. Krisha: add a second ONNX output `features` = `model.features(x)` `[1,960,7,7]`, and save the head as `ml/models/head.npz` (`W1,b1` = `classifier[0]`, `W2,b2` = `classifier[3]`). Vedant: add `explain(image, label) -> np.ndarray` to `predict.py`: run the model, take `features[0]`, return `gradcam(features, load_head(), labels.index(label))`. Until `explain` exists the API sends a demo map marked `method: "demo"` | Krisha, Vedant |
| `ml/models/labels.json` | 13 label ids, fixed order, never reordered | Krisha |
| `backend/knowledge_base/advice_pack.json` | `{lang: {label_id/uncertain/unsupported: {summary, steps:[{text, citation_id}], citations:[{id,title,url}]}}}` | Vedant |
| `backend/knowledge_base/schemes.json` | `{lang: [{id, name, benefit, eligibility[], documents[], official_url, last_checked}]}` | Vedant |
| `frontend/src/i18n/{en,hi,mr}.json` | flat key → string, exactly the keys of `frontend/src/i18n/keys.json` (that file holds the English draft text) | Vedant |

Label ids everywhere; display names only via `label.<id>` i18n keys. Interpolation uses `{{name}}`, e.g. `result.likely_high` = "This looks like {{disease}}".

## `make check`

Runs `pytest` (config in `pytest.ini`). `backend/tests/test_contracts.py` validates every file above against its schema, confirms all 13 labels + `uncertain` + `unsupported` in each language of the advice pack, every step `citation_id` exists, i18n files match `i18n_keys.json` exactly, `model_meta.json` labels equal `labels.json`, and the rest of `backend/tests` covers the API, verdict rules and the ML/context stubs. Runs in GitHub Actions on every push.

## Handoffs

| Hour | From → To | What |
|---|---|---|
| H0.5 | Krisha → all | `labels.json` |
| H1 | Saad → all | this file, schemas, fixtures, `i18n/keys.json`, `make check`, `CONTEXT_RULES.md` |
| H1 | Krisha → Vedant | stub `model.onnx`, `model_meta.json`, parity images |
| H1.5 | Vedant → Saad | stub `predict.py`, `quality.py`, stub content |
| H1.5 | Krisha → Saad | stub `context.py` |
| H2.5 | Vedant → Saad | real `predict.py` and `quality.py` (parity on stub model) |
| H3 / H5 | Krisha | model v0 / v1 (calibrated) |
| H4 | Krisha → Saad | real `context.py` with tests |
| H5.5 | Saad → Vedant | final `frontend/src/i18n/keys.json` |
| H6 | Krisha | `thresholds.json`, quality thresholds |
| H6.5 / H7.5 | Vedant | real advice + schemes / full i18n |
| H8 | Vedant | `predict.ts` passing parity |
| H9 | Krisha / both | `model_int8.onnx` / 10 demo photos |
| H10 | Saad → both | deployed URL and screenshots |

Stubs for every block are already in the repo (marked `STUB` / `[stub]`), so the app runs end to end today. Replace them in place; no app change is needed.
