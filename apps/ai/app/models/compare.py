"""
Pydantic models for the /v1/compare endpoint.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class CompareTarget(BaseModel):
    kind: str = Field(..., pattern="^(country|city|region)$")
    id: str = Field(..., description="ISO code or slug identifier")


class CompareRequest(BaseModel):
    targets: List[CompareTarget] = Field(..., min_length=2)
    dimensions: Optional[List[str]] = Field(
        None,
        description="Dimensions to compare, e.g. economy, climate, population",
    )
    model: Optional[str] = None


# ── Response ─────────────────────────────────────────────────────────────────

class TableRow(BaseModel):
    dimension: str
    values: Dict[str, Any]


class Citation(BaseModel):
    source: str
    url: Optional[str] = None


class CompareUsage(BaseModel):
    totalTokens: int = 0


class CompareResponse(BaseModel):
    narrative: str
    table: Optional[List[TableRow]] = None
    winnerByDimension: Optional[Dict[str, str]] = None
    citations: Optional[List[Citation]] = None
    usage: CompareUsage
