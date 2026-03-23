from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SelfDocumentBase(BaseModel):
    matter_type: str
    document_key: str
    document_name: str
    priority: str = "Required"
    required: bool = True
    notes: Optional[str] = None


class SelfDocumentCreate(SelfDocumentBase):
    pass


class SelfDocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    priority: Optional[str] = None
    required: Optional[bool] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    uploaded_at: Optional[datetime] = None


class SelfDocumentResponse(SelfDocumentBase):
    id: int
    user_id: int
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    completed: bool
    uploaded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}