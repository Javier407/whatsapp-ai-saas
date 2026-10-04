"""ChromaDB retriever: queries the per-tenant vector collection.

Collection naming mirrors rag-indexer (``flow_engine.domain.embedding.collection_name``):
one collection per tenant *and* embedding model. The embedder must expose
``embed_query(text)`` and use the same model as the rag-indexer.
"""
from __future__ import annotations

import logging
from typing import Any, cast

import chromadb

from flow_engine.domain.embedding import DEFAULT_EMBEDDING_MODEL, collection_name
from flow_engine.domain.ports import IVectorStore

logger = logging.getLogger(__name__)


class ChromaRetriever(IVectorStore):
    def __init__(
        self,
        host: str,
        port: int,
        embedder: Any,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    ) -> None:
        self._client = chromadb.HttpClient(host=host, port=port)
        self._embedder = embedder
        self._embedding_model = embedding_model

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
        name = collection_name(tenant_id, self._embedding_model)
        try:
            collection = self._client.get_collection(name)
        except Exception:
            # Collection doesn't exist for this tenant/model yet (no KB indexed,
            # or documents still need `make reindex` after a model change)
            logger.debug(
                "No ChromaDB collection for tenant",
                extra={"tenant_id": tenant_id, "collection": name},
            )
            return []

        query_embedding: list[float] = self._embedder.embed_query(query_text)

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
