# ADR-008: multilingual-e5-small as the Default Embedding Model

**Status:** Accepted — supersedes the model choice in [ADR-007](007-sentence-transformers-local-embeddings.md)
**Date:** 2026-10-03

## Context

ADR-007 picked `sentence-transformers/all-MiniLM-L6-v2`, an English-only model. The product's customers write to a WhatsApp bot in Spanish, and the knowledge bases are Spanish (or mixed). Measured on the seed knowledge base (English FAQ) with the production retriever:

| Question language | MiniLM top score (relevant questions) |
|---|---|
| English | 0.54 – 0.72 (unrelated questions: 0.09 – 0.16) |
| Spanish | 0.08 – 0.25 (unrelated questions: 0.07 – 0.16) |

Spanish questions were indistinguishable from noise, so the RAG fallback answered "I don't have that information" even when the answer was in the knowledge base.

## Decision

Use `intfloat/multilingual-e5-small` (118M parameters, 384 dimensions, ~470 MB) running on CPU in `rag-indexer` and `flow-engine`, selected by `EMBEDDING_MODEL`.

- **Asymmetric prefixes.** E5 is trained with `passage: ` on documents (rag-indexer) and `query: ` on user questions (flow-engine). Vectors are L2-normalised.
- **One collection per tenant and model:** `tenant_<id>_<sha1(model)[:8]>`. Vectors from different models are not comparable; a model change can never mix them, and the old collection stays available for rollback. The legacy MiniLM model keeps the bare `tenant_<id>` name, so setting `EMBEDDING_MODEL` back is an instant rollback.
- **Reindex command.** `make reindex` (`python -m rag_indexer.reindex`) re-reads every `indexed` document from object storage and re-embeds it into the current model's collection. `--dry-run` lists the work; `--drop-legacy` deletes the old collection per tenant once all its documents succeeded.
- **Model baked into the image** (own Dockerfile stage, with download retries), so containers start offline and a code change does not re-download it.
- **Recalibrated thresholds.** E5 scores are compressed into a high band. On the seed knowledge base, relevant questions in both languages scored 0.80 – 0.91 and unrelated ones 0.67 – 0.79 (cross-lingual: Spanish questions against the English FAQ work). The RAG fallback gate moved from 0.35 to `RAG_FALLBACK_MIN_SCORE=0.78`, which also becomes the default `min_confidence` of the `rag_lookup` node (was 0.75).

## Consequences

- Spanish and English questions retrieve from knowledge bases in either language.
- Between deploying the new images and running `make reindex`, the knowledge base of the new model is empty and the bot answers without KB context (graceful: the retriever returns no results).
- RAM per process grows from ~80 MB to ~500 MB (flow-engine ×2 and rag-indexer: ~1.5 GB in total); image size +~470 MB each.
- **The margin is thin:** 0.79 (highest unrelated) vs 0.80 (lowest relevant) from 19 hand-written questions. The gate leans towards recall because the system prompt already tells the LLM to say it has no information when the context does not cover the question. Recalibrate with real tenant questions, and whenever `EMBEDDING_MODEL` changes.
- `rag_lookup` nodes that store an explicit `min_confidence` tuned for MiniLM (e.g. 0.5) now let unrelated chunks through; review them.

## Alternatives Rejected

- **`paraphrase-multilingual-MiniLM-L12-v2`:** no prefixes and simpler, but lower retrieval quality than E5 on short questions against passages.
- **Larger multilingual models (`multilingual-e5-base`/`large`, bge-m3):** better quality, 1 – 2 GB of RAM per process, which does not fit the current footprint on the 9 GB server.
- **OpenAI / Gemini embeddings:** an external call and cost per chunk and per user message, and a vendor dependency in the retrieval path.
- **Translating questions before embedding:** adds an LLM call and latency to every message and loses nuance.
