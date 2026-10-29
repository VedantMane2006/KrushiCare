# KrushiCare (AgriSense)

A mobile-first web app (PWA) where a farmer photographs a tomato or potato leaf and gets a diagnosis with an honest confidence level, a 3-day late-blight risk for their location, soil moisture with an irrigation hint, cited next steps in English, Hindi or Marathi, government scheme cards and the Kisan Call Centre number. Photos taken offline are queued on the phone and synced in a batch later.

**Start here:** [`shared/contracts.md`](shared/contracts.md) (endpoints, response shape, verdict rules, who owns what, handoff times).

## Layout and owners

| Path | What | Owner |
|---|---|---|
| `shared/` | contracts, JSON schemas, fixtures, `i18n_keys.json`, `labels.json`, `context_rules.md` | Saad (labels: Krisha) |
| `ml/` (`export/`, training, eval) | model, `model_meta.json`, `thresholds.json` | Krisha |
| `ml/runtime/` | `predict.py`, `quality.py`, `predict.ts` | Vedant |
| `services/context.py` | weather / soil / blight risk | Krisha |
| `content/` | `advice_pack.json`, `schemes.json`, `i18n/{en,hi,mr}.json` | Vedant |
| `backend/` | FastAPI app (`app/main.py`, `app/verdict.py`, `app/db.py`) + tests | Saad |
| `frontend/` | Vite + React + TS PWA | Saad |

Only the owner edits a folder. Every teammate block currently exists as a **stub** with the right shape (marked `STUB` / `[stub]`), so the whole app runs today. Replace stubs in place; no app change is needed.

## Run locally

Python 3.11 and Node 20.

```bash
# backend (http://localhost:8000, docs at /docs)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --reload --port 8000

# frontend (http://localhost:5173, proxies /api to :8000)
cd frontend && npm install && npm run dev
```

- `USE_FAKES=1` on the backend uses `backend/app/fakes.py` instead of the teammates' modules (it also falls back automatically if one fails to import; `/api/health` lists which fakes are active).
- `VITE_USE_FIXTURES=1 npm run dev` runs the frontend with no backend, answering from `shared/fixtures/` (add `?fixture=retake` etc. to the URL to pick one).
- To test on a phone over your LAN, `npm run dev` already listens on all interfaces; camera and GPS need HTTPS outside localhost, so use the deployed URL for real phone tests.

## Checks

```bash
make check      # validates every JSON file against its schema, cross-checks labels / i18n keys / citations, runs pytest
cd frontend && npm test && npm run build
```

GitHub Actions runs both on every push (`.github/workflows/check.yml`). Nobody hands off until `make check` is green.

## Deploy

- **Backend:** Render (free) with the root `Dockerfile` (`render.yaml` included), or `uvicorn app.main:app --host 0.0.0.0 --port $PORT` from `backend/`. Set `ALLOWED_ORIGINS` to the Vercel URL (any `*.vercel.app` is allowed by default).
- **Frontend:** Vercel, root directory `frontend`, env `VITE_API_URL=https://<backend>.onrender.com`. `vercel.json` handles SPA routes.
- Free hosts sleep; the app pings `/api/health` on open and shows a "starting the server" message after 5 s.

## How offline works

Every photo is saved to IndexedDB (Dexie `checks` table) with a `client_id` from `crypto.randomUUID()` before anything is sent. If the upload fails for network reasons the check stays `pending`; the app sends pending checks via `/api/diagnose/batch` in groups of 5 on app open, on the `online` event and on "Send now", with per-item backoff (2, 4, 8, 16 s) and gives up after 5 tries. The server stores results by `client_id`, so retries never duplicate. The service worker precaches the app shell and serves `/api/advice-pack` and `/api/schemes` stale-while-revalidate.
