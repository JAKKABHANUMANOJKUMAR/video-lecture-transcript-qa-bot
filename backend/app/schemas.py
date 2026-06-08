from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------------------------------------------------------------------------
# Auth / Users
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    full_name: str
    email: EmailStr


class UserSignup(UserBase):
    password: str = Field(min_length=6)
    auth_provider: str = "local"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    status: str
    auth_provider: str
    avatar_url: str | None = None
    usage_minutes: int
    last_login: datetime | None = None
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
    status: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------------------------------------------------------------------------
# Chat sessions & messages
# ---------------------------------------------------------------------------
class ChatMessageBase(BaseModel):
    role: str
    content: str


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessagePublic(ChatMessageBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class ChatSessionCreate(BaseModel):
    title: str = "New chat"
    video_name: str | None = None
    step: int = 0
    messages: list[ChatMessageCreate] = []


class ChatSessionUpdate(BaseModel):
    title: str | None = None
    video_name: str | None = None
    step: int | None = None
    messages: list[ChatMessageCreate] | None = None


class ChatSessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    video_name: str | None = None
    step: int
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessagePublic] = []


# ---------------------------------------------------------------------------
# Videos / Library
# ---------------------------------------------------------------------------
class VideoBase(BaseModel):
    title: str
    subject: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int = 0
    size_mb: int = 0


class VideoCreate(VideoBase):
    status: str = "processing"


class VideoUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    status: str | None = None
    last_accessed: datetime | None = None


class VideoPublic(VideoBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    created_at: datetime
    last_accessed: datetime | None = None


# ---------------------------------------------------------------------------
# Complaints
# ---------------------------------------------------------------------------
class ComplaintCreate(BaseModel):
    title: str
    category: str = "other"
    priority: str = "low"
    description: str
    screenshot_url: str | None = None


class ComplaintUpdate(BaseModel):
    status: str | None = None
    admin_response: str | None = None
    priority: str | None = None


class ComplaintPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    user_id: str
    title: str
    category: str
    priority: str
    description: str
    screenshot_url: str | None = None
    status: str
    admin_response: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
class AlertCreate(BaseModel):
    alert_type: str
    message: str
    user_id: str | None = None
    user_name: str | None = None
    priority: str = "low"


class AlertUpdate(BaseModel):
    status: str | None = None
    admin_notes: str | None = None
    is_read: bool | None = None


class AlertPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    alert_code: str
    alert_type: str
    user_id: str | None = None
    user_name: str | None = None
    message: str
    priority: str
    status: str
    admin_notes: str | None = None
    is_read: bool
    created_at: datetime
    resolved_at: datetime | None = None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class AnalyticsSummary(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    blocked_users: int
    open_alerts: int
    total_complaints: int
    total_videos: int
    avg_usage_minutes: float


class MessageResponse(BaseModel):
    detail: str
