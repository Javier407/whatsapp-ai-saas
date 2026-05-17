"""Unit tests for LocalEmbedder.

These tests use a lightweight stub to avoid loading the full sentence-transformers
model in CI. A separate integration test (not in this file) should run with the
real model.
"""
from __future__ import annotations

import types
import unittest.mock as mock

import pytest

from rag_indexer.application.index_document import IEmbedder


# ---------------------------------------------------------------------------
# Stub embedder (no model loading)
# ---------------------------------------------------------------------------

class _StubEmbedder(IEmbedder):
    """Deterministic fake embedder: returns a fixed-length zero vector per text."""

    DIM = 384  # matches all-MiniLM-L6-v2

    def __init__(self) -> None:
        self._call_count = 0

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._call_count += 1
        return [[0.0] * self.DIM for _ in texts]


# ---------------------------------------------------------------------------
# Tests against the IEmbedder contract
# ---------------------------------------------------------------------------

class TestIEmbedderContract:
    """Contract tests that any IEmbedder implementation must satisfy."""

    @pytest.fixture()
    def embedder(self) -> _StubEmbedder:
        return _StubEmbedder()

    def test_returns_list_of_floats(self, embedder: _StubEmbedder) -> None:
        result = embedder.embed(["hello world"])
        assert isinstance(result, list)
        assert isinstance(result[0], list)
        assert all(isinstance(v, float) for v in result[0])

    def test_one_vector_per_input(self, embedder: _StubEmbedder) -> None:
        texts = ["first", "second", "third"]
        result = embedder.embed(texts)
        assert len(result) == len(texts)

    def test_vector_dimensionality_consistent(self, embedder: _StubEmbedder) -> None:
        result = embedder.embed(["a", "b"])
        dims = [len(v) for v in result]
        assert len(set(dims)) == 1, "All vectors must have the same dimensionality"

    def test_empty_input_returns_empty_list(self, embedder: _StubEmbedder) -> None:
        result = embedder.embed([])
        assert result == []

    def test_batch_call_count(self, embedder: _StubEmbedder) -> None:
        """Calling embed once with many texts should count as a single call."""
        embedder.embed(["a"] * 100)
        assert embedder._call_count == 1


# ---------------------------------------------------------------------------
# Test that LocalEmbedder loads the model only once
# ---------------------------------------------------------------------------

class TestLocalEmbedderSingleton:
    """Verify the model is loaded in __init__ and reused across embed() calls."""

    def test_model_loaded_once_at_construction(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """SentenceTransformer should be instantiated exactly once per LocalEmbedder instance."""
        call_count = {"n": 0}

        class _FakeST:
            def __init__(self, model_name: str) -> None:
                call_count["n"] += 1

            def encode(self, texts: list[str], **kwargs: object) -> list[object]:
                import numpy as np
                return np.zeros((len(texts), 384))

        import rag_indexer.infrastructure.embedder as embedder_mod
        monkeypatch.setattr(embedder_mod, "SentenceTransformer", _FakeST)

        from rag_indexer.infrastructure.embedder import LocalEmbedder
        emb = LocalEmbedder()

        # Call embed multiple times
        emb.embed(["hello"])
        emb.embed(["world", "again"])

        # Model constructor called only once (at __init__)
        assert call_count["n"] == 1

    def test_embed_returns_list_of_float_lists(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import numpy as np

        class _FakeST:
            def __init__(self, _: str) -> None:
                pass

            def encode(self, texts: list[str], **kwargs: object) -> object:
                return np.random.rand(len(texts), 384).astype("float32")

        import rag_indexer.infrastructure.embedder as embedder_mod
        monkeypatch.setattr(embedder_mod, "SentenceTransformer", _FakeST)

        from rag_indexer.infrastructure.embedder import LocalEmbedder
        emb = LocalEmbedder()
        result = emb.embed(["hello", "world"])

        assert len(result) == 2
        assert isinstance(result[0], list)
        assert isinstance(result[0][0], float)
