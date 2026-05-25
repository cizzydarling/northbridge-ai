from __future__ import annotations

import json
from io import BytesIO
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.services.forms_catalog_service import get_supported_application_types
from app.services.forms_catalog_service import normalize_application_type
from app.services.forms_package_service import build_forms_package

router = APIRouter(prefix="/forms", tags=["Forms"])


class FormsPackagePreviewRequest(BaseModel):
    application_type: str = Field(..., min_length=1)
    language: str = "en"
    representative_used: Optional[bool] = False
    application_data: Optional[Dict[str, Any]] = None
    download_format: Optional[str] = "json"


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


def _can_export_forms_pdf(user: User) -> bool:
    plan = str(getattr(user, "plan", "") or "").strip().lower()
    role = str(getattr(user, "role", "") or "").strip().lower()

    if role == "admin":
        return True

    return plan in {"individual_premium", "premium"}


def _pdf_text(value: Any) -> str:
    text = str(value if value is not None else "").strip()
    return text or "-"


def _build_forms_package_pdf(package: Dict[str, Any], lang: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=42,
        leftMargin=42,
        topMargin=42,
        bottomMargin=42,
    )
    styles = getSampleStyleSheet()
    story = []

    summary = package.get("summary") or {}
    title = (
        "Dossier de formulaires NorthBridgeAI"
        if lang == "fr"
        else "NorthBridgeAI Forms Package"
    )
    story.append(Paragraph(title, styles["Title"]))
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            _pdf_text(summary.get("application_label")),
            styles["Heading2"],
        )
    )
    story.append(Spacer(1, 8))

    meta_rows = [
        [
            "Complétude" if lang == "fr" else "Completeness",
            f"{summary.get('completeness_score', 0)}%",
        ],
        [
            "Nombre de formulaires" if lang == "fr" else "Forms count",
            _pdf_text(summary.get("forms_count")),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[180, 300])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2ff")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 16))

    story.append(
        Paragraph(
            "Formulaires requis et conditionnels"
            if lang == "fr"
            else "Required and conditional forms",
            styles["Heading2"],
        )
    )
    story.append(Spacer(1, 8))

    forms = package.get("forms") or []
    if forms:
        rows = [[
            "Code",
            "Titre" if lang == "fr" else "Title",
            "Statut" if lang == "fr" else "Status",
            "Champs manquants" if lang == "fr" else "Missing fields",
        ]]
        for form in forms:
            status = (
                "Prêt" if lang == "fr" else "Ready"
            ) if form.get("ready") else (
                "À compléter" if lang == "fr" else "Needs completion"
            )
            missing = ", ".join(form.get("missing_fields") or []) or "-"
            rows.append([
                _pdf_text(form.get("code")),
                Paragraph(_pdf_text(form.get("title")), styles["BodyText"]),
                status,
                Paragraph(missing, styles["BodyText"]),
            ])

        table = Table(rows, colWidths=[70, 210, 90, 150], repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(table)
    else:
        story.append(
            Paragraph(
                "Aucun formulaire détecté." if lang == "fr" else "No forms detected.",
                styles["BodyText"],
            )
        )

    missing_items = package.get("missing_fields") or []
    if missing_items:
        story.append(Spacer(1, 16))
        story.append(
            Paragraph(
                "Points à compléter" if lang == "fr" else "Items to complete",
                styles["Heading2"],
            )
        )
        for item in missing_items[:40]:
            story.append(
                Paragraph(
                    f"{_pdf_text(item.get('form_code'))}: {_pdf_text(item.get('field'))}",
                    styles["BodyText"],
                )
            )

    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            "Ce document est un outil de préparation. Vérifiez toujours les exigences officielles avant tout dépôt."
            if lang == "fr"
            else "This document is a preparation aid. Always verify official requirements before filing.",
            styles["BodyText"],
        )
    )

    doc.build(story)
    return buffer.getvalue()


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

    normalized_type = normalize_application_type(payload.application_type)
    requested_format = str(payload.download_format or "json").strip().lower()

    if requested_format == "pdf":
        if not _can_export_forms_pdf(current_user):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Forms PDF export is available on Premium plans."
                    if lang == "en"
                    else "L’export PDF des formulaires est disponible avec le forfait Premium."
                ),
            )

        filename = (
            f"dossier_formulaires_{normalized_type}.pdf"
            if lang == "fr"
            else f"forms_package_{normalized_type}.pdf"
        )
        return Response(
            content=_build_forms_package_pdf(package, lang),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    filename = f"forms_package_{normalized_type}.json"
    body = json.dumps(package, ensure_ascii=False, indent=2)

    return Response(
        content=body,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
