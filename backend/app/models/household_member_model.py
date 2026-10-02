from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.sql import func
from app.data.db import Base

class HouseholdMember(Base):
    __tablename__ = "household_members"
    __table_args__ = (
        UniqueConstraint("id", "household_id", name="uq_member_household"),
        UniqueConstraint("id", "household_id", "owner_user_id", name="uq_self_owner"),
        ForeignKeyConstraint(["household_id", "owner_user_id"], ["households.id", "households.owner_user_id"], name="fk_self_household_owner"),
        CheckConstraint("relationship_to_primary IN ('self','spouse','common_law_partner','child')", name="ck_member_relationship"),
        CheckConstraint("(relationship_to_primary = 'self' AND owner_user_id IS NOT NULL AND is_primary_applicant AND archived_at IS NULL) OR (relationship_to_primary <> 'self' AND owner_user_id IS NULL AND NOT is_primary_applicant)", name="ck_member_self"),
        Index("uq_household_self", "household_id", unique=True, postgresql_where=text("relationship_to_primary = 'self'"), sqlite_where=text("relationship_to_primary = 'self'")),
        Index("uq_household_partner", "household_id", unique=True, postgresql_where=text("relationship_to_primary IN ('spouse','common_law_partner') AND archived_at IS NULL"), sqlite_where=text("relationship_to_primary IN ('spouse','common_law_partner') AND archived_at IS NULL")),
    )
    id = Column(Integer, primary_key=True)
    household_id = Column(Integer, ForeignKey("households.id"), nullable=False, index=True)
    owner_user_id = Column(Integer)
    first_name = Column(String(100))
    last_name = Column(String(100))
    relationship_to_primary = Column(String(30), nullable=False)
    date_of_birth = Column(Date)
    nationality = Column(String(100))
    current_country = Column(String(100))
    email = Column(String(254))
    is_primary_applicant = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
