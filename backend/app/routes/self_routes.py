from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import get_current_user
from app.data.db import get_db
from app.models.self_application_model import SelfApplication
from app.models.self_document_model import SelfDocument
from app.schemas.self_application_schema import (
    SelfApplicationResponse,
    SelfApplicationUpsertRequest,
    SelfWorkspaceResponse,
)
from app.services.checklist_engine import build_checklist
from app.services.eligibility_engine import evaluate_matter_eligibility
from app.services.forms_assistant import build_forms_assistant

router = APIRouter(prefix="/self", tags=["Self"])


def require_self_user(current_user=Depends(get_current_user)):
    is_agent = (
        getattr(current_user, "plan", None) == "agent"
        or getattr(current_user, "role", None) == "agent"
    )

    if is_agent:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available to self-serve users.",
        )

    return current_user


def get_self_application_for_user(db: Session, user_id: int) -> SelfApplication | None:
    return (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == user_id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )


def sync_self_documents_from_checklist(
    db: Session,
    user_id: int,
    matter_type: str,
    checklist: list[dict],
) -> None:
    existing_documents = (
        db.query(SelfDocument)
        .filter(
            SelfDocument.user_id == user_id,
            SelfDocument.matter_type == matter_type,
        )
        .all()
    )

    existing_by_key = {doc.document_key: doc for doc in existing_documents}

    for item in checklist:
        document_key = str(item.get("id") or "").strip()
        if not document_key:
            continue

        document_name = item.get("name") or "Document"
        priority = item.get("status") or "Required"
        notes = item.get("reason")
        required = priority == "Required"

        existing = existing_by_key.get(document_key)

        if existing:
            existing.document_name = document_name
            existing.priority = priority
            existing.required = required
            existing.notes = notes
        else:
            document = SelfDocument(
                user_id=user_id,
                matter_type=matter_type,
                document_key=document_key,
                document_name=document_name,
                priority=priority,
                required=required,
                notes=notes,
                completed=False,
            )
            db.add(document)


@router.get("/application")
def get_self_application_context(
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    application = get_self_application_for_user(db, current_user.id)

    return {
        "message": "Self application workspace is available.",
        "user_id": current_user.id,
        "email": current_user.email,
        "role": getattr(current_user, "role", None),
        "plan": getattr(current_user, "plan", None),
        "application": application,
    }


@router.get("/application/saved", response_model=SelfApplicationResponse)
def get_saved_self_application(
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    application = get_self_application_for_user(db, current_user.id)

    if not application:
        raise HTTPException(status_code=404, detail="No saved self application found.")

    return application


@router.post("/workspace", response_model=SelfWorkspaceResponse)
def run_self_workspace(
    payload: SelfApplicationUpsertRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    matter_type = payload.matter_type
    intake = payload.intake or {}

    eligibility = evaluate_matter_eligibility(matter_type, intake)
    forms_assistant = build_forms_assistant(matter_type, intake)
    checklist = build_checklist(matter_type, intake)

    application = get_self_application_for_user(db, current_user.id)

    if application:
        application.matter_type = matter_type
        application.intake_payload = intake
        application.eligibility_result = eligibility
        application.forms_result = forms_assistant
        application.checklist_result = checklist
    else:
        application = SelfApplication(
            user_id=current_user.id,
            matter_type=matter_type,
            intake_payload=intake,
            eligibility_result=eligibility,
            forms_result=forms_assistant,
            checklist_result=checklist,
        )
        db.add(application)

    sync_self_documents_from_checklist(
        db=db,
        user_id=current_user.id,
        matter_type=matter_type,
        checklist=checklist,
    )

    db.commit()
    db.refresh(application)

    return {
        "application": application,
        "eligibility": eligibility,
        "forms_assistant": forms_assistant,
        "checklist": checklist,
    }