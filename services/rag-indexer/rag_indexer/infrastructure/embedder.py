"""Local sentence-transformers embedder: loads model once at startup."""
from __future__ import annotations

import logging

from sentence_transformers import SentenceTransformer

from rag_indexer.application.index_document import IEmbedder

logger = logging.getLogger(__name__)


class LocalEmbedder(IEmbedder):
    """Wraps sentence-transformers all-MiniLM-L6-v2.

    The model (~90 MB) is loaded ONCE at construction time.
    Never instantiate per job — inject this as a singleton dependency.
    """

    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

    def __init__(self) -> None:
        logger.info("Loading embedding model", extra={"model": self.MODEL_NAME})
        self._model = SentenceTransformer(self.MODEL_NAME)
        logger.info("Embedding model loaded", extra={"model": self.MODEL_NAME})

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Encode *texts* in batches and return a list of float vectors.

        Args:
            texts: Non-empty list of strings to embed.

        Returns:
            List of embedding vectors, one per input text.
        """
        if not texts:
            return []
        vectors = self._model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]
