"""add subscription cancellation fields

Revision ID: e5f6c3a8b9d2
Revises: d4a1b7e5c2f0
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6c3a8b9d2"
down_revision: Union[str, Sequence[str], None] = "d4a1b7e5c2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("subscription_cancel_at_period_end", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("subscription_current_period_end", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("cancellation_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("cancellation_email_status", sa.String(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("cancellation_email_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "cancellation_email_error")
    op.drop_column("users", "cancellation_email_status")
    op.drop_column("users", "cancellation_email_sent_at")
    op.drop_column("users", "subscription_current_period_end")
    op.drop_column("users", "subscription_cancel_at_period_end")
