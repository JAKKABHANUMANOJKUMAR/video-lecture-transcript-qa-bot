from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import alerts, analytics, auth, chats, complaints, users, videos
from app.seed import seed_demo_accounts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (simple bootstrap; use Alembic for migrations in prod)
    Base.metadata.create_all(bind=engine)
    if settings.SEED_DEMO_DATA:
        db = SessionLocal()
        try:
            seed_demo_accounts(db)
        finally:
            db.close()
    yield


app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/health", tags=["health"])
def health():
    return {"status": "healthy"}


api = settings.API_PREFIX
app.include_router(auth.router, prefix=api)
app.include_router(users.router, prefix=api)
app.include_router(chats.router, prefix=api)
app.include_router(videos.router, prefix=api)
app.include_router(complaints.router, prefix=api)
app.include_router(alerts.router, prefix=api)
app.include_router(analytics.router, prefix=api)
