"""Isolated beta feedback storage.

Revision ID: ad2f6801c947
Revises: fc9a4123b075
"""
from alembic import op
import sqlalchemy as sa

revision = 'ad2f6801c947'
down_revision = 'fc9a4123b075'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('beta_feedback',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('category', sa.String(16), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('rating', sa.Integer()),
        sa.Column('allow_follow_up', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('page_path', sa.String(80), nullable=False),
        sa.Column('language', sa.String(2), nullable=False),
        sa.Column('user_role', sa.String(20), nullable=False),
        sa.Column('user_plan', sa.String(32), nullable=False),
        sa.Column('application_version', sa.String(64)),
        sa.Column('backend_version', sa.String(64)),
        sa.Column('device_context', sa.String(10)),
        sa.Column('ai_status', sa.String(16)),
        sa.Column('status', sa.String(16), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("category IN ('bug','ux','ai','content','feature','general')", name='ck_feedback_category'),
        sa.CheckConstraint('length(trim(message)) BETWEEN 10 AND 4000', name='ck_feedback_message'),
        sa.CheckConstraint('rating IS NULL OR rating BETWEEN 1 AND 5', name='ck_feedback_rating'),
        sa.CheckConstraint("language IN ('en','fr')", name='ck_feedback_language'),
        sa.CheckConstraint("status IN ('new','reviewed','planned','resolved','dismissed')", name='ck_feedback_status'),
        sa.CheckConstraint("ai_status IS NULL OR ai_status IN ('available','unavailable','not_requested')", name='ck_feedback_ai_status'),
    )
    op.create_index('ix_feedback_status_created', 'beta_feedback', ['status', 'created_at', 'id'])
    op.create_index('ix_feedback_user_created', 'beta_feedback', ['user_id', 'created_at'])


def downgrade():
    # Feedback is user data. Require an explicit retention/restore decision.
    raise RuntimeError('Feedback destructive downgrade is not supported; preserve user data and repair forward.')
