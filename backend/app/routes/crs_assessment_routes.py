from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.models.language_assessment_model import LanguageAssessment, LanguageSelection
from app.models.profile_model import Profile
from app.services.official_crs import RankingFacts
from app.routes.self_document_routes import require_self_user
from app.services.language_assessment_service import assessment_payload, today
from app.services.crs_assessment_service import review_crs_inputs

router = APIRouter(prefix="/assessments/crs", tags=["CRS verification status"])


class CRSInputs(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    age: int | None = Field(default=None, ge=0, le=120)
    education: Literal["less_than_secondary", "secondary", "one_year", "two_year", "bachelor", "two_or_more", "master", "doctorate"] | None = None
    first_language: Literal["en", "fr"] | None = None
    accompanying_spouse: bool | None = None
    canadian_work_years: int | None = Field(default=None, ge=0, le=60)
    foreign_work_years: int | None = Field(default=None, ge=0, le=60)
    provincial_nomination: bool | None = None
    canadian_education: Literal["none", "one_or_two_years", "three_or_more_years"] | None = None
    sibling_in_canada: bool | None = None
    spouse_education: str | None = Field(default=None, max_length=40)
    spouse_canadian_work_years: int | None = Field(default=None, ge=0, le=60)
    spouse_language: Literal["unknown", "no_results", "reported"] | None = None
    occupation_classification: str | None = Field(default=None, pattern=r"^[0-9]{5}$")
    ranking_facts: RankingFacts | None = None


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    baseline: CRSInputs
    scenario: CRSInputs | None = None
    as_of: date | None = Field(default=None, ge=date(2025, 3, 25))


def language_context(db, user):
    result = {}
    for selection in db.query(LanguageSelection).filter_by(user_id=user.id):
        record = db.query(LanguageAssessment).filter_by(id=selection.assessment_id, user_id=user.id, language=selection.language).first()
        if record:
            result[selection.language] = assessment_payload(record)
    return result


@router.post("")
def assess_inputs(payload: ScenarioRequest, db: Session = Depends(get_db), user=Depends(require_self_user)):
    evidence = language_context(db, user)
    as_of = payload.as_of or today()
    # Current evidence never becomes valid by selecting a historical/future scenario date.
    profile = db.query(Profile).filter_by(user_id=user.id).first()
    profile_context = {key: getattr(profile, key, None) for key in ("age", "education")} if profile else {}
    baseline = review_crs_inputs(payload.baseline.model_dump(), evidence, as_of=as_of, profile_context=profile_context)
    scenario = review_crs_inputs(payload.scenario.model_dump(), evidence, as_of=as_of, profile_context=profile_context) if payload.scenario else None
    return {"baseline": baseline, "scenario": scenario, "score_difference": None, "writes": False}
