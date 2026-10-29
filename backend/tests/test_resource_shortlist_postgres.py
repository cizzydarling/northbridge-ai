"""Additive migration and owner/case constraints, on disposable loopback databases."""
from datetime import datetime,timedelta,timezone
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from backend.tests.test_individual_launch_postgres import pg_database_factory,pg_database,migrate  # noqa: F401
from app.models.user_models import User
from app.models.profile_model import Profile
from app.models.generated_document_model import GeneratedDocument
from app.models.resource_shortlist_model import ResourceShortlist
from app.services.household_service import resolve_application_context


def test_additive_shortlist_preserves_existing_rows_and_revision(pg_database):
 engine,url=pg_database
 migrate(url,'b7e214c9a602')
 with engine.begin() as c:
  c.exec_driver_sql("INSERT INTO users(id,email,password,role,plan) VALUES(1,'shortlist-preserve@example.invalid','synthetic','individual','free')")
  c.exec_driver_sql("INSERT INTO profiles(user_id,occupation,language_score) VALUES(1,'Preserve exact occupation',40)")
  c.exec_driver_sql("INSERT INTO generated_documents(user_id,document_type,title,language,content) VALUES(1,'letter','Preserve title','en','Preserve exact content')")
 migrate(url,'c4f8a2d6e901')
 with engine.connect() as c:
  assert c.exec_driver_sql('SELECT version_num FROM alembic_version').scalar()=='c4f8a2d6e901'
  assert c.exec_driver_sql('SELECT occupation,language_score FROM profiles').one()==('Preserve exact occupation',40)
  assert c.exec_driver_sql('SELECT content,revision FROM generated_documents').one()==('Preserve exact content',1)
  assert c.exec_driver_sql('SELECT count(*) FROM resource_shortlists').scalar()==0
 migrate(url,'c4f8a2d6e901')


def test_case_owner_constraint_and_duplicate_protection(pg_database):
 engine,url=pg_database;migrate(url)
 with sessionmaker(bind=engine,expire_on_commit=False)() as db:
  a=User(email='shortlist-a@example.invalid',password='synthetic',role='individual',plan='free')
  b=User(email='shortlist-b@example.invalid',password='synthetic',role='individual',plan='free')
  db.add_all([a,b]);db.commit();case=resolve_application_context(db,a).case
  db.add(ResourceShortlist(application_case_id=case.id,owner_user_id=b.id,kind='dli',resource_id='a'*32,source_snapshot={'name':'SYNTHETIC'}))
  with pytest.raises(sa.exc.IntegrityError):db.commit()
  db.rollback()
  db.add(ResourceShortlist(application_case_id=case.id,owner_user_id=a.id,kind='dli',resource_id='a'*32,source_snapshot={'name':'SYNTHETIC'}));db.commit()
  db.add(ResourceShortlist(application_case_id=case.id,owner_user_id=a.id,kind='dli',resource_id='a'*32,source_snapshot={'name':'SYNTHETIC'}))
  with pytest.raises(sa.exc.IntegrityError):db.commit()
  db.rollback()
  assert db.query(ResourceShortlist).count()==1
