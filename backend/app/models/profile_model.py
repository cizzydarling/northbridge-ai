from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.data.db import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Personal identity / background
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    nationality = Column(String, nullable=True)
    current_country = Column(String, nullable=True)
    current_city = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    marital_status = Column(String, nullable=True)
    preferred_language = Column(String, nullable=True, default="en")

    # Immigration / eligibility profile
    age = Column(Integer, nullable=True)
    education = Column(String, nullable=True)
    language_score = Column(Integer, nullable=True)
    english_language_score = Column(Integer, nullable=True)
    french_language_score = Column(Integer, nullable=True)
    experience_years = Column(Integer, nullable=True)
    has_job_offer = Column(Boolean, default=False)
    has_canadian_experience = Column(Boolean, default=False)
    studied_in_canada = Column(Boolean, default=False)

    occupation = Column(String, nullable=True)
    noc_code = Column(String, nullable=True)

    # 🔥 NEW (critical for AI accuracy)
    job_description = Column(String, nullable=True)
    job_duties = Column(String, nullable=True)

    preferred_province = Column(String, nullable=True)

    user = relationship("User", back_populates="profile")
