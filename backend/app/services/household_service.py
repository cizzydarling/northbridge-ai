"""Owned application context. PostgreSQL owner-row locking serializes initialization/mutations.

No immigration eligibility is inferred from family identity or participation.
"""
from datetime import date
from types import SimpleNamespace
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.user_models import User
from app.models.profile_model import Profile
from app.models.household_model import Household
from app.models.household_member_model import HouseholdMember
from app.models.application_case_model import ApplicationCase, ApplicationCaseMember
from app.models.self_application_model import SelfApplication


def lock_owner(db, user):
    if user.role == "agent" or user.plan == "agent_pro":
        raise HTTPException(403, "Individual accounts only")
    db.query(User).filter(User.id == user.id).with_for_update().one()


def initialize_household(db: Session, user):
    lock_owner(db, user)
    household = db.query(Household).filter_by(owner_user_id=user.id).first()
    if not household:
        household = Household(owner_user_id=user.id, name="My household")
        db.add(household)
        db.flush()
    profile = db.query(Profile).filter_by(user_id=user.id).first()
    member = db.query(HouseholdMember).filter_by(household_id=household.id, relationship_to_primary="self").first()
    if not member:
        member = HouseholdMember(household_id=household.id, owner_user_id=user.id,
                                 relationship_to_primary="self", is_primary_applicant=True)
        db.add(member)
    # Profile is canonical; never infer missing identity fields.
    for field in ("first_name", "last_name", "nationality", "current_country"):
        value = getattr(profile, field, None)
        # Legacy profile strings are unbounded. Keep invalid values in Profile for correction.
        setattr(member, field, value if isinstance(value, str) and len(value) <= 100 else None)
    member.email = user.email if len(user.email) <= 254 else None
    try:
        member.date_of_birth = date.fromisoformat(profile.date_of_birth) if profile and profile.date_of_birth else None
    except (ValueError, TypeError):
        member.date_of_birth = None
    if member.date_of_birth and member.date_of_birth > date.today():
        member.date_of_birth = None
    db.flush()
    return household, member, profile


def owned_case(db, user, case_id, include_archived=False):
    if not isinstance(case_id, int) or case_id <= 0:
        raise HTTPException(422, "Invalid application case ID")
    query = db.query(ApplicationCase).filter_by(id=case_id, owner_user_id=user.id)
    if not include_archived:
        query = query.filter(ApplicationCase.status != "archived")
    case = query.populate_existing().first()
    if not case:
        raise HTTPException(404, "Application case not found")
    return case


def set_active_case(db, user, case):
    db.query(ApplicationCase).filter_by(owner_user_id=user.id, is_active=True).update({"is_active": False})
    db.flush()
    case.is_active = True
    db.flush()


def resolve_application_context(db, user, case_id=None, *, commit=True):
    household, self_member, profile = initialize_household(db, user)
    if case_id is not None:
        case = owned_case(db, user, case_id)
    else:
        case = db.query(ApplicationCase).filter_by(owner_user_id=user.id).filter(ApplicationCase.status != "archived").order_by(ApplicationCase.is_active.desc(), ApplicationCase.id).first()
        if not case:
            legacy = db.query(SelfApplication).filter_by(user_id=user.id, application_case_id=None).order_by(SelfApplication.updated_at.desc(), SelfApplication.id.desc()).first()
            supported = {"permanent_residence", "study_permit", "work_permit", "visitor_visa", "spousal_sponsorship"}
            kind = legacy.matter_type if legacy and legacy.matter_type in supported else "permanent_residence"
            case = ApplicationCase(household_id=household.id, owner_user_id=user.id,
                primary_applicant_member_id=self_member.id, application_type=kind,
                case_title=None, is_active=False)
            db.add(case)
            db.flush()
            # Preserve all historical rows; adopt them once into the initial case.
            db.query(SelfApplication).filter_by(user_id=user.id, application_case_id=None).update({"application_case_id": case.id})
        if not case.is_active:
            set_active_case(db, user, case)
    rows = db.query(HouseholdMember, ApplicationCaseMember.participation).join(
        ApplicationCaseMember, ApplicationCaseMember.household_member_id == HouseholdMember.id).filter(
        ApplicationCaseMember.application_case_id == case.id,
        HouseholdMember.household_id == household.id, HouseholdMember.relationship_to_primary != "self", HouseholdMember.archived_at.is_(None)).order_by(HouseholdMember.id).all()
    members = [SimpleNamespace(**{c.name: getattr(m, c.name) for c in m.__table__.columns}, participation=status) for m, status in rows]
    members.insert(0, SimpleNamespace(**{c.name: getattr(self_member, c.name) for c in self_member.__table__.columns}, participation="not_applicable"))
    case.family_size = len(members)
    application = db.query(SelfApplication).filter_by(user_id=user.id, application_case_id=case.id).order_by(SelfApplication.updated_at.desc(), SelfApplication.id.desc()).first()
    if commit:
        db.commit()
    return SimpleNamespace(owner=user, profile=profile, household=household, case=case, members=members, application=application)


def get_household_members(db, user_id):
    user = db.query(User).filter_by(id=user_id).one()
    return resolve_application_context(db, user).members


def context_snapshot(context):
    """Minimal family facts: deliberately no names, emails, birth dates or nationality."""
    members = [{"member_id": m.id, "relationship": m.relationship_to_primary,
                "participation": m.participation,
                "dependency_eligibility": "not_applicable" if m.relationship_to_primary == "self" else "unknown"}
               for m in context.members]
    return {"case_id": context.case.id, "application_type": context.case.application_type,
            "family_size": len(members), "members": members,
            "family_calculation_status": "REQUIRES RULE VERIFICATION" if len(members) > 1 else "not_applicable",
            "instruction": "Use only these known facts. Unknown is not false. Do not infer dependency eligibility or missing family facts."}


def replace_participation(db, context, values):
    ids = [v.household_member_id for v in values]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Duplicate case member")
    valid = db.query(HouseholdMember).filter(HouseholdMember.household_id == context.household.id,
        HouseholdMember.archived_at.is_(None), HouseholdMember.relationship_to_primary != "self", HouseholdMember.id.in_(ids)).all()
    if len(valid) != len(ids):
        raise HTTPException(404, "Household member not found")
    db.query(ApplicationCaseMember).filter_by(application_case_id=context.case.id).delete()
    db.flush()
    for value in values:
        db.add(ApplicationCaseMember(application_case_id=context.case.id, household_member_id=value.household_member_id,
            household_id=context.household.id, participation=value.participation))
    context.case.family_size = 1 + len(values)


def invalidate_family_results(db, user_id, case_id=None):
    """Keep user-entered intake; retire derived output after family/context edits."""
    query = db.query(SelfApplication).filter_by(user_id=user_id)
    if case_id is not None:
        query = query.filter_by(application_case_id=case_id)
    query.update({"eligibility_result": {}, "forms_result": {}, "checklist_result": []}, synchronize_session="fetch")


def refresh_case_sizes(db, user_id):
    db.flush()
    for case in db.query(ApplicationCase).filter_by(owner_user_id=user_id).all():
        case.family_size = 1 + db.query(ApplicationCaseMember).join(HouseholdMember,
            HouseholdMember.id == ApplicationCaseMember.household_member_id).filter(
            ApplicationCaseMember.application_case_id == case.id,
            HouseholdMember.archived_at.is_(None), HouseholdMember.relationship_to_primary != "self").count()


def contextual_intake(context, intake=None):
    """Override only family facts whose authority is the selected case."""
    result = dict(intake or {})
    family = [m for m in context.members if m.relationship_to_primary != "self"]
    states = {m.participation for m in family}
    result["family_context"] = context_snapshot(context)
    result["accompanying_family"] = True if "accompanying" in states else None if "unknown" in states else False
    # A child record is not a verified immigration dependent.
    result["dependent_children"] = None if any(m.relationship_to_primary == "child" for m in family) else False
    return result
