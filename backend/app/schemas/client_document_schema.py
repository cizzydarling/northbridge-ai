from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClientDocumentBase(BaseModel):
    document_name: str
    document_type: Optional[str] = None
    status: str = "Required"
    notes: Optional[str] = None
    matter_id: Optional[int] = None
    required: bool = True
    generated_from_matter: bool = False


class ClientDocumentCreate(ClientDocumentBase):
    pass


class ClientDocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    document_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    matter_id: Optional[int] = None
    required: Optional[bool] = None
    generated_from_matter: Optional[bool] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[int] = None


class ClientDocumentResponse(ClientDocumentBase):
    id: int
    client_id: int
    owner_user_id: int

    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[int] = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GeneratedMatterDocumentCreate(BaseModel):
    document_name: str
    document_type: Optional[str] = None
    notes: Optional[str] = None
    required: bool = True


class GenerateMatterDocumentsRequest(BaseModel):
    documents: list[GeneratedMatterDocumentCreate]