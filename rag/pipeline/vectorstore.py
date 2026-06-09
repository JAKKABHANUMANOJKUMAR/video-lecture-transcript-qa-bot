"""Step 4 — ChromaDB persistent vector store.

Chunks from all transcripts live in a single collection, tagged with
`transcript_id` / `video_id` metadata so retrieval can be scoped to one video.
"""

from __future__ import annotations

from functools import lru_cache

import chromadb

from rag.config import settings
from rag.pipeline.embeddings import LocalEmbeddingFunction


@lru_cache(maxsize=1)
def get_collection():
    client = chromadb.PersistentClient(path=settings.chroma_path)
    return client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        embedding_function=LocalEmbeddingFunction(),
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(
    transcript_id: str,
    chunks: list[str],
    video_id: str | None = None,
    language: str = "en",
) -> int:
    """Embed and store chunks. Returns the number of chunks added."""
    if not chunks:
        return 0

    collection = get_collection()
    ids = [f"{transcript_id}:{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "transcript_id": transcript_id,
            "video_id": video_id or "",
            "chunk_index": i,
            "language": language,
        }
        for i in range(len(chunks))
    ]
    collection.upsert(ids=ids, documents=chunks, metadatas=metadatas)
    return len(chunks)


def query(
    question: str,
    top_k: int | None = None,
    video_id: str | None = None,
    transcript_id: str | None = None,
) -> list[dict]:
    """Similarity search. Optionally scope to a single video or transcript."""
    collection = get_collection()

    where: dict | None = None
    if transcript_id:
        where = {"transcript_id": transcript_id}
    elif video_id:
        where = {"video_id": video_id}

    result = collection.query(
        query_texts=[question],
        n_results=top_k or settings.TOP_K,
        where=where,
    )

    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]

    hits = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        hits.append({"text": doc, "metadata": meta, "distance": dist})
    return hits


def delete_transcript(transcript_id: str) -> None:
    collection = get_collection()
    collection.delete(where={"transcript_id": transcript_id})
