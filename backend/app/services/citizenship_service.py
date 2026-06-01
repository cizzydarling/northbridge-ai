from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.citizenship_models import (
    CitizenshipAnswer,
    CitizenshipQuestion,
    CitizenshipQuizAttempt,
    LanguagePracticeSession,
)


STUDY_SECTIONS = [
    {
        "key": "rights_responsibilities",
        "title_en": "Rights and responsibilities",
        "title_fr": "Droits et responsabilités",
        "summary_en": "Review democratic rights, legal responsibilities, voting, and civic participation.",
        "summary_fr": "Révisez les droits démocratiques, les responsabilités, le vote et la participation civique.",
    },
    {
        "key": "history_symbols",
        "title_en": "History and symbols",
        "title_fr": "Histoire et symboles",
        "summary_en": "Practice key ideas about Canadian history, identity, symbols, and institutions.",
        "summary_fr": "Pratiquez les notions sur l'histoire, l'identité, les symboles et les institutions.",
    },
    {
        "key": "government",
        "title_en": "Government and elections",
        "title_fr": "Gouvernement et élections",
        "summary_en": "Understand Parliament, federalism, elections, and how representatives are chosen.",
        "summary_fr": "Comprenez le Parlement, le fédéralisme, les élections et le choix des représentants.",
    },
    {
        "key": "geography_economy",
        "title_en": "Geography and economy",
        "title_fr": "Géographie et économie",
        "summary_en": "Study provinces, territories, regions, natural resources, and the economy.",
        "summary_fr": "Étudiez les provinces, territoires, régions, ressources naturelles et l'économie.",
    },
]


SAMPLE_QUESTIONS = [
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which of the following is a responsibility of Canadian citizens?",
        "question_text_fr": "Laquelle des options suivantes est une responsabilité des citoyens canadiens?",
        "options_en": ["Serving on a jury when called", "Choosing the Governor General", "Writing federal laws", "Appointing senators"],
        "options_fr": ["Servir dans un jury si convoqué", "Choisir le gouverneur général", "Rédiger les lois fédérales", "Nommer les sénateurs"],
        "correct_option_index": 0,
        "explanation_en": "Citizens may be called for jury duty and are expected to participate in the justice system.",
        "explanation_fr": "Les citoyens peuvent être convoqués comme jurés et doivent participer au système de justice.",
    },
    {
        "section": "government",
        "question_text_en": "Who do Canadians vote for in a federal election?",
        "question_text_fr": "Pour qui les Canadiens votent-ils lors d'une élection fédérale?",
        "options_en": ["A Member of Parliament", "The King", "A Supreme Court judge", "The Governor General"],
        "options_fr": ["Un député", "Le roi", "Un juge de la Cour suprême", "Le gouverneur général"],
        "correct_option_index": 0,
        "explanation_en": "In a federal election, voters choose a Member of Parliament for their riding.",
        "explanation_fr": "Lors d'une élection fédérale, les électeurs choisissent un député pour leur circonscription.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What does the maple leaf commonly symbolize?",
        "question_text_fr": "Que symbolise souvent la feuille d'érable?",
        "options_en": ["Canada", "Only one province", "The Senate", "The court system"],
        "options_fr": ["Le Canada", "Une seule province", "Le Sénat", "Le système judiciaire"],
        "correct_option_index": 0,
        "explanation_en": "The maple leaf is one of Canada's best-known national symbols.",
        "explanation_fr": "La feuille d'érable est l'un des symboles nationaux les plus connus du Canada.",
    },
    {
        "section": "geography_economy",
        "question_text_en": "How many provinces does Canada have?",
        "question_text_fr": "Combien de provinces le Canada compte-t-il?",
        "options_en": ["10", "3", "13", "50"],
        "options_fr": ["10", "3", "13", "50"],
        "correct_option_index": 0,
        "explanation_en": "Canada has 10 provinces and 3 territories.",
        "explanation_fr": "Le Canada compte 10 provinces et 3 territoires.",
    },
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which right is protected in Canada?",
        "question_text_fr": "Quel droit est protégé au Canada?",
        "options_en": ["Freedom of expression", "The right to ignore all laws", "The right to appoint judges", "The right to avoid taxes"],
        "options_fr": ["La liberté d'expression", "Le droit d'ignorer toutes les lois", "Le droit de nommer les juges", "Le droit d'éviter les impôts"],
        "correct_option_index": 0,
        "explanation_en": "Freedom of expression is a fundamental freedom protected in Canada.",
        "explanation_fr": "La liberté d'expression est une liberté fondamentale protégée au Canada.",
    },
    {
        "section": "government",
        "question_text_en": "What are the three levels of government in Canada?",
        "question_text_fr": "Quels sont les trois ordres de gouvernement au Canada?",
        "options_en": ["Federal, provincial or territorial, and municipal", "Royal, military, and local", "Senate, court, and police", "National, private, and public"],
        "options_fr": ["Fédéral, provincial ou territorial, et municipal", "Royal, militaire et local", "Sénat, tribunal et police", "National, privé et public"],
        "correct_option_index": 0,
        "explanation_en": "Canada has federal, provincial or territorial, and municipal levels of government.",
        "explanation_fr": "Le Canada a des gouvernements fédéral, provinciaux ou territoriaux, et municipaux.",
    },
]


LANGUAGE_PROMPTS = {
    "en": [
        "Introduce yourself and explain why you want to become a Canadian citizen.",
        "Describe one responsibility of citizenship in your own words.",
        "Explain a recent community activity you joined or would like to join.",
    ],
    "fr": [
        "Présentez-vous et expliquez pourquoi vous voulez devenir citoyen canadien.",
        "Décrivez une responsabilité de la citoyenneté avec vos propres mots.",
        "Expliquez une activité communautaire récente ou une activité que vous aimeriez faire.",
    ],
}


def normalize_language(language: str | None) -> str:
    return "fr" if str(language or "").lower().startswith("fr") else "en"


FRENCH_TEXT_REPLACEMENTS = {
    "Ã©": "\u00e9",
    "Ã¨": "\u00e8",
    "Ãª": "\u00ea",
    "Ã´": "\u00f4",
    "Ã‰": "\u00c9",
    "Ã ": "\u00e0",
    "Ã§": "\u00e7",
    "citoyennete": "citoyennet\u00e9",
    "responsabilites": "responsabilit\u00e9s",
    "responsabilite": "responsabilit\u00e9",
    "democratiques": "d\u00e9mocratiques",
    "Revisez": "R\u00e9visez",
    "federalisme": "f\u00e9d\u00e9ralisme",
    "federale": "f\u00e9d\u00e9rale",
    "federales": "f\u00e9d\u00e9rales",
    "federal": "f\u00e9d\u00e9ral",
    "representants": "repr\u00e9sentants",
    "elections": "\u00e9lections",
    "Geographie": "G\u00e9ographie",
    "economie": "\u00e9conomie",
    "Etudiez": "\u00c9tudiez",
    "regions": "r\u00e9gions",
    "identite": "identit\u00e9",
    "convoque": "convoqu\u00e9",
    "general": "g\u00e9n\u00e9ral",
    "Rediger": "R\u00e9diger",
    "senateurs": "s\u00e9nateurs",
    "etre": "\u00eatre",
    "convoques": "convoqu\u00e9s",
    "jures": "jur\u00e9s",
    "systeme": "syst\u00e8me",
    "election": "\u00e9lection",
    "electeurs": "\u00e9lecteurs",
    "depute": "d\u00e9put\u00e9",
    "supreme": "supr\u00eame",
    "erable": "\u00e9rable",
    "Senat": "S\u00e9nat",
    "protege": "prot\u00e9g\u00e9",
    "liberte": "libert\u00e9",
    "protegee": "prot\u00e9g\u00e9e",
    "eviter": "\u00e9viter",
    "impots": "imp\u00f4ts",
    "prive": "priv\u00e9",
    "Presentez": "Pr\u00e9sentez",
    "Decrivez": "D\u00e9crivez",
    "activite": "activit\u00e9",
    "recente": "r\u00e9cente",
    "inspire": "inspir\u00e9",
    "themes": "th\u00e8mes",
    "etude": "\u00e9tude",
    "Decouvrir": "D\u00e9couvrir",
    "educatif": "\u00e9ducatif",
    "resultats": "r\u00e9sultats",
    "resultat": "r\u00e9sultat",
    "reponses": "r\u00e9ponses",
    "reponse": "r\u00e9ponse",
    "francais": "fran\u00e7ais",
    "Francais": "Fran\u00e7ais",
    "Preparez": "Pr\u00e9parez",
    "Repondez": "R\u00e9pondez",
    "Reussi": "R\u00e9ussi",
    "details": "d\u00e9tails",
    "reessayez": "r\u00e9essayez",
    "recentes": "r\u00e9centes",
    "enregistree": "enregistr\u00e9e",
    "envoye": "envoy\u00e9",
    "ete": "\u00e9t\u00e9",
}


def normalize_french_text(value):
    if isinstance(value, list):
        return [normalize_french_text(item) for item in value]
    if not isinstance(value, str):
        return value

    normalized = value
    for source, replacement in FRENCH_TEXT_REPLACEMENTS.items():
        normalized = normalized.replace(source, replacement)
    return normalized


def ensure_seed_questions(db: Session) -> None:
    for item in SAMPLE_QUESTIONS:
        existing = (
            db.query(CitizenshipQuestion)
            .filter(CitizenshipQuestion.question_text_en == item["question_text_en"])
            .first()
        )

        if existing:
            existing.question_text_fr = normalize_french_text(item["question_text_fr"])
            existing.options_fr = normalize_french_text(item["options_fr"])
            existing.explanation_fr = normalize_french_text(item["explanation_fr"])
            existing.section = item["section"]
            existing.correct_option_index = item["correct_option_index"]
            existing.source_note = "Practice material inspired by official citizenship study themes."
            continue

        db.add(
            CitizenshipQuestion(
                **{
                    **item,
                    "question_text_fr": normalize_french_text(item["question_text_fr"]),
                    "options_fr": normalize_french_text(item["options_fr"]),
                    "explanation_fr": normalize_french_text(item["explanation_fr"]),
                },
                difficulty="standard",
                source_note="Practice material inspired by official citizenship study themes.",
            )
        )
    db.commit()


def serialize_question(question: CitizenshipQuestion, language: str) -> dict:
    lang = normalize_language(language)
    return {
        "id": question.id,
        "question_text": normalize_french_text(question.question_text_fr) if lang == "fr" and question.question_text_fr else question.question_text_en,
        "options": normalize_french_text(question.options_fr) if lang == "fr" and question.options_fr else question.options_en,
        "section": question.section,
        "difficulty": question.difficulty,
        "source_note": (
            "Contenu de pratique inspiré des thèmes officiels d'étude de la citoyenneté."
            if lang == "fr"
            else question.source_note
        ),
    }


def question_explanation(question: CitizenshipQuestion, language: str) -> str:
    lang = normalize_language(language)
    return normalize_french_text(question.explanation_fr) if lang == "fr" and question.explanation_fr else question.explanation_en


def compute_progress(db: Session, user_id: int) -> dict:
    attempts = (
        db.query(CitizenshipQuizAttempt)
        .filter(CitizenshipQuizAttempt.user_id == user_id)
        .order_by(CitizenshipQuizAttempt.created_at.desc())
        .all()
    )
    answers = (
        db.query(CitizenshipAnswer, CitizenshipQuestion)
        .join(CitizenshipQuestion, CitizenshipQuestion.id == CitizenshipAnswer.question_id)
        .join(CitizenshipQuizAttempt, CitizenshipQuizAttempt.id == CitizenshipAnswer.attempt_id)
        .filter(CitizenshipQuizAttempt.user_id == user_id)
        .all()
    )

    section_stats: dict[str, dict] = {}
    for answer, question in answers:
        stats = section_stats.setdefault(question.section, {"section": question.section, "total": 0, "correct": 0})
        stats["total"] += 1
        if answer.is_correct:
            stats["correct"] += 1

    weak_sections = []
    for stats in section_stats.values():
        accuracy = round((stats["correct"] / stats["total"]) * 100) if stats["total"] else 0
        if accuracy < 70:
            weak_sections.append({**stats, "accuracy": accuracy})

    language_sessions_count = (
        db.query(func.count(LanguagePracticeSession.id))
        .filter(LanguagePracticeSession.user_id == user_id)
        .scalar()
        or 0
    )

    scores = [attempt.score_percent for attempt in attempts]
    return {
        "attempts_count": len(attempts),
        "best_score_percent": max(scores) if scores else 0,
        "average_score_percent": round(sum(scores) / len(scores)) if scores else 0,
        "latest_score_percent": scores[0] if scores else None,
        "questions_answered": len(answers),
        "weak_sections": weak_sections[:4],
        "language_sessions_count": language_sessions_count,
    }
