"""
Pydantic models for the /v1/report endpoint.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class ReportTarget(BaseModel):
    id: str
    name: str


class ReportRequest(BaseModel):
    kind: str = Field(..., pattern="^(country|city|region|topic)$")
    title: str = Field(..., min_length=1)
    target: ReportTarget
    tone: str = Field(
        "analytical",
        pattern="^(analytical|executive|technical|educational)$",
    )
    includeCharts: bool = True
    model: Optional[str] = None


# ── Response ─────────────────────────────────────────────────────────────────

class ReportSection(BaseModel):
    heading: str
    body: str
    charts: Optional[Any] = None


class ReportUsage(BaseModel):
    totalTokens: int = 0


class ReportResponse(BaseModel):
    title: str
    summary: str
    content: str = Field(..., description="Full report in Markdown")
    sections: List[ReportSection]
    usage: ReportUsage
