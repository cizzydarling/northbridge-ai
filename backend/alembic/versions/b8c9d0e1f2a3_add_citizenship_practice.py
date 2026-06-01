"""add citizenship practice

Revision ID: b8c9d0e1f2a3
Revises: a6b7c8d9e0f1
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "citizenship_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("question_text_en", sa.Text(), nullable=False),
        sa.Column("question_text_fr", sa.Text(), nullable=True),
        sa.Column("options_en", sa.JSON(), nullable=False),
        sa.Column("options_fr", sa.JSON(), nullable=True),
        sa.Column("correct_option_index", sa.Integer(), nullable=False),
        sa.Column("explanation_en", sa.Text(), nullable=False),
        sa.Column("explanation_fr", sa.Text(), nullable=True),
        sa.Column("section", sa.String(length=120), nullable=False),
        sa.Column("difficulty", sa.String(length=40), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("source_note", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_citizenship_questions_id"), "citizenship_questions", ["id"], unique=False)
    op.create_index(op.f("ix_citizenship_questions_section"), "citizenship_questions", ["section"], unique=False)

    op.create_table(
        "citizenship_quiz_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=40), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("correct_answers", sa.Integer(), nullable=False),
        sa.Column("score_percent", sa.Integer(), nullable=False),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_citizenship_quiz_attempts_id"), "citizenship_quiz_attempts", ["id"], unique=False)
    op.create_index(op.f("ix_citizenship_quiz_attempts_user_id"), "citizenship_quiz_attempts", ["user_id"], unique=False)

    op.create_table(
        "citizenship_answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("selected_option_index", sa.Integer(), nullable=False),
        sa.Column("correct_option_index", sa.Integer(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["citizenship_quiz_attempts.id"]),
        sa.ForeignKeyConstraint(["question_id"], ["citizenship_questions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_citizenship_answers_id"), "citizenship_answers", ["id"], unique=False)
    op.create_index(op.f("ix_citizenship_answers_attempt_id"), "citizenship_answers", ["attempt_id"], unique=False)
    op.create_index(op.f("ix_citizenship_answers_question_id"), "citizenship_answers", ["question_id"], unique=False)

    op.create_table(
        "language_practice_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("target_language", sa.String(length=10), nullable=False),
        sa.Column("practice_type", sa.String(length=60), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("self_score", sa.Integer(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_language_practice_sessions_id"), "language_practice_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_language_practice_sessions_user_id"), "language_practice_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_language_practice_sessions_user_id"), table_name="language_practice_sessions")
    op.drop_index(op.f("ix_language_practice_sessions_id"), table_name="language_practice_sessions")
    op.drop_table("language_practice_sessions")

    op.drop_index(op.f("ix_citizenship_answers_question_id"), table_name="citizenship_answers")
    op.drop_index(op.f("ix_citizenship_answers_attempt_id"), table_name="citizenship_answers")
    op.drop_index(op.f("ix_citizenship_answers_id"), table_name="citizenship_answers")
    op.drop_table("citizenship_answers")

    op.drop_index(op.f("ix_citizenship_quiz_attempts_user_id"), table_name="citizenship_quiz_attempts")
    op.drop_index(op.f("ix_citizenship_quiz_attempts_id"), table_name="citizenship_quiz_attempts")
    op.drop_table("citizenship_quiz_attempts")

    op.drop_index(op.f("ix_citizenship_questions_section"), table_name="citizenship_questions")
    op.drop_index(op.f("ix_citizenship_questions_id"), table_name="citizenship_questions")
    op.drop_table("citizenship_questions")
