"""Inspect the ChromaDB vector store.

Usage:
    python -m rag.inspect_db                 # summary of all collections
    python -m rag.inspect_db --limit 5       # show up to 5 stored chunks
    python -m rag.inspect_db --search "..."  # run a similarity search
"""

from __future__ import annotations

import argparse

import chromadb

from rag.config import settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect the ChromaDB store.")
    parser.add_argument("--limit", type=int, default=3, help="How many chunks to preview")
    parser.add_argument("--search", default=None, help="Run a similarity search query")
    parser.add_argument("--full", action="store_true", help="Print full chunk text (no truncation)")
    args = parser.parse_args()

    client = chromadb.PersistentClient(path=settings.chroma_path)
    print(f"ChromaDB path : {settings.chroma_path}")
    print(f"Collections   : {[c.name for c in client.list_collections()]}\n")

    from rag.pipeline.embeddings import LocalEmbeddingFunction

    collection = client.get_collection(
        settings.CHROMA_COLLECTION, embedding_function=LocalEmbeddingFunction()
    )
    print(f"Collection '{collection.name}' -> {collection.count()} chunks\n")

    if args.search:
        res = collection.query(query_texts=[args.search], n_results=args.limit)
        print(f"Top {args.limit} results for: {args.search!r}\n")
        for i, (doc, meta, dist) in enumerate(
            zip(res["documents"][0], res["metadatas"][0], res["distances"][0]), start=1
        ):
            text = doc if args.full else doc[:200] + ("..." if len(doc) > 200 else "")
            print(f"[{i}] distance={dist:.4f} | {meta}\n{text}\n")
        return

    data = collection.get(limit=args.limit, include=["documents", "metadatas"])
    for i, (doc, meta) in enumerate(zip(data["documents"], data["metadatas"]), start=1):
        text = doc if args.full else doc[:200] + ("..." if len(doc) > 200 else "")
        print(f"[{i}] {meta}\n{text}\n")


if __name__ == "__main__":
    main()
