from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.application_case_model import ApplicationCase
from app.models.household_member_model import HouseholdMember
from app.models.household_model import Household
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.routes.household_routes import get_or_create_household
from app.schemas.application_case_schema import (
    ApplicationCaseCreate,
    ApplicationCaseResponse,
    ApplicationCaseUpdate,
)

router = APIRouter(prefix="/application-cases", tags=["Application Cases"])


def get_owned_case(
    db: Session,
    case_id: int,
    current_user: User,
) -> ApplicationCase:
    case = (
        db.query(ApplicationCase)
        .filter(
            ApplicationCase.id == case_id,
            ApplicationCase.owner_user_id == current_user.id,
        )
        .first()
    )

    if not case:
        raise HTTPException(status_code=404, detail="Application case not found.")

    return case


@router.get("", response_model=list[ApplicationCaseResponse])
def list_application_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    household = get_or_create_household(db, current_user)

    return (
        db.query(ApplicationCase)
        .filter(
            ApplicationCase.owner_user_id == current_user.id,
            ApplicationCase.household_id == household.id,
        )
        .order_by(ApplicationCase.updated_at.desc().nullslast(), ApplicationCase.id.desc())
        .all()
    )


@router.post("", response_model=ApplicationCaseResponse)
def create_application_case(
    payload: ApplicationCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    household = get_or_create_household(db, current_user)

    primary_member_id = payload.primary_applicant_member_id

    if primary_member_id:
        member = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.id == primary_member_id,
                HouseholdMember.household_id == household.id,
            )
            .first()
        )

        if not member:
            raise HTTPException(
                status_code=400,
                detail="Primary applicant must belong to your household.",
            )
    else:
        primary_member = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.household_id == household.id,
                HouseholdMember.is_primary_applicant == True,  # noqa: E712
            )
            .first()
        )
        primary_member_id = primary_member.id if primary_member else None

    case = ApplicationCase(
        household_id=household.id,
        owner_user_id=current_user.id,
        application_type=payload.application_type,
        case_title=payload.case_title,
        status=payload.status or "draft",
        primary_applicant_member_id=primary_member_id,
        target_country=payload.target_country or "Canada",
        target_province=payload.target_province,
        pathway=payload.pathway,
        family_size=payload.family_size or 1,
    )

    db.add(case)
    db.commit()
    db.refresh(case)

    return case


@router.get("/{case_id}", response_model=ApplicationCaseResponse)
def read_application_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_owned_case(db, case_id, current_user)


@router.put("/{case_id}", response_model=ApplicationCaseResponse)
def update_application_case(
    case_id: int,
    payload: ApplicationCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = get_owned_case(db, case_id, current_user)
    household = get_or_create_household(db, current_user)

    update_data = payload.model_dump(exclude_unset=True)

    primary_member_id = update_data.get("primary_applicant_member_id")
    if primary_member_id:
        member = (
            db.query(HouseholdMember)
            .filter(
                HouseholdMember.id == primary_member_id,
                HouseholdMember.household_id == household.id,
            )
            .first()
        )

        if not member:
            raise HTTPException(
                status_code=400,
                detail="Primary applicant must belong to your household.",
            )

    for key, value in update_data.items():
        setattr(case, key, value)

    db.commit()
    db.refresh(case)

    return case