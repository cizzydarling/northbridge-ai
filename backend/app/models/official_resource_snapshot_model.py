"""Public reference data only; owned selections stay in ResourceShortlist."""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKeyConstraint, UniqueConstraint, CheckConstraint
from app.data.db import Base


class OfficialResourceSnapshot(Base):
    __tablename__ = "official_resource_snapshots"
    id = Column(String(32), primary_key=True)
    source_id = Column(String(24), nullable=False)
    retrieved_at = Column(DateTime(timezone=True), nullable=False)
    record_count = Column(Integer, nullable=False)
    records_sha256 = Column(String(64), nullable=False)
    envelope = Column(JSON, nullable=False)
    records = Column(JSON, nullable=False)
    __table_args__ = (
        UniqueConstraint("source_id", "id", name="uq_official_snapshot_source_id"),
        CheckConstraint("source_id IN ('dli','processing_en','processing_fr')", name="ck_official_snapshot_source"),
        CheckConstraint("record_count > 0", name="ck_official_snapshot_nonempty"),
    )


class OfficialResourceHead(Base):
    __tablename__ = "official_resource_heads"
    source_id = Column(String(24), primary_key=True)
    snapshot_id = Column(String(32), nullable=True)  # transaction-local initial lock slot
    __table_args__ = (
        ForeignKeyConstraint(["source_id", "snapshot_id"],
                             ["official_resource_snapshots.source_id", "official_resource_snapshots.id"],
                             name="fk_official_head_source_snapshot"),
        CheckConstraint("source_id IN ('dli','processing_en','processing_fr')", name="ck_official_head_source"),
    )
