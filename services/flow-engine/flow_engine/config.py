"""Typed configuration from environment variables.

Fails fast at startup if required variables are missing.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass

_REQUIRED = [
    "REDIS_URL",
    "DATABASE_URL",
    "CHROMADB_HOST",
    "CHROMADB_PORT",
    "OPENAI_API_KEY",
    "INTERNAL_TOKEN",
    "MASTER_KEY",
]


@dataclass(frozen=True)
class Config:
    redis_url: str
    database_url: str
    chromadb_host: str
    chromadb_port: int
    openai_api_key: str
    openai_model: str
    internal_token: str
    log_level: str
    flow_engine_port: int
    master_key: str  # AES-256-GCM key for decrypting access_tokens


def load_config() -> Config:
    missing = [v for v in _REQUIRED if not os.environ.get(v)]
    if missing:
        print(  # noqa: T201
            f"FATAL: missing required environment variables: {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(1)

    return Config(
        redis_url=os.environ["REDIS_URL"],
        database_url=os.environ["DATABASE_URL"],
        chromadb_host=os.environ["CHROMADB_HOST"],
        chromadb_port=int(os.environ["CHROMADB_PORT"]),
        openai_api_key=os.environ["OPENAI_API_KEY"],
        openai_model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        internal_token=os.environ["INTERNAL_TOKEN"],
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        flow_engine_port=int(os.environ.get("FLOW_ENGINE_PORT", "8001")),
        master_key=os.environ["MASTER_KEY"],
    )
