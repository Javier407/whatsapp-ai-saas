"""Unit tests for IndexDocumentUseCase using fake ports."""
from __future__ import annotations

from typing import Optional

import pytest

from rag_indexer.application.index_document import IEmbedder, IndexDocumentUseCase
from rag_indexer.domain.models import DocumentChunk, IndexingJob
from rag_indexer.domain.ports import IDocumentStore, IStatusRepo, IVectorStore


# ---------------------------------------------------------------------------
# Fake implementations
# ---------------------------------------------------------------------------

class FakeDocumentStore(IDocumentStore):
    def __init__(self, content: bytes = b"", content_type: str = "text/plain") -> None:
        self.content = content
        self.content_type = content_type
        self.download_calls: list[str] = []

    def download(self, storage_uri: str) -> tuple[bytes, str]:
        self.download_calls.append(storage_uri)
        return self.content, self.content_type


class FakeVectorStore(IVectorStore):
    def __init__(self) -> None:
        self.upserted: list[tuple[str, list[DocumentChunk]]] = []
        self.deleted: list[tuple[str, str]] = []

    def upsert(self, tenant_id: str, chunks: list[DocumentChunk]) -> None:
        self.upserted.append((tenant_id, list(chunks)))

    def delete_by_document(self, tenant_id: str, document_id: str) -> None:
        self.deleted.append((tenant_id, document_id))


class FakeStatusRepo(IStatusRepo):
    def __init__(self, initial_status: Optional[str] = "pending") -> None:
        self._status = initial_status
        self.calls: list[tuple[str, ...]] = []

    def get_status(self, tenant_id: str, document_id: str) -> Optional[str]:
        self.calls.append(("get_status", tenant_id, document_id))
        return self._status

    def set_indexing(self, tenant_id: str, document_id: str) -> None:
        self.calls.append(("set_indexing", tenant_id, document_id))
        self._status = "indexing"

    def set_indexed(self, tenant_id: str, document_id: str, chunk_count: int) -> None:
        self.calls.append(("set_indexed", tenant_id, document_id, str(chunk_count)))
        self._status = "indexed"

    def set_failed(self, tenant_id: str, document_id: str, error_message: str) -> None:
        self.calls.append(("set_failed", tenant_id, document_id, error_message))
        self._status = "failed"


class FakeEmbedder(IEmbedder):
    DIM = 384

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(i % 10) / 10] * self.DIM for i, _ in enumerate(texts)]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_job(
    source_type: str = "text",
    document_id: str = "doc-001",
    tenant_id: str = "tenant-123",
) -> IndexingJob:
    return IndexingJob(
        job_id="job-abc",
        tenant_id=tenant_id,
        document_id=document_id,
        storage_uri=f"s3://bucket/kb-documents/{tenant_id}/{document_id}/file.txt",
        source_type=source_type,
        name="Test Doc",
        embedder="all-MiniLM-L6-v2",
        enqueued_at="2026-05-16T00:00:00Z",
    )


def _make_use_case(
    doc_store: FakeDocumentStore,
    vec_store: FakeVectorStore,
    status_repo: FakeStatusRepo,
    embedder: Optional[FakeEmbedder] = None,
) -> IndexDocumentUseCase:
    return IndexDocumentUseCase(
        document_store=doc_store,
        vector_store=vec_store,
        status_repo=status_repo,
        embedder=embedder or FakeEmbedder(),
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestIndexDocumentUseCase:
    def test_happy_path_status_transitions_pending_to_indexed(self) -> None:
        text_content = "Hello world. " * 20  # enough for multiple chunks
        doc_store = FakeDocumentStore(content=text_content.encode(), content_type="text/plain")
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo(initial_status="pending")

        uc = _make_use_case(doc_store, vec_store, status_repo)
        uc.execute(_make_job(source_type="text"))

        statuses = [call[0] for call in status_repo.calls]
        assert "set_indexing" in statuses
        assert "set_indexed" in statuses
        assert "set_failed" not in statuses

    def test_chunk_count_set_correctly(self) -> None:
        # Use a text long enough to produce multiple chunks at chunk_size=512
        text_content = ("word " * 120 + "\n\n") * 5  # ~3000 chars
        doc_store = FakeDocumentStore(content=text_content.encode())
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        uc = _make_use_case(doc_store, vec_store, status_repo)
        uc.execute(_make_job())

        set_indexed_call = next(c for c in status_repo.calls if c[0] == "set_indexed")
        chunk_count_in_call = int(set_indexed_call[3])
        assert chunk_count_in_call > 0

        # Also verify what was upserted to the vector store matches
        tenant_id, upserted_chunks = vec_store.upserted[0]
        assert len(upserted_chunks) == chunk_count_in_call

    def test_already_indexed_document_is_skipped(self) -> None:
        doc_store = FakeDocumentStore(content=b"some text")
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo(initial_status="indexed")

        uc = _make_use_case(doc_store, vec_store, status_repo)
        uc.execute(_make_job())

        # Nothing should be downloaded or upserted
        assert doc_store.download_calls == []
        assert vec_store.upserted == []

    def test_failed_status_set_on_download_error(self) -> None:
        class BrokenStore(IDocumentStore):
            def download(self, storage_uri: str) -> tuple[bytes, str]:
                raise ConnectionError("MinIO unreachable")

        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        uc = IndexDocumentUseCase(
            document_store=BrokenStore(),
            vector_store=vec_store,
            status_repo=status_repo,
            embedder=FakeEmbedder(),
        )
        with pytest.raises(ConnectionError):
            uc.execute(_make_job())

        statuses = [c[0] for c in status_repo.calls]
        assert "set_failed" in statuses

    def test_failed_status_set_on_embed_error(self) -> None:
        class BrokenEmbedder(IEmbedder):
            def embed(self, texts: list[str]) -> list[list[float]]:
                raise RuntimeError("GPU OOM")

        doc_store = FakeDocumentStore(content=b"Some text content here")
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        uc = IndexDocumentUseCase(
            document_store=doc_store,
            vector_store=vec_store,
            status_repo=status_repo,
            embedder=BrokenEmbedder(),
        )
        with pytest.raises(RuntimeError):
            uc.execute(_make_job())

        statuses = [c[0] for c in status_repo.calls]
        assert "set_failed" in statuses

    def test_pdf_source_type_dispatches_correctly(self) -> None:
        """Ensure PDF source_type is handled (content need not be valid PDF in unit test)."""
        # We'll use a fake document store returning minimal valid PDF bytes.
        # Since pypdf is a real dependency, we monkeypatch extract_text.
        import unittest.mock as mock
        import rag_indexer.application.index_document as mod

        doc_store = FakeDocumentStore(content=b"%PDF minimal", content_type="application/pdf")
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        with mock.patch.object(mod, "extract_text", return_value="Extracted PDF text " * 10):
            uc = _make_use_case(doc_store, vec_store, status_repo)
            uc.execute(_make_job(source_type="pdf"))

        statuses = [c[0] for c in status_repo.calls]
        assert "set_indexed" in statuses

    def test_faq_json_source_type_parsed_correctly(self) -> None:
        import json
        faq = [
            {"question": "What is this?", "answer": "A test."},
            {"question": "Why?", "answer": "Because."},
        ]
        content = json.dumps(faq).encode()
        doc_store = FakeDocumentStore(content=content, content_type="application/json")
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        uc = _make_use_case(doc_store, vec_store, status_repo)
        uc.execute(_make_job(source_type="faq_json"))

        statuses = [c[0] for c in status_repo.calls]
        assert "set_indexed" in statuses
        assert vec_store.upserted[0][1][0].text.startswith("Q: ")

    def test_empty_text_results_in_zero_chunks_indexed(self) -> None:
        doc_store = FakeDocumentStore(content=b"   ")  # whitespace only
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        uc = _make_use_case(doc_store, vec_store, status_repo)
        uc.execute(_make_job(source_type="text"))

        set_indexed_call = next(c for c in status_repo.calls if c[0] == "set_indexed")
        assert int(set_indexed_call[3]) == 0
        assert vec_store.upserted == []

    def test_chunk_ids_follow_expected_format(self) -> None:
        text_content = "chunk content here. " * 50
        doc_store = FakeDocumentStore(content=text_content.encode())
        vec_store = FakeVectorStore()
        status_repo = FakeStatusRepo()

        job = _make_job(document_id="doc-777")
        uc = _make_use_case(doc_store, vec_store, status_repo)
        uc.execute(job)

        _, chunks = vec_store.upserted[0]
        for i, chunk in enumerate(chunks):
            assert chunk.id == f"doc-777_{i}"
            assert chunk.chunk_index == i
