from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.access_control import has_individual_pro
from app.data.db import get_db
from app.models.disclosure_acceptance_model import DisclosureAcceptance
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/strategy", tags=["Strategy"])

REQUIRED_DISCLOSURES = [
    "terms_of_use",
    "privacy_consent",
    "ai_assistance_disclaimer",
    "no_legal_advice_acknowledgment",
    "user_responsibility_acknowledgment",
    "limitation_of_scope_acknowledgment",
]


def require_disclosures_accepted(db: Session, current_user: User) -> None:
    for disclosure_type in REQUIRED_DISCLOSURES:
        latest = (
            db.query(DisclosureAcceptance)
            .filter(
                DisclosureAcceptance.user_id == current_user.id,
                DisclosureAcceptance.disclosure_type == disclosure_type,
            )
            .order_by(DisclosureAcceptance.accepted_at.desc())
            .first()
        )

        if not latest:
            raise HTTPException(
                status_code=403,
                detail="Disclosures must be accepted before accessing strategy.",
            )


def build_basic_strategy_payload(
    strategy: dict,
    language: str,
    current_user: User,
    profile: Profile,
) -> dict:
    return {
        "user_id": current_user.id,
        "profile_id": profile.id,
        "language": language,
        "is_premium": False,
        "crs_score": strategy.get("crs_score"),
        "recommended_programs": strategy.get("recommended_programs", [])[:3],
        "strengths": strategy.get("strengths", [])[:3],
        "weaknesses": strategy.get("weaknesses", [])[:3],
        "next_steps": strategy.get("next_steps", [])[:3],
        "advisor_summary": strategy.get("advisor_summary"),
        "improvement_scenarios": [],
        "roadmap": [],
        "province_recommendations": [],
        "timeline_estimate": {},
        "probability_estimate": {},
        "draw_prediction": {},
        "ai_strategy": "",
    }


def draw_wrapped_text(
    pdf: canvas.Canvas,
    text: str,
    x: int,
    y: int,
    max_width: int,
    font_name: str = "Helvetica",
    font_size: int = 10,
    line_gap: int = 4,
):
    pdf.setFont(font_name, font_size)
    lines = simpleSplit(text or "", font_name, font_size, max_width)
    current_y = y

    for line in lines:
        pdf.drawString(x, current_y, line)
        current_y -= font_size + line_gap

    return current_y


def draw_bullets(
    pdf: canvas.Canvas,
    items: list[str],
    x: int,
    y: int,
    max_width: int,
    font_size: int = 10,
):
    current_y = y

    for item in items:
        bullet_text = f"• {item}"
        current_y = draw_wrapped_text(
            pdf,
            bullet_text,
            x,
            current_y,
            max_width,
            font_name="Helvetica",
            font_size=font_size,
            line_gap=3,
        )
        current_y -= 4

    return current_y


def build_strategy_report_pdf(
    profile: Profile,
    strategy_data: dict,
    user_email: str | None = None,
    language: str = "en",
) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER

    margin_x = 50
    max_width = width - (margin_x * 2)
    y = height - 50

    def new_page():
        nonlocal y
        pdf.showPage()
        y = height - 50

    def ensure_space(min_y: int = 90):
        nonlocal y
        if y < min_y:
            new_page()

    title = (
        "Rapport stratégique NorthBridgeAI"
        if language == "fr"
        else "NorthBridgeAI Strategy Report"
    )
    subtitle = (
        "Usage informatif uniquement - pas un avis juridique."
        if language == "fr"
        else "For informational use only - not legal advice."
    )

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(margin_x, y, title)
    y -= 25

    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin_x, y, subtitle)
    y -= 20

    if user_email:
      pdf.drawString(margin_x, y, f"User: {user_email}")
      y -= 20

    sections = []

    if language == "fr":
        sections.extend(
            [
                (
                    "Profil",
                    [
                        f"Âge: {profile.age}",
                        f"Études: {profile.education}",
                        f"Score linguistique: {profile.language_score}",
                        f"Expérience: {profile.experience_years} an(s)",
                        f"Offre d’emploi: {'Oui' if profile.has_job_offer else 'Non'}",
                        f"Expérience canadienne: {'Oui' if profile.has_canadian_experience else 'Non'}",
                        f"Études au Canada: {'Oui' if profile.studied_in_canada else 'Non'}",
                        f"Profession: {profile.occupation or 'Non précisé'}",
                        f"Code CNP: {profile.noc_code or 'Non précisé'}",
                        f"Province privilégiée: {profile.preferred_province or 'Non précisé'}",
                    ],
                ),
                (
                    "Résumé stratégique",
                    [strategy_data.get("advisor_summary") or "Non disponible"],
                ),
                ("Programmes recommandés", strategy_data.get("recommended_programs", [])),
                ("Forces", strategy_data.get("strengths", [])),
                ("Faiblesses", strategy_data.get("weaknesses", [])),
                ("Prochaines étapes", strategy_data.get("next_steps", [])),
            ]
        )
    else:
        sections.extend(
            [
                (
                    "Profile",
                    [
                        f"Age: {profile.age}",
                        f"Education: {profile.education}",
                        f"Language score: {profile.language_score}",
                        f"Experience: {profile.experience_years} year(s)",
                        f"Has job offer: {'Yes' if profile.has_job_offer else 'No'}",
                        f"Has Canadian experience: {'Yes' if profile.has_canadian_experience else 'No'}",
                        f"Studied in Canada: {'Yes' if profile.studied_in_canada else 'No'}",
                        f"Occupation: {profile.occupation or 'Not provided'}",
                        f"NOC code: {profile.noc_code or 'Not provided'}",
                        f"Preferred province: {profile.preferred_province or 'Not provided'}",
                    ],
                ),
                (
                    "Strategy Summary",
                    [strategy_data.get("advisor_summary") or "Not available"],
                ),
                ("Recommended Programs", strategy_data.get("recommended_programs", [])),
                ("Strengths", strategy_data.get("strengths", [])),
                ("Weaknesses", strategy_data.get("weaknesses", [])),
                ("Next Steps", strategy_data.get("next_steps", [])),
            ]
        )

    crs_score = strategy_data.get("crs_score")
    ensure_space()
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(margin_x, y, f"CRS Score: {crs_score if crs_score is not None else '--'}")
    y -= 20

    for section_title, section_items in sections:
        ensure_space()
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(margin_x, y, section_title)
        y -= 18

        if section_items:
            y = draw_bullets(pdf, section_items, margin_x, y, max_width)
        else:
            y = draw_wrapped_text(pdf, "—", margin_x, y, max_width)

        y -= 10

    ai_strategy = strategy_data.get("ai_strategy")
    if ai_strategy:
        ensure_space()
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(
            margin_x,
            y,
            "AI Strategy" if language == "en" else "Stratégie IA",
        )
        y -= 18
        y = draw_wrapped_text(
            pdf,
            ai_strategy,
            margin_x,
            y,
            max_width,
            font_size=10,
            line_gap=3,
        )

    pdf.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@router.get("/me")
def get_my_strategy(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_disclosures_accepted(db, current_user)

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    language = (language or "en").lower()
    if language not in {"en", "fr"}:
        language = "en"

    strategy = build_strategy(profile, language=language)

    if has_individual_pro(current_user):
        return {
            "user_id": current_user.id,
            "profile_id": profile.id,
            "language": language,
            "is_premium": True,
            **strategy,
        }

    return build_basic_strategy_payload(
        strategy=strategy,
        language=language,
        current_user=current_user,
        profile=profile,
    )


@router.get("")
def get_my_strategy_alias(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_my_strategy(language=language, db=db, current_user=current_user)


@router.get("/report")
def export_strategy_report(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_disclosures_accepted(db, current_user)

    if not has_individual_pro(current_user):
        raise HTTPException(
            status_code=403,
            detail="Premium plan required to export strategy report.",
        )

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    language = (language or "en").lower()
    if language not in {"en", "fr"}:
        language = "en"

    strategy = build_strategy(profile, language=language)

    pdf_bytes = build_strategy_report_pdf(
        profile=profile,
        strategy_data=strategy,
        user_email=getattr(current_user, "email", None),
        language=language,
    )

    filename = (
        "rapport_strategie_northbridge.pdf"
        if language == "fr"
        else "northbridge_strategy_report.pdf"
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )