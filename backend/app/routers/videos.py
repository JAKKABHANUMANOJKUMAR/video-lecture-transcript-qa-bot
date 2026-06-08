from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Video
from app.schemas import MessageResponse, VideoCreate, VideoPublic, VideoUpdate

router = APIRouter(prefix="/videos", tags=["videos"])


def _get_owned_video(video_id: str, db: Session, user: User) -> Video:
    video = db.get(Video, video_id)
    if not video or video.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    return video


@router.get("", response_model=list[VideoPublic])
def list_videos(
    status_filter: str | None = Query(default=None, alias="status"),
    subject: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Video).filter(Video.user_id == current_user.id)
    if status_filter and status_filter != "all":
        query = query.filter(Video.status == status_filter)
    if subject:
        query = query.filter(Video.subject == subject)
    return query.order_by(Video.created_at.desc()).all()


@router.post("", response_model=VideoPublic, status_code=status.HTTP_201_CREATED)
def create_video(
    payload: VideoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = Video(user_id=current_user.id, **payload.model_dump())
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


@router.patch("/{video_id}", response_model=VideoPublic)
def update_video(
    video_id: str,
    payload: VideoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = _get_owned_video(video_id, db, current_user)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(video, key, value)
    db.commit()
    db.refresh(video)
    return video


@router.post("/{video_id}/access", response_model=VideoPublic)
def mark_accessed(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = _get_owned_video(video_id, db, current_user)
    video.last_accessed = datetime.now(timezone.utc)
    db.commit()
    db.refresh(video)
    return video


@router.delete("/{video_id}", response_model=MessageResponse)
def delete_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = _get_owned_video(video_id, db, current_user)
    db.delete(video)
    db.commit()
    return MessageResponse(detail="Video deleted")
