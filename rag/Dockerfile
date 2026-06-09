# RAG service: Whisper + embeddings + ChromaDB (needs ffmpeg + ~2GB RAM)
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install from repo root context (see render.yaml dockerContext)
COPY rag/requirements.txt ./rag/requirements.txt
RUN pip install --no-cache-dir -r rag/requirements.txt

COPY rag/ ./rag/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
# Cache models on a writable path (mount persistent disk here on Render)
ENV HF_HOME=/data/hf
ENV XDG_CACHE_HOME=/data/cache
ENV WHISPER_MODEL=tiny

RUN mkdir -p /data/chroma /data/hf /data/cache

ENV CHROMA_DIR=/data/chroma

EXPOSE 8100

CMD uvicorn rag.app:app --host 0.0.0.0 --port ${PORT:-8100}
