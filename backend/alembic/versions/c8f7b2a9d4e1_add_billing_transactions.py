"""add billing transactions

Revision ID: c8f7b2a9d4e1
Revises: 7c1f4c9b2a10
Create Date: 2026-05-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8f7b2a9d4e1"
down_revision: Union[str, Sequence[str], None] = "7c1f4c9b2a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billing_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan", sa.String(length=80), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=12), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=True),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_session_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_invoice_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True),
        sa.Column("receipt_url", sa.Text(), nullable=True),
        sa.Column("invoice_pdf", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stripe_invoice_id"),
        sa.UniqueConstraint("stripe_session_id"),
    )
    op.create_index(op.f("ix_billing_transactions_id"), "billing_transactions", ["id"], unique=False)
    op.create_index(op.f("ix_billing_transactions_user_id"), "billing_transactions", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_billing_transactions_stripe_customer_id"),
        "billing_transactions",
        ["stripe_customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_transactions_stripe_invoice_id"),
        "billing_transactions",
        ["stripe_invoice_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_billing_transactions_stripe_payment_intent_id"),
        "billing_transactions",
        ["stripe_payment_intent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_transactions_stripe_session_id"),
        "billing_transactions",
        ["stripe_session_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_billing_transactions_stripe_subscription_id"),
        "billing_transactions",
        ["stripe_subscription_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_billing_transactions_stripe_subscription_id"), table_name="billing_transactions")
    op.drop_index(op.f("ix_billing_transactions_stripe_session_id"), table_name="billing_transactions")
    op.drop_index(op.f("ix_billing_transactions_stripe_payment_intent_id"), table_name="billing_transactions")
    op.drop_index(op.f("ix_billing_transactions_stripe_invoice_id"), table_name="billing_transactions")
    op.drop_index(op.f("ix_billing_transactions_stripe_customer_id"), table_name="billing_transactions")
    op.drop_index(op.f("ix_billing_transactions_user_id"), table_name="billing_transactions")
    op.drop_index(op.f("ix_billing_transactions_id"), table_name="billing_transactions")
    op.drop_table("billing_transactions")
