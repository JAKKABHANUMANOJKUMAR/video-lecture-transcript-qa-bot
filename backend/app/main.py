import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.core.logger import app_logger
from app.routers import alerts, analytics, auth, chats, complaints, users, videos
from app.schema_bootstrap import apply_schema_patches
from app.seed import seed_demo_accounts


@asynccontextmanager
async def lifespan(app: FastAPI):
    app_logger.info("Starting %s", settings.PROJECT_NAME)
    Base.metadata.create_all(bind=engine)
    apply_schema_patches()
    if settings.SEED_DEMO_DATA:
        db = SessionLocal()
        try:
            seed_demo_accounts(db)
        finally:
            db.close()
    yield
    app_logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    method = request.method
    path = request.url.path
    app_logger.info("incoming request: %s %s", method, path)

    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)
        app_logger.info("completed request: %s %s status=%s duration_ms=%.2f", method, path, response.status_code, duration_ms)
        return response
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 2)
        app_logger.exception("failed request: %s %s duration_ms=%.2f error=%s", method, path, duration_ms, exc)
        raise


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def root():
    app_logger.info("healthcheck root requested")
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/health", tags=["health"])
def health():
    app_logger.info("healthcheck requested")
    return {"status": "healthy"}


api = settings.API_PREFIX
app.include_router(auth.router, prefix=api)
app.include_router(users.router, prefix=api)
app.include_router(chats.router, prefix=api)
app.include_router(videos.router, prefix=api)
app.include_router(complaints.router, prefix=api)
app.include_router(alerts.router, prefix=api)
app.include_router(analytics.router, prefix=api)
