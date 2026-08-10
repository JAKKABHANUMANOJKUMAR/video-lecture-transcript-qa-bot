from sqlalchemy import select

from rag.models import Transcript, TranscriptChunk


def test_transcript_ids_use_string_columns_for_postgres() -> None:
    compiled = str(select(Transcript).where(Transcript.id == "demo-transcript"))
    assert "::UUID" not in compiled
    assert Transcript.id.type.python_type is str
    assert TranscriptChunk.id.type.python_type is str
    assert TranscriptChunk.transcript_id.type.python_type is str
