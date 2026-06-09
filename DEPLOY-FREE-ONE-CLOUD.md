# Deploy Everything FREE on ONE Cloud Platform

Run **frontend + backend + RAG + PostgreSQL + ChromaDB** on a **single free cloud VM** using Docker Compose.

## Best free option: Oracle Cloud Always Free

| What you get | Spec |
|--------------|------|
| **Cost** | $0 forever (Always Free tier) |
| **RAM** | Up to **24 GB** (ARM VM) — enough for Whisper + RAG |
| **CPU** | 4 OCPUs (ARM) |
| **Disk** | 200 GB |
| **Platform** | **One** cloud account, **one** VM, all services |

> Render / Vercel / Railway **cannot** run the full app free on one platform — Whisper needs too much RAM (512MB free tiers crash).

---

## What runs on the VM

```
                    ┌─────────────────────────────────┐
  Browser ──► :80   │  gateway (nginx + React UI)     │
                    │    /api      → backend          │
                    │    /ingest   → rag (Whisper)    │
                    │    /query    → rag (Groq)       │
                    │  PostgreSQL  (db)               │
                    │  ChromaDB    (persistent volume)│
                    └─────────────────────────────────┘
```

**Total cost: $0** (Oracle VM) + **$0** (Groq free tier)

---

## Step 1 — Create Oracle Cloud free VM

1. Sign up: https://www.oracle.com/cloud/free/
2. **Compute** → **Instances** → **Create Instance**
3. Settings:
   - **Name:** `ask-ora`
   - **Image:** Ubuntu 22.04 or 24.04
   - **Shape:** `VM.Standard.A1.Flex` (Ampere ARM — **Always Free**)
   - **OCPUs:** 2–4
   - **Memory:** 12–24 GB (more = faster transcription)
   - **Boot volume:** 50 GB
4. **Networking:** assign public IP, download SSH key
5. **Security list / firewall:** open inbound **port 80** (HTTP)
   - Networking → Virtual Cloud Networks → Security List → Ingress Rule
   - Source `0.0.0.0/0`, TCP port `80`
6. Note your **public IP** (e.g. `123.45.67.89`)

---

## Step 2 — Install Docker on the VM

SSH into the VM:

```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

Run:

```bash
sudo apt update && sudo apt install -y git docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

---

## Step 3 — Clone your project

```bash
git clone https://github.com/JAKKABHANUMANOJKUMAR/video-lecture-transcript-qa-bot.git
cd video-lecture-transcript-qa-bot
```

---

## Step 4 — Configure environment

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Set:

```env
POSTGRES_PASSWORD=your-strong-password
SECRET_KEY=your-long-random-secret
GROQ_API_KEY=gsk_your_groq_key
PUBLIC_ORIGIN=http://YOUR_PUBLIC_IP
WHISPER_MODEL=tiny
```

Save and exit.

---

## Step 5 — Start all services (one command)

```bash
docker compose --env-file .env.docker up -d --build
```

First build takes **15–30 minutes** (downloads PyTorch, Whisper, etc.).

Check status:

```bash
docker compose ps
docker compose logs -f rag    # watch RAG startup
```

---

## Step 6 — Open the app

In your browser:

| URL | What |
|-----|------|
| `http://YOUR_PUBLIC_IP` | **Main app** (login, upload, chat) |
| `http://YOUR_PUBLIC_IP/viewer` | ChromaDB browser UI |
| `http://YOUR_PUBLIC_IP/health` | Backend health |
| `http://YOUR_PUBLIC_IP/rag-health` | RAG health |

**Login:** `user@example.com` / `password`

---

## Useful commands on the VM

```bash
# Stop all
docker compose --env-file .env.docker down

# Restart after code update
git pull
docker compose --env-file .env.docker up -d --build

# View logs
docker compose logs -f gateway backend rag db

# Free disk space
docker system prune -f
```

---

## Optional: free HTTPS with Cloudflare

1. Register a free domain or use Cloudflare
2. Point DNS A record → your Oracle VM IP
3. Cloudflare → SSL → Flexible
4. Update `.env.docker`: `PUBLIC_ORIGIN=https://yourdomain.com`
5. Rebuild gateway: `docker compose --env-file .env.docker up -d --build gateway backend rag`

---

## RAM guide

| WHISPER_MODEL | RAM needed | Quality |
|---------------|------------|---------|
| `tiny` | ~2 GB | OK for demos |
| `base` | ~4 GB | Better (use 12GB+ VM) |
| `small` | ~6 GB | Good (use 24GB VM) |

---

## Why not other single free platforms?

| Platform | Problem |
|----------|---------|
| Render free | 512MB RAM — RAG crashes |
| Vercel | Frontend only, no Python/Whisper |
| Railway free | Limited credits, runs out |
| Google e2-micro | 1GB RAM — too small |
| **Oracle Always Free** | **24GB ARM — works** |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Can't open site | Open port 80 in Oracle security list + Ubuntu firewall: `sudo ufw allow 80` |
| RAG container restarts | Set `WHISPER_MODEL=tiny`, increase VM RAM |
| Build runs out of disk | `docker system prune -a`, use 50GB+ boot volume |
| Upload timeout | nginx already set to 600s for `/ingest`; use shorter videos first |
| Groq errors | Check `GROQ_API_KEY` in `.env.docker` |

---

## Local test before cloud

On your PC (with Docker Desktop):

```powershell
cp .env.docker.example .env.docker
# edit .env.docker — set GROQ_API_KEY, passwords, PUBLIC_ORIGIN=http://localhost
docker compose --env-file .env.docker up -d --build
```

Open http://localhost
