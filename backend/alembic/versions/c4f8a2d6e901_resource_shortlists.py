"""Add case-owned resource bookmarks, without touching existing records."""
from alembic import op
import sqlalchemy as sa
revision='c4f8a2d6e901'
down_revision='b7e214c9a602'
branch_labels=None
depends_on=None

def upgrade():
 op.create_table('resource_shortlists',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('application_case_id',sa.Integer(),nullable=False),sa.Column('owner_user_id',sa.Integer(),nullable=False),sa.Column('kind',sa.String(20),nullable=False),sa.Column('resource_id',sa.String(32),nullable=False),sa.Column('source_snapshot',sa.JSON(),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.ForeignKeyConstraint(['application_case_id','owner_user_id'],['application_cases.id','application_cases.owner_user_id'],name='fk_resource_shortlist_case_owner'),sa.UniqueConstraint('application_case_id','kind','resource_id',name='uq_resource_shortlist_record'))
 op.create_index('ix_resource_shortlists_application_case_id','resource_shortlists',['application_case_id'])
 op.create_index('ix_resource_shortlists_owner_user_id','resource_shortlists',['owner_user_id'])

def downgrade():
 raise RuntimeError('destructive downgrade is not supported: resource shortlists require a separately reviewed data-preservation procedure')
