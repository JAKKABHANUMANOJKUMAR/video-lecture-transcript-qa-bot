"""Step 5 — retrieval-augmented answering with Groq."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

from sqlalchemy import or_

from rag.config import settings
from rag.database import SessionLocal
from rag.models import Transcript
from rag.pipeline.formatting import (
    dedupe_key,
    format_timestamp,
    similarity_from_distance,
    youtube_deep_link,
)
from rag.pipeline.timespec import TimeWindow, parse_time_window
from rag.pipeline.vectorstore import get_time_range
from rag.pipeline.vectorstore import query as vector_query

# A wide window ("explain the first 20 minutes") can cover a lot of transcript;
# cap what reaches the prompt so it can't blow the context budget.
MAX_TIME_RANGE_CHUNKS = 12

SYSTEM_PROMPT = (
    "You are Lekta, an assistant that answers questions about video lectures "
    "using ONLY the provided transcript excerpts. If the answer is not contained "
    "in the excerpts, say you don't have enough information from the lecture. "
    "Be concise, accurate, and cite relevant details from the context. "
    "When excerpts include timestamps or lecture titles, you may reference them. "
    "Always answer in the same language as the user's question."
)

_NO_INFO = (
    "I don't have enough information from the lecture to answer that. "
    "Try rephrasing, or upload a video that covers this topic."
)


@dataclass
class RagAnswer:
    answer: str
    sources: list[dict] = field(default_factory=list)


@lru_cache(maxsize=1)
def _get_client():
    from groq import Groq

    if not settings.GROQ_API_KEY:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to rag/.env to enable answer generation."
        )
    return Groq(api_key=settings.GROQ_API_KEY)


def _load_transcript_meta(transcript_ids: set[str]) -> dict[str, dict]:
    """Fetch title + source URL for the transcripts referenced by the hits."""
    if not transcript_ids:
        return {}
    db = SessionLocal()
    try:
        rows = db.query(Transcript).filter(Transcript.id.in_(transcript_ids)).all()
        return {
            row.id: {
                "title": row.title or "Untitled lecture",
                "source_url": row.source_url,
            }
            for row in rows
        }
    finally:
        db.close()


def _user_scope(user_id: str | None) -> tuple[set[str], set[str]] | None:
    """Transcript/video ids a user may read: their own plus unowned (global).

    Returns ``None`` for anonymous callers (no scoping — legacy/CLI behaviour).
    """
    if user_id is None:
        return None
    db = SessionLocal()
    try:
        rows = (
            db.query(Transcript.id, Transcript.video_id)
            .filter(or_(Transcript.user_id == user_id, Transcript.user_id.is_(None)))
            .all()
        )
    finally:
        db.close()
    transcript_ids = {r[0] for r in rows}
    video_ids = {r[1] for r in rows if r[1]}
    return transcript_ids, video_ids


def _scope_duration(transcript_id: str | None, video_id: str | None) -> float | None:
    """Length of the lecture in scope — needed to resolve "the last 2 minutes"."""
    db = SessionLocal()
    try:
        rows = db.query(Transcript.duration_seconds)
        if transcript_id:
            rows = rows.filter(Transcript.id == transcript_id)
        else:
            rows = rows.filter(Transcript.video_id == video_id)
        row = rows.first()
    finally:
        db.close()
    if not row or not row[0]:
        return None
    return float(row[0])


def enrich_hit(hit: dict, meta_by_id: dict[str, dict]) -> dict:
    meta = dict(hit.get("metadata") or {})
    transcript_id = meta.get("transcript_id") or ""
    start = meta.get("start_seconds")
    end = meta.get("end_seconds")
    try:
        start_f = float(start) if start is not None else None
    except (TypeError, ValueError):
        start_f = None
    try:
        end_f = float(end) if end is not None else None
    except (TypeError, ValueError):
        end_f = None

    tmeta = meta_by_id.get(transcript_id, {})
    lecture_title = meta.get("lecture_title") or tmeta.get("title") or "Untitled lecture"
    source_url = tmeta.get("source_url")
    distance = hit.get("distance")

    return {
        "text": hit.get("text", ""),
        "metadata": meta,
        "distance": distance,
        "similarity": similarity_from_distance(distance),
        "lecture_title": lecture_title,
        "transcript_id": transcript_id,
        "video_id": meta.get("video_id") or None,
        "chunk_index": meta.get("chunk_index"),
        "start_seconds": start_f,
        "end_seconds": end_f,
        "source_url": source_url,
        "deep_link": youtube_deep_link(source_url, start_f),
        "timestamp_label": (
            f"{format_timestamp(start_f)}–{format_timestamp(end_f)}"
            if start_f is not None and end_f is not None
            else format_timestamp(start_f)
        ),
    }


def _dedupe(enriched: list[dict]) -> list[dict]:
    """Collapse bilingual (original+english) hits for the same lecture moment.

    Hits arrive distance-sorted (best first), so keeping the first occurrence of
    each (transcript, start, end) keeps the most relevant variant.
    """
    seen: set[tuple] = set()
    out: list[dict] = []
    for hit in enriched:
        key = dedupe_key(hit["transcript_id"], hit["start_seconds"], hit["end_seconds"])
        if key in seen:
            continue
        seen.add(key)
        out.append(hit)
    return out


def _build_context(hits: list[dict]) -> str:
    blocks = []
    for i, hit in enumerate(hits, start=1):
        title = hit.get("lecture_title") or "Lecture"
        ts = hit.get("timestamp_label") or "0:00"
        blocks.append(f"[Excerpt {i} — {title} @ {ts}]\n{hit['text']}")
    return "\n\n".join(blocks)


def _generate(user_prompt: str) -> str:
    client = _get_client()
    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )
    return completion.choices[0].message.content.strip()


def _answer_time_window(
    question: str,
    window: TimeWindow,
    *,
    duration: float | None,
    transcript_id: str | None,
    video_id: str | None,
) -> RagAnswer | None:
    """Answer from what was actually said during ``window``.

    Returns ``None`` when the window yields nothing, so the caller can fall back
    to ordinary semantic retrieval.
    """
    if duration and window.start >= duration:
        return RagAnswer(
            answer=(
                f"That moment is past the end of this lecture — it only runs "
                f"{format_timestamp(duration)}. Ask about a time within that range."
            ),
            sources=[],
        )

    hits = get_time_range(
        window.start, window.end, transcript_id=transcript_id, video_id=video_id
    )
    if not hits:
        return None

    transcript_ids_seen = {
        h.get("metadata", {}).get("transcript_id")
        for h in hits
        if h.get("metadata", {}).get("transcript_id")
    }
    meta_by_id = _load_transcript_meta(transcript_ids_seen)
    enriched = _dedupe([enrich_hit(h, meta_by_id) for h in hits])
    if not enriched:
        return None

    truncated = len(enriched) > MAX_TIME_RANGE_CHUNKS
    enriched = enriched[:MAX_TIME_RANGE_CHUNKS]

    # No similarity threshold here: these chunks were selected by the clock, and
    # they carry no distance to compare against it.
    context = _build_context(enriched)
    cutoff_note = (
        f" The excerpts stop at {format_timestamp(enriched[-1]['end_seconds'])}; "
        "say so if the window continues beyond them."
        if truncated
        else ""
    )
    user_prompt = (
        f"Transcript of this lecture covering {window.label}:\n\n{context}\n\n"
        f"Question: {question}\n\n"
        f"The excerpts above are what was said during {window.label}, in chronological "
        "order — they are not ranked by relevance, so use all of them and follow their "
        "order. Explain what the lecturer covers in this part of the lecture, referring "
        f"to timestamps where it helps.{cutoff_note} "
        "Reply in the same language as the question."
    )

    return RagAnswer(answer=_generate(user_prompt), sources=enriched)


def answer_question(
    question: str,
    *,
    top_k: int | None = None,
    video_id: str | None = None,
    transcript_id: str | None = None,
    search_all: bool = False,
    user_id: str | None = None,
) -> RagAnswer:
    """Retrieve relevant chunks and generate a grounded answer with Groq."""
    if not search_all and not transcript_id and not video_id:
        return RagAnswer(
            answer="Please upload a lecture video first, or enable “Search all lectures”.",
            sources=[],
        )

    scope = _user_scope(user_id)  # None => anonymous (no per-user filtering)

    if search_all:
        transcript_ids = sorted(scope[0]) if scope is not None else None
        hits = vector_query(question, top_k=top_k, transcript_ids=transcript_ids)
    else:
        if transcript_id:
            allowed = scope is None or transcript_id in scope[0]
        else:
            allowed = scope is None or video_id in scope[1]
        if not allowed:
            return RagAnswer(
                answer="You don't have access to this lecture, or it no longer exists.",
                sources=[],
            )

        # A question about a moment ("explain 5:00–9:00") is answered from the
        # clock rather than from embedding similarity. Only attempted with a
        # single lecture in scope — a timestamp means nothing across a library.
        duration = _scope_duration(transcript_id, video_id)
        window = parse_time_window(question, duration_seconds=duration)
        if window is not None:
            timed = _answer_time_window(
                question,
                window,
                duration=duration,
                transcript_id=transcript_id,
                video_id=video_id,
            )
            if timed is not None:
                return timed

        if transcript_id:
            hits = vector_query(question, top_k=top_k, transcript_id=transcript_id)
        else:
            hits = vector_query(question, top_k=top_k, video_id=video_id)

    if not hits:
        return RagAnswer(
            answer="I couldn't find anything relevant in the lecture transcripts yet. "
            "Make sure a video has been ingested first.",
            sources=[],
        )

    transcript_ids_seen = {
        h.get("metadata", {}).get("transcript_id")
        for h in hits
        if h.get("metadata", {}).get("transcript_id")
    }
    meta_by_id = _load_transcript_meta(transcript_ids_seen)
    enriched = _dedupe([enrich_hit(h, meta_by_id) for h in hits])

    threshold = settings.RETRIEVAL_MIN_SIMILARITY
    if threshold > 0:
        relevant = [h for h in enriched if h["similarity"] >= threshold]
    else:
        relevant = enriched

    if not relevant:
        # Nothing cleared the relevance bar — don't hallucinate an answer.
        return RagAnswer(answer=_NO_INFO, sources=[])

    context = _build_context(relevant)
    scope_note = (
        "You may draw from multiple lectures in the knowledge base."
        if search_all
        else "Answer about the current lecture only."
    )
    user_prompt = (
        f"Context from lecture transcript(s):\n\n{context}\n\n"
        f"Question: {question}\n\n"
        f"{scope_note} Answer using only the context above. "
        "Reply in the same language as the question."
    )

    return RagAnswer(answer=_generate(user_prompt), sources=relevant)
