from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class HouseholdMember(Base):
    __tablename__ = "household_members"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id"), nullable=False, index=True)

    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    relationship_to_primary = Column(String, nullable=False, default="self")

    date_of_birth = Column(Date, nullable=True)
    nationality = Column(String, nullable=True)
    current_country = Column(String, nullable=True)
    email = Column(String, nullable=True)

    is_primary_applicant = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    household = relationship("Household", back_populates="members")