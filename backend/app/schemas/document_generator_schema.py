from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field


DocumentType = Literal[
    "letter_of_explanation",
    "study_plan",
    "client_submission_notes",
    "travel_history_explanation",
    "proof_of_funds_explanation",
    "relationship_explanation",
]


class DocumentSections(BaseModel):
    intro: Optional[str] = None
    body: Optional[str] = None
    conclusion: Optional[str] = None


class DocumentMeta(BaseModel):
    tone: Optional[str] = None
    mode: Optional[str] = None
    pathway: Optional[str] = None


class DocumentGeneratorRequest(BaseModel):
    document_type: DocumentType
    language: Literal["en", "fr"] = "en"
    tone: Literal["professional", "formal", "clear"] = "professional"
    additional_instructions: Optional[str] = None
    pathway: Optional[str] = None
    context_overrides: Optional[Dict[str, Any]] = Field(default_factory=dict)
    mode: Optional[str] = "generate"


class DocumentGeneratorResponse(BaseModel):
    title: str
    document_type: DocumentType
    language: Literal["en", "fr"]
    content: str
    sections: Optional[DocumentSections] = None
    meta: Optional[DocumentMeta] = None
    disclaimer: str
    is_premium: bool = False
    locked: bool = False
    upgrade_reason: Optional[str] = None