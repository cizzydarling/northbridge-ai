from io import BytesIO

import pdfkit
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.access_control import (
    get_current_user,
    has_individual_pro,
    has_premium_access,
)
from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.self_document_model import SelfDocument
from app.schemas.self_application_schema import (
    SelfApplicationResponse,
    SelfApplicationUpsertRequest,
    SelfWorkspaceResponse,
)
from app.services.checklist_engine import build_checklist
from app.services.decision_engine import build_user_decision_context
from app.services.eligibility_engine import evaluate_matter_eligibility
from app.services.forms_assistant import build_forms_assistant
from app.services.report_builder_service import build_strategy_report_html
from app.services.strategy_service import build_strategy
from app.models.application_case_model import ApplicationCase
from app.services.household_service import get_household_members

router = APIRouter(prefix="/self", tags=["Self"])

PERMANENT_RESIDENCE_MATTER_TYPE = "permanent_residence"


def require_self_user(current_user=Depends(get_current_user)):
    raw_plan = str(getattr(current_user, "plan", "") or "").strip().lower()
    role = str(getattr(current_user, "role", "") or "").strip().lower()

    is_agent = raw_plan == "agent_pro" or role == "agent"

    if is_agent:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available to self-serve users.",
        )

    return current_user


def normalize_language(language: str | None) -> str:
    normalized = (language or "en").strip().lower()
    return normalized if normalized in {"en", "fr"} else "en"


def t(en: str, fr: str, language: str) -> str:
    return fr if language == "fr" else en


def get_self_application_for_user(db: Session, user_id: int) -> SelfApplication | None:
    return (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == user_id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )


def get_profile_for_user(db: Session, user_id: int) -> Profile | None:
    return db.query(Profile).filter(Profile.user_id == user_id).first()


def sync_self_documents_from_checklist(
    db: Session,
    user_id: int,
    matter_type: str,
    checklist: list[dict],
) -> None:
    existing_documents = (
        db.query(SelfDocument)
        .filter(
            SelfDocument.user_id == user_id,
            SelfDocument.matter_type == matter_type,
        )
        .all()
    )

    existing_by_key = {doc.document_key: doc for doc in existing_documents}

    for item in checklist:
        document_key = str(item.get("id") or "").strip()
        if not document_key:
            continue

        document_name = item.get("name") or "Document"
        priority = item.get("status") or "Required"
        notes = item.get("reason")
        required = priority == "Required"

        existing = existing_by_key.get(document_key)

        if existing:
            existing.document_name = document_name
            existing.priority = priority
            existing.required = required
            existing.notes = notes
        else:
            document = SelfDocument(
                user_id=user_id,
                matter_type=matter_type,
                document_key=document_key,
                document_name=document_name,
                priority=priority,
                required=required,
                notes=notes,
                completed=False,
            )
            db.add(document)


def build_pr_eligibility_from_strategy(strategy: dict, language: str) -> dict:
    readiness = "Strong" if (strategy.get("crs_score") or 0) >= 470 else (
        "Moderate" if (strategy.get("crs_score") or 0) >= 430 else "Weak"
    )

    strengths = list(strategy.get("strengths") or [])
    weaknesses = list(strategy.get("weaknesses") or [])
    next_steps = list(strategy.get("next_steps") or [])
    pathways = list(strategy.get("recommended_programs") or [])

    if language == "fr":
        if pathways:
            strengths.insert(
                0,
                "Des parcours de résidence permanente ont été identifiés à partir de votre profil."
            )

        advisor_summary = strategy.get("advisor_summary") or (
            "Votre profil a été analysé pour repérer les voies de résidence permanente "
            "les plus réalistes, notamment Entrée express, les programmes des candidats "
            "des provinces et les autres possibilités pertinentes."
        )
    else:
        if pathways:
            strengths.insert(
                0,
                "Permanent residence pathways were identified from your current profile."
            )

        advisor_summary = strategy.get("advisor_summary") or (
            "Your profile was analyzed to identify the most realistic permanent residence "
            "pathways, including Express Entry, Provincial Nominee Program options, and "
            "other relevant opportunities."
        )

    return {
        "readiness": readiness,
        "strengths": strengths,
        "concerns": weaknesses,
        "next_steps": next_steps,
        "summary": advisor_summary,
        "pathways": pathways,
        "french_advantage": strategy.get("french_advantage") or {},
    }


def build_pr_forms_assistant_from_strategy(strategy: dict, language: str) -> dict:
    pathways = list(strategy.get("recommended_programs") or [])
    missing_fields = []

    if strategy.get("crs_score") is None:
        missing_fields.append("CRS score inputs" if language == "en" else "Données du score CRS")

    if language == "fr":
        summary = (
            "Utilisez d’abord cette analyse pour confirmer vos voies de résidence "
            "permanente les plus fortes. Ensuite, préparez les documents liés au "
            "profil, à l’expérience de travail, aux langues, aux études et à la "
            "preuve des éléments qui renforcent votre dossier."
        )

        preparation_notes = [
            "Vérifiez que votre profil contient des renseignements complets sur l’âge, les études, l’expérience et les langues.",
            "Préparez vos résultats linguistiques, preuves d’études et preuves d’expérience de travail qualifié.",
            "Comparez Entrée express aux programmes provinciaux selon votre province cible.",
        ]

        if strategy.get("french_advantage", {}).get("strategic_value") in {"medium", "high"}:
            preparation_notes.append(
                "Si vous avez un bon niveau de français, préparez aussi les éléments pouvant soutenir une stratégie francophone."
            )

        recommended_forms = [
            {"form_key": "profile_review", "form_name": "Révision du profil"},
            {"form_key": "language_evidence", "form_name": "Preuves linguistiques"},
            {"form_key": "education_evidence", "form_name": "Preuves d’études"},
            {"form_key": "work_history_evidence", "form_name": "Preuves d’expérience de travail"},
        ]

        if pathways:
            recommended_forms.append(
                {"form_key": "pathway_selection", "form_name": "Sélection de la voie prioritaire"}
            )

        return {
            "summary": summary,
            "recommended_forms": recommended_forms,
            "missing_fields": missing_fields,
            "preparation_notes": preparation_notes,
        }

    summary = (
        "Use this assessment first to confirm your strongest permanent residence "
        "pathways. Then prepare documents tied to your profile, work history, "
        "language results, education, and any factors that strengthen your file."
    )

    preparation_notes = [
        "Make sure your profile includes complete information on age, education, work experience, and language.",
        "Prepare language results, education records, and proof of skilled work history.",
        "Compare Express Entry with province-specific pathways based on your target province.",
    ]

    if strategy.get("french_advantage", {}).get("strategic_value") in {"medium", "high"}:
        preparation_notes.append(
            "If you have strong French ability, prepare supporting evidence for a francophone or bilingual strategy."
        )

    recommended_forms = [
        {"form_key": "profile_review", "form_name": "Profile review"},
        {"form_key": "language_evidence", "form_name": "Language evidence"},
        {"form_key": "education_evidence", "form_name": "Education evidence"},
        {"form_key": "work_history_evidence", "form_name": "Work history evidence"},
    ]

    if pathways:
        recommended_forms.append(
            {"form_key": "pathway_selection", "form_name": "Primary pathway selection"}
        )

    return {
        "summary": summary,
        "recommended_forms": recommended_forms,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
    }


def build_pr_checklist_from_strategy(strategy: dict, language: str) -> list[dict]:
    pathways = list(strategy.get("recommended_programs") or [])
    french_advantage = strategy.get("french_advantage") or {}
    has_french_advantage = french_advantage.get("strategic_value") in {"medium", "high"}

    if language == "fr":
        checklist = [
            {
                "id": "profile_complete",
                "name": "Profil d’immigration complété",
                "status": "Required",
                "reason": "Votre profil doit être complet pour cibler correctement les voies de résidence permanente.",
            },
            {
                "id": "language_results",
                "name": "Résultats linguistiques",
                "status": "Required",
                "reason": "Les résultats linguistiques sont essentiels pour évaluer les options de résidence permanente.",
            },
            {
                "id": "education_records",
                "name": "Preuves d’études",
                "status": "Required",
                "reason": "Les études influencent fortement l’évaluation et les options disponibles.",
            },
            {
                "id": "work_experience_records",
                "name": "Preuves d’expérience de travail qualifié",
                "status": "Required",
                "reason": "L’expérience de travail qualifié soutient la plupart des parcours de résidence permanente.",
            },
            {
                "id": "pathway_review",
                "name": "Révision des voies recommandées",
                "status": "Recommended",
                "reason": "Comparez les programmes recommandés pour choisir la meilleure stratégie.",
            },
        ]

        if pathways:
            checklist.append(
                {
                    "id": "province_and_program_match",
                    "name": "Validation province / programme",
                    "status": "Recommended",
                    "reason": "Certaines provinces ou certains volets peuvent mieux correspondre à votre profil actuel.",
                }
            )

        if has_french_advantage:
            checklist.append(
                {
                    "id": "french_strategy_support",
                    "name": "Éléments à l’appui d’une stratégie francophone",
                    "status": "Recommended",
                    "reason": "Le dossier semble pouvoir bénéficier d’un positionnement francophone ou bilingue.",
                }
            )

        return checklist

    checklist = [
        {
            "id": "profile_complete",
            "name": "Complete immigration profile",
            "status": "Required",
            "reason": "Your profile needs to be complete to target permanent residence pathways correctly.",
        },
        {
            "id": "language_results",
            "name": "Language test results",
            "status": "Required",
            "reason": "Language results are core to evaluating permanent residence options.",
        },
        {
            "id": "education_records",
            "name": "Education records",
            "status": "Required",
            "reason": "Education strongly affects pathway targeting and competitiveness.",
        },
        {
            "id": "work_experience_records",
            "name": "Proof of skilled work experience",
            "status": "Required",
            "reason": "Skilled work history supports most permanent residence pathways.",
        },
        {
            "id": "pathway_review",
            "name": "Review recommended pathways",
            "status": "Recommended",
            "reason": "Compare the recommended programs to choose the strongest strategy.",
        },
    ]

    if pathways:
        checklist.append(
            {
                "id": "province_and_program_match",
                "name": "Province and pathway alignment review",
                "status": "Recommended",
                "reason": "Some provinces or pathway streams may fit your current profile better than others.",
            }
        )

    if has_french_advantage:
        checklist.append(
            {
                "id": "french_strategy_support",
                "name": "Francophone strategy support evidence",
                "status": "Recommended",
                "reason": "Your profile may benefit from a French-speaking or bilingual pathway strategy.",
            }
        )

    return checklist


def build_decision_payload(
    decision: dict,
    *,
    is_pro: bool,
    language: str,
) -> dict:
    if is_pro:
        return {
            **decision,
            "locked": False,
            "is_premium": True,
        }

    recommended_actions = list(decision.get("recommended_actions") or [])
    top_pathways = list(decision.get("top_pathways") or [])

    return {
        "priority_label": decision.get("priority_label"),
        "priority_reason": decision.get("priority_reason"),
        "primary_recommendation": decision.get("primary_recommendation"),
        "recommended_actions": recommended_actions[:1],
        "top_pathways": top_pathways[:1],
        "readiness": decision.get("readiness"),
        "confidence_label": decision.get("confidence_label"),
        "french_advantage": decision.get("french_advantage"),
        "missing_fields_count": decision.get("missing_fields_count", 0),
        "remaining_required_documents": decision.get("remaining_required_documents", 0),
        "locked": True,
        "is_premium": False,
        "upgrade_reason": t(
            "Upgrade to Pro to unlock the full decision engine, deeper actions, and full pathway ranking.",
            "Passez à Pro pour débloquer le moteur de décision complet, des actions plus approfondies et le classement complet des voies.",
            language,
        ),
    }


def build_strategy_payload(
    strategy: dict,
    *,
    is_pro: bool,
    is_premium: bool,
    language: str,
) -> dict:
    strategy = dict(strategy or {})

    if is_pro:
        strategy["locked"] = False
        strategy["is_premium"] = is_premium
        strategy["can_export_pdf"] = is_premium
        strategy["export_upgrade_reason"] = None if is_premium else t(
            "Upgrade to Premium to unlock PDF export.",
            "Passez à Premium pour débloquer l’export PDF.",
            language,
        )
        return strategy

    return {
        "crs_score": strategy.get("crs_score"),
        "strategy_headline": strategy.get("strategy_headline"),

        # 🔥 NEW — expose intelligence preview
        "best_pathway": strategy.get("best_pathway"),
        "noc_profile": {
            "resolved_noc_code": (strategy.get("noc_profile") or {}).get("resolved_noc_code"),
            "resolved_title": (strategy.get("noc_profile") or {}).get("resolved_title"),
            "confidence": (strategy.get("noc_profile") or {}).get("suggested_confidence"),
        },

        "recommended_programs": list(strategy.get("recommended_programs") or [])[:2],
        "strengths": list(strategy.get("strengths") or [])[:2],
        "weaknesses": list(strategy.get("weaknesses") or [])[:2],
        "next_steps": list(strategy.get("next_steps") or [])[:2],

        # 🔥 show 1 province only (teaser)
        "province_recommendations": (strategy.get("province_recommendations") or [])[:1],

        "advisor_summary": strategy.get("advisor_summary"),
        "french_advantage": strategy.get("french_advantage") or {},

        "locked": True,
        "is_premium": False,
        "can_export_pdf": False,

        "upgrade_reason": t(
            "Upgrade to Pro to unlock full strategy, detailed pathway scoring, and province targeting.",
            "Passez à Pro pour débloquer la stratégie complète, le classement détaillé des voies et le ciblage provincial.",
            language,
        ),

        "export_upgrade_reason": t(
            "Upgrade to Premium to unlock PDF export.",
            "Passez à Premium pour débloquer l’export PDF.",
            language,
        ),
    }


def run_permanent_residence_workspace(
    db: Session,
    current_user,
    language: str,
) -> dict:
    profile = get_profile_for_user(db, current_user.id)

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                "Complete your profile first to generate permanent residence guidance."
                if language == "en"
                else "Complétez d’abord votre profil pour générer des conseils en résidence permanente."
            ),
        )

    strategy = build_strategy(
        profile,
        language=language,
        household_members=household_members,
        application_case=case,
    )

    eligibility = build_pr_eligibility_from_strategy(strategy, language=language)
    forms_assistant = build_pr_forms_assistant_from_strategy(strategy, language=language)
    checklist = build_pr_checklist_from_strategy(strategy, language=language)
    decision = build_user_decision_context(
        strategy=strategy,
        eligibility=eligibility,
        forms_assistant=forms_assistant,
        checklist=checklist,
        language=language,
    )

    return {
        "strategy": strategy,
        "eligibility": eligibility,
        "forms_assistant": forms_assistant,
        "checklist": checklist,
        "decision": decision,
    }


@router.get("/strategy")
def get_my_strategy(
    case_id: int | None = Query(default=None),
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    language = normalize_language(language)

    case = db.query(ApplicationCase).filter_by(id=case_id).first()

    if not case:
        raise HTTPException(status_code=404, detail="Application case not found")

    profile = get_profile_for_user(db, current_user.id)

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=t(
                "Complete your profile first.",
                "Complétez votre profil d'abord.",
                language,
            ),
        )

    household_members = get_household_members(db, current_user.id)

    subscription_status = str(
        getattr(current_user, "subscription_status", "") or ""
    ).strip().lower()
    plan = str(getattr(current_user, "plan", "") or "").strip().lower()
    is_active = subscription_status in {"active", "trialing"}

    is_pro = has_individual_pro(current_user) or (
        plan in {"individual_pro", "pro"} and is_active
    )
    is_premium = has_premium_access(current_user) or (
        plan in {"individual_premium", "premium"} and is_active
    )

    raw_strategy = build_strategy(profile, language=language)

    strategy = build_strategy_payload(
        raw_strategy,
        is_pro=is_pro,
        is_premium=is_premium,
        language=language,
    )

    return {
        **strategy,
        "pathways": strategy.get("recommended_programs", []),
        "french_advantage": strategy.get("french_advantage", {}),
        "access": {
            "is_pro": is_pro,
            "is_premium": is_premium,
            "can_export_pdf": is_premium,
            "subscription_status": subscription_status,
            "plan": plan,
        },
    }


@router.get("/application")
def get_self_application_context(
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    application = get_self_application_for_user(db, current_user.id)

    return {
        "message": "Self application workspace is available.",
        "user_id": current_user.id,
        "email": current_user.email,
        "role": getattr(current_user, "role", None),
        "plan": getattr(current_user, "plan", None),
        "application": application,
    }


@router.get("/application/saved", response_model=SelfApplicationResponse)
def get_saved_self_application(
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    application = get_self_application_for_user(db, current_user.id)

    if not application:
        raise HTTPException(status_code=404, detail="No saved self application found.")

    return application


@router.post("/workspace", response_model=SelfWorkspaceResponse)
def run_self_workspace(
    payload: SelfApplicationUpsertRequest,
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    matter_type = payload.matter_type
    intake = payload.intake or {}
    language = normalize_language(language)

    is_pro = has_individual_pro(current_user)
    is_premium = has_premium_access(current_user)

    strategy = None

    if matter_type == PERMANENT_RESIDENCE_MATTER_TYPE:
        pr_workspace = run_permanent_residence_workspace(
            db=db,
            current_user=current_user,
            language=language,
        )
        raw_strategy = pr_workspace["strategy"]
        strategy = build_strategy_payload(
            raw_strategy,
            is_pro=is_pro,
            is_premium=is_premium,
            language=language,
        )
        eligibility = pr_workspace["eligibility"]
        forms_assistant = pr_workspace["forms_assistant"]
        checklist = pr_workspace["checklist"]
        raw_decision = pr_workspace["decision"]
    else:
        eligibility = evaluate_matter_eligibility(
            matter_type,
            intake,
            language=language,
        )
        forms_assistant = build_forms_assistant(
            matter_type,
            intake,
            language=language,
        )
        checklist = build_checklist(
            matter_type,
            intake,
            language=language,
        )
        raw_decision = build_user_decision_context(
            strategy=None,
            eligibility=eligibility,
            forms_assistant=forms_assistant,
            checklist=checklist,
            language=language,
        )

    decision = build_decision_payload(
        raw_decision,
        is_pro=is_pro,
        language=language,
    )

    application = get_self_application_for_user(db, current_user.id)

    if application:
        application.matter_type = matter_type
        application.intake_payload = intake
        application.eligibility_result = eligibility
        application.forms_result = forms_assistant
        application.checklist_result = checklist
    else:
        application = SelfApplication(
            user_id=current_user.id,
            matter_type=matter_type,
            intake_payload=intake,
            eligibility_result=eligibility,
            forms_result=forms_assistant,
            checklist_result=checklist,
        )
        db.add(application)

    sync_self_documents_from_checklist(
        db=db,
        user_id=current_user.id,
        matter_type=matter_type,
        checklist=checklist,
    )

    db.commit()
    db.refresh(application)

    response_payload = {
        "application": application,
        "eligibility": eligibility,
        "forms_assistant": forms_assistant,
        "checklist": checklist,
        "decision": decision,
    }

    if strategy is not None:
        response_payload["strategy"] = strategy
        response_payload["pathways"] = strategy.get("recommended_programs", [])
        response_payload["french_advantage"] = strategy.get("french_advantage", {})

    return response_payload


@router.get("/strategy/export-pdf")
def export_strategy_pdf(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user=Depends(require_self_user),
):
    language = normalize_language(language)

    if not has_premium_access(current_user):
        raise HTTPException(
            status_code=403,
            detail=t(
                "Upgrade to Premium to unlock PDF export.",
                "Passez à Premium pour débloquer l’export PDF.",
                language,
            ),
        )

    profile = get_profile_for_user(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=t(
                "Complete your profile first to export your strategy.",
                "Complétez d’abord votre profil pour exporter votre stratégie.",
                language,
            ),
        )

    strategy = build_strategy(profile, language=language)

    html_content = build_strategy_report_html(
        profile=profile.__dict__,
        strategy_data=strategy,
        user_email=current_user.email,
        language=language,
    )

    try:
        pdf_bytes = pdfkit.from_string(html_content, False)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)}",
        )

    pdf_buffer = BytesIO(pdf_bytes)

    filename = (
        "northbridgeai_strategy_report.pdf"
        if language == "en"
        else "rapport_strategie_northbridgeai.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )