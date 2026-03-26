"""add audit fields to disclosure_acceptance

Revision ID: 0338efb1cafc
Revises: 34351986a012
Create Date: 2026-03-25 11:26:55.421507
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0338efb1cafc"
down_revision: Union[str, Sequence[str], None] = "34351986a012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "disclosure_acceptances",
        sa.Column("accepted_by_email_snapshot", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "disclosure_acceptances",
        sa.Column(
            "acceptance_scope",
            sa.String(length=50),
            nullable=False,
            server_default="global",
        ),
    )
    op.add_column(
        "disclosure_acceptances",
        sa.Column("ip_address", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "disclosure_acceptances",
        sa.Column("user_agent", sa.Text(), nullable=True),
    )

    op.create_index(
        op.f("ix_disclosure_acceptances_disclosure_version"),
        "disclosure_acceptances",
        ["disclosure_version"],
        unique=False,
    )
    op.create_index(
        op.f("ix_disclosure_acceptances_accepted_at"),
        "disclosure_acceptances",
        ["accepted_at"],
        unique=False,
    )

    op.alter_column(
        "disclosure_acceptances",
        "acceptance_scope",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_disclosure_acceptances_accepted_at"),
        table_name="disclosure_acceptances",
    )
    op.drop_index(
        op.f("ix_disclosure_acceptances_disclosure_version"),
        table_name="disclosure_acceptances",
    )

    op.drop_column("disclosure_acceptances", "user_agent")
    op.drop_column("disclosure_acceptances", "ip_address")
    op.drop_column("disclosure_acceptances", "acceptance_scope")
    op.drop_column("disclosure_acceptances", "accepted_by_email_snapshot")