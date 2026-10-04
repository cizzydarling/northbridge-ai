"""User submission and bounded admin-only review. Never captures request headers."""
from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.data.db import get_db
from app.models.beta_feedback_model import BetaFeedback
from app.routes.auth_routes import get_current_user, require_admin
from app.schemas.feedback_schema import Category, FeedbackCreate, FeedbackStatus, FeedbackStatusUpdate, safe_page
from app.services.feedback_service import create_feedback
from app.services.security_controls import enforce_rate_limit

router = APIRouter(tags=['Beta feedback'])


@router.post('/feedback', status_code=201, openapi_extra={
    'requestBody': {'required': True, 'content': {'application/json': {'schema': FeedbackCreate.model_json_schema()}}}})
async def submit_feedback(request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.role != 'individual' or user.plan == 'agent_pro':
        raise HTTPException(403, 'Individual account required')
    for scope, limit, window in [('feedback_minute', 5, 60), ('feedback_hour', 30, 3600)]:
        await run_in_threadpool(enforce_rate_limit, scope, identifiers=[str(user.id)], limit=limit, window_seconds=window)
    # Bound actual streamed bytes, not just attacker-controlled Content-Length.
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > 24576:
            raise HTTPException(413, 'Feedback payload too large')
        raw.extend(chunk)
    try:
        payload = FeedbackCreate.model_validate(json.loads(raw))
    except (ValidationError, ValueError, TypeError, RecursionError):
        # Do not reflect input values (potential PII/tokens) in validation errors.
        raise HTTPException(422, 'Invalid feedback fields') from None
    return await run_in_threadpool(create_feedback, db, user, payload)


@router.get('/admin/feedback')
def list_feedback(db: Session = Depends(get_db), admin=Depends(require_admin),
                  status: FeedbackStatus | None = None, category: Category | None = None,
                  language: str | None = Query(None, pattern='^(en|fr)$'),
                  plan: str | None = Query(None, pattern='^(free|pro|premium)$'),
                  page: str | None = Query(None, max_length=80),
                  date_from: datetime | None = None, date_to: datetime | None = None,
                  offset: int = Query(0, ge=0, le=100000), limit: int = Query(25, ge=1, le=100)):
    if any(value is not None and value.tzinfo is None for value in (date_from, date_to)):
        raise HTTPException(422, 'Dates require a timezone')
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, 'Invalid date range')
    query = db.query(BetaFeedback)
    for field, value in [('status', status), ('category', category), ('language', language), ('user_plan', plan)]:
        if value is not None:
            query = query.filter(getattr(BetaFeedback, field) == value)
    if page is not None:
        query = query.filter(BetaFeedback.page_path == safe_page(page))
    if date_from:
        query = query.filter(BetaFeedback.created_at >= date_from)
    if date_to:
        query = query.filter(BetaFeedback.created_at <= date_to)
    total = query.count()
    items = query.order_by(BetaFeedback.created_at.desc(), BetaFeedback.id.desc()).offset(offset).limit(limit).all()
    return {'items': [{c.name: getattr(row, c.name) for c in BetaFeedback.__table__.columns} for row in items],
            'total': total, 'offset': offset, 'limit': limit}


@router.patch('/admin/feedback/{feedback_id}/status')
def update_status(feedback_id: int, payload: FeedbackStatusUpdate,
                  db: Session = Depends(get_db), admin=Depends(require_admin)):
    row = db.get(BetaFeedback, feedback_id)
    if row is None:
        raise HTTPException(404, 'Feedback not found')
    row.status = payload.status
    db.commit()
    return {'success': True, 'feedback_id': row.id, 'status': row.status}
