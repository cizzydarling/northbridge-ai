from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.recommendation import Recommendation
from app.models.profile_model import Profile
from app.routes.auth_routes import get_current_user
from app.schemas.recommendation_schema import RecommendationSimulationRequest
from app.services.ai_advisor import generate_ai_strategy
from app.services.crs_calculator import (
    build_recommendation_result,
    calculate_crs,
    calculate_crs_breakdown,
)

router = APIRouter()


@router.get("/crs-breakdown")
def get_crs_breakdown(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    profile = (
        db.query(Profile)
        .filter(Profile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    breakdown_result = calculate_crs_breakdown(profile)

    return {
        "user_id": current_user.id,
        "profile_id": profile.id,
        "profile_snapshot": {
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
        },
        **breakdown_result,
    }


@router.post("/generate")
def generate_recommendation(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    profile = (
        db.query(Profile)
        .filter(Profile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    crs_score = calculate_crs(profile)
    result = build_recommendation_result(profile, crs_score)

    programs = [p["name"] for p in result.get("eligible_pathways", [])]
    strategy = result.get("strategy", {})

    try:
        ai_summary = generate_ai_strategy(profile, crs_score, programs)
        result["advisor_summary_ai"] = ai_summary
    except Exception as e:
        result["advisor_summary_ai"] = None
        result["advisor_summary_ai_error"] = "AI advisor unavailable"
        print("OPENAI ERROR:", repr(e))

    new_rec = Recommendation(
        user_id=current_user.id,
        profile_id=profile.id,
        crs_score=crs_score,
        programs=programs,
        strategy=strategy,
        full_result=result,
    )

    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)

    return {
        "id": new_rec.id,
        "user_id": new_rec.user_id,
        "profile_id": new_rec.profile_id,
        "crs_score": new_rec.crs_score,
        "programs": new_rec.programs,
        "strategy": new_rec.strategy,
        "full_result": new_rec.full_result,
    }


@router.post("/simulate")
def simulate_recommendation(
    simulation_data: RecommendationSimulationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    profile = (
        db.query(Profile)
        .filter(Profile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    simulated_profile = Profile(
        user_id=profile.user_id,
        age=simulation_data.age if simulation_data.age is not None else profile.age,
        education=simulation_data.education if simulation_data.education is not None else profile.education,
        language_score=simulation_data.language_score if simulation_data.language_score is not None else profile.language_score,
        experience_years=simulation_data.experience_years if simulation_data.experience_years is not None else profile.experience_years,
        has_job_offer=simulation_data.has_job_offer if simulation_data.has_job_offer is not None else profile.has_job_offer,
        has_canadian_experience=simulation_data.has_canadian_experience if simulation_data.has_canadian_experience is not None else profile.has_canadian_experience,
        studied_in_canada=simulation_data.studied_in_canada if simulation_data.studied_in_canada is not None else profile.studied_in_canada,
        occupation=simulation_data.occupation if simulation_data.occupation is not None else profile.occupation,
        noc_code=simulation_data.noc_code if simulation_data.noc_code is not None else profile.noc_code,
        preferred_province=simulation_data.preferred_province if simulation_data.preferred_province is not None else profile.preferred_province,
    )

    current_crs = calculate_crs(profile)
    simulated_crs = calculate_crs(simulated_profile)

    current_result = build_recommendation_result(profile, current_crs)
    simulated_result = build_recommendation_result(simulated_profile, simulated_crs)

    current_programs = {p["name"] for p in current_result.get("eligible_pathways", [])}
    simulated_programs = {p["name"] for p in simulated_result.get("eligible_pathways", [])}

    newly_unlocked_pathways = sorted(list(simulated_programs - current_programs))
    no_longer_eligible_pathways = sorted(list(current_programs - simulated_programs))

    try:
        ai_summary = generate_ai_strategy(
            simulated_profile,
            simulated_crs,
            [p["name"] for p in simulated_result.get("eligible_pathways", [])],
        )
        simulated_result["advisor_summary_ai"] = ai_summary
    except Exception as e:
        simulated_result["advisor_summary_ai"] = None
        simulated_result["advisor_summary_ai_error"] = "AI advisor unavailable"
        print("OPENAI ERROR:", repr(e))

    return {
        "current_profile": {
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
        },
        "simulated_changes": simulation_data.model_dump(exclude_none=True),
        "crs_comparison": {
            "current_crs_score": current_crs,
            "simulated_crs_score": simulated_crs,
            "difference": simulated_crs - current_crs,
        },
        "pathway_comparison": {
            "current_eligible_pathways": sorted(list(current_programs)),
            "simulated_eligible_pathways": sorted(list(simulated_programs)),
            "newly_unlocked_pathways": newly_unlocked_pathways,
            "no_longer_eligible_pathways": no_longer_eligible_pathways,
        },
        "simulated_result": simulated_result,
    }


@router.get("/me")
def get_my_recommendations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    records = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == current_user.id)
        .all()
    )

    return {
        "user_id": current_user.id,
        "recommendations": [
            {
                "id": rec.id,
                "profile_id": rec.profile_id,
                "crs_score": rec.crs_score,
                "programs": rec.programs,
                "strategy": rec.strategy,
                "full_result": rec.full_result,
            }
            for rec in records
        ],
    }


@router.get("/compare/{old_id}/{new_id}")
def compare_recommendations(
    old_id: int,
    new_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    old_rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.id == old_id,
            Recommendation.user_id == current_user.id,
        )
        .first()
    )

    new_rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.id == new_id,
            Recommendation.user_id == current_user.id,
        )
        .first()
    )

    if not old_rec:
        raise HTTPException(status_code=404, detail=f"Old recommendation {old_id} not found")

    if not new_rec:
        raise HTTPException(status_code=404, detail=f"New recommendation {new_id} not found")

    old_result = old_rec.full_result or {}
    new_result = new_rec.full_result or {}

    old_crs = old_result.get("crs_score", old_rec.crs_score)
    new_crs = new_result.get("crs_score", new_rec.crs_score)

    old_eligible = {
        p["name"] for p in old_result.get("eligible_pathways", [])
        if "name" in p
    }
    new_eligible = {
        p["name"] for p in new_result.get("eligible_pathways", [])
        if "name" in p
    }

    return {
        "old_recommendation_id": old_rec.id,
        "new_recommendation_id": new_rec.id,
        "crs_comparison": {
            "old_crs_score": old_crs,
            "new_crs_score": new_crs,
            "difference": new_crs - old_crs,
        },
        "newly_unlocked_pathways": sorted(list(new_eligible - old_eligible)),
        "no_longer_eligible_pathways": sorted(list(old_eligible - new_eligible)),
        "old_summary": old_result.get("advisor_summary"),
        "new_summary": new_result.get("advisor_summary"),
    }


@router.get("/{recommendation_id}")
def get_recommendation(
    recommendation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.id == recommendation_id,
            Recommendation.user_id == current_user.id,
        )
        .first()
    )

    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return {
        "id": rec.id,
        "user_id": rec.user_id,
        "profile_id": rec.profile_id,
        "crs_score": rec.crs_score,
        "programs": rec.programs,
        "strategy": rec.strategy,
        "full_result": rec.full_result,
    }