from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.routes.self_document_routes import require_self_user
from app.models.profile_model import Profile
from app.rules.program_registry import reference_context, catalog

router = APIRouter(prefix="/program-registry", tags=["Program references"])


@router.get("")
def references(browse: bool = False, query: str = Query("", max_length=100), jurisdiction: str | None = Query(None,max_length=80), db: Session = Depends(get_db), user=Depends(require_self_user)):
    # Additive source-reviewed information only; no profile answers or score are
    # passed to the catalogue, and it cannot produce an eligibility verdict.
    if browse:
        return {**catalog(query, jurisdiction), "criteria_mode": "source_references_only"}
    profile = db.query(Profile).filter_by(user_id=user.id).first()
    return reference_context(getattr(profile, "preferred_province", None))
