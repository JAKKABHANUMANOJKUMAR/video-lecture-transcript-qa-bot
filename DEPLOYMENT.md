# Deploy Ask Ora to the Cloud

Deploy the **full application** (frontend + backend + RAG + PostgreSQL) using:

| Component | Platform | Cost |
|-----------|----------|------|
| PostgreSQL | [Neon](https://neon.tech) | Free tier |
| Backend API | [Render](https://render.com) | Free tier |
| RAG service | [Render](https://render.com) | **Starter ~$7/mo** (needs RAM for Whisper) |
| Frontend | [Vercel](https://vercel.com) | Free tier |
| LLM answers | [Groq](https://console.groq.com) | Free tier |

> **Why RAG isn't free on Render:** Whisper + PyTorch need ~2GB RAM. The free tier (512MB) will crash. Use **Starter** or run RAG on a VPS.

---

## Architecture (production)

```
User browser
    │
    ▼
Vercel (frontend)  ──►  Render Backend :8000  ──►  Neon PostgreSQL
    │
    └──────────────►  Render RAG :8100  ──►  Neon PostgreSQL (transcripts)
                              │
                              ├── ChromaDB (/data/chroma persistent disk)
                              └── Groq API (answers)
```

---

## Step 1 — Push code to GitHub

```powershell
cd C:\Users\manoj\Downloads\vl_07-06-2026
git add .
git commit -m "Add cloud deployment configs"
git push origin main
```

---

## Step 2 — PostgreSQL on Neon (free)

1. Go to https://neon.tech → Sign up → **New Project**
2. Name: `video-lecture-transcript`
3. Copy the **connection string** (looks like):
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Save as `DATABASE_URL` — you'll use it in Render for **both** backend and RAG.

Tables are auto-created on first startup (`transcripts`, `users`, etc.).

---

## Step 3 — Deploy Backend + RAG on Render

### Option A: Blueprint (recommended)

1. https://dashboard.render.com → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and creates:
   - `ask-ora-backend` (Docker, free)
   - `ask-ora-rag` (Docker, starter + 1GB disk)

### Option B: Manual

**Backend service:**
- New → Web Service → Docker
- Root: `backend`, Dockerfile: `backend/Dockerfile`
- Start: automatic from Dockerfile
- Env vars (see below)

**RAG service:**
- New → Web Service → Docker
- Dockerfile: `rag/Dockerfile`, Context: `.` (repo root)
- Plan: **Starter** minimum
- Add **Persistent Disk**: mount `/data`, 1GB
- Env vars (see below)

### Environment variables

**ask-ora-backend:**

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon connection string |
| `SECRET_KEY` | Random long string |
| `BACKEND_CORS_ORIGINS` | `https://your-app.vercel.app` |
| `SEED_DEMO_DATA` | `true` |

**ask-ora-rag:**

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Same Neon connection string |
| `GROQ_API_KEY` | Your Groq key |
| `CORS_ORIGINS` | `https://your-app.vercel.app` |
| `WHISPER_MODEL` | `tiny` (use on Starter; `base` needs more RAM) |
| `CHROMA_DIR` | `/data/chroma` |

After deploy, note your URLs:
- Backend: `https://ask-ora-backend.onrender.com`
- RAG: `https://ask-ora-rag.onrender.com`

Test:
```bash
curl https://ask-ora-backend.onrender.com/health
curl https://ask-ora-rag.onrender.com/health
```

---

## Step 4 — Deploy Frontend on Vercel (free)

1. https://vercel.com → **Add New Project** → Import GitHub repo
2. **Root Directory:** `frontend`
3. Framework: Vite (auto-detected)
4. **Environment Variables:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://ask-ora-backend.onrender.com/api` |
| `VITE_RAG_API_URL` | `https://ask-ora-rag.onrender.com` |

5. Deploy → open `https://your-app.vercel.app`

6. **Update CORS** on Render (backend + RAG) with your exact Vercel URL:
   ```
   BACKEND_CORS_ORIGINS=https://your-app.vercel.app
   CORS_ORIGINS=https://your-app.vercel.app
   ```

---

## Step 5 — Verify end-to-end

1. Open Vercel URL → login `user@example.com` / `password`
2. New Chat → Upload a short audio/video file
3. Wait for transcription (RAG service — first request may be slow)
4. Ask a question → answer from Groq
5. Chroma viewer: `https://ask-ora-rag.onrender.com/viewer`

---

## Costs summary

| Service | Monthly |
|---------|---------|
| Neon Postgres | $0 (free tier) |
| Render Backend | $0 (free, sleeps when idle) |
| Render RAG (Starter + 1GB disk) | ~$7 + ~$0.25 |
| Vercel Frontend | $0 |
| Groq API | $0 (within free limits) |
| **Total** | **~$7–8/mo** |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| RAG crashes on startup | Upgrade to **Standard** (2GB RAM) or set `WHISPER_MODEL=tiny` |
| CORS errors in browser | Set `BACKEND_CORS_ORIGINS` / `CORS_ORIGINS` to exact Vercel URL (no trailing slash) |
| Backend cold start slow | Render free tier sleeps after 15 min idle — upgrade or use a ping service |
| Chroma data lost on restart | Ensure persistent disk mounted at `/data` and `CHROMA_DIR=/data/chroma` |
| Upload timeout | Large videos exceed Render request timeout (~30s free) — use shorter files or upgrade |
| DB connection fails | Use full Neon `DATABASE_URL` with `?sslmode=require` |

---

## Alternative platforms

| Platform | Use for |
|----------|---------|
| **Railway** | Backend + RAG (usage-based credits) |
| **Fly.io** | RAG with volume for ChromaDB |
| **Supabase** | PostgreSQL instead of Neon |
| **Netlify** | Frontend instead of Vercel |

---

## Local vs cloud env

| Variable | Local | Cloud |
|----------|-------|-------|
| `DATABASE_URL` | (optional) | Neon connection string |
| `VITE_API_URL` | `http://localhost:8000/api` | `https://...onrender.com/api` |
| `VITE_RAG_API_URL` | `http://localhost:8100` | `https://...onrender.com` |
| `BACKEND_CORS_ORIGINS` | `http://localhost:5173` | `https://....vercel.app` |
