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
    from migration_contract import create_table, disclosure_table, validate_table

    bind = op.get_bind()
    table = disclosure_table()
    if not sa.inspect(bind).has_table(table.name):
        create_table(op, table)
    # Existing production-compatible tables are adopted without touching records.
    # Other historical shapes require explicit review, never blind IF NOT EXISTS.
    validate_table(bind, table)


def downgrade() -> None:
    # The table may have predated this revision. Its provenance cannot safely be
    # inferred from the version marker, so never discard disclosure audit records.
    raise RuntimeError("Disclosure reconciliation is irreversible; restore a verified backup or repair forward.")
