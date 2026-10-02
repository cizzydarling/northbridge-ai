"""Reconcile the individual-only launch schema without replacing existing data.

Revision ID: eb8f3012a964
Revises: da7e2f901c63
"""
from alembic import op
import sqlalchemy as sa

revision = "eb8f3012a964"
down_revision = "da7e2f901c63"
branch_labels = None
depends_on = None


def upgrade():
    # Graph commands load revisions before env.py establishes the backend path.
    from migration_contract import create_table, disclosure_table, generated_table, profile_table, user_table, validate_table

    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("Individual launch reconciliation requires PostgreSQL inspection")
    jobs = ("job_description", "job_duties")
    # Validate all existing objects before any DDL. A failed migration is atomic.
    validate_table(bind, profile_table(), optional_columns=jobs)
    validate_table(bind, disclosure_table())
    validate_table(bind, user_table())
    inspector = sa.inspect(bind)
    generated = generated_table()
    exists = inspector.has_table(generated.name)
    if exists:
        validate_table(bind, generated)
    columns = {c["name"] for c in inspector.get_columns("profiles")}
    for name in jobs:
        if name not in columns:
            op.add_column("profiles", sa.Column(name, sa.Text(), nullable=True))
    if not exists:
        create_table(op, generated)
    validate_table(bind, profile_table())
    validate_table(bind, generated)


def downgrade():
    raise RuntimeError("Reconciled objects may predate this revision; restore a verified backup or repair forward.")
