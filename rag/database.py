from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from rag.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    """Declarative base for RAG-owned tables."""


def init_db() -> None:
    """Create RAG tables (transcripts, transcript_chunks) if they don't exist."""
    from rag import models  # noqa: F401  (ensure models are imported/registered)
    from rag.schema_bootstrap import apply_schema_patches

    Base.metadata.create_all(bind=engine)
    apply_schema_patches()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
