"""
Chat service — orchestrates the /v1/chat endpoint.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from app.models.chat import (
    Action,
    ChatRequest,
    ChatResponse,
    Citation,
    HistoryMessage,
    UsageInfo,
)
from app.services.llm import LLMClient, LLMMessage, llm_client

logger = logging.getLogger(__name__)

# Intent → suggested actions mapping
_INTENT_ACTIONS = {
    "economy_query": [
        Action(kind="open_chart", label="View GDP Chart", payload={"chartType": "gdp_trend"}),
        Action(kind="generate_report", label="Generate Economic Report", payload={"tone": "analytical"}),
    ],
    "climate_query": [
        Action(kind="open_chart", label="View Climate Data", payload={"chartType": "climate_trend"}),
        Action(kind="generate_report", label="Generate Climate Report", payload={"tone": "technical"}),
    ],
    "population_query": [
        Action(kind="open_chart", label="View Population Chart", payload={"chartType": "population_trend"}),
        Action(kind="generate_report", label="Generate Demographic Report", payload={"tone": "analytical"}),
    ],
    "compare_intent": [
        Action(kind="open_compare", label="Open Compare Tool", payload={}),
    ],
    "report_intent": [
        Action(kind="generate_report", label="Generate Full Report", payload={"tone": "executive"}),
    ],
}

_DEFAULT_CITATIONS: List[Citation] = [
    Citation(source="World Bank Open Data", url="https://data.worldbank.org"),
    Citation(source="IMF World Economic Outlook", url="https://www.imf.org/en/Publications/WEO"),
    Citation(source="UN Population Division", url="https://population.un.org"),
]


def _build_system_prompt(context: Optional[dict]) -> str:
    location_hint = ""
    if context:
        loc = context.get("location") or {}
        name = loc.get("name") or loc.get("country") or loc.get("city") or ""
        if name:
            location_hint = f"\nThe user is currently viewing: {name}."

    return (
        "You are the Earth Digital Twin AI assistant — an expert geopolitical, "
        "economic, and environmental intelligence analyst. You provide accurate, "
        "data-driven insights about countries, cities, and global trends. "
        "Your responses are concise, authoritative, and structured with Markdown "
        "when appropriate. Always cite data sources when making factual claims."
        + location_hint
    )


def _detect_intent(content: str) -> Optional[str]:
    """Simple keyword-based intent detection from the AI response."""
    lower = content.lower()
    if "economic" in lower or "gdp" in lower or "trade" in lower:
        return "economy_query"
    if "climate" in lower or "temperature" in lower or "weather" in lower:
        return "climate_query"
    if "population" in lower or "demographic" in lower:
        return "population_query"
    if "compare" in lower:
        return "compare_intent"
    if "report" in lower:
        return "report_intent"
    return "general_query"


class ChatService:
    def __init__(self, client: LLMClient = llm_client) -> None:
        self._llm = client

    async def handle(self, req: ChatRequest) -> ChatResponse:
        logger.info("Chat request | message_len=%d | history=%d", len(req.message), len(req.history))

        # Build message list for LLM
        system_prompt = _build_system_prompt(req.context)
        messages: List[LLMMessage] = [LLMMessage(role="system", content=system_prompt)]

        for h in req.history[-10:]:  # cap history at last 10 turns
            messages.append(LLMMessage(role=h.role, content=h.content))

        messages.append(LLMMessage(role="user", content=req.message))

        result = await self._llm.complete(
            messages=messages,
            model_override=req.model,
            context=req.context,
        )

        intent = _detect_intent(result.content)
        actions = _INTENT_ACTIONS.get(intent)

        return ChatResponse(
            content=result.content,
            intent=intent,
            citations=_DEFAULT_CITATIONS,
            actions=actions,
            usage=UsageInfo(
                promptTokens=result.prompt_tokens,
                completionTokens=result.completion_tokens,
                totalTokens=result.total_tokens,
            ),
            model=result.model,
        )
