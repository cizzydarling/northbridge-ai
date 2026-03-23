from datetime import datetime, timezone
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.access_control import require_agent_plan
from app.data.db import get_db
from app.models.client_document_model import ClientDocument
from app.models.client_model import Client
from app.models.matter_model import Matter
from app.schemas.client_document_schema import (
    ClientDocumentCreate,
    ClientDocumentResponse,
    ClientDocumentUpdate,
    GenerateMatterDocumentsRequest,
)

router = APIRouter(prefix="/client-documents", tags=["Client Documents"])

UPLOAD_DIR = Path("uploads/client_documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def normalize_document_status(status: str | None, required: bool = True) -> str:
    value = (status or "").strip()

    if value in {"Required", "Uploaded", "Verified"}:
        return value

    if value in {"Completed", "Reviewed"}:
        return "Verified"

    if value in {"Received", "In Progress"}:
        return "Uploaded"

    if value in {"Requested", "Not Started"}:
        return "Required" if required else "Uploaded"

    return "Required" if required else "Uploaded"


def get_owned_client_or_404(db: Session, client_id: int, current_user) -> Client:
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.owner_user_id == current_user.id,
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    return client


def get_owned_matter_or_404(
    db: Session, client_id: int, matter_id: int, current_user
) -> Matter:
    matter = (
        db.query(Matter)
        .filter(
            Matter.id == matter_id,
            Matter.client_id == client_id,
            Matter.owner_user_id == current_user.id,
        )
        .first()
    )

    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found.")

    return matter


def get_owned_document_or_404(
    db: Session, client_id: int, document_id: int, current_user
) -> ClientDocument:
    document = (
        db.query(ClientDocument)
        .filter(
            ClientDocument.id == document_id,
            ClientDocument.client_id == client_id,
            ClientDocument.owner_user_id == current_user.id,
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    return document


@router.get("/{client_id}", response_model=List[ClientDocumentResponse])
def get_client_documents(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)

    return (
        db.query(ClientDocument)
        .filter(
            ClientDocument.client_id == client_id,
            ClientDocument.owner_user_id == current_user.id,
        )
        .order_by(ClientDocument.created_at.desc())
        .all()
    )


@router.post("/{client_id}", response_model=ClientDocumentResponse)
def create_client_document(
    client_id: int,
    payload: ClientDocumentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)

    if payload.matter_id is not None:
        get_owned_matter_or_404(db, client_id, payload.matter_id, current_user)

    normalized_status = normalize_document_status(payload.status, payload.required)

    document = ClientDocument(
        client_id=client_id,
        owner_user_id=current_user.id,
        matter_id=payload.matter_id,
        document_name=payload.document_name,
        document_type=payload.document_type,
        status=normalized_status,
        notes=payload.notes,
        required=payload.required,
        generated_from_matter=payload.generated_from_matter,
    )

    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.put("/{client_id}/{document_id}", response_model=ClientDocumentResponse)
def update_client_document(
    client_id: int,
    document_id: int,
    payload: ClientDocumentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    document = get_owned_document_or_404(db, client_id, document_id, current_user)

    next_required = (
        payload.required if payload.required is not None else document.required
    )

    if payload.matter_id is not None:
        get_owned_matter_or_404(db, client_id, payload.matter_id, current_user)

    if payload.document_name is not None:
        document.document_name = payload.document_name

    if payload.document_type is not None:
        document.document_type = payload.document_type

    next_status = None

    if payload.status is not None:
        next_status = normalize_document_status(payload.status, next_required)
        document.status = next_status
    elif payload.required is not None:
        next_status = normalize_document_status(document.status, next_required)
        document.status = next_status
    else:
        next_status = document.status

    if payload.notes is not None:
        document.notes = payload.notes

    if payload.matter_id is not None:
        document.matter_id = payload.matter_id

    if payload.required is not None:
        document.required = payload.required

    if payload.generated_from_matter is not None:
        document.generated_from_matter = payload.generated_from_matter

    if payload.file_name is not None:
        document.file_name = payload.file_name

    if payload.file_path is not None:
        document.file_path = payload.file_path

    if payload.file_url is not None:
        document.file_url = payload.file_url

    if payload.uploaded_at is not None:
        document.uploaded_at = payload.uploaded_at

    if next_status == "Verified":
        if document.verified_at is None:
            document.verified_at = datetime.now(timezone.utc)
        document.verified_by = current_user.id
    else:
        document.verified_at = None
        document.verified_by = None

    db.commit()
    db.refresh(document)
    return document    


@router.delete("/{client_id}/{document_id}")
def delete_client_document(
    client_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    document = get_owned_document_or_404(db, client_id, document_id, current_user)

    if document.file_path:
        old_path = Path(document.file_path)
        if old_path.exists():
            old_path.unlink()

    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully."}


@router.post("/{client_id}/{document_id}/upload", response_model=ClientDocumentResponse)
async def upload_client_document_file(
    client_id: int,
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    document = get_owned_document_or_404(db, client_id, document_id, current_user)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    safe_name = file.filename.replace(" ", "_")
    extension = Path(safe_name).suffix
    stored_name = f"{client_id}_{document_id}_{uuid4().hex}{extension}"
    stored_path = UPLOAD_DIR / stored_name

    content = await file.read()
    stored_path.write_bytes(content)

    if document.file_path:
        old_path = Path(document.file_path)
        if old_path.exists():
            old_path.unlink()

    document.file_name = file.filename
    document.file_path = str(stored_path)
    document.file_url = f"/uploads/client_documents/{stored_name}"
    document.uploaded_at = datetime.now(timezone.utc)

    if document.status != "Verified":
        document.status = "Uploaded"

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{client_id}/{document_id}/file", response_model=ClientDocumentResponse)
def remove_client_document_file(
    client_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    document = get_owned_document_or_404(db, client_id, document_id, current_user)

    if document.file_path:
        old_path = Path(document.file_path)
        if old_path.exists():
            old_path.unlink()

    document.file_name = None
    document.file_path = None
    document.file_url = None
    document.uploaded_at = None

    if document.status == "Verified":
        document.status = "Uploaded"
    else:
        document.status = "Required" if document.required else "Uploaded"

    db.commit()
    db.refresh(document)
    return document


@router.post(
    "/{client_id}/matters/{matter_id}/generate",
    response_model=List[ClientDocumentResponse],
)
def generate_documents_from_matter(
    client_id: int,
    matter_id: int,
    payload: GenerateMatterDocumentsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)
    get_owned_matter_or_404(db, client_id, matter_id, current_user)

    created_documents = []

    for item in payload.documents:
        existing = (
            db.query(ClientDocument)
            .filter(
                ClientDocument.client_id == client_id,
                ClientDocument.owner_user_id == current_user.id,
                ClientDocument.matter_id == matter_id,
                ClientDocument.document_name == item.document_name,
            )
            .first()
        )

        if existing:
            created_documents.append(existing)
            continue

        document = ClientDocument(
            client_id=client_id,
            owner_user_id=current_user.id,
            matter_id=matter_id,
            document_name=item.document_name,
            document_type=item.document_type,
            status="Required",
            notes=item.notes,
            required=item.required,
            generated_from_matter=True,
        )

        db.add(document)
        created_documents.append(document)

    db.commit()

    for document in created_documents:
        db.refresh(document)

    return created_documents