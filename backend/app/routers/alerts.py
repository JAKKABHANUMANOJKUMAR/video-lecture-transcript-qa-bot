from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Alert, User
from app.schemas import AlertCreate, AlertPublic, AlertUpdate, MessageResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertPublic])
def list_alerts(
    alert_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    query = db.query(Alert)
    if alert_type and alert_type != "all":
        query = query.filter(Alert.alert_type == alert_type)
    if status_filter and status_filter != "all":
        query = query.filter(Alert.status == status_filter)
    return query.order_by(Alert.created_at.desc()).all()


@router.post("", response_model=AlertPublic, status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    count = db.query(Alert).count()
    alert = Alert(
        alert_code=f"ALT-{2000 + count + 1}",
        alert_type=payload.alert_type,
        user_id=payload.user_id,
        user_name=payload.user_name,
        message=payload.message,
        priority=payload.priority,
        status="open",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/{alert_id}", response_model=AlertPublic)
def update_alert(
    alert_id: str,
    payload: AlertUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    if payload.status is not None:
        alert.status = payload.status
        if payload.status == "resolved":
            alert.resolved_at = datetime.now(timezone.utc)
    if payload.admin_notes is not None:
        alert.admin_notes = payload.admin_notes
    if payload.is_read is not None:
        alert.is_read = payload.is_read
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", response_model=MessageResponse)
def delete_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return MessageResponse(detail="Alert deleted")
