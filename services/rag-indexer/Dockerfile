FROM python:3.12-slim AS base
WORKDIR /app

# System deps: gcc for psycopg2-binary native extensions, libpq-dev for Postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- builder stage --------------------------------------------------------
FROM base AS builder

RUN pip install --no-cache-dir uv

# CPU-only torch first: a plain PyPI resolve would pull the CUDA build
# (several GB) through the sentence-transformers dependency
RUN uv pip install --system torch --index-url https://download.pytorch.org/whl/cpu

# Dependencies in their own layer so source edits don't re-resolve them
COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml

# Project itself, non-editable; dev extras stay out of the runtime image
COPY rag_indexer/ ./rag_indexer/
RUN uv pip install --system --no-deps .

# ---- runtime stage --------------------------------------------------------
FROM base AS runtime

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Non-root user; must own the model cache so sentence-transformers can
# download all-MiniLM-L6-v2 at first use
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/.cache/sentence_transformers \
    && chown -R appuser:appuser /app/.cache
USER appuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# sentence-transformers model cache — mount a volume in production
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers

CMD ["python", "-m", "rag_indexer.main"]
