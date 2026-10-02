from types import SimpleNamespace
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.routes.self_document_routes import require_self_user
from app.models.application_case_model import ApplicationCase
from app.schemas.application_case_schema import ApplicationCaseCreate, ApplicationCaseUpdate
from app.services.household_service import (resolve_application_context, context_snapshot, initialize_household,
    owned_case, replace_participation, lock_owner, set_active_case, invalidate_family_results)

router = APIRouter(prefix="/application-cases", tags=["Application Cases"])

def case_output(case):
    return {c.name: getattr(case, c.name) for c in case.__table__.columns}

@router.get("")
def list_cases(db: Session = Depends(get_db), user=Depends(require_self_user)):
    resolve_application_context(db, user)
    return [case_output(c) for c in db.query(ApplicationCase).filter_by(owner_user_id=user.id).filter(ApplicationCase.status != "archived").order_by(ApplicationCase.id).all()]

@router.get("/context")
def current_context(case_id: int | None = None, db: Session = Depends(get_db), user=Depends(require_self_user)):
    context = resolve_application_context(db, user, case_id)
    return {**context_snapshot(context), "case": case_output(context.case)}

@router.post("")
def create_case(payload: ApplicationCaseCreate, db: Session = Depends(get_db), user=Depends(require_self_user)):
    # Adopt pre-existing workspace before adding another case, in one transaction.
    resolve_application_context(db, user, commit=False)
    household, self_member, _ = initialize_household(db, user)
    case = ApplicationCase(household_id=household.id, owner_user_id=user.id,
        primary_applicant_member_id=self_member.id, **payload.model_dump(exclude={"members"}))
    db.add(case)
    db.flush()
    replace_participation(db, SimpleNamespace(case=case, household=household), payload.members)
    set_active_case(db, user, case)
    db.commit()
    return case_output(case)

@router.get("/{case_id}")
def read_case(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    context = resolve_application_context(db, user, case_id)
    return {**case_output(context.case), "members": context_snapshot(context)["members"]}

@router.put("/{case_id}")
def update_case(case_id: int, payload: ApplicationCaseUpdate, db: Session = Depends(get_db), user=Depends(require_self_user)):
    context = resolve_application_context(db, user, case_id, commit=False)
    lock_owner(db, user)
    context.case = owned_case(db, user, case_id)
    values = payload.model_dump(exclude_unset=True, exclude={"members"})
    for key, value in values.items():
        setattr(context.case, key, value)
    if payload.members is not None:
        replace_participation(db, context, payload.members)
    invalidate_family_results(db, user.id, context.case.id)
    # Existing intake stays intact; consumers recompute derived results.
    if context.application and "application_type" in values:
        context.application.matter_type = context.case.application_type
    db.commit()
    return case_output(context.case)

@router.post("/{case_id}/activate")
def activate_case(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    lock_owner(db, user)
    case = owned_case(db, user, case_id)
    set_active_case(db, user, case)
    db.commit()
    return case_output(case)

@router.delete("/{case_id}")
def archive_case(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    lock_owner(db, user)
    case = owned_case(db, user, case_id)
    case.is_active = False
    case.status = "archived"
    db.commit()
    # Deterministic oldest remaining case, or a new empty application.
    context = resolve_application_context(db, user)
    return {"archived": True, "active_case_id": context.case.id}
