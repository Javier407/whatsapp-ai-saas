# ADR-003: LangChain as LLM Orchestration Layer

**Status:** Accepted
**Date:** 2026-05-17

## Context

The Flow Engine needs prompt assembly, history trimming, retriever composition, LLM provider abstraction, and a path to agentic flows later.

## Decision

LangChain 0.3.x (Python) for the LLM fallback path and for the `llm_generate` node executor. The retriever wraps the `VectorStoreAdapter` which delegates to ChromaDB.

## Consequences

- Provider swap (OpenAI → Anthropic → local) is a one-line config change in the chain factory.
- Easy upgrade to LangGraph for v2 agentic patterns without rewriting node executors.
- Tradeoff: LangChain's API has churn; we pin a minor version (`>=0.3,<0.4`) and isolate it inside `infrastructure/llm/` so domain code never imports `langchain.*` directly.

## Alternatives Rejected

- **LlamaIndex:** better at advanced retrieval (hierarchical, multi-doc) but redundant with ChromaDB for MVP. May be added as the retriever later if KB complexity grows.
- **Direct SDK calls (openai / anthropic):** less code initially but reinvents prompt templating, history trimming, retry, and provider abstraction.
