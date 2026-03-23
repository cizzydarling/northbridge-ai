from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class SavedSimulationScenario(Base):
    __tablename__ = "saved_simulation_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    notes = Column(Text, nullable=True)

    current_profile_snapshot = Column(JSONB, nullable=False)
    simulated_changes = Column(JSONB, nullable=False)
    result_payload = Column(JSONB, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", back_populates="simulation_scenarios")