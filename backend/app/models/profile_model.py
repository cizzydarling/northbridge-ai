from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.data.db import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)

    age = Column(Integer, nullable=False)
    education = Column(String, nullable=False)
    language_score = Column(Integer, nullable=False)
    experience_years = Column(Integer, nullable=False)
    has_job_offer = Column(Boolean, default=False, nullable=False)
    has_canadian_experience = Column(Boolean, default=False, nullable=False)
    studied_in_canada = Column(Boolean, default=False, nullable=False)
    occupation = Column(String, nullable=True)
    noc_code = Column(String, nullable=True)
    preferred_province = Column(String, nullable=True)

    user = relationship("User", back_populates="profile")
    client = relationship("Client", back_populates="profile")