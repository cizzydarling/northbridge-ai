from typing import Any


def normalize_language(language: str | None) -> str:
    lang = (language or "en").strip().lower()
    return "fr" if lang == "fr" else "en"


def t(en: str, fr: str, language: str) -> str:
    return fr if language == "fr" else en


def _build_default_result(matter_type: str | None, language: str) -> dict[str, Any]:
    return {
        "matter_type": matter_type or "unknown",
        "score": 0,
        "readiness": t("Weak", "Faible", language),
        "strengths": [],
        "concerns": [],
        "next_steps": [],
        "category_hints": [],
        "summary": t(
            "This application type is not yet supported by the current eligibility engine.",
            "Ce type de demande n’est pas encore pris en charge par le moteur d’évaluation actuel.",
            language,
        ),
    }


def evaluate_study_permit_eligibility(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)
    intake = intake or {}

    score = 0
    strengths: list[str] = []
    concerns: list[str] = []
    next_steps: list[str] = []
    category_hints: list[str] = []

    if intake.get("dli_name") or intake.get("school_name"):
        score += 15
        strengths.append(
            t(
                "A school or designated learning institution has already been identified, which gives the file a stronger practical foundation.",
                "Un établissement ou un établissement d’enseignement désigné a déjà été identifié, ce qui donne au dossier une base plus solide.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The target school or designated learning institution is still unclear, which makes the application plan less stable.",
                "L’établissement visé n’est pas encore clairement défini, ce qui rend la stratégie de demande moins stable.",
                language,
            )
        )
        next_steps.append(
            t(
                "Confirm the school or DLI before moving further into document preparation.",
                "Confirmez l’établissement avant d’aller plus loin dans la préparation des documents.",
                language,
            )
        )

    if intake.get("program_name"):
        score += 10
        strengths.append(
            t(
                "The intended program is identified, which helps position the study plan more clearly.",
                "Le programme visé est identifié, ce qui aide à structurer le projet d’études plus clairement.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The program name is missing, which weakens the clarity of the study objective.",
                "Le nom du programme est manquant, ce qui affaiblit la clarté de l’objectif d’études.",
                language,
            )
        )
        next_steps.append(
            t(
                "Add the intended program name and confirm the level of studies.",
                "Ajoutez le nom du programme prévu et confirmez le niveau d’études.",
                language,
            )
        )

    if intake.get("intake_term"):
        score += 8
        strengths.append(
            t(
                "An intake term is already identified, which supports better planning and timing.",
                "Une session d’entrée est déjà identifiée, ce qui améliore la planification et l’échéancier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The intake term is not yet confirmed, which creates timing uncertainty in the file.",
                "La session d’entrée n’est pas encore confirmée, ce qui crée de l’incertitude dans le dossier.",
                language,
            )
        )
        next_steps.append(
            t(
                "Confirm the intended intake term and align it with document preparation timelines.",
                "Confirmez la session d’entrée et alignez-la avec le calendrier de préparation des documents.",
                language,
            )
        )

    if intake.get("tuition_amount"):
        score += 8
        strengths.append(
            t(
                "Tuition information is already available, which helps frame the financial side of the application.",
                "Les frais de scolarité sont déjà connus, ce qui aide à structurer la partie financière de la demande.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Tuition details are missing, which makes financial preparation less complete.",
                "Les frais de scolarité sont manquants, ce qui rend la préparation financière moins complète.",
                language,
            )
        )
        next_steps.append(
            t(
                "Collect tuition details or the fee statement so the financial plan can be assessed properly.",
                "Obtenez les frais de scolarité ou le relevé des frais afin d’évaluer correctement le plan financier.",
                language,
            )
        )

    if intake.get("proof_of_funds_available"):
        score += 18
        strengths.append(
            t(
                "Proof of funds appears to be available, which is one of the strongest practical indicators in the current file.",
                "La preuve de fonds semble disponible, ce qui est l’un des indicateurs les plus solides dans le dossier actuel.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Proof of funds is not yet confirmed, which is a major weakness for study permit preparation.",
                "La preuve de fonds n’est pas encore confirmée, ce qui constitue une faiblesse importante pour la préparation du permis d’études.",
                language,
            )
        )
        next_steps.append(
            t(
                "Build a clear funding strategy and gather supporting financial evidence early.",
                "Établissez une stratégie financière claire et rassemblez rapidement les preuves financières nécessaires.",
                language,
            )
        )

    if intake.get("passport_valid"):
        score += 12
        strengths.append(
            t(
                "Passport validity appears confirmed, which reduces a common procedural risk.",
                "La validité du passeport semble confirmée, ce qui réduit un risque procédural fréquent.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Passport validity is not yet confirmed, which should be reviewed before the file moves further.",
                "La validité du passeport n’est pas encore confirmée et devrait être vérifiée avant d’aller plus loin.",
                language,
            )
        )
        next_steps.append(
            t(
                "Review passport validity and renewal timing before finalizing the application plan.",
                "Vérifiez la validité du passeport et le besoin éventuel de renouvellement avant de finaliser la stratégie.",
                language,
            )
        )

    if intake.get("sds_eligible"):
        score += 10
        strengths.append(
            t(
                "The file may benefit from SDS-style preparation, which can support a cleaner structure when eligibility is confirmed.",
                "Le dossier pourrait bénéficier d’une préparation de type VDE, ce qui peut appuyer une structure plus claire si l’admissibilité est confirmée.",
                language,
            )
        )
        category_hints.append(
            t(
                "SDS review may be relevant.",
                "Une analyse de l’admissibilité au VDE peut être pertinente.",
                language,
            )
        )
    else:
        category_hints.append(
            t(
                "Regular study permit preparation may be more appropriate.",
                "Une préparation régulière de permis d’études pourrait être plus appropriée.",
                language,
            )
        )

    if intake.get("previous_refusal"):
        score -= 12
        concerns.append(
            t(
                "A previous refusal increases the sensitivity of the file and calls for more careful positioning.",
                "Un refus antérieur rend le dossier plus sensible et exige un positionnement plus rigoureux.",
                language,
            )
        )
        next_steps.append(
            t(
                "Prepare a focused explanation that directly addresses the concerns raised in the previous refusal, if known.",
                "Préparez une explication ciblée qui répond directement aux préoccupations soulevées lors du refus antérieur, si elles sont connues.",
                language,
            )
        )

    gap_explanation = str(intake.get("gap_in_studies_explanation") or "").strip()
    if gap_explanation:
        score += 6
        strengths.append(
            t(
                "A study gap explanation is already available, which helps reduce uncertainty in the applicant’s timeline.",
                "Une explication de l’interruption d’études est déjà disponible, ce qui aide à réduire l’incertitude dans le parcours du demandeur.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "No study gap explanation is recorded yet, which may leave timeline questions unanswered.",
                "Aucune explication de l’interruption d’études n’est encore fournie, ce qui peut laisser des zones d’ombre dans le parcours.",
                language,
            )
        )
        next_steps.append(
            t(
                "Review the education and work timeline and prepare a short explanation for any gaps.",
                "Examinez le parcours scolaire et professionnel et préparez une explication concise pour toute interruption.",
                language,
            )
        )

    if intake.get("accompanying_family"):
        score -= 2
        category_hints.append(
            t(
                "Accompanying family members may increase document complexity.",
                "La présence de membres de la famille accompagnants peut augmenter la complexité documentaire.",
                language,
            )
        )
        next_steps.append(
            t(
                "Prepare relationship, identity, and status documents for accompanying family members.",
                "Préparez les documents d’identité, de statut et de relation pour les membres de la famille accompagnants.",
                language,
            )
        )

    readiness_key = "Weak"
    if score >= 65:
        readiness_key = "Strong"
    elif score >= 40:
        readiness_key = "Moderate"

    readiness = {
        "Strong": t("Strong", "Fort", language),
        "Moderate": t("Moderate", "Modéré", language),
        "Weak": t("Weak", "Faible", language),
    }[readiness_key]

    if not next_steps:
        next_steps.append(
            t(
                "Review all supporting documents together to confirm they tell a consistent story.",
                "Revoyez l’ensemble des documents justificatifs pour confirmer qu’ils présentent un dossier cohérent.",
                language,
            )
        )

    summary = {
        "Strong": t(
            "The current study permit profile looks well-positioned. The file already shows several practical strengths, and the next stage should focus on consistency, document quality, and strong presentation.",
            "Le profil actuel de permis d’études paraît bien positionné. Le dossier présente déjà plusieurs points forts, et la prochaine étape devrait viser la cohérence, la qualité documentaire et une présentation convaincante.",
            language,
        ),
        "Moderate": t(
            "The study permit file has a workable foundation, but it still needs targeted strengthening before it feels fully convincing. The focus should be on documentation gaps, financial clarity, and file consistency.",
            "Le dossier de permis d’études repose sur une base utilisable, mais il nécessite encore des améliorations ciblées avant d’être vraiment convaincant. L’accent devrait être mis sur les lacunes documentaires, la clarté financière et la cohérence du dossier.",
            language,
        ),
        "Weak": t(
            "The study permit file is still at an early preparation stage. Before treating it as submission-ready, the priority should be to stabilize the school, funding, and supporting timeline elements.",
            "Le dossier de permis d’études est encore à un stade préliminaire de préparation. Avant de le considérer comme prêt à être soumis, la priorité devrait être de stabiliser les éléments liés à l’établissement, au financement et au parcours du demandeur.",
            language,
        ),
    }[readiness_key]

    return {
        "matter_type": "study_permit",
        "score": max(score, 0),
        "readiness": readiness,
        "strengths": strengths,
        "concerns": concerns,
        "next_steps": next_steps,
        "category_hints": category_hints,
        "summary": summary,
    }


def evaluate_work_permit_eligibility(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)
    intake = intake or {}

    score = 0
    strengths: list[str] = []
    concerns: list[str] = []
    next_steps: list[str] = []
    category_hints: list[str] = []

    permit_type = str(intake.get("permit_type") or "").strip()
    lowered_permit_type = permit_type.lower()

    if permit_type:
        score += 12
        strengths.append(
            t(
                "The work permit type is already identified, which gives the case better procedural direction.",
                "Le type de permis de travail est déjà identifié, ce qui donne une meilleure direction procédurale au dossier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The work permit type is still unclear, which makes the file harder to structure correctly.",
                "Le type de permis de travail n’est pas encore clair, ce qui rend le dossier plus difficile à structurer correctement.",
                language,
            )
        )
        next_steps.append(
            t(
                "Clarify whether the case is employer-specific or open work permit based.",
                "Précisez s’il s’agit d’un permis lié à un employeur ou d’un permis de travail ouvert.",
                language,
            )
        )

    if intake.get("job_title"):
        score += 10
        strengths.append(
            t(
                "The job title is available, which helps frame the work-related purpose of the file.",
                "Le titre du poste est disponible, ce qui aide à cadrer l’objectif professionnel du dossier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The job title is missing, which weakens the clarity of the employment context.",
                "Le titre du poste est manquant, ce qui affaiblit la clarté du contexte d’emploi.",
                language,
            )
        )
        next_steps.append(
            t(
                "Confirm the job title and make sure it aligns with the intended role and supporting documents.",
                "Confirmez le titre du poste et assurez-vous qu’il correspond au rôle visé et aux documents justificatifs.",
                language,
            )
        )

    if intake.get("current_status_in_canada"):
        score += 12
        strengths.append(
            t(
                "The applicant’s current status in Canada is recorded, which helps with timing and procedural planning.",
                "Le statut actuel du demandeur au Canada est indiqué, ce qui aide à la planification procédurale et des délais.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The applicant’s current status in Canada is not yet recorded, which creates uncertainty around timing and eligibility pathways.",
                "Le statut actuel du demandeur au Canada n’est pas encore indiqué, ce qui crée de l’incertitude quant aux délais et aux voies possibles.",
                language,
            )
        )
        next_steps.append(
            t(
                "Confirm the applicant’s current immigration status in Canada before finalizing the work permit strategy.",
                "Confirmez le statut d’immigration actuel du demandeur au Canada avant de finaliser la stratégie de permis de travail.",
                language,
            )
        )

    if "employer" in lowered_permit_type:
        category_hints.append(
            t(
                "Employer-specific work permit review may apply.",
                "Une analyse de permis de travail lié à un employeur peut s’appliquer.",
                language,
            )
        )

        if intake.get("employer_name"):
            score += 10
            strengths.append(
                t(
                    "The employer is identified, which supports a more concrete work permit structure.",
                    "L’employeur est identifié, ce qui soutient une structure de permis de travail plus concrète.",
                    language,
                )
            )
        else:
            concerns.append(
                t(
                    "The employer name is missing, which leaves the file incomplete for an employer-specific pathway.",
                    "Le nom de l’employeur est manquant, ce qui rend le dossier incomplet pour une voie liée à un employeur.",
                    language,
                )
            )
            next_steps.append(
                t(
                    "Confirm the employer name and align it with the job offer or supporting records.",
                    "Confirmez le nom de l’employeur et alignez-le avec l’offre d’emploi ou les pièces justificatives.",
                    language,
                )
            )

        if intake.get("lmia_available"):
            score += 16
            strengths.append(
                t(
                    "LMIA-related information appears available, which strengthens the file materially where required.",
                    "Les informations liées à l’EIMT semblent disponibles, ce qui renforce concrètement le dossier lorsque requis.",
                    language,
                )
            )
        else:
            concerns.append(
                t(
                    "LMIA or exemption support is not yet confirmed, which may be a significant gap depending on the work permit type.",
                    "Le soutien lié à l’EIMT ou à une exemption n’est pas encore confirmé, ce qui peut constituer une lacune importante selon le type de permis.",
                    language,
                )
            )
            next_steps.append(
                t(
                    "Confirm whether the case depends on an LMIA or a valid LMIA exemption route.",
                    "Confirmez si le dossier dépend d’une EIMT ou d’une exemption valide.",
                    language,
                )
            )

    if "open" in lowered_permit_type:
        category_hints.append(
            t(
                "Open work permit review may apply.",
                "Une analyse de permis de travail ouvert peut s’appliquer.",
                language,
            )
        )

        if intake.get("open_work_permit_basis"):
            score += 16
            strengths.append(
                t(
                    "The basis for the open work permit is already identified, which improves strategic clarity.",
                    "Le fondement du permis de travail ouvert est déjà identifié, ce qui améliore la clarté stratégique.",
                    language,
                )
            )
        else:
            concerns.append(
                t(
                    "The basis for the open work permit is not yet recorded, which leaves the case too open-ended.",
                    "Le fondement du permis de travail ouvert n’est pas encore indiqué, ce qui laisse le dossier trop vague.",
                    language,
                )
            )
            next_steps.append(
                t(
                    "Clarify the legal or procedural basis for the open work permit route.",
                    "Précisez le fondement juridique ou procédural du permis de travail ouvert.",
                    language,
                )
            )

    if intake.get("noc_code"):
        score += 8
        strengths.append(
            t(
                "A NOC code is already recorded, which helps position the role more accurately.",
                "Un code CNP est déjà indiqué, ce qui aide à positionner le poste plus précisément.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The NOC code is missing, which weakens role classification and document alignment.",
                "Le code CNP est manquant, ce qui affaiblit la classification du poste et l’alignement documentaire.",
                language,
            )
        )
        next_steps.append(
            t(
                "Identify the correct NOC code for the role before final review.",
                "Identifiez le bon code CNP pour le poste avant la révision finale.",
                language,
            )
        )

    if intake.get("province_of_work"):
        score += 6
        strengths.append(
            t(
                "The province of work is identified, which supports better case framing.",
                "La province de travail est identifiée, ce qui aide à mieux cadrer le dossier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The province of work is not yet recorded.",
                "La province de travail n’est pas encore indiquée.",
                language,
            )
        )

    if intake.get("wage"):
        score += 6
        strengths.append(
            t(
                "Wage details are available, which helps assess consistency with the role.",
                "Les détails salariaux sont disponibles, ce qui aide à évaluer la cohérence avec le poste.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Wage details are missing.",
                "Les détails salariaux sont manquants.",
                language,
            )
        )

    if intake.get("expires_on"):
        score += 5
        strengths.append(
            t(
                "Status expiry timing is recorded, which helps prioritize the file appropriately.",
                "La date d’expiration du statut est indiquée, ce qui aide à prioriser le dossier correctement.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The status expiry date is not yet recorded.",
                "La date d’expiration du statut n’est pas encore indiquée.",
                language,
            )
        )
        next_steps.append(
            t(
                "Confirm the current status expiry date and work backward from that timeline.",
                "Confirmez la date d’expiration du statut actuel et planifiez la suite en conséquence.",
                language,
            )
        )

    if intake.get("accompanying_family"):
        score -= 2
        category_hints.append(
            t(
                "Accompanying family members may increase document complexity.",
                "La présence de membres de la famille accompagnants peut augmenter la complexité documentaire.",
                language,
            )
        )
        next_steps.append(
            t(
                "Prepare supporting family identity, relationship, and status documentation.",
                "Préparez les documents familiaux liés à l’identité, à la relation et au statut.",
                language,
            )
        )

    readiness_key = "Weak"
    if score >= 65:
        readiness_key = "Strong"
    elif score >= 40:
        readiness_key = "Moderate"

    readiness = {
        "Strong": t("Strong", "Fort", language),
        "Moderate": t("Moderate", "Modéré", language),
        "Weak": t("Weak", "Faible", language),
    }[readiness_key]

    if not next_steps:
        next_steps.append(
            t(
                "Review the work permit record as a whole to confirm employer, role, and status details are aligned.",
                "Revoyez le dossier dans son ensemble pour confirmer que l’employeur, le poste et le statut sont bien alignés.",
                language,
            )
        )

    summary = {
        "Strong": t(
            "The work permit file looks well-structured from the current intake. The main focus now should be consistency, supporting evidence, and procedural precision.",
            "Le dossier de permis de travail paraît bien structuré selon les informations actuelles. L’accent devrait maintenant être mis sur la cohérence, les preuves justificatives et la précision procédurale.",
            language,
        ),
        "Moderate": t(
            "The work permit file has a workable foundation, but some key confirmations are still needed before the case feels well-positioned.",
            "Le dossier de permis de travail repose sur une base utilisable, mais certaines confirmations importantes sont encore nécessaires avant qu’il paraisse bien positionné.",
            language,
        ),
        "Weak": t(
            "The work permit file still needs more structure before it appears ready for a strong preparation phase.",
            "Le dossier de permis de travail nécessite encore davantage de structure avant d’entrer dans une phase de préparation solide.",
            language,
        ),
    }[readiness_key]

    return {
        "matter_type": "work_permit",
        "score": max(score, 0),
        "readiness": readiness,
        "strengths": strengths,
        "concerns": concerns,
        "next_steps": next_steps,
        "category_hints": category_hints,
        "summary": summary,
    }


def evaluate_spousal_sponsorship_eligibility(
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)
    intake = intake or {}

    score = 0
    strengths: list[str] = []
    concerns: list[str] = []
    next_steps: list[str] = []
    category_hints: list[str] = []

    relationship_type = str(intake.get("relationship_type") or "").strip()
    lowered_relationship_type = relationship_type.lower()

    if intake.get("sponsor_status"):
        score += 15
        strengths.append(
            t(
                "The sponsor’s status is already recorded, which strengthens the legal foundation of the file.",
                "Le statut du répondant est déjà indiqué, ce qui renforce la base juridique du dossier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The sponsor’s status is not yet confirmed, which is a core issue for sponsorship preparation.",
                "Le statut du répondant n’est pas encore confirmé, ce qui constitue un enjeu central pour la préparation du parrainage.",
                language,
            )
        )
        next_steps.append(
            t(
                "Confirm whether the sponsor is a Canadian citizen or permanent resident.",
                "Confirmez si le répondant est citoyen canadien ou résident permanent.",
                language,
            )
        )

    if relationship_type:
        score += 10
        strengths.append(
            t(
                "The relationship type is identified, which helps organize the file correctly.",
                "Le type de relation est identifié, ce qui aide à organiser correctement le dossier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The relationship type is missing, which limits how clearly the sponsorship pathway can be framed.",
                "Le type de relation est manquant, ce qui limite la clarté du cadre du parrainage.",
                language,
            )
        )
        next_steps.append(
            t(
                "Clarify whether the relationship is spousal or common-law.",
                "Précisez s’il s’agit d’une relation conjugale ou d’union de fait.",
                language,
            )
        )

    if intake.get("relationship_start_date"):
        score += 10
        strengths.append(
            t(
                "The relationship start date is available, which supports timeline consistency.",
                "La date de début de la relation est disponible, ce qui soutient la cohérence chronologique.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "The relationship start date is missing, which weakens the timeline narrative.",
                "La date de début de la relation est manquante, ce qui affaiblit le récit chronologique.",
                language,
            )
        )
        next_steps.append(
            t(
                "Add the relationship start date and align it with the supporting evidence timeline.",
                "Ajoutez la date de début de la relation et alignez-la avec la chronologie des preuves.",
                language,
            )
        )

    if "spouse" in lowered_relationship_type:
        category_hints.append(
            t(
                "Spousal sponsorship review may apply.",
                "Une analyse de parrainage conjugal peut s’appliquer.",
                language,
            )
        )
        if intake.get("marriage_date"):
            score += 10
            strengths.append(
                t(
                    "The marriage date is recorded, which supports the documentary timeline.",
                    "La date du mariage est indiquée, ce qui soutient la chronologie documentaire.",
                    language,
                )
            )
        else:
            concerns.append(
                t(
                    "The marriage date is missing, which leaves a key documentary gap for a spousal case.",
                    "La date du mariage est manquante, ce qui laisse une lacune documentaire importante pour un dossier conjugal.",
                    language,
                )
            )
            next_steps.append(
                t(
                    "Confirm the marriage date and gather the marriage certificate.",
                    "Confirmez la date du mariage et obtenez le certificat de mariage.",
                    language,
                )
            )

    if "common" in lowered_relationship_type:
        category_hints.append(
            t(
                "Common-law sponsorship review may apply.",
                "Une analyse de parrainage en union de fait peut s’appliquer.",
                language,
            )
        )
        if intake.get("cohabiting"):
            score += 10
            strengths.append(
                t(
                    "Cohabitation is indicated, which supports a stronger common-law narrative.",
                    "La cohabitation est indiquée, ce qui renforce la démonstration d’une union de fait.",
                    language,
                )
            )
        else:
            concerns.append(
                t(
                    "Cohabitation is not clearly confirmed, which may weaken a common-law position.",
                    "La cohabitation n’est pas clairement confirmée, ce qui peut fragiliser une position d’union de fait.",
                    language,
                )
            )
            next_steps.append(
                t(
                    "Prepare strong documentary evidence of cohabitation and shared life history.",
                    "Préparez des preuves documentaires solides de cohabitation et de vie commune.",
                    language,
                )
            )

    if intake.get("proof_of_relationship_notes"):
        score += 15
        strengths.append(
            t(
                "Relationship evidence planning is already underway, which is a strong sign for file organization.",
                "La planification des preuves relationnelles est déjà amorcée, ce qui est un bon signe pour l’organisation du dossier.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Relationship evidence planning is still missing, which leaves a major part of the sponsorship case underdeveloped.",
                "La planification des preuves relationnelles est encore absente, ce qui laisse une partie majeure du dossier insuffisamment développée.",
                language,
            )
        )
        next_steps.append(
            t(
                "Prepare a relationship timeline and a clear evidence plan before moving forward.",
                "Préparez une chronologie de la relation et un plan clair de preuves avant d’avancer.",
                language,
            )
        )

    if intake.get("police_certificates_ready"):
        score += 8
        strengths.append(
            t(
                "Police certificate planning appears to be in place.",
                "La planification des certificats de police semble en place.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Police certificate planning is not yet ready.",
                "La planification des certificats de police n’est pas encore prête.",
                language,
            )
        )
        next_steps.append(
            t(
                "Plan police certificate collection early to avoid timing pressure later.",
                "Planifiez tôt la collecte des certificats de police pour éviter une pression de délais plus tard.",
                language,
            )
        )

    if intake.get("medicals_ready"):
        score += 8
        strengths.append(
            t(
                "Medical exam preparation appears to be in place.",
                "La préparation de l’examen médical semble en place.",
                language,
            )
        )
    else:
        concerns.append(
            t(
                "Medical exam planning is still needed.",
                "La planification de l’examen médical est encore nécessaire.",
                language,
            )
        )
        next_steps.append(
            t(
                "Plan the medical exam timing carefully within the wider sponsorship workflow.",
                "Planifiez soigneusement le moment de l’examen médical dans l’ensemble du processus de parrainage.",
                language,
            )
        )

    if intake.get("dependent_children"):
        score -= 2
        category_hints.append(
            t(
                "Dependent children may increase documentary complexity.",
                "La présence d’enfants à charge peut augmenter la complexité documentaire.",
                language,
            )
        )
        next_steps.append(
            t(
                "Prepare child-related identity, custody, and relationship documents where relevant.",
                "Préparez les documents liés à l’identité, à la garde et à la relation des enfants, au besoin.",
                language,
            )
        )

    if intake.get("previous_marriage_or_sponsorship"):
        score -= 5
        concerns.append(
            t(
                "Previous marriage or sponsorship history may require more careful review and documentation.",
                "Un historique de mariage ou de parrainage antérieur peut nécessiter une analyse et une documentation plus rigoureuses.",
                language,
            )
        )
        next_steps.append(
            t(
                "Prepare supporting records related to prior marriage or sponsorship history.",
                "Préparez les documents justificatifs liés aux mariages ou parrainages antérieurs.",
                language,
            )
        )

    if intake.get("principal_applicant_country"):
        score += 4
        strengths.append(
            t(
                "The principal applicant’s country is recorded, which supports more grounded file planning.",
                "Le pays du demandeur principal est indiqué, ce qui aide à une planification plus concrète du dossier.",
                language,
            )
        )

    readiness_key = "Weak"
    if score >= 65:
        readiness_key = "Strong"
    elif score >= 40:
        readiness_key = "Moderate"

    readiness = {
        "Strong": t("Strong", "Fort", language),
        "Moderate": t("Moderate", "Modéré", language),
        "Weak": t("Weak", "Faible", language),
    }[readiness_key]

    if not next_steps:
        next_steps.append(
            t(
                "Review identity, relationship, and timeline evidence together to ensure the file presents a consistent narrative.",
                "Revoyez ensemble les preuves d’identité, de relation et de chronologie afin que le dossier présente un récit cohérent.",
                language,
            )
        )

    summary = {
        "Strong": t(
            "The sponsorship file looks well-positioned from the current intake. The strongest next step is to preserve consistency and present the relationship evidence with clarity and credibility.",
            "Le dossier de parrainage paraît bien positionné selon les informations actuelles. La prochaine étape la plus importante est de préserver la cohérence et de présenter les preuves relationnelles avec clarté et crédibilité.",
            language,
        ),
        "Moderate": t(
            "The sponsorship case has a workable structure, but several parts still need stronger preparation before the file feels fully persuasive.",
            "Le dossier de parrainage repose sur une structure utilisable, mais plusieurs éléments nécessitent encore une meilleure préparation avant qu’il soit pleinement convaincant.",
            language,
        ),
        "Weak": t(
            "The sponsorship file is still in an early preparation stage. The priority should be to stabilize relationship evidence, timeline clarity, and supporting records before treating the case as strong.",
            "Le dossier de parrainage est encore à un stade préliminaire de préparation. La priorité devrait être de stabiliser les preuves relationnelles, la clarté chronologique et les pièces justificatives avant de considérer le dossier comme solide.",
            language,
        ),
    }[readiness_key]

    return {
        "matter_type": "spousal_sponsorship",
        "score": max(score, 0),
        "readiness": readiness,
        "strengths": strengths,
        "concerns": concerns,
        "next_steps": next_steps,
        "category_hints": category_hints,
        "summary": summary,
    }


def evaluate_matter_eligibility(
    matter_type: str | None,
    intake: dict[str, Any] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)

    if matter_type == "study_permit":
        return evaluate_study_permit_eligibility(intake, language)

    if matter_type == "work_permit":
        return evaluate_work_permit_eligibility(intake, language)

    if matter_type == "spousal_sponsorship":
        return evaluate_spousal_sponsorship_eligibility(intake, language)

    return _build_default_result(matter_type, language)