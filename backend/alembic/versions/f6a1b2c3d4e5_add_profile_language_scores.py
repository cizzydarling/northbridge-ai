"""add profile language scores

Revision ID: f6a1b2c3d4e5
Revises: c9d0e1f2a3b4
Create Date: 2026-06-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("english_language_score", sa.Integer(), nullable=True))
    op.add_column("profiles", sa.Column("french_language_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "french_language_score")
    op.drop_column("profiles", "english_language_score")
