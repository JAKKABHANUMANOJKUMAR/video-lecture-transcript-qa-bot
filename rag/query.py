"""CLI: ask a question against the ingested transcripts.

Usage:
    python -m rag.query "What is gradient descent?"
    python -m rag.query "..." --video-id <uuid> --top-k 5
"""

from __future__ import annotations

import argparse

from rag.pipeline.rag_chain import answer_question


def main() -> None:
    parser = argparse.ArgumentParser(description="Ask a question over the lecture transcripts.")
    parser.add_argument("question", help="Your question")
    parser.add_argument("--video-id", default=None, help="Scope retrieval to one video")
    parser.add_argument("--transcript-id", default=None, help="Scope retrieval to one transcript")
    parser.add_argument("--top-k", type=int, default=None, help="Number of chunks to retrieve")
    args = parser.parse_args()

    result = answer_question(
        args.question,
        top_k=args.top_k,
        video_id=args.video_id,
        transcript_id=args.transcript_id,
    )

    print("\n=== Answer ===")
    print(result.answer)
    print("\n=== Sources ===")
    for i, src in enumerate(result.sources, start=1):
        meta = src.get("metadata", {})
        preview = src["text"][:120].replace("\n", " ")
        print(f"[{i}] dist={src.get('distance'):.4f} chunk#{meta.get('chunk_index')}: {preview}...")


if __name__ == "__main__":
    main()
