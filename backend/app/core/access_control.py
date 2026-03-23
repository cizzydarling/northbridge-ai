from fastapi import Depends, HTTPException

from app.models.user_models import User
from app.routes.auth_routes import get_current_user


INDIVIDUAL_PRO_PLAN = "individual_pro"
AGENT_PRO_PLAN = "agent_pro"
ADMIN_ROLE = "admin"
AGENT_ROLE = "agent"


def is_admin(user: User) -> bool:
    return user.role == ADMIN_ROLE


def has_individual_pro(user: User) -> bool:
    return is_admin(user) or user.plan == INDIVIDUAL_PRO_PLAN


def has_agent_pro(user: User) -> bool:
    return is_admin(user) or (
        user.role in {AGENT_ROLE, ADMIN_ROLE} and user.plan == AGENT_PRO_PLAN
    )


def has_paid_plan(user: User) -> bool:
    return is_admin(user) or user.plan in {INDIVIDUAL_PRO_PLAN, AGENT_PRO_PLAN}


def require_individual_pro(current_user: User = Depends(get_current_user)) -> User:
    if not has_individual_pro(current_user):
        raise HTTPException(
            status_code=403,
            detail="Individual Pro plan required",
        )
    return current_user


def require_agent_plan(current_user: User = Depends(get_current_user)) -> User:
    if not has_agent_pro(current_user):
        raise HTTPException(
            status_code=403,
            detail="Agent Pro plan required",
        )
    return current_user


def require_paid_plan(current_user: User = Depends(get_current_user)) -> User:
    if not has_paid_plan(current_user):
        raise HTTPException(
            status_code=403,
            detail="Paid plan required",
        )
    return current_user


def require_simulation_access(current_user: User = Depends(get_current_user)) -> User:
    if not has_paid_plan(current_user):
        raise HTTPException(
            status_code=403,
            detail="Simulation feature requires a paid plan",
        )
    return current_user


def require_report_access(current_user: User = Depends(get_current_user)) -> User:
    if not has_paid_plan(current_user):
        raise HTTPException(
            status_code=403,
            detail="Report export requires a paid plan",
        )
    return current_user