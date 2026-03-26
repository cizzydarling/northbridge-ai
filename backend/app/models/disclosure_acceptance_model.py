from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.data.db import Base


class DisclosureAcceptance(Base):
    __tablename__ = "disclosure_acceptances"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=True, index=True)

    disclosure_type = Column(String(100), nullable=False, index=True)
    disclosure_version = Column(String(50), nullable=False, index=True)
    accepted_text_snapshot = Column(Text, nullable=False)

    accepted_by_email_snapshot = Column(String(255), nullable=True)
    acceptance_scope = Column(String(50), nullable=False, server_default="global")
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)

    accepted_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )