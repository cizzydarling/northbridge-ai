from sqlalchemy import Column, Integer, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.data.db import Base

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    crs_score = Column(Integer)
    programs = Column(JSON)
    strategy = Column(JSON)
    full_result = Column(JSON)

    user = relationship("User")
    profile = relationship("Profile")