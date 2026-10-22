from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.routes.self_document_routes import require_self_user
from app.models.profile_model import Profile
from app.rules.program_registry import reference_context

router = APIRouter(prefix="/program-registry", tags=["Program references"])


@router.get("")
def references(db: Session = Depends(get_db), user=Depends(require_self_user)):
    profile = db.query(Profile).filter_by(user_id=user.id).first()
    return reference_context(getattr(profile, "preferred_province", None))
