from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class MatterBase(BaseModel):
    matter_type: str
    title: str
    status: str = "Open"
    target_program: Optional[str] = None
    country_of_residence: Optional[str] = None
    inside_canada: Optional[bool] = None
    notes: Optional[str] = None
    intake_payload: Optional[Dict[str, Any]] = None
    eligibility_result: Optional[Dict[str, Any]] = None


class MatterCreate(MatterBase):
    pass


class MatterUpdate(BaseModel):
    matter_type: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    target_program: Optional[str] = None
    country_of_residence: Optional[str] = None
    inside_canada: Optional[bool] = None
    notes: Optional[str] = None
    intake_payload: Optional[Dict[str, Any]] = None
    eligibility_result: Optional[Dict[str, Any]] = None


class MatterResponse(MatterBase):
    id: int
    client_id: int
    owner_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}