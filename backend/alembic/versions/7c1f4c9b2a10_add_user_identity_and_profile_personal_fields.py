"""add user identity and profile personal fields

Revision ID: 7c1f4c9b2a10
Revises: 0338efb1cafc
Create Date: 2026-03-30 14:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "7c1f4c9b2a10"
down_revision: Union[str, Sequence[str], None] = "0338efb1cafc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users table
    op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(), nullable=True))

    # profiles table
    op.add_column("profiles", sa.Column("first_name", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("last_name", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("nationality", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("current_country", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("current_city", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("phone_number", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("date_of_birth", sa.String(), nullable=True))
    op.add_column("profiles", sa.Column("marital_status", sa.String(), nullable=True))
    op.add_column(
        "profiles",
        sa.Column(
            "preferred_language",
            sa.String(),
            nullable=True,
            server_default="en",
        ),
    )

    op.alter_column("profiles", "preferred_language", server_default=None)


def downgrade() -> None:
    op.drop_column("profiles", "preferred_language")
    op.drop_column("profiles", "marital_status")
    op.drop_column("profiles", "date_of_birth")
    op.drop_column("profiles", "phone_number")
    op.drop_column("profiles", "current_city")
    op.drop_column("profiles", "current_country")
    op.drop_column("profiles", "nationality")
    op.drop_column("profiles", "last_name")
    op.drop_column("profiles", "first_name")

    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")