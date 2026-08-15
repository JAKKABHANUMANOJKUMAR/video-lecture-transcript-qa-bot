# 🎓 Ask Ora - Video Lecture Transcript Q&A Bot

<div align="center">

**Transform lecture videos into intelligent Q&A systems powered by AI**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/JAKKABHANUMANOJKUMAR/video-lecture-transcript-qa-bot)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18+-blue)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Modern%20API-green)](https://fastapi.tiangolo.com/)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Support](#support)

---

## 🎯 Overview

**Ask Ora** is an intelligent video lecture Q&A system that combines automatic speech recognition, vector embeddings, and AI-powered language models to help students find answers within lecture videos instantly.

### Problem Statement
Students waste time rewatching long lecture videos to find specific information. Traditional text search doesn't work on unstructured video content.

### Solution
- 🎬 **Automatic Transcription**: OpenAI Whisper converts video lectures to text
- 🌍 **Multilingual Support**: Transcribes in original language and translates to English
- 🔍 **Semantic Search**: ChromaDB vector embeddings for intelligent retrieval
- 🤖 **AI-Powered Answers**: Groq LLM generates grounded, contextual responses
- 💾 **Full Audit Trail**: PostgreSQL stores all chats, transcripts, and analytics
- 📊 **Admin Dashboard**: Analytics, user management, and system monitoring

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Video Upload** | Support for MP4, AVI, WebM, and audio formats |
| **Auto Transcription** | Whisper-based speech-to-text in 98+ languages |
| **Language Detection** | Automatic language detection + English translation |
| **Semantic Search** | ChromaDB vector embeddings for context-aware retrieval |
| **RAG Pipeline** | Retrieval-Augmented Generation for accurate answers |
| **User Authentication** | JWT-based auth with bcrypt password hashing |
| **Chat History** | Persistent storage of all Q&A sessions |
| **Admin Dashboard** | User management, analytics, alerts, and system health |
| **Docker Support** | Full containerization for easy deployment |
| **Load Testing** | Locust-based performance benchmarking |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                      │
│                    http://localhost:5173                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼────┐  ┌──────▼──────┐  ┌───▼──────────┐
    │ Frontend  │  │  Backend    │  │ RAG Service  │
    │ React     │  │  FastAPI    │  │  FastAPI     │
    │ :5173     │  │  :8000      │  │  :8100       │
    └───────────┘  └──────┬──────┘  └───┬──────────┘
                          │             │
                          └──────┬──────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼─────────┐      ┌────────▼────────┐
            │   PostgreSQL    │      │   ChromaDB      │
            │ User data, auth │      │ Vector embeddings
            │ chats, history  │      │ (rag/chroma_db/)
            └─────────────────┘      └────────┬────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │   Groq Cloud      │
                                    │   (LLM answers)   │
                                    └───────────────────┘
```

### Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| **Frontend** | 5173 | React UI with authentication, video upload, chat interface, admin dashboard |
| **Backend API** | 8000 | User auth, database management, chat history, complaints, analytics |
| **RAG Service** | 8100 | Video ingestion, Whisper transcription, embeddings, vector search, LLM responses |

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for responsive UI
- **Lucide React** for icons
- **Fetch API** for HTTP requests

### Backend
- **Python 3.10+**
- **FastAPI** with Uvicorn
- **SQLAlchemy 2** ORM
- **PostgreSQL 16+** database
- **JWT** authentication
- **Bcrypt** password hashing
- **Python-multipart** for file uploads

### AI/ML Pipeline
- **OpenAI Whisper** for speech-to-text
- **Sentence-Transformers** for embeddings
- **ChromaDB** for vector storage
- **Groq Cloud API** for LLM responses
- **FFmpeg** for audio extraction
- **yt-dlp** for URL-based ingestion

### DevOps & Testing
- **Docker** & **Docker Compose**
- **pytest** for unit testing
- **Locust** for load testing
- **npm** & **pip** for dependency management

---

## 📋 Prerequisites

### Required Software
- **Python 3.10+** ([Download](https://www.python.org/downloads/))
- **Node.js 18+** ([Download](https://nodejs.org/))
- **PostgreSQL 16+** ([Download](https://www.postgresql.org/download/))
- **FFmpeg** (required by Whisper)
  - Windows: `winget install Gyan.FFmpeg`
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
- **Git** ([Download](https://git-scm.com/))

### API Keys (Free)
- **Groq API Key**: [Get free key](https://console.groq.com/keys)

### System Requirements
- Minimum **4GB RAM** (8GB+ recommended)
- **10GB disk space** for models and databases
- GPU optional (improves transcription speed)

---

## 📦 Installation

### 1. Clone Repository
```bash
git clone https://github.com/JAKKABHANUMANOJKUMAR/video-lecture-transcript-qa-bot.git
cd video-lecture-transcript-qa-bot
```

### 2. Create PostgreSQL Database
```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python create_db.py

# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
python create_db.py
```

### 3. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Create .env file
copy .env.example .env  # Windows
# or
cp .env.example .env    # macOS/Linux

# Edit .env with your PostgreSQL password
```

### 4. RAG Service Setup
```bash
cd rag
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt

# Create .env file with Groq API key
copy .env.example .env  # Windows
# or
cp .env.example .env    # macOS/Linux
```

### 5. Frontend Setup
```bash
cd frontend
npm install
```

---

## 🚀 Quick Start

### Option 1: Automated (Windows PowerShell)
```bash
cd d:\video-lecture-transcript-qa-bot
.\run-services.ps1
```

### Option 2: Manual (4 Terminal Windows)

**Terminal 1 - Backend API (port 8000)**
```bash
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 - RAG Service (port 8100)**
```bash
cd rag
.\.venv\Scripts\Activate.ps1
python -m uvicorn rag.app:app --host 127.0.0.1 --port 8100 --reload
```

**Terminal 3 - Frontend (port 5173)**
```bash
cd frontend
npm run dev
```

**Terminal 4 - Load Testing (Optional)**
```bash
cd load_tests
.\.venv\Scripts\python.exe -m locust -f locustfile.py --host http://localhost:8000
```

### 3. Open in Browser
- **Main App**: [http://localhost:5173](http://localhost:5173)
- **Backend Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **RAG Docs**: [http://localhost:8100/docs](http://localhost:8100/docs)
- **ChromaDB UI**: [http://localhost:8100/viewer](http://localhost:8100/viewer)

---

## 📁 Project Structure

```
video-lecture-transcript-qa-bot/
│
├── frontend/                          # React web application
│   ├── src/
│   │   ├── components/               # UI components (Admin, User, Chat, etc.)
│   │   ├── lib/
│   │   │   ├── api.ts               # Backend client
│   │   │   ├── rag.ts               # RAG service client
│   │   │   └── auth-context.tsx     # Auth state management
│   │   ├── App.tsx                  # Main routing
│   │   └── main.tsx                 # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                           # FastAPI authentication & data
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry
│   │   ├── auth.py                  # JWT authentication
│   │   ├── models.py                # SQLAlchemy models
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── chats.py
│   │   │   ├── complaints.py
│   │   │   └── analytics.py
│   │   └── db.py                    # Database configuration
│   ├── create_db.py                 # Initial database setup
│   ├── requirements.txt
│   └── .env.example
│
├── rag/                               # RAG pipeline service
│   ├── app.py                        # FastAPI RAG app
│   ├── ingest.py                     # Video upload & Whisper transcription
│   ├── query.py                      # Vector search & LLM answers
│   ├── auth.py                       # JWT token validation
│   ├── database.py                   # PostgreSQL for metadata
│   ├── models.py                     # ChromaDB + transcript models
│   ├── pipeline/                     # RAG pipeline components
│   ├── chroma_db/                    # Vector database (auto-created)
│   ├── requirements.txt
│   └── .env.example
│
├── load_tests/                        # Performance & load testing
│   ├── locustfile.py                # User simulation script
│   ├── config.py                    # Test configuration
│   └── README.md
│
├── deploy/                            # Deployment configurations
│   ├── Dockerfile.gateway           # Reverse proxy
│   ├── nginx.conf                   # Nginx config
│   ├── cloud-run.yaml               # Google Cloud Run
│   ├── fly.toml                     # Fly.io config
│   ├── render.yaml                  # Render config
│   └── railway.toml                 # Railway config
│
├── docker-compose.yml               # Local orchestration
├── run-services.ps1                 # Windows batch runner
├── RUN_COMMANDS.txt                 # Manual run instructions
├── APPLICATION_WORKFLOW.txt         # Detailed workflow
├── TECHNICAL_DOCUMENTATION.txt      # Exhaustive architecture
└── README.md                        # This file
```

---

## 🔗 API Documentation

### Backend API (FastAPI)
Access interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

**Key Endpoints:**
```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # User login (returns JWT)
GET    /api/auth/me                # Get current user profile
POST   /api/chats                  # Create new chat session
GET    /api/chats/{chat_id}        # Get chat messages
GET    /api/users                  # List users (admin only)
GET    /api/analytics              # System analytics (admin only)
```

### RAG Service API (FastAPI)
Access interactive API docs: [http://localhost:8100/docs](http://localhost:8100/docs)

**Key Endpoints:**
```
POST   /ingest                     # Upload video & trigger transcription
POST   /query                      # Ask question (semantic search + RAG)
GET    /media/{video_id}           # Get video metadata
GET    /transcript/{video_id}      # Get full transcript
GET    /viewer                     # ChromaDB web UI
```

---

## ⚙️ Environment Configuration

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/video_lecture_transcript
JWT_SECRET_KEY=your_random_secret_key_here
JWT_ALGORITHM=HS256
CORS_ORIGINS=["http://localhost:5173"]
SEED_DEMO_DATA=true
```

### RAG Service (.env)
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/video_lecture_transcript
GROQ_API_KEY=your_groq_api_key_here
WHISPER_MODEL=base
EMBEDDING_MODEL=all-MiniLM-L6-v2
JWT_SECRET_KEY=your_random_secret_key_here
JWT_ALGORITHM=HS256
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000/api
VITE_RAG_URL=http://localhost:8100
```

---

## 🐳 Docker Deployment

### Run Entire Stack with Docker Compose
```bash
docker-compose up -d
```

### Build Individual Services
```bash
# Backend
docker build -f backend/Dockerfile -t ask-ora-backend backend/

# RAG Service
docker build -f rag/Dockerfile -t ask-ora-rag rag/

# Frontend
docker build -f frontend/Dockerfile -t ask-ora-frontend frontend/
```

### Deploy to Cloud
See `deploy/` folder for:
- **Google Cloud Run**: `deploy/cloud-run.yaml`
- **Fly.io**: `deploy/fly.toml`
- **Render**: `deploy/render.yaml`
- **Railway**: `deploy/railway.toml`

---

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
.\.venv\Scripts\Activate.ps1
pytest tests/ -v
```

### Run Load Tests
```bash
cd load_tests
.\.venv\Scripts\python.exe -m locust -f locustfile.py \
  --host http://localhost:8000 \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/JAKKABHANUMANOJKUMAR/video-lecture-transcript-qa-bot/issues)
- **Documentation**: See `TECHNICAL_DOCUMENTATION.txt` for deep dives
- **Deployment Help**: Check `DEPLOYMENT.md`

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">

**Built with ❤️ for educators and students**

⭐ If you find this helpful, please star the repository!

</div>
   ```

2. Process a video:
   ```bash
   python src/process_video.py --input data/sample_video.mp4
   ```

3. Run the Q&A API:
   ```bash
   uvicorn api.main:app --reload
   ```

4. Access the web interface at `http://localhost:8000`

## Development Workflow

1. Create a feature branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "Add: brief description"
   ```

3. Push and create pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Code review and merge to `dev`, then to `main`

## Future Enhancements

- Multi-language support
- Video summarization
- Integration with learning management systems
- Real-time transcription for live lectures
- Advanced search filters
- User authentication and personalization

## Contribution Guidelines

1. Follow PEP 8 style guidelines
2. Write tests for new features
3. Update documentation
4. Use meaningful commit messages
5. Create issues for bugs and features
6. Request code review before merging