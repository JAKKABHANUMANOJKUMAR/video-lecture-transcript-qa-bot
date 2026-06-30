from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import ChatMessage, ChatSession, User
from app.schemas import (
    ChatSessionCreate,
    ChatSessionPublic,
    ChatSessionUpdate,
    MessageResponse,
)

router = APIRouter(prefix="/chats", tags=["chats"])


def _get_owned_session(session_id: str, db: Session, user: User) -> ChatSession:
    session = (
        db.query(ChatSession)
        .options(joinedload(ChatSession.messages))
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return session


@router.get("", response_model=list[ChatSessionPublic])
def list_chats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(ChatSession)
        .options(joinedload(ChatSession.messages))
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


@router.post("", response_model=ChatSessionPublic, status_code=status.HTTP_201_CREATED)
def create_chat(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = ChatSession(
        user_id=current_user.id,
        title=payload.title,
        video_name=payload.video_name,
        video_id=payload.video_id,
        transcript_id=payload.transcript_id,
        step=payload.step,
    )
    session.messages = [
        ChatMessage(role=m.role, content=m.content) for m in payload.messages
    ]
    db.add(session)
    db.commit()
    db.refresh(session)
    # Re-load with messages for a consistent response payload
    return _get_owned_session(session.id, db, current_user)


@router.get("/{session_id}", response_model=ChatSessionPublic)
def get_chat(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_session(session_id, db, current_user)


@router.put("/{session_id}", response_model=ChatSessionPublic)
def update_chat(
    session_id: str,
    payload: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(session_id, db, current_user)
    if payload.title is not None:
        session.title = payload.title
    if payload.video_name is not None:
        session.video_name = payload.video_name
    if payload.video_id is not None:
        session.video_id = payload.video_id
    if payload.transcript_id is not None:
        session.transcript_id = payload.transcript_id
    if payload.step is not None:
        session.step = payload.step
    if payload.messages is not None:
        session.messages.clear()
        db.flush()
        session.messages = [
            ChatMessage(role=m.role, content=m.content) for m in payload.messages
        ]
    db.commit()
    return _get_owned_session(session.id, db, current_user)


@router.delete("/{session_id}", response_model=MessageResponse)
def delete_chat(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_owned_session(session_id, db, current_user)
    db.delete(session)
    db.commit()
    return MessageResponse(detail="Chat deleted")
