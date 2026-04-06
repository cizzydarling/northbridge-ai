from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import (
    ensure_document_generator_full,
    get_current_user,
    has_individual_pro,
    has_premium_access,
)
from app.data.db import get_db
from app.models.generated_document_model import GeneratedDocument
from app.models.user_models import User
from app.schemas.generated_document_schema import (
    GeneratedDocumentCreate,
    GeneratedDocumentListItem,
    GeneratedDocumentResponse,
    GeneratedDocumentUpdate,
)

router = APIRouter(prefix="/documents", tags=["Generated Documents"])


def _get_owned_document_or_404(
    db: Session,
    doc_id: int,
    user_id: int,
) -> GeneratedDocument:
    doc = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.id == doc_id,
            GeneratedDocument.user_id == user_id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    return doc


def _build_document_response(doc: GeneratedDocument, current_user: User) -> GeneratedDocument:
    """
    Keep DB model unchanged but expose launch-aligned access flags
    through response-compatible attributes.
    """
    is_pro = has_individual_pro(current_user)
    is_premium = has_premium_access(current_user)

    # Full document access for Pro/Premium
    doc.locked = not is_pro
    doc.is_premium = is_premium

    if not is_pro:
        doc.upgrade_reason = (
            "Upgrade to Pro to unlock the full draft and document workflow."
        )
    else:
        doc.upgrade_reason = None

    return doc


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
    doc = _get_owned_document_or_404(db, doc_id, current_user.id)
    return _build_document_response(doc, current_user)


@router.post("/", response_model=GeneratedDocumentResponse)
def create_document(
    payload: GeneratedDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Keep creation available so free users can still enter the funnel,
    # but downstream full usage is gated.
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

    return _build_document_response(doc, current_user)


@router.put("/{doc_id}", response_model=GeneratedDocumentResponse)
def update_document(
    doc_id: int,
    payload: GeneratedDocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_document_generator_full(current_user)

    doc = _get_owned_document_or_404(db, doc_id, current_user.id)

    doc.content = payload.content

    if payload.title is not None:
        doc.title = payload.title

    if payload.tone is not None:
        doc.tone = payload.tone

    db.commit()
    db.refresh(doc)

    return _build_document_response(doc, current_user)


@router.post("/{doc_id}/duplicate", response_model=GeneratedDocumentResponse)
def duplicate_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_document_generator_full(current_user)

    original = _get_owned_document_or_404(db, doc_id, current_user.id)

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

    return _build_document_response(duplicate, current_user)


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_document_generator_full(current_user)

    doc = _get_owned_document_or_404(db, doc_id, current_user.id)

    db.delete(doc)
    db.commit()

    return {"success": True}