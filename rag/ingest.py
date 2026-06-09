"""CLI: ingest a video end-to-end.

Usage:
    python -m rag.ingest path/to/video.mp4 --title "Lecture 1" --video-id <uuid>
"""

from __future__ import annotations

import argparse

from rag.pipeline.ingestion import ingest_video


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a video into the RAG pipeline.")
    parser.add_argument("path", help="Path to the video or audio file")
    parser.add_argument("--title", default=None, help="Optional title for the transcript")
    parser.add_argument("--video-id", default=None, help="Optional backend video id to link")
    args = parser.parse_args()

    print(f"Processing '{args.path}' ... (first run downloads the Whisper model)")
    result = ingest_video(args.path, title=args.title, video_id=args.video_id)

    print("\n--- Ingestion complete ---")
    print(f"Transcript ID : {result.transcript_id}")
    print(f"Language      : {result.language} (english={result.is_english})")
    print(f"Duration      : {result.duration_seconds:.1f}s")
    print(f"Original chars: {result.original_chars}")
    print(f"English chars : {result.english_chars}")
    print(f"Chunks indexed: {result.num_chunks}")


if __name__ == "__main__":
    main()
