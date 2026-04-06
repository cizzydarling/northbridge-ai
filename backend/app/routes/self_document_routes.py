from datetime import datetime, timezone
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.self_document_model import SelfDocument
from app.routes.auth_routes import get_current_user
from app.schemas.self_document_schema import (
    SelfDocumentCreate,
    SelfDocumentResponse,
    SelfDocumentUpdate,
)

router = APIRouter(prefix="/self-documents", tags=["Self Documents"])

UPLOAD_DIR = Path("uploads/self_documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def require_self_user(current_user=Depends(get_current_user)):
    raw_plan = str(getattr(current_user, "plan", "") or "").strip().lower()
    role = str(getattr(current_user, "role", "") or "").strip().lower()

    is_agent = raw_plan == "agent_pro" or role == "agent"

    if is_agent:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available to self-serve users.",
        )

    return current_user


def get_owned_self_document_or_404(
    db: Session,
    document_id: int,
    user_id: int,
) -> SelfDocument:
    document = (
        db.query(SelfDocument)
        .filter(
            SelfDocument.id == document_id,
            SelfDocument.user_id == user_id,
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Self document not found.")

    return document


@router.get("/", response_model=List[SelfDocumentResponse])
def list_self_documents(
    matter_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    query = db.query(SelfDocument).filter(SelfDocument.user_id == current_user.id)

    if matter_type:
        query = query.filter(SelfDocument.matter_type == matter_type)

    return query.order_by(SelfDocument.created_at.desc()).all()


@router.post("/", response_model=SelfDocumentResponse)
def create_self_document(
    payload: SelfDocumentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    existing = (
        db.query(SelfDocument)
        .filter(
            SelfDocument.user_id == current_user.id,
            SelfDocument.matter_type == payload.matter_type,
            SelfDocument.document_key == payload.document_key,
        )
        .first()
    )

    if existing:
        return existing

    document = SelfDocument(
        user_id=current_user.id,
        matter_type=payload.matter_type,
        document_key=payload.document_key,
        document_name=payload.document_name,
        priority=payload.priority,
        required=payload.required,
        notes=payload.notes,
    )

    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.put("/{document_id}", response_model=SelfDocumentResponse)
def update_self_document(
    document_id: int,
    payload: SelfDocumentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    document = get_owned_self_document_or_404(db, document_id, current_user.id)

    if payload.document_name is not None:
        document.document_name = payload.document_name

    if payload.priority is not None:
        document.priority = payload.priority

    if payload.required is not None:
        document.required = payload.required

    if payload.notes is not None:
        document.notes = payload.notes

    if payload.completed is not None:
        document.completed = payload.completed

    if payload.file_name is not None:
        document.file_name = payload.file_name

    if payload.file_path is not None:
        document.file_path = payload.file_path

    if payload.file_url is not None:
        document.file_url = payload.file_url

    if payload.uploaded_at is not None:
        document.uploaded_at = payload.uploaded_at

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}")
def delete_self_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    document = get_owned_self_document_or_404(db, document_id, current_user.id)

    if document.file_path:
        old_path = Path(document.file_path)
        if old_path.exists() and old_path.is_file():
            old_path.unlink()

    db.delete(document)
    db.commit()

    return {"message": "Self document deleted successfully."}


@router.post("/{document_id}/upload", response_model=SelfDocumentResponse)
async def upload_self_document_file(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    document = get_owned_self_document_or_404(db, document_id, current_user.id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    safe_name = file.filename.replace(" ", "_")
    extension = Path(safe_name).suffix
    stored_name = f"{current_user.id}_{document_id}_{uuid4().hex}{extension}"
    stored_path = UPLOAD_DIR / stored_name

    content = await file.read()
    stored_path.write_bytes(content)

    if document.file_path:
        old_path = Path(document.file_path)
        if old_path.exists() and old_path.is_file():
            old_path.unlink()

    document.file_name = file.filename
    document.file_path = str(stored_path)
    document.file_url = f"/uploads/self_documents/{stored_name}"
    document.uploaded_at = datetime.now(timezone.utc)
    document.completed = True

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}/file", response_model=SelfDocumentResponse)
def remove_self_document_file(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    document = get_owned_self_document_or_404(db, document_id, current_user.id)

    if document.file_path:
        old_path = Path(document.file_path)
        if old_path.exists() and old_path.is_file():
            old_path.unlink()

    document.file_name = None
    document.file_path = None
    document.file_url = None
    document.uploaded_at = None
    document.completed = False

    db.commit()
    db.refresh(document)
    return document