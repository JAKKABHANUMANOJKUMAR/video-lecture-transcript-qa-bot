# =============================================================================
# Ask Ora — Start all services (Windows PowerShell)
#
# Usage (from project root):
#   .\run-services.ps1
#
# Opens 3 terminals:
#   1. Backend API     → http://localhost:8000   (docs: /docs)
#   2. RAG service     → http://localhost:8100   (Chroma viewer: /viewer)
#   3. Frontend (Vite) → http://localhost:5173
#
# Prerequisites:
#   - PostgreSQL running (database: video_lecture_transcript)
#   - backend\.venv and rag\.venv created (pip install -r requirements.txt)
#   - frontend: npm install
#   - ffmpeg on PATH (for Whisper)
# =============================================================================

$Root = $PSScriptRoot
if (-not $Root) { $Root = Get-Location }

$BackendPy  = Join-Path $Root "backend\.venv\Scripts\python.exe"
$RagPy      = Join-Path $Root "rag\.venv\Scripts\python.exe"

if (-not (Test-Path $BackendPy)) {
    Write-Host "Missing backend venv. Run:" -ForegroundColor Red
    Write-Host "  cd backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt"
    exit 1
}
if (-not (Test-Path $RagPy)) {
    Write-Host "Missing rag venv. Run:" -ForegroundColor Red
    Write-Host "  cd rag; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt"
    exit 1
}

Write-Host "Starting Ask Ora services..." -ForegroundColor Cyan
Write-Host ""

# 1) Backend API (port 8000)
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root\backend'; Write-Host '=== Backend API :8000 ===' -ForegroundColor Green; & '$BackendPy' -m uvicorn app.main:app --reload --port 8000"
)

# 2) RAG service (port 8100)
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root'; Write-Host '=== RAG Service :8100 ===' -ForegroundColor Green; & '$RagPy' -m uvicorn rag.app:app --reload --port 8100"
)

# 3) Frontend (port 5173)
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$Root\frontend'; Write-Host '=== Frontend :5173 ===' -ForegroundColor Green; npm run dev"
)

Write-Host "Launched 3 terminals." -ForegroundColor Green
Write-Host ""
Write-Host "  App:          http://localhost:5173"
Write-Host "  Backend API:  http://localhost:8000/docs"
Write-Host "  RAG API:      http://localhost:8100/docs"
Write-Host "  ChromaDB UI:  http://localhost:8100/viewer"
Write-Host ""
Write-Host "Login: user@example.com / password  (or admin@example.com / password)"
