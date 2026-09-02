"""
POST /v1/report — Generate an intelligence report.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import verify_token
from app.models.report import ReportRequest, ReportResponse
from app.services.report_service import ReportService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Report"])
_service = ReportService()


@router.post(
    "/report",
    response_model=ReportResponse,
    summary="Generate intelligence report",
    dependencies=[Depends(verify_token)],
)
async def report(body: ReportRequest) -> ReportResponse:
    """
    Generate a structured intelligence report for a country, city, region,
    or topic in the requested tone (analytical / executive / technical /
    educational).
    """
    try:
        return await _service.handle(body)
    except Exception as exc:
        logger.exception("Unhandled error in /v1/report: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service encountered an internal error. Please try again.",
        ) from exc
