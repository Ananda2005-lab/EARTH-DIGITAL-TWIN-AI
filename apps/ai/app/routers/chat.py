"""
POST /v1/chat — AI chat endpoint.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import verify_token
from app.models.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Chat"])
_service = ChatService()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="AI chat",
    dependencies=[Depends(verify_token)],
)
async def chat(body: ChatRequest) -> ChatResponse:
    """
    Process a user message and return an AI-generated response with optional
    intent classification, citations, and suggested actions.
    """
    try:
        return await _service.handle(body)
    except Exception as exc:
        logger.exception("Unhandled error in /v1/chat: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service encountered an internal error. Please try again.",
        ) from exc
