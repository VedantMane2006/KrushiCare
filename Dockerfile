# Backend image for Render/Railway. Build from the repo root: docker build -t agrisense-api .
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AGRISENSE_ROOT=/app DB_PATH=/data/agrisense.db
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY shared shared
COPY content content
COPY ml/__init__.py ml/__init__.py
COPY ml/export ml/export
COPY ml/runtime ml/runtime
COPY services services
COPY backend backend
RUN mkdir -p /data
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
