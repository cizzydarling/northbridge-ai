from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class GeneratedDocumentCreate(BaseModel):
    document_type: str
    title: str
    language: str
    content: str
    tone: Optional[str] = None


class GeneratedDocumentUpdate(BaseModel):
    content: str
    title: Optional[str] = None
    tone: Optional[str] = None


class GeneratedDocumentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_type: str
    title: str
    language: str
    tone: Optional[str] = None
    created_at: datetime

class GeneratedDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_type: str
    title: str
    language: str
    content: str
    tone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
