"""add career match saved jobs

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_career_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("province", sa.String(length=80), nullable=False),
        sa.Column("noc_code", sa.String(length=20), nullable=True),
        sa.Column("occupation", sa.String(length=255), nullable=True),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("job_url", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_career_jobs_id"), "saved_career_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_saved_career_jobs_user_id"), "saved_career_jobs", ["user_id"], unique=False)
    op.create_index(op.f("ix_saved_career_jobs_province"), "saved_career_jobs", ["province"], unique=False)
    op.create_index(op.f("ix_saved_career_jobs_noc_code"), "saved_career_jobs", ["noc_code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_career_jobs_noc_code"), table_name="saved_career_jobs")
    op.drop_index(op.f("ix_saved_career_jobs_province"), table_name="saved_career_jobs")
    op.drop_index(op.f("ix_saved_career_jobs_user_id"), table_name="saved_career_jobs")
    op.drop_index(op.f("ix_saved_career_jobs_id"), table_name="saved_career_jobs")
    op.drop_table("saved_career_jobs")
