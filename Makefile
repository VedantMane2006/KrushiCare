PY ?= python3

.PHONY: check fixtures backend frontend install

# Contract checks (schemas, labels, i18n keys, citations) + all backend/ML tests.
check:
	$(PY) -m pytest

fixtures:
	$(PY) backend/tests/make_fixtures.py

install:
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm ci

backend:
	cd backend && $(PY) -m uvicorn main:app --reload --port 8000

frontend:
	cd frontend && npm run dev
