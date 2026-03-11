from sqlalchemy.orm import Session
from app.models.profile_model import Profile

def create_profile(db: Session, user_id: int, profile_data: dict):

    profile = Profile(
        user_id=user_id,
        age=profile_data["age"],
        education_level=profile_data["education_level"],
        work_experience_years=profile_data["work_experience_years"],
        language_proficiency=profile_data["language_proficiency"],
        province_preference=profile_data.get("province_preference"),
        crs_score=profile_data.get("crs_score", 0)
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile