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
from app.services.ai_orchestrator import ask_self_user_copilot
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


def _normalize_actions(actions) -> list:
    if not isinstance(actions, list):
        return []

    normalized = []
    for item in actions[:3]:
        if isinstance(item, dict):
            label = str(item.get("label") or item.get("text") or "").strip()
            route = item.get("route")
            if label:
                normalized.append(
                    {
                        "label": label,
                        "route": route if route else None,
                    }
                )
        elif isinstance(item, str):
            label = item.strip()
            if label:
                normalized.append({"label": label, "route": None})

    return normalized


def _normalize_insights(insights, pathways=None) -> list[str]:
    if isinstance(insights, list):
        cleaned = [str(item).strip() for item in insights if str(item).strip()]
        if cleaned:
            return cleaned[:3]

    if isinstance(pathways, list):
        fallback = [str(item).strip() for item in pathways if str(item).strip()]
        return fallback[:3]

    return []


def _fallback_chat_payload(language: str) -> dict:
    return {
        "reply": _t(
            "Here is a personalized analysis based on your current profile. Focus on strengthening your profile details, reviewing your strategy, and preparing your strongest supporting documents.",
            "Voici une analyse personnalisée basée sur votre profil actuel. Concentrez-vous sur l’amélioration de votre profil, la révision de votre stratégie et la préparation de vos documents les plus importants.",
            language,
        ),
        "profile_found": True,
        "strategy_loaded": False,
        "language": language,
        "suggested_next_actions": _normalize_actions(
            [
                {
                    "label": _t(
                        "Open my strategy",
                        "Ouvrir ma stratégie",
                        language,
                    ),
                    "route": "/strategy",
                },
                {
                    "label": _t(
                        "Improve my profile",
                        "Améliorer mon profil",
                        language,
                    ),
                    "route": "/profile",
                },
                {
                    "label": _t(
                        "Open my documents",
                        "Ouvrir mes documents",
                        language,
                    ),
                    "route": "/documents",
                },
            ]
        ),
        "pathways": [],
        "french_advantage": {},
        "insights": [
            _t(
                "Your profile still has room for stronger optimization.",
                "Votre profil présente encore un potentiel d’optimisation.",
                language,
            ),
            _t(
                "Language results, experience, and document quality often have the biggest impact.",
                "Les résultats linguistiques, l’expérience et la qualité documentaire ont souvent le plus d’impact.",
                language,
            ),
        ],
    }


@router.post("/chat", response_model=AIChatResponse)
def chat_with_ai(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    language = _normalize_language(payload.language)

    try:
        result = ask_self_user_copilot(
            db=db,
            current_user=current_user,
            message=(payload.message or "").strip(),
            language=language,
            chat_history=payload.chat_history,
            fail_silently=True,
        ) or {}

        reply = str(result.get("reply") or "").strip()
        actions = _normalize_actions(result.get("suggested_next_actions", []))
        pathways = result.get("pathways") or []
        insights = _normalize_insights(result.get("insights"), pathways)

        if not reply:
            fallback = _fallback_chat_payload(language)
            reply = fallback["reply"]
            if not actions:
                actions = fallback["suggested_next_actions"]
            if not insights:
                insights = fallback["insights"]

        return AIChatResponse(
            reply=reply,
            profile_found=bool(result.get("profile_found", True)),
            strategy_loaded=bool(result.get("strategy_loaded", True)),
            language=language,
            suggested_next_actions=actions,
            pathways=pathways if isinstance(pathways, list) else [],
            french_advantage=result.get("french_advantage", {}) or {},
            insights=insights,
        )

    except Exception as e:
        print("❌ AI CHAT ERROR:", str(e))
        fallback = _fallback_chat_payload(language)

        return AIChatResponse(
            reply=fallback["reply"],
            profile_found=fallback["profile_found"],
            strategy_loaded=fallback["strategy_loaded"],
            language=fallback["language"],
            suggested_next_actions=fallback["suggested_next_actions"],
            pathways=fallback["pathways"],
            french_advantage=fallback["french_advantage"],
            insights=fallback["insights"],
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