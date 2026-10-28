from fastapi import APIRouter, Depends
from app.routes.self_document_routes import require_self_user
from app.services.product_analytics import Activity, emit
from app.services.security_controls import enforce_rate_limit

router = APIRouter(prefix="/product", tags=["Private product activity"])

@router.post("/activity")
def activity(body: Activity, user=Depends(require_self_user)):
    enforce_rate_limit("product_activity", identifiers=[str(user.id)], limit=30, window_seconds=60)
    return {"accepted": emit(user.id, body.event, plan=user.plan)}
