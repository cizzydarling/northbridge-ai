# backend/app/models/user_models.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.data.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    profile = relationship("Profile", back_populates="user", uselist=False)