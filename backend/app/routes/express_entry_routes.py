from fastapi import APIRouter
from app.services.express_entry_service import evaluate_express_entry

router = APIRouter()

@router.post("/express-entry/evaluate")

def evaluate(profile: dict):
    return evaluate_express_entry(profile)

    