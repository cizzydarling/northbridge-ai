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
        "title_fr": "Droits et responsabilites",
        "summary_en": "Review democratic rights, legal responsibilities, voting, and civic participation.",
        "summary_fr": "Revisez les droits democratiques, les responsabilites, le vote et la participation civique.",
    },
    {
        "key": "history_symbols",
        "title_en": "History and symbols",
        "title_fr": "Histoire et symboles",
        "summary_en": "Practice key ideas about Canadian history, identity, symbols, and institutions.",
        "summary_fr": "Pratiquez les notions sur l'histoire, l'identite, les symboles et les institutions.",
    },
    {
        "key": "government",
        "title_en": "Government and elections",
        "title_fr": "Gouvernement et elections",
        "summary_en": "Understand Parliament, federalism, elections, and how representatives are chosen.",
        "summary_fr": "Comprenez le Parlement, le federalisme, les elections et le choix des representants.",
    },
    {
        "key": "geography_economy",
        "title_en": "Geography and economy",
        "title_fr": "Geographie et economie",
        "summary_en": "Study provinces, territories, regions, natural resources, and the economy.",
        "summary_fr": "Etudiez les provinces, territoires, regions, ressources naturelles et l'economie.",
    },
]


SAMPLE_QUESTIONS = [
    {
        "section": "rights_responsibilities",
        "question_text_en": "Which of the following is a responsibility of Canadian citizens?",
        "question_text_fr": "Laquelle des options suivantes est une responsabilite des citoyens canadiens?",
        "options_en": ["Serving on a jury when called", "Choosing the Governor General", "Writing federal laws", "Appointing senators"],
        "options_fr": ["Servir dans un jury si convoque", "Choisir le gouverneur general", "Rediger les lois federales", "Nommer les senateurs"],
        "correct_option_index": 0,
        "explanation_en": "Citizens may be called for jury duty and are expected to participate in the justice system.",
        "explanation_fr": "Les citoyens peuvent etre convoques comme jures et doivent participer au systeme de justice.",
    },
    {
        "section": "government",
        "question_text_en": "Who do Canadians vote for in a federal election?",
        "question_text_fr": "Pour qui les Canadiens votent-ils lors d'une election federale?",
        "options_en": ["A Member of Parliament", "The King", "A Supreme Court judge", "The Governor General"],
        "options_fr": ["Un depute", "Le roi", "Un juge de la Cour supreme", "Le gouverneur general"],
        "correct_option_index": 0,
        "explanation_en": "In a federal election, voters choose a Member of Parliament for their riding.",
        "explanation_fr": "Lors d'une election federale, les electeurs choisissent un depute pour leur circonscription.",
    },
    {
        "section": "history_symbols",
        "question_text_en": "What does the maple leaf commonly symbolize?",
        "question_text_fr": "Que symbolise souvent la feuille d'erable?",
        "options_en": ["Canada", "Only one province", "The Senate", "The court system"],
        "options_fr": ["Le Canada", "Une seule province", "Le Senat", "Le systeme judiciaire"],
        "correct_option_index": 0,
        "explanation_en": "The maple leaf is one of Canada's best-known national symbols.",
        "explanation_fr": "La feuille d'erable est l'un des symboles nationaux les plus connus du Canada.",
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
        "question_text_fr": "Quel droit est protege au Canada?",
        "options_en": ["Freedom of expression", "The right to ignore all laws", "The right to appoint judges", "The right to avoid taxes"],
        "options_fr": ["La liberte d'expression", "Le droit d'ignorer toutes les lois", "Le droit de nommer les juges", "Le droit d'eviter les impots"],
        "correct_option_index": 0,
        "explanation_en": "Freedom of expression is a fundamental freedom protected in Canada.",
        "explanation_fr": "La liberte d'expression est une liberte fondamentale protegee au Canada.",
    },
    {
        "section": "government",
        "question_text_en": "What are the three levels of government in Canada?",
        "question_text_fr": "Quels sont les trois ordres de gouvernement au Canada?",
        "options_en": ["Federal, provincial or territorial, and municipal", "Royal, military, and local", "Senate, court, and police", "National, private, and public"],
        "options_fr": ["Federal, provincial ou territorial, et municipal", "Royal, militaire et local", "Senat, tribunal et police", "National, prive et public"],
        "correct_option_index": 0,
        "explanation_en": "Canada has federal, provincial or territorial, and municipal levels of government.",
        "explanation_fr": "Le Canada a des gouvernements federal, provinciaux ou territoriaux, et municipaux.",
    },
]


LANGUAGE_PROMPTS = {
    "en": [
        "Introduce yourself and explain why you want to become a Canadian citizen.",
        "Describe one responsibility of citizenship in your own words.",
        "Explain a recent community activity you joined or would like to join.",
    ],
    "fr": [
        "Presentez-vous et expliquez pourquoi vous voulez devenir citoyen canadien.",
        "Decrivez une responsabilite de la citoyennete avec vos propres mots.",
        "Expliquez une activite communautaire recente ou une activite que vous aimeriez faire.",
    ],
}


def normalize_language(language: str | None) -> str:
    return "fr" if str(language or "").lower().startswith("fr") else "en"


def ensure_seed_questions(db: Session) -> None:
    exists = db.query(CitizenshipQuestion.id).first()
    if exists:
        return

    for item in SAMPLE_QUESTIONS:
        db.add(
            CitizenshipQuestion(
                **item,
                difficulty="standard",
                source_note="Practice material inspired by official citizenship study themes.",
            )
        )
    db.commit()


def serialize_question(question: CitizenshipQuestion, language: str) -> dict:
    lang = normalize_language(language)
    return {
        "id": question.id,
        "question_text": question.question_text_fr if lang == "fr" and question.question_text_fr else question.question_text_en,
        "options": question.options_fr if lang == "fr" and question.options_fr else question.options_en,
        "section": question.section,
        "difficulty": question.difficulty,
        "source_note": question.source_note,
    }


def question_explanation(question: CitizenshipQuestion, language: str) -> str:
    lang = normalize_language(language)
    return question.explanation_fr if lang == "fr" and question.explanation_fr else question.explanation_en


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
