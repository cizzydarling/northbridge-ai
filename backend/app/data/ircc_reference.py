IRCC_REFERENCE_LAST_REVIEWED = "2026-05-08"

IRCC_REFERENCE_SOURCES = {
    "express_entry_category_selection": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html",
    "noc_2021": "https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1",
}

EXPRESS_ENTRY_CATEGORY_SELECTION = [
    "French-language proficiency",
    "Healthcare and social services occupations",
    "Science, Technology, Engineering and Math (STEM) occupations",
    "Trade occupations",
    "Education occupations",
    "Transport occupations",
    "Physicians with Canadian work experience",
    "Senior managers with Canadian work experience",
    "Researchers with Canadian work experience",
    "Skilled military recruits",
]


def get_ircc_reference_context(language: str = "en") -> str:
    language = "fr" if str(language or "").lower() == "fr" else "en"
    categories = ", ".join(EXPRESS_ENTRY_CATEGORY_SELECTION)

    if language == "fr":
        return (
            f"Reference IRCC/StatCan verifiee le {IRCC_REFERENCE_LAST_REVIEWED}: "
            "Express Entry utilise des rondes generales, propres aux programmes et par categorie. "
            f"Categories IRCC actuelles connues: {categories}. "
            "Pour la categorie de competence en francais, IRCC exige des resultats de test en francais "
            "d'au moins NCLC 7 dans les 4 competences, en plus des instructions de la ronde. "
            "Le systeme CNP utilise la CNP 2021 version 1.0 de Statistique Canada avec des codes a 5 chiffres "
            "et des categories TEER. Ne jamais garantir une invitation, une approbation ou un delai. "
            "Si une question depend de rondes, seuils, instructions ou formulaires recents, recommander de verifier "
            f"la source officielle IRCC: {IRCC_REFERENCE_SOURCES['express_entry_category_selection']}."
        )

    return (
        f"IRCC/StatCan reference reviewed on {IRCC_REFERENCE_LAST_REVIEWED}: "
        "Express Entry uses general, program-specific, and category-based rounds. "
        f"Current known IRCC categories: {categories}. "
        "For the French-language proficiency category, IRCC requires French test results showing at least NCLC 7 "
        "in all 4 language abilities, plus the instructions for that round. "
        "The NOC system uses Statistics Canada's NOC 2021 Version 1.0 with 5-digit codes and TEER categories. "
        "Never guarantee an invitation, approval, or timeline. If a question depends on recent rounds, cutoffs, "
        "instructions, or forms, advise the user to verify the official IRCC source: "
        f"{IRCC_REFERENCE_SOURCES['express_entry_category_selection']}."
    )
