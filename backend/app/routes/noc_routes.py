from fastapi import APIRouter, Depends, HTTPException

from app.routes.auth_routes import get_current_user
from app.schemas.noc_schema import NocSuggestRequest, NocSuggestResponse
from app.services.noc_service import lookup_noc_by_code, suggest_noc_matches

router = APIRouter(prefix="/noc", tags=["NOC"])


@router.post("/suggest", response_model=NocSuggestResponse)
def suggest_noc(
    payload: NocSuggestRequest,
    current_user=Depends(get_current_user),
):
    result = suggest_noc_matches(
        occupation=payload.occupation,
        job_description=payload.job_description or "",
        duties=payload.duties or [],
        top_k=payload.top_k or 3,
    )
    return result


@router.get("/{noc_code}")
def get_noc_details(
    noc_code: str,
    current_user=Depends(get_current_user),
):
    result = lookup_noc_by_code(noc_code)
    if not result:
        raise HTTPException(status_code=404, detail="NOC code not found.")
    return result