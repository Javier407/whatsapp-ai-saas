"""Query-side embedder: loads the sentence-transformers model once at startup."""
from __future__ import annotations

from sentence_transformers import SentenceTransformer


def query_prefix(model_name: str) -> str:
    """E5 models embed documents as ``passage: ...`` (rag-indexer) and user
    queries as ``query: ...``; omitting the prefix degrades retrieval quality."""
    return "query: " if "e5" in model_name.lower() else ""


class QueryEmbedder:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._prefix = query_prefix(model_name)
        self._model = SentenceTransformer(model_name)

    def embed_query(self, text: str) -> list[float]:
        vector = self._model.encode(
            [f"{self._prefix}{text}"],
            show_progress_bar=False,
            normalize_embeddings=True,
        )[0]
        return [float(x) for x in vector]
