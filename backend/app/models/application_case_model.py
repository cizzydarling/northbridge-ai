from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.sql import func
from app.data.db import Base

class ApplicationCase(Base):
    __tablename__ = "application_cases"
    __table_args__ = (
        UniqueConstraint("id", "household_id", name="uq_case_household"),
        UniqueConstraint("id", "owner_user_id", name="uq_case_owner"),
        ForeignKeyConstraint(["household_id", "owner_user_id"], ["households.id", "households.owner_user_id"], name="fk_case_household_owner"),
        ForeignKeyConstraint(["primary_applicant_member_id", "household_id", "owner_user_id"], ["household_members.id", "household_members.household_id", "household_members.owner_user_id"], name="fk_case_primary_self"),
        CheckConstraint("application_type IN ('permanent_residence','study_permit','work_permit','visitor_visa','spousal_sponsorship')", name="ck_case_type"),
        CheckConstraint("status IN ('draft','in_progress','archived')", name="ck_case_status"),
        CheckConstraint("NOT is_active OR status <> 'archived'", name="ck_active_not_archived"),
        CheckConstraint("family_size >= 1", name="ck_case_family_size"),
        Index("uq_active_case", "owner_user_id", unique=True, postgresql_where=text("is_active"), sqlite_where=text("is_active")),
    )
    id = Column(Integer, primary_key=True)
    household_id = Column(Integer, nullable=False, index=True)
    owner_user_id = Column(Integer, nullable=False, index=True)
    primary_applicant_member_id = Column(Integer, nullable=False)
    application_type = Column(String(40), nullable=False)
    case_title = Column(String(120))
    status = Column(String(20), nullable=False, default="draft")
    is_active = Column(Boolean, nullable=False, default=False)
    target_country = Column(String(80), nullable=False, default="Canada")
    target_province = Column(String(80))
    pathway = Column(String(120))
    family_size = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class ApplicationCaseMember(Base):
    __tablename__ = "application_case_members"
    __table_args__ = (
        ForeignKeyConstraint(["application_case_id", "household_id"], ["application_cases.id", "application_cases.household_id"], name="fk_participation_case"),
        ForeignKeyConstraint(["household_member_id", "household_id"], ["household_members.id", "household_members.household_id"], name="fk_participation_member"),
        CheckConstraint("participation IN ('accompanying','non_accompanying','unknown')", name="ck_participation"),
    )
    application_case_id = Column(Integer, primary_key=True)
    household_member_id = Column(Integer, primary_key=True)
    household_id = Column(Integer, nullable=False, index=True)
    participation = Column(String(20), nullable=False, default="unknown")
