"""Add public reference snapshots and atomic active pointers; no legacy writes."""
from alembic import op
import sqlalchemy as sa
revision = 'd9a7e3b2f610'
down_revision = 'c4f8a2d6e901'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('official_resource_snapshots',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('source_id', sa.String(24), nullable=False),
        sa.Column('retrieved_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('record_count', sa.Integer(), nullable=False),
        sa.Column('records_sha256', sa.String(64), nullable=False),
        sa.Column('envelope', sa.JSON(), nullable=False),
        sa.Column('records', sa.JSON(), nullable=False),
        sa.UniqueConstraint('source_id', 'id', name='uq_official_snapshot_source_id'),
        sa.CheckConstraint("source_id IN ('dli','processing_en','processing_fr')", name='ck_official_snapshot_source'),
        sa.CheckConstraint('record_count > 0', name='ck_official_snapshot_nonempty'))
    op.create_table('official_resource_heads',
        sa.Column('source_id', sa.String(24), primary_key=True),
        sa.Column('snapshot_id', sa.String(32), nullable=True),
        sa.ForeignKeyConstraint(['source_id','snapshot_id'], ['official_resource_snapshots.source_id','official_resource_snapshots.id'], name='fk_official_head_source_snapshot'),
        sa.CheckConstraint("source_id IN ('dli','processing_en','processing_fr')", name='ck_official_head_source'))


def downgrade():
    raise RuntimeError('destructive downgrade is not supported: resource snapshot recovery requires separate authorization')
