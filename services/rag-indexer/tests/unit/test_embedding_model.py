"""Multilingual embedding model: E5 prefixes, per-model collections, forced reindex."""
from __future__ import annotations

import numpy as np
import pytest

from rag_indexer.application.index_document import IndexDocumentUseCase
from rag_indexer.domain.embedding import DEFAULT_EMBEDDING_MODEL, LEGACY_EMBEDDING_MODEL
from rag_indexer.infrastructure.chroma_store import _collection_name

# Same literal is asserted in flow-engine's tests/unit/test_embedding.py: the two
# services must derive identical collection names or retrieval silently finds nothing.
TENANT = "11111111-2222-3333-4444-555555555555"
TENANT_NO_HYPHENS = "11111111222233334444555555555555"
E5_SUFFIX = "30b1cd54"  # sha1("intfloat/multilingual-e5-small")[:8]


class TestCollectionName:
    def test_default_model_gets_a_hashed_suffix(self) -> None:
        assert DEFAULT_EMBEDDING_MODEL == "intfloat/multilingual-e5-small"
        assert _collection_name(TENANT) == f"tenant_{TENANT_NO_HYPHENS}_{E5_SUFFIX}"

    def test_legacy_model_keeps_the_bare_name(self) -> None:
        assert _collection_name(TENANT, LEGACY_EMBEDDING_MODEL) == f"tenant_{TENANT_NO_HYPHENS}"

    def test_different_models_never_share_a_collection(self) -> None:
        assert _collection_name(TENANT, "other/model") != _collection_name(TENANT)

    def test_name_fits_chromadb_limit(self) -> None:
        assert len(_collection_name(TENANT)) <= 63


class _CapturingST:
    last: _CapturingST

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self.texts: list[str] = []
        self.kwargs: dict[str, object] = {}
        _CapturingST.last = self

    def encode(self, texts: list[str], **kwargs: object) -> object:
        self.texts = list(texts)
        self.kwargs = kwargs
        return np.zeros((len(texts), 384), dtype="float32")


@pytest.fixture
def patched_model(monkeypatch: pytest.MonkeyPatch) -> type[_CapturingST]:
    import rag_indexer.infrastructure.embedder as embedder_mod

    monkeypatch.setattr(embedder_mod, "SentenceTransformer", _CapturingST)
    return _CapturingST


class TestPassagePrefix:
    def test_e5_documents_are_prefixed_and_normalised(
        self, patched_model: type[_CapturingST]
    ) -> None:
        from rag_indexer.infrastructure.embedder import LocalEmbedder

        LocalEmbedder().embed(["horarios de atención", "business hours"])

        assert patched_model.last.model_name == DEFAULT_EMBEDDING_MODEL
        assert patched_model.last.texts == [
            "passage: horarios de atención",
            "passage: business hours",
        ]
        assert patched_model.last.kwargs["normalize_embeddings"] is True

    def test_legacy_model_is_not_prefixed(self, patched_model: type[_CapturingST]) -> None:
        from rag_indexer.infrastructure.embedder import LocalEmbedder

        LocalEmbedder(LEGACY_EMBEDDING_MODEL).embed(["hello"])

        assert patched_model.last.texts == ["hello"]

    def test_model_comes_from_env(
        self, patched_model: type[_CapturingST], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from rag_indexer.infrastructure.embedder import LocalEmbedder

        monkeypatch.setenv("EMBEDDING_MODEL", LEGACY_EMBEDDING_MODEL)
        assert LocalEmbedder().model_name == LEGACY_EMBEDDING_MODEL


class TestForcedReindex:
    def _use_case(self, status: str) -> tuple[IndexDocumentUseCase, list[str]]:
        from tests.unit.test_index_document import (
            FakeDocumentStore,
            FakeEmbedder,
            FakeStatusRepo,
            FakeVectorStore,
        )

        store = FakeDocumentStore(content=("Hola mundo. " * 30).encode())
        uc = IndexDocumentUseCase(
            document_store=store,
            vector_store=FakeVectorStore(),
            status_repo=FakeStatusRepo(initial_status=status),
            embedder=FakeEmbedder(),
        )
        return uc, store.download_calls

    def test_indexed_document_is_reprocessed_when_forced(self) -> None:
        from tests.unit.test_index_document import _make_job

        uc, downloads = self._use_case("indexed")
        uc.execute(_make_job(), force=True)
        assert len(downloads) == 1

    def test_indexed_document_is_still_skipped_by_default(self) -> None:
        from tests.unit.test_index_document import _make_job

        uc, downloads = self._use_case("indexed")
        uc.execute(_make_job())
        assert downloads == []
