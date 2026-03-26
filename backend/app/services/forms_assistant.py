from typing import Any


def normalize_language(language: str | None) -> str:
    lang = (language or "en").strip().lower()
    return "fr" if lang == "fr" else "en"


def t(en: str, fr: str, language: str) -> str:
    return fr if language == "fr" else en


def yes_no(value: bool, language: str) -> str:
    return t("Yes", "Oui", language) if value else t("No", "Non", language)


def build_study_permit_forms_assistant(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)
    intake = intake or {}

    missing_fields: list[str] = []
    recommended_forms: list[dict[str, Any]] = [
        {
            "form_key": "study_permit_main",
            "form_name": t(
                "Study permit application package",
                "Dossier de demande de permis d’études",
                language,
            ),
            "status": "Primary",
            "notes": t(
                "Primary study permit workflow for the applicant.",
                "Processus principal de demande de permis d’études pour le demandeur.",
                language,
            ),
        },
        {
            "form_key": "family_information",
            "form_name": t(
                "Family information form",
                "Formulaire d’information familiale",
                language,
            ),
            "status": "Supporting",
            "notes": t(
                "Often required where family and background details must be disclosed.",
                "Souvent requis lorsque les renseignements familiaux et biographiques doivent être déclarés.",
                language,
            ),
        },
    ]

    draft_answers = {
        "school_or_dli": intake.get("dli_name") or intake.get("school_name") or "",
        "program_name": intake.get("program_name") or "",
        "intake_term": intake.get("intake_term") or "",
        "tuition_amount": intake.get("tuition_amount") or "",
        "proof_of_funds_available": yes_no(
            intake.get("proof_of_funds_available"), language
        ),
        "previous_refusal": yes_no(intake.get("previous_refusal"), language),
        "accompanying_family": yes_no(intake.get("accompanying_family"), language),
        "passport_valid": yes_no(intake.get("passport_valid"), language),
        "study_gap_explanation": intake.get("gap_in_studies_explanation") or "",
    }

    if not draft_answers["school_or_dli"]:
        missing_fields.append(
            t(
                "School or DLI name",
                "Nom de l’établissement ou de l’EED",
                language,
            )
        )
    if not draft_answers["program_name"]:
        missing_fields.append(t("Program name", "Nom du programme", language))
    if not draft_answers["intake_term"]:
        missing_fields.append(t("Intake term", "Session d’entrée", language))
    if not draft_answers["tuition_amount"]:
        missing_fields.append(
            t("Tuition amount", "Montant des frais de scolarité", language)
        )
    if draft_answers["proof_of_funds_available"] == yes_no(False, language):
        missing_fields.append(
            t("Proof of funds strategy", "Stratégie de preuve de fonds", language)
        )
    if draft_answers["passport_valid"] == yes_no(False, language):
        missing_fields.append(
            t(
                "Passport validity confirmation",
                "Confirmation de la validité du passeport",
                language,
            )
        )

    preparation_notes = [
        t(
            "Review identity, travel, and education details together so the file reads consistently from start to finish.",
            "Revoyez ensemble les renseignements d’identité, de voyage et d’études afin que le dossier soit cohérent du début à la fin.",
            language,
        ),
        t(
            "Make sure the study plan clearly explains school choice, program relevance, and realistic future plans.",
            "Assurez-vous que le projet d’études explique clairement le choix de l’établissement, la pertinence du programme et des objectifs futurs réalistes.",
            language,
        ),
        t(
            "Align proof of funds with tuition amounts and expected living costs so the financial section feels credible.",
            "Alignez la preuve de fonds avec les frais de scolarité et le coût de la vie prévu afin que la section financière soit crédible.",
            language,
        ),
    ]

    if intake.get("previous_refusal"):
        preparation_notes.append(
            t(
                "Prepare a focused refusal-response explanation that addresses earlier concerns directly and calmly.",
                "Préparez une explication ciblée au refus antérieur qui répond directement et clairement aux préoccupations précédentes.",
                language,
            )
        )

    if intake.get("accompanying_family"):
        recommended_forms.append(
            {
                "form_key": "family_member_support",
                "form_name": t(
                    "Accompanying family support package",
                    "Dossier complémentaire pour la famille accompagnante",
                    language,
                ),
                "status": "Conditional",
                "notes": t(
                    "Additional family-related forms and supporting information may be required.",
                    "Des formulaires supplémentaires et des pièces justificatives liées à la famille peuvent être requis.",
                    language,
                ),
            }
        )

    summary = (
        t(
            "The study permit forms package looks well-positioned from the current intake. The next priority should be polish, consistency, and strong supporting evidence.",
            "Le dossier de formulaires de permis d’études paraît bien positionné selon les informations actuelles. La prochaine priorité devrait être la qualité de présentation, la cohérence et la solidité des pièces justificatives.",
            language,
        )
        if len(missing_fields) == 0
        else t(
            "The forms package has a workable base, but several important items still need to be completed or reviewed before it feels submission-ready.",
            "Le dossier de formulaires repose sur une base utilisable, mais plusieurs éléments importants doivent encore être complétés ou vérifiés avant qu’il paraisse prêt à être soumis.",
            language,
        )
    )

    return {
        "matter_type": "study_permit",
        "package_title": t(
            "Study Permit Forms Assistant",
            "Assistant de formulaires – Permis d’études",
            language,
        ),
        "recommended_forms": recommended_forms,
        "draft_answers": draft_answers,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
        "summary": summary,
    }


def build_work_permit_forms_assistant(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)
    intake = intake or {}

    missing_fields: list[str] = []
    recommended_forms: list[dict[str, Any]] = [
        {
            "form_key": "work_permit_main",
            "form_name": t(
                "Work permit application package",
                "Dossier de demande de permis de travail",
                language,
            ),
            "status": "Primary",
            "notes": t(
                "Primary work permit workflow for the applicant.",
                "Processus principal de demande de permis de travail pour le demandeur.",
                language,
            ),
        },
        {
            "form_key": "family_information",
            "form_name": t(
                "Family information form",
                "Formulaire d’information familiale",
                language,
            ),
            "status": "Supporting",
            "notes": t(
                "Often required where family and background details must be disclosed.",
                "Souvent requis lorsque les renseignements familiaux et biographiques doivent être déclarés.",
                language,
            ),
        },
    ]

    permit_type = intake.get("permit_type") or ""

    draft_answers = {
        "permit_type": permit_type,
        "employer_name": intake.get("employer_name") or "",
        "job_title": intake.get("job_title") or "",
        "noc_code": intake.get("noc_code") or "",
        "province_of_work": intake.get("province_of_work") or "",
        "wage": intake.get("wage") or "",
        "current_status_in_canada": intake.get("current_status_in_canada") or "",
        "expires_on": intake.get("expires_on") or "",
        "lmia_available": yes_no(intake.get("lmia_available"), language),
        "open_work_permit_basis": intake.get("open_work_permit_basis") or "",
        "accompanying_family": yes_no(intake.get("accompanying_family"), language),
    }

    if not draft_answers["permit_type"]:
        missing_fields.append(t("Permit type", "Type de permis", language))
    if not draft_answers["job_title"]:
        missing_fields.append(t("Job title", "Titre du poste", language))
    if not draft_answers["current_status_in_canada"]:
        missing_fields.append(
            t("Current status in Canada", "Statut actuel au Canada", language)
        )

    lowered_permit_type = permit_type.lower()

    if "employer" in lowered_permit_type and not draft_answers["employer_name"]:
        missing_fields.append(t("Employer name", "Nom de l’employeur", language))

    if "employer" in lowered_permit_type and draft_answers["lmia_available"] == yes_no(False, language):
        missing_fields.append(
            t("LMIA or exemption confirmation", "Confirmation EIMT ou exemption", language)
        )

    if "open" in lowered_permit_type and not draft_answers["open_work_permit_basis"]:
        missing_fields.append(
            t("Open work permit basis", "Fondement du permis ouvert", language)
        )

    preparation_notes = [
        t(
            "Confirm that the employer, job title, and NOC details remain consistent across all supporting documents.",
            "Confirmez que l’employeur, le titre du poste et les détails du CNP demeurent cohérents dans l’ensemble des pièces justificatives.",
            language,
        ),
        t(
            "Review the applicant’s current immigration status and expiry timeline carefully before finalizing the filing sequence.",
            "Examinez attentivement le statut actuel du demandeur et l’échéancier d’expiration avant de finaliser l’ordre de dépôt.",
            language,
        ),
        t(
            "Confirm early whether the case is LMIA-based or LMIA-exempt so the file strategy is built on the correct procedural basis.",
            "Confirmez tôt si le dossier repose sur une EIMT ou sur une exemption afin de bâtir la stratégie sur le bon fondement procédural.",
            language,
        ),
    ]

    if intake.get("accompanying_family"):
        recommended_forms.append(
          {
              "form_key": "family_member_support",
              "form_name": t(
                  "Accompanying family support package",
                  "Dossier complémentaire pour la famille accompagnante",
                  language,
              ),
              "status": "Conditional",
              "notes": t(
                  "Additional family-related forms and supporting information may be required.",
                  "Des formulaires supplémentaires et des pièces justificatives liées à la famille peuvent être requis.",
                  language,
              ),
          }
        )

    summary = (
        t(
            "The work permit forms package looks well-positioned from the current intake. The next priority should be procedural accuracy and consistency across supporting records.",
            "Le dossier de formulaires de permis de travail paraît bien positionné selon les informations actuelles. La prochaine priorité devrait être la précision procédurale et la cohérence des pièces justificatives.",
            language,
        )
        if len(missing_fields) == 0
        else t(
            "The work permit forms package has a workable base, but several important items still need to be completed or clarified before the file feels strong.",
            "Le dossier de formulaires de permis de travail repose sur une base utilisable, mais plusieurs éléments importants doivent encore être complétés ou clarifiés avant que le dossier paraisse solide.",
            language,
        )
    )

    return {
        "matter_type": "work_permit",
        "package_title": t(
            "Work Permit Forms Assistant",
            "Assistant de formulaires – Permis de travail",
            language,
        ),
        "recommended_forms": recommended_forms,
        "draft_answers": draft_answers,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
        "summary": summary,
    }


def build_spousal_sponsorship_forms_assistant(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)
    intake = intake or {}

    missing_fields: list[str] = []
    recommended_forms: list[dict[str, Any]] = [
        {
            "form_key": "sponsorship_package_main",
            "form_name": t(
                "Spousal sponsorship application package",
                "Dossier principal de parrainage conjugal",
                language,
            ),
            "status": "Primary",
            "notes": t(
                "Primary sponsorship workflow for the sponsor and principal applicant.",
                "Processus principal de parrainage pour le répondant et le demandeur principal.",
                language,
            ),
        },
        {
            "form_key": "relationship_history",
            "form_name": t(
                "Relationship history and evidence package",
                "Dossier d’historique et de preuves de la relation",
                language,
            ),
            "status": "Supporting",
            "notes": t(
                "Used to organize relationship timeline and supporting evidence.",
                "Utilisé pour organiser la chronologie relationnelle et les pièces justificatives.",
                language,
            ),
        },
    ]

    relationship_type = intake.get("relationship_type") or ""

    draft_answers = {
        "sponsor_status": intake.get("sponsor_status") or "",
        "relationship_type": relationship_type,
        "relationship_start_date": intake.get("relationship_start_date") or "",
        "marriage_date": intake.get("marriage_date") or "",
        "cohabiting": yes_no(intake.get("cohabiting"), language),
        "principal_applicant_country": intake.get("principal_applicant_country") or "",
        "dependent_children": yes_no(intake.get("dependent_children"), language),
        "previous_marriage_or_sponsorship": yes_no(
            intake.get("previous_marriage_or_sponsorship"), language
        ),
        "police_certificates_ready": yes_no(
            intake.get("police_certificates_ready"), language
        ),
        "medicals_ready": yes_no(intake.get("medicals_ready"), language),
        "proof_of_relationship_notes": intake.get("proof_of_relationship_notes") or "",
    }

    if not draft_answers["sponsor_status"]:
        missing_fields.append(t("Sponsor status", "Statut du répondant", language))
    if not draft_answers["relationship_type"]:
        missing_fields.append(t("Relationship type", "Type de relation", language))
    if not draft_answers["relationship_start_date"]:
        missing_fields.append(
            t("Relationship start date", "Date de début de la relation", language)
        )
    if "spouse" in relationship_type.lower() and not draft_answers["marriage_date"]:
        missing_fields.append(t("Marriage date", "Date du mariage", language))
    if not draft_answers["proof_of_relationship_notes"]:
        missing_fields.append(
            t("Relationship evidence notes", "Notes sur les preuves relationnelles", language)
        )
    if draft_answers["police_certificates_ready"] == yes_no(False, language):
        missing_fields.append(
            t("Police certificate planning", "Planification des certificats de police", language)
        )
    if draft_answers["medicals_ready"] == yes_no(False, language):
        missing_fields.append(
            t("Medical exam planning", "Planification de l’examen médical", language)
        )

    preparation_notes = [
        t(
            "Ensure the relationship history remains consistent across all forms, declarations, and supporting evidence.",
            "Assurez-vous que l’historique de la relation demeure cohérent dans tous les formulaires, déclarations et éléments de preuve.",
            language,
        ),
        t(
            "Prepare a clear relationship timeline covering communication, visits, cohabitation, and major milestones.",
            "Préparez une chronologie claire de la relation couvrant les communications, les visites, la cohabitation et les étapes importantes.",
            language,
        ),
        t(
            "Review any prior marriage, sponsorship, or dependent child issues carefully so they are documented in a stable and credible way.",
            "Examinez attentivement tout mariage antérieur, historique de parrainage ou question liée aux enfants à charge afin qu’ils soient documentés de façon stable et crédible.",
            language,
        ),
    ]

    if intake.get("dependent_children"):
        recommended_forms.append(
            {
                "form_key": "dependent_children_support",
                "form_name": t(
                    "Dependent children support package",
                    "Dossier complémentaire pour enfants à charge",
                    language,
                ),
                "status": "Conditional",
                "notes": t(
                    "Additional child-related supporting information may be required.",
                    "Des pièces justificatives supplémentaires liées aux enfants peuvent être requises.",
                    language,
                ),
            }
        )

    summary = (
        t(
            "The sponsorship forms package looks well-positioned from the current intake. The next priority should be evidence quality, timeline clarity, and overall credibility.",
            "Le dossier de formulaires de parrainage paraît bien positionné selon les informations actuelles. La prochaine priorité devrait être la qualité des preuves, la clarté chronologique et la crédibilité globale.",
            language,
        )
        if len(missing_fields) == 0
        else t(
            "The sponsorship forms package has a workable base, but several important relationship and procedural details still need to be completed or reinforced.",
            "Le dossier de formulaires de parrainage repose sur une base utilisable, mais plusieurs éléments relationnels et procéduraux importants doivent encore être complétés ou renforcés.",
            language,
        )
    )

    return {
        "matter_type": "spousal_sponsorship",
        "package_title": t(
            "Spousal Sponsorship Forms Assistant",
            "Assistant de formulaires – Parrainage du conjoint",
            language,
        ),
        "recommended_forms": recommended_forms,
        "draft_answers": draft_answers,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
        "summary": summary,
    }


def build_forms_assistant(
    matter_type: str | None,
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)

    if matter_type == "study_permit":
        return build_study_permit_forms_assistant(intake, language)

    if matter_type == "work_permit":
        return build_work_permit_forms_assistant(intake, language)

    if matter_type == "spousal_sponsorship":
        return build_spousal_sponsorship_forms_assistant(intake, language)

    return {
        "matter_type": matter_type or "unknown",
        "package_title": t("Forms Assistant", "Assistant de formulaires", language),
        "recommended_forms": [],
        "draft_answers": {},
        "missing_fields": [
            t(
                "Forms assistant has not been built for this matter type yet.",
                "L’assistant de formulaires n’a pas encore été créé pour ce type de dossier.",
                language,
            )
        ],
        "preparation_notes": [],
        "summary": t(
            "No forms assistant is available for this matter type yet.",
            "Aucun assistant de formulaires n’est encore disponible pour ce type de dossier.",
            language,
        ),
    }