from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class ClientDocument(Base):
    __tablename__ = "client_documents"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(
        Integer,
        ForeignKey("clients.id"),
        nullable=False,
        index=True,
    )
    owner_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    matter_id = Column(
        Integer,
        ForeignKey("matters.id"),
        nullable=True,
        index=True,
    )

    document_name = Column(String, nullable=False)
    document_type = Column(String, nullable=True)
    status = Column(String, nullable=False, default="Required")
    notes = Column(Text, nullable=True)

    required = Column(Boolean, nullable=False, default=True)
    generated_from_matter = Column(Boolean, nullable=False, default=False)

    file_name = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    file_url = Column(String, nullable=True)

    uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, nullable=True)

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

    client = relationship("Client", back_populates="documents")
    matter = relationship("Matter", back_populates="documents")