"""Inactive, admin-only evidence review. No approval/activation endpoint exists."""
from typing import Literal
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.routes.auth_routes import require_admin
from app.models.rule_monitor_model import RuleSourceChange, RuleReviewDecision
from app.rules.source_monitor import source_status
from app.rules.crs_versions import RULES, SOURCE, NOC_SOURCE

router = APIRouter(prefix="/admin/rules-review", tags=["Inactive rules review"])


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["UNDER_REVIEW", "MORE_EVIDENCE", "REJECTED", "WITHDRAWN"]
    note: str = Field(min_length=1, max_length=1000)


@router.get("")
def queue(db: Session = Depends(get_db), admin=Depends(require_admin)):
    changes = db.query(RuleSourceChange).order_by(RuleSourceChange.id.desc()).limit(100).all()
    rows = []
    for change in changes:
        decisions = db.query(RuleReviewDecision).filter_by(change_id=change.id).order_by(RuleReviewDecision.id).all()
        rows.append({"id": change.id, "source_id": change.source_id, "detected_at": change.detected_at,
            "effective_date": change.effective_date, "announcement_date": None,
            "classification": change.classification, "extraction_status": change.extraction_status,
            "before_excerpt": change.before_excerpt, "after_excerpt": change.after_excerpt,
            "modules": change.modules, "status": decisions[-1].decision if decisions else "DETECTED",
            "validation": "NOT_VALIDATED", "activation": "DISABLED",
            "history": [{"id": d.id, "reviewer_id": d.reviewer_id, "decision": d.decision,
                         "note": d.note, "created_at": d.created_at} for d in decisions]})
    return {"sources": source_status(db), "changes": rows, "activation_available": False,
            "ai_analysis": "DEFERRED_NO_PROVIDER_CALLS", "alert_delivery": "ADMIN_QUEUE_ONLY",
            "november_reference": {"sources": [SOURCE, NOC_SOURCE], "announcement_date": None,
                "effective_date": "2026-11-03", "old_version": RULES[0].version, "new_version": RULES[1].version,
                "status": "REVIEW_REQUIRED", "tests": ["date boundaries", "NOC list and qualifying work", "spouse caps and factor exclusivity", "FSW/FST distinctions", "independent full CRS fixtures"]}}


@router.post("/{change_id}/decisions", status_code=201)
def decide(change_id: int, body: Decision, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if not body.note.strip():
        raise HTTPException(422, "Review note required")
    if not db.get(RuleSourceChange, change_id):
        raise HTTPException(404, "Source change not found")
    decision = RuleReviewDecision(change_id=change_id, reviewer_id=admin.id, decision=body.decision, note=body.note)
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return {"id": decision.id, "decision": decision.decision, "activation": "DISABLED"}
