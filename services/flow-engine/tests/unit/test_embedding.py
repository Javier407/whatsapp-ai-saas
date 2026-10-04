"""Query-side embedding: E5 prefix, per-model collection name, retriever wiring."""
from __future__ import annotations

from typing import Any

import numpy as np
import pytest

from flow_engine.domain.embedding import (
    DEFAULT_EMBEDDING_MODEL,
    LEGACY_EMBEDDING_MODEL,
    collection_name,
)

# Same literal is asserted in rag-indexer's tests/unit/test_embedding_model.py.
TENANT = "11111111-2222-3333-4444-555555555555"
TENANT_NO_HYPHENS = "11111111222233334444555555555555"
E5_SUFFIX = "30b1cd54"  # sha1("intfloat/multilingual-e5-small")[:8]


class TestCollectionName:
    def test_matches_the_rag_indexer_name(self) -> None:
        assert DEFAULT_EMBEDDING_MODEL == "intfloat/multilingual-e5-small"
        assert collection_name(TENANT) == f"tenant_{TENANT_NO_HYPHENS}_{E5_SUFFIX}"

    def test_legacy_model_keeps_the_bare_name(self) -> None:
        assert collection_name(TENANT, LEGACY_EMBEDDING_MODEL) == f"tenant_{TENANT_NO_HYPHENS}"


class _CapturingST:
    last: _CapturingST

    def __init__(self, model_name: str) -> None:
        self.texts: list[str] = []
        self.kwargs: dict[str, Any] = {}
        _CapturingST.last = self

    def encode(self, texts: list[str], **kwargs: Any) -> Any:
        self.texts = list(texts)
        self.kwargs = kwargs
        return np.ones((len(texts), 384), dtype="float32")


@pytest.fixture
def patched_model(monkeypatch: pytest.MonkeyPatch) -> type[_CapturingST]:
    import flow_engine.infrastructure.embedder as embedder_mod

    monkeypatch.setattr(embedder_mod, "SentenceTransformer", _CapturingST)
    return _CapturingST


class TestQueryEmbedder:
    def test_e5_queries_are_prefixed_and_normalised(self, patched_model: type[_CapturingST]) -> None:
        from flow_engine.infrastructure.embedder import QueryEmbedder

        vector = QueryEmbedder(DEFAULT_EMBEDDING_MODEL).embed_query("¿Cuáles son sus horarios?")

        assert patched_model.last.texts == ["query: ¿Cuáles son sus horarios?"]
        assert patched_model.last.kwargs["normalize_embeddings"] is True
        assert len(vector) == 384 and isinstance(vector[0], float)

    def test_legacy_model_is_not_prefixed(self, patched_model: type[_CapturingST]) -> None:
        from flow_engine.infrastructure.embedder import QueryEmbedder

        QueryEmbedder(LEGACY_EMBEDDING_MODEL).embed_query("hello")

        assert patched_model.last.texts == ["hello"]


class _FakeCollection:
    def query(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        return {"documents": [["Abrimos de lunes a viernes."]], "distances": [[0.1]]}


class _FakeClient:
    def __init__(self) -> None:
        self.requested: list[str] = []
        self.collection = _FakeCollection()

    def get_collection(self, name: str) -> _FakeCollection:
        self.requested.append(name)
        return self.collection


class _FakeEmbedder:
    def embed_query(self, text: str) -> list[float]:
        return [0.5, 0.5]


class TestChromaRetriever:
    def _retriever(self, monkeypatch: pytest.MonkeyPatch, model: str) -> tuple[Any, _FakeClient]:
        import flow_engine.infrastructure.chroma.chroma_retriever as mod

        client = _FakeClient()
        monkeypatch.setattr(mod.chromadb, "HttpClient", lambda **_: client)
        return mod.ChromaRetriever("chroma", 8000, _FakeEmbedder(), embedding_model=model), client

    def test_queries_the_collection_of_the_configured_model(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        retriever, client = self._retriever(monkeypatch, DEFAULT_EMBEDDING_MODEL)

        results = retriever.query(TENANT, "horarios", top_k=3)

        assert client.requested == [f"tenant_{TENANT_NO_HYPHENS}_{E5_SUFFIX}"]
        assert results == [("Abrimos de lunes a viernes.", pytest.approx(0.9))]
        assert client.collection.kwargs["query_embeddings"] == [[0.5, 0.5]]

    def test_missing_collection_returns_no_results(self, monkeypatch: pytest.MonkeyPatch) -> None:
        retriever, client = self._retriever(monkeypatch, DEFAULT_EMBEDDING_MODEL)

        def _boom(name: str) -> None:
            raise RuntimeError("Collection does not exist")

        client.get_collection = _boom  # type: ignore[method-assign,assignment]
        assert retriever.query(TENANT, "horarios") == []
