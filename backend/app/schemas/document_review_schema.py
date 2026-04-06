from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class DocumentReviewRequest(BaseModel):
    content: str = Field(..., min_length=20)
    document_type: str = Field(..., min_length=1)
    language: Literal["en", "fr"] = "en"
    review_depth: Literal["standard", "detailed"] = "standard"
    additional_context: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def support_legacy_keys(cls, values):
        if not isinstance(values, dict):
            return values

        normalized = dict(values)

        if "content" not in normalized and "document_text" in normalized:
            normalized["content"] = normalized["document_text"]

        if "additional_context" not in normalized and "review_focus" in normalized:
            normalized["additional_context"] = normalized["review_focus"]

        return normalized


class DocumentReviewResponse(BaseModel):
    language: Literal["en", "fr"]
    document_type: str
    summary: str
    strengths: list[str]
    concerns: list[str]
    missing_support: list[str]
    improvement_actions: list[str]
    reviewed_document_preview: str
    disclaimer: str
    is_premium: bool = False
    locked: bool = False
    upgrade_reason: Optional[str] = None