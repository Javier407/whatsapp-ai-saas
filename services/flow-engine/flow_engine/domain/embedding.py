"""Embedding-model identifiers and the per-model ChromaDB collection name.

rag-indexer writes vectors and flow-engine reads them, so both must derive the
collection name identically (rag_indexer.infrastructure.chroma_store).
"""
from __future__ import annotations

import hashlib

DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-small"

# Collections created before the multilingual switch hold MiniLM vectors under the
# bare ``tenant_<id>`` name, so rolling EMBEDDING_MODEL back reuses them.
LEGACY_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# Minimum top retrieval score for the RAG fallback to hand context to the LLM.
# Calibrated for multilingual-e5-small (override with RAG_FALLBACK_MIN_SCORE);
# scores depend on the model, so recalibrate it whenever EMBEDDING_MODEL changes.
DEFAULT_RAG_MIN_SCORE = 0.78


def collection_name(tenant_id: str, embedding_model: str = DEFAULT_EMBEDDING_MODEL) -> str:
    """``tenant_<id>_<sha1(model)[:8]>``: vectors of different models never mix."""
    base = f"tenant_{tenant_id.replace('-', '')}"
    if embedding_model == LEGACY_EMBEDDING_MODEL:
        return base
    suffix = hashlib.sha1(embedding_model.encode("utf-8")).hexdigest()[:8]  # noqa: S324
    return f"{base}_{suffix}"
