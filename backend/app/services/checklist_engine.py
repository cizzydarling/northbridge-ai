from typing import Any


def normalize_language(language: str | None) -> str:
    lang = (language or "en").strip().lower()
    return "fr" if lang == "fr" else "en"


def t(key: str, lang: str) -> str:
    translations = {
        "en": {
            # Study permit
            "passport": "Passport / travel document",
            "passport_reason_ok": "Passport validity was marked as available.",
            "passport_reason_missing": "Passport validity is not confirmed yet and must be reviewed.",
            "loa": "Letter of Acceptance",
            "loa_reason_ok": "A school or DLI was identified in intake.",
            "loa_reason_missing": "School or DLI information is incomplete.",
            "proof_of_funds": "Proof of funds",
            "proof_of_funds_reason_ok": "Proof of funds appears available.",
            "proof_of_funds_reason_missing": "Proof of funds is not confirmed yet.",
            "tuition_support": "Tuition / fee support documents",
            "tuition_support_reason_ok": "Tuition information is available.",
            "tuition_support_reason_missing": "Tuition information is missing.",
            "study_plan": "Study plan / letter of explanation",
            "study_plan_reason_ok": "Background supports study plan.",
            "study_plan_reason_missing": "Study plan should be prepared.",

            # Work permit
            "work_permit_package": "Work permit package",
            "work_permit_reason": "Work permit checklist is not fully customized yet.",

            # Sponsorship
            "sponsorship_package": "Sponsorship package",
            "sponsorship_reason": "Sponsorship checklist is not fully customized yet.",

            # Status
            "required": "Required",
            "review": "Review",
            "recommended": "Recommended",
        },
        "fr": {
            # Study permit
            "passport": "Passeport / document de voyage",
            "passport_reason_ok": "La validité du passeport est confirmée.",
            "passport_reason_missing": "La validité du passeport doit être vérifiée.",
            "loa": "Lettre d’acceptation",
            "loa_reason_ok": "Un établissement a été identifié.",
            "loa_reason_missing": "Les informations sont incomplètes.",
            "proof_of_funds": "Preuve de fonds",
            "proof_of_funds_reason_ok": "La preuve de fonds est disponible.",
            "proof_of_funds_reason_missing": "La preuve de fonds doit être préparée.",
            "tuition_support": "Frais de scolarité",
            "tuition_support_reason_ok": "Les frais sont indiqués.",
            "tuition_support_reason_missing": "Les frais doivent être confirmés.",
            "study_plan": "Projet d’études",
            "study_plan_reason_ok": "Informations disponibles.",
            "study_plan_reason_missing": "Projet d’études requis.",

            # Work permit
            "work_permit_package": "Dossier de permis de travail",
            "work_permit_reason": "La liste de permis de travail n’est pas encore personnalisée.",

            # Sponsorship
            "sponsorship_package": "Dossier de parrainage",
            "sponsorship_reason": "La liste de parrainage n’est pas encore personnalisée.",

            # Status
            "required": "Obligatoire",
            "review": "À vérifier",
            "recommended": "Recommandé",
        },
    }

    return translations.get(lang, translations["en"]).get(key, key)


# ------------------------
# CHECKLIST BUILDERS
# ------------------------

def build_study_permit_checklist(intake=None, language="en"):
    intake = intake or {}
    language = normalize_language(language)

    has_passport = bool(intake.get("passport_valid"))

    return [
        {
            "id": "passport",
            "name": t("passport", language),
            "status": t("required", language) if has_passport else t("review", language),
            "reason": t("passport_reason_ok", language) if has_passport else t("passport_reason_missing", language),
        }
    ]


def build_work_permit_checklist(intake=None, language="en"):
    language = normalize_language(language)

    return [
        {
            "id": "work_permit_core",
            "name": t("work_permit_package", language),
            "status": t("review", language),
            "reason": t("work_permit_reason", language),
        }
    ]


def build_spousal_sponsorship_checklist(intake=None, language="en"):
    language = normalize_language(language)

    return [
        {
            "id": "sponsorship_core",
            "name": t("sponsorship_package", language),
            "status": t("review", language),
            "reason": t("sponsorship_reason", language),
        }
    ]


def build_checklist(matter_type, intake=None, language="en"):
    language = normalize_language(language)

    if matter_type == "study_permit":
        return build_study_permit_checklist(intake, language)

    if matter_type == "work_permit":
        return build_work_permit_checklist(intake, language)

    if matter_type == "spousal_sponsorship":
        return build_spousal_sponsorship_checklist(intake, language)

    return []