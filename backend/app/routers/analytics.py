from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Alert, Complaint, User, Video
from app.schemas import AnalyticsSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    inactive_users = db.query(func.count(User.id)).filter(User.status == "inactive").scalar() or 0
    blocked_users = db.query(func.count(User.id)).filter(User.status == "blocked").scalar() or 0
    open_alerts = db.query(func.count(Alert.id)).filter(Alert.status == "open").scalar() or 0
    total_complaints = db.query(func.count(Complaint.id)).scalar() or 0
    total_videos = db.query(func.count(Video.id)).scalar() or 0
    avg_usage = db.query(func.coalesce(func.avg(User.usage_minutes), 0)).scalar() or 0

    return AnalyticsSummary(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        blocked_users=blocked_users,
        open_alerts=open_alerts,
        total_complaints=total_complaints,
        total_videos=total_videos,
        avg_usage_minutes=round(float(avg_usage), 1),
    )
