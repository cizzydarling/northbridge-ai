from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.data.db import Base


class DisclosureAcceptance(Base):
    __tablename__ = "disclosure_acceptances"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=True, index=True)

    disclosure_type = Column(String, nullable=False, index=True)
    disclosure_version = Column(String, nullable=False)
    accepted_text_snapshot = Column(Text, nullable=False)

    accepted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)