"""Optional FastAPI service exposing the RAG pipeline over HTTP.

Run:
    uvicorn rag.app:app --reload --port 8100

Endpoints:
    POST /ingest   (multipart file upload)  -> transcribe + store + embed
    POST /query    (json: question)         -> retrieve + Groq answer
    GET  /health
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import chromadb
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from rag.auth import get_current_user_id
from rag.config import settings
from rag.pipeline.embeddings import LocalEmbeddingFunction
from rag.pipeline.ingestion import ingest_video
from rag.pipeline.rag_chain import answer_question
from rag.pipeline.vectorstore import query as vector_query

app = FastAPI(title="Ask Ora RAG Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    video_id: str | None = None
    transcript_id: str | None = None
    top_k: int | None = None


def _get_collection():
    client = chromadb.PersistentClient(path=settings.chroma_path)
    return client.get_collection(
        settings.CHROMA_COLLECTION, embedding_function=LocalEmbeddingFunction()
    )


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/viewer", response_class=HTMLResponse)
def chroma_viewer():
    """Simple browser UI to browse ChromaDB chunks."""
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ChromaDB Viewer — Ask Ora</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    header { padding: 1.25rem 1.5rem; background: #1e293b; border-bottom: 1px solid #334155; }
    h1 { margin: 0; font-size: 1.25rem; }
    .sub { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }
    main { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1rem; }
    .card .label { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; }
    .card .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
    .search { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    input { flex: 1; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; }
    button { padding: 0.75rem 1.25rem; border-radius: 8px; border: none; background: #6366f1; color: white; font-weight: 600; cursor: pointer; }
    button:hover { background: #4f46e5; }
    .chunk { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; }
    .meta { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem; }
    .text { white-space: pre-wrap; line-height: 1.5; font-size: 0.9rem; }
    .dist { color: #34d399; font-weight: 600; }
    .empty { color: #94a3b8; text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <header>
    <h1>ChromaDB Viewer</h1>
    <div class="sub" id="path"></div>
    <div class="sub">Shows only your own transcripts. Paste your login token (from the app) to authenticate.</div>
  </header>
  <main>
    <div class="search">
      <input id="token" placeholder="Bearer token (JWT) — required" />
      <button onclick="saveToken()">Save token</button>
    </div>
    <div class="stats" id="stats"></div>
    <div class="search">
      <input id="q" placeholder="Similarity search (e.g. why is python popular?)" />
      <button onclick="search()">Search</button>
      <button onclick="loadAll()" style="background:#475569">Show all</button>
    </div>
    <div id="chunks"></div>
  </main>
  <script>
    function getToken() { return sessionStorage.getItem('rag_viewer_token') || ''; }
    function authHeaders() {
      const t = getToken();
      return t ? { Authorization: 'Bearer ' + t } : {};
    }
    function saveToken() {
      sessionStorage.setItem('rag_viewer_token', document.getElementById('token').value.trim());
      loadStats(); loadAll();
    }
    async function loadStats() {
      const r = await fetch('/api/chroma/stats', { headers: authHeaders() });
      if (r.status === 401) { document.getElementById('path').textContent = 'Enter a valid token to view your data.'; return; }
      const d = await r.json();
      document.getElementById('path').textContent = d.path + ' · collection: ' + d.collection;
      document.getElementById('stats').innerHTML = `
        <div class="card"><div class="label">Total chunks</div><div class="value">${d.count}</div></div>
        <div class="card"><div class="label">Transcripts</div><div class="value">${d.transcripts}</div></div>
        <div class="card"><div class="label">Collection</div><div class="value" style="font-size:1rem">${d.collection}</div></div>`;
    }
    function renderChunks(items) {
      const el = document.getElementById('chunks');
      if (!items.length) { el.innerHTML = '<div class="empty">No chunks found.</div>'; return; }
      el.innerHTML = items.map((c, i) => `
        <div class="chunk">
          <div class="meta">#${i+1}
            ${c.distance != null ? `<span class="dist">distance: ${c.distance.toFixed(4)}</span> · ` : ''}
            transcript: ${c.metadata.transcript_id || '—'} · chunk: ${c.metadata.chunk_index ?? '—'} · lang: ${c.metadata.language || '—'}
          </div>
          <div class="text">${escapeHtml(c.text)}</div>
        </div>`).join('');
    }
    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    async function loadAll() {
      const r = await fetch('/api/chroma/chunks?limit=50', { headers: authHeaders() });
      if (r.status === 401) { renderChunks([]); return; }
      const d = await r.json();
      renderChunks(d.chunks);
    }
    async function search() {
      const q = document.getElementById('q').value.trim();
      if (!q) return loadAll();
      const r = await fetch('/api/chroma/search?q=' + encodeURIComponent(q), { headers: authHeaders() });
      if (r.status === 401) { renderChunks([]); return; }
      const d = await r.json();
      renderChunks(d.chunks);
    }
    document.getElementById('token').value = getToken();
    loadStats(); loadAll();
    document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  </script>
</body>
</html>"""


@app.get("/api/chroma/stats")
def chroma_stats(user_id: str = Depends(get_current_user_id)):
    col = _get_collection()
    data = col.get(where={"user_id": user_id}, include=["metadatas"])
    transcript_ids = {m.get("transcript_id") for m in data["metadatas"] if m.get("transcript_id")}
    return {
        "path": settings.chroma_path,
        "collection": settings.CHROMA_COLLECTION,
        "count": len(data["metadatas"]),
        "transcripts": len(transcript_ids),
    }


@app.get("/api/chroma/chunks")
def chroma_chunks(
    limit: int = Query(default=20, le=200),
    user_id: str = Depends(get_current_user_id),
):
    col = _get_collection()
    data = col.get(where={"user_id": user_id}, limit=limit, include=["documents", "metadatas"])
    chunks = [
        {"text": doc, "metadata": meta, "distance": None}
        for doc, meta in zip(data["documents"], data["metadatas"])
    ]
    return {"chunks": chunks}


@app.get("/api/chroma/search")
def chroma_search(
    q: str = Query(..., min_length=1),
    top_k: int = Query(default=5, le=20),
    user_id: str = Depends(get_current_user_id),
):
    hits = vector_query(q, top_k=top_k, user_id=user_id)
    chunks = [{"text": h["text"], "metadata": h["metadata"], "distance": h["distance"]} for h in hits]
    return {"chunks": chunks}


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    video_id: str | None = Form(default=None),
    user_id: str = Depends(get_current_user_id),
):
    suffix = Path(file.filename or "upload").suffix or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()
        result = ingest_video(
            tmp.name, title=title or file.filename, video_id=video_id, user_id=user_id
        )
    except Exception as exc:  # surface pipeline errors to the client
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        Path(tmp.name).unlink(missing_ok=True)

    return {
        "transcript_id": result.transcript_id,
        "language": result.language,
        "is_english": result.is_english,
        "duration_seconds": result.duration_seconds,
        "num_chunks": result.num_chunks,
    }


@app.post("/query")
def query(req: QueryRequest, user_id: str = Depends(get_current_user_id)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty")
    try:
        result = answer_question(
            req.question,
            top_k=req.top_k,
            video_id=req.video_id,
            transcript_id=req.transcript_id,
            user_id=user_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "answer": result.answer,
        "sources": [
            {"text": s["text"], "metadata": s["metadata"], "distance": s["distance"]}
            for s in result.sources
        ],
    }
