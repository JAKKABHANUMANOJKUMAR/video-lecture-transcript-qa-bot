"""Step 5 — retrieval-augmented answering with Groq."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

from rag.config import settings
from rag.database import SessionLocal
from rag.models import Transcript
from rag.pipeline.vectorstore import query as vector_query

SYSTEM_PROMPT = (
    "You are Ask Ora, an assistant that answers questions about video lectures "
    "using ONLY the provided transcript excerpts. If the answer is not contained "
    "in the excerpts, say you don't have enough information from the lecture. "
    "Be concise, accurate, and cite relevant details from the context. "
    "When excerpts include timestamps or lecture titles, you may reference them. "
    "Always answer in the same language as the user's question."
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


def _format_timestamp(seconds: float | None) -> str:
    if seconds is None:
        return "0:00"
    total = max(0, int(seconds))
    m, s = divmod(total, 60)
    return f"{m}:{s:02d}"


def _similarity_from_distance(distance: float | None) -> float:
    if distance is None:
        return 0.0
    return round(max(0.0, min(1.0, 1.0 - float(distance))), 4)


def _load_transcript_titles(transcript_ids: set[str]) -> dict[str, str]:
    if not transcript_ids:
        return {}
    db = SessionLocal()
    try:
        rows = db.query(Transcript).filter(Transcript.id.in_(transcript_ids)).all()
        return {row.id: (row.title or "Untitled lecture") for row in rows}
    finally:
        db.close()


def enrich_hit(hit: dict, titles: dict[str, str]) -> dict:
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

    lecture_title = meta.get("lecture_title") or titles.get(transcript_id, "Untitled lecture")
    distance = hit.get("distance")

    return {
        "text": hit.get("text", ""),
        "metadata": meta,
        "distance": distance,
        "similarity": _similarity_from_distance(distance),
        "lecture_title": lecture_title,
        "transcript_id": transcript_id,
        "video_id": meta.get("video_id") or None,
        "chunk_index": meta.get("chunk_index"),
        "start_seconds": start_f,
        "end_seconds": end_f,
        "timestamp_label": (
            f"{_format_timestamp(start_f)}–{_format_timestamp(end_f)}"
            if start_f is not None and end_f is not None
            else _format_timestamp(start_f)
        ),
    }


def _build_context(hits: list[dict]) -> str:
    blocks = []
    for i, hit in enumerate(hits, start=1):
        title = hit.get("lecture_title") or "Lecture"
        ts = hit.get("timestamp_label") or "0:00"
        blocks.append(f"[Excerpt {i} — {title} @ {ts}]\n{hit['text']}")
    return "\n\n".join(blocks)


def answer_question(
    question: str,
    *,
    top_k: int | None = None,
    video_id: str | None = None,
    transcript_id: str | None = None,
    search_all: bool = False,
) -> RagAnswer:
    """Retrieve relevant chunks and generate a grounded answer with Groq."""
    if not search_all and not transcript_id and not video_id:
        return RagAnswer(
            answer="Please upload a lecture video first, or enable “Search all lectures”.",
            sources=[],
        )

    scope_transcript = None if search_all else transcript_id
    scope_video = None if search_all else video_id

    hits = vector_query(
        question,
        top_k=top_k,
        video_id=scope_video,
        transcript_id=scope_transcript,
    )

    if not hits:
        return RagAnswer(
            answer="I couldn't find anything relevant in the lecture transcripts yet. "
            "Make sure a video has been ingested first.",
            sources=[],
        )

    transcript_ids = {
        h.get("metadata", {}).get("transcript_id")
        for h in hits
        if h.get("metadata", {}).get("transcript_id")
    }
    titles = _load_transcript_titles(transcript_ids)
    enriched = [enrich_hit(h, titles) for h in hits]

    context = _build_context(enriched)
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

    client = _get_client()
    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )
    answer_text = completion.choices[0].message.content.strip()

    return RagAnswer(answer=answer_text, sources=enriched)
