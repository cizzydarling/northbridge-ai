from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(80), nullable=False, unique=True, index=True)
    access_type = Column(String(80), nullable=False, default="individual_premium")
    duration_days = Column(Integer, nullable=False, default=30)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=True)
    current_uses = Column(Integer, nullable=False, default=0)
    active = Column(Boolean, nullable=False, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    redemptions = relationship(
        "PromoCodeRedemption",
        back_populates="promo_code",
        cascade="all, delete-orphan",
    )


class PromoCodeRedemption(Base):
    __tablename__ = "promo_code_redemptions"
    __table_args__ = (
        UniqueConstraint("promo_code_id", "user_id", name="uq_promo_code_user_redemption"),
    )

    id = Column(Integer, primary_key=True, index=True)
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code = Column(String(80), nullable=False, index=True)
    access_type = Column(String(80), nullable=False)
    granted_until = Column(DateTime(timezone=True), nullable=True)
    redeemed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    promo_code = relationship("PromoCode", back_populates="redemptions")
    user = relationship("User", back_populates="promo_code_redemptions")
