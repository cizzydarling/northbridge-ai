from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    status = Column(String, nullable=False, default="Active")
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    documents = relationship(
        "ClientDocument",
        back_populates="client",
        cascade="all, delete-orphan",
    )

    simulation_scenarios = relationship(
        "SavedSimulationScenario",
        back_populates="client",
        cascade="all, delete-orphan",
    )

    matters = relationship(
        "Matter",
        back_populates="client",
        cascade="all, delete-orphan",
    )

    disclosure_acceptances = relationship(
        "DisclosureAcceptance",
        cascade="all, delete-orphan",
    )