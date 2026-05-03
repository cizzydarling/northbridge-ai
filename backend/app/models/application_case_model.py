from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class ApplicationCase(Base):
    __tablename__ = "application_cases"

    id = Column(Integer, primary_key=True, index=True)

    household_id = Column(Integer, ForeignKey("households.id"), nullable=False, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    application_type = Column(String, nullable=False)
    case_title = Column(String, nullable=True)

    status = Column(String, nullable=False, default="draft")

    primary_applicant_member_id = Column(
        Integer,
        ForeignKey("household_members.id"),
        nullable=True,
    )

    target_country = Column(String, nullable=False, default="Canada")
    target_province = Column(String, nullable=True)
    pathway = Column(String, nullable=True)

    family_size = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    household = relationship("Household", back_populates="application_cases")
    primary_applicant = relationship("HouseholdMember")