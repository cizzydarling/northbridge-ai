"""add billing confirmation email tracking

Revision ID: d4a1b7e5c2f0
Revises: c8f7b2a9d4e1
Create Date: 2026-05-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4a1b7e5c2f0"
down_revision: Union[str, Sequence[str], None] = "c8f7b2a9d4e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "billing_transactions",
        sa.Column("confirmation_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "billing_transactions",
        sa.Column("confirmation_email_status", sa.String(length=80), nullable=True),
    )
    op.add_column(
        "billing_transactions",
        sa.Column("confirmation_email_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("billing_transactions", "confirmation_email_error")
    op.drop_column("billing_transactions", "confirmation_email_status")
    op.drop_column("billing_transactions", "confirmation_email_sent_at")
