# ---- Stage 1: frontend static export ----
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# ---- Stage 2: backend + static files ----
FROM python:3.14-slim

# uv's static binary, pinned to match the local dev version
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /uvx /usr/local/bin/

WORKDIR /app

# deps first, alone, so Docker layer-caches the install when only app code changes
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/app ./app
COPY --from=frontend-builder /app/out ./app/static

# Directory for the SQLite file. Mount a volume here (-v ./data:/app/data) to
# persist sessions across container recreations; without it, each `docker run`
# starts from a fresh empty database.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
