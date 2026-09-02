"""
Compare service — orchestrates the /v1/compare endpoint.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.models.compare import (
    Citation,
    CompareRequest,
    CompareResponse,
    CompareUsage,
    TableRow,
)
from app.services.llm import (
    LLMClient,
    LLMMessage,
    llm_client,
    mock_compare_response,
    _lookup_facts,
)

logger = logging.getLogger(__name__)

_DEFAULT_DIMENSIONS = ["economy", "climate", "population"]

_CITATIONS = [
    Citation(source="World Bank Open Data", url="https://data.worldbank.org"),
    Citation(source="IMF World Economic Outlook", url="https://www.imf.org/en/Publications/WEO"),
    Citation(source="UNDP Human Development Reports", url="https://hdr.undp.org"),
    Citation(source="NASA Earth Observations", url="https://neo.gsfc.nasa.gov"),
]

# Rough "winner" heuristics for mock mode (higher GDP rank = better economy, etc.)
_ECONOMY_RANK = {
    "usa": 1, "china": 2, "japan": 3, "germany": 4, "india": 5,
    "uk": 6, "france": 7, "brazil": 8,
}
_POPULATION_RANK = {
    "india": 1, "china": 2, "usa": 3, "brazil": 4, "japan": 5,
    "germany": 6, "france": 7, "uk": 8,
}


def _pick_winner(targets: List[str], dimension: str) -> str:
    """Return the target id that 'wins' a dimension in mock mode."""
    rank_map = {
        "economy": _ECONOMY_RANK,
        "population": _POPULATION_RANK,
    }
    if dimension in rank_map:
        ranked = sorted(
            targets,
            key=lambda t: rank_map[dimension].get(t.lower(), 999),
        )
        return ranked[0]
    # For climate and others, just pick the first alphabetically (deterministic)
    return sorted(targets)[0]


def _build_table(targets: List[str], dimensions: List[str]) -> List[TableRow]:
    rows: List[TableRow] = []
    for dim in dimensions:
        values: Dict[str, Any] = {}
        for t in targets:
            fact = _lookup_facts(t, dim)
            # Truncate to a concise value for the table cell
            values[t] = fact[:180].rstrip() + ("…" if len(fact) > 180 else "")
        rows.append(TableRow(dimension=dim, values=values))
    return rows


class CompareService:
    def __init__(self, client: LLMClient = llm_client) -> None:
        self._llm = client

    async def handle(self, req: CompareRequest) -> CompareResponse:
        target_ids = [t.id for t in req.targets]
        dimensions = req.dimensions or _DEFAULT_DIMENSIONS

        logger.info(
            "Compare request | targets=%s | dimensions=%s",
            target_ids,
            dimensions,
        )

        from app.config import settings

        if settings.openai_api_key:
            # Build a structured prompt for OpenAI
            targets_str = ", ".join(
                f"{t.kind} '{t.id}'" for t in req.targets
            )
            dims_str = ", ".join(dimensions)
            prompt = (
                f"Compare the following {targets_str} across these dimensions: {dims_str}. "
                "Provide a detailed narrative analysis, then a structured comparison. "
                "Be specific with data and statistics. Format with Markdown."
            )
            messages = [
                LLMMessage(
                    role="system",
                    content=(
                        "You are an expert geopolitical and economic analyst for the "
                        "Earth Digital Twin platform. Provide accurate, data-rich comparisons."
                    ),
                ),
                LLMMessage(role="user", content=prompt),
            ]
            result = await self._llm.complete(messages=messages, model_override=req.model)
            narrative = result.content
            total_tokens = result.total_tokens
        else:
            result = mock_compare_response(target_ids, dimensions)
            narrative = result.content
            total_tokens = result.total_tokens

        table = _build_table(target_ids, dimensions)
        winner_by_dim = {dim: _pick_winner(target_ids, dim) for dim in dimensions}

        return CompareResponse(
            narrative=narrative,
            table=table,
            winnerByDimension=winner_by_dim,
            citations=_CITATIONS,
            usage=CompareUsage(totalTokens=total_tokens),
        )
