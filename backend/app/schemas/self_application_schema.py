from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SelfApplicationUpsertRequest(BaseModel):
    matter_type: str
    intake: dict[str, Any] = {}


class SelfApplicationResponse(BaseModel):
    id: int
    user_id: int
    matter_type: str
    intake_payload: dict[str, Any] | None = None
    eligibility_result: dict[str, Any] | None = None
    forms_result: dict[str, Any] | None = None
    checklist_result: list[dict[str, Any]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SelfWorkspaceResponse(BaseModel):
    application: SelfApplicationResponse
    eligibility: dict[str, Any]
    forms_assistant: dict[str, Any]
    checklist: list[dict[str, Any]]