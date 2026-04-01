from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.generated_document_model import GeneratedDocument
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.generated_document_schema import (
    GeneratedDocumentCreate,
    GeneratedDocumentListItem,
    GeneratedDocumentResponse,
    GeneratedDocumentUpdate,
)

router = APIRouter(prefix="/documents", tags=["Generated Documents"])


@router.get("/", response_model=list[GeneratedDocumentListItem])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = (
        db.query(GeneratedDocument)
        .filter(GeneratedDocument.user_id == current_user.id)
        .order_by(GeneratedDocument.created_at.desc())
        .all()
    )
    return docs


@router.get("/{doc_id}", response_model=GeneratedDocumentResponse)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.id == doc_id,
            GeneratedDocument.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    return doc


@router.post("/", response_model=GeneratedDocumentResponse)
def create_document(
    payload: GeneratedDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = GeneratedDocument(
        user_id=current_user.id,
        document_type=payload.document_type,
        title=payload.title,
        language=payload.language,
        content=payload.content,
        tone=payload.tone,
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    return doc


@router.put("/{doc_id}", response_model=GeneratedDocumentResponse)
def update_document(
    doc_id: int,
    payload: GeneratedDocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.id == doc_id,
            GeneratedDocument.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    doc.content = payload.content

    if payload.title is not None:
        doc.title = payload.title

    if payload.tone is not None:
        doc.tone = payload.tone

    db.commit()
    db.refresh(doc)

    return doc


@router.post("/{doc_id}/duplicate", response_model=GeneratedDocumentResponse)
def duplicate_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.id == doc_id,
            GeneratedDocument.user_id == current_user.id,
        )
        .first()
    )

    if not original:
        raise HTTPException(status_code=404, detail="Document not found.")

    duplicate = GeneratedDocument(
        user_id=current_user.id,
        document_type=original.document_type,
        title=f"{original.title} (Copy)",
        language=original.language,
        content=original.content,
        tone=original.tone,
    )

    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)

    return duplicate


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.id == doc_id,
            GeneratedDocument.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    db.delete(doc)
    db.commit()

    return {"success": True}