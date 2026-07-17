from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.self_document_model import SelfDocument
from app.routes.auth_routes import get_current_user
from app.services.document_storage import (
    delete_document,
    document_download_response,
    store_document,
)
from app.schemas.self_document_schema import (
    SelfDocumentCreate,
    SelfDocumentResponse,
    SelfDocumentUpdate,
)
from app.utils.upload_security import (
    get_safe_upload_extension,
    validate_upload_content,
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

    delete_document(document.file_path, legacy_upload_dir=UPLOAD_DIR)

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

    extension = get_safe_upload_extension(file.filename)

    content = await file.read()
    validate_upload_content(file, content, extension)
    stored_locator = store_document(
        content,
        namespace=f"self_documents/{current_user.id}/{document_id}",
        filename_extension=extension,
        content_type=file.content_type,
    )

    delete_document(document.file_path, legacy_upload_dir=UPLOAD_DIR)

    document.file_name = file.filename
    document.file_path = stored_locator
    document.file_url = f"/self-documents/{document_id}/file"
    document.uploaded_at = datetime.now(timezone.utc)
    document.completed = True

    db.commit()
    db.refresh(document)
    return document


@router.get("/{document_id}/file")
def download_self_document_file(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    document = get_owned_self_document_or_404(db, document_id, current_user.id)
    return get_document_file_response(document)


@router.delete("/{document_id}/file", response_model=SelfDocumentResponse)
def remove_self_document_file(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    document = get_owned_self_document_or_404(db, document_id, current_user.id)

    delete_document(document.file_path, legacy_upload_dir=UPLOAD_DIR)

    document.file_name = None
    document.file_path = None
    document.file_url = None
    document.uploaded_at = None
    document.completed = False

    db.commit()
    db.refresh(document)
    return document


def get_document_file_response(document: SelfDocument) -> Response:
    return document_download_response(
        document.file_path,
        filename=document.file_name,
        legacy_upload_dir=UPLOAD_DIR,
    )
