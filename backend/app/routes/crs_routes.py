from fastapi import APIRouter
from app.services.crs_service import calculate_crs

router = APIRouter()

@router.post("/calculate")
def calculate_crs_score(profile: dict):

    result = calculate_crs(profile)

    return result