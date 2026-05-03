from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ApplicationCaseBase(BaseModel):
    application_type: str
    case_title: Optional[str] = None
    status: str = "draft"
    primary_applicant_member_id: Optional[int] = None
    target_country: str = "Canada"
    target_province: Optional[str] = None
    pathway: Optional[str] = None
    family_size: int = 1


class ApplicationCaseCreate(ApplicationCaseBase):
    household_id: Optional[int] = None


class ApplicationCaseUpdate(BaseModel):
    application_type: Optional[str] = None
    case_title: Optional[str] = None
    status: Optional[str] = None
    primary_applicant_member_id: Optional[int] = None
    target_country: Optional[str] = None
    target_province: Optional[str] = None
    pathway: Optional[str] = None
    family_size: Optional[int] = None


class ApplicationCaseResponse(ApplicationCaseBase):
    id: int
    household_id: int
    owner_user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}