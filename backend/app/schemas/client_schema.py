from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    status: str = "Active"
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime