from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.access_control import build_access_response, has_agent_plan
from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user, serialize_user
from app.routes.disclosure_routes import (
    get_missing_required_disclosures,
    required_disclosure_items,
)

router = APIRouter(prefix="/app", tags=["App"])


@router.get("/bootstrap")
def get_app_bootstrap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile_exists = has_agent_plan(current_user) or db.query(Profile.id).filter(
        Profile.user_id == current_user.id
    ).first() is not None

    missing_disclosures = get_missing_required_disclosures(db, current_user)

    return {
        "user": serialize_user(current_user),
        "profile_exists": profile_exists,
        "disclosures": {
            "required": required_disclosure_items(),
            "accepted": not missing_disclosures,
            "missing_disclosures": missing_disclosures,
        },
        "access": build_access_response(user=current_user),
    }
