from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.models.user_models import User
from app.models.language_assessment_model import LanguageAssessment, LanguageSelection
from app.routes.household_routes import require_self_user
from app.services.language_assessment_service import EXAMS, VERSION, convert, assessment_payload, today

router = APIRouter(prefix="/language-assessments", tags=["Language evidence"])


class AssessmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: Literal["en", "fr"]
    exam: str = Field(max_length=40)
    edition: str = Field(max_length=80)
    test_date: date
    raw_scores: dict

    @model_validator(mode="after")
    def valid(self):
        convert(self.exam, self.edition, self.raw_scores)
        if EXAMS[self.exam][0] != self.language:
            raise ValueError("Exam language does not match")
        if self.test_date > today() or self.test_date.year < 1990:
            raise ValueError("Invalid test date")
        return self


class SelectionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assessment_id: int | None = Field(default=None, strict=True, gt=0)


@router.get("/catalog")
def catalog():
    return {"version": VERSION, "exams": [{"exam": key, "language": v[0], "edition": v[1]} for key, v in EXAMS.items()]}


@router.get("")
def list_assessments(db: Session = Depends(get_db), user=Depends(require_self_user)):
    records = db.query(LanguageAssessment).filter_by(user_id=user.id).order_by(LanguageAssessment.id.desc()).all()
    selected = {r.language: r.assessment_id for r in db.query(LanguageSelection).filter_by(user_id=user.id)}
    return {"assessments": [assessment_payload(r) for r in records], "selected": selected,
            "unknown": [lang for lang in ("en", "fr") if not selected.get(lang)]}


@router.post("", status_code=201)
def create_assessment(payload: AssessmentInput, db: Session = Depends(get_db), user=Depends(require_self_user)):
    values = payload.model_dump()
    # Decimal strings are lossless and JSON-safe. No Profile fields are written.
    values["raw_scores"] = {k: str(v) for k, v in payload.raw_scores.items()}
    record = LanguageAssessment(user_id=user.id, mapping_version=VERSION, provenance="user_reported", **values)
    db.add(record)
    db.commit()
    db.refresh(record)
    return assessment_payload(record)


@router.put("/current/{language}")
def select_assessment(language: Literal["en", "fr"], payload: SelectionInput, db: Session = Depends(get_db), user=Depends(require_self_user)):
    db.query(User).filter_by(id=user.id).with_for_update().one()
    if payload.assessment_id is not None:
        record = db.query(LanguageAssessment).filter_by(id=payload.assessment_id, user_id=user.id, language=language).first()
        if not record:
            raise HTTPException(404, "Assessment not found")
        if not assessment_payload(record)["usable"]:
            raise HTTPException(409, "Assessment is expired or outside the published mapping range")
    selection = db.get(LanguageSelection, (user.id, language))
    if selection is None:
        selection = LanguageSelection(user_id=user.id, language=language)
        db.add(selection)
    selection.assessment_id = payload.assessment_id
    db.commit()
    return {"language": language, "assessment_id": selection.assessment_id, "status": "unknown" if selection.assessment_id is None else "selected"}
