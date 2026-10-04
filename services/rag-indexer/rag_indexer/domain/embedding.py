"""Embedding-model identifiers shared by the embedder and the vector store."""

DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-small"

# Collections created before the multilingual switch hold MiniLM vectors under the
# bare ``tenant_<id>`` name; see rag_indexer.infrastructure.chroma_store.
LEGACY_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
