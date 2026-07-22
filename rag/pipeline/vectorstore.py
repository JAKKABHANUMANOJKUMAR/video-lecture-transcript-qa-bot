"""Step 4 — ChromaDB persistent vector store."""

from __future__ import annotations

from functools import lru_cache

import chromadb

from rag.config import settings
from rag.pipeline.chunking import TimedChunk
from rag.pipeline.embeddings import LocalEmbeddingFunction


@lru_cache(maxsize=1)
def get_collection():
    client = chromadb.PersistentClient(path=settings.chroma_path)
    ef = LocalEmbeddingFunction()
    try:
        return client.get_collection(settings.CHROMA_COLLECTION, embedding_function=ef)
    except Exception:
        cols = client.list_collections()
        if cols:
            return client.get_collection(cols[0].name, embedding_function=ef)
        return client.get_or_create_collection(
            settings.CHROMA_COLLECTION,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )


def add_timed_chunks(
    transcript_id: str,
    chunks: list[TimedChunk],
    video_id: str | None = None,
    language: str = "en",
    *,
    variant: str = "primary",
    lecture_title: str | None = None,
    user_id: str | None = None,
    start_index: int = 0,
) -> int:
    """Embed and store timed chunks. Returns the number of chunks added."""
    if not chunks:
        return 0

    collection = get_collection()
    ids = [f"{transcript_id}:{variant}:{start_index + i}" for i in range(len(chunks))]
    documents = [c.text for c in chunks]
    metadatas = [
        {
            "transcript_id": transcript_id,
            "video_id": video_id or "",
            "user_id": user_id or "",
            "chunk_index": start_index + i,
            "language": language,
            "variant": variant,
            "lecture_title": lecture_title or "",
            "start_seconds": float(c.start_seconds),
            "end_seconds": float(c.end_seconds),
        }
        for i, c in enumerate(chunks)
    ]
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(chunks)


def add_chunks(
    transcript_id: str,
    chunks: list[str],
    video_id: str | None = None,
    language: str = "en",
    *,
    variant: str = "primary",
    start_index: int = 0,
) -> int:
    """Backward-compatible plain-text chunk ingest."""
    timed = [TimedChunk(text=t, start_seconds=0.0, end_seconds=0.0) for t in chunks]
    return add_timed_chunks(
        transcript_id,
        timed,
        video_id=video_id,
        language=language,
        variant=variant,
        start_index=start_index,
    )


def query(
    question: str,
    top_k: int | None = None,
    video_id: str | None = None,
    transcript_id: str | None = None,
    transcript_ids: list[str] | None = None,
) -> list[dict]:
    """Similarity search.

    Scope options (combined with AND):
      * ``transcript_id`` — a single transcript.
      * ``video_id`` — a single backend video.
      * ``transcript_ids`` — restrict to a set of transcripts (used to scope a
        "search all lectures" query to the ones a user is allowed to see).
    """
    collection = get_collection()

    conditions: list[dict] = []
    if transcript_id:
        conditions.append({"transcript_id": transcript_id})
    elif video_id:
        conditions.append({"video_id": video_id})
    if transcript_ids is not None:
        # Empty list => the caller owns nothing; short-circuit to no results.
        if not transcript_ids:
            return []
        conditions.append({"transcript_id": {"$in": transcript_ids}})

    if not conditions:
        where: dict | None = None
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
