from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin, get_current_user
from app.models import Alert, Complaint, User
from app.schemas import (
    ComplaintCreate,
    ComplaintPublic,
    ComplaintUpdate,
    MessageResponse,
)

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _next_ticket_id(db: Session) -> str:
    count = db.query(Complaint).count()
    return f"TKT-{1000 + count + 1}"


@router.get("", response_model=list[ComplaintPublic])
def list_complaints(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Users see their own complaints; admins see all."""
    query = db.query(Complaint)
    if current_user.role != "admin":
        query = query.filter(Complaint.user_id == current_user.id)
    return query.order_by(Complaint.created_at.desc()).all()


@router.post("", response_model=ComplaintPublic, status_code=status.HTTP_201_CREATED)
def create_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = Complaint(
        ticket_id=_next_ticket_id(db),
        user_id=current_user.id,
        title=payload.title,
        category=payload.category,
        priority=payload.priority,
        description=payload.description,
        screenshot_url=payload.screenshot_url,
    )
    db.add(complaint)

    # Raise a matching alert for the admin dashboard
    alert_count = db.query(Alert).count()
    db.add(
        Alert(
            alert_code=f"ALT-{2000 + alert_count + 1}",
            alert_type="complaint",
            user_id=current_user.id,
            user_name=current_user.full_name,
            message=f"New complaint submitted: {payload.title}",
            priority=payload.priority,
            status="open",
        )
    )
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/{complaint_id}", response_model=ComplaintPublic)
def get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if current_user.role != "admin" and complaint.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return complaint


@router.patch("/{complaint_id}", response_model=ComplaintPublic)
def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Admin-only: respond to / resolve complaints."""
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if payload.status is not None:
        complaint.status = payload.status
        if payload.status == "resolved":
            complaint.resolved_at = datetime.now(timezone.utc)
    if payload.admin_response is not None:
        complaint.admin_response = payload.admin_response
    if payload.priority is not None:
        complaint.priority = payload.priority
    db.commit()
    db.refresh(complaint)
    return complaint


@router.delete("/{complaint_id}", response_model=MessageResponse)
def delete_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    db.delete(complaint)
    db.commit()
    return MessageResponse(detail="Complaint deleted")
