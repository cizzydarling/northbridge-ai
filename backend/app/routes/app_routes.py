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


def is_profile_complete(profile: Profile | None) -> bool:
    if profile is None:
        return False

    required_fields = (
        "first_name",
        "last_name",
        "nationality",
        "current_country",
        "current_city",
        "marital_status",
        "preferred_language",
        "age",
        "education",
        "experience_years",
        "occupation",
        "noc_code",
        "preferred_province",
    )
    fields_complete = all(
        getattr(profile, field, None) not in (None, "") for field in required_fields
    )
    has_language_score = any(
        getattr(profile, field, None) not in (None, "")
        for field in ("english_language_score", "french_language_score")
    )
    return fields_complete and has_language_score


@router.get("/bootstrap")
def get_app_bootstrap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_agent = has_agent_plan(current_user)
    profile = None
    if not is_agent:
        profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    profile_exists = is_agent or profile is not None
    profile_complete = is_agent or is_profile_complete(profile)

    missing_disclosures = get_missing_required_disclosures(db, current_user)

    return {
        "user": serialize_user(current_user),
        "profile_exists": profile_exists,
        "profile_complete": profile_complete,
        "disclosures": {
            "required": required_disclosure_items(),
            "accepted": not missing_disclosures,
            "missing_disclosures": missing_disclosures,
        },
        "access": build_access_response(user=current_user),
    }
