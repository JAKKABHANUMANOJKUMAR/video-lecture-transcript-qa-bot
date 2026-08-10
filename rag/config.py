from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """RAG pipeline settings, loaded from rag/.env."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # CORS (comma-separated; set to your Vercel frontend URL in production)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # PostgreSQL (shared with backend) — set DATABASE_URL in cloud
    DATABASE_URL: str | None = None
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "video_lecture_transcript"

    # Security — MUST match the backend so RAG can validate the same JWTs and
    # scope every transcript / query to the authenticated user.
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"

    # Logging
    LOG_LEVEL: str = "INFO"

    # Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Whisper
    WHISPER_MODEL: str = "base"
    # Opt-in word-level timestamps (slower, more precise citation boundaries).
    WHISPER_WORD_TIMESTAMPS: bool = False

    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # ChromaDB
    CHROMA_DIR: str = "chroma_db"
    CHROMA_COLLECTION: str = "transcripts_multilingual"
    MEDIA_DIR: str = "media"

    # Retrieval / chunking
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 150
    TOP_K: int = 4
    # Drop retrieved chunks whose cosine similarity is below this before
    # answering. 0.0 = keep everything (legacy). Raise (e.g. 0.2) to make the
    # assistant say "not enough information" instead of answering from noise.
    RETRIEVAL_MIN_SIMILARITY: float = 0.0

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            if url.startswith("postgres://"):
                url = "postgresql://" + url[len("postgres://") :]
            if url.startswith("postgresql://"):
                url = "postgresql+psycopg://" + url[len("postgresql://") :]
            return url
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def chroma_path(self) -> str:
        path = Path(self.CHROMA_DIR)
        if not path.is_absolute():
            path = BASE_DIR / path
        return str(path)


    @property
    def media_path(self) -> str:
        path = Path(self.MEDIA_DIR)
        if not path.is_absolute():
            path = BASE_DIR / path
        return str(path)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
