from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.sql import func
from app.data.db import Base

class ResourceShortlist(Base):
 __tablename__='resource_shortlists'
 __table_args__=(ForeignKeyConstraint(['application_case_id','owner_user_id'],['application_cases.id','application_cases.owner_user_id'],name='fk_resource_shortlist_case_owner'),UniqueConstraint('application_case_id','kind','resource_id',name='uq_resource_shortlist_record'))
 id=Column(Integer,primary_key=True)
 application_case_id=Column(Integer,nullable=False,index=True)
 owner_user_id=Column(Integer,nullable=False,index=True)
 kind=Column(String(20),nullable=False)
 resource_id=Column(String(32),nullable=False)
 source_snapshot=Column(JSON,nullable=False)
 created_at=Column(DateTime(timezone=True),server_default=func.now(),nullable=False)
