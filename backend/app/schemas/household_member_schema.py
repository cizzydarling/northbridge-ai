from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class HouseholdMemberBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    relationship_to_primary: str = "self"
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    current_country: Optional[str] = None
    email: Optional[str] = None
    is_primary_applicant: bool = False


class HouseholdMemberCreate(HouseholdMemberBase):
    household_id: Optional[int] = None


class HouseholdMemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    relationship_to_primary: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    current_country: Optional[str] = None
    email: Optional[str] = None
    is_primary_applicant: Optional[bool] = None


class HouseholdMemberResponse(HouseholdMemberBase):
    id: int
    household_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}