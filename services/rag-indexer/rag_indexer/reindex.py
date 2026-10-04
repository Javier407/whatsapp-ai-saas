"""Re-embed every indexed document with the configured EMBEDDING_MODEL.

Run it after changing EMBEDDING_MODEL (vectors from different models are not
comparable, and each model writes to its own ChromaDB collection):

    docker compose -f infra/docker-compose.yml run --rm --no-deps rag-indexer \\
        python -m rag_indexer.reindex [--tenant <uuid>] [--dry-run] [--drop-legacy]

Documents are re-read from object storage, re-chunked, re-embedded and upserted
into the collection of the current model. Document rows go indexed → indexing →
indexed again. Documents that are not ``indexed`` follow the normal pipeline.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import uuid
from contextlib import closing
from datetime import datetime, timezone

import chromadb
import psycopg2
import psycopg2.extras

from rag_indexer.application.index_document import IndexDocumentUseCase
from rag_indexer.domain.embedding import LEGACY_EMBEDDING_MODEL
from rag_indexer.domain.models import IndexingJob
from rag_indexer.infrastructure.chroma_store import ChromaVectorStore, _collection_name
from rag_indexer.infrastructure.embedder import LocalEmbedder, embedding_model_name
from rag_indexer.infrastructure.minio_store import MinioDocumentStore
from rag_indexer.infrastructure.postgres_repo import PostgresStatusRepo
from rag_indexer.main import _configure_logging, _load_config

logger = logging.getLogger("rag_indexer.reindex")


def _list_tenants(dsn: str) -> list[str]:
    # tenants is a platform table without RLS (migration 005).
    with closing(psycopg2.connect(dsn)) as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM tenants ORDER BY created_at")
        return [str(row[0]) for row in cur.fetchall()]


def _list_documents(dsn: str, tenant_id: str) -> list[dict[str, str]]:
    with closing(psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)) as conn:
        with conn, conn.cursor() as cur:  # one transaction: SET LOCAL needs it
            cur.execute("SET LOCAL app.tenant_id = %s", (tenant_id,))
            cur.execute(
                "SELECT id, name, source_type, storage_uri FROM knowledge_base_documents "
                "WHERE tenant_id = %s AND status = 'indexed' ORDER BY uploaded_at",
                (tenant_id,),
            )
            return [{k: str(v) for k, v in row.items()} for row in cur.fetchall()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--tenant", help="only reindex this tenant UUID")
    parser.add_argument("--dry-run", action="store_true", help="list what would be reindexed")
    parser.add_argument(
        "--drop-legacy",
        action="store_true",
        help="delete the old MiniLM collection of a tenant once all its documents succeed",
    )
    args = parser.parse_args(argv)

    config = _load_config()
    _configure_logging(config["LOG_LEVEL"])
    model = embedding_model_name()
    dsn = config["DATABASE_URL"]

    tenants = [args.tenant] if args.tenant else _list_tenants(dsn)
    plan = {t: _list_documents(dsn, t) for t in tenants}
    total = sum(len(docs) for docs in plan.values())
    logger.info(
        "Reindex plan", extra={"model": model, "tenants": len(tenants), "documents": total}
    )
    if args.dry_run or total == 0:
        for tenant_id, docs in plan.items():
            for doc in docs:
                logger.info(
                    "Would reindex",
                    extra={
                        "tenant_id": tenant_id,
                        "document_id": doc["id"],
                        "document_name": doc["name"],
                    },
                )
        return 0

    chroma_host, chroma_port = config["CHROMADB_HOST"], int(config["CHROMADB_PORT"])
    use_case = IndexDocumentUseCase(
        document_store=MinioDocumentStore(
            endpoint=config["S3_ENDPOINT"],
            access_key=config["S3_ACCESS_KEY"],
            secret_key=config["S3_SECRET_KEY"],
            secure=os.environ.get("S3_SECURE", "false").lower() == "true",
        ),
        vector_store=ChromaVectorStore(chroma_host, chroma_port, embedding_model=model),
        status_repo=PostgresStatusRepo(connection_string=dsn),
        embedder=LocalEmbedder(model),
    )
    chroma = chromadb.HttpClient(host=chroma_host, port=chroma_port)

    failures = 0
    for tenant_id, docs in plan.items():
        tenant_failures = 0
        for doc in docs:
            job = IndexingJob(
                job_id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                document_id=doc["id"],
                storage_uri=doc["storage_uri"],
                source_type=doc["source_type"],
                name=doc["name"],
                embedder=model,
                enqueued_at=datetime.now(timezone.utc).isoformat(),
            )
            try:
                use_case.execute(job, force=True)
            except Exception:  # the use case already stored the failed status
                tenant_failures += 1
                logger.exception(
                    "Reindex failed", extra={"tenant_id": tenant_id, "document_id": doc["id"]}
                )
        failures += tenant_failures
        if args.drop_legacy and tenant_failures == 0 and model != LEGACY_EMBEDDING_MODEL:
            legacy = _collection_name(tenant_id, LEGACY_EMBEDDING_MODEL)
            try:
                chroma.delete_collection(legacy)
                logger.info("Dropped legacy collection", extra={"collection": legacy})
            except Exception:
                logger.info("No legacy collection to drop", extra={"collection": legacy})

    logger.info("Reindex finished", extra={"documents": total, "failures": failures})
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
