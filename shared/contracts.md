# AgriSense contracts (v1)

Owner: Saad. Change anything in `shared/` only with a team announcement. `make check` must pass before every handoff.

## Endpoints (backend, FastAPI)

| Method | Path | Input | Output |
|---|---|---|---|
| POST | `/api/diagnose` | multipart: `image` (jpeg/png, max 8 MB), `client_id` (uuid), `crop` (`tomato`/`potato`), `lang` (`en`/`hi`/`mr`), `lat`, `lon` (optional), `captured_at` (ISO), optional `soil_card` (JSON string `{ph,n,p,k,oc}`), optional `device_result` (JSON string, ignored by the server: the server result replaces it) | `DiagnosisResult` |
| POST | `/api/diagnose/batch` | multipart, up to 10 items: fields suffixed `_0`…`_9` (`image_0`, `client_id_0`, …), **or** `manifest` (JSON list of item fields) plus files `image_<client_id>` | `{"results": [DiagnosisResult or {"client_id", "error"}]}` |
| GET | `/api/advice-pack?lang=hi` | | `advice_pack.json["hi"]` (falls back to `en`) |
| GET | `/api/schemes?lang=hi` | | `schemes.json["hi"]` |
| GET | `/api/health` | | `{"ok": true, "model_version": "v1", "contract_version": 1, "fakes": []}` |
| GET | `/api/labels` | | `{"model_version", "labels"}` from `model_meta.json` |
| POST | `/api/whatsapp` | Twilio webhook | TwiML (stretch) |

Errors: HTTP 400 for bad fields or a non-image, 413 for an image over 8 MB or more than 10 batch items. `client_id` is idempotent: the same id always returns the first stored result, so retries are safe.

## DiagnosisResult

Schema: `shared/schemas/diagnosis_result.schema.json`. Examples: `shared/fixtures/` (one per verdict status plus `weather_not_assessed`).

- `verdict.status`: `likely` | `uncertain` | `retake` | `unsupported`; `confidence`: `high` | `medium` | `low` | `null`.
- `quality.reason_key`: an i18n key, `quality.too_blurry` | `quality.too_dark` | `quality.too_bright` | `quality.no_leaf`, or `null` when ok.
- `classifier` is `null` when quality fails.
- `weather_risk.level`: `high` | `medium` | `low` | `not_assessed` (no location or the weather call failed; then `days` is `[]`).
- `soil.irrigation_key`: `wait_for_rain` | `consider_irrigating` | `no_action` | `unknown`. `soil.flags` are i18n suffixes for `soil.flag.*` (e.g. `ph_low`).
- Optional extras: `source` (`server` | `device`), `captured_at`.

## Verdict rules (backend/app/verdict.py, copied in frontend/src/lib/verdict.ts)

Thresholds from `ml/export/thresholds.json` (defaults: `unknown_photo` 0.45, `likely_high` 0.7, `likely_high_margin` 0.3, `likely_medium` 0.5). `margin = top1 - top2`. A value exactly on a threshold counts as reaching it.

1. Quality not ok → `retake`, model skipped.
2. top1 prob < `unknown_photo` → `unsupported`, label `null`, confidence `null`.
3. top1 label's crop (prefix before `__`) ≠ chosen crop → `uncertain`, `low`.
4. top1 ≥ `likely_high` and margin ≥ `likely_high_margin` → `likely`, `high`.
5. top1 ≥ `likely_medium` → `likely`, `medium`.
6. Otherwise → `uncertain`, `low` (app shows top 3 and the KCC button).

Advice: `advice_pack[lang][label]` for `likely`, else `[lang]["uncertain"]` / `[lang]["unsupported"]`; falls back to `en`.

## Building blocks (function or file with a fixed shape)

| Block | Interface | Owner |
|---|---|---|
| `ml/runtime/predict.py` | `predict(image: PIL.Image) -> {"model_version", "top3": [{"label", "prob"}], "margin"}` (a `Predictor` class with `.predict` also works) | Vedant |
| `ml/runtime/quality.py` | `check(image: PIL.Image) -> {"ok", "blur", "brightness", "leaf_ratio", "reason_key"}` | Vedant |
| `ml/runtime/predict.ts` | `predict(file: Blob): Promise<same as predict.py>` | Vedant |
| `services/context.py` | `get_context(lat, lon, crop, soil_card=None) -> {"weather_risk", "soil"}` in the exact result shape. Rules: `shared/context_rules.md` | Krisha |
| `ml/export/model.onnx`, `model_int8.onnx`, `model_meta.json` | input `[1,3,224,224]`, output probs `[1,13]`, calibration built in. Schema `model_meta.schema.json` | Krisha |
| `ml/export/thresholds.json` | schema `thresholds.schema.json` | Krisha |
| `shared/labels.json` | 13 label ids, fixed order, never reordered | Krisha |
| `content/advice_pack.json` | `{lang: {label_id/uncertain/unsupported: {summary, steps:[{text, citation_id}], citations:[{id,title,url}]}}}` | Vedant |
| `content/schemes.json` | `{lang: [{id, name, benefit, eligibility[], documents[], official_url, last_checked}]}` | Vedant |
| `content/i18n/{en,hi,mr}.json` | flat key → string, exactly the keys of `shared/i18n_keys.json` (that file holds the English draft text) | Vedant |

Label ids everywhere; display names only via `label.<id>` i18n keys. Interpolation uses `{{name}}`, e.g. `result.likely_high` = "This looks like {{disease}}".

## `make check`

Validates every file above against its schema, confirms all 13 labels + `uncertain` + `unsupported` in each language of the advice pack, every step `citation_id` exists, i18n files match `i18n_keys.json` exactly, `model_meta.json` labels equal `labels.json`, then runs `pytest` over `ml/runtime/tests`, `services/tests`, `backend/tests`. Runs in GitHub Actions on every push.

## Handoffs

| Hour | From → To | What |
|---|---|---|
| H0.5 | Krisha → all | `labels.json` |
| H1 | Saad → all | this file, schemas, fixtures, `i18n_keys.json`, `make check`, `context_rules.md` |
| H1 | Krisha → Vedant | stub `model.onnx`, `model_meta.json`, parity images |
| H1.5 | Vedant → Saad | stub `predict.py`, `quality.py`, stub content |
| H1.5 | Krisha → Saad | stub `context.py` |
| H2.5 | Vedant → Saad | real `predict.py` and `quality.py` (parity on stub model) |
| H3 / H5 | Krisha | model v0 / v1 (calibrated) |
| H4 | Krisha → Saad | real `context.py` with tests |
| H5.5 | Saad → Vedant | final `i18n_keys.json` |
| H6 | Krisha | `thresholds.json`, quality thresholds |
| H6.5 / H7.5 | Vedant | real advice + schemes / full i18n |
| H8 | Vedant | `predict.ts` passing parity |
| H9 | Krisha / both | `model_int8.onnx` / 10 demo photos |
| H10 | Saad → both | deployed URL and screenshots |

Stubs for every block are already in the repo (marked `STUB` / `[stub]`), so the app runs end to end today. Replace them in place; no app change is needed.
