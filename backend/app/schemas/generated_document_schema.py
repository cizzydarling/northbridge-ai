from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_serializer


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

    @field_serializer("title")
    def contained_title(self, value):
        from app.services.content_scope import guard_generated_text
        return guard_generated_text(value, self.language)

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


    @field_serializer("title", "content")
    def contained_text(self, value):
        from app.services.content_scope import guard_generated_text
        if any(word in self.document_type.lower() for word in ("strategy", "recommendation", "assessment", "simulation")):
            from app.services.content_scope import notice
            return notice(self.language)
        return guard_generated_text(value, self.language)
