from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.access_control import require_simulation_access
from app.data.db import get_db
from app.models.client_model import Client
from app.models.profile_model import Profile
from app.models.simulation_model import SavedSimulationScenario
from app.schemas.simulation_schema import (
    SavedScenarioCreate,
    SavedScenarioResponse,
    SavedScenarioUpdate,
    SimulationCompareRequest,
    SimulationCompareResponse,
)
from app.services.simulation_comparison_report_service import (
    build_simulation_comparison_report_pdf,
)
from app.services.simulation_report_service import build_simulation_report_pdf

router = APIRouter(tags=["Client Simulations"])


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
        raise HTTPException(status_code=404, detail="Client profile not found.")

    return profile


def get_owned_simulation_or_404(
    db: Session,
    client_id: int,
    simulation_id: int,
    current_user,
) -> SavedSimulationScenario:
    get_owned_client_or_404(db, client_id, current_user)

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


def build_client_simulation_result(
    base_profile: Dict[str, Any],
    simulated_changes: Dict[str, Any],
) -> Dict[str, Any]:
    current_language = int(base_profile.get("language_score", 0) or 0)
    current_experience = int(base_profile.get("experience_years", 0) or 0)
    current_job_offer = bool(base_profile.get("has_job_offer", False))
    current_canadian_exp = bool(base_profile.get("has_canadian_experience", False))
    current_study_canada = bool(base_profile.get("studied_in_canada", False))

    new_language = int(simulated_changes.get("language_score", current_language) or 0)
    new_experience = int(
        simulated_changes.get("experience_years", current_experience) or 0
    )
    new_job_offer = bool(simulated_changes.get("has_job_offer", current_job_offer))
    new_canadian_exp = bool(
        simulated_changes.get("has_canadian_experience", current_canadian_exp)
    )
    new_study_canada = bool(
        simulated_changes.get("studied_in_canada", current_study_canada)
    )

    def calculate_crs(language, experience, job_offer, canadian_exp, study_canada):
        score = 0
        score += language * 20
        score += experience * 15
        score += 50 if job_offer else 0
        score += 40 if canadian_exp else 0
        score += 30 if study_canada else 0
        return score

    current_crs = calculate_crs(
        current_language,
        current_experience,
        current_job_offer,
        current_canadian_exp,
        current_study_canada,
    )

    simulated_crs = calculate_crs(
        new_language,
        new_experience,
        new_job_offer,
        new_canadian_exp,
        new_study_canada,
    )

    current_pathways = []
    simulated_pathways = []

    if current_crs >= 470:
        current_pathways.append("Express Entry")
    if current_canadian_exp:
        current_pathways.append("Canadian Experience Class")
    if current_job_offer:
        current_pathways.append("Provincial Nominee Program")
    if current_study_canada:
        current_pathways.append("Graduate Pathway")

    if simulated_crs >= 470:
        simulated_pathways.append("Express Entry")
    if new_canadian_exp:
        simulated_pathways.append("Canadian Experience Class")
    if new_job_offer:
        simulated_pathways.append("Provincial Nominee Program")
    if new_study_canada:
        simulated_pathways.append("Graduate Pathway")

    newly_unlocked = [p for p in simulated_pathways if p not in current_pathways]

    strengths = []
    weaknesses = []
    next_steps = []

    if new_language >= 9:
        strengths.append("High language score improves competitiveness.")
    if new_experience >= 3:
        strengths.append("Solid work experience supports multiple pathways.")
    if new_job_offer:
        strengths.append("A job offer can improve eligibility and CRS score.")
    if new_canadian_exp:
        strengths.append("Canadian work experience strengthens the profile.")

    if new_language < 9:
        weaknesses.append("Language score still has room for improvement.")
        next_steps.append("Consider improving language test results.")
    if not new_job_offer:
        weaknesses.append("No job offer currently limits some pathway options.")
        next_steps.append("Explore employer-supported opportunities.")
    if not new_canadian_exp:
        weaknesses.append("No Canadian experience reduces eligibility strength.")
        next_steps.append("Consider options that build Canadian experience.")
    if not new_study_canada:
        next_steps.append("Canadian study may unlock additional pathways.")

    if simulated_crs >= 470:
        next_steps.append("Profile appears competitive for Express Entry.")
    else:
        next_steps.append("Focus on factors that increase CRS score further.")

    return {
        "current_profile": base_profile,
        "simulated_changes": simulated_changes,
        "crs_comparison": {
            "current_crs_score": current_crs,
            "simulated_crs_score": simulated_crs,
            "difference": simulated_crs - current_crs,
        },
        "pathway_comparison": {
            "current_eligible_pathways": current_pathways,
            "simulated_eligible_pathways": simulated_pathways,
            "newly_unlocked_pathways": newly_unlocked,
        },
        "simulated_result": {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "next_steps": next_steps,
        },
    }


@router.post("/client-simulations/{client_id}/run")
def run_client_simulation(
    client_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    client = get_owned_client_or_404(db, client_id, current_user)
    profile = get_client_profile_or_404(db, client.id)

    base_profile = {
        "age": profile.age,
        "education": profile.education,
        "language_score": profile.language_score,
        "experience_years": profile.experience_years,
        "has_job_offer": profile.has_job_offer,
        "has_canadian_experience": profile.has_canadian_experience,
        "studied_in_canada": profile.studied_in_canada,
        "occupation": profile.occupation,
        "noc_code": profile.noc_code,
        "preferred_province": profile.preferred_province,
    }

    return build_client_simulation_result(base_profile, payload)


@router.get(
    "/clients/{client_id}/simulations",
    response_model=List[SavedScenarioResponse],
)
def list_client_simulations(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    get_owned_client_or_404(db, client_id, current_user)

    return (
        db.query(SavedSimulationScenario)
        .filter(SavedSimulationScenario.client_id == client_id)
        .order_by(SavedSimulationScenario.created_at.desc())
        .all()
    )


@router.get(
    "/clients/{client_id}/simulations/{simulation_id}",
    response_model=SavedScenarioResponse,
)
def get_client_simulation(
    client_id: int,
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    return get_owned_simulation_or_404(db, client_id, simulation_id, current_user)


@router.post(
    "/clients/{client_id}/simulations",
    response_model=SavedScenarioResponse,
)
def create_client_simulation(
    client_id: int,
    payload: SavedScenarioCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    get_owned_client_or_404(db, client_id, current_user)

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
    "/clients/{client_id}/simulations/{simulation_id}",
    response_model=SavedScenarioResponse,
)
def update_client_simulation(
    client_id: int,
    simulation_id: int,
    payload: SavedScenarioUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    simulation = get_owned_simulation_or_404(
        db, client_id, simulation_id, current_user
    )

    if payload.name is not None:
        simulation.name = payload.name

    if payload.notes is not None:
        simulation.notes = payload.notes

    db.commit()
    db.refresh(simulation)
    return simulation


@router.delete("/clients/{client_id}/simulations/{simulation_id}")
def delete_client_simulation(
    client_id: int,
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    simulation = get_owned_simulation_or_404(
        db, client_id, simulation_id, current_user
    )

    db.delete(simulation)
    db.commit()
    return {"message": "Simulation deleted successfully."}


@router.post(
    "/clients/{client_id}/simulations/compare",
    response_model=SimulationCompareResponse,
)
def compare_client_simulations(
    client_id: int,
    payload: SimulationCompareRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    first = get_owned_simulation_or_404(
        db, client_id, payload.first_simulation_id, current_user
    )
    second = get_owned_simulation_or_404(
        db, client_id, payload.second_simulation_id, current_user
    )

    comparison = build_comparison_payload(first, second)

    return {
        "first_simulation": first,
        "second_simulation": second,
        "comparison": comparison,
    }


@router.get("/clients/{client_id}/simulations/{simulation_id}/report")
def export_client_simulation_report(
    client_id: int,
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    client = get_owned_client_or_404(db, client_id, current_user)
    simulation = get_owned_simulation_or_404(
        db, client_id, simulation_id, current_user
    )

    pdf_bytes = build_simulation_report_pdf(
        client_name=client.full_name or f"Client #{client.id}",
        scenario_name=simulation.name,
        scenario_notes=simulation.notes,
        simulation_data=simulation.result_payload or {},
    )

    safe_client_name = (client.full_name or f"client_{client.id}").strip().replace(" ", "_").lower()
    safe_scenario_name = (simulation.name or "simulation").strip().replace(" ", "_").lower()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_client_name}_{safe_scenario_name}_simulation_report.pdf"'
            )
        },
    )


@router.post("/clients/{client_id}/simulations/compare/report")
def export_simulation_comparison_report(
    client_id: int,
    payload: SimulationCompareRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_simulation_access),
):
    client = get_owned_client_or_404(db, client_id, current_user)
    first = get_owned_simulation_or_404(
        db, client_id, payload.first_simulation_id, current_user
    )
    second = get_owned_simulation_or_404(
        db, client_id, payload.second_simulation_id, current_user
    )

    comparison = build_comparison_payload(first, second)

    pdf_bytes = build_simulation_comparison_report_pdf(
        client_name=client.full_name or f"Client #{client.id}",
        first_name=first.name,
        second_name=second.name,
        comparison_payload={
            "first_simulation": first,
            "second_simulation": second,
            "comparison": comparison,
        },
    )

    safe_client_name = (client.full_name or f"client_{client.id}").strip().replace(" ", "_").lower()
    safe_first_name = (first.name or "first").strip().replace(" ", "_").lower()
    safe_second_name = (second.name or "second").strip().replace(" ", "_").lower()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_client_name}_{safe_first_name}_vs_{safe_second_name}_comparison_report.pdf"'
            )
        },
    )