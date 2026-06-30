"""JWT validation for the RAG service.

The backend issues access tokens signed with SECRET_KEY (HS256) whose `sub`
claim is the user id. The RAG service shares the same secret so it can identify
the caller and scope every transcript / vector query to that user, ensuring one
user can never read another user's data.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from rag.config import settings

_bearer = HTTPBearer(auto_error=True)

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Decode the Bearer token and return the user id (`sub` claim)."""
    try:
        payload = jwt.decode(
            credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise _credentials_exc
    except JWTError:
        raise _credentials_exc
    return user_id
