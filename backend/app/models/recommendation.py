from sqlalchemy import Column, Integer, JSON
from app.data.db import Base

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    crs_score = Column(Integer)
    programs = Column(JSON)
    strategy = Column(JSON)
    full_result = Column(JSON)