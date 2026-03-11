from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.recommendation import Recommendation
from app.dependencies.auth import get_current_user

router = APIRouter()


@router.get("/{recommendation_id}")
def get_recommendation(
    recommendation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.id == recommendation_id,
            Recommendation.user_id == current_user.id
        )
        .first()
    )

    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    return {
        "id": rec.id,
        "user_id": rec.user_id,
        "crs_score": rec.crs_score,
        "programs": rec.programs,
        "strategy": rec.strategy,
        "full_result": rec.full_result
    }


@router.get("/me")
def get_my_recommendations(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
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
                "crs_score": rec.crs_score,
                "programs": rec.programs,
                "strategy": rec.strategy,
                "full_result": rec.full_result
            }
            for rec in records
        ]
    }


@router.get("/compare/{old_id}/{new_id}")
def compare_recommendations(
    old_id: int,
    new_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    old_rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.id == old_id,
            Recommendation.user_id == current_user.id
        )
        .first()
    )

    new_rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.id == new_id,
            Recommendation.user_id == current_user.id
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

    old_borderline = {
        p["name"] for p in old_result.get("borderline_pathways", [])
        if "name" in p
    }
    new_borderline = {
        p["name"] for p in new_result.get("borderline_pathways", [])
        if "name" in p
    }

    unlocked_pathways = sorted(list(new_eligible - old_eligible))
    lost_pathways = sorted(list(old_eligible - new_eligible))
    improved_to_borderline = sorted(list(new_borderline - old_borderline))
    dropped_from_borderline = sorted(list(old_borderline - new_borderline))

    return {
        "old_recommendation_id": old_rec.id,
        "new_recommendation_id": new_rec.id,
        "crs_comparison": {
            "old_crs_score": old_crs,
            "new_crs_score": new_crs,
            "difference": new_crs - old_crs
        },
        "eligible_pathways_comparison": {
            "old": sorted(list(old_eligible)),
            "new": sorted(list(new_eligible)),
            "newly_unlocked": unlocked_pathways,
            "no_longer_eligible": lost_pathways
        },
        "borderline_pathways_comparison": {
            "old": sorted(list(old_borderline)),
            "new": sorted(list(new_borderline)),
            "newly_borderline": improved_to_borderline,
            "no_longer_borderline": dropped_from_borderline
        },
        "strategy_comparison": {
            "old_strategy": old_result.get("strategy", old_rec.strategy),
            "new_strategy": new_result.get("strategy", new_rec.strategy)
        }
    }