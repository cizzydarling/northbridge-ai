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
    # Retained revision marker: this unreleased field is not in the launch contract.
    pass


def downgrade():
    pass
