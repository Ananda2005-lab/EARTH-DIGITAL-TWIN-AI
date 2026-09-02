"""
Bearer token authentication dependency.

If AI_SERVICE_TOKEN is set in the environment, every request must carry
  Authorization: Bearer <token>
matching that value.  If the env var is empty/unset, auth is skipped
(development / local mode).
"""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> None:
    """
    FastAPI dependency — raises 401 when auth is required but the token is
    missing or incorrect.
    """
    required_token = settings.ai_service_token.strip()

    # Dev mode: no token configured → allow all requests
    if not required_token:
        return

    if credentials is None:
        logger.warning("Request rejected: missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.credentials != required_token:
        logger.warning("Request rejected: invalid bearer token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
