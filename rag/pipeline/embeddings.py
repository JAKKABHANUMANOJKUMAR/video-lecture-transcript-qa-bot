"""Step 3b — local sentence-transformers embedding function for ChromaDB."""

from __future__ import annotations

from functools import lru_cache

from chromadb import Documents, EmbeddingFunction, Embeddings

from rag.config import settings


@lru_cache(maxsize=1)
def _load_model(model_name: str):
    # Imported lazily so the (heavy) model only loads when embeddings are needed.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


class LocalEmbeddingFunction(EmbeddingFunction):
    """Chroma-compatible embedding function backed by sentence-transformers."""

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.EMBEDDING_MODEL

    def __call__(self, input: Documents) -> Embeddings:
        model = _load_model(self.model_name)
        vectors = model.encode(list(input), normalize_embeddings=True, show_progress_bar=False)
        return [vec.tolist() for vec in vectors]

    # Chroma >=0.5 expects these helpers on custom embedding functions.
    def name(self) -> str:
        return f"local-st::{self.model_name}"


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Convenience helper to embed a list of strings directly."""
    model = _load_model(settings.EMBEDDING_MODEL)
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [vec.tolist() for vec in vectors]
