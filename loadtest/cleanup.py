"""Remove everything a load-test run created.

A run leaves behind accounts, videos, chat sessions, transcripts, ChromaDB
vectors and (with upload salting) one media file per ingest. Left alone that
grows without limit and skews the admin analytics, so clean up after each run.

Shows what it found and does nothing unless you pass --yes:

    rag\\.venv\\Scripts\\python.exe loadtest\\cleanup.py          # report only
    rag\\.venv\\Scripts\\python.exe loadtest\\cleanup.py --yes    # actually delete

Must run with the RAG virtualenv — it needs chromadb to drop the vectors.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Running as `python loadtest/cleanup.py` puts loadtest/ on the path, not the
# repo root, so the `rag` package would not import without this.
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import text  # noqa: E402

from config import USER_DOMAIN, USER_PREFIX  # noqa: E402
from rag.config import settings  # noqa: E402
from rag.database import SessionLocal  # noqa: E402
from rag.models import Transcript  # noqa: E402
from rag.pipeline.vectorstore import delete_transcript as drop_vectors  # noqa: E402

EMAIL_LIKE = f"{USER_PREFIX}%@{USER_DOMAIN}"
LOADTEST_CHAT_TITLE = "Load test session"


def main(commit: bool) -> None:
    db = SessionLocal()
    try:
        user_ids = [
            str(r[0])
            for r in db.execute(
                text("select id from users where email like :pat"), {"pat": EMAIL_LIKE}
            )
        ]
        transcripts = (
            db.query(Transcript).filter(Transcript.user_id.in_(user_ids)).all()
            if user_ids
            else []
        )
        stray_chats = db.execute(
            text("select count(*) from chat_sessions where title = :t"),
            {"t": LOADTEST_CHAT_TITLE},
        ).scalar()

        videos = chats = 0
        if user_ids:
            videos = db.execute(
                text("select count(*) from videos where user_id::text = any(:ids)"),
                {"ids": user_ids},
            ).scalar()
            chats = db.execute(
                text("select count(*) from chat_sessions where user_id::text = any(:ids)"),
                {"ids": user_ids},
            ).scalar()

        print(f"accounts matching {EMAIL_LIKE!r}: {len(user_ids)}")
        print(f"  their videos:        {videos}")
        print(f"  their chat sessions: {chats}")
        print(f"  their transcripts:   {len(transcripts)}  (+ vectors and media files)")
        print(f"chat sessions titled {LOADTEST_CHAT_TITLE!r} on any account: {stray_chats}")

        if not commit:
            print("\nReport only. Re-run with --yes to delete.")
            return

        if not user_ids and not transcripts and not stray_chats:
            print("\nNothing to do.")
            return

        media_dir = Path(settings.media_path)
        removed_files = 0
        for t in transcripts:
            # Vectors and media are outside Postgres, so they need explicit
            # removal before the row that points at them disappears.
            try:
                drop_vectors(t.id)
            except Exception as exc:
                print(f"  warning: vectors for {t.id[:8]} — {exc}")
            for key in filter(None, (t.id, t.video_id)):
                for f in media_dir.glob(f"{key}.*"):
                    f.unlink(missing_ok=True)
                    removed_files += 1
            db.delete(t)  # cascades to transcript_chunks

        db.execute(
            text("delete from chat_sessions where title = :t"), {"t": LOADTEST_CHAT_TITLE}
        )
        if user_ids:
            # Videos, chats and complaints cascade from the user row.
            db.execute(
                text("delete from users where id::text = any(:ids)"), {"ids": user_ids}
            )
        db.commit()

        print(
            f"\nDeleted {len(user_ids)} accounts, {len(transcripts)} transcripts "
            f"and {removed_files} media files."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main(commit="--yes" in sys.argv)
