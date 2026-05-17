"""Shared pytest fixtures for RAG Indexer tests."""
from __future__ import annotations

import pytest

from rag_indexer.domain.models import IndexingJob


@pytest.fixture()
def sample_job() -> IndexingJob:
    """A minimal valid IndexingJob for testing."""
    return IndexingJob(
        job_id="job-001",
        tenant_id="tenant-abc-123",
        document_id="doc-xyz-456",
        storage_uri="s3://kb-bucket/kb-documents/tenant-abc-123/doc-xyz-456/sample.txt",
        source_type="text",
        name="Sample Document",
        embedder="all-MiniLM-L6-v2",
        enqueued_at="2026-05-16T00:00:00Z",
    )
