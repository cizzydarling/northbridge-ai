from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.ai_schema import AIChatRequest, AIChatResponse
from app.services.ai_advisor import generate_ai_chat_reply
from app.services.journey_service import get_user_journey
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=AIChatResponse)
def chat_with_ai(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                "Profile not found. Please complete your profile first."
                if payload.language == "en"
                else "Profil introuvable. Veuillez d’abord compléter votre profil."
            ),
        )

    try:
        strategy = build_strategy(profile, language=payload.language)
        journey = get_user_journey(
            db=db,
            current_user=current_user,
            language=payload.language,
        )

        reply = generate_ai_chat_reply(
            user_message=payload.message,
            profile=profile,
            strategy_data=strategy,
            journey_data=journey,
            language=payload.language,
            chat_history=payload.chat_history or [],
        )

        if not reply:
            raise ValueError("Empty AI reply")

        return AIChatResponse(
            reply=reply,
            profile_found=True,
            strategy_loaded=True,
            language=payload.language,
        )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=(
                "The AI assistant is temporarily unavailable. Please try again."
                if payload.language == "en"
                else "L’assistant IA est temporairement indisponible. Veuillez réessayer."
            ),
        )