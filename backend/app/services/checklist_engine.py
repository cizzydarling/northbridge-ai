from typing import Any


def normalize_language(language: str | None) -> str:
    lang = (language or "en").strip().lower()
    return "fr" if lang == "fr" else "en"


def t(key: str, lang: str) -> str:
    translations = {
        "en": {
            "passport": "Passport / travel document",
            "passport_reason_ok": "Passport validity was marked as available.",
            "passport_reason_missing": "Passport validity is not confirmed yet and must be reviewed.",
            "loa": "Letter of Acceptance",
            "loa_reason_ok": "A school or DLI was identified in intake.",
            "loa_reason_missing": "School or DLI information is incomplete. Acceptance documents should be confirmed.",
            "proof_of_funds": "Proof of funds",
            "proof_of_funds_reason_ok": "Proof of funds appears available from intake.",
            "proof_of_funds_reason_missing": "Proof of funds is not confirmed yet and should be prepared.",
            "tuition_support": "Tuition / fee support documents",
            "tuition_support_reason_ok": "Tuition information is available in intake.",
            "tuition_support_reason_missing": "Tuition information is missing and should be confirmed.",
            "study_plan": "Study plan / letter of explanation",
            "study_plan_reason_ok": "Some background details are available to support study plan drafting.",
            "study_plan_reason_missing": "A study plan should be prepared to explain school choice and future plans.",
            "required": "Required",
            "review": "Review",
            "recommended": "Recommended",
        },
        "fr": {
            "passport": "Passeport / document de voyage",
            "passport_reason_ok": "La validité du passeport est confirmée.",
            "passport_reason_missing": "La validité du passeport n’est pas encore confirmée et doit être vérifiée.",
            "loa": "Lettre d’acceptation",
            "loa_reason_ok": "Un établissement ou un EED a été identifié dans les données saisies.",
            "loa_reason_missing": "Les informations sur l’établissement ou l’EED sont incomplètes. Les documents d’acceptation doivent être confirmés.",
            "proof_of_funds": "Preuve de fonds",
            "proof_of_funds_reason_ok": "La preuve de fonds semble disponible selon les informations saisies.",
            "proof_of_funds_reason_missing": "La preuve de fonds n’est pas encore confirmée et devrait être préparée.",
            "tuition_support": "Documents relatifs aux frais de scolarité",
            "tuition_support_reason_ok": "Les frais de scolarité sont indiqués dans les informations saisies.",
            "tuition_support_reason_missing": "Les frais de scolarité sont manquants et doivent être confirmés.",
            "study_plan": "Projet d’études / lettre d’explication",
            "study_plan_reason_ok": "Certaines informations de base sont disponibles pour soutenir la rédaction du projet d’études.",
            "study_plan_reason_missing": "Un projet d’études devrait être préparé pour expliquer le choix de l’établissement et les objectifs futurs.",
            "required": "Obligatoire",
            "review": "À vérifier",
            "recommended": "Recommandé",
        },
    }

    language_pack = translations.get(lang, translations["en"])
    return language_pack.get(key, key)


def build_study_permit_checklist(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> list[dict[str, Any]]:
    intake = intake or {}
    language = normalize_language(language)

    has_school = bool(intake.get("dli_name") or intake.get("school_name"))
    has_passport = bool(intake.get("passport_valid"))
    has_funds = bool(intake.get("proof_of_funds_available"))
    has_tuition = bool(intake.get("tuition_amount"))
    has_study_plan_context = bool(
        intake.get("program_name") or intake.get("gap_in_studies_explanation")
    )

    items = [
        {
            "id": "passport",
            "name": t("passport", language),
            "status": t("required", language)
            if has_passport
            else t("review", language),
            "reason": t("passport_reason_ok", language)
            if has_passport
            else t("passport_reason_missing", language),
        },
        {
            "id": "loa",
            "name": t("loa", language),
            "status": t("required", language)
            if has_school
            else t("review", language),
            "reason": t("loa_reason_ok", language)
            if has_school
            else t("loa_reason_missing", language),
        },
        {
            "id": "proof_of_funds",
            "name": t("proof_of_funds", language),
            "status": t("required", language)
            if has_funds
            else t("review", language),
            "reason": t("proof_of_funds_reason_ok", language)
            if has_funds
            else t("proof_of_funds_reason_missing", language),
        },
        {
            "id": "tuition_support",
            "name": t("tuition_support", language),
            "status": t("required", language)
            if has_tuition
            else t("review", language),
            "reason": t("tuition_support_reason_ok", language)
            if has_tuition
            else t("tuition_support_reason_missing", language),
        },
        {
            "id": "study_plan",
            "name": t("study_plan", language),
            "status": t("recommended", language)
            if has_study_plan_context
            else t("review", language),
            "reason": t("study_plan_reason_ok", language)
            if has_study_plan_context
            else t("study_plan_reason_missing", language),
        },
    ]

    return items


def build_work_permit_checklist(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> list[dict[str, Any]]:
    intake = intake or {}
    language = normalize_language(language)

    return [
        {
            "id": "work_permit_core",
            "name": "Work permit package" if language == "en" else "Dossier de permis de travail",
            "status": t("review", language),
            "reason": (
                "Work permit checklist is not fully customized yet."
                if language == "en"
                else "La liste de permis de travail n’est pas encore entièrement personnalisée."
            ),
        }
    ]


def build_spousal_sponsorship_checklist(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> list[dict[str, Any]]:
    intake = intake or {}
    language = normalize_language(language)

    return [
        {
            "id": "sponsorship_core",
            "name": "Sponsorship package" if language == "en" else "Dossier de parrainage",
            "status": t("review", language),
            "reason": (
                "Sponsorship checklist is not fully customized yet."
                if language == "en"
                else "La liste de parrainage n’est pas encore entièrement personnalisée."
            ),
        }
    ]


def build_checklist(
    matter_type: str | None,
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> list[dict[str, Any]]:
    language = normalize_language(language)

    if matter_type == "study_permit":
        return build_study_permit_checklist(intake, language)

    if matter_type == "work_permit":
        return build_work_permit_checklist(intake, language)

    if matter_type == "spousal_sponsorship":
        return build_spousal_sponsorship_checklist(intake, language)

    return []