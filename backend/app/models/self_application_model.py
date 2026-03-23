from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.data.db import Base


class SelfApplication(Base):
    __tablename__ = "self_applications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    matter_type = Column(String, nullable=False)

    intake_payload = Column(JSONB, nullable=True)
    eligibility_result = Column(JSONB, nullable=True)
    forms_result = Column(JSONB, nullable=True)
    checklist_result = Column(JSONB, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )