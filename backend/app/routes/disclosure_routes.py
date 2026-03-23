from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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


def get_owned_client_or_404(db: Session, client_id: int, current_user: User) -> Client:
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.owner_user_id == current_user.id,
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    return client


def get_owned_matter_or_404(db: Session, matter_id: int, current_user: User) -> Matter:
    matter = (
        db.query(Matter)
        .filter(
            Matter.id == matter_id,
            Matter.owner_user_id == current_user.id,
        )
        .first()
    )

    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found.")

    return matter


@router.post("/accept", response_model=DisclosureAcceptanceResponse)
def accept_disclosure(
    payload: DisclosureAcceptanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.client_id is not None:
        get_owned_client_or_404(db, payload.client_id, current_user)

    if payload.matter_id is not None:
        matter = get_owned_matter_or_404(db, payload.matter_id, current_user)

        if payload.client_id is not None and matter.client_id != payload.client_id:
            raise HTTPException(
                status_code=400,
                detail="Matter does not belong to the provided client.",
            )

    acceptance = DisclosureAcceptance(
        user_id=current_user.id,
        client_id=payload.client_id,
        matter_id=payload.matter_id,
        disclosure_type=payload.disclosure_type,
        disclosure_version=payload.disclosure_version,
        accepted_text_snapshot=payload.accepted_text_snapshot,
    )

    db.add(acceptance)
    db.commit()
    db.refresh(acceptance)

    return acceptance


@router.get("/mine", response_model=List[DisclosureAcceptanceResponse])
def list_my_disclosures(
    disclosure_type: Optional[str] = Query(default=None),
    client_id: Optional[int] = Query(default=None),
    matter_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if client_id is not None:
        get_owned_client_or_404(db, client_id, current_user)

    if matter_id is not None:
        get_owned_matter_or_404(db, matter_id, current_user)

    query = db.query(DisclosureAcceptance).filter(
        DisclosureAcceptance.user_id == current_user.id
    )

    if disclosure_type is not None:
        query = query.filter(DisclosureAcceptance.disclosure_type == disclosure_type)

    if client_id is not None:
        query = query.filter(DisclosureAcceptance.client_id == client_id)

    if matter_id is not None:
        query = query.filter(DisclosureAcceptance.matter_id == matter_id)

    return query.order_by(DisclosureAcceptance.accepted_at.desc()).all()


@router.get("/latest", response_model=Optional[DisclosureAcceptanceResponse])
def get_latest_disclosure_acceptance(
    disclosure_type: str,
    client_id: Optional[int] = Query(default=None),
    matter_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if client_id is not None:
        get_owned_client_or_404(db, client_id, current_user)

    if matter_id is not None:
        get_owned_matter_or_404(db, matter_id, current_user)

    query = db.query(DisclosureAcceptance).filter(
        DisclosureAcceptance.user_id == current_user.id,
        DisclosureAcceptance.disclosure_type == disclosure_type,
    )

    if client_id is not None:
        query = query.filter(DisclosureAcceptance.client_id == client_id)

    if matter_id is not None:
        query = query.filter(DisclosureAcceptance.matter_id == matter_id)

    return query.order_by(DisclosureAcceptance.accepted_at.desc()).first()