from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.data.db import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    age = Column(Integer, nullable=True)
    education = Column(String, nullable=True)
    language_score = Column(Integer, nullable=True)
    work_experience = Column(Integer, nullable=True)
    marital_status = Column(String, nullable=True)
    province = Column(String, nullable=True)

    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    user = relationship("User", back_populates="profile")