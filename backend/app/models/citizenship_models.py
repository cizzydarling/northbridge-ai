from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.data.db import Base


class CitizenshipQuestion(Base):
    __tablename__ = "citizenship_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text_en = Column(Text, nullable=False)
    question_text_fr = Column(Text, nullable=True)
    options_en = Column(JSON, nullable=False)
    options_fr = Column(JSON, nullable=True)
    correct_option_index = Column(Integer, nullable=False)
    explanation_en = Column(Text, nullable=False)
    explanation_fr = Column(Text, nullable=True)
    section = Column(String(120), nullable=False, index=True)
    difficulty = Column(String(40), nullable=False, default="standard")
    active = Column(Boolean, nullable=False, default=True)
    source_note = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CitizenshipQuizAttempt(Base):
    __tablename__ = "citizenship_quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mode = Column(String(40), nullable=False, default="practice")
    language = Column(String(10), nullable=False, default="en")
    total_questions = Column(Integer, nullable=False, default=0)
    correct_answers = Column(Integer, nullable=False, default=0)
    score_percent = Column(Integer, nullable=False, default=0)
    time_spent_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    answers = relationship(
        "CitizenshipAnswer",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )


class CitizenshipAnswer(Base):
    __tablename__ = "citizenship_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("citizenship_quiz_attempts.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("citizenship_questions.id"), nullable=False, index=True)
    selected_option_index = Column(Integer, nullable=False)
    correct_option_index = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    attempt = relationship("CitizenshipQuizAttempt", back_populates="answers")
    question = relationship("CitizenshipQuestion")


class LanguagePracticeSession(Base):
    __tablename__ = "language_practice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_language = Column(String(10), nullable=False, default="en")
    practice_type = Column(String(60), nullable=False, default="conversation")
    prompt = Column(Text, nullable=False)
    response_text = Column(Text, nullable=True)
    self_score = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
