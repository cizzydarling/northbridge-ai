from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CitizenshipQuestionResponse(BaseModel):
    id: int
    question_text: str
    options: list[str]
    section: str
    difficulty: str
    source_note: Optional[str] = None


class CitizenshipAnswerSubmit(BaseModel):
    question_id: int
    selected_option_index: int = Field(ge=0)


class CitizenshipQuizSubmit(BaseModel):
    mode: str = "practice"
    language: str = "en"
    time_spent_seconds: Optional[int] = None
    answers: list[CitizenshipAnswerSubmit]


class CitizenshipAnswerResult(BaseModel):
    question_id: int
    selected_option_index: int
    correct_option_index: int
    is_correct: bool
    explanation: str
    question_text: str
    options: list[str]
    section: str


class CitizenshipQuizResult(BaseModel):
    attempt_id: Optional[int] = None
    mode: str
    language: str
    total_questions: int
    correct_answers: int
    score_percent: int
    passed: bool
    answers: list[CitizenshipAnswerResult]


class CitizenshipProgressResponse(BaseModel):
    attempts_count: int
    best_score_percent: int
    average_score_percent: int
    latest_score_percent: Optional[int] = None
    questions_answered: int
    weak_sections: list[dict]
    language_sessions_count: int


class LanguagePracticeSessionCreate(BaseModel):
    target_language: str = "en"
    practice_type: str = "conversation"
    prompt: str
    response_text: Optional[str] = None
    self_score: Optional[int] = Field(default=None, ge=0, le=100)
    feedback: Optional[str] = None


class LanguagePracticeSessionResponse(LanguagePracticeSessionCreate):
    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
