from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.simulation_model import SavedSimulationScenario
from app.schemas.simulation_schema import (
    SavedSimulationScenarioCreate,
    SavedSimulationScenarioResponse,
    SavedSimulationScenarioUpdate,
    SimulationCompareRequest,
    SimulationCompareResponse,
)

router = APIRouter(prefix="/clients", tags=["Client Simulations"])


def build_comparison_payload(
    first: SavedSimulationScenario,
    second: SavedSimulationScenario,
) -> Dict[str, Any]:
    first_result = first.result_payload or {}
    second_result = second.result_payload or {}

    first_crs_data = first_result.get("crs_comparison") or {}
    second_crs_data = second_result.get("crs_comparison") or {}

    first_score = first_crs_data.get("simulated_crs_score")
    second_score = second_crs_data.get("simulated_crs_score")

    first_pathways = set(
        (first_result.get("pathway_comparison") or {}).get(
            "simulated_eligible_pathways", []
        )
    )
    second_pathways = set(
        (second_result.get("pathway_comparison") or {}).get(
            "simulated_eligible_pathways", []
        )
    )

    return {
        "crs": {
            "first_score": first_score,
            "second_score": second_score,
            "difference": (
                second_score - first_score
                if isinstance(first_score, int) and isinstance(second_score, int)
                else None
            ),
        },
        "pathways": {
            "first_only": sorted(list(first_pathways - second_pathways)),
            "second_only": sorted(list(second_pathways - first_pathways)),
            "shared": sorted(list(first_pathways & second_pathways)),
        },
        "simulated_changes": {
            "first": first.simulated_changes or {},
            "second": second.simulated_changes or {},
        },
    }


@router.get(
    "/{client_id}/simulations",
    response_model=List[SavedSimulationScenarioResponse],
)
def list_client_simulations(
    client_id: int,
    db: Session = Depends(get_db),
):
    simulations = (
        db.query(SavedSimulationScenario)
        .filter(SavedSimulationScenario.client_id == client_id)
        .order_by(SavedSimulationScenario.created_at.desc())
        .all()
    )
    return simulations


@router.get(
    "/{client_id}/simulations/{simulation_id}",
    response_model=SavedSimulationScenarioResponse,
)
def get_client_simulation(
    client_id: int,
    simulation_id: int,
    db: Session = Depends(get_db),
):
    simulation = (
        db.query(SavedSimulationScenario)
        .filter(
            SavedSimulationScenario.id == simulation_id,
            SavedSimulationScenario.client_id == client_id,
        )
        .first()
    )

    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found.")

    return simulation


@router.post(
    "/{client_id}/simulations",
    response_model=SavedSimulationScenarioResponse,
)
def create_client_simulation(
    client_id: int,
    payload: SavedSimulationScenarioCreate,
    db: Session = Depends(get_db),
):
    if payload.client_id != client_id:
        raise HTTPException(
            status_code=400,
            detail="Client ID in URL does not match client_id in payload.",
        )

    simulation = SavedSimulationScenario(
        client_id=payload.client_id,
        name=payload.name,
        notes=payload.notes,
        current_profile_snapshot=payload.current_profile_snapshot,
        simulated_changes=payload.simulated_changes,
        result_payload=payload.result_payload,
    )

    db.add(simulation)
    db.commit()
    db.refresh(simulation)
    return simulation


@router.put(
    "/{client_id}/simulations/{simulation_id}",
    response_model=SavedSimulationScenarioResponse,
)
def update_client_simulation(
    client_id: int,
    simulation_id: int,
    payload: SavedSimulationScenarioUpdate,
    db: Session = Depends(get_db),
):
    simulation = (
        db.query(SavedSimulationScenario)
        .filter(
            SavedSimulationScenario.id == simulation_id,
            SavedSimulationScenario.client_id == client_id,
        )
        .first()
    )

    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found.")

    if payload.name is not None:
        simulation.name = payload.name

    if payload.notes is not None:
        simulation.notes = payload.notes

    db.commit()
    db.refresh(simulation)
    return simulation


@router.delete("/{client_id}/simulations/{simulation_id}")
def delete_client_simulation(
    client_id: int,
    simulation_id: int,
    db: Session = Depends(get_db),
):
    simulation = (
        db.query(SavedSimulationScenario)
        .filter(
            SavedSimulationScenario.id == simulation_id,
            SavedSimulationScenario.client_id == client_id,
        )
        .first()
    )

    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found.")

    db.delete(simulation)
    db.commit()
    return {"message": "Simulation deleted successfully."}


@router.post(
    "/{client_id}/simulations/compare",
    response_model=SimulationCompareResponse,
)
def compare_client_simulations(
    client_id: int,
    payload: SimulationCompareRequest,
    db: Session = Depends(get_db),
):
    first = (
        db.query(SavedSimulationScenario)
        .filter(
            SavedSimulationScenario.id == payload.first_simulation_id,
            SavedSimulationScenario.client_id == client_id,
        )
        .first()
    )

    second = (
        db.query(SavedSimulationScenario)
        .filter(
            SavedSimulationScenario.id == payload.second_simulation_id,
            SavedSimulationScenario.client_id == client_id,
        )
        .first()
    )

    if not first or not second:
        raise HTTPException(
            status_code=404,
            detail="One or both simulations were not found.",
        )

    comparison = build_comparison_payload(first, second)

    return {
        "first_simulation": first,
        "second_simulation": second,
        "comparison": comparison,
    }