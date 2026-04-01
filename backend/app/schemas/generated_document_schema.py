from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
    id: int
    document_type: str
    title: str
    language: str
    tone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GeneratedDocumentResponse(BaseModel):
    id: int
    document_type: str
    title: str
    language: str
    content: str
    tone: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True