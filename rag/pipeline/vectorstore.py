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
    user_id: str | None = None,
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
            "user_id": user_id or "",
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
    user_id: str | None = None,
) -> list[dict]:
    """Similarity search, always scoped to the owning user.

    When ``user_id`` is provided, results are restricted to that user's chunks,
    optionally narrowed further to a single transcript or video.
    """
    collection = get_collection()

    conditions: list[dict] = []
    if user_id is not None:
        conditions.append({"user_id": user_id})
    if transcript_id:
        conditions.append({"transcript_id": transcript_id})
    elif video_id:
        conditions.append({"video_id": video_id})

    where: dict | None
    if not conditions:
        where = None
    elif len(conditions) == 1:
        where = conditions[0]
    else:
        where = {"$and": conditions}

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
