"""ChromaDB retriever: queries the per-tenant vector collection.

Collection naming mirrors rag-indexer: ``tenant_{tenantId_no_hyphens}``.
Embedder model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions).
"""
from __future__ import annotations

import logging
from typing import Any, cast

import chromadb

from flow_engine.domain.ports import IVectorStore

logger = logging.getLogger(__name__)


class ChromaRetriever(IVectorStore):
    def __init__(self, host: str, port: int, embedder: Any) -> None:
        self._client = chromadb.HttpClient(host=host, port=port)
        self._embedder = embedder  # same LocalEmbedder as rag-indexer

    def query(
        self,
        tenant_id: str,
        query_text: str,
        top_k: int = 5,
    ) -> list[tuple[str, float]]:
        """Return up to top_k (text, similarity_score) tuples.

        Similarity score is 1.0 - cosine_distance; higher is better.
        Returns [] if the collection doesn't exist yet (no KB indexed).
        """
        collection_name = f"tenant_{tenant_id.replace('-', '')}"
        try:
            collection = self._client.get_collection(collection_name)
        except Exception:
            # Collection doesn't exist for this tenant yet
            logger.debug(
                "No ChromaDB collection for tenant",
                extra={"tenant_id": tenant_id, "collection": collection_name},
            )
            return []

        query_embedding: list[float] = self._embedder.embed([query_text])[0]

        try:
            # chromadb's stubs demand ndarray / IncludeEnum types; plain
            # lists of floats and strings are accepted at runtime.
            results = collection.query(
                query_embeddings=cast("Any", [query_embedding]),
                n_results=min(top_k, 20),
                include=cast("Any", ["documents", "distances"]),
            )
        except Exception:
            logger.exception(
                "ChromaDB query failed",
                extra={"tenant_id": tenant_id},
            )
            return []

        document_rows = results.get("documents")
        distance_rows = results.get("distances")
        docs: list[str] = document_rows[0] if document_rows else []
        distances: list[float] = distance_rows[0] if distance_rows else []

        # Convert cosine distance [0, 2] to similarity score [0, 1]
        return [(doc, max(0.0, 1.0 - dist)) for doc, dist in zip(docs, distances)]
