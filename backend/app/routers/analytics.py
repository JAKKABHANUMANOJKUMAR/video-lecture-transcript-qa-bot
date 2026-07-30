from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Alert, ChatSession, Complaint, User, Video
from app.schemas import AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def summary(
    days: int | None = Query(
        default=None,
        ge=1,
        le=3650,
        description="Only count rows created in the last N days. Omit for all time.",
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Platform counts, optionally narrowed to a recent window.

    Every figure is a live aggregate — the admin dashboard's range selector maps
    straight onto `days`, so switching it re-reads the database rather than
    filtering a cached payload in the browser.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None

    def count(model, *conditions):
        query = db.query(func.count(model.id))
        if since is not None:
            query = query.filter(model.created_at >= since)
        for condition in conditions:
            query = query.filter(condition)
        return query.scalar() or 0

    # Average study time stays all-time: it answers "how much has this person
    # worked through in total", which a recent-window filter would misreport.
    avg_usage = db.query(func.coalesce(func.avg(User.usage_minutes), 0)).scalar() or 0

    return AnalyticsSummary(
        total_users=count(User),
        active_users=count(User, User.status == "active"),
        inactive_users=count(User, User.status == "inactive"),
        blocked_users=count(User, User.status == "blocked"),
        open_alerts=count(Alert, Alert.status == "open"),
        total_complaints=count(Complaint),
        total_videos=count(Video),
        total_chats=count(ChatSession),
        avg_usage_minutes=round(float(avg_usage), 1),
    )
