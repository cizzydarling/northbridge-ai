from typing import Literal, Optional

from pydantic import BaseModel, Field


class DocumentReviewRequest(BaseModel):
    document_text: str = Field(..., min_length=20)
    document_type: str = Field(..., min_length=1)
    language: Literal["en", "fr"] = "en"
    review_focus: Optional[str] = None


class DocumentReviewResponse(BaseModel):
    language: Literal["en", "fr"]
    document_type: str
    overall_assessment: str
    strengths: list[str]
    concerns: list[str]
    missing_elements: list[str]
    improvement_suggestions: list[str]
    suggested_next_step: str
    disclaimer: str