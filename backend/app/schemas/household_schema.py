from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HouseholdBase(BaseModel):
    name: Optional[str] = None


class HouseholdCreate(HouseholdBase):
    pass


class HouseholdUpdate(HouseholdBase):
    pass


class HouseholdResponse(HouseholdBase):
    id: int
    owner_user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}