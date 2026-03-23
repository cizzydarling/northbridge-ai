from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    language: Literal["en", "fr"] = "en"
    chat_history: Optional[List[AIChatMessage]] = []


class AIChatResponse(BaseModel):
    reply: str
    profile_found: bool = True
    strategy_loaded: bool = True
    language: Literal["en", "fr"] = "en"