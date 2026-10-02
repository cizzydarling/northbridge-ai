from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.data.db import Base


class SelfApplication(Base):
    __tablename__ = "self_applications"

    __table_args__ = (ForeignKeyConstraint(["application_case_id", "user_id"], ["application_cases.id", "application_cases.owner_user_id"], name="fk_self_application_case_owner"),)
    application_case_id = Column(Integer, nullable=True, index=True)

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