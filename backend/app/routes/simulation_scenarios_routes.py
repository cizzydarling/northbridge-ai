from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.simulation_model import SavedSimulationScenario
from app.models.client_model import Client
from app.schemas.simulation_schema import SavedScenarioCreate, SavedScenarioResponse

router = APIRouter(prefix="/simulation-scenarios", tags=["Simulation Scenarios"])


@router.get("/{client_id}", response_model=list[SavedScenarioResponse])
def list_saved_scenarios(
    client_id: int,
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    scenarios = (
        db.query(SavedSimulationScenario)
        .filter(SavedSimulationScenario.client_id == client_id)
        .order_by(SavedSimulationScenario.created_at.desc())
        .all()
    )
    return scenarios


@router.post("/", response_model=SavedScenarioResponse)
def create_saved_scenario(
    payload: SavedScenarioCreate,
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    scenario = SavedSimulationScenario(
        client_id=payload.client_id,
        name=payload.name,
        notes=payload.notes,
        current_profile_snapshot=payload.current_profile_snapshot,
        simulated_changes=payload.simulated_changes,
        result_payload=payload.result_payload,
    )

    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}")
def delete_saved_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
):
    scenario = (
        db.query(SavedSimulationScenario)
        .filter(SavedSimulationScenario.id == scenario_id)
        .first()
    )

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    db.delete(scenario)
    db.commit()

    return {"message": "Scenario deleted successfully"}