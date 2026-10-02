from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.routes.self_document_routes import require_self_user
from app.models.household_member_model import HouseholdMember
from app.schemas.household_member_schema import HouseholdMemberCreate, HouseholdMemberUpdate, HouseholdMemberResponse
from app.services.household_service import initialize_household, invalidate_family_results, refresh_case_sizes

router = APIRouter(prefix="/households", tags=["Households"])

@router.get("/me")
@router.post("")
def household(db: Session = Depends(get_db), user=Depends(require_self_user)):
    item, _, _ = initialize_household(db, user)
    db.commit()
    return {"id": item.id, "owner_user_id": item.owner_user_id, "name": item.name}

@router.get("/members", response_model=list[HouseholdMemberResponse])
def members(db: Session = Depends(get_db), user=Depends(require_self_user)):
    item, _, _ = initialize_household(db, user)
    result = db.query(HouseholdMember).filter_by(household_id=item.id, archived_at=None).order_by(HouseholdMember.id).all()
    db.commit()
    return result


def check_partner(db, household_id, relationship, member_id=None):
    if relationship in {"spouse", "common_law_partner"}:
        query = db.query(HouseholdMember).filter(HouseholdMember.household_id == household_id,
            HouseholdMember.archived_at.is_(None), HouseholdMember.relationship_to_primary.in_(["spouse", "common_law_partner"]))
        if member_id is not None:
            query = query.filter(HouseholdMember.id != member_id)
        if query.first():
            raise HTTPException(409, "Only one active spouse or partner is supported. Edit or remove the existing record first.")

@router.post("/members", response_model=HouseholdMemberResponse)
def add_member(payload: HouseholdMemberCreate, db: Session = Depends(get_db), user=Depends(require_self_user)):
    household, _, _ = initialize_household(db, user)
    check_partner(db, household.id, payload.relationship_to_primary)
    member = HouseholdMember(household_id=household.id, **payload.model_dump())
    db.add(member)
    invalidate_family_results(db, user.id)
    db.commit()
    db.refresh(member)
    return member


def owned_member(db, user, member_id):
    household, _, _ = initialize_household(db, user)
    member = db.query(HouseholdMember).filter_by(id=member_id, household_id=household.id, archived_at=None).first()
    if not member:
        raise HTTPException(404, "Household member not found")
    if member.relationship_to_primary == "self":
        raise HTTPException(409, "SELF is protected. Update your individual profile instead.")
    return member

@router.put("/members/{member_id}", response_model=HouseholdMemberResponse)
def update_member(member_id: int, payload: HouseholdMemberUpdate, db: Session = Depends(get_db), user=Depends(require_self_user)):
    member = owned_member(db, user, member_id)
    values = payload.model_dump(exclude_unset=True)
    check_partner(db, member.household_id, values.get("relationship_to_primary", member.relationship_to_primary), member.id)
    for key, value in values.items():
        setattr(member, key, value)
    invalidate_family_results(db, user.id)
    db.commit()
    db.refresh(member)
    return member

@router.delete("/members/{member_id}")
def archive_member(member_id: int, db: Session = Depends(get_db), user=Depends(require_self_user)):
    member = owned_member(db, user, member_id)
    member.archived_at = datetime.now(timezone.utc)
    refresh_case_sizes(db, user.id)
    invalidate_family_results(db, user.id)
    db.commit()
    return {"archived": True}
