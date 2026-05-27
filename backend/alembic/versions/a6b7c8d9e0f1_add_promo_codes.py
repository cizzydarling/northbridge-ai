"""add promo codes

Revision ID: a6b7c8d9e0f1
Revises: f2a9c7d8e1b4
Create Date: 2026-05-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, Sequence[str], None] = "f2a9c7d8e1b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promo_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("access_type", sa.String(length=80), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("current_uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_promo_codes_id"), "promo_codes", ["id"], unique=False)
    op.create_index(op.f("ix_promo_codes_code"), "promo_codes", ["code"], unique=True)

    op.create_table(
        "promo_code_redemptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("promo_code_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("access_type", sa.String(length=80), nullable=False),
        sa.Column("granted_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["promo_code_id"], ["promo_codes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("promo_code_id", "user_id", name="uq_promo_code_user_redemption"),
    )
    op.create_index(op.f("ix_promo_code_redemptions_id"), "promo_code_redemptions", ["id"], unique=False)
    op.create_index(op.f("ix_promo_code_redemptions_promo_code_id"), "promo_code_redemptions", ["promo_code_id"], unique=False)
    op.create_index(op.f("ix_promo_code_redemptions_user_id"), "promo_code_redemptions", ["user_id"], unique=False)
    op.create_index(op.f("ix_promo_code_redemptions_code"), "promo_code_redemptions", ["code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_promo_code_redemptions_code"), table_name="promo_code_redemptions")
    op.drop_index(op.f("ix_promo_code_redemptions_user_id"), table_name="promo_code_redemptions")
    op.drop_index(op.f("ix_promo_code_redemptions_promo_code_id"), table_name="promo_code_redemptions")
    op.drop_index(op.f("ix_promo_code_redemptions_id"), table_name="promo_code_redemptions")
    op.drop_table("promo_code_redemptions")

    op.drop_index(op.f("ix_promo_codes_code"), table_name="promo_codes")
    op.drop_index(op.f("ix_promo_codes_id"), table_name="promo_codes")
    op.drop_table("promo_codes")
