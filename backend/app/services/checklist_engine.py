from typing import Any


def t(key: str, lang: str):
    translations = {
        "en": {
            "passport": "Passport / travel document",
            "passport_reason_ok": "Passport validity was marked as available.",
            "passport_reason_missing": "Passport validity is not confirmed yet and must be reviewed.",
            "loa": "Letter of Acceptance",
            "loa_reason_ok": "A school or DLI was identified in intake.",
            "loa_reason_missing": "School/DLI information is incomplete. Acceptance documents should be confirmed.",
            "required": "Required",
            "review": "Review",
            "recommended": "Recommended",
        },
        "fr": {
            "passport": "Passeport / document de voyage",
            "passport_reason_ok": "La validité du passeport est confirmée.",
            "passport_reason_missing": "La validité du passeport doit être vérifiée.",
            "loa": "Lettre d’acceptation",
            "loa_reason_ok": "Un établissement ou EED a été identifié.",
            "loa_reason_missing": "Les informations sur l’école/EED sont incomplètes.",
            "required": "Obligatoire",
            "review": "À vérifier",
            "recommended": "Recommandé",
        },
    }

    return translations.get(lang, translations["en"]).get(key, key)


def build_study_permit_checklist(values=None, language="en"):
    values = values or []
    items = []

    items.append(
        {
            "id": "passport",
            "name": t("passport", language),
            "status": t("required", language) if values.get("passport_valid") else t("review", language),
            "reason": t("passport_reason_ok", language)
            if values.get("passport_valid")
            else t("passport_reason_missing", language),
        }
    )

    items.append(
        {
            "id": "loa",
            "name": t("loa", language),
            "status": t("required", language)
            if values.get("dli_name") or values.get("school_name")
            else t("review", language),
            "reason": t("loa_reason_ok", language)
            if values.get("dli_name") or values.get("school_name")
            else t("loa_reason_missing", language),
        }
    )

    return items


def build_checklist(matter_type, values=None, language="en"):
    if matter_type == "study_permit":
        return build_study_permit_checklist(values, language)

    return []