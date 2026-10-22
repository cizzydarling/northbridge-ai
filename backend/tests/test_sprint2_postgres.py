"""Disposable PostgreSQL rehearsal; never uses ordinary DATABASE_URL."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from backend.tests.test_individual_launch_postgres import pg_database_factory, pg_database, migrate  # noqa: F401
from app.models.user_models import User
from app.models.profile_model import Profile
from app.models.language_assessment_model import LanguageAssessment, LanguageSelection
from app.models.generated_document_model import GeneratedDocument
from app.services.household_service import resolve_application_context
from app.routes.preparation_routes import save_draft, DraftEdit
from app.services.language_assessment_service import VERSION


def test_additive_migration_preserves_legacy_and_selection_owner_constraint(pg_database):
    engine, url = pg_database
    migrate(url, "ad2f6801c947")
    with engine.begin() as conn:
        conn.exec_driver_sql("INSERT INTO users(id,email,password,role,plan) VALUES (1,'sprint2-1@example.invalid','synthetic','individual','free'), (2,'sprint2-2@example.invalid','synthetic','individual','free')")
        conn.exec_driver_sql("INSERT INTO profiles(user_id,english_language_score,language_score) VALUES (1,40,9)")
        conn.exec_driver_sql("INSERT INTO generated_documents(user_id,document_type,title,language,content) VALUES (1,'letter','Existing','en','Preserve exact existing text')")
    migrate(url)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        assert db.query(Profile).filter_by(user_id=1).one().english_language_score == 40
        old = db.query(GeneratedDocument).one()
        assert old.content == "Preserve exact existing text" and old.application_case_id is None and old.revision == 1
        record = LanguageAssessment(user_id=1, language="en", exam="ielts_general", edition="general_training_original", test_date=date(2026, 10, 1), raw_scores={"listening": "8", "reading": "7", "writing": "7", "speaking": "7"}, mapping_version=VERSION, provenance="user_reported")
        db.add(record); db.commit(); record_id = record.id
        db.add(LanguageSelection(user_id=2, language="en", assessment_id=record_id))
        with pytest.raises(sa.exc.IntegrityError):
            db.commit()
        db.rollback()
        db.add(LanguageSelection(user_id=1, language="fr", assessment_id=record_id))
        with pytest.raises(sa.exc.IntegrityError):
            db.commit()
        db.rollback()
    migrate(url)  # Repeat is harmless and no work is recreated.


def test_concurrent_revision_saves_have_one_winner(pg_database):
    engine, url = pg_database
    migrate(url)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        user = User(email="sprint2-lock@example.invalid", password="synthetic", role="individual", plan="individual_pro", subscription_status="active", subscription_current_period_end=datetime.now(timezone.utc) + timedelta(days=30))
        db.add(user); db.commit()
        context = resolve_application_context(db, user)
        draft = GeneratedDocument(user_id=user.id, application_case_id=context.case.id, title="Original", content="Original draft", document_type="preparation_note", language="en", revision=1)
        db.add(draft); db.commit(); user_id, draft_id = user.id, draft.id
    def save(number):
        with sessions() as db:
            try:
                save_draft(draft_id, DraftEdit(revision=1, title="Saved", content=f"Synthetic concurrent draft {number}"), db, db.get(User, user_id))
                return 200
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(save, (1, 2))) == [200, 409]
    with sessions() as db:
        assert db.get(GeneratedDocument, draft_id).revision == 2
