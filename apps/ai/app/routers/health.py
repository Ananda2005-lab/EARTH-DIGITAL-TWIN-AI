"""
GET /health — liveness / readiness probe.
"""
from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["Health"])

_start_time = time.time()


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    openai_enabled: bool
    auth_enabled: bool
    version: str


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        uptime_seconds=round(time.time() - _start_time, 2),
        openai_enabled=bool(settings.openai_api_key),
        auth_enabled=bool(settings.ai_service_token),
        version="1.0.0",
    )
