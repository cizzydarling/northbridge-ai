from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class Matter(Base):
    __tablename__ = "matters"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    matter_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Open")

    target_program = Column(String, nullable=True)
    country_of_residence = Column(String, nullable=True)
    inside_canada = Column(Boolean, nullable=True)

    notes = Column(Text, nullable=True)

    intake_payload = Column(JSONB, nullable=True)
    eligibility_result = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    client = relationship("Client", back_populates="matters")

    disclosure_acceptances = relationship(
        "DisclosureAcceptance",
        cascade="all, delete-orphan",
    )

    documents = relationship(
        "ClientDocument",
        cascade="all, delete-orphan",
    )