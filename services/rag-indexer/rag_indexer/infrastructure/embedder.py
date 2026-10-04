"""Local sentence-transformers embedder: loads model once at startup."""
from __future__ import annotations

import logging
import os

from sentence_transformers import SentenceTransformer

from rag_indexer.application.index_document import IEmbedder
from rag_indexer.domain.embedding import DEFAULT_EMBEDDING_MODEL

logger = logging.getLogger(__name__)


def embedding_model_name() -> str:
    """Model configured through EMBEDDING_MODEL (shared with flow-engine)."""
    return os.environ.get("EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL


def passage_prefix(model_name: str) -> str:
    """E5 models are trained with asymmetric prefixes: documents are embedded as
    ``passage: <text>`` and queries as ``query: <text>`` (flow-engine side).
    Omitting them silently degrades retrieval quality."""
    return "passage: " if "e5" in model_name.lower() else ""


class LocalEmbedder(IEmbedder):
    """Wraps a multilingual sentence-transformers model (default multilingual-e5-small).

    The model (~470 MB, baked into the image) is loaded ONCE at construction time.
    Never instantiate per job — inject this as a singleton dependency.
    """

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or embedding_model_name()
        self._prefix = passage_prefix(self.model_name)
        logger.info("Loading embedding model", extra={"model": self.model_name})
        self._model = SentenceTransformer(self.model_name)
        logger.info("Embedding model loaded", extra={"model": self.model_name})

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Encode document *texts* in batches and return a list of float vectors.

        Args:
            texts: Non-empty list of strings to embed.

        Returns:
            List of L2-normalised embedding vectors, one per input text.
        """
        if not texts:
            return []
        vectors = self._model.encode(
            [f"{self._prefix}{t}" for t in texts],
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return [v.tolist() for v in vectors]
