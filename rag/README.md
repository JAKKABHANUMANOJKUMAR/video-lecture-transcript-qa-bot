# RAG Pipeline — Video Lecture Transcript Q&A

End-to-end retrieval-augmented generation pipeline for video lectures.

## Pipeline flow

```
video file
   │  (1) Whisper extracts audio (ffmpeg) + transcribes
   ▼
original-language text  ──(detect language)
   │  (1b) if not English → Whisper translate task → English text
   ▼
PostgreSQL `transcripts` table   (original_text + english_text)   ← step 2
   │  (3) chunk the English text (sentence-aware, overlapping)
   ▼
local embeddings (sentence-transformers all-MiniLM-L6-v2)
   │  (4) store vectors
   ▼
ChromaDB (persistent)
   │  (5) question → similarity search → top-k chunks → Groq LLM
   ▼
grounded answer
```

## Components

| File | Responsibility |
|------|----------------|
| `config.py` | Settings from `rag/.env` (DB, Groq, Whisper, Chroma) |
| `database.py` / `models.py` | SQLAlchemy + `transcripts`, `transcript_chunks` tables |
| `pipeline/transcription.py` | Whisper: audio extract, transcribe, detect language, translate |
| `pipeline/ingestion.py` | Save transcript to DB, chunk, embed, index |
| `pipeline/chunking.py` | Sentence-aware overlapping chunker |
| `pipeline/embeddings.py` | Local sentence-transformers embedding function |
| `pipeline/vectorstore.py` | ChromaDB persistent collection (add / query) |
| `pipeline/rag_chain.py` | Retrieve + Groq answer generation |
| `ingest.py` / `query.py` | CLI entrypoints |
| `app.py` | Optional FastAPI service (`/ingest`, `/query`) |

## Prerequisites

1. **Python 3.10+**
2. **ffmpeg** installed and on PATH (required by Whisper to read video/audio)
   - Windows: `winget install Gyan.FFmpeg` (or `choco install ffmpeg`)
3. **PostgreSQL** running with the `video_lecture_transcript` database (shared with the backend)
4. A **Groq API key** — free at https://console.groq.com/keys

## Setup (Windows PowerShell)

```powershell
cd rag

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Add your Groq key to rag/.env
#   GROQ_API_KEY=gsk_...
```

> First run downloads the Whisper model and the embedding model (a few hundred MB).

## Usage

### Ingest a video (steps 1-4)

```powershell
python -m rag.ingest "C:\path\to\lecture.mp4" --title "Lecture 1"
```

This extracts audio, transcribes (original + English), saves both to PostgreSQL,
chunks the English text, embeds it locally, and stores vectors in ChromaDB.

### Ask a question (step 5)

```powershell
python -m rag.query "Explain the main idea of the lecture"
# scope to a single video/transcript:
python -m rag.query "..." --transcript-id <id> --top-k 5
```

### Run as an HTTP service (optional)

```powershell
cd rag
uvicorn app:app --reload --port 8100
```

- `POST /ingest` — multipart upload (`file`, optional `title`, `video_id`)
- `POST /query` — JSON `{ "question": "...", "video_id": "...", "top_k": 4 }`

## Configuration (`rag/.env`)

| Variable | Default | Notes |
|----------|---------|-------|
| `WHISPER_MODEL` | `base` | `tiny`/`base`/`small`/`medium`/`large-v3` (larger = better + slower) |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | local, no API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | any Groq-supported chat model |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `150` | characters |
| `TOP_K` | `4` | chunks retrieved per query |
| `CHROMA_DIR` | `chroma_db` | persistent vector store location |

## Notes

- Transcripts are stored in the **same PostgreSQL database** as the backend, in new
  `transcripts` / `transcript_chunks` tables (auto-created on first ingest).
- Embeddings run **locally** (no API cost). Only answer generation calls Groq.
- The vector store keeps all videos in one collection; retrieval can be scoped per
  video via `video_id` / `transcript_id` metadata filters.
```
