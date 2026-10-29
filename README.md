# KrushiCare (AgriSense)

A mobile-first web app (PWA) where a farmer photographs a tomato or potato leaf and gets a diagnosis with an honest confidence level, a 3-day late-blight risk for their location, soil moisture with an irrigation hint, cited next steps in English, Hindi or Marathi, government scheme cards and the Kisan Call Centre number. Photos taken offline are queued on the phone and synced in a batch later.

**Start here:** [`CONTRACTS.md`](CONTRACTS.md) (endpoints, response shape, verdict rules, who owns what, handoff times).

## Layout and owners

| Path | What | Owner |
|---|---|---|
| `CONTRACTS.md` | the team contract | Saad |
| `ml/training/`, `ml/evaluation/` | training notebooks, eval charts | Krisha |
| `ml/models/` | `labels.json`, `model.onnx`, `model_int8.onnx`, `model_meta.json`, `thresholds.json` | Krisha |
| `ml/inference/` | `predict.py`, `predict.ts` | Vedant |
| `ml/preprocessing/` | `quality.py` (photo quality check) | Vedant |
| `backend/services/context.py` | weather, soil and blight risk (rules in `CONTEXT_RULES.md` next to it) | Krisha |
| `backend/knowledge_base/` | `advice_pack.json`, `schemes.json`, and `schemas/` for every JSON file | Vedant (schemas: Saad) |
| `frontend/src/i18n/` | `en.json`, `hi.json`, `mr.json` (UI strings) and `keys.json` (agreed key list) | Vedant (keys: Saad) |
| `backend/main.py`, `services/verdict.py`, `database/`, `tests/` | FastAPI app, verdict rules, SQLite store, tests and response fixtures | Saad |
| `frontend/` | Vite + React + TS PWA (`pages/`, `components/`, `services/`, `hooks/`, `i18n/`) | Saad |

Only the owner edits a file. Every teammate block exists at least as a **stub** with the right shape (marked `STUB` / `[stub]`), so the whole app runs today. `backend/services/context.py` is already live (Open-Meteo, rules in `CONTEXT_RULES.md`). Replace stubs in place; no app change is needed.

## Run locally

Python 3.11 and Node 20.

```bash
# backend (http://localhost:8000, docs at /docs)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend && uvicorn main:app --reload --port 8000

# frontend (http://localhost:5173, proxies /api to :8000)
cd frontend && npm install && npm run dev
```

- `USE_FAKES=1` on the backend uses `backend/services/fakes.py` instead of the teammates' modules (it also falls back automatically if one fails to import; `/api/health` lists which fakes are active).
- `VITE_USE_FIXTURES=1 npm run dev` runs the frontend with no backend, answering from `backend/tests/fixtures/` (add `?fixture=retake` etc. to the URL to pick one).
- To test on a phone over your LAN, `npm run dev` already listens on all interfaces; camera and GPS need HTTPS outside localhost, so use the deployed URL for real phone tests.

## Checks

```bash
make check      # pytest: validates every JSON file against its schema, cross-checks labels / i18n keys / citations, API + verdict tests
cd frontend && npm test && npm run build
```

GitHub Actions runs both on every push (`.github/workflows/check.yml`). Nobody hands off until `make check` is green.

## Deploy

- **Backend:** Render (free) with the root `Dockerfile` (`render.yaml` included), or `uvicorn main:app --host 0.0.0.0 --port $PORT` from `backend/`. Set `ALLOWED_ORIGINS` to the Vercel URL (any `*.vercel.app` is allowed by default).
- **Frontend:** Vercel, root directory `frontend`, env `VITE_API_URL=https://<backend>.onrender.com`. `vercel.json` handles SPA routes.
- Free hosts sleep; the app pings `/api/health` on open and shows a "starting the server" message after 5 s.

## How offline works

Every photo is saved to IndexedDB (Dexie `checks` table) with a `client_id` from `crypto.randomUUID()` before anything is sent. If the upload fails for network reasons the check stays `pending`; the app sends pending checks via `/api/diagnose/batch` in groups of 5 on app open, on the `online` event and on "Send now", with per-item backoff (2, 4, 8, 16 s) and gives up after 5 tries. The server stores results by `client_id`, so retries never duplicate. The service worker precaches the app shell and serves `/api/advice-pack` and `/api/schemes` stale-while-revalidate.
