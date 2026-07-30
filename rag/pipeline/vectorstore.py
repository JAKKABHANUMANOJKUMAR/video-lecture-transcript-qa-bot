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


# When the same moment exists in several language variants, feed the LLM the
# most readable one. Ordering is by start time, so this only breaks ties.
_VARIANT_RANK = {"primary": 0, "english": 1, "original": 2}


def _meta_float(meta: dict, key: str) -> float:
    try:
        return float(meta.get(key))
    except (TypeError, ValueError):
        return 0.0


def get_time_range(
    start_seconds: float,
    end_seconds: float,
    *,
    transcript_id: str | None = None,
    video_id: str | None = None,
) -> list[dict]:
    """Every chunk overlapping ``[start_seconds, end_seconds]``, oldest first.

    Unlike :func:`query` this ignores embeddings entirely: when the question is
    about a moment ("explain 5:00–9:00"), the clock *is* the relevance signal,
    and similarity search would rank the window's chunks by the wrong criterion.
    """
    collection = get_collection()

    # Overlap, not containment: a chunk straddling either edge of the window is
    # still part of what was said during it.
    conditions: list[dict] = [
        {"start_seconds": {"$lte": float(end_seconds)}},
        {"end_seconds": {"$gte": float(start_seconds)}},
    ]
    if transcript_id:
        conditions.append({"transcript_id": transcript_id})
    elif video_id:
        conditions.append({"video_id": video_id})

    result = collection.get(where={"$and": conditions}, include=["documents", "metadatas"])

    documents = result.get("documents") or []
    metadatas = result.get("metadatas") or []

    hits = [
        {"text": doc, "metadata": meta or {}, "distance": None}
        for doc, meta in zip(documents, metadatas)
    ]
    hits.sort(
        key=lambda h: (
            _meta_float(h["metadata"], "start_seconds"),
            _VARIANT_RANK.get(h["metadata"].get("variant"), 3),
            h["metadata"].get("chunk_index") or 0,
        )
    )
    return hits


def delete_transcript(transcript_id: str) -> None:
    collection = get_collection()
    collection.delete(where={"transcript_id": transcript_id})
