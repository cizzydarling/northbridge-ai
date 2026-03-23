from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import require_agent_plan
from app.data.db import get_db
from app.models.client_model import Client
from app.models.matter_model import Matter
from app.schemas.matter_schema import MatterCreate, MatterResponse, MatterUpdate

router = APIRouter(prefix="/clients", tags=["Client Matters"])


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
        raise HTTPException(status_code=404, detail="Client not found.")

    return client


def get_owned_matter_or_404(
    db: Session,
    client_id: int,
    matter_id: int,
    current_user,
) -> Matter:
    get_owned_client_or_404(db, client_id, current_user)

    matter = (
        db.query(Matter)
        .filter(
            Matter.id == matter_id,
            Matter.client_id == client_id,
            Matter.owner_user_id == current_user.id,
        )
        .first()
    )

    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found.")

    return matter


@router.get("/{client_id}/matters", response_model=List[MatterResponse])
def list_client_matters(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)

    return (
        db.query(Matter)
        .filter(
            Matter.client_id == client_id,
            Matter.owner_user_id == current_user.id,
        )
        .order_by(Matter.created_at.desc())
        .all()
    )


@router.get("/{client_id}/matters/{matter_id}", response_model=MatterResponse)
def get_client_matter(
    client_id: int,
    matter_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    return get_owned_matter_or_404(db, client_id, matter_id, current_user)


@router.post("/{client_id}/matters", response_model=MatterResponse)
def create_client_matter(
    client_id: int,
    payload: MatterCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = get_owned_client_or_404(db, client_id, current_user)

    matter = Matter(
        client_id=client.id,
        owner_user_id=current_user.id,
        matter_type=payload.matter_type,
        title=payload.title,
        status=payload.status,
        target_program=payload.target_program,
        country_of_residence=payload.country_of_residence,
        inside_canada=payload.inside_canada,
        notes=payload.notes,
        intake_payload=payload.intake_payload,
        eligibility_result=payload.eligibility_result,
    )

    db.add(matter)
    db.commit()
    db.refresh(matter)
    return matter


@router.put("/{client_id}/matters/{matter_id}", response_model=MatterResponse)
def update_client_matter(
    client_id: int,
    matter_id: int,
    payload: MatterUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    matter = get_owned_matter_or_404(db, client_id, matter_id, current_user)

    if payload.matter_type is not None:
        matter.matter_type = payload.matter_type

    if payload.title is not None:
        matter.title = payload.title

    if payload.status is not None:
        matter.status = payload.status

    if payload.target_program is not None:
        matter.target_program = payload.target_program

    if payload.country_of_residence is not None:
        matter.country_of_residence = payload.country_of_residence

    if payload.inside_canada is not None:
        matter.inside_canada = payload.inside_canada

    if payload.notes is not None:
        matter.notes = payload.notes

    if payload.intake_payload is not None:
        matter.intake_payload = payload.intake_payload

    if payload.eligibility_result is not None:
        matter.eligibility_result = payload.eligibility_result

    db.commit()
    db.refresh(matter)
    return matter


@router.delete("/{client_id}/matters/{matter_id}")
def delete_client_matter(
    client_id: int,
    matter_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    matter = get_owned_matter_or_404(db, client_id, matter_id, current_user)

    db.delete(matter)
    db.commit()

    return {"message": "Matter deleted successfully."}