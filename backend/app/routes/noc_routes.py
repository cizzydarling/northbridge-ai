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
    occupation = (payload.occupation or "").strip()
    job_description = (payload.job_description or "").strip()
    duties = [duty.strip() for duty in (payload.duties or []) if duty and duty.strip()]
    top_k = payload.top_k or 3
    language = (payload.language or "en").strip()

    if not occupation:
        raise HTTPException(status_code=400, detail="Occupation is required.")

    result = suggest_noc_matches(
        occupation=occupation,
        job_description=job_description,
        duties=duties,
        top_k=top_k,
        language=language,
    )

    if not result:
        raise HTTPException(status_code=404, detail="Unable to find a matching NOC.")

    return result


@router.get("/{noc_code}")
def get_noc_details(
    noc_code: str,
    current_user=Depends(get_current_user),
):
    cleaned_noc_code = (noc_code or "").strip()

    if not cleaned_noc_code:
        raise HTTPException(status_code=400, detail="NOC code is required.")

    result = lookup_noc_by_code(cleaned_noc_code)
    if not result:
        raise HTTPException(status_code=404, detail="NOC code not found.")

    return result
