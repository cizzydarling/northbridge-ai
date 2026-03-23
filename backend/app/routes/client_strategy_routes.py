from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.access_control import require_agent_plan
from app.data.db import get_db
from app.models.client_model import Client
from app.models.profile_model import Profile
from app.services.report_builder_service import build_strategy_report_html
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/client-strategy", tags=["Client Strategy"])


def get_owned_client_or_404(db: Session, client_id: int, current_user) -> Client:
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.owner_user_id == current_user.id,
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return client


def get_client_profile_or_404(db: Session, client_id: int) -> Profile:
    profile = db.query(Profile).filter(Profile.client_id == client_id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Client profile not found")

    return profile


@router.get("/{client_id}")
def get_client_strategy(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = get_owned_client_or_404(db, client_id, current_user)
    profile = get_client_profile_or_404(db, client.id)

    strategy = build_strategy(profile)

    return {
        "client_id": client.id,
        "client_name": client.full_name,
        **strategy,
    }


@router.get("/{client_id}/report")
def export_client_strategy_report(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = get_owned_client_or_404(db, client_id, current_user)
    profile = get_client_profile_or_404(db, client.id)

    strategy = build_strategy(profile)

    html = build_strategy_report_html(
        profile=profile,
        strategy_data=strategy,
        user_email=client.email or client.full_name,
    )

    safe_name = (client.full_name or "client").strip().replace(" ", "_").lower()

    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_strategy_report.html"'
        },
    )