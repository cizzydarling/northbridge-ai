"""add updated_at to saved simulation scenarios

Revision ID: 6896f9168f58
Revises: 11e407a1445a
Create Date: 2026-03-18 13:28:33.744492

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6896f9168f58'
down_revision: Union[str, Sequence[str], None] = '11e407a1445a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "saved_simulation_scenarios",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("saved_simulation_scenarios", "updated_at")
