"""baseline_schema

Revision ID: 11e407a1445a
Revises:
Create Date: 2026-03-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "11e407a1445a"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="individual"),
        sa.Column("plan", sa.String(), nullable=False, server_default="free"),
        sa.Column("subscription_status", sa.String(), nullable=True),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("stripe_customer_id"),
        sa.UniqueConstraint("stripe_subscription_id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="Active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clients_id", "clients", ["id"], unique=False)
    op.create_index("ix_clients_owner_user_id", "clients", ["owner_user_id"], unique=False)

    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("education", sa.String(), nullable=False),
        sa.Column("language_score", sa.Integer(), nullable=False),
        sa.Column("experience_years", sa.Integer(), nullable=False),
        sa.Column("has_job_offer", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("has_canadian_experience", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("studied_in_canada", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        sa.Column("occupation", sa.String(), nullable=True),
        sa.Column("noc_code", sa.String(), nullable=True),
        sa.Column("preferred_province", sa.String(), nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_profiles_id", "profiles", ["id"], unique=False)
    op.create_index("ix_profiles_client_id", "profiles", ["client_id"], unique=False)

    op.create_table(
        "client_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("document_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="Not Started"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_documents_id", "client_documents", ["id"], unique=False)
    op.create_index("ix_client_documents_client_id", "client_documents", ["client_id"], unique=False)
    op.create_index("ix_client_documents_owner_user_id", "client_documents", ["owner_user_id"], unique=False)

    op.create_table(
        "saved_simulation_scenarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("current_profile_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("simulated_changes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_simulation_scenarios_id", "saved_simulation_scenarios", ["id"], unique=False)
    op.create_index("ix_saved_simulation_scenarios_client_id", "saved_simulation_scenarios", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_simulation_scenarios_client_id", table_name="saved_simulation_scenarios")
    op.drop_index("ix_saved_simulation_scenarios_id", table_name="saved_simulation_scenarios")
    op.drop_table("saved_simulation_scenarios")

    op.drop_index("ix_client_documents_owner_user_id", table_name="client_documents")
    op.drop_index("ix_client_documents_client_id", table_name="client_documents")
    op.drop_index("ix_client_documents_id", table_name="client_documents")
    op.drop_table("client_documents")

    op.drop_index("ix_profiles_client_id", table_name="profiles")
    op.drop_index("ix_profiles_id", table_name="profiles")
    op.drop_table("profiles")

    op.drop_index("ix_clients_owner_user_id", table_name="clients")
    op.drop_index("ix_clients_id", table_name="clients")
    op.drop_table("clients")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")