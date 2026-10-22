"""Add structured test evidence and case-linked draft revisions; preserve legacy rows.

Revision ID: b7e214c9a602
Revises: ad2f6801c947
"""
from alembic import op
import sqlalchemy as sa

revision = "b7e214c9a602"
down_revision = "ad2f6801c947"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("rule_source_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.String(80), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("fingerprint", sa.String(64)),
        sa.UniqueConstraint("source_id", "checked_at", name="uq_rule_source_check"))
    op.create_index("ix_rule_source_checks_source_id", "rule_source_checks", ["source_id"])
    op.create_table("rule_source_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.String(80), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("normalized_text", sa.Text(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("source_id", "fingerprint", name="uq_rule_snapshot"))
    op.create_table("rule_source_changes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.String(80), nullable=False),
        sa.Column("previous_fingerprint", sa.String(64)),
        sa.Column("new_fingerprint", sa.String(64), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_date", sa.Date()),
        sa.Column("classification", sa.String(80), nullable=False),
        sa.Column("before_excerpt", sa.String(400), nullable=False),
        sa.Column("after_excerpt", sa.String(400), nullable=False),
        sa.Column("extraction_status", sa.String(40), nullable=False),
        sa.Column("modules", sa.JSON(), nullable=False),
        sa.UniqueConstraint("source_id", "detected_at", name="uq_rule_change"))
    op.create_table("rule_review_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("change_id", sa.Integer(), sa.ForeignKey("rule_source_changes.id"), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decision", sa.String(40), nullable=False),
        sa.Column("note", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_rule_review_decisions_change_id", "rule_review_decisions", ["change_id"])
    op.create_table("billing_review_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider_event_id", sa.String(255), unique=True, nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("transaction_id", sa.Integer(), sa.ForeignKey("billing_transactions.id")),
        sa.Column("refunded_amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(12), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("language_assessments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("exam", sa.String(40), nullable=False),
        sa.Column("edition", sa.String(80), nullable=False),
        sa.Column("test_date", sa.Date(), nullable=False),
        sa.Column("raw_scores", sa.JSON(), nullable=False),
        sa.Column("mapping_version", sa.String(80), nullable=False),
        sa.Column("provenance", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("id", "user_id", "language", name="uq_language_assessment_owner"),
        sa.CheckConstraint("language IN ('en','fr')", name="ck_language_assessment_language"),
        sa.CheckConstraint("provenance = 'user_reported'", name="ck_language_assessment_provenance"))
    op.create_index("ix_language_assessments_user_id", "language_assessments", ["user_id"])
    op.create_table("language_selections",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("language", sa.String(2), primary_key=True),
        sa.Column("assessment_id", sa.Integer()),
        sa.ForeignKeyConstraint(["assessment_id", "user_id", "language"],
            ["language_assessments.id", "language_assessments.user_id", "language_assessments.language"], name="fk_language_selection_owner"))
    op.add_column("generated_documents", sa.Column("application_case_id", sa.Integer(), nullable=True))
    op.add_column("generated_documents", sa.Column("revision", sa.Integer(), server_default="1", nullable=False))
    op.create_foreign_key("fk_generated_document_case", "generated_documents", "application_cases", ["application_case_id"], ["id"])
    op.create_index("ix_generated_documents_application_case_id", "generated_documents", ["application_case_id"])


def downgrade():
    # Explicit migration command only; never called by application startup.
    op.drop_index("ix_generated_documents_application_case_id", table_name="generated_documents")
    op.drop_constraint("fk_generated_document_case", "generated_documents", type_="foreignkey")
    op.drop_column("generated_documents", "revision")
    op.drop_column("generated_documents", "application_case_id")
    op.drop_table("language_selections")
    op.drop_index("ix_language_assessments_user_id", table_name="language_assessments")
    op.drop_table("language_assessments")
    op.drop_table("billing_review_events")
    op.drop_index("ix_rule_review_decisions_change_id", table_name="rule_review_decisions")
    op.drop_table("rule_review_decisions")
    op.drop_table("rule_source_changes")
    op.drop_table("rule_source_snapshots")
    op.drop_index("ix_rule_source_checks_source_id", table_name="rule_source_checks")
    op.drop_table("rule_source_checks")
