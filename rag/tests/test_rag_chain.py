"""Tests for enrichment + variant dedupe (skipped if vector deps are absent)."""

import pytest

pytest.importorskip("chromadb")
pytest.importorskip("sqlalchemy")

from rag.pipeline.rag_chain import _build_answer_prompt, _dedupe, enrich_hit  # noqa: E402


def _hit(transcript_id, start, end, distance, variant="english", text="x"):
    return {
        "text": text,
        "distance": distance,
        "metadata": {
            "transcript_id": transcript_id,
            "start_seconds": start,
            "end_seconds": end,
            "variant": variant,
            "video_id": "v1",
            "chunk_index": 0,
        },
    }


def test_enrich_hit_adds_similarity_and_deeplink():
    meta = {"t1": {"title": "Intro to Python", "source_url": "https://youtu.be/dQw4w9WgXcQ"}}
    enriched = enrich_hit(_hit("t1", 30.0, 45.0, 0.25), meta)
    assert enriched["similarity"] == 0.75
    assert enriched["lecture_title"] == "Intro to Python"
    assert enriched["timestamp_label"] == "0:30–0:45"
    assert enriched["deep_link"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s"


def test_dedupe_collapses_bilingual_variants():
    # Same lecture moment retrieved as both 'english' and 'original' variants.
    hits = [
        enrich_hit(_hit("t1", 30.0, 45.0, 0.10, variant="english"), {}),
        enrich_hit(_hit("t1", 30.04, 45.02, 0.30, variant="original"), {}),
        enrich_hit(_hit("t1", 60.0, 75.0, 0.20, variant="english"), {}),
    ]
    out = _dedupe(hits)
    assert len(out) == 2  # the near-identical span is collapsed
    # The best (lowest-distance) variant for the collapsed span is kept.
    assert out[0]["metadata"]["variant"] == "english"
    assert out[0]["start_seconds"] == 30.0


def test_build_answer_prompt_forces_short_exact_answers():
    prompt = _build_answer_prompt(
        "Context excerpt",
        "What is Python?",
        scope_note="Answer about the current lecture only.",
    )

    assert "shortest exact answer" in prompt.lower()
    assert "do not add explanations" in prompt.lower()
    assert "Answer about the current lecture only." in prompt


def test_build_answer_prompt_includes_abstention_guidance():
    prompt = _build_answer_prompt(
        "Context excerpt",
        "Who said this?",
        scope_note="Answer about the current lecture only.",
    )

    assert "if the answer is not directly supported" in prompt.lower()
    assert "i don't have enough information" in prompt.lower()
