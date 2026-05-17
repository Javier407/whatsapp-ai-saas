FROM python:3.12-slim AS base
WORKDIR /app

# System deps: gcc for psycopg2-binary native extensions, libpq-dev for Postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- builder stage --------------------------------------------------------
FROM base AS builder

COPY pyproject.toml .
# Install uv and use it to install all project deps (including dev extras)
RUN pip install --no-cache-dir uv \
    && uv pip install --system -e ".[dev]"

# ---- runtime stage --------------------------------------------------------
FROM base AS runtime

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source
COPY flow_engine/ ./flow_engine/

# Non-root user for security
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# sentence-transformers model cache — mount a volume in production
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers

# FastAPI admin API on 8001; consumer runs in a daemon thread
EXPOSE 8001

CMD ["python", "-m", "flow_engine.main"]
