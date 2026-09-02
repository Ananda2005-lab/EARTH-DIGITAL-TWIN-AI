"""
Pydantic models for the /v1/chat endpoint.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's message")
    context: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional map/location context from the frontend",
    )
    intentHint: Optional[str] = Field(
        None,
        description="Optional hint about the user's intent",
    )
    history: List[HistoryMessage] = Field(
        default_factory=list,
        description="Conversation history",
    )
    model: Optional[str] = Field(None, description="Override model name")


# ── Response ─────────────────────────────────────────────────────────────────

class Citation(BaseModel):
    source: str
    url: Optional[str] = None


class Action(BaseModel):
    kind: str
    label: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class UsageInfo(BaseModel):
    promptTokens: int = 0
    completionTokens: int = 0
    totalTokens: int = 0


class ChatResponse(BaseModel):
    content: str
    intent: Optional[str] = None
    citations: Optional[List[Citation]] = None
    actions: Optional[List[Action]] = None
    usage: UsageInfo
    model: str
