from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.client_model import Client
from app.models.disclosure_acceptance_model import DisclosureAcceptance
from app.models.matter_model import Matter
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.disclosure_schema import (
    DisclosureAcceptanceCreate,
    DisclosureAcceptanceResponse,
)

router = APIRouter(prefix="/disclosures", tags=["Disclosures"])


DISCLOSURE_REGISTRY: Dict[str, Dict[str, str]] = {
    "terms_of_use": {"version": "v2", "text": "..."},
    "privacy_consent": {"version": "v2", "text": "..."},
    "ai_assistance_disclaimer": {"version": "v2", "text": "..."},
    "no_legal_advice_acknowledgment": {"version": "v2", "text": "..."},
    "user_responsibility_acknowledgment": {"version": "v2", "text": "..."},
    "limitation_of_scope_acknowledgment": {"version": "v2", "text": "..."},
}


# ------------------------
# HELPERS
# ------------------------

def determine_scope(client_id: Optional[int], matter_id: Optional[int]) -> str:
    if matter_id:
        return "matter"
    if client_id:
        return "client"
    return "global"


def get_request_metadata(request: Request):
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


def validate_disclosure_type_or_400(disclosure_type: str):
    disclosure = DISCLOSURE_REGISTRY.get(disclosure_type)
    if not disclosure:
        raise HTTPException(status_code=400, detail="Invalid disclosure type.")
    return disclosure


def get_owned_client_or_404(db: Session, client_id: int, current_user: User):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.owner_user_id == current_user.id
    ).first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    return client


def get_owned_matter_or_404(db: Session, matter_id: int, current_user: User):
    matter = db.query(Matter).filter(
        Matter.id == matter_id,
        Matter.owner_user_id == current_user.id
    ).first()

    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found.")

    return matter


def validate_scope_or_400(db, current_user, client_id, matter_id):
    client = None
    matter = None

    if client_id:
        client = get_owned_client_or_404(db, client_id, current_user)

    if matter_id:
        matter = get_owned_matter_or_404(db, matter_id, current_user)

    if matter and client and matter.client_id != client.id:
        raise HTTPException(
            status_code=400,
            detail="Matter does not belong to the provided client.",
        )


def get_latest_acceptance_record(
    db: Session,
    current_user: User,
    disclosure_type: str,
    client_id: Optional[int],
    matter_id: Optional[int],
):
    query = db.query(DisclosureAcceptance).filter(
        DisclosureAcceptance.user_id == current_user.id,
        DisclosureAcceptance.disclosure_type == disclosure_type,
    )

    if client_id is None:
        query = query.filter(DisclosureAcceptance.client_id.is_(None))
    else:
        query = query.filter(DisclosureAcceptance.client_id == client_id)

    if matter_id is None:
        query = query.filter(DisclosureAcceptance.matter_id.is_(None))
    else:
        query = query.filter(DisclosureAcceptance.matter_id == matter_id)

    return query.order_by(DisclosureAcceptance.accepted_at.desc()).first()


# ------------------------
# ROUTES
# ------------------------

@router.get("/requirements")
def get_disclosure_requirements():
    return {
        "required_disclosures": [
            {
                "disclosure_type": key,
                "disclosure_version": val["version"],
                "accepted_text_snapshot": val["text"],
            }
            for key, val in DISCLOSURE_REGISTRY.items()
        ]
    }


@router.post("/accept", response_model=DisclosureAcceptanceResponse)
def accept_disclosure(
    payload: DisclosureAcceptanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    disclosure = validate_disclosure_type_or_400(payload.disclosure_type)

    validate_scope_or_400(
        db, current_user, payload.client_id, payload.matter_id
    )

    required_version = disclosure["version"]

    if payload.disclosure_version != required_version:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid disclosure version. Required: {required_version}",
        )

    latest = get_latest_acceptance_record(
        db,
        current_user,
        payload.disclosure_type,
        payload.client_id,
        payload.matter_id,
    )

    if latest and latest.disclosure_version == required_version:
        return latest

    metadata = get_request_metadata(request)

    acceptance = DisclosureAcceptance(
        user_id=current_user.id,
        client_id=payload.client_id,
        matter_id=payload.matter_id,
        disclosure_type=payload.disclosure_type,
        disclosure_version=required_version,
        accepted_text_snapshot=payload.accepted_text_snapshot,
        accepted_by_email_snapshot=current_user.email,
        acceptance_scope=determine_scope(payload.client_id, payload.matter_id),
        ip_address=metadata["ip_address"],
        user_agent=metadata["user_agent"],
    )

    db.add(acceptance)
    db.commit()
    db.refresh(acceptance)

    return acceptance