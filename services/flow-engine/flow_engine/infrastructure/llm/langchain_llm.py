"""LangChain 0.3.x LLM port implementation.

All langchain imports are intentionally isolated in this module.
Domain and application code never import from langchain directly.

Providers: Gemini (default, via LLM_PROVIDER=gemini) and OpenAI. The provider,
key and model come from flow_engine.config (LLM_PROVIDER / LLM_MODEL).
Max tokens: hard-capped at 1000 — never exceeded regardless of node config.
"""
from __future__ import annotations

import logging
from typing import Any, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import SecretStr

from flow_engine.domain.ports import ILLMPort

logger = logging.getLogger(__name__)

_ABSOLUTE_MAX_TOKENS = 1000
_REQUEST_TIMEOUT_S = 25
_MAX_RETRIES = 1

# Name of the per-call output cap in each provider's request parameters.
_MAX_TOKENS_PARAM = {"gemini": "max_output_tokens", "openai": "max_tokens"}


def _build_chat_model(provider: str, api_key: str, model: str) -> BaseChatModel:
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs: dict[str, Any] = {}
        # Flash models "think" by default and thinking tokens count against
        # max_output_tokens: with a small cap the reply came back empty
        # (verified on gemini-flash-latest). Pro models cannot disable
        # thinking, so only Flash variants get thinking_budget=0.
        if "flash" in model and "pro" not in model:
            kwargs["thinking_budget"] = 0
        # The default max_retries (6, exponential backoff) kept a failing call
        # alive for over a minute — longer than the dry-run proxy timeout.
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=SecretStr(api_key),
            max_output_tokens=500,
            temperature=0.3,
            timeout=_REQUEST_TIMEOUT_S,
            max_retries=_MAX_RETRIES,
            **kwargs,
        )
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            api_key=SecretStr(api_key),
            model=model,
            max_tokens=500,  # type: ignore[call-arg]  # default; overridden per call
            temperature=0.3,
        )
    raise ValueError(f"unsupported LLM provider: {provider}")


def _content_to_text(content: Any) -> str:
    """Gemini may return content as a list of parts; flatten it to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("type", "text") == "text":
                parts.append(str(part.get("text", "")))
        return "".join(parts)
    return str(content)


class LangChainLLMPort(ILLMPort):
    def __init__(self, provider: str, api_key: str, model: str) -> None:
        self._max_tokens_param = _MAX_TOKENS_PARAM[provider]
        self._llm = _build_chat_model(provider, api_key, model)

    def generate(
        self,
        system_prompt: str,
        history: list[dict[str, Any]],
        user_message: str,
        rag_context: str | None = None,
        max_tokens: int = 500,
    ) -> tuple[str, int]:
        """Return (reply_text, total_tokens_used).

        Args:
            system_prompt: System-level instructions (already interpolated).
            history: Last N turns [{role, content, ts}, ...].
            user_message: Current inbound text from the user.
            rag_context: Optional retrieved chunks from ChromaDB.
            max_tokens: Per-call cap; hard-capped at 1000.
        """
        effective_max = min(max_tokens, _ABSOLUTE_MAX_TOKENS)

        messages: list[Any] = [SystemMessage(content=system_prompt)]
        if rag_context:
            messages.append(
                SystemMessage(content=f"Context from knowledge base:\n{rag_context}")
            )

        for turn in history[-10:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            else:
                messages.append(AIMessage(content=content))

        messages.append(HumanMessage(content=user_message))

        # bind() puts the cap in the request kwargs (with_config() only sets
        # runnable config and would not change the model's output limit).
        llm = self._llm.bind(**{self._max_tokens_param: effective_max})
        # invoke() is typed as returning BaseMessage; at runtime it is an
        # AIMessage, which carries usage_metadata.
        response = cast(AIMessage, llm.invoke(messages))

        tokens: int = 0
        if response.usage_metadata:
            tokens = response.usage_metadata.get("total_tokens", 0)

        return _content_to_text(response.content), tokens
