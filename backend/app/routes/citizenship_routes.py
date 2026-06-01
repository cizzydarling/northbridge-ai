from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.citizenship_models import (
    CitizenshipAnswer,
    CitizenshipQuestion,
    CitizenshipQuizAttempt,
    LanguagePracticeSession,
)
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.citizenship_schema import (
    CitizenshipProgressResponse,
    CitizenshipQuestionResponse,
    CitizenshipQuizResult,
    CitizenshipQuizSubmit,
    LanguagePracticeSessionCreate,
    LanguagePracticeSessionResponse,
)
from app.services.citizenship_service import (
    LANGUAGE_PROMPTS,
    STUDY_SECTIONS,
    compute_progress,
    ensure_seed_questions,
    normalize_french_text,
    normalize_language,
    question_explanation,
    serialize_question,
)

router = APIRouter(prefix="/citizenship", tags=["Citizenship Coach"])


@router.get("/study-guide")
def get_study_guide(language: str = Query(default="en")):
    lang = normalize_language(language)
    title = "Citizenship Coach"
    description = "Practice Canadian citizenship test themes and language confidence."
    official_note = (
        "Practice content is educational support and is not a substitute for the official Discover Canada study guide."
    )

    if lang == "fr":
        title = normalize_french_text("Coach de citoyennete")
        description = normalize_french_text(
            "Pratiquez les themes du test de citoyennete et la confiance linguistique."
        )
        official_note = normalize_french_text(
            "Le contenu de pratique est un soutien educatif et ne remplace pas le guide officiel Decouvrir le Canada."
        )

    return {
        "language": lang,
        "title": title,
        "description": description,
        "official_note": official_note,
        "sections": [
            {
                "key": item["key"],
                "title": normalize_french_text(item["title_fr"]) if lang == "fr" else item["title_en"],
                "summary": normalize_french_text(item["summary_fr"]) if lang == "fr" else item["summary_en"],
            }
            for item in STUDY_SECTIONS
        ],
    }


@router.get("/questions", response_model=list[CitizenshipQuestionResponse])
def get_questions(
    language: str = Query(default="en"),
    mode: str = Query(default="practice"),
    limit: int = Query(default=10, ge=1, le=20),
    section: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_seed_questions(db)
    query = db.query(CitizenshipQuestion).filter(CitizenshipQuestion.active.is_(True))

    if section:
        query = query.filter(CitizenshipQuestion.section == section)

    if mode == "mock":
        limit = min(limit, 20)

    questions = query.order_by(CitizenshipQuestion.id.asc()).limit(limit).all()
    return [serialize_question(question, language) for question in questions]


@router.post("/quiz-attempts", response_model=CitizenshipQuizResult)
def submit_quiz_attempt(
    payload: CitizenshipQuizSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_seed_questions(db)
    if not payload.answers:
        raise HTTPException(status_code=400, detail="At least one answer is required.")

    question_ids = [answer.question_id for answer in payload.answers]
    questions = (
        db.query(CitizenshipQuestion)
        .filter(CitizenshipQuestion.id.in_(question_ids))
        .all()
    )
    questions_by_id = {question.id: question for question in questions}

    missing = [question_id for question_id in question_ids if question_id not in questions_by_id]
    if missing:
        raise HTTPException(status_code=400, detail="One or more questions are invalid.")

    total = len(payload.answers)
    correct = 0
    lang = normalize_language(payload.language)
    answer_results = []

    attempt = CitizenshipQuizAttempt(
        user_id=current_user.id,
        mode=payload.mode or "practice",
        language=lang,
        total_questions=total,
        time_spent_seconds=payload.time_spent_seconds,
    )
    db.add(attempt)
    db.flush()

    for submitted in payload.answers:
        question = questions_by_id[submitted.question_id]
        is_correct = submitted.selected_option_index == question.correct_option_index
        if is_correct:
            correct += 1

        db.add(
            CitizenshipAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                selected_option_index=submitted.selected_option_index,
                correct_option_index=question.correct_option_index,
                is_correct=is_correct,
            )
        )
        answer_results.append(
            {
                **serialize_question(question, lang),
                "question_id": question.id,
                "selected_option_index": submitted.selected_option_index,
                "correct_option_index": question.correct_option_index,
                "is_correct": is_correct,
                "explanation": question_explanation(question, lang),
            }
        )

    score = round((correct / total) * 100) if total else 0
    attempt.correct_answers = correct
    attempt.score_percent = score
    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "mode": attempt.mode,
        "language": lang,
        "total_questions": total,
        "correct_answers": correct,
        "score_percent": score,
        "passed": score >= 75,
        "answers": answer_results,
    }


@router.get("/progress", response_model=CitizenshipProgressResponse)
def get_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_seed_questions(db)
    return compute_progress(db, current_user.id)


@router.get("/language-prompts")
def get_language_prompts(language: str = Query(default="en")):
    lang = normalize_language(language)
    prompts = normalize_french_text(LANGUAGE_PROMPTS[lang]) if lang == "fr" else LANGUAGE_PROMPTS[lang]
    return {"language": lang, "prompts": prompts}


@router.get("/language-sessions", response_model=list[LanguagePracticeSessionResponse])
def list_language_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(LanguagePracticeSession)
        .filter(LanguagePracticeSession.user_id == current_user.id)
        .order_by(LanguagePracticeSession.created_at.desc())
        .limit(25)
        .all()
    )


@router.post("/language-sessions", response_model=LanguagePracticeSessionResponse)
def create_language_session(
    payload: LanguagePracticeSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = LanguagePracticeSession(
        user_id=current_user.id,
        target_language=normalize_language(payload.target_language),
        practice_type=payload.practice_type,
        prompt=payload.prompt,
        response_text=payload.response_text,
        self_score=payload.self_score,
        feedback=payload.feedback,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

