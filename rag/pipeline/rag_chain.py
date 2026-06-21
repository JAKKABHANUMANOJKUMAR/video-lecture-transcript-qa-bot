"""Step 5 — retrieval-augmented answering with Groq.

Takes a user question, runs similarity search over ChromaDB, builds a grounded
prompt from the top chunks, and asks the Groq LLM to answer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

from rag.config import settings
from rag.pipeline.vectorstore import query as vector_query

SYSTEM_PROMPT = (
    "You are Ask Ora, an assistant that answers questions about a video lecture "
    "using ONLY the provided transcript excerpts. If the answer is not contained "
    "in the excerpts, say you don't have enough information from the lecture. "
    "Be concise, accurate, and cite relevant details from the context."
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


def _build_context(hits: list[dict]) -> str:
    blocks = []
    for i, hit in enumerate(hits, start=1):
        blocks.append(f"[Excerpt {i}]\n{hit['text']}")
    return "\n\n".join(blocks)


def answer_question(
    question: str,
    *,
    top_k: int | None = None,
    video_id: str | None = None,
    transcript_id: str | None = None,
    user_id: str | None = None,
) -> RagAnswer:
    """Retrieve relevant chunks and generate a grounded answer with Groq."""
    hits = vector_query(
        question,
        top_k=top_k,
        video_id=video_id,
        transcript_id=transcript_id,
        user_id=user_id,
    )

    if not hits:
        return RagAnswer(
            answer="I couldn't find anything relevant in the lecture transcripts yet. "
            "Make sure a video has been ingested first.",
            sources=[],
        )

    context = _build_context(hits)
    user_prompt = (
        f"Context from the lecture transcript:\n\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer using only the context above."
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

    return RagAnswer(answer=answer_text, sources=hits)
