"""Typed configuration from environment variables.

Fails fast at startup if required variables are missing.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from flow_engine.domain.embedding import DEFAULT_EMBEDDING_MODEL, DEFAULT_RAG_MIN_SCORE

_REQUIRED = [
    "REDIS_URL",
    "DATABASE_URL",
    "CHROMADB_HOST",
    "CHROMADB_PORT",
    "INTERNAL_TOKEN",
    "MASTER_KEY",
]

# provider -> (env var holding the API key, default model)
_LLM_PROVIDERS: dict[str, tuple[str, str]] = {
    # `-latest` alias: Google retires pinned Flash versions within months
    # (2.5 Flash already 404s for new keys), so a pinned default breaks silently.
    "gemini": ("GEMINI_API_KEY", "gemini-flash-latest"),
    "openai": ("OPENAI_API_KEY", "gpt-4o-mini"),
}
_DEFAULT_LLM_PROVIDER = "gemini"


@dataclass(frozen=True)
class Config:
    redis_url: str
    database_url: str
    chromadb_host: str
    chromadb_port: int
    llm_provider: str
    llm_api_key: str
    llm_model: str
    embedding_model: str  # must match the rag-indexer's EMBEDDING_MODEL
    rag_min_score: float  # RAG fallback gate, calibrated for the embedding model
    internal_token: str
    log_level: str
    flow_engine_port: int
    master_key: str  # AES-256-GCM key for decrypting access_tokens


def _fatal(message: str) -> None:
    print(f"FATAL: {message}", file=sys.stderr)  # noqa: T201
    sys.exit(1)


def load_config() -> Config:
    missing = [v for v in _REQUIRED if not os.environ.get(v)]

    provider = os.environ.get("LLM_PROVIDER", _DEFAULT_LLM_PROVIDER).strip().lower()
    if provider not in _LLM_PROVIDERS:
        _fatal(
            f"unsupported LLM_PROVIDER '{provider}' "
            f"(expected one of: {', '.join(sorted(_LLM_PROVIDERS))})"
        )
    key_var, default_model = _LLM_PROVIDERS[provider]
    if not os.environ.get(key_var):
        missing.append(key_var)

    if missing:
        _fatal(f"missing required environment variables: {', '.join(missing)}")

    return Config(
        redis_url=os.environ["REDIS_URL"],
        database_url=os.environ["DATABASE_URL"],
        chromadb_host=os.environ["CHROMADB_HOST"],
        chromadb_port=int(os.environ["CHROMADB_PORT"]),
        llm_provider=provider,
        llm_api_key=os.environ[key_var],
        llm_model=os.environ.get("LLM_MODEL") or default_model,
        embedding_model=os.environ.get("EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL,
        rag_min_score=float(os.environ.get("RAG_FALLBACK_MIN_SCORE") or DEFAULT_RAG_MIN_SCORE),
        internal_token=os.environ["INTERNAL_TOKEN"],
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        flow_engine_port=int(os.environ.get("FLOW_ENGINE_PORT", "8001")),
        master_key=os.environ["MASTER_KEY"],
    )
