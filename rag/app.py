"""Optional FastAPI service exposing the RAG pipeline over HTTP.

Run:
    uvicorn rag.app:app --reload --port 8100

Endpoints:
    POST /ingest              (multipart upload) -> returns job_id, processes in background
    GET  /ingest/status/{id}  -> poll progress percent / stage / result
    POST /query               (json: question) -> retrieve + Groq answer
    GET  /health
"""

from __future__ import annotations

import logging
import re
import shutil
import tempfile
import time
from pathlib import Path

import chromadb
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy import or_

from rag.auth import get_optional_user_id
from rag.config import settings
from rag.database import SessionLocal
from rag.models import Transcript
from rag.pipeline.embeddings import LocalEmbeddingFunction
from rag.pipeline.formatting import safe_filename
from rag.pipeline.ingestion import (
    delete_by_video,
    delete_transcript_everywhere,
    find_reusable_transcript,
    ingest_video,
)
from rag.pipeline.progress import progress_store
from rag.pipeline.rag_chain import answer_question
from rag.pipeline.url_download import (
    cleanup_download,
    detect_source,
    download_video,
    extract_title_from_url,
    is_gdrive_folder_url,
)
from rag.pipeline.vectorstore import query as vector_query

app = FastAPI(title="Lekta RAG Service", version="1.0.0")

logger = logging.getLogger("rag_service")
logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"))
    logger.addHandler(handler)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info("incoming request: %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.info("completed request: %s %s status=%s duration_ms=%.2f", request.method, request.url.path, response.status_code, duration_ms)
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.exception("failed request: %s %s duration_ms=%.2f error=%s", request.method, request.url.path, duration_ms, exc)
        raise


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _ensure_schema() -> None:
    """Create RAG tables and apply schema patches before serving requests.

    Without this, a request that touches a newer column (e.g. the URL-dedup
    check on ``source_url``) can reach the DB before ``init_db()`` has run,
    failing with "column does not exist" on databases created by an older
    version. Best-effort: a DB hiccup shouldn't stop the service from starting.
    """
    from rag.database import init_db

    try:
        init_db()
    except Exception as exc:  # pragma: no cover - startup best effort
        print(f"[rag] startup schema init failed: {exc}")


class QueryRequest(BaseModel):
    question: str
    video_id: str | None = None
    transcript_id: str | None = None
    top_k: int | None = None
    search_all: bool = False


class IngestJobResponse(BaseModel):
    job_id: str


class IngestUrlRequest(BaseModel):
    url: str
    title: str | None = None
    video_id: str | None = None


class IngestStatusResponse(BaseModel):
    job_id: str
    status: str
    percent: int
    stage: str
    message: str
    error: str | None = None
    result: dict | None = None


def _persist_upload(src_path: str, media_key: str) -> str:
    media_dir = Path(settings.media_path)
    media_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(src_path).suffix or ".mp4"
    dest = media_dir / f"{media_key}{suffix}"
    shutil.copy2(src_path, dest)
    return str(dest)


def _run_ingest_job(
    job_id: str,
    path: str,
    title: str | None,
    video_id: str | None,
    user_id: str | None = None,
) -> None:
    ingest_path = path
    try:
        progress_store.update(job_id, 15, "processing", "File received — starting pipeline…")
        if video_id:
            ingest_path = _persist_upload(path, video_id)
        result = ingest_video(
            ingest_path,
            title=title,
            video_id=video_id,
            user_id=user_id,
            on_progress=progress_store.callback(job_id),
        )
        if not video_id:
            _persist_upload(path, result.transcript_id)
        progress_store.complete(
            job_id,
            {
                "transcript_id": result.transcript_id,
                "language": result.language,
                "is_english": result.is_english,
                "duration_seconds": result.duration_seconds,
                "num_chunks": result.num_chunks,
                "media_key": result.media_key,
                "title": title,
                "audio_extract_seconds": getattr(result, "audio_extract_seconds", None),
                "transcribe_seconds": getattr(result, "transcribe_seconds", None),
                "embedding_seconds": getattr(result, "embedding_seconds", None),
            },
        )
    except Exception as exc:
        progress_store.fail(job_id, str(exc))
    finally:
        Path(path).unlink(missing_ok=True)


def _get_chroma_client():
    return chromadb.PersistentClient(path=settings.chroma_path)


def _get_collection(name: str | None = None):
    client = _get_chroma_client()
    ef = LocalEmbeddingFunction()
    target = name or settings.CHROMA_COLLECTION
    try:
        return client.get_collection(target, embedding_function=ef)
    except Exception:
        cols = client.list_collections()
        if cols:
            return client.get_collection(cols[0].name, embedding_function=ef)
        return client.get_or_create_collection(
            target, embedding_function=ef, metadata={"hnsw:space": "cosine"}
        )


def _vector_summary(values: list[float], preview: int = 16) -> dict:
    if values is None or len(values) == 0:
        return {"dimensions": 0, "preview": [], "min": 0, "max": 0, "norm": 0}
    floats = [float(v) for v in values]
    preview_vals = [round(v, 6) for v in floats[:preview]]
    norm = sum(v ** 2 for v in floats) ** 0.5
    return {
        "dimensions": len(floats),
        "preview": preview_vals,
        "min": round(min(floats), 6),
        "max": round(max(floats), 6),
        "norm": round(norm, 6),
    }


def _chunk_payload(doc: str, meta: dict, embedding: list[float] | None, distance: float | None, *, full_vector: bool):
    item = {
        "text": doc,
        "metadata": meta,
        "distance": distance,
        "embedding_model": settings.EMBEDDING_MODEL,
    }
    if embedding is None:
        item["vector"] = None
        return item
    item["vector"] = _vector_summary(embedding)
    if full_vector:
        item["vector"]["values"] = [round(float(v), 6) for v in embedding]
    return item


@app.get("/health")
def health():
    logger.info("healthcheck requested")
    return {"status": "healthy"}


def _transcript_for_media_key(media_id: str) -> Transcript | None:
    """A media key is either a backend video id or a transcript id."""
    db = SessionLocal()
    try:
        return (
            db.query(Transcript)
            .filter(or_(Transcript.video_id == media_id, Transcript.id == media_id))
            .first()
        )
    finally:
        db.close()


@app.get("/media/{media_id}")
def serve_media(media_id: str, download: bool = False):
    """Stream a stored lecture. ``?download=1`` sends it as a named attachment."""
    media_dir = Path(settings.media_path)
    if not media_dir.exists():
        raise HTTPException(status_code=404, detail="Media not found")
    matches = list(media_dir.glob(f"{media_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Media not found")

    path = matches[0]
    if not download:
        # Default stays inline so the player can range-request it.
        return FileResponse(path)

    transcript = _transcript_for_media_key(media_id)
    stem = safe_filename(transcript.title if transcript else None, media_id)
    return FileResponse(path, filename=f"{stem}{path.suffix}")


@app.get("/viewer", response_class=HTMLResponse)
def chroma_viewer():
    """Browser UI to browse ChromaDB chunks and embedding vectors."""
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ChromaDB Vector Viewer — Lekta</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    header { padding: 1.25rem 1.5rem; background: #1e293b; border-bottom: 1px solid #334155; }
    h1 { margin: 0; font-size: 1.25rem; }
    .sub { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }
    main { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1rem; }
    .card .label { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; }
    .card .value { font-size: 1.35rem; font-weight: 700; margin-top: 0.25rem; word-break: break-all; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; align-items: center; }
    input, select { padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; }
    input { flex: 1; min-width: 220px; }
    button { padding: 0.75rem 1.1rem; border-radius: 8px; border: none; background: #6366f1; color: white; font-weight: 600; cursor: pointer; }
    button.secondary { background: #475569; }
    button.ghost { background: transparent; border: 1px solid #475569; color: #cbd5e1; font-weight: 500; padding: 0.35rem 0.65rem; font-size: 0.8rem; }
    .chunk { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; }
    .meta { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem; line-height: 1.6; }
    .text { white-space: pre-wrap; line-height: 1.5; font-size: 0.9rem; margin-bottom: 0.75rem; }
    .dist { color: #34d399; font-weight: 600; }
    .vector-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 0.75rem; }
    .vector-title { font-size: 0.75rem; color: #a5b4fc; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; }
    .vector-stats { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem; }
    .vector-preview { font-family: ui-monospace, monospace; font-size: 0.72rem; line-height: 1.6; color: #fde68a; word-break: break-all; }
    .vector-bars { display: flex; align-items: flex-end; gap: 2px; height: 48px; margin: 0.5rem 0; }
    .vector-bars span { flex: 1; min-width: 3px; background: linear-gradient(to top, #6366f1, #a78bfa); border-radius: 2px 2px 0 0; }
    .vector-full { display: none; margin-top: 0.5rem; max-height: 180px; overflow: auto; font-family: ui-monospace, monospace; font-size: 0.7rem; color: #cbd5e1; white-space: pre-wrap; }
    .vector-full.open { display: block; }
    .empty { color: #94a3b8; text-align: center; padding: 2rem; }
    label { font-size: 0.8rem; color: #94a3b8; display: flex; align-items: center; gap: 0.35rem; }
  </style>
</head>
<body>
  <header>
    <h1>ChromaDB Vector Viewer</h1>
    <div class="sub" id="path"></div>
  </header>
  <main>
    <div class="stats" id="stats"></div>
    <div class="toolbar">
      <input id="q" placeholder="Similarity search (e.g. why is python popular?)" />
      <button onclick="search()">Search</button>
      <button class="secondary" onclick="loadAll()">Browse chunks</button>
      <select id="limit" onchange="loadAll()">
        <option value="10">10 chunks</option>
        <option value="20" selected>20 chunks</option>
        <option value="50">50 chunks</option>
      </select>
      <label><input type="checkbox" id="fullVector" /> Show full 384-d vector</label>
    </div>
    <div id="chunks"></div>
  </main>
  <script>
    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function barHeights(preview) {
      const max = Math.max(...preview.map(Math.abs), 0.001);
      return preview.map(v => Math.max(4, Math.round((Math.abs(v) / max) * 48)));
    }
    function renderVector(v, idx) {
      if (!v) return '<div class="vector-box"><div class="vector-title">Vector</div><div class="vector-preview">No embedding stored for this chunk.</div></div>';
      const bars = barHeights(v.preview).map(h => `<span style="height:${h}px"></span>`).join('');
      const full = document.getElementById('fullVector').checked && v.values;
      const fullHtml = full
        ? `<div class="vector-full open">${v.values.join(', ')}</div>`
        : `<button class="ghost" onclick="toggleVector(${idx})">Show all ${v.dimensions} numbers</button><div class="vector-full" id="vec-${idx}"></div>`;
      return `<div class="vector-box">
        <div class="vector-title">Embedding vector</div>
        <div class="vector-stats">
          <span>dims: <strong style="color:#e2e8f0">${v.dimensions}</strong></span>
          <span>min: ${v.min}</span>
          <span>max: ${v.max}</span>
          <span>L2 norm: ${v.norm}</span>
        </div>
        <div class="vector-bars">${bars}</div>
        <div class="vector-preview">[${v.preview.join(', ')}${v.dimensions > v.preview.length ? ', …' : ''}]</div>
        ${fullHtml}
      </div>`;
    }
    function toggleVector(idx) {
      const el = document.getElementById('vec-' + idx);
      if (!el || el.classList.contains('open')) return;
      fetch('/api/chroma/chunks?limit=1&offset=' + idx + '&include_embeddings=true&full_vector=true')
        .then(r => r.json())
        .then(d => {
          const v = d.chunks[0]?.vector;
          if (v?.values) {
            el.textContent = v.values.join(', ');
            el.classList.add('open');
          }
        });
    }
    function renderChunks(items) {
      const el = document.getElementById('chunks');
      if (!items.length) { el.innerHTML = '<div class="empty">No chunks found.</div>'; return; }
      const showFull = document.getElementById('fullVector').checked;
      el.innerHTML = items.map((c, i) => `
        <div class="chunk">
          <div class="meta">#${i+1}
            ${c.distance != null ? `<span class="dist">distance: ${c.distance.toFixed(4)}</span> · ` : ''}
            id: ${escapeHtml(c.metadata?.id || '—')} ·
            transcript: ${escapeHtml(c.metadata?.transcript_id || '—')} ·
            chunk: ${c.metadata?.chunk_index ?? '—'} · lang: ${escapeHtml(c.metadata?.language || '—')}
          </div>
          <div class="text">${escapeHtml(c.text)}</div>
          ${renderVector(c.vector, i)}
        </div>`).join('');
      if (showFull) return;
    }
    async function loadStats() {
      const r = await fetch('/api/chroma/stats');
      const d = await r.json();
      document.getElementById('path').textContent = d.path + ' · model: ' + d.embedding_model;
      document.getElementById('stats').innerHTML = `
        <div class="card"><div class="label">Chunks</div><div class="value">${d.count}</div></div>
        <div class="card"><div class="label">Transcripts</div><div class="value">${d.transcripts}</div></div>
        <div class="card"><div class="label">Collection</div><div class="value" style="font-size:1rem">${d.collection}</div></div>
        <div class="card"><div class="label">Vector dims</div><div class="value">${d.vector_dimensions}</div></div>`;
    }
    async function loadAll() {
      const limit = document.getElementById('limit').value;
      const full = document.getElementById('fullVector').checked;
      const r = await fetch('/api/chroma/chunks?limit=' + limit + '&include_embeddings=true&full_vector=' + full);
      const d = await r.json();
      renderChunks(d.chunks);
    }
    async function search() {
      const q = document.getElementById('q').value.trim();
      if (!q) return loadAll();
      const full = document.getElementById('fullVector').checked;
      const r = await fetch('/api/chroma/search?q=' + encodeURIComponent(q) + '&include_embeddings=true&full_vector=' + full);
      const d = await r.json();
      renderChunks(d.chunks);
    }
    loadStats(); loadAll();
    document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
    document.getElementById('fullVector').addEventListener('change', () => loadAll());
  </script>
</body>
</html>"""


@app.get("/api/chroma/stats")
def chroma_stats():
    col = _get_collection()
    data = col.get(include=["metadatas", "embeddings"], limit=1)
    transcript_ids = set()
    all_meta = col.get(include=["metadatas"])["metadatas"]
    for m in all_meta:
        if m.get("transcript_id"):
            transcript_ids.add(m["transcript_id"])
    embeddings = data.get("embeddings")
    sample_emb = embeddings[0] if embeddings is not None and len(embeddings) > 0 else None
    dims = len(sample_emb) if sample_emb is not None else 384
    return {
        "path": settings.chroma_path,
        "collection": col.name,
        "count": col.count(),
        "transcripts": len(transcript_ids),
        "embedding_model": settings.EMBEDDING_MODEL,
        "vector_dimensions": dims,
    }


@app.get("/api/chroma/chunks")
def chroma_chunks(
    limit: int = Query(default=20, le=200),
    offset: int = Query(default=0, ge=0),
    include_embeddings: bool = Query(default=True),
    full_vector: bool = Query(default=False),
):
    col = _get_collection()
    include = ["documents", "metadatas"]
    if include_embeddings:
        include.append("embeddings")
    data = col.get(limit=limit, offset=offset, include=include)
    docs = data["documents"]
    metas = data["metadatas"]
    ids = data.get("ids") or [None] * len(docs)
    raw_embeddings = data.get("embeddings") if include_embeddings else None
    if raw_embeddings is None:
        raw_embeddings = [None] * len(docs)
    chunks = []
    for doc, meta, emb, chunk_id in zip(docs, metas, raw_embeddings, ids):
        meta = dict(meta or {})
        if chunk_id:
            meta["id"] = chunk_id
        chunks.append(
            _chunk_payload(doc, meta, emb, None, full_vector=full_vector and include_embeddings)
        )
    return {"chunks": chunks}


@app.get("/api/chroma/search")
def chroma_search(
    q: str = Query(..., min_length=1),
    top_k: int = Query(default=5, le=20),
    include_embeddings: bool = Query(default=True),
    full_vector: bool = Query(default=False),
):
    hits = vector_query(q, top_k=top_k)
    if not include_embeddings:
        return {
            "chunks": [
                {"text": h["text"], "metadata": h["metadata"], "distance": h["distance"], "vector": None}
                for h in hits
            ]
        }

    col = _get_collection()
    chunks = []
    for h in hits:
        meta = dict(h.get("metadata") or {})
        chunk_id = f"{meta.get('transcript_id')}:{meta.get('variant', 'primary')}:{meta.get('chunk_index')}"
        try:
            got = col.get(ids=[chunk_id], include=["embeddings"])
            raw = got.get("embeddings")
            emb = raw[0] if raw is not None and len(raw) > 0 else None
        except Exception:
            emb = None
        meta["id"] = chunk_id
        chunks.append(_chunk_payload(h["text"], meta, emb, h.get("distance"), full_vector=full_vector))
    return {"chunks": chunks}


@app.post("/ingest", response_model=IngestJobResponse)
async def ingest(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    video_id: str | None = Form(default=None),
    user_id: str | None = Depends(get_optional_user_id),
):
    """Upload a video and start background processing. Poll GET /ingest/status/{job_id}."""
    suffix = Path(file.filename or "upload").suffix or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    job_id = progress_store.create()
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()
        logger.info("started ingest job job_id=%s video_id=%s user_id=%s filename=%s", job_id, video_id, user_id, file.filename)
        background_tasks.add_task(
            _run_ingest_job, job_id, tmp.name, title or file.filename, video_id, user_id
        )
    except Exception as exc:
        logger.exception("ingest failed job_id=%s video_id=%s user_id=%s", job_id, video_id, user_id)
        Path(tmp.name).unlink(missing_ok=True)
        progress_store.fail(job_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return IngestJobResponse(job_id=job_id)


def _complete_from_transcript(job_id: str, transcript: Transcript, num_chunks: int) -> None:
    progress_store.complete(
        job_id,
        {
            "transcript_id": transcript.id,
            "language": transcript.language,
            "is_english": transcript.is_english,
            "duration_seconds": float(transcript.duration_seconds or 0),
            "num_chunks": num_chunks,
            "media_key": transcript.video_id or transcript.id,
            "title": transcript.title,
        },
    )


def _run_url_ingest_job(
    job_id: str,
    url: str,
    title: str | None,
    video_id: str | None,
    user_id: str | None = None,
) -> None:
    downloaded_path: str | None = None
    try:
        # Skip the (slow) download entirely if this URL was already ingested.
        db = SessionLocal()
        try:
            existing = find_reusable_transcript(db, user_id=user_id, source_url=url)
            if existing is not None:
                num_chunks = len(existing.chunks)
                _complete_from_transcript(job_id, existing, num_chunks)
                return
        finally:
            db.close()

        progress_store.update(job_id, 5, "downloading", "Downloading video from URL…")
        downloaded_path, detected_title = download_video(
            url,
            on_progress=lambda pct, msg: progress_store.update(
                job_id, min(5 + int(pct * 0.10), 15), "downloading", msg
            ),
        )
        final_title = title or detected_title
        progress_store.update(job_id, 15, "processing", "Download complete — starting pipeline…")

        ingest_path = downloaded_path
        if video_id:
            ingest_path = _persist_upload(downloaded_path, video_id)

        result = ingest_video(
            ingest_path,
            title=final_title,
            video_id=video_id,
            user_id=user_id,
            source_url=url,
            on_progress=progress_store.callback(job_id),
        )
        if not video_id:
            _persist_upload(downloaded_path, result.transcript_id)
        progress_store.complete(
            job_id,
            {
                "transcript_id": result.transcript_id,
                "language": result.language,
                "is_english": result.is_english,
                "duration_seconds": result.duration_seconds,
                "num_chunks": result.num_chunks,
                "media_key": result.media_key,
                "title": final_title,
            },
        )
    except Exception as exc:
        progress_store.fail(job_id, str(exc))
    finally:
        cleanup_download(downloaded_path)


@app.post("/ingest/url", response_model=IngestJobResponse)
async def ingest_url(
    req: IngestUrlRequest,
    background_tasks: BackgroundTasks,
    user_id: str | None = Depends(get_optional_user_id),
):
    """Accept a YouTube or Google Drive URL and start background processing."""
    source = detect_source(req.url)
    if source == "unknown":
        raise HTTPException(
            status_code=400,
            detail="Unsupported URL. Please provide a YouTube or Google Drive link.",
        )
    # Recognisable but unusable — say so now instead of failing a job later.
    if is_gdrive_folder_url(req.url):
        raise HTTPException(
            status_code=400,
            detail=(
                "That link points to a Google Drive folder, not a video. Open the "
                "video itself in Drive, use Share → Copy link, and paste that."
            ),
        )

    job_id = progress_store.create()
    logger.info("started url ingest job job_id=%s video_id=%s user_id=%s url=%s", job_id, req.video_id, user_id, req.url)
    background_tasks.add_task(
        _run_url_ingest_job, job_id, req.url, req.title, req.video_id, user_id
    )
    return IngestJobResponse(job_id=job_id)


@app.get("/ingest/status/{job_id}", response_model=IngestStatusResponse)
def ingest_status(job_id: str):
    job = progress_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return IngestStatusResponse(
        job_id=job.job_id,
        status=job.status,
        percent=job.percent,
        stage=job.stage,
        message=job.message,
        error=job.error,
        result=job.result,
    )


@app.post("/query")
def query(req: QueryRequest, user_id: str | None = Depends(get_optional_user_id)):
    if not req.question.strip():
        logger.warning("query rejected: empty question user_id=%s", user_id)
        raise HTTPException(status_code=400, detail="Question must not be empty")
    try:
        logger.info("processing query user_id=%s video_id=%s transcript_id=%s search_all=%s", user_id, req.video_id, req.transcript_id, req.search_all)
        result = answer_question(
            req.question,
            top_k=req.top_k,
            video_id=req.video_id,
            transcript_id=req.transcript_id,
            search_all=req.search_all,
            user_id=user_id,
        )
    except Exception as exc:
        logger.exception("query failed user_id=%s question=%s", user_id, req.question)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info("query completed user_id=%s answer_length=%s", user_id, len(result.answer or ""))
    return {
        "answer": result.answer,
        "sources": result.sources,
    }


def _transcript_payload(t: Transcript) -> dict:
    return {
        "transcript_id": t.id,
        "title": t.title,
        "language": t.language,
        "is_english": t.is_english,
        "duration_seconds": t.duration_seconds,
        "original_text": t.original_text,
        "english_text": t.english_text,
        "source_url": t.source_url,
    }


@app.get("/transcript/by-video/{video_id}")
def get_transcript_by_video(
    video_id: str, user_id: str | None = Depends(get_optional_user_id)
):
    """Look a transcript up by its backend video id.

    The Library only knows video ids, so this is how it reaches the transcript
    text for a download without having to track transcript ids too.
    """
    db = SessionLocal()
    try:
        t = (
            db.query(Transcript)
            .filter(Transcript.video_id == video_id)
            .order_by(Transcript.created_at.desc())
            .first()
        )
        if t is None:
            raise HTTPException(
                status_code=404, detail="No transcript for this lecture yet"
            )
        if user_id is not None and t.user_id is not None and t.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not your transcript")
        return _transcript_payload(t)
    finally:
        db.close()


@app.get("/transcript/{transcript_id}")
def get_transcript(transcript_id: str, user_id: str | None = Depends(get_optional_user_id)):
    """Return the full transcript text (original + English) for viewing/download."""
    db = SessionLocal()
    try:
        t = db.query(Transcript).filter(Transcript.id == transcript_id).first()
        if t is None:
            raise HTTPException(status_code=404, detail="Transcript not found")
        if user_id is not None and t.user_id is not None and t.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not your transcript")
        return _transcript_payload(t)
    finally:
        db.close()


def _delete_media_files(*media_keys: str | None) -> None:
    media_dir = Path(settings.media_path)
    if not media_dir.exists():
        return
    for key in media_keys:
        if not key:
            continue
        for path in media_dir.glob(f"{key}.*"):
            path.unlink(missing_ok=True)


@app.delete("/transcript/{transcript_id}")
def delete_transcript_endpoint(
    transcript_id: str, user_id: str | None = Depends(get_optional_user_id)
):
    """Delete a transcript's DB rows, vectors, and stored media file."""
    # Capture the video_id (media key) before the row is removed.
    db = SessionLocal()
    try:
        t = db.query(Transcript).filter(Transcript.id == transcript_id).first()
        video_id = t.video_id if t else None
    finally:
        db.close()

    deleted = delete_transcript_everywhere(transcript_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail="Transcript not found or not accessible"
        )
    _delete_media_files(transcript_id, video_id)
    return {"detail": "Transcript deleted", "transcript_id": transcript_id}


@app.delete("/video/{video_id}")
def delete_video_endpoint(
    video_id: str, user_id: str | None = Depends(get_optional_user_id)
):
    """Delete all RAG data (transcripts, vectors, media) linked to a video.

    Called alongside the backend's own video-record delete so nothing is left
    orphaned. Idempotent — succeeds even if the video was never ingested.
    """
    removed = delete_by_video(video_id, user_id=user_id)
    _delete_media_files(video_id, *removed)
    return {
        "detail": "Video data deleted",
        "video_id": video_id,
        "transcripts_removed": len(removed),
    }
