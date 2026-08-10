from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from rag.pipeline.ingestion import ingest_video
from rag.pipeline.rag_chain import answer_question


def normalize_text(text: str | None) -> str:
    if text is None:
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return " ".join(text.split())


def tokenize(text: str | None) -> list[str]:
    return normalize_text(text).split()


def exact_match(prediction: str, reference: str) -> bool:
    return normalize_text(prediction) == normalize_text(reference)


def f1_score(prediction: str, reference: str) -> float:
    pred_tokens = tokenize(prediction)
    ref_tokens = tokenize(reference)
    if not pred_tokens or not ref_tokens:
        return 0.0
    pred_counts: dict[str, int] = {}
    ref_counts: dict[str, int] = {}
    for token in pred_tokens:
        pred_counts[token] = pred_counts.get(token, 0) + 1
    for token in ref_tokens:
        ref_counts[token] = ref_counts.get(token, 0) + 1
    common = 0
    for token, count in pred_counts.items():
        common += min(count, ref_counts.get(token, 0))
    if common == 0:
        return 0.0
    precision = common / len(pred_tokens)
    recall = common / len(ref_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def load_dataset(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()], {}

    data = json.loads(text)
    if isinstance(data, dict):
        if "items" in data:
            items = data.get("items", [])
            metadata = {k: v for k, v in data.items() if k != "items"}
        elif "questions" in data:
            items = data.get("questions", [])
            metadata = {k: v for k, v in data.items() if k != "questions"}
        else:
            items = [data]
            metadata = {}
        return items, metadata

    if isinstance(data, list):
        return data, {}

    raise ValueError(f"Unsupported dataset format in {path}")


def render_sources(sources: list[dict[str, Any]]) -> str:
    lines = []
    for i, source in enumerate(sources, start=1):
        metadata = source.get("metadata") or {}
        preview = source.get("text", "")[:120].replace("\n", " ")
        lines.append(
            f"[{i}] transcript_id={metadata.get('transcript_id')} "
            f"chunk={metadata.get('chunk_index')} dist={source.get('distance'):.4f} "
            f"preview={preview}"
        )
    return "\n".join(lines)


def _flatten_texts(texts: list[str]) -> str:
    return " ".join(normalize_text(t) for t in texts if t)


def _overlap_score(source: str, target: str) -> float:
    source_tokens = tokenize(source)
    target_tokens = tokenize(target)
    if not source_tokens or not target_tokens:
        return 0.0
    source_counts: dict[str, int] = {}
    for token in source_tokens:
        source_counts[token] = source_counts.get(token, 0) + 1
    common = 0
    for token in target_tokens:
        if source_counts.get(token, 0) > 0:
            common += 1
            source_counts[token] -= 1
    return common / len(target_tokens) if target_tokens else 0.0


def _retrieval_metrics(sources: list[dict[str, Any]], reference_answer: str, *, top_k: int | None) -> dict[str, float]:
    if not sources:
        return {"recall_at_k": 0.0, "hit_rate_at_k": 0.0, "mrr": 0.0}

    k = max(1, int(top_k or len(sources)))
    relevant_positions: list[int] = []
    for idx, src in enumerate(sources[:k], start=1):
        if _overlap_score(src.get("text", ""), reference_answer) > 0:
            relevant_positions.append(idx)

    recall_at_k = 1.0 if relevant_positions else 0.0
    mrr = (1.0 / relevant_positions[0]) if relevant_positions else 0.0
    return {"recall_at_k": round(recall_at_k, 3), "hit_rate_at_k": round(recall_at_k, 3), "mrr": round(mrr, 3)}


def evaluate_item(item: dict[str, Any]) -> dict[str, Any]:
    question = item["question"]
    reference_answer = item.get("reference_answer", "")
    transcript_id = item.get("transcript_id")
    video_id = item.get("video_id")
    top_k = item.get("top_k")
    search_all = item.get("search_all", False)

    if not transcript_id and not video_id:
        search_all = True

    result = answer_question(
        question,
        top_k=top_k,
        transcript_id=transcript_id,
        video_id=video_id,
        search_all=search_all,
        user_id=None,
    )

    answer = result.answer.strip()
    sources = result.sources
    exact = exact_match(answer, reference_answer) if reference_answer else None
    f1 = f1_score(answer, reference_answer) if reference_answer else None
    source_text = _flatten_texts([src.get("text", "") for src in sources])
    reference_in_sources = False
    if reference_answer and sources:
        reference_in_sources = any(
            _overlap_score(src.get("text", ""), reference_answer) >= 0.6
            for src in sources
        ) or _overlap_score(source_text, reference_answer) >= 0.6

    answer_faithfulness = _overlap_score(source_text, answer)
    context_precision = 0.0
    if reference_answer and sources:
        matching = 0
        for src in sources:
            if _overlap_score(src.get("text", ""), reference_answer) > 0:
                matching += 1
        context_precision = matching / len(sources) if sources else 0.0
    context_recall = _overlap_score(source_text, reference_answer)
    retrieval_score = context_precision
    retrieval_metrics = _retrieval_metrics(sources, reference_answer, top_k=top_k)

    return {
        "question": question,
        "answer": answer,
        "reference_answer": reference_answer,
        "transcript_id": transcript_id,
        "video_id": video_id,
        "search_all": search_all,
        "top_k": top_k,
        "exact_match": exact,
        "f1": f1,
        "generation_score": f1,
        "faithfulness_score": round(answer_faithfulness, 3),
        "answer_relevancy_score": round(f1 if f1 is not None else 0.0, 3),
        "retrieval_score": round(retrieval_score, 3),
        "context_precision": round(context_precision, 3),
        "context_recall": round(context_recall, 3),
        "recall_at_k": retrieval_metrics["recall_at_k"],
        "hit_rate_at_k": retrieval_metrics["hit_rate_at_k"],
        "mrr": retrieval_metrics["mrr"],
        "reference_in_sources": reference_in_sources,
        "sources": sources,
    }


def generate_report(results: list[dict[str, Any]]) -> str:
    count = len(results)
    exact_matches = sum(1 for row in results if row.get("exact_match") is True)
    f1_values = [row["f1"] for row in results if isinstance(row.get("f1"), float)]
    no_answer_fallback = sum(
        1
        for row in results
        if row["answer"].startswith("I don't have enough information")
        or row["answer"].startswith("I couldn't find anything relevant")
    )
    avg_generation = sum(row.get("generation_score", 0.0) for row in results if isinstance(row.get("generation_score"), float)) / len(results)
    avg_faithfulness = sum(row.get("faithfulness_score", 0.0) for row in results if isinstance(row.get("faithfulness_score"), float)) / len(results)
    avg_retrieval = sum(row.get("retrieval_score", 0.0) for row in results if isinstance(row.get("retrieval_score"), float)) / len(results)
    avg_precision = sum(row.get("context_precision", 0.0) for row in results if isinstance(row.get("context_precision"), float)) / len(results)
    avg_recall = sum(row.get("context_recall", 0.0) for row in results if isinstance(row.get("context_recall"), float)) / len(results)
    avg_recall_at_k = sum(row.get("recall_at_k", 0.0) for row in results if isinstance(row.get("recall_at_k"), (int, float))) / len(results)
    avg_hit_rate_at_k = sum(row.get("hit_rate_at_k", 0.0) for row in results if isinstance(row.get("hit_rate_at_k"), (int, float))) / len(results)
    avg_mrr = sum(row.get("mrr", 0.0) for row in results if isinstance(row.get("mrr"), (int, float))) / len(results)
    source_coverage = sum(1 for row in results if row.get("reference_in_sources") is True) / len(results)

    lines = [
        "=== Evaluation Summary ===",
        f"Questions evaluated: {count}",
        f"Exact match: {exact_matches}/{count}",
        f"Average F1: {sum(f1_values) / len(f1_values):.3f}" if f1_values else "Average F1: N/A",
        f"Average generation score: {avg_generation:.3f}",
        f"Average faithfulness score: {avg_faithfulness:.3f}",
        f"Average retrieval score: {avg_retrieval:.3f}",
        f"Average context precision: {avg_precision:.3f}",
        f"Average context recall: {avg_recall:.3f}",
        f"Average Recall@k: {avg_recall_at_k:.3f}",
        f"Average Hit Rate (Hit@k): {avg_hit_rate_at_k:.3f}",
        f"Average MRR: {avg_mrr:.3f}",
        f"No-answer fallback responses: {no_answer_fallback}/{count}",
        f"Reference answer covered by sources: {source_coverage:.3f}",
    ]

    conclusion = ""
    if avg_generation >= 0.6 and avg_faithfulness >= 0.6 and avg_retrieval >= 0.6:
        conclusion = "Overall: The model appears strong on this dataset."
    elif avg_generation >= 0.4 and avg_faithfulness >= 0.4 and avg_retrieval >= 0.4:
        conclusion = "Overall: The model is moderate and may need tuning or more data."
    else:
        conclusion = "Overall: The model is weak on this dataset and needs improvement."

    lines.append(conclusion)
    lines.append("==========================\n")

    for index, row in enumerate(results, start=1):
        lines.append(f"Question {index}: {row['question']}")
        lines.append(f"Answer: {row['answer']}")
        if row["reference_answer"]:
            lines.append(f"Reference: {row['reference_answer']}")
            lines.append(f"Exact match: {row['exact_match']}")
            lines.append(f"F1: {row['f1']:.3f}")
            lines.append(f"Generation score: {row['generation_score']:.3f}")
            lines.append(f"Faithfulness score: {row['faithfulness_score']:.3f}")
            lines.append(f"Answer relevancy score: {row['answer_relevancy_score']:.3f}")
            lines.append(f"Retrieval score: {row['retrieval_score']:.3f}")
            lines.append(f"Context precision: {row['context_precision']:.3f}")
            lines.append(f"Context recall: {row['context_recall']:.3f}")
            lines.append(f"Recall@k: {row['recall_at_k']:.3f}")
            lines.append(f"Hit Rate (Hit@k): {row['hit_rate_at_k']:.3f}")
            lines.append(f"MRR: {row['mrr']:.3f}")
            lines.append(f"Reference in sources: {row['reference_in_sources']}")
        lines.append("Sources:")
        lines.append(render_sources(row["sources"]))
        lines.append("-" * 80)

    return "\n".join(lines)


def write_text_report(results: list[dict[str, Any]], path: Path) -> None:
    path.write_text(generate_report(results), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate the RAG answer pipeline on a labeled QA dataset."
    )
    parser.add_argument(
        "dataset",
        type=Path,
        help="Path to a JSON or JSONL file containing question/answer examples.",
    )
    parser.add_argument(
        "--video-path",
        type=Path,
        default=None,
        help="Optional video or audio file to ingest before evaluation.",
    )
    parser.add_argument(
        "--title",
        default=None,
        help="Optional title to assign when ingesting the video.",
    )
    parser.add_argument(
        "--video-id",
        default=None,
        help="Optional backend video id to assign when ingesting the video.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to write the raw evaluation results as JSON.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Optional path to write a text report containing metrics.",
    )
    args = parser.parse_args()

    transcript_id: str | None = None
    if args.video_path:
        print(f"Ingesting video: {args.video_path}")
        ingestion = ingest_video(
            str(args.video_path),
            title=args.title,
            video_id=args.video_id,
        )
        transcript_id = ingestion.transcript_id
        print(f"Ingested transcript_id={transcript_id}")

    dataset, metadata = load_dataset(args.dataset)
    if not dataset:
        raise SystemExit("Dataset is empty or could not be loaded.")

    if transcript_id is not None:
        for item in dataset:
            if not item.get("transcript_id") and not item.get("video_id"):
                item["transcript_id"] = transcript_id

    if metadata:
        print(f"Dataset metadata: {metadata}")

    results = [evaluate_item(item) for item in dataset]
    report_content = generate_report(results)
    print(report_content)

    if args.output:
        args.output.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    if args.report:
        write_text_report(results, args.report)
    elif args.output and args.output.suffix.lower() == ".json":
        fallback_report = args.output.with_suffix(".txt")
        write_text_report(results, fallback_report)


if __name__ == "__main__":
    main()
