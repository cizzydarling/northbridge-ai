"""Owned CRS preparation only; no numerical or eligibility activation."""
from copy import deepcopy
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.models.self_application_model import SelfApplication
from app.routes.self_document_routes import require_self_user
from app.services.household_service import owned_case, lock_owner
from app.services.official_crs import RankingFacts, missing_evidence, TABLE_DIGEST
from app.rules.crs_versions import candidate_for, policy_metadata

router = APIRouter(prefix="/preparation/cases", tags=["CRS preparation"])

class SavedFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(strict=True, ge=0)
    facts: RankingFacts


def load_record(db, user, case_id):
    owned_case(db, user, case_id)
    return db.query(SelfApplication).filter_by(user_id=user.id, application_case_id=case_id).first()


def response(case_id, saved):
    facts = RankingFacts.model_validate(saved.get("facts", {}))
    # Server date selects the public candidate; clients cannot activate a future rule.
    from app.services.language_assessment_service import today
    as_of = today()
    rule = candidate_for(as_of)
    return {"case_id": case_id, "revision": saved.get("revision", 0), "facts": facts.model_dump(),
            "score": None, "missing_inputs": missing_evidence(facts), "validation_status": "REVIEW_REQUIRED",
            "ruleset_version": rule.version, "effective_date": rule.effective_from,
            "table_digest": TABLE_DIGEST, "policy": policy_metadata(as_of),
            "ranking_is_program_eligibility": False, "invitation_eligibility": "not_assessed"}


@router.get("/{case_id}/crs-inputs")
def read_inputs(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    record = load_record(db, user, case_id)
    saved = (record.intake_payload or {}).get("crs_preparation", {}) if record else {}
    return response(case_id, saved)


@router.put("/{case_id}/crs-inputs")
def save_inputs(case_id: int, body: SavedFacts, db: Session = Depends(get_db), user=Depends(require_self_user)):
    case = owned_case(db, user, case_id)
    lock_owner(db, user)
    record = load_record(db, user, case_id)
    if record is None:
        # This explicit save may create preparation; reads never create records.
        record = SelfApplication(user_id=user.id, application_case_id=case_id,
                                 matter_type=case.application_type, intake_payload={})
        db.add(record)
        db.flush()
    db.refresh(record)
    intake = deepcopy(record.intake_payload or {})
    previous = intake.get("crs_preparation", {})
    if previous.get("revision", 0) != body.revision:
        raise HTTPException(409, "Preparation changed; reload before saving")
    saved = {"revision": body.revision + 1, "facts": body.facts.model_dump()}
    intake["crs_preparation"] = saved
    record.intake_payload = intake
    db.commit()
    return response(case_id, saved)
