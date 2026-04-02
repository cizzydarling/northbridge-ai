from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class AIActionItem(BaseModel):
    label: str = Field(..., min_length=1)
    route: Optional[str] = None


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    language: Literal["en", "fr"] = "en"
    chat_history: Optional[List[AIChatMessage]] = None


class AIChatResponse(BaseModel):
    reply: str
    profile_found: bool = True
    strategy_loaded: bool = True
    language: Literal["en", "fr"] = "en"
    suggested_next_actions: Optional[List[AIActionItem]] = None
    insights: Optional[List[str]] = None
    pathways: Optional[List[str]] = None
    french_advantage: Optional[Dict[str, Any]] = None