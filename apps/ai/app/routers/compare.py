"""
POST /v1/compare — Compare countries / cities across dimensions.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import verify_token
from app.models.compare import CompareRequest, CompareResponse
from app.services.compare_service import CompareService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Compare"])
_service = CompareService()


@router.post(
    "/compare",
    response_model=CompareResponse,
    summary="Compare countries or cities",
    dependencies=[Depends(verify_token)],
)
async def compare(body: CompareRequest) -> CompareResponse:
    """
    Compare two or more countries / cities across requested dimensions and
    return a narrative analysis, a structured comparison table, and a
    per-dimension winner.
    """
    try:
        return await _service.handle(body)
    except Exception as exc:
        logger.exception("Unhandled error in /v1/compare: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service encountered an internal error. Please try again.",
        ) from exc
