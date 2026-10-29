PY ?= python3

.PHONY: check fixtures backend frontend install

check:
	$(PY) scripts/check.py

fixtures:
	$(PY) scripts/make_fixtures.py

install:
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm ci

backend:
	cd backend && $(PY) -m uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev
