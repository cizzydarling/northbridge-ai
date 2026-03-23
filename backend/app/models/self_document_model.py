from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.data.db import Base


class SelfDocument(Base):
    __tablename__ = "self_documents"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    matter_type = Column(String, nullable=False, index=True)
    document_key = Column(String, nullable=False, index=True)
    document_name = Column(String, nullable=False)

    priority = Column(String, nullable=False, default="Required")
    required = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    file_name = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    file_url = Column(String, nullable=True)

    completed = Column(Boolean, nullable=False, default=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=True)

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