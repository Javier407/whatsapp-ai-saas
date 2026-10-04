"""Config: LLM provider selection and required-key validation."""
from __future__ import annotations

import pytest

from flow_engine.config import load_config

_BASE = {
    "REDIS_URL": "redis://x",
    "DATABASE_URL": "postgresql://x",
    "CHROMADB_HOST": "chromadb",
    "CHROMADB_PORT": "8000",
    "INTERNAL_TOKEN": "t",
    "MASTER_KEY": "k" * 32,
}


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in ("LLM_PROVIDER", "LLM_MODEL", "GEMINI_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    for key, value in _BASE.items():
        monkeypatch.setenv(key, value)


def test_defaults_to_gemini(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    cfg = load_config()
    assert cfg.llm_provider == "gemini"
    assert cfg.llm_api_key == "g-key"
    assert cfg.llm_model == "gemini-flash-latest"


def test_openai_provider_uses_openai_key_and_default_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "o-key")
    cfg = load_config()
    assert (cfg.llm_provider, cfg.llm_api_key, cfg.llm_model) == (
        "openai",
        "o-key",
        "gpt-4o-mini",
    )


def test_llm_model_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    monkeypatch.setenv("LLM_MODEL", "gemini-2.5-pro")
    assert load_config().llm_model == "gemini-2.5-pro"


def test_missing_gemini_key_is_fatal(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit):
        load_config()
    assert "GEMINI_API_KEY" in capsys.readouterr().err


def test_openai_key_alone_does_not_satisfy_gemini(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "o-key")
    with pytest.raises(SystemExit):
        load_config()
    assert "GEMINI_API_KEY" in capsys.readouterr().err


def test_unknown_provider_is_fatal(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "llama")
    with pytest.raises(SystemExit):
        load_config()
    assert "unsupported LLM_PROVIDER" in capsys.readouterr().err
