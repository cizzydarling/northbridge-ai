from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.household_model import Household
from app.models.household_member_model import HouseholdMember
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.household_schema import HouseholdCreate, HouseholdResponse
from app.schemas.household_member_schema import (
    HouseholdMemberCreate,
    HouseholdMemberResponse,
    HouseholdMemberUpdate,
)

router = APIRouter(prefix="/households", tags=["Households"])


def get_or_create_household(db: Session, current_user: User) -> Household:
    household = (
        db.query(Household)
        .filter(Household.owner_user_id == current_user.id)
        .first()
    )

    if household:
        return household

    household = Household(
        owner_user_id=current_user.id,
        name="My household",
    )
    db.add(household)
    db.commit()
    db.refresh(household)

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    primary_member = HouseholdMember(
        household_id=household.id,
        first_name=getattr(profile, "first_name", None) or getattr(current_user, "first_name", None),
        last_name=getattr(profile, "last_name", None) or getattr(current_user, "last_name", None),
        nationality=getattr(profile, "nationality", None),
        current_country=getattr(profile, "current_country", None),
        email=getattr(current_user, "email", None),
        relationship_to_primary="self",
        is_primary_applicant=True,
    )

    db.add(primary_member)
    db.commit()
    db.refresh(household)

    return household


@router.get("/me", response_model=HouseholdResponse)
def read_my_household(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_or_create_household(db, current_user)


@router.post("", response_model=HouseholdResponse)
def create_household(
    payload: HouseholdCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(Household)
        .filter(Household.owner_user_id == current_user.id)
        .first()
    )

    if existing:
        return existing

    household = Household(
        owner_user_id=current_user.id,
        name=payload.name or "My household",
    )

    db.add(household)
    db.commit()
    db.refresh(household)

    return household


@router.get("/members", response_model=list[HouseholdMemberResponse])
def list_household_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    household = get_or_create_household(db, current_user)

    return (
        db.query(HouseholdMember)
        .filter(HouseholdMember.household_id == household.id)
        .order_by(HouseholdMember.is_primary_applicant.desc(), HouseholdMember.id.asc())
        .all()
    )


@router.post("/members", response_model=HouseholdMemberResponse)
def add_household_member(
    payload: HouseholdMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    household = get_or_create_household(db, current_user)

    member = HouseholdMember(
        household_id=household.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        relationship_to_primary=payload.relationship_to_primary or "other",
        date_of_birth=payload.date_of_birth,
        nationality=payload.nationality,
        current_country=payload.current_country,
        email=payload.email,
        is_primary_applicant=payload.is_primary_applicant,
    )

    if member.is_primary_applicant:
        db.query(HouseholdMember).filter(
            HouseholdMember.household_id == household.id
        ).update({"is_primary_applicant": False})

    db.add(member)
    db.commit()
    db.refresh(member)

    return member


@router.put("/members/{member_id}", response_model=HouseholdMemberResponse)
def update_household_member(
    member_id: int,
    payload: HouseholdMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    household = get_or_create_household(db, current_user)

    member = (
        db.query(HouseholdMember)
        .filter(
            HouseholdMember.id == member_id,
            HouseholdMember.household_id == household.id,
        )
        .first()
    )

    if not member:
        raise HTTPException(status_code=404, detail="Household member not found.")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("is_primary_applicant") is True:
        db.query(HouseholdMember).filter(
            HouseholdMember.household_id == household.id,
            HouseholdMember.id != member.id,
        ).update({"is_primary_applicant": False})

    for key, value in update_data.items():
        setattr(member, key, value)

    db.commit()
    db.refresh(member)

    return member