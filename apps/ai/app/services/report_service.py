"""
Report service — orchestrates the /v1/report endpoint.
"""
from __future__ import annotations

import logging
from typing import List

from app.models.report import (
    ReportRequest,
    ReportResponse,
    ReportSection,
    ReportUsage,
)
from app.services.llm import (
    LLMClient,
    LLMMessage,
    llm_client,
    mock_report_response,
    _estimate_tokens,
)

logger = logging.getLogger(__name__)


def _parse_sections(markdown: str) -> List[ReportSection]:
    """
    Parse a Markdown document into ReportSection objects by splitting on
    level-2 headings (## Heading).
    """
    sections: List[ReportSection] = []
    current_heading = ""
    current_lines: List[str] = []

    for line in markdown.splitlines():
        if line.startswith("## "):
            if current_heading:
                sections.append(
                    ReportSection(
                        heading=current_heading,
                        body="\n".join(current_lines).strip(),
                        charts=None,
                    )
                )
            current_heading = line[3:].strip()
            current_lines = []
        elif line.startswith("# "):
            # Top-level title — skip, it's in the title field
            continue
        else:
            current_lines.append(line)

    if current_heading:
        sections.append(
            ReportSection(
                heading=current_heading,
                body="\n".join(current_lines).strip(),
                charts=None,
            )
        )

    # If no sections were parsed (flat document), wrap everything
    if not sections and markdown.strip():
        sections.append(
            ReportSection(
                heading="Overview",
                body=markdown.strip(),
                charts=None,
            )
        )

    return sections


def _extract_summary(markdown: str, max_chars: int = 400) -> str:
    """Extract the first meaningful paragraph as the executive summary."""
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("---"):
            if len(stripped) > 60:
                return stripped[:max_chars] + ("…" if len(stripped) > max_chars else "")
    return markdown[:max_chars].strip()


class ReportService:
    def __init__(self, client: LLMClient = llm_client) -> None:
        self._llm = client

    async def handle(self, req: ReportRequest) -> ReportResponse:
        logger.info(
            "Report request | kind=%s | target=%s | tone=%s",
            req.kind,
            req.target.name,
            req.tone,
        )

        from app.config import settings

        if settings.openai_api_key:
            tone_instructions = {
                "analytical": "Use a rigorous, data-driven analytical tone with statistics and evidence.",
                "executive": "Use a concise executive tone suitable for C-suite decision-makers. Lead with key insights.",
                "technical": "Use a technical tone with precise metrics, methodologies, and quantitative data.",
                "educational": "Use a clear, accessible educational tone suitable for a general audience.",
            }.get(req.tone, "Use a professional analytical tone.")

            prompt = (
                f"Generate a comprehensive intelligence report titled '{req.title}' "
                f"about the {req.kind} '{req.target.name}' (ID: {req.target.id}). "
                f"{tone_instructions} "
                "Structure the report with clear Markdown sections (## headings) covering: "
                "Economic Profile, Demographic Overview, Climate & Environment, "
                "Geopolitical Context, and Strategic Outlook. "
                "Include specific data, statistics, and actionable insights. "
                "The report should be comprehensive and at least 600 words."
            )

            messages = [
                LLMMessage(
                    role="system",
                    content=(
                        "You are a senior intelligence analyst for the Earth Digital Twin platform. "
                        "You produce authoritative, well-structured reports on countries, cities, "
                        "regions, and global topics. Always include specific data and cite sources."
                    ),
                ),
                LLMMessage(role="user", content=prompt),
            ]

            result = await self._llm.complete(messages=messages, model_override=req.model)
            full_content = result.content
            total_tokens = result.total_tokens
        else:
            result = mock_report_response(
                target_name=req.target.name,
                kind=req.kind,
                tone=req.tone,
                title=req.title,
            )
            full_content = result.content
            total_tokens = result.total_tokens

        sections = _parse_sections(full_content)
        summary = _extract_summary(full_content)

        return ReportResponse(
            title=req.title,
            summary=summary,
            content=full_content,
            sections=sections,
            usage=ReportUsage(totalTokens=total_tokens),
        )
