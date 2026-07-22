"""JWT validation for the RAG service.

The backend issues access tokens signed with SECRET_KEY (HS256) whose `sub`
claim is the user id. The RAG service shares the same secret so it can identify
the caller and scope every transcript / vector query to that user, ensuring one
user can never read another user's data.

Two dependencies are provided:

* ``get_current_user_id`` — requires a valid token (401 otherwise).
* ``get_optional_user_id`` — returns the user id when a valid token is present,
  or ``None`` when no token is sent. This lets the CLI and unauthenticated
  local usage keep working while real (logged-in) requests are scoped per user.
  A token that is *present but invalid* is still rejected.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from rag.config import settings

_bearer = HTTPBearer(auto_error=True)
_bearer_optional = HTTPBearer(auto_error=False)

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def _decode_user_id(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise _credentials_exc
    user_id = payload.get("sub")
    if not user_id:
        raise _credentials_exc
    return str(user_id)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Decode the Bearer token and return the user id (`sub` claim)."""
    return _decode_user_id(credentials.credentials)


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
) -> str | None:
    """Return the caller's user id if a token is supplied, else ``None``.

    A missing token is allowed (anonymous); a malformed/expired token is
    rejected so callers can't smuggle in garbage credentials.
    """
    if credentials is None:
        return None
    return _decode_user_id(credentials.credentials)
