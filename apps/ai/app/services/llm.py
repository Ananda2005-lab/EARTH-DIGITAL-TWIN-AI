"""
LLM abstraction layer.

When OPENAI_API_KEY is set, calls are forwarded to the OpenAI Chat Completions
API.  Otherwise an intelligent mock engine generates context-aware responses
without any external dependency.
"""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResult:
    content: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str


# ── OpenAI client (lazy init) ─────────────────────────────────────────────────

_openai_client: Any = None


def _get_openai_client() -> Any:
    global _openai_client
    if _openai_client is None:
        try:
            from openai import AsyncOpenAI  # type: ignore
            _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        except ImportError:
            logger.warning("openai package not installed; falling back to mock")
    return _openai_client


# ── Mock engine ───────────────────────────────────────────────────────────────

_MOCK_FACTS: Dict[str, Dict[str, str]] = {
    "france": {
        "economy": "France has the 7th largest economy in the world by nominal GDP (~$3.0 trillion USD). Key sectors include aerospace (Airbus), luxury goods (LVMH, Hermès), tourism (90 million visitors/year), and nuclear energy (70% of electricity).",
        "climate": "France has a temperate climate in the north, Mediterranean in the south, and continental in the east. Average temperatures range from 3°C in January to 25°C in July in Paris.",
        "population": "France has a population of approximately 68 million people, with a median age of 42. The urban population is ~82%, concentrated in Paris (12 million metro area), Lyon, and Marseille.",
    },
    "germany": {
        "economy": "Germany is Europe's largest economy (~$4.1 trillion USD GDP). It is the world's 3rd largest exporter, driven by automotive (Volkswagen, BMW, Mercedes-Benz), machinery, chemicals, and electronics.",
        "climate": "Germany has a temperate seasonal climate. Winters are cold (avg 0°C) and summers mild to warm (avg 20–25°C). Annual rainfall is 600–700 mm across most regions.",
        "population": "Germany has ~84 million inhabitants, making it the most populous EU member state. The population is aging, with a median age of 45.7 years.",
    },
    "usa": {
        "economy": "The United States has the world's largest economy (~$27 trillion USD GDP). Technology, finance, healthcare, and defense are dominant sectors. Silicon Valley, Wall Street, and the energy sector are key economic pillars.",
        "climate": "The US spans multiple climate zones: arctic in Alaska, tropical in Hawaii and Florida, arid in the Southwest, and temperate in the Northeast and Midwest.",
        "population": "The US population is approximately 335 million. It is highly diverse, with major urban centers in New York, Los Angeles, Chicago, and Houston.",
    },
    "china": {
        "economy": "China is the world's 2nd largest economy (~$18 trillion USD GDP, or largest by PPP). Manufacturing, technology, and exports drive growth. China is the world's largest trading nation.",
        "climate": "China's climate varies enormously: tropical in the south, subarctic in the northeast, arid in the northwest, and temperate in central regions.",
        "population": "China has ~1.4 billion people, though population growth has stalled. Urbanization is ~65%, with megacities like Shanghai (26 million) and Beijing (22 million).",
    },
    "india": {
        "economy": "India is the world's 5th largest economy (~$3.7 trillion USD GDP) and the fastest-growing major economy. IT services, pharmaceuticals, agriculture, and manufacturing are key sectors.",
        "climate": "India has a diverse climate: tropical monsoon in the south, arid in the northwest (Thar Desert), alpine in the Himalayas, and humid subtropical in the Ganges plain.",
        "population": "India surpassed China in 2023 to become the world's most populous country with ~1.44 billion people. The median age is 28, making it one of the youngest large economies.",
    },
    "brazil": {
        "economy": "Brazil is Latin America's largest economy (~$2.1 trillion USD GDP). Agriculture (soybeans, beef, coffee), mining, oil (Petrobras), and manufacturing are key sectors.",
        "climate": "Brazil is predominantly tropical. The Amazon basin has a hot, humid equatorial climate; the south has subtropical conditions with mild winters.",
        "population": "Brazil has ~215 million people. It is highly urbanized (~87%), with São Paulo (22 million metro) being the largest city in the Southern Hemisphere.",
    },
    "japan": {
        "economy": "Japan is the world's 4th largest economy (~$4.2 trillion USD GDP). It is a global leader in automotive (Toyota, Honda), electronics (Sony, Panasonic), and robotics.",
        "climate": "Japan has a temperate climate with four distinct seasons. The north (Hokkaido) is cold and snowy; the south (Okinawa) is subtropical. Typhoon season runs June–October.",
        "population": "Japan has ~125 million people with a rapidly aging and declining population. The median age is 48.4 years — one of the highest in the world.",
    },
    "uk": {
        "economy": "The United Kingdom has a GDP of ~$3.1 trillion USD. Financial services (City of London), creative industries, aerospace, and pharmaceuticals are dominant sectors.",
        "climate": "The UK has a temperate oceanic climate — mild, wet, and overcast year-round. Average temperatures range from 4°C in winter to 18°C in summer.",
        "population": "The UK has ~67 million people. London (9 million) is the largest city and a global financial hub.",
    },
}

_GENERIC_FACTS = {
    "economy": "This region has a mixed economy with a combination of industrial, agricultural, and service sectors contributing to GDP growth.",
    "climate": "The climate varies across the region, with seasonal temperature fluctuations and precipitation patterns influenced by geography and latitude.",
    "population": "The population is distributed across urban and rural areas, with ongoing demographic shifts driven by urbanization and migration trends.",
}


def _lookup_facts(name: str, dimension: str) -> str:
    key = name.lower().replace(" ", "")
    # Try exact match first, then partial
    for k, facts in _MOCK_FACTS.items():
        if k in key or key in k:
            return facts.get(dimension, _GENERIC_FACTS.get(dimension, ""))
    return _GENERIC_FACTS.get(dimension, "")


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


# ── Mock response generators ──────────────────────────────────────────────────

def mock_chat_response(messages: List[LLMMessage], context: Optional[Dict[str, Any]] = None) -> LLMResult:
    """Generate a realistic mock chat response."""
    user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "")
    lower = user_msg.lower()

    # Detect location from context
    location_name = ""
    if context:
        loc = context.get("location") or {}
        location_name = (
            loc.get("name") or loc.get("country") or loc.get("city") or ""
        )

    # Detect subject from message
    subject = location_name
    for country in _MOCK_FACTS:
        if country in lower:
            subject = country.title()
            break

    if not subject:
        subject = "the selected region"

    # Build a context-aware response
    if any(w in lower for w in ["economy", "gdp", "economic", "trade", "finance"]):
        facts = _lookup_facts(subject, "economy")
        content = f"**Economic Overview — {subject}**\n\n{facts}\n\nKey economic indicators suggest continued growth momentum, though global headwinds including inflation and supply-chain disruptions remain relevant risk factors."
        intent = "economy_query"
    elif any(w in lower for w in ["climate", "weather", "temperature", "rainfall", "environment"]):
        facts = _lookup_facts(subject, "climate")
        content = f"**Climate Profile — {subject}**\n\n{facts}\n\nClimate change projections indicate increasing frequency of extreme weather events, with adaptation strategies becoming a policy priority."
        intent = "climate_query"
    elif any(w in lower for w in ["population", "demographic", "people", "urban", "city"]):
        facts = _lookup_facts(subject, "population")
        content = f"**Demographic Analysis — {subject}**\n\n{facts}\n\nDemographic trends are shaping labor markets, social services, and urban planning priorities across the region."
        intent = "population_query"
    elif any(w in lower for w in ["compare", "versus", "vs", "difference", "better"]):
        content = f"To compare regions effectively, I analyze multiple dimensions including economic output, demographic trends, climate resilience, and governance indicators. Please specify the regions and dimensions you'd like to compare for a detailed analysis."
        intent = "compare_intent"
    elif any(w in lower for w in ["report", "analysis", "overview", "summary"]):
        content = f"I can generate a comprehensive intelligence report on **{subject}** covering economic performance, demographic trends, climate data, governance indicators, and geopolitical context. Would you like an executive summary or a detailed technical report?"
        intent = "report_intent"
    else:
        content = (
            f"**Intelligence Brief — {subject}**\n\n"
            f"Based on current data, {subject} presents a multifaceted profile across key dimensions:\n\n"
            f"- **Economy**: {_lookup_facts(subject, 'economy')[:120]}...\n"
            f"- **Climate**: {_lookup_facts(subject, 'climate')[:120]}...\n"
            f"- **Population**: {_lookup_facts(subject, 'population')[:120]}...\n\n"
            f"For a deeper analysis, you can ask about specific dimensions or request a full intelligence report."
        )
        intent = "general_query"

    prompt_tokens = sum(_estimate_tokens(m.content) for m in messages)
    completion_tokens = _estimate_tokens(content)

    return LLMResult(
        content=content,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        model="mock-earth-twin-v1",
    )


def mock_compare_response(targets: List[str], dimensions: List[str]) -> LLMResult:
    """Generate a realistic mock compare response."""
    names = ", ".join(t.title() for t in targets)
    dim_list = dimensions or ["economy", "climate", "population"]

    lines = [f"## Comparative Analysis: {names}\n"]
    for dim in dim_list:
        lines.append(f"### {dim.title()}")
        for t in targets:
            fact = _lookup_facts(t, dim)
            lines.append(f"**{t.title()}**: {fact[:200]}")
        lines.append("")

    lines.append(
        f"### Summary\nThis analysis highlights the structural differences and similarities between {names}. "
        "Each entity demonstrates distinct strengths shaped by geography, historical development, and policy choices. "
        "Decision-makers should weigh these factors in the context of their specific strategic objectives."
    )

    content = "\n".join(lines)
    total_tokens = _estimate_tokens(content) + 150

    return LLMResult(
        content=content,
        prompt_tokens=150,
        completion_tokens=_estimate_tokens(content),
        total_tokens=total_tokens,
        model="mock-earth-twin-v1",
    )


def mock_report_response(target_name: str, kind: str, tone: str, title: str) -> LLMResult:
    """Generate a realistic mock intelligence report."""
    econ = _lookup_facts(target_name, "economy")
    clim = _lookup_facts(target_name, "climate")
    pop = _lookup_facts(target_name, "population")

    tone_intro = {
        "analytical": f"This report provides a data-driven analytical assessment of {target_name}, examining key structural indicators across economic, demographic, and environmental dimensions.",
        "executive": f"Executive Summary: {target_name} represents a strategically significant entity. This brief distills the most critical intelligence for senior decision-makers.",
        "technical": f"Technical Intelligence Report — {target_name}. This document presents quantitative metrics, trend analysis, and technical indicators for specialist audiences.",
        "educational": f"This educational overview of {target_name} is designed to provide accessible, well-structured information for learners and general audiences.",
    }.get(tone, f"Intelligence report on {target_name}.")

    content = f"""# {title}

{tone_intro}

---

## 1. Economic Profile

{econ}

The fiscal framework is shaped by both domestic policy priorities and international trade relationships. Key risks include commodity price volatility, currency fluctuations, and geopolitical disruptions to supply chains.

## 2. Demographic Overview

{pop}

Urbanization trends are accelerating, with implications for infrastructure investment, housing policy, and social services. Workforce composition and education levels are critical determinants of long-term productivity.

## 3. Climate & Environment

{clim}

Environmental policy is increasingly integrated into national development strategies. Renewable energy transition, water security, and climate adaptation are priority areas for investment and international cooperation.

## 4. Geopolitical Context

{target_name.title()} occupies a notable position in regional and global geopolitics. Trade alliances, diplomatic relationships, and security arrangements shape its strategic posture. Multilateral engagement through international organizations remains a cornerstone of foreign policy.

## 5. Strategic Outlook

Looking ahead, {target_name.title()} faces both significant opportunities and structural challenges. Technological adoption, demographic management, and climate resilience will be defining factors in its trajectory over the next decade.

---

*Report generated by Earth Digital Twin AI Intelligence Engine. Data reflects current best estimates and should be validated against primary sources for critical decisions.*
"""

    total_tokens = _estimate_tokens(content) + 200

    return LLMResult(
        content=content,
        prompt_tokens=200,
        completion_tokens=_estimate_tokens(content),
        total_tokens=total_tokens,
        model="mock-earth-twin-v1",
    )


# ── Main LLM interface ────────────────────────────────────────────────────────

class LLMClient:
    """
    Unified LLM interface.  Uses OpenAI when configured, otherwise falls back
    to the intelligent mock engine.
    """

    def _model_name(self, override: Optional[str] = None) -> str:
        return override or settings.openai_model

    async def complete(
        self,
        messages: List[LLMMessage],
        model_override: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> LLMResult:
        if settings.openai_api_key:
            return await self._openai_complete(messages, model_override)
        return mock_chat_response(messages, context)

    async def _openai_complete(
        self,
        messages: List[LLMMessage],
        model_override: Optional[str] = None,
    ) -> LLMResult:
        client = _get_openai_client()
        if client is None:
            return mock_chat_response(messages)

        model = self._model_name(model_override)
        oai_messages = [{"role": m.role, "content": m.content} for m in messages]

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=oai_messages,
                max_tokens=settings.max_tokens,
                temperature=settings.temperature,
            )
            choice = response.choices[0]
            usage = response.usage
            return LLMResult(
                content=choice.message.content or "",
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
                model=model,
            )
        except Exception as exc:
            logger.error("OpenAI API error: %s — falling back to mock", exc)
            return mock_chat_response(messages)


# Singleton
llm_client = LLMClient()
