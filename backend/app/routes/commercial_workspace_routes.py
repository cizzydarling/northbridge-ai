"""Owned CRS preparation only; no numerical or eligibility activation."""
from copy import deepcopy
from datetime import date
from hashlib import sha256
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.models.self_application_model import SelfApplication
from app.routes.self_document_routes import require_self_user
from app.services.household_service import owned_case, lock_owner
from app.services.official_crs import RankingFacts, missing_evidence, TABLE_DIGEST
from app.rules.crs_versions import candidate_for, policy_metadata
from app.core.access_control import ensure_individual_pro

router = APIRouter(prefix="/preparation/cases", tags=["CRS preparation"])
# Code can be exercised through isolated service tests, not activated by an env var
# or an owner-supplied payload. A separate reviewed release must change this gate.
SCENARIO_PREPARATION_RELEASED = False

class SavedFacts(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(strict=True, ge=0)
    facts: RankingFacts


class PreparationScenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    identifier: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,39}$")
    title: str = Field(min_length=1, max_length=80)
    facts: RankingFacts


class SavedScenarios(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(strict=True, ge=0)
    items: list[PreparationScenario] = Field(max_length=10)


def load_record(db, user, case_id):
    owned_case(db, user, case_id)
    return db.query(SelfApplication).filter_by(user_id=user.id, application_case_id=case_id).first()


def response(case_id, saved, *, db=None, user=None):
    facts = RankingFacts.model_validate(saved.get("facts", {}))
    # Server date selects the public candidate; clients cannot activate a future rule.
    from app.services.language_assessment_service import today
    as_of = today()
    rule = candidate_for(as_of)
    context = {"profile": {}, "selected_languages": {}}
    if db is not None and user is not None:
        from app.models.profile_model import Profile
        from app.routes.crs_assessment_routes import language_context
        profile = db.query(Profile).filter_by(user_id=user.id).first()
        context["profile"] = {key: getattr(profile, key, None) for key in ("age", "education")}
        context["selected_languages"] = {language: {key: record.get(key) for key in
            ("id", "status", "usable", "skills", "expires_on", "mapping_version", "source")}
            for language, record in language_context(db, user).items()}
    return {"case_id": case_id, "revision": saved.get("revision", 0), "facts": facts.model_dump(),
            "score": None, "missing_inputs": missing_evidence(facts), "validation_status": "REVIEW_REQUIRED",
            "ruleset_version": rule.version, "effective_date": rule.effective_from,
            "table_digest": TABLE_DIGEST, "policy": policy_metadata(as_of),
            "owned_reference": context, "scenario_preparation_available": SCENARIO_PREPARATION_RELEASED,
            "ranking_is_program_eligibility": False, "invitation_eligibility": "not_assessed"}


@router.get("/{case_id}/crs-inputs")
def read_inputs(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    record = load_record(db, user, case_id)
    saved = (record.intake_payload or {}).get("crs_preparation", {}) if record else {}
    return response(case_id, saved, db=db, user=user)


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
    saved = deepcopy(previous)
    saved.update(revision=body.revision + 1, facts=body.facts.model_dump())
    intake["crs_preparation"] = saved
    record.intake_payload = intake
    db.commit()
    return response(case_id, saved, db=db, user=user)


def scenario_payload(case_id, preparation):
    saved = preparation.get("scenario_preparation", {})
    return {"case_id": case_id, "revision": saved.get("revision", 0),
            "items": deepcopy(saved.get("items", [])), "numerical_activation": False,
            "scenario_preparation_available": SCENARIO_PREPARATION_RELEASED}


def save_scenario_preparation(db, user, case_id, body):
    """Owned explicit persistence; caller must enforce the unreleased API gate.

    Keep this within the existing server-protected crs_preparation namespace so
    legacy Forms replacement cannot erase or inject scenario revisions.
    """
    case = owned_case(db, user, case_id)
    ensure_individual_pro(user, feature="crs_saved_scenarios")
    identifiers = [item.identifier for item in body.items]
    if len(identifiers) != len(set(identifiers)):
        raise HTTPException(422, "Scenario identifiers must be unique")
    lock_owner(db, user)
    record = load_record(db, user, case_id)
    if record is None:
        record = SelfApplication(user_id=user.id, application_case_id=case_id,
                                 matter_type=case.application_type, intake_payload={})
        db.add(record)
        db.flush()
    db.refresh(record)
    intake = deepcopy(record.intake_payload or {})
    preparation = deepcopy(intake.get("crs_preparation", {}))
    previous = preparation.get("scenario_preparation", {})
    if previous.get("revision", 0) != body.revision:
        raise HTTPException(409, "Scenarios changed; reload before saving")
    from app.services.language_assessment_service import today
    from app.routes.crs_assessment_routes import language_context
    evidence = language_context(db, user)
    provenance = {language: {key: value[key].isoformat() if isinstance(value.get(key), date) else value.get(key)
                             for key in ("id", "mapping_version", "mapping_digest", "expires_on", "status")}
                  for language, value in evidence.items()}
    as_of = today()
    rule = candidate_for(as_of)
    prepared = []
    for item in body.items:
        facts = item.facts.model_dump()
        prepared.append({"identifier": item.identifier, "title": item.title, "facts": facts,
                         "ruleset_version": rule.version, "table_digest": TABLE_DIGEST,
                         "prepared_on": as_of.isoformat(), "language_evidence": deepcopy(provenance),
                         "facts_hash": sha256(json.dumps(facts, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
                         "score": None})
    preparation["scenario_preparation"] = {"revision": body.revision + 1, "items": prepared}
    intake["crs_preparation"] = preparation
    record.intake_payload = intake
    db.commit()
    return scenario_payload(case_id, preparation)


@router.get("/{case_id}/crs-scenarios")
def read_scenarios(case_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    record = load_record(db, user, case_id)
    if not SCENARIO_PREPARATION_RELEASED:
        raise HTTPException(403, "Saved scenario access awaits separate release approval")
    preparation = (record.intake_payload or {}).get("crs_preparation", {}) if record else {}
    return scenario_payload(case_id, preparation)


@router.put("/{case_id}/crs-scenarios")
def save_scenarios(case_id: int, body: SavedScenarios, db: Session = Depends(get_db), user=Depends(require_self_user)):
    owned_case(db, user, case_id)
    if not SCENARIO_PREPARATION_RELEASED:
        raise HTTPException(403, "Saved scenario access awaits separate release approval")
    return save_scenario_preparation(db, user, case_id, body)
