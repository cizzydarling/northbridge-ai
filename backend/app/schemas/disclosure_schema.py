from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DisclosureAcceptanceCreate(BaseModel):
    disclosure_type: str
    disclosure_version: str
    accepted_text_snapshot: str
    client_id: Optional[int] = None
    matter_id: Optional[int] = None


class DisclosureAcceptanceResponse(BaseModel):
    id: int
    user_id: int
    client_id: Optional[int] = None
    matter_id: Optional[int] = None
    disclosure_type: str
    disclosure_version: str
    accepted_text_snapshot: str
    accepted_at: datetime

    model_config = {"from_attributes": True}