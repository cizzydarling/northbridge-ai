from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.access_control import has_individual_pro
from app.data.db import get_db
from app.models.generated_document_model import GeneratedDocument
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.ai_schema import AIChatRequest, AIChatResponse
from app.schemas.document_generator_schema import (
    DocumentGeneratorRequest,
    DocumentGeneratorResponse,
)
import app.services.ai_advisor as ai_advisor
from app.services.decision_engine import build_user_decision_context
from app.services.document_generator_service import (
    document_filename,
    generate_document_draft,
)
from app.services.docx_export_service import build_generated_document_docx
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/ai", tags=["AI"])


def _normalize_language(language: str | None) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def _t(en: str, fr: str, language: str) -> str:
    return fr if _normalize_language(language) == "fr" else en


def _build_chat_fallback(message: str, language: str) -> dict:
    language = _normalize_language(language)

    if language == "fr":
        return {
            "reply": (
                "J’ai bien reçu votre message. Le service de conversation IA n’est "
                "pas entièrement configuré pour le moment, mais vous pouvez continuer "
                "à utiliser la stratégie, le moteur de décision et le générateur de documents."
            ),
            "suggested_next_actions": [],
        }

    return {
        "reply": (
            "I received your message. The AI chat service is not fully configured at "
            "the moment, but you can continue using strategy, the decision engine, "
            "and the document generator."
        ),
        "suggested_next_actions": [],
    }


def _call_chat_service(
    *,
    message: str,
    language: str,
    profile,
    strategy,
    chat_history,
) -> dict:
    print("🧠 _call_chat_service triggered")

    # 🔍 Ensure function exists
    fn = getattr(ai_advisor, "generate_ai_chat_reply", None)

    if not callable(fn):
        error_msg = "generate_ai_chat_reply not found in ai_advisor"
        print("❌", error_msg)
        raise Exception(error_msg)

    try:
        print("🔥 Calling AI advisor...")
        print("📨 Message:", message)
        print("🌐 Language:", language)
        print("📊 Profile exists:", bool(profile))
        print("📈 Strategy exists:", bool(strategy))

        result = fn(
            message=message,
            language=language,
            profile=profile,
            strategy=strategy,
            chat_history=chat_history,
        )

        print("✅ AI advisor returned:", result)

        if isinstance(result, dict):
            return result

        raise Exception("AI advisor returned invalid format (not dict)")

    except Exception as e:
        print("❌ AI ERROR:", str(e))
        raise e  # 🚨 CRITICAL: do NOT fallback silently


def _build_document_preview(result: dict, language: str) -> dict:
    content = (result.get("content") or "").strip()
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    preview_content = "\n\n".join(paragraphs[:2]).strip()

    if not preview_content:
        preview_content = content[:700].strip()

    if preview_content and len(preview_content) < len(content):
        preview_content += "\n\n[...]"

    return {
        **result,
        "content": preview_content,
        "is_premium": False,
        "locked": True,
        "upgrade_reason": _t(
            "Upgrade to Premium to unlock the full document draft and Word download.",
            "Passez à Premium pour débloquer le brouillon complet et le téléchargement Word.",
            language,
        ),
    }


@router.post("/chat", response_model=AIChatResponse)
def chat_with_ai(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    language = _normalize_language(payload.language)

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    strategy = build_strategy(profile, language=language) if profile else None

    result = _call_chat_service(
        message=payload.message,
        language=language,
        profile=profile,
        strategy=strategy,
        chat_history=[m.model_dump() for m in (payload.chat_history or [])],
    )

    return AIChatResponse(
        reply=result.get("reply", ""),
        profile_found=bool(profile),
        strategy_loaded=bool(strategy),
        language=language,
        suggested_next_actions=result.get("suggested_next_actions", []),
        pathways=(strategy.get("recommended_programs") if strategy else []),
        french_advantage=(strategy.get("french_advantage") if strategy else {}),
    )


@router.post("/generate-document", response_model=DocumentGeneratorResponse)
def generate_document(
    payload: DocumentGeneratorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    language = _normalize_language(payload.language)
    is_premium = has_individual_pro(current_user)

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    application = (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == current_user.id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )

    strategy = build_strategy(profile, language=language)

    decision = build_user_decision_context(
        strategy=strategy,
        eligibility=(application.eligibility_result if application else None),
        forms_assistant=(application.forms_result if application else None),
        checklist=(application.checklist_result if application else None),
        language=language,
    )

    result = generate_document_draft(
        document_type=payload.document_type,
        language=language,
        tone=payload.tone,
        additional_instructions=payload.additional_instructions,
        profile=profile,
        application={
            "matter_type": application.matter_type if application else None,
            "intake_payload": application.intake_payload if application else {},
        },
        decision=decision,
        strategy=strategy,
        context_overrides=payload.context_overrides,
    )

    saved_doc = GeneratedDocument(
        user_id=current_user.id,
        document_type=result["document_type"],
        title=result["title"],
        language=result["language"],
        content=result["content"],
        tone=payload.tone,
    )
    db.add(saved_doc)
    db.commit()

    if is_premium:
        return {
            **result,
            "is_premium": True,
            "locked": False,
        }

    return _build_document_preview(result, language)


@router.post("/generate-document/docx")
def generate_document_docx(
    payload: DocumentGeneratorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    language = _normalize_language(payload.language)

    if not has_individual_pro(current_user):
        raise HTTPException(
            status_code=403,
            detail=_t(
                "Premium is required to download Word documents.",
                "Le forfait Premium est requis pour télécharger les documents Word.",
                language,
            ),
        )

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    application = (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == current_user.id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )

    strategy = build_strategy(profile, language=language)

    decision = build_user_decision_context(
        strategy=strategy,
        eligibility=(application.eligibility_result if application else None),
        forms_assistant=(application.forms_result if application else None),
        checklist=(application.checklist_result if application else None),
        language=language,
    )

    result = generate_document_draft(
        document_type=payload.document_type,
        language=language,
        tone=payload.tone,
        additional_instructions=payload.additional_instructions,
        profile=profile,
        application={
            "matter_type": application.matter_type if application else None,
            "intake_payload": application.intake_payload if application else {},
        },
        decision=decision,
        strategy=strategy,
        context_overrides=payload.context_overrides,
    )

    docx_bytes = build_generated_document_docx(
        title=result["title"],
        content=result["content"],
        language=result["language"],
        disclaimer=result.get("disclaimer"),
    )

    filename = document_filename(payload.document_type, language)

    return StreamingResponse(
        BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )