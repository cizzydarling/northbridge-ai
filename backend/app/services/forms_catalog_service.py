from __future__ import annotations

import re
from typing import Any, Dict, List


SUPPORTED_APPLICATION_TYPES: List[Dict[str, str]] = [
    {"value": "express_entry", "en": "Express Entry", "fr": "Entrée express"},
    {"value": "study_permit", "en": "Study Permit", "fr": "Permis d'études"},
    {"value": "work_permit", "en": "Work Permit", "fr": "Permis de travail"},
    {
        "value": "spousal_sponsorship",
        "en": "Spousal Sponsorship",
        "fr": "Parrainage d'époux ou conjoint",
    },
    {"value": "visitor_visa", "en": "Visitor Visa", "fr": "Visa visiteur"},
    {
        "value": "pr_pathway",
        "en": "Permanent Residence Pathway",
        "fr": "Voie vers la résidence permanente",
    },
]

APPLICATION_TYPE_ALIASES: Dict[str, str] = {
    "express": "express_entry",
    "expressentry": "express_entry",
    "express_entry_profile": "express_entry",
    "permanent_residence": "pr_pathway",
    "permanent_residence_pathway": "pr_pathway",
    "permanent_residency": "pr_pathway",
    "pr": "pr_pathway",
    "pr_application": "pr_pathway",
    "residence_permanente": "pr_pathway",
    "study": "study_permit",
    "student": "study_permit",
    "student_visa": "study_permit",
    "study_visa": "study_permit",
    "work": "work_permit",
    "worker": "work_permit",
    "worker_visa": "work_permit",
    "visitor": "visitor_visa",
    "visitor_permit": "visitor_visa",
    "temporary_resident_visa": "visitor_visa",
    "temporary_resident": "visitor_visa",
    "tourist_visa": "visitor_visa",
    "trv": "visitor_visa",
    "visa_visiteur": "visitor_visa",
    "spousal": "spousal_sponsorship",
    "spouse": "spousal_sponsorship",
    "spouse_sponsorship": "spousal_sponsorship",
    "partner_sponsorship": "spousal_sponsorship",
    "family_sponsorship": "spousal_sponsorship",
    "family": "spousal_sponsorship",
    "sponsorship": "spousal_sponsorship",
}


FORMS_CATALOG: Dict[str, List[Dict[str, Any]]] = {
    "express_entry": [
        {
            "code": "EE_PROFILE",
            "title_en": "Express Entry Profile Intake",
            "title_fr": "Collecte de profil Entrée express",
            "required": True,
            "conditional_rule": None,
            "description_en": "Core intake data used to prepare an Express Entry profile.",
            "description_fr": "Données principales utilisées pour préparer un profil Entrée express.",
        },
        {
            "code": "IMM5406",
            "title_en": "Additional Family Information",
            "title_fr": "Renseignements additionnels sur la famille",
            "required": True,
            "conditional_rule": None,
            "description_en": "Family information form frequently required in permanent residence processing.",
            "description_fr": "Formulaire d'information familiale souvent requis dans le traitement de la résidence permanente.",
        },
        {
            "code": "IMM5476",
            "title_en": "Use of a Representative",
            "title_fr": "Recours aux services d'un représentant",
            "required": False,
            "conditional_rule": "representative_used",
            "description_en": "Required only if the applicant uses a representative.",
            "description_fr": "Requis uniquement si le demandeur utilise un représentant.",
        },
    ],
    "study_permit": [
        {
            "code": "IMM1294",
            "title_en": "Application for Study Permit Made Outside Canada",
            "title_fr": "Demande de permis d'études présentée à l'extérieur du Canada",
            "required": True,
            "conditional_rule": None,
            "description_en": "Primary form for study permit applications made from outside Canada.",
            "description_fr": "Formulaire principal pour les demandes de permis d'études présentées à l'extérieur du Canada.",
        },
        {
            "code": "IMM5645",
            "title_en": "Family Information",
            "title_fr": "Renseignements sur la famille",
            "required": True,
            "conditional_rule": None,
            "description_en": "Family details form commonly required with temporary residence applications.",
            "description_fr": "Formulaire de renseignements familiaux généralement requis pour les demandes de résidence temporaire.",
        },
        {
            "code": "IMM5476",
            "title_en": "Use of a Representative",
            "title_fr": "Recours aux services d'un représentant",
            "required": False,
            "conditional_rule": "representative_used",
            "description_en": "Required only if the applicant uses a representative.",
            "description_fr": "Requis uniquement si le demandeur utilise un représentant.",
        },
    ],
    "work_permit": [
        {
            "code": "IMM1295",
            "title_en": "Application for Work Permit Made Outside Canada",
            "title_fr": "Demande de permis de travail présentée à l'extérieur du Canada",
            "required": True,
            "conditional_rule": None,
            "description_en": "Primary form for work permit applications made from outside Canada.",
            "description_fr": "Formulaire principal pour les demandes de permis de travail présentées à l'extérieur du Canada.",
        },
        {
            "code": "IMM5645",
            "title_en": "Family Information",
            "title_fr": "Renseignements sur la famille",
            "required": True,
            "conditional_rule": None,
            "description_en": "Family details form commonly required with temporary residence applications.",
            "description_fr": "Formulaire de renseignements familiaux généralement requis pour les demandes de résidence temporaire.",
        },
        {
            "code": "IMM5476",
            "title_en": "Use of a Representative",
            "title_fr": "Recours aux services d'un représentant",
            "required": False,
            "conditional_rule": "representative_used",
            "description_en": "Required only if the applicant uses a representative.",
            "description_fr": "Requis uniquement si le demandeur utilise un représentant.",
        },
    ],
    "spousal_sponsorship": [
        {
            "code": "IMM5532",
            "title_en": "Relationship Information and Sponsorship Evaluation",
            "title_fr": "Renseignements sur la relation et évaluation du parrainage",
            "required": True,
            "conditional_rule": None,
            "description_en": "Core relationship and sponsorship evaluation form.",
            "description_fr": "Formulaire principal pour la relation et l'évaluation du parrainage.",
        },
        {
            "code": "IMM5406",
            "title_en": "Additional Family Information",
            "title_fr": "Renseignements additionnels sur la famille",
            "required": True,
            "conditional_rule": None,
            "description_en": "Family information form for permanent residence family sponsorship flows.",
            "description_fr": "Formulaire d'information familiale pour les parcours de parrainage familial en résidence permanente.",
        },
        {
            "code": "IMM5476",
            "title_en": "Use of a Representative",
            "title_fr": "Recours aux services d'un représentant",
            "required": False,
            "conditional_rule": "representative_used",
            "description_en": "Required only if the applicant uses a representative.",
            "description_fr": "Requis uniquement si le demandeur utilise un représentant.",
        },
    ],
    "visitor_visa": [
        {
            "code": "IMM5257",
            "title_en": "Application for Temporary Resident Visa",
            "title_fr": "Demande de visa de résident temporaire",
            "required": True,
            "conditional_rule": None,
            "description_en": "Primary form for visitor visa applications.",
            "description_fr": "Formulaire principal pour les demandes de visa visiteur.",
        },
        {
            "code": "IMM5645",
            "title_en": "Family Information",
            "title_fr": "Renseignements sur la famille",
            "required": True,
            "conditional_rule": None,
            "description_en": "Family details form commonly required with temporary residence applications.",
            "description_fr": "Formulaire de renseignements familiaux généralement requis pour les demandes de résidence temporaire.",
        },
        {
            "code": "IMM5476",
            "title_en": "Use of a Representative",
            "title_fr": "Recours aux services d'un représentant",
            "required": False,
            "conditional_rule": "representative_used",
            "description_en": "Required only if the applicant uses a representative.",
            "description_fr": "Requis uniquement si le demandeur utilise un représentant.",
        },
    ],
    "pr_pathway": [
        {
            "code": "PR_INTAKE",
            "title_en": "Permanent Residence Intake Package",
            "title_fr": "Dossier d'admission à la résidence permanente",
            "required": True,
            "conditional_rule": None,
            "description_en": "Core package builder for permanent residence planning and preparation.",
            "description_fr": "Gabarit principal pour la planification et la préparation d'une résidence permanente.",
        },
        {
            "code": "IMM5406",
            "title_en": "Additional Family Information",
            "title_fr": "Renseignements additionnels sur la famille",
            "required": True,
            "conditional_rule": None,
            "description_en": "Family information form for permanent residence pathways.",
            "description_fr": "Formulaire d'information familiale pour les voies de résidence permanente.",
        },
        {
            "code": "IMM5476",
            "title_en": "Use of a Representative",
            "title_fr": "Recours aux services d'un représentant",
            "required": False,
            "conditional_rule": "representative_used",
            "description_en": "Required only if the applicant uses a representative.",
            "description_fr": "Requis uniquement si le demandeur utilise un représentant.",
        },
    ],
}


def normalize_application_type(application_type: str) -> str:
    raw_value = str(application_type or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", raw_value)
    value = re.sub(r"_+", "_", value).strip("_")
    return APPLICATION_TYPE_ALIASES.get(value, value)


def get_supported_application_types(language: str = "en") -> List[Dict[str, str]]:
    lang = "fr" if language == "fr" else "en"
    return [
        {
            "value": item["value"],
            "label": item[lang],
        }
        for item in SUPPORTED_APPLICATION_TYPES
    ]


def get_application_type_label(application_type: str, language: str = "en") -> str:
    lang = "fr" if language == "fr" else "en"
    normalized_type = normalize_application_type(application_type)
    for item in SUPPORTED_APPLICATION_TYPES:
        if item["value"] == normalized_type:
            return item[lang]
    return normalized_type or application_type


def get_forms_for_application_type(application_type: str, language: str = "en") -> List[Dict[str, Any]]:
    lang = "fr" if language == "fr" else "en"
    normalized_type = normalize_application_type(application_type)
    forms = FORMS_CATALOG.get(normalized_type, [])

    normalized: List[Dict[str, Any]] = []
    for form in forms:
        normalized.append(
            {
                "code": form["code"],
                "title": form[f"title_{lang}"],
                "description": form[f"description_{lang}"],
                "required": bool(form["required"]),
                "conditional_rule": form.get("conditional_rule"),
            }
        )
    return normalized
