from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.data.db import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    age = Column(Integer, nullable=False)
    education = Column(String, nullable=False)
    language_score = Column(Integer, nullable=False)
    experience_years = Column(Integer, nullable=False)

    has_job_offer = Column(Boolean, default=False)
    has_canadian_experience = Column(Boolean, default=False)
    studied_in_canada = Column(Boolean, default=False)

    occupation = Column(String, nullable=True)
    noc_code = Column(String, nullable=True)
    preferred_province = Column(String, nullable=True)