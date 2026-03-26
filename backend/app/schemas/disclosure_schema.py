from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


AllowedDisclosureType = Literal[
    "terms_of_use",
    "privacy_consent",
    "ai_assistance_disclaimer",
    "no_legal_advice_acknowledgment",
    "user_responsibility_acknowledgment",
    "limitation_of_scope_acknowledgment",
]


class DisclosureAcceptanceCreate(BaseModel):
    disclosure_type: AllowedDisclosureType
    disclosure_version: str = Field(..., min_length=1, max_length=50)
    accepted_text_snapshot: str = Field(..., min_length=1)
    client_id: Optional[int] = Field(default=None, ge=1)
    matter_id: Optional[int] = Field(default=None, ge=1)

    @field_validator("disclosure_version")
    @classmethod
    def validate_disclosure_version(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("disclosure_version is required.")
        return cleaned

    @field_validator("accepted_text_snapshot")
    @classmethod
    def validate_accepted_text_snapshot(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("accepted_text_snapshot is required.")
        return cleaned


class DisclosureAcceptanceResponse(BaseModel):
    id: int
    user_id: int
    client_id: Optional[int] = None
    matter_id: Optional[int] = None
    disclosure_type: AllowedDisclosureType
    disclosure_version: str
    accepted_text_snapshot: str
    accepted_at: datetime

    model_config = ConfigDict(from_attributes=True)