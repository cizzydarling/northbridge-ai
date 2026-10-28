"""Only disposable loopback PostgreSQL; no production connection fallback."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from fastapi import HTTPException
from sqlalchemy.orm import sessionmaker
from backend.tests.test_individual_launch_postgres import pg_database_factory, pg_database, migrate  # noqa: F401
from app.models.user_models import User
from app.services.household_service import resolve_application_context
from app.routes.commercial_workspace_routes import save_inputs, SavedFacts
from app.models.self_application_model import SelfApplication

def test_crs_save_serializes_owner_and_preserves_forms(pg_database):
    engine, url = pg_database
    migrate(url)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        user=User(email='sprint3-pg@example.invalid',password='synthetic',role='individual',plan='free')
        db.add(user); db.commit()
        user_id=user.id
        context=resolve_application_context(db,user)
        case_id=context.case.id
        db.add(SelfApplication(user_id=user_id,application_case_id=case_id,matter_type=context.case.application_type,
            intake_payload={'school_name':'Preserve synthetic Forms','unknown':{'keep':True}}))
        db.commit()
    barrier=Barrier(2)
    def save(age):
        with sessions() as db:
            user=db.get(User,user_id)
            barrier.wait(timeout=10)
            try:
                return save_inputs(case_id,SavedFacts(revision=0,facts={'age':age}),db,user)['revision']
            except HTTPException as exc:
                db.rollback()
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(save,[30,31]))==[1,409]
    with sessions() as db:
        row=db.query(SelfApplication).filter_by(user_id=user_id,application_case_id=case_id).one()
        assert row.intake_payload['school_name']=='Preserve synthetic Forms'
        assert row.intake_payload['unknown']=={'keep':True}
        assert row.intake_payload['crs_preparation']['revision']==1
