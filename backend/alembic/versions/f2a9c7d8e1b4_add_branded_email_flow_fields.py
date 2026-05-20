"""add branded email flow fields

Revision ID: f2a9c7d8e1b4
Revises: e5f6c3a8b9d2
Create Date: 2026-05-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2a9c7d8e1b4"
down_revision: Union[str, Sequence[str], None] = "e5f6c3a8b9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("billing_issue_email_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("billing_issue_email_status", sa.String(), nullable=True))
    op.add_column("users", sa.Column("billing_issue_email_error", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("onboarding_email_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("onboarding_email_status", sa.String(), nullable=True))
    op.add_column("users", sa.Column("onboarding_email_error", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("email_confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("email_confirmation_token_hash", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("email_confirmation_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("email_confirmation_status", sa.String(), nullable=True))
    op.add_column("users", sa.Column("email_confirmation_error", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("password_reset_token_hash", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("password_reset_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("password_reset_status", sa.String(), nullable=True))
    op.add_column("users", sa.Column("password_reset_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_reset_error")
    op.drop_column("users", "password_reset_status")
    op.drop_column("users", "password_reset_sent_at")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token_hash")
    op.drop_column("users", "email_confirmation_error")
    op.drop_column("users", "email_confirmation_status")
    op.drop_column("users", "email_confirmation_sent_at")
    op.drop_column("users", "email_confirmation_token_hash")
    op.drop_column("users", "email_confirmed_at")
    op.drop_column("users", "onboarding_email_error")
    op.drop_column("users", "onboarding_email_status")
    op.drop_column("users", "onboarding_email_sent_at")
    op.drop_column("users", "billing_issue_email_error")
    op.drop_column("users", "billing_issue_email_status")
    op.drop_column("users", "billing_issue_email_sent_at")
