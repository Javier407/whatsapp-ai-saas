"""ChromaDB adapter: implements IVectorStore with one collection per tenant."""
from __future__ import annotations

import hashlib
import logging
from typing import Any, cast

import chromadb

from rag_indexer.domain.embedding import DEFAULT_EMBEDDING_MODEL, LEGACY_EMBEDDING_MODEL
from rag_indexer.domain.models import DocumentChunk
from rag_indexer.domain.ports import IVectorStore

logger = logging.getLogger(__name__)


def _collection_name(tenant_id: str, embedding_model: str = DEFAULT_EMBEDDING_MODEL) -> str:
    """Convert a tenant UUID + embedding model to a valid ChromaDB collection name.

    ChromaDB collection names must match [a-zA-Z0-9_-]{3,63} and cannot
    contain hyphens at start/end or consecutive hyphens.
    We strip hyphens entirely to stay safe with UUID-formatted tenant IDs.

    Vectors from different models are not comparable, so each model gets its own
    collection (``tenant_<id>_<sha1(model)[:8]>``); a model change can never mix
    incompatible vectors. flow-engine derives the name with the same function.
    The legacy MiniLM model keeps the bare name, so rolling EMBEDDING_MODEL back
    reuses the old collection instead of needing a reindex.
    """
    base = f"tenant_{tenant_id.replace('-', '')}"
    if embedding_model == LEGACY_EMBEDDING_MODEL:
        return base
    suffix = hashlib.sha1(embedding_model.encode("utf-8")).hexdigest()[:8]  # noqa: S324
    return f"{base}_{suffix}"


class ChromaVectorStore(IVectorStore):
    """Stores and retrieves document chunk embeddings via ChromaDB HTTP API."""

    def __init__(
        self,
        host: str,
        port: int,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    ) -> None:
        self._client = chromadb.HttpClient(host=host, port=port)
        self._embedding_model = embedding_model

    def upsert(self, tenant_id: str, chunks: list[DocumentChunk]) -> None:
        """Upsert all chunks into the tenant's ChromaDB collection."""
        if not chunks:
            return

        collection_name = _collection_name(tenant_id, self._embedding_model)
        collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        collection.upsert(
            ids=[c.id for c in chunks],
            # chromadb's stubs demand ndarray types; a list of float lists is
            # accepted at runtime.
            embeddings=cast(Any, [c.embedding for c in chunks]),
            documents=[c.text for c in chunks],
            metadatas=[
                {
                    "tenant_id": c.tenant_id,
                    "document_id": c.document_id,
                    "document_name": c.document_name,
                    "chunk_index": c.chunk_index,
                }
                for c in chunks
            ],
        )
        logger.info(
            "ChromaDB upsert complete",
            extra={"collection": collection_name, "chunk_count": len(chunks)},
        )

    def delete_by_document(self, tenant_id: str, document_id: str) -> None:
        """Delete all chunks belonging to *document_id* from the tenant collection."""
        collection_name = _collection_name(tenant_id, self._embedding_model)
        try:
            collection = self._client.get_collection(collection_name)
            collection.delete(where={"document_id": document_id})
            logger.info(
                "ChromaDB delete complete",
                extra={"collection": collection_name, "document_id": document_id},
            )
        except Exception:
            # Collection may not exist yet — that is fine
            logger.debug(
                "ChromaDB delete skipped (collection not found)",
                extra={"collection": collection_name},
            )
