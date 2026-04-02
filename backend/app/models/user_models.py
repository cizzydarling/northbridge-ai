from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.data.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="individual")

    plan = Column(String, nullable=False, default="free")
    subscription_status = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)

    profile = relationship("Profile", back_populates="user", uselist=False)