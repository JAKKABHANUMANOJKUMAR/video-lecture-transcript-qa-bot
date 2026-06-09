import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rag.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Transcript(Base):
    """Stores the text extracted from a video: original language + English translation."""

    __tablename__ = "transcripts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    # Optional link to the backend `videos` table (kept loose to avoid coupling).
    video_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    source_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)

    language: Mapped[str] = mapped_column(String(16), default="unknown")  # detected language code
    is_english: Mapped[bool] = mapped_column(Boolean, default=False)

    original_text: Mapped[str] = mapped_column(Text, default="")
    english_text: Mapped[str] = mapped_column(Text, default="")

    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="completed")  # processing|completed|failed
    indexed: Mapped[bool] = mapped_column(Boolean, default=False)  # embedded into ChromaDB?

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    chunks: Mapped[list["TranscriptChunk"]] = relationship(
        back_populates="transcript", cascade="all, delete-orphan"
    )


class TranscriptChunk(Base):
    """A text chunk of the English transcript that was embedded into the vector store."""

    __tablename__ = "transcript_chunks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    transcript_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("transcripts.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transcript: Mapped["Transcript"] = relationship(back_populates="chunks")
