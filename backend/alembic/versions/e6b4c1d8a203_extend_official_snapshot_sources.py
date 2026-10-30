"""Allow two reviewed historical draw source identities; no record backfill."""
from alembic import op
import sqlalchemy as sa

revision = 'e6b4c1d8a203'
down_revision = 'd9a7e3b2f610'
branch_labels = None
depends_on = None

OLD = "source_id IN ('dli','processing_en','processing_fr')"
NEW = "source_id IN ('dli','processing_en','processing_fr','draws_en','draws_fr')"
CONSTRAINTS = (('official_resource_snapshots', 'ck_official_snapshot_source'),
               ('official_resource_heads', 'ck_official_head_source'))


def _replace(expression):
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("SET LOCAL lock_timeout = '2s'")
        op.execute("SET LOCAL statement_timeout = '10s'")
        for table, name in CONSTRAINTS:
            temporary = name + '_candidate'
            op.execute(f'ALTER TABLE {table} ADD CONSTRAINT {temporary} CHECK ({expression}) NOT VALID')
            op.execute(f'ALTER TABLE {table} VALIDATE CONSTRAINT {temporary}')
            op.drop_constraint(name, table, type_='check')
            op.execute(f'ALTER TABLE {table} RENAME CONSTRAINT {temporary} TO {name}')
    else:
        for table, name in CONSTRAINTS:
            with op.batch_alter_table(table) as batch:
                batch.drop_constraint(name, type_='check')
                batch.create_check_constraint(name, expression)


def upgrade():
    _replace(NEW)


def downgrade():
    # Never discard source history merely to make a schema rollback succeed.
    bind = op.get_bind()
    for table, _ in CONSTRAINTS:
        if bind.execute(sa.text(f"SELECT 1 FROM {table} WHERE source_id IN ('draws_en','draws_fr') LIMIT 1")).first():
            raise RuntimeError('draw snapshot downgrade requires separate recovery authorization')
    _replace(OLD)
