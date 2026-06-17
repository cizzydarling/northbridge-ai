from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import require_agent_plan
from app.data.db import get_db
from app.models.client_model import Client
from app.models.profile_model import Profile
from app.models.simulation_model import SavedSimulationScenario
from app.schemas.client_schema import ClientCreate, ClientResponse, ClientUpdate
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/clients", tags=["Client Workspace"])


def get_client_or_404(db: Session, client_id: int, current_user) -> Client:
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


@router.get("/", response_model=list[ClientResponse])
def list_clients(
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    return (
        db.query(Client)
        .filter(Client.owner_user_id == current_user.id)
        .order_by(Client.updated_at.desc(), Client.created_at.desc())
        .all()
    )


@router.post("/", response_model=ClientResponse)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = Client(
        owner_user_id=current_user.id,
        full_name=payload.full_name,
        email=payload.email,
        status=payload.status,
        notes=payload.notes,
    )

    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    return get_client_or_404(db, client_id, current_user)


@router.get("/{client_id}/overview")
def get_client_overview(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = get_client_or_404(db, client_id, current_user)

    profile = db.query(Profile).filter(Profile.client_id == client.id).first()

    saved_scenarios = (
        db.query(SavedSimulationScenario)
        .filter(SavedSimulationScenario.client_id == client.id)
        .order_by(SavedSimulationScenario.created_at.desc())
        .all()
    )

    latest_scenario = saved_scenarios[0] if saved_scenarios else None

    profile_completion_fields = [
        bool(profile.age) if profile else False,
        bool(profile.education) if profile else False,
        bool(
            (
                getattr(profile, "english_language_score", None) is not None
                or getattr(profile, "french_language_score", None) is not None
                or profile.language_score is not None
            )
        )
        if profile
        else False,
        bool(profile.experience_years is not None) if profile else False,
        bool(profile.occupation) if profile else False,
        bool(profile.preferred_province) if profile else False,
    ]

    profile_completion = (
        round((sum(profile_completion_fields) / len(profile_completion_fields)) * 100)
        if profile
        else 0
    )

    strategy = build_strategy(profile) if profile else None

    latest_simulation_summary = None
    if latest_scenario:
        result_payload = latest_scenario.result_payload or {}

        latest_simulation_summary = {
            "id": latest_scenario.id,
            "name": latest_scenario.name,
            "notes": latest_scenario.notes,
            "current_profile_snapshot": latest_scenario.current_profile_snapshot,
            "simulated_changes": latest_scenario.simulated_changes,
            "result_payload": result_payload,
            "created_at": latest_scenario.created_at,
        }

    return {
        "client": {
            "id": client.id,
            "full_name": client.full_name,
            "email": client.email,
            "status": client.status,
            "notes": client.notes,
            "created_at": client.created_at,
            "updated_at": client.updated_at,
        },
        "profile_exists": profile is not None,
        "profile_completion": profile_completion,
        "profile_snapshot": (
            {
                "id": profile.id,
                "user_id": profile.user_id,
                "client_id": profile.client_id,
                "age": profile.age,
                "education": profile.education,
                "language_score": profile.language_score,
                "english_language_score": getattr(profile, "english_language_score", None),
                "french_language_score": getattr(profile, "french_language_score", None),
                "experience_years": profile.experience_years,
                "has_job_offer": profile.has_job_offer,
                "has_canadian_experience": profile.has_canadian_experience,
                "studied_in_canada": profile.studied_in_canada,
                "occupation": profile.occupation,
                "noc_code": profile.noc_code,
                "preferred_province": profile.preferred_province,
            }
            if profile
            else None
        ),
        "strategy_summary": (
            {
                "crs_score": strategy.get("crs_score"),
                "top_program": (
                    strategy.get("recommended_programs", [None])[0]
                    if strategy.get("recommended_programs")
                    else None
                ),
                "top_province": (
                    strategy.get("province_recommendations", [{}])[0].get("province")
                    if strategy.get("province_recommendations")
                    else None
                ),
                "advisor_summary": strategy.get("advisor_summary"),
            }
            if strategy
            else None
        ),
        "latest_simulation": latest_simulation_summary,
        "saved_scenarios_count": len(saved_scenarios),
    }


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = get_client_or_404(db, client_id, current_user)

    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    client = get_client_or_404(db, client_id, current_user)

    db.delete(client)
    db.commit()

    return {"message": "Client deleted successfully"}
