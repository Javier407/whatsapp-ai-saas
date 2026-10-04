FROM python:3.12-slim AS base
WORKDIR /app

# System deps: gcc for psycopg2-binary native extensions, libpq-dev for Postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- deps stage -----------------------------------------------------------
FROM base AS deps

RUN pip install --no-cache-dir uv

# CPU-only torch first: a plain PyPI resolve would pull the CUDA build
# (several GB) through the sentence-transformers dependency
RUN uv pip install --system torch --index-url https://download.pytorch.org/whl/cpu

# Dependencies in their own layer so source edits don't re-resolve them
COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml

# ---- model stage ----------------------------------------------------------
# Embedding model (~470 MB) downloaded at build time so containers start offline
# and fast. Its own stage, derived from deps only, so source edits never trigger
# the download again. EMBEDDING_MODEL must match the runtime value (compose passes both).
FROM deps AS model
ARG EMBEDDING_MODEL=intfloat/multilingual-e5-small
ENV EMBEDDING_MODEL=${EMBEDDING_MODEL} \
    SENTENCE_TRANSFORMERS_HOME=/models/sentence_transformers \
    HF_HOME=/models/huggingface
# Retried: a dropped connection to the Hugging Face CDN otherwise fails the build.
RUN for i in 1 2 3; do \
      python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ['EMBEDDING_MODEL'])" && exit 0; \
      sleep 10; \
    done; exit 1

# ---- builder stage --------------------------------------------------------
FROM deps AS builder

# Project itself, non-editable; dev extras stay out of the runtime image
COPY flow_engine/ ./flow_engine/
RUN uv pip install --system --no-deps .

# ---- runtime stage --------------------------------------------------------
FROM base AS runtime

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Non-root user; owns the model cache
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/.cache \
    && chown appuser:appuser /app/.cache
COPY --from=model --chown=appuser:appuser /models/ /app/.cache/
USER appuser

ARG EMBEDDING_MODEL=intfloat/multilingual-e5-small
ENV EMBEDDING_MODEL=${EMBEDDING_MODEL} \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers \
    HF_HOME=/app/.cache/huggingface \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# FastAPI admin API on 8001; consumer runs in a daemon thread
EXPOSE 8001

CMD ["python", "-m", "flow_engine.main"]
