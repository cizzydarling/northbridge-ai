from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.services.forms_catalog_service import get_supported_application_types
from app.services.forms_package_service import build_forms_package

router = APIRouter(prefix="/forms", tags=["Forms"])


class FormsPackagePreviewRequest(BaseModel):
    application_type: str = Field(..., min_length=1)
    language: str = "en"
    representative_used: Optional[bool] = False
    application_data: Optional[Dict[str, Any]] = None


def _normalize_language(language: str) -> str:
    return "fr" if str(language).lower().startswith("fr") else "en"


def _can_download_forms(user: User) -> bool:
    plan = str(getattr(user, "plan", "") or "").strip().lower()
    role = str(getattr(user, "role", "") or "").strip().lower()

    if role == "admin":
        return True

    return plan in {
        "individual_pro",
        "individual_premium",
        "agent_pro",
        "pro",
        "premium",
    }


def _profile_to_dict(profile: Profile) -> Dict[str, Any]:
    return {
        "first_name": getattr(profile, "first_name", None),
        "last_name": getattr(profile, "last_name", None),
        "nationality": getattr(profile, "nationality", None),
        "current_country": getattr(profile, "current_country", None),
        "current_city": getattr(profile, "current_city", None),
        "phone_number": getattr(profile, "phone_number", None),
        "date_of_birth": getattr(profile, "date_of_birth", None),
        "marital_status": getattr(profile, "marital_status", None),
        "preferred_language": getattr(profile, "preferred_language", None),
        "age": getattr(profile, "age", None),
        "education": getattr(profile, "education", None),
        "language_score": getattr(profile, "language_score", None),
        "experience_years": getattr(profile, "experience_years", None),
        "has_job_offer": getattr(profile, "has_job_offer", None),
        "has_canadian_experience": getattr(profile, "has_canadian_experience", None),
        "studied_in_canada": getattr(profile, "studied_in_canada", None),
        "occupation": getattr(profile, "occupation", None),
        "noc_code": getattr(profile, "noc_code", None),
        "preferred_province": getattr(profile, "preferred_province", None),
    }


def _clean_application_data(application_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(application_data, dict):
        return {}
    return application_data


def _get_saved_intake_payload(db: Session, user_id: int) -> Dict[str, Any]:
    application = (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == user_id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )

    if not application:
        return {}

    intake = application.intake_payload or {}
    return intake if isinstance(intake, dict) else {}


def _fallback_application_types(lang: str) -> list[dict]:
    if lang == "fr":
        return [
            {"value": "study_permit", "label": "Permis d’études"},
            {"value": "work_permit", "label": "Permis de travail"},
            {"value": "visitor_visa", "label": "Visa visiteur"},
            {"value": "spousal_sponsorship", "label": "Parrainage d’époux / conjoint"},
            {"value": "express_entry", "label": "Entrée express"},
            {"value": "pr_pathway", "label": "Voie de résidence permanente"},
        ]

    return [
        {"value": "study_permit", "label": "Study Permit"},
        {"value": "work_permit", "label": "Work Permit"},
        {"value": "visitor_visa", "label": "Visitor Visa"},
        {"value": "spousal_sponsorship", "label": "Spousal Sponsorship"},
        {"value": "express_entry", "label": "Express Entry"},
        {"value": "pr_pathway", "label": "Permanent Residence Pathway"},
    ]


def _normalize_application_types(items: Any, lang: str) -> list[dict]:
    fallback = _fallback_application_types(lang)

    if not isinstance(items, list):
        return fallback

    normalized: list[dict] = []

    for item in items:
        if isinstance(item, str):
            value = item.strip()
            if value:
                normalized.append(
                    {
                        "value": value,
                        "label": value.replace("_", " ").title(),
                    }
                )
            continue

        if not isinstance(item, dict):
            continue

        value = (
            item.get("value")
            or item.get("key")
            or item.get("id")
            or item.get("code")
            or item.get("slug")
            or item.get("name")
        )
        label = (
            item.get("label")
            or item.get("title")
            or item.get("display_name")
            or item.get("displayName")
            or item.get("name")
            or value
        )

        if value:
            normalized.append(
                {
                    "value": str(value),
                    "label": str(label),
                }
            )

    return normalized or fallback


@router.get("/application-types")
def list_application_types(language: str = "en"):
    lang = _normalize_language(language)

    try:
        items = get_supported_application_types(lang)
    except Exception:
        items = []

    normalized_items = _normalize_application_types(items, lang)

    return {
        "application_types": normalized_items,
        "count": len(normalized_items),
        "language": lang,
    }


@router.post("/package/preview")
def preview_forms_package(
    payload: FormsPackagePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lang = _normalize_language(payload.language)

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                "Profile not found. Please complete your profile first."
                if lang == "en"
                else "Profil introuvable. Veuillez d'abord compléter votre profil."
            ),
        )

    application_data = _clean_application_data(payload.application_data)
    if not application_data:
        application_data = _get_saved_intake_payload(db, current_user.id)

    package = build_forms_package(
        application_type=payload.application_type,
        profile_data=_profile_to_dict(profile),
        language=lang,
        applicant_context={
            "representative_used": bool(payload.representative_used),
        },
        application_data=application_data,
    )

    package["download_enabled"] = _can_download_forms(current_user)
    package["plan"] = getattr(current_user, "plan", "free")
    package["representative_used"] = bool(payload.representative_used)
    return package


@router.post("/package/download")
def download_forms_package(
    payload: FormsPackagePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lang = _normalize_language(payload.language)

    if not _can_download_forms(current_user):
        raise HTTPException(
            status_code=403,
            detail=(
                "Forms package download is available on Pro and Premium plans."
                if lang == "en"
                else "Le téléchargement du dossier de formulaires est disponible avec les forfaits Pro et Premium."
            ),
        )

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                "Profile not found. Please complete your profile first."
                if lang == "en"
                else "Profil introuvable. Veuillez d'abord compléter votre profil."
            ),
        )

    application_data = _clean_application_data(payload.application_data)
    if not application_data:
        application_data = _get_saved_intake_payload(db, current_user.id)

    package = build_forms_package(
        application_type=payload.application_type,
        profile_data=_profile_to_dict(profile),
        language=lang,
        applicant_context={
            "representative_used": bool(payload.representative_used),
        },
        application_data=application_data,
    )

    filename = f"forms_package_{payload.application_type}.json"
    body = json.dumps(package, ensure_ascii=False, indent=2)

    return Response(
        content=body,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )