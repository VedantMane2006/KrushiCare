# Backend image for Render/Railway. Build from the repo root: docker build -t agrisense-api .
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AGRISENSE_ROOT=/app DB_PATH=/data/agrisense.db
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY ml/models ml/models
COPY ml/inference ml/inference
COPY ml/preprocessing ml/preprocessing
COPY ml/runtime ml/runtime
COPY backend backend
COPY frontend/src/i18n frontend/src/i18n
RUN mkdir -p /data
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
