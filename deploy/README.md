# Deployment notes

## Local Docker Compose
1. Copy [.env.example](../.env.example) to .env and fill the required values.
2. Run `docker compose up -d --build`.
3. Check `docker compose ps` and open http://localhost:5173.

## Render deployment
1. Create a managed PostgreSQL database and copy the connection string into the backend and RAG services as `DATABASE_URL`.
2. Set `SECRET_KEY` to a long random value.
3. Add `GROQ_API_KEY` or `OPENROUTER_API_KEY` for LLM access.
4. Deploy the repo with the Render blueprint file [render.yaml](../render.yaml).
5. Use the frontend service URL for `BACKEND_CORS_ORIGINS` in the backend environment.

## Production notes
- Backend and RAG services need persistent storage for uploads, Chroma, and model cache.
- Prefer managed PostgreSQL for production deployments.
- For free-tier platforms, keep the RAG service on a plan with enough memory for Whisper and embeddings.
