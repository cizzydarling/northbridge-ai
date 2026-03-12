# backend/app/routes/program_routes.py
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.data.db import get_db
from app.services.crs_calculator import calculate_crs
from app.services.pathway_matcher import match_pathways
from app.models.recommendation import Recommendation
from app.routes.auth_routes import get_current_user
from app.models.profile_model import Profile
from fastapi import APIRouter, Depends, HTTPException


router = APIRouter()


class ProfileRequest(BaseModel):
    age: int
    education: str
    language_score: int
    experience_years: int
    has_job_offer: bool = False
    has_canadian_experience: bool = False
    studied_in_canada: bool = False
    occupation: Optional[str] = None
    noc_code: Optional[str] = None
    preferred_province: Optional[str] = None


def build_strategy(match_result: dict, profile: dict):
    strategy = []

    if match_result["eligible"]:
        top = match_result["eligible"][:3]
        strategy.append(
            "Best current matches: " + ", ".join([p["name"] for p in top])
        )

    if match_result["borderline"]:
        top_borderline = match_result["borderline"][:2]
        strategy.append(
            "Near-match pathways: " + ", ".join([p["name"] for p in top_borderline])
        )

    preferred_province = profile.get("preferred_province")
    if preferred_province:
        strategy.append(f"Province preference considered: {preferred_province}.")

    if not match_result["eligible"]:
        strategy.append(
            "No strong immediate pathway match was found. Focus on targeted profile improvements."
        )

    common_steps = []
    for pathway in match_result["borderline"][:2]:
        common_steps.extend(pathway.get("next_steps", [])[:2])

    common_steps = list(dict.fromkeys(common_steps))

    if common_steps:
        strategy.append("Priority next steps: " + "; ".join(common_steps[:3]))

    return strategy


def build_gap_analysis(match_result: dict):
    gap_analysis = []

    top_targets = match_result["eligible"][:2] + match_result["borderline"][:2]

    for pathway in top_targets:
        gap_analysis.append({
            "pathway": pathway["name"],
            "status": pathway["status"],
            "strengths": pathway.get("strengths", [])[:3],
            "blockers": pathway.get("blockers", [])[:3],
            "next_steps": pathway.get("next_steps", [])[:3],
        })

    return gap_analysis

@router.post("/recommend/from-profile")
def recommend_from_saved_profile(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    profile = (
        db.query(Profile)
        .filter(Profile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile_dict = {
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

    crs_score = calculate_crs(profile_dict)
    match_result = match_pathways(profile_dict, crs_score)
    strategy = build_strategy(match_result, profile_dict)
    gap_analysis = build_gap_analysis(match_result)

    full_result = {
        "profile": profile_dict,
        "crs_score": crs_score,
        "eligible_pathways": match_result["eligible"],
        "borderline_pathways": match_result["borderline"],
        "not_eligible_pathways": match_result["not_eligible"][:5],
        "strategy": strategy,
        "gap_analysis": gap_analysis,
    }

    rec = Recommendation(
        user_id=current_user.id,
        crs_score=crs_score,
        programs=[p["name"] for p in match_result["eligible"][:5]],
        strategy=strategy,
        full_result=full_result
    )

    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "recommendation_id": rec.id,
        "user_id": current_user.id,
        **full_result
    }